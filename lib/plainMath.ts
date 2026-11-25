/**
 * The chat renders Markdown, not LaTeX, and Gemini 3 writes some formulas as
 * LaTeX even when told not to (#343): turn math spans into plain text.
 * `$$…$$`, `\[…\]` and `\(…\)` always; `$…$` only when it holds a LaTeX
 * command, so prices ("$5,700–$14,000") stay as they are.
 */

const SYMBOLS: Record<string, string> = {
  times: '×', cdot: '·', div: '÷', pm: '±', approx: '≈', neq: '≠',
  le: '≤', leq: '≤', ge: '≥', geq: '≥', to: '→', rightarrow: '→',
  circ: '°', degree: '°', Omega: 'Ω', Delta: 'Δ', phi: 'φ', Phi: 'Φ', theta: 'θ',
};

const group = (x: string) => (/^[\w.,√]+$/.test(x) ? x : `(${x})`);

function plainLatex(tex: string): string {
  let s = tex;
  // Innermost first: a command whose argument still holds braces waits for the next pass
  for (let pass = 0; pass < 6; pass++) {
    const next = s
      .replace(/\\(?:text|textbf|textit|mathrm|mathbf|mathit|operatorname|mbox)\{([^{}]*)\}/g, '$1')
      .replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, (_, a: string, b: string) => `${group(a.trim())} / ${group(b.trim())}`)
      .replace(/\\sqrt\{([^{}]*)\}/g, (_, x: string) => `√${group(x.trim())}`);
    if (next === s) break;
    s = next;
  }
  return s
    .replace(/\\left|\\right/g, '')
    .replace(/\\%/g, '%')
    .replace(/\\[,;:! ]/g, ' ')
    .replace(/\\([a-zA-Z]+)/g, (_, name: string) => SYMBOLS[name] ?? name)
    .replace(/\^\{?2\}?/g, '²')
    .replace(/\^\{?3\}?/g, '³')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function plainMath(markdown: string): string {
  const convert = (_: string, tex: string) => plainLatex(tex);
  return markdown
    .replace(/\$\$([\s\S]+?)\$\$/g, convert)
    .replace(/\\\[([\s\S]+?)\\\]/g, convert)
    .replace(/\\\(([\s\S]+?)\\\)/g, convert)
    .replace(/\$([^$\n]*?\\[a-zA-Z][^$\n]*?)\$/g, convert);
}
