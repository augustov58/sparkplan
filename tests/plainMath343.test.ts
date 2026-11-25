/**
 * #343: Gemini 3 writes some formulas as LaTeX even when its instructions say
 * not to (1 of 4 answers in the verifier's run). The chat renders Markdown
 * only, so LaTeX printed raw. Inputs below are the answers seen on 2026-11-25.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { plainMath } from '../lib/plainMath';

describe('#343 plainMath turns LaTeX into plain text', () => {
  it('the verifier\'s answer (display math, \\frac, \\text, \\sqrt)', () => {
    expect(plainMath('$$\\text{Current (I)} = \\frac{\\text{Apparent Power (S)}}{\\text{Line-to-Line Voltage (V)} \\times \\sqrt{3}}$$'))
      .toBe('Current (I) = (Apparent Power (S)) / (Line-to-Line Voltage (V) × √3)');
  });

  it('inline math with \\mathbf, \\approx and units in \\text', () => {
    expect(plainMath('* Load: $30\\text{ A} \\times 208\\text{ V} \\times \\sqrt{3} \\approx \\mathbf{10.8\\text{ kVA}}$'))
      .toBe('* Load: 30 A × 208 V × √3 ≈ 10.8 kVA');
    expect(plainMath('Total Panel Capacity: $$200\\text{ A} \\times 208\\text{ V} \\times \\sqrt{3} = 72,051\\text{ VA}$$'))
      .toBe('Total Panel Capacity: 200 A × 208 V × √3 = 72,051 VA');
  });

  it('\\( \\) and \\[ \\] delimiters, simple fractions without parentheses', () => {
    expect(plainMath('I = \\(\\frac{21300}{360.27}\\) = 59.1 A')).toBe('I = 21300 / 360.27 = 59.1 A');
    expect(plainMath('\\[ V_{drop} \\le 3\\% \\]')).toBe('V_drop ≤ 3%');
  });

  it('the re-verifier\'s answers: inline variables, \\%, \\quad, \\dots, \\cdot, \\sim, ^\\circ, \\left(\\frac\\right)', () => {
    expect(plainMath('System Voltage ($V_{LL}$): 208 V; Bus Rating ($I$): 200 A; ($CM$)')).toBe('System Voltage (V_LL): 208 V; Bus Rating (I): 200 A; (CM)');
    expect(plainMath('VD ≈ 3.38 V or $1.62\\%$, not exceeding $3\\%$.')).toBe('VD ≈ 3.38 V or 1.62%, not exceeding 3%.');
    expect(plainMath('$$200\\text{ A} - 59.1\\text{ A} = 140.9\\text{ A} \\quad (\\approx 50.75\\text{ kVA})$$')).toBe('200 A - 59.1 A = 140.9 A (≈ 50.75 kVA)');
    expect(plainMath('$$\\%VD = \\left( \\frac{VD}{V_{LL}} \\right) \\times 100\\%$$')).toBe('%VD = (VD / V_LL) × 100%');
    expect(plainMath('$R = 0.122\\,\\Omega/1000\\text{ ft}$ at $75^\\circ\\text{C}$, $K \\approx 12.9\\,\\Omega \\cdot \\text{cmil/ft}$'))
      .toBe('R = 0.122 Ω/1000 ft at 75°C, K ≈ 12.9 Ω · cmil/ft');
    expect(plainMath('$15\\text{ A}, 20\\text{ A}, \\dots$ (or $\\sim 1.62\\%$ AC)')).toBe('15 A, 20 A, … (or ~ 1.62% AC)');
  });

  it('a whole Gemini 3 answer (gemini-3.8-flash, 2026-11-25): no LaTeX left, text unchanged', () => {
    const raw = readFileSync('tests/fixtures/copilotLatexAnswer343.md', 'utf8');
    const out = plainMath(raw);
    expect(raw.match(/\\[a-zA-Z]+/g)?.length).toBeGreaterThan(30);
    expect(out).not.toMatch(/\$|\\[a-zA-Z%]/);
    expect(out).toContain('Capacity (VA) = V_L-L × I × √3');
    expect(out).toContain('200 A - 59 A = 141 A (141 A × 208 V × √3 / 1,000 ≈ 50.8 kVA)');
    expect(out.split('\n')).toHaveLength(raw.split('\n').length);
  });

  it('leaves prices and plain text alone', () => {
    for (const prices of [
      'Estimated cost: $5,700–$14,000, about $500 per charger.',
      '| Labor | $2,000 | $4,000 |',
      'Between $5 and $10 per foot ($8 typical).',
    ]) expect(plainMath(prices)).toBe(prices);
    const plain = '**Yes.** 200 A × 208 V × √3 = 72,051 VA (NEC 408.30).';
    expect(plainMath(plain)).toBe(plain);
  });

  it('a price before inline math on the same line', () => {
    expect(plainMath('Costs $5,700; the load is $16{,}640\\text{ VA}$.')).toBe('Costs $5,700; the load is 16,640 VA.');
  });
});
