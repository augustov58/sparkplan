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
 *   2. `findManifestForJurisdiction(jurisdiction)` — fuzzy match by
 *      jurisdiction_name / ahj_name. Returns null if no manifest exists
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
  // `miami-dade` (which is County RER unincorporated-only). Listed after
  // `miami-dade` because the substring lookup in `findManifestForJurisdiction`
  // iterates in insertion order — putting `city-of-miami` later avoids any
  // ambiguity between "City of Miami" jurisdiction strings and the
  // "miami-dade" name needle (in practice the haystacks don't collide; the
  // City of Miami name is "City of Miami" which does NOT contain
  // "miami-dade", so order is documentation-only here).
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

/**
 * Find a manifest by matching a Jurisdiction row's `jurisdiction_name` or
 * `ahj_name` (case-insensitive substring match). Used when the project
 * has a `jurisdiction_id` but the Jurisdictions table doesn't yet carry
 * an explicit `manifest_id` column. Sprint 2C M1 will likely add an
 * explicit FK to clean this up; for PR-4 the substring match is enough
 * to wire Orlando through.
 *
 * Returns null if no manifest matches — caller falls back to Sprint 2A
 * static defaults.
 */
export function findManifestForJurisdiction(
  jurisdiction:
    | { jurisdiction_name?: string | null; ahj_name?: string | null }
    | null
    | undefined,
): AHJManifest | null {
  if (!jurisdiction) return null;
  const haystacks = [
    jurisdiction.jurisdiction_name,
    jurisdiction.ahj_name,
  ]
    .filter((s): s is string => typeof s === 'string' && s.length > 0)
    .map((s) => s.toLowerCase());

  for (const manifest of Object.values(MANIFEST_REGISTRY)) {
    const needle = manifest.name.toLowerCase();
    const idNeedle = manifest.id.toLowerCase();
    for (const hay of haystacks) {
      if (hay.includes(idNeedle) || hay.includes(needle)) {
        return manifest;
      }
    }
  }
  return null;
}

/**
 * All registered manifests — exposed for tests and for the future
 * jurisdiction-selection UI (Sprint 2C will surface a manifest picker
 * separate from the jurisdictions table search).
 */
export const ALL_MANIFESTS: readonly AHJManifest[] = Object.values(
  MANIFEST_REGISTRY,
);
