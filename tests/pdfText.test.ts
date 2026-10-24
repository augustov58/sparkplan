/**
 * #153: Helvetica (WinAnsi) has no ≤ / ≥ / √ / → — they printed as "d",
 * "e", "’". Every PDF page's `Text` spells them out (services/pdfExport/PdfText).
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { pdf, Document, Page } from '@react-pdf/renderer';
import { Text, toPdfText } from '../services/pdfExport/PdfText';
import { ALL_MANIFESTS } from '../data/ahj/registry';

// cp1252 printable set: ASCII, Latin-1 (0xA0–0xFF) and the 0x80–0x9F extras.
const CP1252_EXTRAS = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
const isWinAnsi = (ch: string) => {
  const c = ch.codePointAt(0)!;
  return c === 0x0a || (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || CP1252_EXTRAS.includes(ch);
};

describe('toPdfText', () => {
  it.each([
    ['→ PANEL H1', '-> PANEL H1'],
    ['Voltage drop note (≤3% feeder / ≤3% branch / ≤5% combined)', 'Voltage drop note (<=3% feeder / <=3% branch / <=5% combined)'],
    ['commercial / ≥277-480V scope', 'commercial / >=277-480V scope'],
    ['I = VA ÷ (V × √3)', 'I = VA ÷ (V × sqrt(3))'],
    ['Z = √(R² + X²)', 'Z = sqrt(R² + X²)'],
    ['Z total (Ω)', 'Z total (ohm)'],
    ['208V 3Φ', '208V 3Ø'],
    ['⚠️ CRITICAL: Breaker exceeds ampacity', 'CRITICAL: Breaker exceeds ampacity'],
    ['ℹ️ NEC 220.83(A): no heating', 'NEC 220.83(A): no heating'],
    ['✓ Upsized to 4 AWG', '[X] Upsized to 4 AWG'],
  ])('%s', (input, expected) => {
    expect(toPdfText(input)).toBe(expected);
  });

  it('leaves WinAnsi text alone (°, ², •, —, Ø, ÷, ×)', () => {
    const s = '75°C • R² + X² — 3Ø ÷ ×';
    expect(toPdfText(s)).toBe(s);
  });

  it('every manifest string comes out printable', () => {
    const strings: string[] = [];
    const walk = (v: unknown): void => {
      if (typeof v === 'string') strings.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    ALL_MANIFESTS.forEach(walk);
    const bad = strings.map(toPdfText).filter((s) => ![...s].every(isWinAnsi));
    expect(bad).toEqual([]);
  });
});

describe('Text', () => {
  it('cleans string children, including arrays and render()', () => {
    const el = Text({ children: ['≤3%', 5, ' → H1'] }) as React.ReactElement<{ children: unknown; render?: unknown }>;
    expect(el.props.children).toEqual(['<=3%', 5, ' -> H1']);
    const paged = Text({ render: () => '≥ page' }) as React.ReactElement<{ render: (a: unknown) => unknown }>;
    expect(paged.props.render({ pageNumber: 1, totalPages: 1, subPageNumber: 1, subPageTotalPages: 1 })).toBe('>= page');
  });

  it('renders inside a document, nested', async () => {
    const doc = React.createElement(Document, null,
      React.createElement(Page, null,
        React.createElement(Text, null, '→ PANEL H1 ', React.createElement(Text, null, '≤3%'))));
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });
});
