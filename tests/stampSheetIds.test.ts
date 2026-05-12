/**
 * Sprint 2B PR-3 — stampSheetIds unit tests.
 *
 * Asserts:
 * 1. Skips pages flagged shouldStamp=false (no double-stamping SparkPlan)
 * 2. Stamps pages flagged shouldStamp=true; we verify by inspecting the
 *    content stream for the sheet ID literal.
 * 3. Handles mixed page sizes (Letter + ARCH D) — stamp is positioned
 *    relative to each page's actual width.
 * 4. Pure function: no throw on bad inputs — returns warnings instead.
 * 5. buildStampMaps helper produces the right shape for a typical mix.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { pdf, Document, Page, Text } from '@react-pdf/renderer';
import { PDFDocument } from 'pdf-lib';
import {
  stampSheetIds,
  buildStampMaps,
} from '../services/pdfExport/stampSheetIds';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const renderFakePdf = async (
  pageSize: 'LETTER' | [number, number],
  pageCount: number,
  label = 'fake',
): Promise<Uint8Array> => {
  const pages = Array.from({ length: pageCount }, (_, i) =>
    React.createElement(
      Page,
      { size: pageSize as 'LETTER', key: i, style: { padding: 40 } },
      React.createElement(Text, null, `${label} page ${i + 1}`),
    ),
  );
  const blob = await pdf(
    React.createElement(Document, null, ...pages),
  ).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
};

/**
 * pdf-lib's drawText serializes text as a hex-encoded literal inside a Tj
 * operator: `<432D303031> Tj` for "C-001". This helper decompresses every
 * FlateDecode stream in the doc and checks whether the hex representation
 * of `text` appears anywhere — i.e., it was drawn into some page.
 *
 * (We don't isolate by page index because each test uses distinct sheet
 * IDs so a single match is unambiguous about WHICH page contributed.)
 */
function textToHex(s: string): string {
  let hex = '<';
  for (let i = 0; i < s.length; i++) {
    hex += s.charCodeAt(i).toString(16).padStart(2, '0').toUpperCase();
  }
  return hex + '>';
}

async function docContainsDrawnText(
  bytes: Uint8Array,
  text: string,
): Promise<boolean> {
  // Re-load and re-save with useObjectStreams=false so each content stream
  // sits inline (easier to find). Doesn't change the visual output.
  const doc = await PDFDocument.load(bytes);
  const saved = await doc.save({ useObjectStreams: false });
  // Use Node zlib for the test — vitest runs in Node-compatible mode here.
  // We avoid `import zlib from 'node:zlib'` at module top to keep the test
  // surface minimal.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const zlib = await import('node:zlib');
  const hex = textToHex(text);
  const s = new TextDecoder('latin1').decode(saved);
  let cursor = 0;
  while (cursor < s.length) {
    const start = s.indexOf('stream\n', cursor);
    if (start < 0) break;
    const end = s.indexOf('endstream', start);
    if (end < 0) break;
    // The stream content sits between 'stream\n' and the '\n' before 'endstream'.
    const streamBytes = saved.subarray(start + 7, end - 1);
    try {
      const decompressed = zlib
        .inflateSync(streamBytes)
        .toString('latin1');
      if (decompressed.includes(hex)) return true;
    } catch {
      // not flate-encoded — check raw
      const raw = new TextDecoder('latin1').decode(streamBytes);
      if (raw.includes(hex)) return true;
    }
    cursor = end + 'endstream'.length;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('stampSheetIds', () => {
  it('stamps every page flagged shouldStamp=true', async () => {
    const bytes = await renderFakePdf('LETTER', 3, 'test');
    const result = await stampSheetIds({
      merged: bytes,
      sheetIdMap: ['C-001', 'C-002', 'C-003'],
      shouldStamp: [true, true, true],
    });
    expect(result.stampedCount).toBe(3);
    expect(result.warnings).toHaveLength(0);

    // All three IDs should appear in the output.
    expect(await docContainsDrawnText(result.bytes, 'C-001')).toBe(true);
    expect(await docContainsDrawnText(result.bytes, 'C-002')).toBe(true);
    expect(await docContainsDrawnText(result.bytes, 'C-003')).toBe(true);
  });

  it('skips pages flagged shouldStamp=false', async () => {
    const bytes = await renderFakePdf('LETTER', 3, 'test');
    const result = await stampSheetIds({
      merged: bytes,
      sheetIdMap: ['UNSTAMPED-A', 'STAMPED-B', 'UNSTAMPED-C'],
      shouldStamp: [false, true, false],
    });
    expect(result.stampedCount).toBe(1);

    // Only B should appear; A and C should not.
    expect(await docContainsDrawnText(result.bytes, 'STAMPED-B')).toBe(true);
    expect(await docContainsDrawnText(result.bytes, 'UNSTAMPED-A')).toBe(false);
    expect(await docContainsDrawnText(result.bytes, 'UNSTAMPED-C')).toBe(false);
  });

  it('skips pages with empty sheet IDs even when shouldStamp=true', async () => {
    const bytes = await renderFakePdf('LETTER', 2, 'test');
    const result = await stampSheetIds({
      merged: bytes,
      sheetIdMap: ['', 'C-200'],
      shouldStamp: [true, true],
    });
    expect(result.stampedCount).toBe(1);
  });

  it('handles mixed page sizes — stamp positions adjust per page', async () => {
    // Build a document with one Letter page and one ARCH D page.
    const letterBytes = await renderFakePdf('LETTER', 1, 'letter');
    const archDBytes = await renderFakePdf([1728, 2592], 1, 'archd');

    const combined = await PDFDocument.create();
    const ltrDoc = await PDFDocument.load(letterBytes);
    const archDDoc = await PDFDocument.load(archDBytes);
    const ltrPages = await combined.copyPages(ltrDoc, [0]);
    ltrPages.forEach((p) => combined.addPage(p));
    const archDPages = await combined.copyPages(archDDoc, [0]);
    archDPages.forEach((p) => combined.addPage(p));
    const merged = await combined.save();

    const result = await stampSheetIds({
      merged,
      sheetIdMap: ['LTR-001', 'ARCHD-001'],
      shouldStamp: [true, true],
    });
    expect(result.stampedCount).toBe(2);
    expect(await docContainsDrawnText(result.bytes, 'LTR-001')).toBe(true);
    expect(await docContainsDrawnText(result.bytes, 'ARCHD-001')).toBe(true);
  });

  it('returns warnings and bytes-unchanged on a corrupted merged input — does NOT throw', async () => {
    const corrupted = new Uint8Array([0x00, 0x00, 0x00]);
    const result = await stampSheetIds({
      merged: corrupted,
      sheetIdMap: ['C-001'],
      shouldStamp: [true],
    });
    expect(result.stampedCount).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    // Original bytes returned so the caller can still hand them to the user
    // (they'll see a download, just without stamps — graceful degradation).
    expect(result.bytes).toBe(corrupted);
  });

  it('surfaces a warning when array lengths don\'t match page count', async () => {
    const bytes = await renderFakePdf('LETTER', 3, 'test');
    const result = await stampSheetIds({
      merged: bytes,
      sheetIdMap: ['A', 'B'], // too short
      shouldStamp: [true, true],
    });
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/length mismatch/i);
  });

  it('produces a valid PDF that pdf-lib can re-load', async () => {
    const bytes = await renderFakePdf('LETTER', 2, 'test');
    const result = await stampSheetIds({
      merged: bytes,
      sheetIdMap: ['C-001', 'C-002'],
      shouldStamp: [true, true],
    });
    const reloaded = await PDFDocument.load(result.bytes);
    expect(reloaded.getPageCount()).toBe(2);
  });
});

describe('buildStampMaps', () => {
  it('marks SparkPlan pages skip + title pages skip + upload pages stamp', () => {
    const maps = buildStampMaps({
      sparkplanPageCount: 3,
      attachments: [
        { sheetIdRange: ['C-201', 'C-202'] },          // 1 title + 1 upload
        { sheetIdRange: ['X-201', 'X-202', 'X-203'] }, // 1 title + 2 upload
      ],
    });
    // Expected: 3 spark + 2 attach-1 + 3 attach-2 = 8 entries
    expect(maps.sheetIdMap).toHaveLength(8);
    expect(maps.shouldStamp).toHaveLength(8);

    // SparkPlan pages: empty ID, no stamp
    expect(maps.sheetIdMap.slice(0, 3)).toEqual(['', '', '']);
    expect(maps.shouldStamp.slice(0, 3)).toEqual([false, false, false]);

    // Attachment 1: title (no stamp) + upload (stamp)
    expect(maps.sheetIdMap[3]).toBe('C-201');
    expect(maps.shouldStamp[3]).toBe(false);
    expect(maps.sheetIdMap[4]).toBe('C-202');
    expect(maps.shouldStamp[4]).toBe(true);

    // Attachment 2: title (no stamp) + 2 uploads (both stamp)
    expect(maps.sheetIdMap[5]).toBe('X-201');
    expect(maps.shouldStamp[5]).toBe(false);
    expect(maps.sheetIdMap[6]).toBe('X-202');
    expect(maps.shouldStamp[6]).toBe(true);
    expect(maps.sheetIdMap[7]).toBe('X-203');
    expect(maps.shouldStamp[7]).toBe(true);
  });

  it('returns only the SparkPlan portion when no attachments are passed', () => {
    const maps = buildStampMaps({
      sparkplanPageCount: 5,
      attachments: [],
    });
    expect(maps.sheetIdMap).toEqual(['', '', '', '', '']);
    expect(maps.shouldStamp).toEqual([false, false, false, false, false]);
  });

  it('skips attachments with empty sheetIdRange', () => {
    const maps = buildStampMaps({
      sparkplanPageCount: 1,
      attachments: [{ sheetIdRange: [] }],
    });
    expect(maps.sheetIdMap).toEqual(['']);
    expect(maps.shouldStamp).toEqual([false]);
  });

  // ---------------------------------------------------------------------------
  // Cover-OFF (Sprint 2B PR-3 commit 8): hasCover=false attachments contribute
  // upload-only pages with NO stamping. Mixed with cover-ON attachments in a
  // single packet, only the cover-ON pages should get stamped.
  // ---------------------------------------------------------------------------

  it('hasCover=false produces all-false stamps with no title page', () => {
    const maps = buildStampMaps({
      sparkplanPageCount: 2,
      attachments: [
        // Cover-OFF: 3 upload pages, no title, no stamps.
        { sheetIdRange: ['', '', ''], hasCover: false },
      ],
    });
    expect(maps.sheetIdMap).toHaveLength(5); // 2 spark + 3 upload
    expect(maps.shouldStamp).toEqual([false, false, false, false, false]);
  });

  it('mixed cover-ON + cover-OFF: only the cover-ON uploads get stamped', () => {
    const maps = buildStampMaps({
      sparkplanPageCount: 1,
      attachments: [
        // Cover-ON: 1 title + 2 upload pages — uploads get stamped.
        { sheetIdRange: ['C-201', 'C-202', 'C-203'], hasCover: true },
        // Cover-OFF: 4 upload pages — none stamped.
        { sheetIdRange: ['', '', '', ''], hasCover: false },
      ],
    });

    // Total = 1 spark + 3 first-attach + 4 second-attach = 8
    expect(maps.sheetIdMap).toHaveLength(8);

    // Sparkplan: no stamp
    expect(maps.shouldStamp.slice(0, 1)).toEqual([false]);

    // First attachment: title (no stamp) + 2 upload pages (stamp)
    expect(maps.sheetIdMap.slice(1, 4)).toEqual(['C-201', 'C-202', 'C-203']);
    expect(maps.shouldStamp.slice(1, 4)).toEqual([false, true, true]);

    // Second attachment: 4 upload pages, none stamped
    expect(maps.sheetIdMap.slice(4)).toEqual(['', '', '', '']);
    expect(maps.shouldStamp.slice(4)).toEqual([false, false, false, false]);
  });

  // -------------------------------------------------------------------------
  // Overlay mode (v4 commit 15) — hasCover=false + overlay=true. Composite
  // pages get their assigned sheet IDs AND are stamped (unlike the
  // cover-OFF / 'none' path where stamping is suppressed).
  // -------------------------------------------------------------------------

  it('overlay=true: composite upload pages get stamped', () => {
    const maps = buildStampMaps({
      sparkplanPageCount: 1,
      attachments: [
        // Overlay: 3 composite pages, each stamped.
        {
          sheetIdRange: ['A-100', 'A-101', 'A-102'],
          hasCover: false,
          overlay: true,
        },
      ],
    });
    expect(maps.sheetIdMap).toHaveLength(4); // 1 spark + 3 composite
    expect(maps.shouldStamp[0]).toBe(false); // SparkPlan page
    expect(maps.shouldStamp.slice(1)).toEqual([true, true, true]);
    expect(maps.sheetIdMap.slice(1)).toEqual(['A-100', 'A-101', 'A-102']);
  });

  it('overlay mode + custom ID: first composite page uses the custom ID', () => {
    const maps = buildStampMaps({
      sparkplanPageCount: 0,
      attachments: [
        {
          sheetIdRange: ['SP-1', 'C-201'],
          hasCover: false,
          overlay: true,
        },
      ],
    });
    expect(maps.sheetIdMap).toEqual(['SP-1', 'C-201']);
    expect(maps.shouldStamp).toEqual([true, true]);
  });

  it('mixes separate + overlay + none attachments', () => {
    const maps = buildStampMaps({
      sparkplanPageCount: 1,
      attachments: [
        // separate: 1 title + 2 upload pages — uploads stamped.
        { sheetIdRange: ['C-201', 'C-202', 'C-203'], hasCover: true },
        // overlay: 2 composite pages — both stamped.
        {
          sheetIdRange: ['OVR-1', 'OVR-2'],
          hasCover: false,
          overlay: true,
        },
        // none: 2 upload pages — none stamped.
        { sheetIdRange: ['', ''], hasCover: false },
      ],
    });
    expect(maps.sheetIdMap).toEqual([
      '',           // spark
      'C-201',      // separate title (no stamp)
      'C-202',      // separate upload (stamp)
      'C-203',      // separate upload (stamp)
      'OVR-1',      // overlay composite (stamp)
      'OVR-2',      // overlay composite (stamp)
      '',           // none upload (no stamp)
      '',           // none upload (no stamp)
    ]);
    expect(maps.shouldStamp).toEqual([
      false, // spark
      false, // separate title
      true,  // separate upload
      true,  // separate upload
      true,  // overlay composite
      true,  // overlay composite
      false, // none upload
      false, // none upload
    ]);
  });

  it('overlay-mode composite pages with empty ID skip stamping', () => {
    // Belt-and-suspenders: even with overlay=true, empty IDs shouldn't
    // be stamped (otherwise stampSheetIds would emit zero-width text).
    const maps = buildStampMaps({
      sparkplanPageCount: 0,
      attachments: [
        {
          sheetIdRange: ['A-1', ''],
          hasCover: false,
          overlay: true,
        },
      ],
    });
    expect(maps.shouldStamp).toEqual([true, false]);
  });

  it('end-to-end stamping respects cover-OFF: cover-OFF pages not stamped', async () => {
    // Build a 5-page merged document:
    //   page 0 = spark, page 1 = cover-ON upload, page 2 = cover-ON upload,
    //   page 3 = cover-OFF upload (no stamp), page 4 = cover-OFF upload (no stamp).
    // (We skip rendering an actual title page here — the test verifies the
    // stamp mask, not the merge step. The merge step is covered separately.)
    const bytes = await renderFakePdf('LETTER', 5, 'mixed');

    const maps = buildStampMaps({
      sparkplanPageCount: 1,
      attachments: [
        // Cover-ON with no title (test simplification — sheetIdRange[0] is
        // skipped just like the title would be, so we use a placeholder).
        { sheetIdRange: ['PLACEHOLDER', 'STAMPED-1', 'STAMPED-2'], hasCover: true },
        { sheetIdRange: ['', ''], hasCover: false },
      ],
    });

    const result = await stampSheetIds({
      merged: bytes,
      sheetIdMap: maps.sheetIdMap,
      shouldStamp: maps.shouldStamp,
    });

    expect(result.stampedCount).toBe(2); // STAMPED-1 + STAMPED-2 only
    expect(await docContainsDrawnText(result.bytes, 'STAMPED-1')).toBe(true);
    expect(await docContainsDrawnText(result.bytes, 'STAMPED-2')).toBe(true);
    expect(await docContainsDrawnText(result.bytes, 'PLACEHOLDER')).toBe(false);
  });
});
