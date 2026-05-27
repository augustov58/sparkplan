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
import { isExistingConstructionProject } from '../lib/projectSettings';

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
