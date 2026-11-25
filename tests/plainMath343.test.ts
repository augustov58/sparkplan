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

  it('the third verifier\'s answers: nested \\frac, {,} groups, adjacent commands, \\sum, \\&, \\boxed', () => {
    expect(plainMath('$$\\text{kVA} = \\frac{\\sqrt{3} \\times V_{\\text{LL}} \\times I_{\\text{line}}}{1{,}000}$$'))
      .toBe('kVA = (√3 × V_LL × I_line) / 1,000');
    expect(plainMath('divide total volt-amperes by $1{,}000$: $S_{\\text{total}}$')).toBe('divide total volt-amperes by 1,000: S_total');
    expect(plainMath('$K \\approx 12.9\\ \\Omega\\cdot\\text{cmil/ft}$')).toBe('K ≈ 12.9 Ω·cmil/ft');
    expect(plainMath('$$\\text{Total Material} = \\sum (Q_{\\text{breaker}} \\times C)$$')).toBe('Total Material = Σ (Q_breaker × C)');
    expect(plainMath('$$\\text{Total} = \\text{Material} + \\text{Permits \\& Inspection}$$')).toBe('Total = Material + Permits & Inspection');
    expect(plainMath('$$\\boxed{72.05\\text{ kVA}}$$')).toBe('72.05 kVA');
    // From a real answer: \\right must not eat \\rightarrow; a sum's limits stay readable
    expect(plainMath('($90.2\\text{ A} \\times 2.50 = 225.5\\text{ A} \\rightarrow \\mathbf{225\\text{ A}}$)')).toBe('(90.2 A × 2.50 = 225.5 A → 225 A)');
    expect(plainMath('$$\\text{Cost} = \\sum_{i=1}^{n} (\\text{Qty}_i \\times \\text{Unit}_i)$$')).toBe('Cost = Σ(i=1…n) (Qty_i × Unit_i)');
    expect(plainMath('$$\\frac{72{,}053.3\\text{ VA}}{1{,}000} \\approx 72.05\\text{ kVA}$$')).toBe('72,053.3 VA / 1,000 ≈ 72.05 kVA');
  });

  it('display math lines stay separate lines (Markdown hard break)', () => {
    expect(plainMath('$$VA = \\sqrt{3} \\times V \\times I$$\n$$VA \\approx 72{,}053\\text{ VA}$$'))
      .toBe('VA = √3 × V × I  \nVA ≈ 72,053 VA');
    expect(plainMath('$$\\begin{aligned} S &= \\sqrt{3} V I \\\\ &= 72.05\\text{ kVA} \\end{aligned}$$')).toBe('S = √3 V I  \n= 72.05 kVA');
  });

  // Four whole gemini-3.8-flash answers from the Copilot (2026-11-25), 64–108 LaTeX tokens each
  const answers: string[] = JSON.parse(readFileSync('tests/fixtures/copilotLatexAnswers343.json', 'utf8'));
  const LEFTOVER = /\\[a-zA-Z%&]|\$\$|\$(?=[A-Za-z\\{(])|\b(frac|dfrac|cdot|sqrt|mathrm|mathbf|boxed|quad|ldots|text|arrow)\b|[{}]/;
  it.each(answers.map((raw, i) => [i, raw] as const))('real answer %i: no LaTeX left, same lines', (_, raw) => {
    expect(raw.match(/\\[a-zA-Z]+/g)?.length).toBeGreaterThan(30);
    const out = plainMath(raw);
    expect(out).not.toMatch(LEFTOVER);
    expect(out.split('\n')).toHaveLength(raw.split('\n').length);
  });

  it('real answers: formulas and prices as displayed', () => {
    const out = answers.map(plainMath).join('\n');
    expect(out).toContain('Capacity (VA) = V_L-L × I × √3');
    expect(out).toContain('200 A - 59 A = 141 A (141 A × 208 V × √3 / 1,000 ≈ 50.8 kVA)');
    expect(out).toContain('FLC_primary = (75 × 1,000) / (480 × √3) = 75,000 / 831.38 = 90.21 A');
    expect(out).toContain('Primary breaker: up to 250% (90.2 A × 2.50 = 225.5 A → 225 A).');
    expect(out).toContain('$1,800.00 + $250.00 + $450.00 + $352.50 + $100.00 = $2,952.50');
    expect(out).toContain('Total Project Cost = Materials Cost + Labor Cost + Permit & Inspection Fees');
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

  it('inline math holding escaped dollars (the fourth verifier\'s cost answer)', () => {
    expect(plainMath('the subtotal is $\\$2,625.00 + \\$1,295.00 = \\$3,920.00$; markup is $\\$588.00$; plus $\\$183.75$ material tax yields $4,691.75.'))
      .toBe('the subtotal is $2,625.00 + $1,295.00 = $3,920.00; markup is $588.00; plus $183.75 material tax yields $4,691.75.');
  });

  it('a price before inline math on the same line', () => {
    expect(plainMath('Costs $5,700; the load is $16{,}640\\text{ VA}$.')).toBe('Costs $5,700; the load is 16,640 VA.');
  });
});
