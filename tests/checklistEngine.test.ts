/**
 * Sprint 2C M1 — Jurisdiction-checklist engine tests.
 *
 * Pure-function tests for `evaluatePacket`. Uses a synthetic test manifest
 * (NOT real Orlando, which still ships empty requirements on PR #51) so
 * every severity branch + audit-trail behavior is exercised end-to-end.
 *
 * Covered:
 *   - Empty manifest.requirements → empty items / zeroed summary / no warnings
 *   - severity pass / fail / warn / na (full matrix)
 *   - Locator wiring (returns sheet ID; null when absent)
 *   - Predicate throws → caught + warning pushed + severity:'na'
 *   - Audit trail: necReferences mirrors manifest.codeReferences
 *   - Defensive: null/undefined inputs degrade gracefully
 */
import { describe, it, expect } from 'vitest';
import { evaluatePacket } from '../services/jurisdictionChecklist/checklistEngine';
import type {
  AHJContext,
  AHJManifest,
  AHJRequirement,
  AttachmentSummary,
  PacketAST,
} from '../data/ahj/types';
import { orlandoManifest } from '../data/ahj/orlando';

// ----------------------------------------------------------------------------
// Fixtures
// ----------------------------------------------------------------------------

const ctxExistingSFR: AHJContext = {
  scope: 'existing-service',
  lane: 'contractor_exemption',
  buildingType: 'single_family_residential',
};

const ctxNewServiceCommercial: AHJContext = {
  scope: 'new-service',
  lane: 'pe_required',
  buildingType: 'commercial',
};

/**
 * Build a synthetic manifest with 5 requirements covering every severity
 * branch + the locator + the predicate-throw fault path.
 */
function buildTestManifest(requirements: AHJRequirement[]): AHJManifest {
  return {
    id: 'test-ahj',
    name: 'Test AHJ',
    jurisdictionType: 'city',
    necEdition: {
      single_family_residential: 'NEC 2020',
      multi_family: 'NEC 2020',
      commercial: 'NEC 2020',
    },
    fbcEdition: 'FBC 8th ed (2023)',
    sheetIdPrefix: 'E-',
    generalNotes: ['Test note 1'],
    codeReferences: ['NFPA-70 (2020 NEC)', 'FBC 8th ed (2023)'],
    relevantSections: [],
    relevantArtifactTypes: [],
    requirements,
  };
}

// Detector helpers — typical predicates the engine handles.
const detectArtifact =
  (type: string) =>
  (_packet: PacketAST, attachments: AttachmentSummary[]) =>
    attachments.some((a) => a.artifactType === type);

const detectSection =
  (key: string) =>
  (packet: PacketAST) =>
    Array.isArray(packet.sectionKeys) &&
    (packet.sectionKeys as string[]).includes(key);

const locateArtifact =
  (type: string) =>
  (_packet: PacketAST) => {
    // Locators normally walk packet.sheetIds; for tests we just hard-code
    // the link target so the engine's wiring (NOT the locator's logic) is
    // what's under test.
    return `C-201`;
  };

// ----------------------------------------------------------------------------
// Empty-requirements path
// ----------------------------------------------------------------------------

describe('evaluatePacket — empty requirements (Orlando today)', () => {
  it('returns empty items + zeroed summary + no warnings', () => {
    const manifest = buildTestManifest([]);
    const result = evaluatePacket({}, [], manifest, ctxExistingSFR);

    expect(result.items).toEqual([]);
    expect(result.summary).toEqual({
      total: 0,
      totalRequired: 0,
      passing: 0,
      failing: 0,
    });
    expect(result.warnings).toEqual([]);
  });

  it('still carries audit-trail necReferences from the manifest', () => {
    const manifest = buildTestManifest([]);
    const result = evaluatePacket({}, [], manifest, ctxExistingSFR);
    expect(result.necReferences).toEqual([
      'NFPA-70 (2020 NEC)',
      'FBC 8th ed (2023)',
    ]);
  });

  it('handles the real Orlando manifest (now populated post-M1 backport)', () => {
    // Orlando's requirements[] was empty when this test was first written
    // (PR #51 scaffold); the M1 follow-up populated it. The engine should
    // emit items for every requirement and still surface NEC references.
    const result = evaluatePacket({}, [], orlandoManifest, ctxExistingSFR);
    expect(result.items.length).toBe(orlandoManifest.requirements.length);
    expect(result.summary.total).toBe(orlandoManifest.requirements.length);
    expect(result.necReferences.length).toBeGreaterThan(0);
  });
});

// ----------------------------------------------------------------------------
// Severity branches
// ----------------------------------------------------------------------------

describe('evaluatePacket — severity matrix', () => {
  const requirements: AHJRequirement[] = [
    {
      // PASS: required && present
      id: 'site-plan',
      name: 'Site plan',
      category: 'plan',
      required: () => true,
      detect: detectArtifact('site_plan'),
      locator: locateArtifact('site_plan'),
    },
    {
      // FAIL: required && !present
      id: 'noc',
      name: 'Notice of Commencement',
      category: 'application',
      required: () => true,
      detect: detectArtifact('noc'),
    },
    {
      // WARN: !required && present (optional upload submitted)
      id: 'hoa',
      name: 'HOA approval letter',
      category: 'upload',
      required: () => false,
      detect: detectArtifact('hoa_letter'),
    },
    {
      // NA: !required && !present
      id: 'survey',
      name: 'Property survey',
      category: 'upload',
      required: () => false,
      detect: detectArtifact('survey'),
    },
    {
      // PASS via section detection (no locator wired)
      id: 'general-notes',
      name: 'General notes page',
      category: 'narrative',
      required: () => true,
      detect: detectSection('generalNotes'),
    },
  ];

  const manifest = buildTestManifest(requirements);

  const packet: PacketAST = {
    sheetIds: ['E-001', 'E-101', 'C-201'],
    sectionKeys: ['generalNotes', 'tableOfContents'],
  };

  const attachments: AttachmentSummary[] = [
    { artifactType: 'site_plan', sheetId: 'C-201' },
    { artifactType: 'hoa_letter', sheetId: 'X-205' },
  ];

  it('marks required+present as pass', () => {
    const result = evaluatePacket(packet, attachments, manifest, ctxExistingSFR);
    const sitePlan = result.items.find((i) => i.id === 'site-plan')!;
    expect(sitePlan.severity).toBe('pass');
    expect(sitePlan.required).toBe(true);
    expect(sitePlan.present).toBe(true);
  });

  it('marks required+missing as fail (blocks AHJ acceptance)', () => {
    const result = evaluatePacket(packet, attachments, manifest, ctxExistingSFR);
    const noc = result.items.find((i) => i.id === 'noc')!;
    expect(noc.severity).toBe('fail');
    expect(noc.required).toBe(true);
    expect(noc.present).toBe(false);
  });

  it('marks optional-but-submitted as warn', () => {
    const result = evaluatePacket(packet, attachments, manifest, ctxExistingSFR);
    const hoa = result.items.find((i) => i.id === 'hoa')!;
    expect(hoa.severity).toBe('warn');
    expect(hoa.required).toBe(false);
    expect(hoa.present).toBe(true);
  });

  it('marks optional-and-absent as na', () => {
    const result = evaluatePacket(packet, attachments, manifest, ctxExistingSFR);
    const survey = result.items.find((i) => i.id === 'survey')!;
    expect(survey.severity).toBe('na');
    expect(survey.required).toBe(false);
    expect(survey.present).toBe(false);
  });

  it('detects section-based requirements via packet.sectionKeys', () => {
    const result = evaluatePacket(packet, attachments, manifest, ctxExistingSFR);
    const gn = result.items.find((i) => i.id === 'general-notes')!;
    expect(gn.severity).toBe('pass');
  });

  it('summary counts every branch correctly', () => {
    const result = evaluatePacket(packet, attachments, manifest, ctxExistingSFR);
    expect(result.summary.total).toBe(5);
    // required: site-plan, noc, general-notes
    expect(result.summary.totalRequired).toBe(3);
    // pass: site-plan, general-notes
    expect(result.summary.passing).toBe(2);
    // fail: noc
    expect(result.summary.failing).toBe(1);
  });

  it('preserves manifest order in items[]', () => {
    const result = evaluatePacket(packet, attachments, manifest, ctxExistingSFR);
    expect(result.items.map((i) => i.id)).toEqual([
      'site-plan',
      'noc',
      'hoa',
      'survey',
      'general-notes',
    ]);
  });
});

// ----------------------------------------------------------------------------
// Locator wiring
// ----------------------------------------------------------------------------

describe('evaluatePacket — locator wiring', () => {
  it('returns the locator string for present items with a locator', () => {
    const manifest = buildTestManifest([
      {
        id: 'site-plan',
        name: 'Site plan',
        category: 'plan',
        required: () => true,
        detect: detectArtifact('site_plan'),
        locator: () => 'C-201',
      },
    ]);
    const result = evaluatePacket(
      {},
      [{ artifactType: 'site_plan' }],
      manifest,
      ctxExistingSFR,
    );
    expect(result.items[0].location).toBe('C-201');
  });

  it('returns null when no locator is supplied', () => {
    const manifest = buildTestManifest([
      {
        id: 'noc',
        name: 'Notice of Commencement',
        category: 'application',
        required: () => true,
        detect: () => true,
      },
    ]);
    const result = evaluatePacket({}, [], manifest, ctxExistingSFR);
    expect(result.items[0].location).toBeNull();
  });

  it('returns null when locator returns empty/whitespace string', () => {
    const manifest = buildTestManifest([
      {
        id: 'site-plan',
        name: 'Site plan',
        category: 'plan',
        required: () => true,
        detect: () => true,
        locator: () => '   ',
      },
    ]);
    const result = evaluatePacket({}, [], manifest, ctxExistingSFR);
    expect(result.items[0].location).toBeNull();
  });

  it('returns null when locator returns null', () => {
    const manifest = buildTestManifest([
      {
        id: 'noc',
        name: 'NOC',
        category: 'application',
        required: () => true,
        detect: () => true,
        locator: () => null,
      },
    ]);
    const result = evaluatePacket({}, [], manifest, ctxExistingSFR);
    expect(result.items[0].location).toBeNull();
  });
});

// ----------------------------------------------------------------------------
// Predicate throws — engine must never crash
// ----------------------------------------------------------------------------

describe('evaluatePacket — never throws on malformed predicates', () => {
  it('catches required() throw and pushes a warning', () => {
    const manifest = buildTestManifest([
      {
        id: 'broken-required',
        name: 'Broken required',
        category: 'plan',
        required: () => {
          throw new Error('boom');
        },
        detect: () => true,
      },
    ]);
    const result = evaluatePacket({}, [], manifest, ctxExistingSFR);
    expect(result.items.length).toBe(1);
    // required defaulted to false on throw → not-required + present → 'warn'
    // (caller can tell from the warning that something is off; the item
    //  doesn't crash the packet)
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/broken-required/);
    expect(result.warnings[0]).toMatch(/required/);
  });

  it('catches detect() throw and pushes a warning', () => {
    const manifest = buildTestManifest([
      {
        id: 'broken-detect',
        name: 'Broken detect',
        category: 'plan',
        required: () => true,
        detect: () => {
          throw new Error('detect failure');
        },
      },
    ]);
    const result = evaluatePacket({}, [], manifest, ctxExistingSFR);
    // required=true, present=false (default on throw) → severity:'fail'
    expect(result.items[0].severity).toBe('fail');
    expect(result.warnings.some((w) => /broken-detect/.test(w))).toBe(true);
    expect(result.warnings.some((w) => /detect/.test(w))).toBe(true);
  });

  it('catches locator() throw and degrades to null', () => {
    const manifest = buildTestManifest([
      {
        id: 'broken-locator',
        name: 'Broken locator',
        category: 'plan',
        required: () => true,
        detect: () => true,
        locator: () => {
          throw new Error('locator failure');
        },
      },
    ]);
    const result = evaluatePacket({}, [], manifest, ctxExistingSFR);
    // pass severity unchanged; locator failure surfaces as warning only
    expect(result.items[0].severity).toBe('pass');
    expect(result.items[0].location).toBeNull();
    expect(result.warnings.some((w) => /broken-locator/.test(w))).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// Context-routing — ctx threads through to required()
// ----------------------------------------------------------------------------

describe('evaluatePacket — context routing', () => {
  it('forks on ctx.scope (Orlando NEC 220.87 narrative is existing-only)', () => {
    const manifest = buildTestManifest([
      {
        id: 'nec-22087-narrative',
        name: 'NEC 220.87 narrative',
        category: 'narrative',
        required: (ctx) => ctx.scope === 'existing-service',
        detect: () => false,
      },
    ]);
    const existing = evaluatePacket({}, [], manifest, ctxExistingSFR);
    expect(existing.items[0].severity).toBe('fail'); // required, not present

    const newSvc = evaluatePacket({}, [], manifest, ctxNewServiceCommercial);
    expect(newSvc.items[0].severity).toBe('na'); // not required, not present
  });

  it('forks on ctx.buildingType (Pompano Fire Review excludes SFR)', () => {
    const manifest = buildTestManifest([
      {
        id: 'fire-review',
        name: 'Fire Review Application',
        category: 'application',
        required: (ctx) => ctx.buildingType !== 'single_family_residential',
        detect: () => false,
      },
    ]);
    const sfr = evaluatePacket({}, [], manifest, ctxExistingSFR);
    expect(sfr.items[0].required).toBe(false);
    expect(sfr.items[0].severity).toBe('na');

    const commercial = evaluatePacket({}, [], manifest, ctxNewServiceCommercial);
    expect(commercial.items[0].required).toBe(true);
    expect(commercial.items[0].severity).toBe('fail');
  });
});

// ----------------------------------------------------------------------------
// Defensive — bad inputs degrade gracefully
// ----------------------------------------------------------------------------

describe('evaluatePacket — defensive degradation', () => {
  it('tolerates null packet (treats as {})', () => {
    const manifest = buildTestManifest([
      {
        id: 'noc',
        name: 'NOC',
        category: 'application',
        required: () => true,
        detect: () => false,
      },
    ]);
    // @ts-expect-error — runtime defensive check
    const result = evaluatePacket(null, [], manifest, ctxExistingSFR);
    expect(result.items.length).toBe(1);
    expect(result.items[0].severity).toBe('fail');
  });

  it('tolerates non-array attachments', () => {
    const manifest = buildTestManifest([
      {
        id: 'noc',
        name: 'NOC',
        category: 'application',
        required: () => true,
        detect: detectArtifact('noc'),
      },
    ]);
    // @ts-expect-error — runtime defensive check
    const result = evaluatePacket({}, undefined, manifest, ctxExistingSFR);
    expect(result.items[0].severity).toBe('fail');
  });

  it('tolerates manifest with missing/non-array requirements', () => {
    const broken = {
      ...buildTestManifest([]),
      requirements: undefined as unknown as AHJRequirement[],
    } as AHJManifest;
    const result = evaluatePacket({}, [], broken, ctxExistingSFR);
    expect(result.items).toEqual([]);
    expect(result.summary.total).toBe(0);
  });
});
