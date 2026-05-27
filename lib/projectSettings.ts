/**
 * Shared helpers for reading `Project.settings` consistently across the
 * codebase.
 *
 * Why this exists: `settings.service_modification_type` can legitimately
 * be NULL in the DB (older projects, projects whose picker was never
 * touched). The UI display at ProjectSetup.tsx:286 coerces via
 * `value ?? 'existing'`, but per-component reads diverged into two
 * patterns:
 *
 *   - `value ? value !== 'new-service' : true`  (ternary, null → true)
 *   - `value && value !== 'new-service'`        (&&, null → false — BUG)
 *
 * The `&&` short-circuit pattern silently treats NULL as new-construction,
 * which suppresses EXIST/NEW circuit badges + existing-service form
 * controls + the calculated-method headroom card. PR-2 Step 1
 * (2026-05-26) coerced this away at the packet PDF; PR-2 Step 7
 * (2026-05-27) does the same in-app via this helper so every UI read
 * site agrees with the PDF and with the UI display default.
 */

import type { Project } from '../types';
// Type-only import — `NarrativeOccupancy` is a string union, fully erased at
// build time. No runtime dependency on PermitPacketDocuments.tsx (which would
// otherwise pull in @react-pdf/renderer).
import type { NarrativeOccupancy } from '../services/pdfExport/PermitPacketDocuments';

/** Just the slice of Project this module needs — keeps imports loose. */
type ProjectLike = {
  settings?: { service_modification_type?: 'existing' | 'service-upgrade' | 'new-service' } | null;
};

/**
 * Returns true unless the project is explicitly 'new-service'. NULL /
 * undefined defaults to 'existing' (per the UI's `?? 'existing'`
 * convention), so legacy projects show existing-construction UI
 * affordances by default.
 *
 * Use this for ALL `is this an existing-construction project?` checks
 * in components and hooks. Inlining `?? 'existing'` is fine too — the
 * helper is just a single source of truth so the coercion default
 * doesn't drift across read sites.
 */
export function isExistingConstructionProject(project: ProjectLike | Project): boolean {
  const value = project.settings?.service_modification_type;
  return (value ?? 'existing') !== 'new-service';
}

/**
 * Sprint 3 (2026-05-27): derive the narrative occupancy kind from a Project.
 *
 * Drives the NEC 220 Part III subsections cited on the calculated-method
 * existing-service narrative page. Decision tree:
 *
 *   Commercial project type             → 'commercial'        (220.42 / 220.44 / 220.56)
 *   Industrial project type             → 'industrial'        (220.42 / 220.56)
 *   Residential + multi_family dwelling → 'dwelling_multi_family'        (220.42 / 220.84)
 *   Residential + single_family + existing → 'dwelling_single_family_existing' (220.42 / 220.83)
 *   Residential + single_family + new   → 'dwelling_single_family_new'   (220.42 / 220.82)
 *
 * Defaults:
 *   - Missing `settings.residential.dwellingType` → 'single_family'
 *     (matches the codebase's existing default at PermitPacketGenerator.tsx:657 / :907)
 *   - Missing `settings.service_modification_type` → 'existing'
 *     (via [[isExistingConstructionProject]] above)
 *
 * Pure function. No DB, no hooks, no side effects.
 */
export function deriveNarrativeOccupancy(project: Project): NarrativeOccupancy {
  if (project.type === 'Commercial') return 'commercial';
  if (project.type === 'Industrial') return 'industrial';
  const residential = project.settings?.residential as
    | { dwellingType?: string }
    | undefined;
  const isMultiFamily = (residential?.dwellingType ?? 'single_family') === 'multi_family';
  if (isMultiFamily) return 'dwelling_multi_family';
  return isExistingConstructionProject(project)
    ? 'dwelling_single_family_existing'
    : 'dwelling_single_family_new';
}
