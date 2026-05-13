/**
 * Sprint 2B PR-4 — AHJ-aware visibility computation.
 *
 * Pure-function module (no DB, no React, no side effects) implementing the
 * two-layer visibility model:
 *
 *   Layer 1 — Manifest defaults: each AHJ manifest declares which sections
 *             and artifact_types it wants by default
 *             (`relevantSections` / `relevantArtifactTypes`), with optional
 *             predicates that refine on AHJContext (building_type, scope,
 *             lane, subjurisdiction).
 *
 *   Layer 2 — User overrides: contractor can toggle off any section/slot
 *             the manifest defaulted ON, or toggle on any that defaulted
 *             OFF. Persisted in `projects.settings.section_overrides` (jsonb).
 *
 * Functions never throw (per CLAUDE.md calculation-service contract).
 *
 * @module data/ahj/visibility
 */

import type { PacketSections } from '../../services/pdfExport/packetSections';
import type { ArtifactType } from '../../hooks/useProjectAttachments';
import type {
  AHJManifest,
  AHJContext,
  SectionKey,
  ArtifactTypeKey,
} from './types';

// ============================================================================
// PUBLIC TYPES
// ============================================================================

/**
 * Resolved visibility state for a single packet build. Booleans are the
 * effective on/off — caller does NOT need to consult the manifest +
 * overrides again, just read this map.
 *
 * `sections` covers every key in `PacketSections` (full record); missing
 * keys are explicitly `false` rather than undefined so downstream code
 * can pass the same shape to `resolveSections` / the renderer.
 *
 * `artifactTypes` likewise covers every value in the ArtifactType union.
 */
export interface VisibilityState {
  sections: Record<SectionKey, boolean>;
  artifactTypes: Record<ArtifactTypeKey, boolean>;
}

/**
 * User-supplied per-project overrides (Layer 2). Both maps are sparse:
 * keys that aren't present fall through to the manifest's Layer 1
 * default. Persisted in `projects.settings.section_overrides`.
 */
export interface VisibilityOverrides {
  sections?: Partial<Record<SectionKey, boolean>>;
  artifactTypes?: Partial<Record<ArtifactTypeKey, boolean>>;
}

// ============================================================================
// KEY ENUMERATIONS — kept local so the visibility module doesn't depend on
// the runtime DEFAULT_SECTIONS / ARTIFACT_TYPES (single source of truth is
// the type union; mirror it here for deterministic key iteration).
// ============================================================================

/**
 * Every key in `PacketSections`. Mirrors the interface — duplicated here
 * because TypeScript can't iterate `keyof T` at runtime.
 *
 * If you add a section to `PacketSections`, add it here too. Build will
 * still pass thanks to the `Record<SectionKey, ...>` constraint, but the
 * new section won't appear in `VisibilityState.sections` until it's
 * listed here.
 */
export const ALL_SECTION_KEYS: readonly SectionKey[] = [
  'tableOfContents',
  'generalNotes',
  'revisionLog',
  'loadCalculation',
  'nec22087Narrative',
  'availableFaultCurrent',
  'voltageDrop',
  'shortCircuit',
  'arcFlash',
  'riserDiagram',
  'equipmentSchedule',
  'equipmentSpecs',
  'grounding',
  'panelSchedules',
  'meterStack',
  'multiFamilyEV',
  'complianceSummary',
  'jurisdiction',
  'evemsNarrative',
  'evseLabeling',
] as const;

/**
 * Every value in the `ArtifactType` union. Mirrors `ARTIFACT_TYPES` from
 * `useProjectAttachments` — duplicated here so this module stays a pure
 * data-layer dependency without pulling in the React hook.
 */
export const ALL_ARTIFACT_TYPE_KEYS: readonly ArtifactTypeKey[] = [
  // PR-1 originals
  'site_plan',
  'cut_sheet',
  'fire_stopping',
  'noc',
  'hoa_letter',
  'survey',
  'manufacturer_data',
  // PR-3 H19
  'hvhz_anchoring',
  // PR-4 Sprint 2C AHJ manifests
  'zoning_application',
  'fire_review_application',
  'notarized_addendum',
  'property_ownership_search',
  'flood_elevation_certificate',
  'private_provider_documentation',
] as const;

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Compute Layer 1 defaults for a given manifest + project context. Walks
 * every section key and every artifact-type key, marking ON when:
 *
 *   1. The key is in `manifest.relevantSections` /
 *      `manifest.relevantArtifactTypes`, AND
 *   2. Either there's no predicate for that key, OR the predicate
 *      returns true for `ctx`.
 *
 * Keys absent from the manifest's relevance arrays default OFF — even if
 * a predicate exists (predicate only refines a relevance declaration, it
 * doesn't grant relevance on its own).
 *
 * Pure function. Never throws. Caller can layer user overrides on top
 * via {@link applyUserOverrides}.
 */
export function computeDefaultVisibility(
  manifest: AHJManifest,
  ctx: AHJContext,
): VisibilityState {
  const relevantSectionSet = new Set<SectionKey>(manifest.relevantSections);
  const relevantArtifactSet = new Set<ArtifactTypeKey>(
    manifest.relevantArtifactTypes,
  );

  const sections = {} as Record<SectionKey, boolean>;
  for (const key of ALL_SECTION_KEYS) {
    if (!relevantSectionSet.has(key)) {
      sections[key] = false;
      continue;
    }
    const predicate = manifest.sectionPredicates?.[key];
    if (predicate) {
      // Predicates are user-supplied data; guard against accidental throws
      // so a malformed manifest doesn't take down packet generation.
      try {
        sections[key] = predicate(ctx) === true;
      } catch {
        // Conservative fallback: relevance was declared, predicate
        // failed — treat as ON so the renderer doesn't silently drop a
        // section the AHJ wanted.
        sections[key] = true;
      }
    } else {
      sections[key] = true;
    }
  }

  const artifactTypes = {} as Record<ArtifactTypeKey, boolean>;
  for (const key of ALL_ARTIFACT_TYPE_KEYS) {
    if (!relevantArtifactSet.has(key)) {
      artifactTypes[key] = false;
      continue;
    }
    const predicate = manifest.artifactTypePredicates?.[key];
    if (predicate) {
      try {
        artifactTypes[key] = predicate(ctx) === true;
      } catch {
        artifactTypes[key] = true;
      }
    } else {
      artifactTypes[key] = true;
    }
  }

  return { sections, artifactTypes };
}

/**
 * Apply user overrides (Layer 2) on top of computed defaults. User
 * preferences ALWAYS win — including the case where the manifest had a
 * section ON and the user wants it OFF (and vice versa).
 *
 * Pure function. Returns a NEW VisibilityState (doesn't mutate defaults).
 */
export function applyUserOverrides(
  defaults: VisibilityState,
  overrides: VisibilityOverrides | undefined | null,
): VisibilityState {
  if (!overrides) {
    return {
      sections: { ...defaults.sections },
      artifactTypes: { ...defaults.artifactTypes },
    };
  }

  const sections = { ...defaults.sections };
  if (overrides.sections) {
    for (const key of ALL_SECTION_KEYS) {
      const override = overrides.sections[key];
      if (typeof override === 'boolean') {
        sections[key] = override;
      }
    }
  }

  const artifactTypes = { ...defaults.artifactTypes };
  if (overrides.artifactTypes) {
    for (const key of ALL_ARTIFACT_TYPE_KEYS) {
      const override = overrides.artifactTypes[key];
      if (typeof override === 'boolean') {
        artifactTypes[key] = override;
      }
    }
  }

  return { sections, artifactTypes };
}

/**
 * Convenience: project a {@link VisibilityState} down to the
 * `Partial<PacketSections>` shape the existing Sprint 2A packet generator
 * already consumes (via `resolveSections` / `data.sections`). Keys that
 * map to `false` are emitted as `false`; keys that map to `true` are
 * omitted (so `resolveSections` falls back to its `DEFAULT_SECTIONS`
 * all-on baseline, which matches Sprint 2A behavior).
 *
 * This is the bridge that lets the AHJ visibility layer talk to the
 * Sprint 2A generator without changing the generator's public API.
 */
export function toPacketSectionsPartial(
  state: VisibilityState,
): Partial<PacketSections> {
  const out: Partial<PacketSections> = {};
  for (const key of ALL_SECTION_KEYS) {
    if (state.sections[key] === false) {
      out[key] = false;
    }
  }
  return out;
}
