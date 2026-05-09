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

/** Discipline prefix on every sheet ID — `E-` denotes electrical (standard plan-set convention). */
export const SHEET_ID_PREFIX = 'E-';

/**
 * Allocate the next sheet ID in a band. Caller mutates the counter map in place.
 * Returns a discipline-prefixed string (e.g., 'E-001', 'E-301', 'E-405').
 */
export function nextSheetId(counters: BandCounters, band: SheetBand): string {
  counters[band] += 1;
  return `${SHEET_ID_PREFIX}${String(band + counters[band]).padStart(3, '0')}`;
}

/**
 * Format a sheet ID directly without mutating a counter — useful in tests.
 */
export function formatSheetId(band: SheetBand, slot: number): string {
  return `${SHEET_ID_PREFIX}${String(band + slot).padStart(3, '0')}`;
}
