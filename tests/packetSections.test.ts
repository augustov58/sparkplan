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
  DEFAULT_SECTIONS,
  BAND_FRONT_MATTER,
  BAND_CALCULATIONS,
  BAND_DIAGRAMS,
  BAND_PANELS,
  BAND_MULTIFAMILY,
  BAND_COMPLIANCE,
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
  it('zero-pads to 3 digits', () => {
    expect(formatSheetId(BAND_FRONT_MATTER, 1)).toBe('001');
    expect(formatSheetId(BAND_CALCULATIONS, 1)).toBe('101');
    expect(formatSheetId(BAND_PANELS, 5)).toBe('305');
  });

  it('handles each band correctly', () => {
    expect(formatSheetId(BAND_FRONT_MATTER, 4)).toBe('004');
    expect(formatSheetId(BAND_DIAGRAMS, 1)).toBe('201');
    expect(formatSheetId(BAND_MULTIFAMILY, 3)).toBe('403');
    expect(formatSheetId(BAND_COMPLIANCE, 2)).toBe('502');
  });
});

describe('nextSheetId + newBandCounters', () => {
  it('increments within a band independently of other bands', () => {
    const counters = newBandCounters();

    expect(nextSheetId(counters, BAND_FRONT_MATTER)).toBe('001');
    expect(nextSheetId(counters, BAND_FRONT_MATTER)).toBe('002');
    expect(nextSheetId(counters, BAND_FRONT_MATTER)).toBe('003');

    // Switching to a different band starts that band's counter at its base
    expect(nextSheetId(counters, BAND_PANELS)).toBe('301');
    expect(nextSheetId(counters, BAND_PANELS)).toBe('302');

    // Front matter counter is unaffected by panels band
    expect(nextSheetId(counters, BAND_FRONT_MATTER)).toBe('004');
  });

  it('full FL multifamily packet sheet ID layout matches expectations', () => {
    // Walks the same allocation sequence the generator does for a full
    // multi-family packet with every section enabled.
    const counters = newBandCounters();

    // Front matter: cover, TOC, revision log, general notes
    expect(nextSheetId(counters, BAND_FRONT_MATTER)).toBe('001'); // cover
    expect(nextSheetId(counters, BAND_FRONT_MATTER)).toBe('002'); // TOC
    expect(nextSheetId(counters, BAND_FRONT_MATTER)).toBe('003'); // revision log
    expect(nextSheetId(counters, BAND_FRONT_MATTER)).toBe('004'); // general notes

    // Calculations: load calc, voltage drop, short circuit, arc flash
    expect(nextSheetId(counters, BAND_CALCULATIONS)).toBe('101'); // load calc
    expect(nextSheetId(counters, BAND_CALCULATIONS)).toBe('102'); // voltage drop
    expect(nextSheetId(counters, BAND_CALCULATIONS)).toBe('103'); // short circuit
    expect(nextSheetId(counters, BAND_CALCULATIONS)).toBe('104'); // arc flash

    // Diagrams: riser, equip schedule, equip specs, grounding
    expect(nextSheetId(counters, BAND_DIAGRAMS)).toBe('201');
    expect(nextSheetId(counters, BAND_DIAGRAMS)).toBe('202');
    expect(nextSheetId(counters, BAND_DIAGRAMS)).toBe('203');
    expect(nextSheetId(counters, BAND_DIAGRAMS)).toBe('204');

    // Multi-family: meter stack (1), MFEV pages 1-3
    expect(nextSheetId(counters, BAND_MULTIFAMILY)).toBe('401');
    expect(nextSheetId(counters, BAND_MULTIFAMILY)).toBe('402');
    expect(nextSheetId(counters, BAND_MULTIFAMILY)).toBe('403');
    expect(nextSheetId(counters, BAND_MULTIFAMILY)).toBe('404');

    // Compliance: compliance summary, jurisdiction
    expect(nextSheetId(counters, BAND_COMPLIANCE)).toBe('501');
    expect(nextSheetId(counters, BAND_COMPLIANCE)).toBe('502');

    // Panels: MDP + 12 unit panels + EV sub-panel = 14 entries
    for (let i = 1; i <= 14; i++) {
      expect(nextSheetId(counters, BAND_PANELS)).toBe(String(300 + i).padStart(3, '0'));
    }
  });

  it('toggling sections off compresses numbering within a band', () => {
    // When TOC is toggled off, revision log moves from 003 → 002 and
    // general notes moves from 004 → 003 (no gaps within the band).
    const counters = newBandCounters();

    expect(nextSheetId(counters, BAND_FRONT_MATTER)).toBe('001'); // cover
    // TOC skipped (sections.tableOfContents = false)
    expect(nextSheetId(counters, BAND_FRONT_MATTER)).toBe('002'); // revision log (was 003)
    expect(nextSheetId(counters, BAND_FRONT_MATTER)).toBe('003'); // general notes (was 004)
  });
});
