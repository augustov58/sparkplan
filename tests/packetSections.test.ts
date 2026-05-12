/**
 * Sprint 2A H1 + H2 + H3 — packet section configuration + sheet ID utilities.
 *
 * Pure-function tests for the band-counter / section-resolver infrastructure
 * that drives the generator's page-list assembly. PDF rendering of TOC and
 * Revision Log is exercised in tests/tocRevisionLogPdf.test.ts.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveSections,
  newBandCounters,
  nextSheetId,
  formatSheetId,
  formatDisciplinePrefix,
  DEFAULT_SECTIONS,
  BAND_FRONT_MATTER,
  BAND_CALCULATIONS,
  BAND_DIAGRAMS,
  BAND_PANELS,
  BAND_MULTIFAMILY,
  BAND_COMPLIANCE,
  SHEET_DISCIPLINE_CIVIL,
  SHEET_DISCIPLINE_MANUFACTURER,
  SHEET_DISCIPLINE_ELECTRICAL,
} from '../services/pdfExport/packetSections';

describe('resolveSections', () => {
  it('returns DEFAULT_SECTIONS when override is undefined', () => {
    expect(resolveSections()).toEqual(DEFAULT_SECTIONS);
  });

  it('merges partial override with defaults', () => {
    const result = resolveSections({ generalNotes: false, tableOfContents: false });
    expect(result.generalNotes).toBe(false);
    expect(result.tableOfContents).toBe(false);
    expect(result.equipmentSchedule).toBe(true); // default preserved
    expect(result.complianceSummary).toBe(true);
  });
});

describe('formatSheetId', () => {
  it('prefixes with E- and zero-pads to 3 digits', () => {
    expect(formatSheetId(BAND_FRONT_MATTER, 1)).toBe('E-001');
    expect(formatSheetId(BAND_CALCULATIONS, 1)).toBe('E-101');
    expect(formatSheetId(BAND_PANELS, 5)).toBe('E-305');
  });

  it('handles each band correctly', () => {
    expect(formatSheetId(BAND_FRONT_MATTER, 4)).toBe('E-004');
    expect(formatSheetId(BAND_DIAGRAMS, 1)).toBe('E-201');
    expect(formatSheetId(BAND_MULTIFAMILY, 3)).toBe('E-403');
    expect(formatSheetId(BAND_COMPLIANCE, 2)).toBe('E-502');
  });
});

describe('nextSheetId + newBandCounters', () => {
  it('increments within a band independently of other bands', () => {
    const counters = newBandCounters();

    expect(nextSheetId(counters, BAND_FRONT_MATTER)).toBe('E-001');
    expect(nextSheetId(counters, BAND_FRONT_MATTER)).toBe('E-002');
    expect(nextSheetId(counters, BAND_FRONT_MATTER)).toBe('E-003');

    // Switching to a different band starts that band's counter at its base
    expect(nextSheetId(counters, BAND_PANELS)).toBe('E-301');
    expect(nextSheetId(counters, BAND_PANELS)).toBe('E-302');

    // Front matter counter is unaffected by panels band
    expect(nextSheetId(counters, BAND_FRONT_MATTER)).toBe('E-004');
  });

  it('full FL multifamily packet sheet ID layout matches expectations', () => {
    // Walks the same allocation sequence the generator does for a full
    // multi-family packet with every section enabled.
    const counters = newBandCounters();

    // Front matter: cover, TOC, revision log, general notes
    expect(nextSheetId(counters, BAND_FRONT_MATTER)).toBe('E-001'); // cover
    expect(nextSheetId(counters, BAND_FRONT_MATTER)).toBe('E-002'); // TOC
    expect(nextSheetId(counters, BAND_FRONT_MATTER)).toBe('E-003'); // revision log
    expect(nextSheetId(counters, BAND_FRONT_MATTER)).toBe('E-004'); // general notes

    // Calculations: load calc, voltage drop, short circuit, arc flash
    expect(nextSheetId(counters, BAND_CALCULATIONS)).toBe('E-101'); // load calc
    expect(nextSheetId(counters, BAND_CALCULATIONS)).toBe('E-102'); // voltage drop
    expect(nextSheetId(counters, BAND_CALCULATIONS)).toBe('E-103'); // short circuit
    expect(nextSheetId(counters, BAND_CALCULATIONS)).toBe('E-104'); // arc flash

    // Diagrams: riser, equip schedule, equip specs, grounding
    expect(nextSheetId(counters, BAND_DIAGRAMS)).toBe('E-201');
    expect(nextSheetId(counters, BAND_DIAGRAMS)).toBe('E-202');
    expect(nextSheetId(counters, BAND_DIAGRAMS)).toBe('E-203');
    expect(nextSheetId(counters, BAND_DIAGRAMS)).toBe('E-204');

    // Multi-family: meter stack (1), MFEV pages 1-3
    expect(nextSheetId(counters, BAND_MULTIFAMILY)).toBe('E-401');
    expect(nextSheetId(counters, BAND_MULTIFAMILY)).toBe('E-402');
    expect(nextSheetId(counters, BAND_MULTIFAMILY)).toBe('E-403');
    expect(nextSheetId(counters, BAND_MULTIFAMILY)).toBe('E-404');

    // Compliance: compliance summary, jurisdiction
    expect(nextSheetId(counters, BAND_COMPLIANCE)).toBe('E-501');
    expect(nextSheetId(counters, BAND_COMPLIANCE)).toBe('E-502');

    // Panels: MDP + 12 unit panels + EV sub-panel = 14 entries
    for (let i = 1; i <= 14; i++) {
      expect(nextSheetId(counters, BAND_PANELS)).toBe(`E-${String(300 + i).padStart(3, '0')}`);
    }
  });

  it('toggling sections off compresses numbering within a band', () => {
    // When TOC is toggled off, revision log moves from E-003 → E-002 and
    // general notes moves from E-004 → E-003 (no gaps within the band).
    const counters = newBandCounters();

    expect(nextSheetId(counters, BAND_FRONT_MATTER)).toBe('E-001'); // cover
    // TOC skipped (sections.tableOfContents = false)
    expect(nextSheetId(counters, BAND_FRONT_MATTER)).toBe('E-002'); // revision log (was E-003)
    expect(nextSheetId(counters, BAND_FRONT_MATTER)).toBe('E-003'); // general notes (was E-004)
  });
});

// Sprint 2B PR-1 — discipline prefix support for uploaded-artifact sheets.
describe('sheet ID discipline prefixes (Sprint 2B)', () => {
  it('formatDisciplinePrefix renders each discipline as letter + dash', () => {
    expect(formatDisciplinePrefix(SHEET_DISCIPLINE_ELECTRICAL)).toBe('E-');
    expect(formatDisciplinePrefix(SHEET_DISCIPLINE_CIVIL)).toBe('C-');
    expect(formatDisciplinePrefix(SHEET_DISCIPLINE_MANUFACTURER)).toBe('X-');
  });

  it('formatSheetId defaults to E- when discipline omitted (Sprint 2A compat)', () => {
    expect(formatSheetId(BAND_DIAGRAMS, 1)).toBe('E-201');
  });

  it('formatSheetId honors civil + manufacturer disciplines, keeping the band scheme', () => {
    // C- and X- sheets reuse the existing band numbers — the discipline prefix
    // is orthogonal to the band. A civil site plan in the diagrams band still
    // gets a 2xx number, just with a C- prefix.
    expect(formatSheetId(BAND_DIAGRAMS, 1, SHEET_DISCIPLINE_CIVIL)).toBe('C-201');
    expect(formatSheetId(BAND_DIAGRAMS, 5, SHEET_DISCIPLINE_MANUFACTURER)).toBe('X-205');
    expect(formatSheetId(BAND_FRONT_MATTER, 2, SHEET_DISCIPLINE_CIVIL)).toBe('C-002');
  });

  it('nextSheetId defaults to E- when discipline omitted (Sprint 2A compat)', () => {
    const counters = newBandCounters();
    expect(nextSheetId(counters, BAND_FRONT_MATTER)).toBe('E-001');
    expect(nextSheetId(counters, BAND_FRONT_MATTER)).toBe('E-002');
  });

  it('nextSheetId emits C- and X- IDs when an explicit discipline is passed', () => {
    const counters = newBandCounters();

    // Allocate one electrical diagram, then a civil site plan + a manufacturer
    // cut sheet from the same diagrams band. All three share the band counter,
    // so the numeric slot advances regardless of discipline.
    expect(nextSheetId(counters, BAND_DIAGRAMS, SHEET_DISCIPLINE_ELECTRICAL)).toBe('E-201');
    expect(nextSheetId(counters, BAND_DIAGRAMS, SHEET_DISCIPLINE_CIVIL)).toBe('C-202');
    expect(nextSheetId(counters, BAND_DIAGRAMS, SHEET_DISCIPLINE_MANUFACTURER)).toBe('X-203');
    expect(nextSheetId(counters, BAND_DIAGRAMS, SHEET_DISCIPLINE_ELECTRICAL)).toBe('E-204');
  });
});
