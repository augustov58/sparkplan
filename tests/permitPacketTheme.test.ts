/**
 * Tests for shared formatters in `services/pdfExport/permitPacketTheme.tsx`.
 *
 * Sprint 2A PR #40 follow-up — these formatters are called from multiple
 * doc files (PermitPacketDocuments, EquipmentSpecsDocuments). Drift between
 * call sites caused the original "65000 kA" units bug fixed here, so the
 * formatters need their own coverage.
 */

import { describe, it, expect } from 'vitest';
import { formatAicKa, phaseLabel, PHASE } from '../services/pdfExport/permitPacketTheme';

describe('formatAicKa', () => {
  it('formats raw amps as kA, rounding ≥10 kA to integer', () => {
    expect(formatAicKa(22000)).toBe('22 kA');
    expect(formatAicKa(65000)).toBe('65 kA');
    expect(formatAicKa(100000)).toBe('100 kA');
  });

  it('keeps one decimal under 10 kA', () => {
    expect(formatAicKa(9500)).toBe('9.5 kA');
    expect(formatAicKa(5000)).toBe('5.0 kA');
  });

  it('returns undefined for missing or non-positive ratings (so call sites can decide)', () => {
    expect(formatAicKa(null)).toBeUndefined();
    expect(formatAicKa(undefined)).toBeUndefined();
    expect(formatAicKa(0)).toBeUndefined();
    expect(formatAicKa(-100)).toBeUndefined();
  });

  it('regression: never inline-concatenates raw amps with " kA"', () => {
    // The pre-fix bug was `${aic_rating} kA` rendering "65000 kA". Guarantee
    // we always divide by 1000 before applying the kA suffix.
    expect(formatAicKa(65000)).not.toBe('65000 kA');
    expect(formatAicKa(22000)).not.toBe('22000 kA');
  });
});

describe('phaseLabel', () => {
  it('uses the slashed-Ø PHASE symbol the project font has, not Greek φ', () => {
    expect(phaseLabel(1)).toBe(`1${PHASE}`);
    expect(phaseLabel(3)).toBe(`3${PHASE}`);
    // PHASE itself must be Ø (U+00D8), NOT φ (U+03C6) — the latter is
    // missing from the @react-pdf default font and falls back to a glyph
    // that renders as Æ, producing the "3Æervice" bug fixed alongside.
    expect(PHASE).toBe('Ø');
    expect(PHASE).not.toBe('φ');
  });
});
