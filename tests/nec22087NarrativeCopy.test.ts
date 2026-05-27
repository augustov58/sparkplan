/**
 * Sprint 3 (2026-05-27) — `getNEC22087NarrativeCopy(method, occupancy)`
 * fans the `calculated`-method label / NEC reference / verdict body
 * by occupancy. Pre-Sprint 3 the helper hard-coded dwelling subsections
 * (220.82 / 220.84) for all occupancies, citing dwelling tables on
 * commercial / industrial packets.
 *
 * Each case here pins the EXACT subsection string the AHJ reviewer
 * sees on the calculated-method narrative page. A regression here
 * silently re-introduces the cross-occupancy citation drift.
 */
import { describe, it, expect } from 'vitest';
import { getNEC22087NarrativeCopy } from '../services/pdfExport/PermitPacketDocuments';

describe('getNEC22087NarrativeCopy — calculated method, occupancy axis (Sprint 3)', () => {
  it('cites 220.42 / 220.83 for existing single-family dwelling', () => {
    const copy = getNEC22087NarrativeCopy('calculated', 'dwelling_single_family_existing');
    expect(copy.methodLabel).toContain('220.42 / 220.83');
    expect(copy.methodNecRef).toContain('220.42 / 220.83');
    expect(copy.verdictAdequateBody).toContain('220.42 / 220.83');
    // Must NOT cite the other dwelling subsections in the same packet.
    expect(copy.methodNecRef).not.toContain('220.82');
    expect(copy.methodNecRef).not.toContain('220.84');
  });

  it('cites 220.42 / 220.82 for new single-family dwelling', () => {
    const copy = getNEC22087NarrativeCopy('calculated', 'dwelling_single_family_new');
    expect(copy.methodLabel).toContain('220.42 / 220.82');
    expect(copy.methodNecRef).toContain('220.42 / 220.82');
    expect(copy.verdictAdequateBody).toContain('220.42 / 220.82');
    expect(copy.methodNecRef).not.toContain('220.83');
    expect(copy.methodNecRef).not.toContain('220.84');
  });

  it('cites 220.42 / 220.84 for multifamily dwelling', () => {
    const copy = getNEC22087NarrativeCopy('calculated', 'dwelling_multi_family');
    expect(copy.methodLabel).toContain('220.42 / 220.84');
    expect(copy.methodNecRef).toContain('220.42 / 220.84');
    expect(copy.verdictAdequateBody).toContain('220.42 / 220.84');
    expect(copy.methodNecRef).not.toContain('220.82');
    expect(copy.methodNecRef).not.toContain('220.83');
  });

  it('cites 220.42 / 220.44 / 220.56 for commercial (no dwelling subsections)', () => {
    const copy = getNEC22087NarrativeCopy('calculated', 'commercial');
    expect(copy.methodLabel).toContain('220.42 / 220.44 / 220.56');
    expect(copy.methodNecRef).toContain('220.42 / 220.44 / 220.56');
    expect(copy.verdictAdequateBody).toContain('220.42 / 220.44 / 220.56');
    // The Sprint-3 fix: commercial packets must NOT cite dwelling tables.
    expect(copy.methodNecRef).not.toContain('220.82');
    expect(copy.methodNecRef).not.toContain('220.83');
    expect(copy.methodNecRef).not.toContain('220.84');
  });

  it('cites 220.42 / 220.56 for industrial (no receptacle subsection)', () => {
    const copy = getNEC22087NarrativeCopy('calculated', 'industrial');
    expect(copy.methodLabel).toContain('220.42 / 220.56');
    expect(copy.methodNecRef).toContain('220.42 / 220.56');
    expect(copy.verdictAdequateBody).toContain('220.42 / 220.56');
    expect(copy.methodNecRef).not.toContain('220.44'); // commercial receptacles
    expect(copy.methodNecRef).not.toContain('220.82');
    expect(copy.methodNecRef).not.toContain('220.83');
    expect(copy.methodNecRef).not.toContain('220.84');
  });

  it('defaults occupancy to dwelling_multi_family (back-compat for legacy callers)', () => {
    // Pre-Sprint-3 callers (e.g. tests/nec22087NarrativePdf.test.ts fixtures)
    // construct NEC22087NarrativeData without `occupancy`. The helper must
    // default to dwelling_multi_family so their rendered output is byte-
    // identical to pre-Sprint-3.
    const copy = getNEC22087NarrativeCopy('calculated');
    expect(copy.methodLabel).toContain('220.42 / 220.84');
    expect(copy.methodNecRef).toContain('220.42 / 220.84');
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
