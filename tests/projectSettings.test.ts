/**
 * PR-2 Step 7 (2026-05-27) — `isExistingConstructionProject` helper must
 * coerce null/undefined `service_modification_type` to 'existing',
 * matching the UI default at ProjectSetup.tsx:286 + the PDF gate from
 * PR-2 Step 1.
 *
 * Before this helper landed, the in-app PanelSchedule + DwellingLoadCalculator
 * gates short-circuited `null && ...` to false and suppressed EXIST/NEW
 * badges + existing-construction-only form controls for legacy projects
 * whose DB column had never been written. The user observed this on the
 * 2026-05-27 'new 4-plex' walkthrough and the fix is folded into PR-2
 * Step 7. If this helper's defaulting behavior regresses, those UI
 * surfaces break silently again.
 */

import { describe, it, expect } from 'vitest';
import {
  isExistingConstructionProject,
  deriveNarrativeOccupancy,
} from '../lib/projectSettings';
import type { Project } from '../types';

describe('isExistingConstructionProject (PR-2 Step 7)', () => {
  it('returns true when service_modification_type is undefined (legacy default)', () => {
    expect(isExistingConstructionProject({ settings: {} })).toBe(true);
  });

  it('returns true when settings is missing entirely', () => {
    expect(isExistingConstructionProject({})).toBe(true);
  });

  it('returns true when settings is null', () => {
    expect(isExistingConstructionProject({ settings: null })).toBe(true);
  });

  it('returns true for explicit existing', () => {
    expect(
      isExistingConstructionProject({ settings: { service_modification_type: 'existing' } }),
    ).toBe(true);
  });

  it('returns true for service-upgrade', () => {
    expect(
      isExistingConstructionProject({ settings: { service_modification_type: 'service-upgrade' } }),
    ).toBe(true);
  });

  it('returns false only for explicit new-service', () => {
    expect(
      isExistingConstructionProject({ settings: { service_modification_type: 'new-service' } }),
    ).toBe(false);
  });
});

/**
 * Sprint 3 (2026-05-27) — `deriveNarrativeOccupancy` drives which NEC 220
 * Part III subsections the calculated-method existing-service narrative
 * page cites. Pre-Sprint 3 the codebase hard-coded dwelling subsections
 * (220.82 / 220.84) on every packet regardless of occupancy.
 *
 * The five cases here are exhaustive over `project.type` ×
 * `dwellingType` × existing-vs-new. Any regression silently re-introduces
 * dwelling-vs-commercial citation drift.
 */
describe('deriveNarrativeOccupancy (Sprint 3)', () => {
  // `deriveNarrativeOccupancy` accepts the narrow slice of Project it needs
  // (type + settings.residential.dwellingType + settings.service_modification_type)
  // — far less than the full Project interface. Test fixtures use a wide
  // `Record<string, unknown>` cast to keep them minimal; the runtime
  // behavior is what's being verified, not the full type compatibility.
  const proj = (overrides: Record<string, unknown>): Project =>
    overrides as unknown as Project;

  it('returns "commercial" for Commercial project type', () => {
    expect(deriveNarrativeOccupancy(proj({ type: 'Commercial' })))
      .toBe('commercial');
  });

  it('returns "industrial" for Industrial project type', () => {
    expect(deriveNarrativeOccupancy(proj({ type: 'Industrial' })))
      .toBe('industrial');
  });

  it('returns "dwelling_multi_family" for Residential + dwellingType=multi_family', () => {
    expect(
      deriveNarrativeOccupancy(
        proj({
          type: 'Residential',
          settings: { residential: { dwellingType: 'multi_family' } },
        }),
      ),
    ).toBe('dwelling_multi_family');
  });

  it('returns "dwelling_single_family_existing" for Residential + single_family + existing modification', () => {
    expect(
      deriveNarrativeOccupancy(
        proj({
          type: 'Residential',
          settings: {
            residential: { dwellingType: 'single_family' },
            service_modification_type: 'existing',
          },
        }),
      ),
    ).toBe('dwelling_single_family_existing');
  });

  it('returns "dwelling_single_family_new" for Residential + single_family + new-service', () => {
    expect(
      deriveNarrativeOccupancy(
        proj({
          type: 'Residential',
          settings: {
            residential: { dwellingType: 'single_family' },
            service_modification_type: 'new-service',
          },
        }),
      ),
    ).toBe('dwelling_single_family_new');
  });

  it('defaults missing dwellingType to single_family (existing-construction fallback)', () => {
    // Mirrors the codebase default at PermitPacketGenerator.tsx:657 / :907.
    expect(
      deriveNarrativeOccupancy(
        proj({
          type: 'Residential',
          settings: {},
        }),
      ),
    ).toBe('dwelling_single_family_existing');
  });

  it('treats service-upgrade as existing-construction (not new-service)', () => {
    // Matches [[isExistingConstructionProject]] semantics — only 'new-service'
    // is explicitly NEW; everything else (including 'service-upgrade') is
    // existing-construction.
    expect(
      deriveNarrativeOccupancy(
        proj({
          type: 'Residential',
          settings: {
            residential: { dwellingType: 'single_family' },
            service_modification_type: 'service-upgrade',
          },
        }),
      ),
    ).toBe('dwelling_single_family_existing');
  });
});
