/**
 * Sprint 2B PR-3 v4 — compositeTitleBlock unit tests.
 *
 * compositeTitleBlock is a pure function that uses pdf-lib's embedPdf +
 * drawPage to overlay a SparkPlan title-block-only PDF on top of every
 * page of a contractor's upload. Asserts:
 *
 * 1. Letter + Letter title block → output has same page count as upload.
 * 2. ARCH D upload + ARCH D title block → output preserves ARCH D dims.
 * 3. Multi-page upload → title block applied to every page.
 * 4. Mixed-size upload (Letter + ARCH D in one upload) produces a
 *    warning about per-page scaling, doesn't throw.
 * 5. Corrupted upload → result.composited = false, warning surfaced,
 *    function does NOT throw.
 * 6. Corrupted title block → falls back to upload pass-through, warning.
 *
 * To verify the title block actually ended up ON the upload page, we
 * inspect the page's content stream for a `Do` operator (XObject draw),
 * which is what pdf-lib emits when `page.drawPage(embeddedPage, ...)`
 * runs.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { pdf, Document, Page, Text } from '@react-pdf/renderer';
import { PDFDocument } from 'pdf-lib';
import { compositeTitleBlock } from '../services/pdfExport/compositeTitleBlock';
import { AttachmentTitleBlock } from '../services/pdfExport/AttachmentTitleBlock';

const renderFakeUpload = async (
  size: 'LETTER' | [number, number],
  pageCount: number,
  label = 'upload',
  orientation: 'portrait' | 'landscape' = 'portrait',
): Promise<Uint8Array> => {
  const pages = Array.from({ length: pageCount }, (_, i) =>
    React.createElement(
      Page,
      {
        size: size as 'LETTER',
        orientation,
        key: i,
        style: { padding: 40 },
      },
      React.createElement(Text, null, `${label} ${i + 1}`),
    ),
  );
  const blob = await pdf(
    React.createElement(Document, null, ...pages),
  ).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
};

const renderTitleBlock = async (
  sheetId: string,
  pageSize: [number, number],
): Promise<Uint8Array> => {
  const blob = await pdf(
    React.createElement(
      Document,
      null,
      React.createElement(AttachmentTitleBlock, {
        sheetId,
        artifactType: 'site_plan',
        projectName: 'Composite Test',
        projectAddress: '123 Test Ave',
        contractorName: 'Test Contractor',
        pageSize,
      }),
    ),
  ).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
};

/**
 * Count `Do` operators in all page-content streams. `Do` is what pdf-lib
 * emits when drawing an embedded page XObject. Multiple `Do` ops per
 * page is fine — we just want to assert >= 1.
 */
async function countDoOps(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes);
  const saved = await doc.save({ useObjectStreams: false });
  const zlib = await import('node:zlib');
  const s = new TextDecoder('latin1').decode(saved);
  let cursor = 0;
  let total = 0;
  while (cursor < s.length) {
    const start = s.indexOf('stream\n', cursor);
    if (start < 0) break;
    const end = s.indexOf('endstream', start);
    if (end < 0) break;
    const streamBytes = saved.subarray(start + 7, end - 1);
    let body: string;
    try {
      body = zlib.inflateSync(streamBytes).toString('latin1');
    } catch {
      body = new TextDecoder('latin1').decode(streamBytes);
    }
    // Match `/Name Do` where Name typically looks like /X1, /Im0, or
    // /EmbeddedPdfPage-12345 (pdf-lib's embedPdf names include hyphens
    // and digits — so the name char class must allow them).
    const matches = body.match(/\/[A-Za-z][\w-]*\s+Do(?=\s|$)/g);
    if (matches) total += matches.length;
    cursor = end + 'endstream'.length;
  }
  return total;
}

describe('compositeTitleBlock', () => {
  it('composites a Letter title block onto a single-page Letter upload', async () => {
    const upload = await renderFakeUpload('LETTER', 1, 'site');
    const titleBlock = await renderTitleBlock('A-100', [612, 792]);

    const result = await compositeTitleBlock({
      uploadBytes: upload,
      titleBlockBytes: titleBlock,
      sheetId: 'A-100',
      label: 'site.pdf',
    });

    expect(result.composited).toBe(true);
    expect(result.pageCount).toBe(1);
    expect(result.warnings).toHaveLength(0);

    // Reload + verify page count + page size preserved.
    const out = await PDFDocument.load(result.composedPdf);
    expect(out.getPageCount()).toBe(1);
    const { width, height } = out.getPage(0).getSize();
    expect(Math.round(width)).toBe(612);
    expect(Math.round(height)).toBe(792);

    // Confirm a `Do` operator was emitted (i.e., the title block XObject
    // is actually painted on the page).
    expect(await countDoOps(result.composedPdf)).toBeGreaterThanOrEqual(1);
  });

  it('preserves ARCH D dimensions when both inputs are ARCH D', async () => {
    const upload = await renderFakeUpload([1728, 2592], 1, 'archd-site');
    const titleBlock = await renderTitleBlock('C-201', [1728, 2592]);

    const result = await compositeTitleBlock({
      uploadBytes: upload,
      titleBlockBytes: titleBlock,
      sheetId: 'C-201',
      label: 'archd-site.pdf',
    });

    expect(result.composited).toBe(true);
    expect(result.warnings).toHaveLength(0);

    const out = await PDFDocument.load(result.composedPdf);
    const { width, height } = out.getPage(0).getSize();
    expect(Math.round(width)).toBe(1728);
    expect(Math.round(height)).toBe(2592);
  });

  it('paints the title block on every page of a multi-page upload', async () => {
    const upload = await renderFakeUpload('LETTER', 5, 'multi');
    const titleBlock = await renderTitleBlock('X-300', [612, 792]);

    const result = await compositeTitleBlock({
      uploadBytes: upload,
      titleBlockBytes: titleBlock,
      sheetId: 'X-300',
      label: 'multi.pdf',
    });

    expect(result.composited).toBe(true);
    expect(result.pageCount).toBe(5);
    expect(result.warnings).toHaveLength(0);

    // Each page must contain at least one `Do` op (the title block draw).
    const doOps = await countDoOps(result.composedPdf);
    expect(doOps).toBeGreaterThanOrEqual(5);
  });

  it('emits a scaling warning when the upload has mixed page sizes', async () => {
    // Build a 2-page upload with one Letter + one ARCH D page (rare but
    // possible from scanners that batch pages from different originals).
    const letterUpload = await renderFakeUpload('LETTER', 1, 'ltr');
    const archDUpload = await renderFakeUpload([1728, 2592], 1, 'archd');
    const mixed = await PDFDocument.create();
    const ltrDoc = await PDFDocument.load(letterUpload);
    const archDDoc = await PDFDocument.load(archDUpload);
    const ltrPages = await mixed.copyPages(ltrDoc, [0]);
    ltrPages.forEach((p) => mixed.addPage(p));
    const archDPages = await mixed.copyPages(archDDoc, [0]);
    archDPages.forEach((p) => mixed.addPage(p));
    const mixedBytes = await mixed.save();

    // Title block sized to Letter (orchestrator uses first-page dims).
    const titleBlock = await renderTitleBlock('C-201', [612, 792]);

    const result = await compositeTitleBlock({
      uploadBytes: mixedBytes,
      titleBlockBytes: titleBlock,
      sheetId: 'C-201',
      label: 'mixed.pdf',
    });

    expect(result.composited).toBe(true);
    expect(result.pageCount).toBe(2);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.join(' ')).toMatch(/scaled to fit/);
  });

  it('returns a warning + pass-through bytes when the upload is corrupted', async () => {
    const corrupted = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const titleBlock = await renderTitleBlock('C-201', [612, 792]);

    const result = await compositeTitleBlock({
      uploadBytes: corrupted,
      titleBlockBytes: titleBlock,
      sheetId: 'C-201',
      label: 'corrupted.pdf',
    });

    expect(result.composited).toBe(false);
    expect(result.pageCount).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('corrupted.pdf');
    // Caller can still pass the original bytes downstream — pass-through.
    expect(result.composedPdf).toBe(corrupted);
  });

  it('returns a warning + pass-through bytes when the title block is corrupted', async () => {
    const upload = await renderFakeUpload('LETTER', 2, 'good');
    const corruptedTitleBlock = new Uint8Array([0x00, 0x00]);

    const result = await compositeTitleBlock({
      uploadBytes: upload,
      titleBlockBytes: corruptedTitleBlock,
      sheetId: 'C-201',
      label: 'good.pdf',
    });

    expect(result.composited).toBe(false);
    expect(result.pageCount).toBe(2);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/title block/i);
  });

  it('does NOT throw on any input shape — pure function contract', async () => {
    // Two empty Uint8Arrays — both inputs invalid simultaneously.
    const empty = new Uint8Array(0);
    const result = await compositeTitleBlock({
      uploadBytes: empty,
      titleBlockBytes: empty,
      sheetId: 'X',
      label: 'empty.pdf',
    });
    expect(result.composited).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
