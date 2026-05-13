/**
 * Sprint 2A H1 + H2 + H3 — packet section configuration + category-banded sheet IDs.
 *
 * The permit packet generator builds a labeled list of pages, optionally
 * filters them through a `PacketSections` config (driven from
 * `projects.settings.section_preferences`), and then walks the filtered
 * list assigning category-banded sheet IDs.
 *
 * Sheet ID convention (no letter prefix; numeric only):
 *   001-099  Cover & front matter   (cover, TOC, revision log, general notes)
 *   100-199  Engineering calculations (load calc, voltage drop, short circuit, arc flash)
 *   200-299  Diagrams & equipment    (riser, equipment schedule/specs, grounding)
 *   300-399  Panel schedules         (one per panel)
 *   400-499  Multi-family scope      (meter stack, MFEV analysis)
 *   500-599  Compliance & AHJ        (compliance summary, jurisdiction)
 *   600-699  Specialty / scope-specific (EVEMS narrative, EVSE labeling — Sprint 2A commits 7-8)
 *
 * Toggling a section off compresses the numbering within its band — no gaps.
 * Sheet ID stability across revisions is a Sprint 3 concern (PE seal workflow
 * will lock the sections config at submittal time).
 */

/** Toggleable sections in the permit packet. Cover is hard-required and not present here. */
export interface PacketSections {
  // Front matter (band 000)
  tableOfContents: boolean;
  generalNotes: boolean;
  revisionLog: boolean;

  // Engineering content
  loadCalculation: boolean;
  nec22087Narrative: boolean;       // Sprint 2A H14 — existing-service NEC 220.87 conditions
  availableFaultCurrent: boolean;   // Sprint 2A H9 — service-main available fault current calc
  voltageDrop: boolean;
  shortCircuit: boolean;
  arcFlash: boolean;

  // Diagrams & equipment
  riserDiagram: boolean;
  equipmentSchedule: boolean;
  equipmentSpecs: boolean;
  grounding: boolean;

  // Panel schedules (toggleable as a group; warn if off)
  panelSchedules: boolean;

  // Multi-family scope (auto-disabled in UI when underlying data absent)
  meterStack: boolean;
  multiFamilyEV: boolean;

  // Compliance & AHJ (compliance summary toggleable but warn)
  complianceSummary: boolean;
  jurisdiction: boolean;

  // Specialty / scope-specific (band 600) — auto-disabled when not applicable
  evemsNarrative: boolean;          // Sprint 2A H10 — NEC 625.42 EVEMS operational narrative
  evseLabeling: boolean;            // Sprint 2A H11 — NEC 625.43 EVSE labeling reference
}

export const DEFAULT_SECTIONS: PacketSections = {
  tableOfContents: true,
  generalNotes: true,
  revisionLog: true,
  loadCalculation: true,
  nec22087Narrative: true,
  availableFaultCurrent: true,
  voltageDrop: true,
  shortCircuit: true,
  arcFlash: true,
  riserDiagram: true,
  equipmentSchedule: true,
  equipmentSpecs: true,
  grounding: true,
  panelSchedules: true,
  meterStack: true,
  multiFamilyEV: true,
  complianceSummary: true,
  jurisdiction: true,
  evemsNarrative: true,
  evseLabeling: true,
};

/** Resolve a partial override against the defaults. */
export function resolveSections(
  override?: Partial<PacketSections>,
): PacketSections {
  return { ...DEFAULT_SECTIONS, ...(override ?? {}) };
}

// ============================================================================
// SHEET ID BANDS
// ============================================================================

/** Numeric base for each category band. Sheet IDs are `band + slot` zero-padded to 3. */
export type SheetBand = 0 | 100 | 200 | 300 | 400 | 500 | 600;

export const BAND_FRONT_MATTER: SheetBand = 0;
export const BAND_CALCULATIONS: SheetBand = 100;
export const BAND_DIAGRAMS: SheetBand = 200;
export const BAND_PANELS: SheetBand = 300;
export const BAND_MULTIFAMILY: SheetBand = 400;
export const BAND_COMPLIANCE: SheetBand = 500;
export const BAND_SPECIALTY: SheetBand = 600;

/** Per-band slot counters used while walking the filtered page list. */
export type BandCounters = Record<SheetBand, number>;

export function newBandCounters(): BandCounters {
  return { 0: 0, 100: 0, 200: 0, 300: 0, 400: 0, 500: 0, 600: 0 };
}

/**
 * Sheet ID discipline prefixes (Sprint 2B PR-1; widened in PR-3 v5; widened
 * again in Sprint 2C M1 for `EL` / `ES` multi-letter electrical disciplines).
 *
 * Sheet IDs carry a discipline prefix in addition to the band-based numbering.
 * Standard plan-set convention:
 *   E    electrical  — SparkPlan-generated sheets (default; existing Sprint 2A behavior)
 *   EL   electrical-lighting — used by some AHJs (e.g., Miami-Dade per Sprint 2C H20)
 *   ES   electrical-systems  — reserved for future AHJ requirements
 *   C    civil       — contractor-supplied site plans, surveys
 *   X    manufacturer — contractor-supplied cut sheets, fire stopping schedules,
 *                      manufacturer installation data
 *   A    architectural — contractor-supplied (v5, via discipline_override)
 *   S    structural    — contractor-supplied (v5)
 *   M    mechanical    — contractor-supplied (v5)
 *   P    plumbing      — contractor-supplied (v5)
 *
 * The discipline prefix is orthogonal to the band — a civil site plan still
 * uses the appropriate numeric band; only the letter changes. The merge engine
 * (PR-3) auto-assigns `C-` / `X-` IDs to uploaded artifacts via their
 * artifact_type while electrical content keeps `E-`. v5 added the
 * `discipline_override` per-upload column so contractors can flip the letter
 * (e.g., a Bluebeam markup landing in the architect's set wants `A-201`
 * rather than the default `C-201`).
 *
 * `EL` / `ES` are SparkPlan-generated-only — they're NOT in
 * `DISCIPLINE_OVERRIDE_OPTIONS` because the contractor-upload path uses
 * the single-letter discipline letters (C/X/A/S/M/P) and would collide
 * with the electrical band counter otherwise.
 */
export type SheetDiscipline =
  | 'E'
  | 'EL'
  | 'ES'
  | 'C'
  | 'X'
  | 'A'
  | 'S'
  | 'M'
  | 'P';

export const SHEET_DISCIPLINE_ELECTRICAL: SheetDiscipline = 'E';
export const SHEET_DISCIPLINE_CIVIL: SheetDiscipline = 'C';
export const SHEET_DISCIPLINE_MANUFACTURER: SheetDiscipline = 'X';
export const SHEET_DISCIPLINE_ARCHITECTURAL: SheetDiscipline = 'A';
export const SHEET_DISCIPLINE_STRUCTURAL: SheetDiscipline = 'S';
export const SHEET_DISCIPLINE_MECHANICAL: SheetDiscipline = 'M';
export const SHEET_DISCIPLINE_PLUMBING: SheetDiscipline = 'P';

/**
 * The discipline letters a contractor may pick as a per-upload override
 * via the `discipline_override` column / AttachmentUploadCard dropdown.
 * Electrical (`E`) is intentionally excluded — that's reserved for
 * SparkPlan-generated sheets and would collide with the auto-allocated
 * band counter for the SparkPlan content.
 */
export const DISCIPLINE_OVERRIDE_OPTIONS: readonly SheetDiscipline[] = [
  'A',
  'C',
  'M',
  'P',
  'S',
  'X',
] as const;

/**
 * Legacy single-prefix export retained for backward compatibility with any
 * pre-Sprint 2B callers. New code should use `formatDisciplinePrefix(...)`
 * or pass a `SheetDiscipline` to `nextSheetId` / `formatSheetId`.
 */
export const SHEET_ID_PREFIX = `${SHEET_DISCIPLINE_ELECTRICAL}-`;

/** Render a discipline as the leading `X-` portion of a sheet ID. */
export function formatDisciplinePrefix(discipline: SheetDiscipline): string {
  return `${discipline}-`;
}

/**
 * Allocate the next sheet ID in a band. Caller mutates the counter map in place.
 * Returns a discipline-prefixed string (e.g., 'E-001', 'C-201', 'X-205').
 *
 * `discipline` defaults to `'E'` (electrical) — every Sprint 2A caller passes
 * just `(counters, band)` and keeps the original behavior. Sprint 2B's merge
 * engine passes `'C'` for site plans / surveys and `'X'` for cut sheets /
 * fire-stopping / manufacturer data.
 */
export function nextSheetId(
  counters: BandCounters,
  band: SheetBand,
  discipline: SheetDiscipline = SHEET_DISCIPLINE_ELECTRICAL,
): string {
  counters[band] += 1;
  return `${formatDisciplinePrefix(discipline)}${String(band + counters[band]).padStart(3, '0')}`;
}

/**
 * Format a sheet ID directly without mutating a counter — useful in tests.
 *
 * `discipline` defaults to `'E'` for backward compatibility with Sprint 2A
 * tests that pre-date the Sprint 2B discipline extension.
 */
export function formatSheetId(
  band: SheetBand,
  slot: number,
  discipline: SheetDiscipline = SHEET_DISCIPLINE_ELECTRICAL,
): string {
  return `${formatDisciplinePrefix(discipline)}${String(band + slot).padStart(3, '0')}`;
}

/**
 * Sprint 2C M1 — derive the SparkPlan-generated discipline letter from an
 * `AHJManifest.sheetIdPrefix` value. The manifest declares a prefix like
 * `'E-'`, `'EL-'`, or `'ES-'`; this strips the trailing `-` and returns
 * the discipline letter ready to pass to `nextSheetId`. Unrecognized
 * prefixes fall back to `'E'` (the Sprint 2A default) so a malformed
 * manifest doesn't break electrical-sheet allocation.
 *
 * NOTE: only consumed by SparkPlan-generated electrical sheet allocation.
 * User-uploaded attachment sheet IDs (C/X/A/S/M/P) are independent — they
 * come from `disciplineOf(artifactType)` in the upload path, not from the
 * manifest's prefix.
 */
export function disciplineFromSheetIdPrefix(
  prefix: string | null | undefined,
): SheetDiscipline {
  if (typeof prefix !== 'string') return SHEET_DISCIPLINE_ELECTRICAL;
  const trimmed = prefix.trim().toUpperCase();
  // Strip the optional trailing dash (manifest declares 'E-' / 'EL-' / 'ES-').
  const letter = trimmed.endsWith('-') ? trimmed.slice(0, -1) : trimmed;
  if (letter === 'E' || letter === 'EL' || letter === 'ES') {
    return letter;
  }
  // Unknown prefix → fall back to electrical default rather than break.
  return SHEET_DISCIPLINE_ELECTRICAL;
}
