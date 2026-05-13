/**
 * Sprint 2B PR-4 — AHJ manifest type system.
 *
 * Per-AHJ manifests describe what an Authority Having Jurisdiction expects
 * to see in a permit packet:
 *  - which packet sections to show
 *  - which user-uploaded artifact slots to surface
 *  - the AHJ's plan-set conventions (sheet ID prefix, NEC edition, FBC ed.)
 *  - the AHJ's narrative content (general notes, code-reference list)
 *  - (Sprint 2C M1) the engine's requirements list — each with predicates
 *    for `required(ctx)` + `detect(packet, attachments)` evaluation
 *
 * Four architectural axes are baked into `AHJContext` from PR-4 day 1 so
 * Sprint 2C M1 doesn't retrofit them across 5 AHJs:
 *
 * 1. `scope` — Sprint 2A PR-5 service_modification_type (existing/new-service).
 * 2. `lane` — Sprint 2A PR-5 H17 contractor-exemption screening
 *    (`contractor_exemption` vs `pe_required`).
 * 3. `buildingType` — first-class top-level discriminator surfaced by Sprint
 *    2C research. Orthogonal to `lane`. Drives Pompano Fire Review SFR
 *    exclusion (H22), Davie commercial-only Knox/bollard/shutdown block
 *    (H27-H29), Hillsborough residential trade-permit lane (H31).
 * 4. `subjurisdiction` — optional string. Miami-Dade splits 34 munis +
 *    unincorporated; County RER handles only unincorporated. Orlando
 *    doesn't fork on this — but Orlando's manifest must accept the field
 *    (defaults to `undefined`) so MD's manifest doesn't need a different
 *    shape.
 *
 * Two-layer visibility model:
 *  - Layer 1 (manifest defaults): `relevantSections` + `relevantArtifactTypes`
 *    declare what the AHJ wants by default. Optional predicates refine on
 *    `building_type`, `scope`, etc.
 *  - Layer 2 (user overrides): contractor can toggle off any section/slot
 *    the manifest defaulted ON, or toggle on any that defaulted OFF.
 *    Persisted in `projects.settings.section_overrides` (jsonb).
 *
 * @module data/ahj/types
 */

import type { PacketSections } from '../../services/pdfExport/packetSections';
import type { ArtifactType } from '../../hooks/useProjectAttachments';

// ============================================================================
// CORE CONTEXT AXES
// ============================================================================

/**
 * Building-type first-class manifest axis (Sprint 2C research, 2026-05-12).
 * Orthogonal to Sprint 2A H17 `lane` and to `scope`. Drives:
 *  - Pompano Fire Review Application excludes single_family_residential (H22)
 *  - Davie commercial-only Knox-box / bollard / multi-dispenser shutdown
 *    (H27 / H28 / H29)
 *  - Hillsborough residential trade-permit-only lane bypasses plan review
 *    (H31)
 */
export type BuildingType =
  | 'single_family_residential'
  | 'multi_family'
  | 'commercial';

/**
 * Service-modification scope (Sprint 2A PR-5). Orlando's checklist forks on
 * this axis: existing-service path requires NEC 220.87 narrative + revised
 * panel schedule; new-service path requires available fault current calc +
 * grounding detail.
 */
export type ServiceModificationType = 'existing-service' | 'new-service';

/**
 * Contractor-exemption lane (Sprint 2A H17 / PR-5). Drives PE-seal
 * requirement on the cover sheet. M1 engine reads this to filter
 * `manifest.requirements` for PE-only artifacts (e.g., signed-and-sealed
 * structural details).
 */
export type ContractorLane = 'contractor_exemption' | 'pe_required';

/**
 * Per-project AHJ-evaluation context. Built by the renderer from project
 * fields + Sprint 2A's `screenContractorExemption` output, then handed to
 * the manifest's predicates.
 */
export interface AHJContext {
  scope: ServiceModificationType;
  lane: ContractorLane;
  buildingType: BuildingType;
  /**
   * Optional. Miami-Dade requires this to distinguish County RER
   * (unincorporated) from the 34 independent municipalities. Orlando does
   * not fork on this — pass `undefined`.
   */
  subjurisdiction?: string;
}

// ============================================================================
// KEY ALIASES — mirror the existing union types from PacketSections + ArtifactType
// ============================================================================

/**
 * SectionKey mirrors the union of `keyof PacketSections` so manifests can
 * declare relevance + predicates against the same set the generator already
 * consumes. (Cover is not toggleable; it's always-on, so it's intentionally
 * absent from PacketSections — same for the AHJ visibility layer.)
 */
export type SectionKey = keyof PacketSections;

/**
 * ArtifactTypeKey mirrors the ArtifactType union from useProjectAttachments.
 * PR-4 extends the underlying DB CHECK to 14 values; this alias picks up the
 * extension automatically.
 */
export type ArtifactTypeKey = ArtifactType;

// ============================================================================
// PREDICATES
// ============================================================================

/**
 * Section-level predicate. Receives the per-project context; returns true
 * if the section should be relevant for THIS project under THIS AHJ. The
 * manifest's `relevantSections` list is the default — predicates refine
 * conditional cases (e.g., "EVEMS narrative is relevant only when
 * scope === 'new-service'"). Pure function; no side effects.
 */
export type SectionPredicate = (ctx: AHJContext) => boolean;

/**
 * Artifact-type-level predicate. Same shape as SectionPredicate; refines
 * which upload slots the AHJ wants under THIS project's context. E.g.:
 *   `(ctx) => ctx.buildingType === 'commercial'  // Knox-box only commercial`
 *   `(ctx) => ctx.buildingType !== 'single_family_residential' // Pompano Fire`
 */
export type ArtifactTypePredicate = (ctx: AHJContext) => boolean;

// ============================================================================
// REQUIREMENTS (Sprint 2C M1 — manifest schema declared NOW so PR-4 has the
// shape; engine that walks `requirements[]` lands in Sprint 2C M1)
// ============================================================================

/**
 * Minimal pass-through type for the packet AST. PR-4 declares this so the
 * manifest interface is complete; Sprint 2C M1 fleshes out the actual AST
 * shape (probably TocEntry-like; defined in `services/pdfExport/`).
 *
 * Intentionally extensible — extra fields are tolerated by `req.detect`
 * implementations. Manifest authors should treat the AST as read-only.
 */
export interface PacketAST {
  /** Sheet IDs in render order (e.g., ['E-001', 'E-002', 'C-201', ...]). */
  sheetIds?: string[];
  /** TOC entries by section key, for "is this section present?" detection. */
  sectionKeys?: SectionKey[];
  /** Pass-through hook for AST extensions the engine may want to inspect. */
  [key: string]: unknown;
}

/**
 * Minimal pass-through summary of a project's uploaded attachments. The
 * M1 engine consumes this (not the full `ProjectAttachment` row) so it
 * remains pure / decoupled from Supabase types.
 */
export interface AttachmentSummary {
  artifactType: ArtifactTypeKey;
  displayTitle?: string | null;
  /** Sheet ID stamped on the title sheet (or first composite page). */
  sheetId?: string | null;
}

/**
 * One requirement on the AHJ's intake checklist. Sprint 2C M1's engine
 * evaluates each requirement against a packet + its attachments and emits:
 *   - required: did `required(ctx)` say this applies to THIS project?
 *   - present: did `detect(packet, attachments)` find the artifact?
 *   - location: where in the packet (sheet ID) is it satisfied?
 *
 * PR-4 leaves `requirements: []` empty on the Orlando manifest. Sprint 2C
 * M1 populates this for all 5 AHJs.
 */
export interface AHJRequirement {
  /** Stable ID for cross-referencing (e.g., 'orlando-noc-5k'). */
  id: string;
  /** Display name shown on the jurisdiction-checklist page. */
  name: string;
  /** Coarse grouping for the rendered checklist sections. */
  category: 'plan' | 'application' | 'narrative' | 'inspection' | 'upload';
  /**
   * Does this requirement apply to THIS project? Pure predicate over the
   * `AHJContext`. Examples:
   *   - "NOC required for jobs > $5,000" — receives a value, returns boolean
   *   - "PE seal required" — returns `ctx.lane === 'pe_required'`
   */
  required: (ctx: AHJContext) => boolean;
  /**
   * Did the packet (+ its uploads) actually include this artifact? Pure
   * predicate over the AST + attachments. Implementations typically check
   * `attachments.some(a => a.artifactType === '...')` or
   * `packet.sectionKeys?.includes('...')`.
   */
  detect: (packet: PacketAST, attachments: AttachmentSummary[]) => boolean;
  /**
   * Optional: where the requirement is satisfied (sheet ID). Used by the
   * M1 renderer to link "✓ Site plan" → "C-201". Returns null when the
   * requirement is satisfied by something other than a sheet (e.g., a
   * narrative block embedded in another sheet).
   */
  locator?: (packet: PacketAST) => string | null;
}

// ============================================================================
// MANIFEST (the actual interface PR-4 introduces + Sprint 2C M1 extends)
// ============================================================================

/**
 * Allowed sheet-ID discipline prefixes for the AHJ's electrical sheets.
 * Orlando defaults to `E-`. Miami-Dade may require `EL-` (H20 — 5-min
 * phone-call gap from Sprint 2C research). `ES-` reserved for future.
 *
 * NOTE: This is the prefix for SparkPlan-GENERATED electrical sheets.
 * User-uploaded attachments keep their own discipline-letter prefixes
 * (`C-`, `X-`, etc.) per Sprint 2B PR-3 v5; that system is independent.
 */
export type AHJSheetIdPrefix = 'E-' | 'EL-' | 'ES-';

/**
 * A jurisdiction's permit-packet manifest. Captures everything that varies
 * per-AHJ: code-basis references, sheet-ID conventions, narrative content,
 * default section/artifact visibility, and (Sprint 2C M1) the conformance
 * requirements list.
 *
 * Manifests are PURE DATA — no DB calls, no React, no side effects. Loaded
 * by `data/ahj/{id}.ts` files; consumed by the packet generator + (M1) the
 * checklist engine.
 */
export interface AHJManifest {
  /** Stable lowercase identifier (e.g., 'orlando', 'miami-dade'). */
  id: string;

  /** Display name (e.g., 'City of Orlando'). */
  name: string;

  /** Jurisdiction granularity — drives UI labeling + lookup behavior. */
  jurisdictionType: 'city' | 'county';

  /**
   * Optional subjurisdiction name. Miami-Dade County RER handles only
   * `'unincorporated'`; City of Miami, Miami Beach, Coral Gables, Hialeah,
   * etc. are independent AHJs and would get their own manifests. Orlando
   * doesn't fork on this — leave `undefined`.
   */
  subjurisdiction?: string;

  // -------------------------------------------------------------------------
  // Code basis (varies by building type per Sprint 2C H34 finding)
  // -------------------------------------------------------------------------

  /**
   * NEC edition cited per building type. Miami-Dade Residential PRG cites
   * NEC 2014; Commercial PRG cites NEC 2020. The code-basis block renderer
   * (Sprint 2A C7/H4) reads from THIS map (not from a global constant) so
   * the right edition shows on residential vs commercial packets. Manifest
   * authors must provide a value for every BuildingType, even if the AHJ
   * uses the same edition uniformly (Orlando uniformly cites NEC 2020).
   */
  necEdition: Record<BuildingType, string>;

  /**
   * Florida Building Code edition — currently uniform statewide (`'FBC 8th
   * ed (2023)'`) but reserved as per-manifest so it doesn't have to be
   * yanked out of a global constant when the next edition adopts.
   */
  fbcEdition: string;

  // -------------------------------------------------------------------------
  // Plan-set conventions
  // -------------------------------------------------------------------------

  /**
   * Discipline prefix for the AHJ's SparkPlan-generated electrical sheets.
   * Defaults to `'E-'` (Orlando convention). Miami-Dade may require `'EL-'`
   * — research gap from 2026-05-12 (H20). User-uploaded artifacts keep
   * their independent discipline letters (C/X/A/S/M/P) — this prefix only
   * affects generated content.
   */
  sheetIdPrefix: AHJSheetIdPrefix;

  // -------------------------------------------------------------------------
  // Narrative content
  // -------------------------------------------------------------------------

  /**
   * Numbered general-notes list shown on the dedicated General Notes page
   * (Sprint 2A H12 + H13). Override Sprint 2A's static FL-pilot stack here
   * with the AHJ's specific phrasing.
   */
  generalNotes: string[];

  /**
   * Applicable model-code references shown on the cover sheet's
   * "APPLICABLE CODES" section (Sprint 2A H4). E.g.:
   *   ['NFPA-70 (2020 NEC)', 'FBC 8th ed (2023)', 'Orlando City Code Ch. 14']
   */
  codeReferences: string[];

  // -------------------------------------------------------------------------
  // AHJ-aware visibility (two-layer model: manifest defaults + user overrides)
  // -------------------------------------------------------------------------

  /**
   * Sections the AHJ wants by default. Visibility is the intersection of:
   *   - presence in this array (default ON)
   *   - the section's optional predicate evaluated against AHJContext
   *   - the user's per-project override (Layer 2)
   *
   * Sections NOT in this array default OFF but can still be turned on by
   * the user (Layer 2 override). The renderer uses
   * `computeDefaultVisibility(manifest, ctx)` to resolve.
   */
  relevantSections: SectionKey[];

  /**
   * Artifact upload slots the AHJ wants by default. Same intersection
   * semantics as `relevantSections`.
   */
  relevantArtifactTypes: ArtifactTypeKey[];

  /**
   * Optional predicates that further refine section relevance based on
   * AHJContext. Keys not present here fall through to the
   * `relevantSections` array (default ON if listed). Example:
   *   `{ nec22087Narrative: ctx => ctx.scope === 'existing-service' }`
   * means the NEC 220.87 page is only relevant on existing-service jobs.
   */
  sectionPredicates?: Partial<Record<SectionKey, SectionPredicate>>;

  /**
   * Optional predicates that further refine artifact-type relevance.
   * Example:
   *   `{ noc: ctx => ctx.buildingType !== 'single_family_residential' }`
   * means NOC slot is only relevant for non-SFR projects under this AHJ.
   */
  artifactTypePredicates?: Partial<
    Record<ArtifactTypeKey, ArtifactTypePredicate>
  >;

  // -------------------------------------------------------------------------
  // Requirements list (Sprint 2C M1 engine consumes this — PR-4 ships empty)
  // -------------------------------------------------------------------------

  /**
   * Per-AHJ conformance requirements. PR-4 leaves this empty `[]` on the
   * Orlando manifest; Sprint 2C M1 populates Orlando line-by-line + adds
   * Pompano → Miami-Dade → Davie → Hillsborough manifests.
   */
  requirements: AHJRequirement[];
}
