/**
 * Sprint 2B PR-4 + Sprint 2C M1 — AHJ manifest registry.
 *
 * Lookup table mapping jurisdiction identifiers/names to their canonical
 * `AHJManifest`. The registry exists so the UI layer (and Sprint 2C M1's
 * checklist engine) can look up an active manifest without hard-coding
 * imports across multiple call sites.
 *
 * Sprint 2C M1 adds Pompano, Miami-Dade, Davie, Hillsborough/Tampa
 * (PR-4 shipped Orlando alone).
 *
 * Lookup strategy:
 *   1. `getManifestById('orlando')` — direct ID lookup (canonical).
 *   2. `findManifestForJurisdiction(jurisdiction)` — match a jurisdictions
 *      row by its city / ahj_name against each manifest's `coverage`
 *      (name-only input: most specific name). Returns null if no manifest exists
 *      for that jurisdiction; the renderer falls back to Sprint 2A
 *      static defaults.
 *
 * @module data/ahj/registry
 */

import type { AHJManifest } from './types';
import { orlandoManifest } from './orlando';
import { pompanoManifest } from './pompano';
import { miamiDadeManifest } from './miami-dade';
import { davieManifest } from './davie';
import { hillsboroughTampaManifest } from './hillsborough-tampa';
import { cityOfMiamiManifest } from './city-of-miami';
import { orangeCountyManifest } from './orange-county';
import { stPetersburgManifest } from './st-petersburg';
import { jacksonvilleDuvalManifest } from './jacksonville-duval';

// ============================================================================
// REGISTRY
// ============================================================================

/**
 * Canonical manifests keyed by `AHJManifest.id`. Order mirrors Sprint 2C M1
 * build order: Pompano → Miami-Dade → Davie → Hillsborough/Tampa.
 */
const MANIFEST_REGISTRY: Readonly<Record<string, AHJManifest>> = {
  orlando: orlandoManifest,
  pompano: pompanoManifest,
  'miami-dade': miamiDadeManifest,
  davie: davieManifest,
  'hillsborough-tampa': hillsboroughTampaManifest,
  // Independent municipality inside Miami-Dade County. Distinct from
  // `miami-dade` (which is County RER unincorporated-only); the two are
  // told apart by `coverage`, not by registry order.
  'city-of-miami': cityOfMiamiManifest,
  // Orange County Division of Building Safety — unincorporated areas only
  // (NOT City of Orlando, which is independent and registered above).
  // Closes the Orlando-metro gap from Sprint 2C M2.
  'orange-county': orangeCountyManifest,
  // City of St. Petersburg (Pinellas County). Distinct from
  // `hillsborough-tampa` (which is Hillsborough County only). Closes the
  // Tampa Bay metro gap.
  'st-petersburg': stPetersburgManifest,
  // Consolidated City of Jacksonville / Duval County (merged 1968 — one
  // government, one AHJ). Largest FL city not previously covered. The
  // four retained "Beaches" munis (Jax Beach / Atlantic Beach / Neptune
  // Beach / Baldwin) are independent AHJs and would need separate
  // manifests for future coverage.
  'jacksonville-duval': jacksonvilleDuvalManifest,
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Direct lookup by manifest ID (e.g., `'orlando'`). Returns null if no
 * manifest is registered under that ID — callers must fall back to
 * Sprint 2A static defaults to preserve backward compat for projects
 * without manifest data.
 */
export function getManifestById(id: string | null | undefined): AHJManifest | null {
  if (!id) return null;
  return MANIFEST_REGISTRY[id.toLowerCase()] ?? null;
}

/** Lowercase, no periods, "saint" → "st", single spaces. */
function normalizePlace(s: string): string {
  return s.toLowerCase().replace(/\./g, '').replace(/\bsaint\b/g, 'st').replace(/\s+/g, ' ').trim();
}

const MUNICIPAL_AUTHORITY = /\b(city|town|village) of\b/;

/**
 * Find the manifest for a `jurisdictions` row (#135).
 *
 * A row with a `city` is matched on what it says, never on substrings of its
 * display name ("Miami, Miami-Dade County, FL" contains "miami-dade" but is
 * the City of Miami):
 *   1. `ahj_name` names a county ("Orange County Division of Building
 *      Safety") and no city/town/village → the manifest covering that county.
 *   2. Otherwise the manifest whose `coverage.cities` lists the row's city.
 *   3. Otherwise null — an unmodeled city inside a modeled county is its own
 *      AHJ and must not inherit the county's manifest.
 * The row's `state` must match `coverage.state` when present.
 *
 * Name-only input (no `city`) falls back to the most specific manifest
 * name or id found in `jurisdiction_name` / `ahj_name`.
 *
 * Returns null if no manifest matches — caller falls back to Sprint 2A
 * static defaults.
 */
export function findManifestForJurisdiction(
  jurisdiction:
    | {
        jurisdiction_name?: string | null;
        ahj_name?: string | null;
        city?: string | null;
        county?: string | null;
        state?: string | null;
      }
    | null
    | undefined,
): AHJManifest | null {
  if (!jurisdiction) return null;
  const manifests = Object.values(MANIFEST_REGISTRY);

  if (jurisdiction.city) {
    const state = jurisdiction.state?.trim().toUpperCase();
    const inState = manifests.filter(
      (m) => m.coverage && (!state || m.coverage.state === state),
    );
    const ahj = normalizePlace(jurisdiction.ahj_name ?? '');
    if (ahj && !MUNICIPAL_AUTHORITY.test(ahj)) {
      const byCounty = inState.find(
        (m) => m.coverage?.county && ahj.includes(`${normalizePlace(m.coverage.county)} county`),
      );
      if (byCounty) return byCounty;
    }
    const city = normalizePlace(jurisdiction.city);
    return inState.find((m) => m.coverage?.cities?.some((c) => normalizePlace(c) === city)) ?? null;
  }

  const haystacks = [jurisdiction.jurisdiction_name, jurisdiction.ahj_name]
    .filter((s): s is string => typeof s === 'string' && s.length > 0)
    .map((s) => s.toLowerCase());
  let best: AHJManifest | null = null;
  let bestLength = 0;
  for (const manifest of manifests) {
    for (const needle of [manifest.name.toLowerCase(), manifest.id.toLowerCase()]) {
      if (needle.length > bestLength && haystacks.some((hay) => hay.includes(needle))) {
        best = manifest;
        bestLength = needle.length;
      }
    }
  }
  return best;
}

/**
 * All registered manifests — exposed for tests and for the future
 * jurisdiction-selection UI (Sprint 2C will surface a manifest picker
 * separate from the jurisdictions table search).
 */
export const ALL_MANIFESTS: readonly AHJManifest[] = Object.values(
  MANIFEST_REGISTRY,
);
