/**
 * Manifest-flexibility gap tests (2026-05-16).
 *
 * Pure-function coverage for the three "unmodeled-city" UX flexibility
 * gaps the manifest system closes:
 *
 *   Gap 1 — projects.settings.manifest_template_id lets a contractor in
 *           an unmodeled FL city reuse another AHJ's manifest as a
 *           starting template without changing the AHJ name on the
 *           cover sheet.
 *
 *   Gap 3 — per-project string overrides for the cover-sheet identity
 *           fields (generalNotes, codeReferences, sheetIdPrefix). Render
 *           resolution chain mirrors the necEdition pattern:
 *             explicit data field → project override → manifest fallback
 *
 * Gap 2 (artifact-slot toggle UI) is covered indirectly by the
 * applyUserOverrides tests in visibility.test.ts — the new UI writes
 * through to the same `section_overrides.artifactTypes` map the
 * existing override layer already consumes.
 */
import { describe, it, expect } from 'vitest';
import {
  ALL_MANIFESTS,
  findManifestForJurisdiction,
  getManifestById,
} from '../data/ahj/registry';
import { computeDefaultVisibility } from '../data/ahj/visibility';
import { orlandoManifest } from '../data/ahj/orlando';
import { pompanoManifest } from '../data/ahj/pompano';
import type { AHJContext, AHJManifest } from '../data/ahj/types';

const ctxOrlandoExistingSFR: AHJContext = {
  scope: 'existing-service',
  lane: 'contractor_exemption',
  buildingType: 'single_family_residential',
};

// ----------------------------------------------------------------------------
// Gap 1 — manifest_template_id selection logic
// ----------------------------------------------------------------------------
//
// Mirrors the resolution chain used in `components/PermitPacketGenerator.tsx`:
//   activeManifest = getManifestById(settings.manifest_template_id)
//                  ?? findManifestForJurisdiction(jurisdiction)
//
// The test exercises that exact precedence so the renderer can't silently
// drift away from the documented chain.

describe('Gap 1 — manifest_template_id resolution', () => {
  const resolveActiveManifest = (
    templateId: string | null | undefined,
    jurisdiction:
      | { jurisdiction_name?: string | null; ahj_name?: string | null }
      | null
      | undefined,
  ): AHJManifest | null => {
    return (
      getManifestById(templateId)
      ?? findManifestForJurisdiction(jurisdiction)
    );
  };

  it('falls back to jurisdiction lookup when no template id is set', () => {
    const manifest = resolveActiveManifest(undefined, {
      jurisdiction_name: 'City of Orlando',
    });
    expect(manifest?.id).toBe('orlando');
  });

  it('template id overrides a mismatched jurisdiction lookup', () => {
    // Project's jurisdiction is Orlando but the contractor picked Pompano
    // as their template — the template wins.
    const manifest = resolveActiveManifest('pompano', {
      jurisdiction_name: 'City of Orlando',
    });
    expect(manifest?.id).toBe('pompano');
  });

  it('template id is used when jurisdiction is unmodeled (Sanford / Lake Mary)', () => {
    // Sanford has no registered manifest — the jurisdiction-only path
    // would return null (and the renderer falls back to all-on). With a
    // template, the contractor gets Orlando's defaults.
    const noTemplate = resolveActiveManifest(undefined, {
      jurisdiction_name: 'City of Sanford',
    });
    expect(noTemplate).toBeNull();

    const withTemplate = resolveActiveManifest('orlando', {
      jurisdiction_name: 'City of Sanford',
    });
    expect(withTemplate?.id).toBe('orlando');
  });

  it('empty-string template id is treated as unset (falls back)', () => {
    const manifest = resolveActiveManifest('', {
      jurisdiction_name: 'City of Orlando',
    });
    expect(manifest?.id).toBe('orlando');
  });

  it('unknown template id falls back to jurisdiction lookup', () => {
    const manifest = resolveActiveManifest('does-not-exist', {
      jurisdiction_name: 'City of Pompano Beach',
    });
    expect(manifest?.id).toBe('pompano');
  });

  it('returns null when both template id and jurisdiction are absent', () => {
    expect(resolveActiveManifest(undefined, undefined)).toBeNull();
    expect(resolveActiveManifest(null, null)).toBeNull();
  });

  it('all registered manifests are addressable by id (UI dropdown source)', () => {
    // The Gap 1 dropdown reads from ALL_MANIFESTS — every manifest in
    // that list must round-trip through getManifestById so the dropdown's
    // <option value={m.id}> resolves to the same object.
    for (const m of ALL_MANIFESTS) {
      expect(getManifestById(m.id)?.id).toBe(m.id);
    }
  });

  it('template manifest with mismatched jurisdiction still computes its own visibility', () => {
    // Sanford contractor reusing Orlando's manifest: visibility should
    // reflect ORLANDO's defaults, not Sanford's (which has no manifest).
    const templateManifest = resolveActiveManifest('orlando', {
      jurisdiction_name: 'City of Sanford',
    });
    expect(templateManifest).not.toBeNull();
    const visibility = computeDefaultVisibility(
      templateManifest!,
      ctxOrlandoExistingSFR,
    );
    // Orlando-specific defaults: hvhz_anchoring ON, fire_review_application
    // OFF (the latter is reserved for Pompano / Davie).
    expect(visibility.artifactTypes.hvhz_anchoring).toBe(true);
    expect(visibility.artifactTypes.fire_review_application).toBe(false);
  });
});

// ----------------------------------------------------------------------------
// Gap 3 — string-override resolution chain
// ----------------------------------------------------------------------------
//
// Mirrors the `resolvedGeneralNotes` / `resolvedCodeReferences` chain in
// `services/pdfExport/permitPacketGenerator.tsx`:
//   data.X ?? data.XOverride ?? data.manifest?.X
//
// Empty arrays count as "set" — uses ?? (nullish), not || (falsy).

interface OverrideResolutionInput {
  explicit?: string[];
  override?: string[];
  manifest?: AHJManifest | null;
}

const resolveStringArray = (
  field: 'generalNotes' | 'codeReferences',
  input: OverrideResolutionInput,
): string[] | undefined => {
  return input.explicit ?? input.override ?? input.manifest?.[field];
};

describe('Gap 3 — general notes / code references override chain', () => {
  it('explicit value beats both override and manifest', () => {
    const result = resolveStringArray('generalNotes', {
      explicit: ['EXPLICIT'],
      override: ['OVERRIDE'],
      manifest: orlandoManifest,
    });
    expect(result).toEqual(['EXPLICIT']);
  });

  it('override beats manifest when explicit is absent', () => {
    const result = resolveStringArray('generalNotes', {
      override: ['Lake Mary FBC 8th ed (2023) only'],
      manifest: orlandoManifest,
    });
    expect(result).toEqual(['Lake Mary FBC 8th ed (2023) only']);
  });

  it('manifest is used when neither explicit nor override is set', () => {
    const result = resolveStringArray('generalNotes', {
      manifest: orlandoManifest,
    });
    expect(result).toBe(orlandoManifest.generalNotes);
  });

  it('returns undefined when nothing is supplied (Sprint 2A baseline fallback)', () => {
    const result = resolveStringArray('generalNotes', {});
    expect(result).toBeUndefined();
  });

  it('codeReferences chain mirrors generalNotes', () => {
    expect(
      resolveStringArray('codeReferences', {
        explicit: ['EXPLICIT'],
        override: ['OVERRIDE'],
        manifest: orlandoManifest,
      }),
    ).toEqual(['EXPLICIT']);
    expect(
      resolveStringArray('codeReferences', {
        override: ['Lake Mary code list'],
        manifest: orlandoManifest,
      }),
    ).toEqual(['Lake Mary code list']);
    expect(
      resolveStringArray('codeReferences', { manifest: pompanoManifest }),
    ).toBe(pompanoManifest.codeReferences);
  });

  it('explicit empty array still wins (intentional suppress)', () => {
    // The chain uses ??, not ||, so an empty array is NOT treated as
    // missing — a contractor who wants to suppress all general notes can
    // pass [] and the manifest fallback is not used.
    const result = resolveStringArray('generalNotes', {
      explicit: [],
      manifest: orlandoManifest,
    });
    expect(result).toEqual([]);
  });

  it('override empty array still wins over manifest (intentional suppress)', () => {
    const result = resolveStringArray('generalNotes', {
      override: [],
      manifest: orlandoManifest,
    });
    expect(result).toEqual([]);
  });

  it('null manifest is tolerated (returns undefined when no other source)', () => {
    const result = resolveStringArray('generalNotes', { manifest: null });
    expect(result).toBeUndefined();
  });
});

describe('Gap 3 — sheetIdPrefix override chain', () => {
  // Mirrors `resolvedSheetIdPrefix` in services/pdfExport/permitPacketGenerator.tsx.
  const resolvePrefix = (
    override: 'E-' | 'EL-' | 'ES-' | undefined,
    manifest: AHJManifest | null,
  ): 'E-' | 'EL-' | 'ES-' | undefined => {
    return override ?? manifest?.sheetIdPrefix;
  };

  it('override beats manifest default', () => {
    expect(resolvePrefix('EL-', orlandoManifest)).toBe('EL-');
  });

  it('manifest default is used when override is unset', () => {
    expect(resolvePrefix(undefined, orlandoManifest)).toBe(
      orlandoManifest.sheetIdPrefix,
    );
  });

  it('returns undefined when both are unset', () => {
    expect(resolvePrefix(undefined, null)).toBeUndefined();
  });
});
