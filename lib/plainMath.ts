/**
 * The chat renders Markdown, not LaTeX, and Gemini 3 writes formulas as LaTeX
 * even when told not to (#343): turn math spans into plain text.
 * `$$…$$`, `\[…\]` and `\(…\)` always. An inline `$…$` follows pandoc's rule
 * (opens before a non-space, closes after a non-space, the closing `$` not
 * followed by a digit), and without a command it must not start with a digit,
 * so prices ("$5,700–$14,000", "| $2,000 | $4,000 |") stay as they are.
 */

const SYMBOLS: Record<string, string> = {
  times: '×', cdot: '·', div: '÷', pm: '±', approx: '≈', sim: '~', neq: '≠', ne: '≠',
  le: '≤', leq: '≤', ge: '≥', geq: '≥', to: '→', rightarrow: '→', Rightarrow: '⇒',
  circ: '°', degree: '°', infty: '∞', dots: '…', ldots: '…', cdots: '…',
  quad: ' ', qquad: ' ',
  Omega: 'Ω', Delta: 'Δ', Sigma: 'Σ', alpha: 'α', beta: 'β', eta: 'η', theta: 'θ',
  lambda: 'λ', mu: 'µ', pi: 'π', rho: 'ρ', sigma: 'σ', phi: 'φ', Phi: 'Φ',
};

const group = (x: string) => (/^[\w.,√]+$/.test(x) ? x : `(${x})`);

function plainLatex(tex: string): string {
  let s = tex
    .replace(/\\begin\{[^}]*\}|\\end\{[^}]*\}|&/g, '')
    .replace(/\\\\/g, '\n')
    .replace(/\\left|\\right/g, '')
    .replace(/\^\{?\\circ\}?/g, '°');
  // Innermost first: a command whose argument still holds braces waits for the next pass
  for (let pass = 0; pass < 8; pass++) {
    const next = s
      .replace(/\\(?:text|textbf|textit|textrm|mathrm|mathbf|mathit|operatorname|mbox)\{([^{}]*)\}/g, '$1')
      .replace(/([_^])\{([^{}]*)\}/g, '$1$2')
      .replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, (_, a: string, b: string) => `${group(a.trim())} / ${group(b.trim())}`)
      .replace(/\\sqrt\{([^{}]*)\}/g, (_, x: string) => `√${group(x.trim())}`);
    if (next === s) break;
    s = next;
  }
  return s
    .replace(/\\%/g, '%')
    .replace(/\\\$/g, '$')
    .replace(/\\[,;:! ]/g, ' ')
    .replace(/\\([a-zA-Z]+)/g, (_, name: string) => SYMBOLS[name] ?? name)
    .replace(/\^2(?!\d)/g, '²')
    .replace(/\^3(?!\d)/g, '³')
    .replace(/[{}]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\( /g, '(')
    .replace(/ \)/g, ')')
    .trim();
}

export function plainMath(markdown: string): string {
  const convert = (_: string, tex: string) => plainLatex(tex);
  return markdown
    .replace(/\$\$([\s\S]+?)\$\$/g, convert)
    .replace(/\\\[([\s\S]+?)\\\]/g, convert)
    .replace(/\\\(([\s\S]+?)\\\)/g, convert)
    .replace(/\$(?=\S)([^$\n]*?\S)\$(?!\d)/g, (whole: string, tex: string) =>
      /\\[a-zA-Z%]/.test(tex) || !/^\d/.test(tex) ? plainLatex(tex) : whole);
}
