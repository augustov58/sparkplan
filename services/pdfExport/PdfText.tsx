/**
 * `Text` for every PDF page, in place of `@react-pdf/renderer`'s.
 *
 * The PDFs use the built-in Helvetica, a WinAnsi font: characters outside it
 * print as the wrong glyph ("→ PANEL H1" printed "’ PANEL H1", "≤3%" printed
 * "d3%"; #153). Manifest text, calculation notes, circuit descriptions and
 * user input all reach the page through `Text`, so its string children are
 * spelled out in ASCII here, once.
 */

import React from 'react';
import { Text as PdfText } from '@react-pdf/renderer';

const REPLACEMENTS: Readonly<Record<string, string>> = {
  '→': '->',
  '←': '<-',
  '≤': '<=',
  '≥': '>=',
  '≠': '!=',
  '≈': '~',
  '√': 'sqrt',
  'Ω': 'ohm',
  'Σ': 'Sum',
  'Φ': 'Ø',
  'φ': 'Ø',
  '✓': '[X]',
  '✅': '[X]',
  '✗': 'X',
  '❌': 'X',
};

const MAPPED = new RegExp(`[${Object.keys(REPLACEMENTS).join('')}]`, 'gu');
// Remaining pictographs (⚠️, ℹ️, …) and their variation selector, with one
// trailing space: "⚠️ CRITICAL: …" → "CRITICAL: …".
const PICTOGRAPHS = /[ℹ☀-➿\u{1F300}-\u{1FAFF}]️?\s?|️/gu;

/** One string with the characters Helvetica lacks spelled out in ASCII. */
export function toPdfText(text: string): string {
  return text
    .replace(/√(\d+)/g, 'sqrt($1)')
    .replace(MAPPED, (ch) => REPLACEMENTS[ch] ?? ch)
    .replace(PICTOGRAPHS, '');
}

function clean(node: React.ReactNode): React.ReactNode {
  if (typeof node === 'string') return toPdfText(node);
  if (Array.isArray(node)) return node.map(clean);
  return node;
}

type TextProps = React.ComponentProps<typeof PdfText> & { children?: React.ReactNode };
type RenderFn = (args: {
  pageNumber: number;
  totalPages: number;
  subPageNumber: number;
  subPageTotalPages: number;
}) => React.ReactNode;

export function Text(props: TextProps) {
  const { children, render } = props as { children?: React.ReactNode; render?: RenderFn };
  return (
    <PdfText {...props} {...(render ? { render: (args: Parameters<RenderFn>[0]) => clean(render(args)) } : {})}>
      {clean(children)}
    </PdfText>
  );
}
