/**
 * The chat renders Markdown, not LaTeX, and Gemini 3 writes formulas as LaTeX
 * even when told not to (#343): turn math spans into plain text.
 * `$$…$$`, `\[…\]` and `\(…\)` always. An inline `$…$` follows pandoc's rule
 * (opens before a non-space, closes after a non-space, the closing `$` not
 * followed by a digit), and when it starts with a digit it must hold LaTeX
 * (`\`, `{`, `_`, `^`), so prices ("$5,700–$14,000", "| $2,000 | $4,000 |")
 * stay as they are.
 *
 * General rules, not a list of formulas: known symbols first (so an unwrapped
 * argument never fuses with the command before it), \frac and \sqrt, then any
 * other command with a brace argument gives its argument (\text, \boxed,
 * \mathrm…), bare groups unwrap (1{,}000), unknown bare commands drop.
 */

const SYMBOLS: Record<string, string> = {
  times: '×', cdot: '·', div: '÷', pm: '±', mp: '∓', approx: '≈', sim: '~', simeq: '≃', equiv: '≡',
  neq: '≠', ne: '≠', le: '≤', leq: '≤', ge: '≥', geq: '≥', ll: '≪', gg: '≫', propto: '∝',
  to: '→', rightarrow: '→', Rightarrow: '⇒', implies: '⇒', leftarrow: '←', Leftarrow: '⇐', iff: '⇔',
  circ: '°', degree: '°', infty: '∞', angle: '∠', partial: '∂', nabla: '∇', checkmark: '✓',
  sum: 'Σ', prod: '∏', int: '∫', dots: '…', ldots: '…', cdots: '…', quad: ' ', qquad: ' ',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
  theta: 'θ', kappa: 'κ', lambda: 'λ', mu: 'µ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ',
  tau: 'τ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  sin: 'sin', cos: 'cos', tan: 'tan', ln: 'ln', log: 'log', exp: 'exp', max: 'max', min: 'min',
};

const AMP = ''; // a literal \& while bare & (alignment) is removed

const group = (x: string) => (/^[\w.,√]+( [A-Za-zΩ°%]+)?$/.test(x) ? x : `(${x})`);

function plainLatex(tex: string): string {
  let s = tex
    .replace(/\\begin\{[^}]*\}|\\end\{[^}]*\}/g, '')
    .replace(/\\&/g, AMP)
    .replace(/&/g, '')
    .replace(/\\\\/g, '  \n')
    .replace(/\\%/g, '%')
    .replace(/\\\$/g, '$')
    .replace(/\\#/g, '#')
    .replace(/\\_/g, '_')
    .replace(/\\(?:left|right)(?![a-zA-Z])/g, '')
    .replace(/\^\{?\\circ\}?/g, '°')
    .replace(/\\[,;:! ]/g, ' ')
    .replace(/\\([a-zA-Z]+)/g, (whole: string, name: string) => SYMBOLS[name] ?? whole);
  // Innermost first: a group whose content still holds braces waits for the next pass
  for (let pass = 0; pass < 10; pass++) {
    const next = s
      .replace(/([Σ∏∫])_\{?([^{}\s^]*)\}?\^\{?([^{}\s]*)\}?/g, '$1($2…$3)')
      .replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, (_, a: string, b: string) => `${group(a.trim())} / ${group(b.trim())}`)
      .replace(/\\sqrt\{([^{}]*)\}/g, (_, x: string) => `√${group(x.trim())}`)
      .replace(/\\(?!(?:[dt]?frac|sqrt)\{)[a-zA-Z]+\{([^{}]*)\}/g, '$1')
      .replace(/([_^])\{([^{}]*)\}/g, '$1$2')
      .replace(/(^|[^\\a-zA-Z}])\{([^{}]*)\}/g, '$1$2');
    if (next === s) break;
    s = next;
  }
  return s
    .replace(/\\[a-zA-Z]+/g, '') // unknown bare commands (\displaystyle, \limits…)
    .replace(/\^2(?!\d)/g, '²')
    .replace(/\^3(?!\d)/g, '³')
    .replace(/[{}]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '  \n')
    .replace(/\( /g, '(')
    .replace(/ \)/g, ')')
    .replace(new RegExp(AMP, 'g'), '&')
    .trim();
}

export function plainMath(markdown: string): string {
  const convert = (_: string, tex: string) => plainLatex(tex);
  return markdown
    // A display formula on its own line, followed by another line: keep the line break (Markdown hard break)
    .replace(/^([ \t]*(?:[*+-][ \t]+|\d+\.[ \t]+)?)\$\$([^\n]+?)\$\$[ \t]*(?=\n)/gm, (_, lead: string, tex: string) => `${lead}${plainLatex(tex)}  `)
    .replace(/\$\$([\s\S]+?)\$\$/g, convert)
    .replace(/\\\[([\s\S]+?)\\\]/g, convert)
    .replace(/\\\(([\s\S]+?)\\\)/g, convert)
    // Escaped characters stay inside the span: "$\$588.00$" is math holding a price
    .replace(/\$(?=\S)((?:[^$\n\\]|\\.)*?(?:[^\s$\\]|\\.))\$(?!\d)/g, (whole: string, tex: string) =>
      /[\\{}_^]/.test(tex) || !/^\d/.test(tex) ? plainLatex(tex) : whole);
}
