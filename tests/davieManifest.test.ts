/**
 * Sprint 2C M1 — Town of Davie manifest test.
 *
 * Davie is the best commercial-vs-residential test case because Davie's
 * checklist is the **only one of the four 2C AHJs that calls out
 * commercial-only items in writing**:
 *   - H27 — Knox-box (KLS-4505) + switchboard signage + NEC 625.42 locking-means
 *   - H28 — Bollard protection for outdoor transformer / equipment
 *   - H29 — Master manual shutdown shunt for multi-dispenser sites
 *
 * Each of those three requirements must return `required: true` for a
 * commercial project and `required: false` for SFR / multi-family. These
 * assertions are the regression guard for the H27/H28/H29 commercial-only
 * gating — if a future refactor accidentally flips a predicate to a
 * non-`buildingType` axis (e.g., `ctx.scope`), these tests fail loudly.
 */
import { describe, it, expect } from 'vitest';
import { davieManifest } from '../data/ahj/davie';
import type { AHJContext, AHJRequirement, PacketAST, AttachmentSummary } from '../data/ahj/types';

// ----------------------------------------------------------------------------
// Test contexts — one per BuildingType, plus a PE-lane variant
// ----------------------------------------------------------------------------

const sfrContext: AHJContext = {
  scope: 'existing-service',
  lane: 'contractor_exemption',
  buildingType: 'single_family_residential',
};

const multiFamilyContext: AHJContext = {
  scope: 'existing-service',
  lane: 'contractor_exemption',
  buildingType: 'multi_family',
};

const commercialContext: AHJContext = {
  scope: 'new-service',
  lane: 'pe_required',
  buildingType: 'commercial',
};

const sfrPELaneContext: AHJContext = {
  scope: 'new-service',
  lane: 'pe_required',
  buildingType: 'single_family_residential',
};

// Helper: empty packet + attachments for predicate-only assertions
const emptyPacket: PacketAST = { sheetIds: [], sectionKeys: [] };
const noAttachments: AttachmentSummary[] = [];

function findReq(id: string): AHJRequirement {
  const req = davieManifest.requirements.find((r) => r.id === id);
  if (!req) {
    throw new Error(
      `Requirement '${id}' not found in davieManifest. ` +
        `Available: ${davieManifest.requirements.map((r) => r.id).join(', ')}`,
    );
  }
  return req;
}

// ----------------------------------------------------------------------------
// Manifest shape / parseability
// ----------------------------------------------------------------------------

describe('Davie manifest — shape and structural validity', () => {
  it('parses as a valid AHJManifest with the expected core fields', () => {
    expect(davieManifest.id).toBe('davie');
    expect(davieManifest.name).toBe('Town of Davie');
    expect(davieManifest.jurisdictionType).toBe('city');
    expect(davieManifest.subjurisdiction).toBeUndefined();
    expect(davieManifest.sheetIdPrefix).toBe('E-');
    expect(davieManifest.fbcEdition).toBe('FBC 8th ed (2023)');
  });

  it('cites NEC 2020 uniformly across all building types', () => {
    expect(davieManifest.necEdition.single_family_residential).toBe('NEC 2020');
    expect(davieManifest.necEdition.multi_family).toBe('NEC 2020');
    expect(davieManifest.necEdition.commercial).toBe('NEC 2020');
  });

  it('exposes Davie-specific code references (BCPA + Davie ordinances)', () => {
    expect(davieManifest.codeReferences).toContain('NFPA-70 (2020 NEC)');
    expect(davieManifest.codeReferences).toContain(
      'Florida Building Code, 8th edition (2023)',
    );
    expect(
      davieManifest.codeReferences.some((c) =>
        /Broward County Amendments/i.test(c),
      ),
    ).toBe(true);
    expect(
      davieManifest.codeReferences.some((c) => /Town of Davie/i.test(c)),
    ).toBe(true);
  });

  it('surfaces Davie-specific intake artifact slots (notarized addendum + BCPA + fire-review)', () => {
    expect(davieManifest.relevantArtifactTypes).toContain('notarized_addendum');
    expect(davieManifest.relevantArtifactTypes).toContain('property_ownership_search');
    expect(davieManifest.relevantArtifactTypes).toContain('fire_review_application');
    // Should NOT include Hillsborough or Pompano-only artifacts
    expect(davieManifest.relevantArtifactTypes).not.toContain('hoa_letter');
    expect(davieManifest.relevantArtifactTypes).not.toContain('zoning_application');
    expect(davieManifest.relevantArtifactTypes).not.toContain('flood_elevation_certificate');
  });
});

// ----------------------------------------------------------------------------
// Requirements count — guards against accidental drops or duplicates
// ----------------------------------------------------------------------------

describe('Davie manifest — requirements list', () => {
  it('has the expected number of requirements (14)', () => {
    // 4 application + 3 plan (shared) + 3 commercial-only + 2 inspection + 2 narrative
    expect(davieManifest.requirements).toHaveLength(14);
  });

  it('every requirement has a unique id', () => {
    const ids = davieManifest.requirements.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every requirement id is prefixed with davie-', () => {
    for (const req of davieManifest.requirements) {
      expect(req.id.startsWith('davie-')).toBe(true);
    }
  });
});

// ----------------------------------------------------------------------------
// H27 / H28 / H29 commercial-only gating — REGRESSION GUARD
// ----------------------------------------------------------------------------

describe('Davie manifest — commercial-only requirements (H27 / H28 / H29)', () => {
  it('H27 Knox-box + signage + locking-means is required ONLY for commercial', () => {
    const req = findReq('davie-knox-box-emergency-shutoff');
    expect(req.required(sfrContext)).toBe(false);
    expect(req.required(multiFamilyContext)).toBe(false);
    expect(req.required(commercialContext)).toBe(true);
  });

  it('H28 bollard protection is required ONLY for commercial', () => {
    const req = findReq('davie-bollard-protection');
    expect(req.required(sfrContext)).toBe(false);
    expect(req.required(multiFamilyContext)).toBe(false);
    expect(req.required(commercialContext)).toBe(true);
  });

  it('H29 master manual shutdown shunt is required ONLY for commercial', () => {
    const req = findReq('davie-master-manual-shutdown-shunt');
    expect(req.required(sfrContext)).toBe(false);
    expect(req.required(multiFamilyContext)).toBe(false);
    expect(req.required(commercialContext)).toBe(true);
  });

  it('H27/H28/H29 are all gated on buildingType (not on scope or lane)', () => {
    // Flip the scope axis on a SFR context — still must NOT be required
    const sfrNewService: AHJContext = { ...sfrContext, scope: 'new-service' };
    const sfrPE: AHJContext = { ...sfrContext, lane: 'pe_required' };
    const mfNewService: AHJContext = { ...multiFamilyContext, scope: 'new-service' };

    for (const id of [
      'davie-knox-box-emergency-shutoff',
      'davie-bollard-protection',
      'davie-master-manual-shutdown-shunt',
    ]) {
      const req = findReq(id);
      expect(req.required(sfrNewService)).toBe(false);
      expect(req.required(sfrPE)).toBe(false);
      expect(req.required(mfNewService)).toBe(false);
    }
  });

  it('H28/H29 default to detect()=false (manual verification required surface)', () => {
    // Per the manifest comments: SparkPlan has no first-class data point for
    // outdoor equipment exposure or dispenser count, so these requirements
    // surface as "Action required" until the contractor confirms manually.
    expect(findReq('davie-bollard-protection').detect(emptyPacket, noAttachments)).toBe(false);
    expect(
      findReq('davie-master-manual-shutdown-shunt').detect(emptyPacket, noAttachments),
    ).toBe(false);
  });
});

// ----------------------------------------------------------------------------
// Generic predicate tests — NOC + PE-lane / scope orthogonality
// ----------------------------------------------------------------------------

describe('Davie manifest — generic predicate behavior', () => {
  it('NOC is required for non-SFR (FL Statute 713) and not for SFR by default', () => {
    const req = findReq('davie-noc-5k');
    expect(req.required(sfrContext)).toBe(false);
    expect(req.required(sfrPELaneContext)).toBe(false);
    expect(req.required(multiFamilyContext)).toBe(true);
    expect(req.required(commercialContext)).toBe(true);
  });

  it('Notarized addendum (H25) and BCPA ownership (H26) are required for every project type', () => {
    const addendum = findReq('davie-notarized-addendum');
    const bcpa = findReq('davie-property-ownership-search');
    for (const ctx of [sfrContext, multiFamilyContext, commercialContext, sfrPELaneContext]) {
      expect(addendum.required(ctx)).toBe(true);
      expect(bcpa.required(ctx)).toBe(true);
    }
  });
});
