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
  // #313 (owner ruling 2026-11-23): panels.aic_rating is stored in kA — the
  // Equipment Specs form saves 42 for 42 kA, the manufacturer templates and the
  // validator use kA, and the production rows hold 10 and 42.
  it('prints the stored kA rating, rounding ≥10 kA to an integer', () => {
    expect(formatAicKa(42)).toBe('42 kA');
    expect(formatAicKa(10)).toBe('10 kA');
    expect(formatAicKa(22)).toBe('22 kA');
    expect(formatAicKa(65)).toBe('65 kA');
    expect(formatAicKa(200)).toBe('200 kA');
  });

  it('keeps one decimal under 10 kA', () => {
    expect(formatAicKa(9.5)).toBe('9.5 kA');
    expect(formatAicKa(5)).toBe('5.0 kA');
  });

  it('returns undefined for missing or non-positive ratings (so call sites can decide)', () => {
    expect(formatAicKa(null)).toBeUndefined();
    expect(formatAicKa(undefined)).toBeUndefined();
    expect(formatAicKa(0)).toBeUndefined();
    expect(formatAicKa(-100)).toBeUndefined();
  });

  it('regression #313: a form-saved 42 kA never prints as 0.0 kA', () => {
    expect(formatAicKa(42)).not.toBe('0.0 kA');
    expect(formatAicKa(10)).not.toBe('0.0 kA');
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
