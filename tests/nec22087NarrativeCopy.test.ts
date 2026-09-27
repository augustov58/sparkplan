/**
 * `getNEC22087NarrativeCopy(method, occupancy, calculationNecReferences)` —
 * the `calculated`-method label / NEC reference / verdict body.
 *
 * Sprint 3 (2026-05-27) fanned citations by occupancy so commercial /
 * industrial packets stopped citing dwelling tables. PE ruling 2026-09-27:
 * the dwelling Optional Methods (220.82 / 220.83 / 220.84) are NEC 220
 * Part IV, and the page cites the sections the calculation actually applied
 * (its runtime `necReferences`), falling back to occupancy only when those
 * aren't supplied. The narrative's calculated source runs 220.84 for
 * multifamily but never 220.82 / 220.83, so single-family must stay Part III.
 *
 * Each case pins what the AHJ reviewer sees on the stamped page.
 */
import { describe, it, expect } from 'vitest';
import {
  getNEC22087NarrativeCopy,
  summarizeCalculationRefs,
} from '../services/pdfExport/PermitPacketDocuments';

// Literal strings emitted by calculateAggregatedLoad (upstreamLoadAggregation.ts).
const MF_OPTIONAL_REFS = [
  'NEC 220.84 (Optional Calculation — Multifamily Dwelling)',
  'NEC 220.60 (Non-Coincident Loads)',
  'NEC 220.84(C)(4) (Electric Space Heating @ 65%)',
  'NEC 625.42 (EVEMS Load)',
];
const STANDARD_DWELLING_REFS = [
  'NEC 220.40 (Feeder Load Calculation)',
  'NEC Table 220.42',
  'NEC Table 220.55 Col C (1 ranges → 8kW)',
  'NEC 430.24 (Largest 112.5kVA @125%, 2 others @100%)',
];

describe('summarizeCalculationRefs', () => {
  it('classifies a 220.84 run as Part IV and collapses 220.84(C)(4) into 220.84', () => {
    expect(summarizeCalculationRefs(MF_OPTIONAL_REFS)).toEqual({
      part: 'IV',
      optionalSection: '220.84',
      sections: ['220.60', '220.84', '625.42'],
    });
  });

  it('classifies the standard cascade as Part III and ignores kVA values that look like sections', () => {
    expect(summarizeCalculationRefs(STANDARD_DWELLING_REFS)).toEqual({
      part: 'III',
      sections: ['220.40', '220.42', '220.55', '430.24'],
    });
  });

  it('keeps a subsection when its parent is not cited', () => {
    expect(summarizeCalculationRefs(['NEC 220.14(G)', 'NEC 220.14(F)']).sections)
      .toEqual(['220.14(F)', '220.14(G)']);
  });
});

describe('getNEC22087NarrativeCopy — calculated method, runtime references (PE 2026-09-27)', () => {
  it('cites Part IV Optional Method (NEC 220.84) when the 220.84 path ran', () => {
    const copy = getNEC22087NarrativeCopy('calculated', 'dwelling_multi_family', MF_OPTIONAL_REFS);
    expect(copy.pageSubtitleSuffix).toContain('NEC 220 Part IV Optional Method');
    expect(copy.condition1Header).toContain('NEC 220 Part IV Optional Method (NEC 220.84)');
    expect(copy.verdictAdequateBanner).toBe('EXISTING SERVICE ADEQUATE (PER NEC 220 PART IV CALCULATION)');
    expect(copy.methodNecRef).toContain('220.60 / 220.84 / 625.42');
    expect(copy.calculationBasis).toBe('NEC 220 Part IV Optional Method (NEC 220.84)');
    for (const field of [copy.pageSubtitleSuffix, copy.condition1Header, copy.methodNecRef, copy.verdictAdequateBody]) {
      expect(field).not.toContain('Part III');
    }
  });

  it('cites Part III with the runtime sections when a dwelling ran the standard cascade', () => {
    // Single-family, or multifamily without a 220.84 context: occupancy says
    // dwelling, but no Optional Method ran — the page must not claim one.
    for (const occupancy of ['dwelling_single_family_existing', 'dwelling_single_family_new', 'dwelling_multi_family'] as const) {
      const copy = getNEC22087NarrativeCopy('calculated', occupancy, STANDARD_DWELLING_REFS);
      expect(copy.verdictAdequateBanner).toContain('PART III');
      expect(copy.methodNecRef).toContain('220.40 / 220.42 / 220.55 / 430.24');
      expect(copy.calculationBasis).toBe('NEC 220 Part III demand factors');
      for (const field of [copy.methodLabel, copy.methodNecRef, copy.verdictAdequateBody, copy.condition1Header]) {
        expect(field).not.toMatch(/220\.8[234]|Part IV/);
      }
    }
  });

  it('treats an empty runtime list as absent (falls back to occupancy)', () => {
    const copy = getNEC22087NarrativeCopy('calculated', 'commercial', []);
    expect(copy.methodNecRef).toContain('220.42 / 220.44 / 220.56');
  });
});

describe('getNEC22087NarrativeCopy — calculated method, occupancy fallback (no runtime references)', () => {
  it('single-family (existing or new) falls back to Part III 220.40 / 220.42, never 220.82 / 220.83', () => {
    for (const occupancy of ['dwelling_single_family_existing', 'dwelling_single_family_new'] as const) {
      const copy = getNEC22087NarrativeCopy('calculated', occupancy);
      expect(copy.methodNecRef).toContain('NEC 220 Part III calculation');
      expect(copy.methodNecRef).toContain('220.40 / 220.42');
      expect(copy.methodNecRef).not.toMatch(/220\.8[234]/);
    }
  });

  it('multifamily falls back to Part IV Optional Method (NEC 220.84)', () => {
    const copy = getNEC22087NarrativeCopy('calculated', 'dwelling_multi_family');
    expect(copy.methodLabel).toContain('NEC 220 Part IV Optional Method (NEC 220.84)');
    expect(copy.methodNecRef).not.toContain('220.82');
    expect(copy.methodNecRef).not.toContain('220.83');
  });

  it('cites 220.42 / 220.44 / 220.56 for commercial (no dwelling subsections)', () => {
    const copy = getNEC22087NarrativeCopy('calculated', 'commercial');
    expect(copy.methodNecRef).toContain('220.42 / 220.44 / 220.56');
    expect(copy.verdictAdequateBody).toContain('220.42 / 220.44 / 220.56');
    expect(copy.methodNecRef).not.toMatch(/220\.8[234]/);
    expect(copy.verdictAdequateBanner).toContain('PART III');
  });

  it('cites 220.42 / 220.56 for industrial (no receptacle subsection)', () => {
    const copy = getNEC22087NarrativeCopy('calculated', 'industrial');
    expect(copy.methodNecRef).toContain('220.42 / 220.56');
    expect(copy.verdictAdequateBody).toContain('220.42 / 220.56');
    expect(copy.methodNecRef).not.toMatch(/220\.8[234]/);
  });

  it('defaults occupancy to dwelling_multi_family (back-compat for legacy callers)', () => {
    // Pre-Sprint-3 callers (e.g. tests/nec22087NarrativePdf.test.ts fixtures)
    // construct NEC22087NarrativeData without `occupancy`.
    const copy = getNEC22087NarrativeCopy('calculated');
    expect(copy.methodLabel).toContain('NEC 220.84');
  });
});

describe('getNEC22087NarrativeCopy — measured/manual methods ignore occupancy (Sprint 3)', () => {
  it('utility_bill cites NEC 220.87 regardless of occupancy', () => {
    const dwellingCopy = getNEC22087NarrativeCopy('utility_bill', 'dwelling_multi_family');
    const commercialCopy = getNEC22087NarrativeCopy('utility_bill', 'commercial');
    expect(dwellingCopy.methodNecRef).toBe(commercialCopy.methodNecRef);
    expect(dwellingCopy.methodNecRef).toContain('NEC 220.87');
    // The narrative page wording (the conditions list, the verdict banner)
    // is the NEC 220.87 wording — these are measured-method paths.
    expect(dwellingCopy.sheetHeader).toBe('NEC 220.87 NARRATIVE');
  });

  it('load_study cites NEC 220.87 regardless of occupancy', () => {
    const copy = getNEC22087NarrativeCopy('load_study', 'commercial');
    expect(copy.methodNecRef).toContain('NEC 220.87');
    expect(copy.methodNecRef).toContain('load study');
  });

  it('manual cites NEC 220.87 (defensive default) regardless of occupancy', () => {
    const copy = getNEC22087NarrativeCopy('manual', 'industrial');
    expect(copy.methodNecRef).toContain('NEC 220.87');
    expect(copy.methodNecRef).toContain('defensive default');
  });
});
