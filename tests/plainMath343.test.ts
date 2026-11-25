/**
 * #343: Gemini 3 writes some formulas as LaTeX even when its instructions say
 * not to (1 of 4 answers in the verifier's run). The chat renders Markdown
 * only, so LaTeX printed raw. Inputs below are the answers seen on 2026-11-25.
 */
import { describe, expect, it } from 'vitest';
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

  it('leaves prices and plain text alone', () => {
    const prices = 'Estimated cost: $5,700–$14,000, about $500 per charger.';
    expect(plainMath(prices)).toBe(prices);
    const plain = '**Yes.** 200 A × 208 V × √3 = 72,051 VA (NEC 408.30).';
    expect(plainMath(plain)).toBe(plain);
  });

  it('a price before inline math on the same line', () => {
    expect(plainMath('Costs $5,700; the load is $16{,}640\\text{ VA}$.')).toBe('Costs $5,700; the load is 16,640 VA.');
  });
});
