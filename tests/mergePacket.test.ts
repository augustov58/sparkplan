/**
 * Sprint 2B PR-3 — mergePacket unit tests.
 *
 * Asserts:
 * 1. Output page count = sparkplan pages + sum(per-attachment(title + upload pages))
 * 2. SparkPlan portion comes first (sparkplanPageCount reflects truth)
 * 3. Uploaded pages retain their original dimensions (Letter + ARCH D mix)
 * 4. Title sheets match upload dimensions when the orchestrator supplies them
 * 5. Encrypted / zero-byte uploads surface as warnings — merge does NOT throw
 * 6. Empty attachment list still merges cleanly (just the SparkPlan portion)
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { pdf, Document, Page, Text } from '@react-pdf/renderer';
import { PDFDocument } from 'pdf-lib';
import { mergePacket, getFirstPageSize } from '../services/pdfExport/mergePacket';
import { AttachmentTitleSheet } from '../services/pdfExport/AttachmentTitleSheet';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Render a minimal multi-page react-pdf document with a fixed page size,
 * for use as a fake SparkPlan portion or fake upload.
 */
const renderFakePdf = async (
  pageSize: 'LETTER' | 'A4' | [number, number],
  pageCount: number,
  label = 'fake',
  orientation: 'portrait' | 'landscape' = 'portrait',
): Promise<Uint8Array> => {
  const pages = Array.from({ length: pageCount }, (_, i) =>
    React.createElement(
      Page,
      {
        size: pageSize as 'LETTER' | 'A4',
        orientation,
        key: i,
        style: { padding: 40 },
      },
      React.createElement(Text, null, `${label} page ${i + 1}`),
    ),
  );
  const blob = await pdf(
    React.createElement(Document, null, ...pages),
  ).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
};

const renderTitleSheet = async (
  sheetId: string,
  pageSize: [number, number],
): Promise<Uint8Array> => {
  const blob = await pdf(
    React.createElement(
      Document,
      null,
      React.createElement(AttachmentTitleSheet, {
        sheetId,
        artifactType: 'site_plan',
        projectName: 'Test Project',
        projectAddress: '123 Main',
        contractorName: 'Test Contractor',
        pageSize,
      }),
    ),
  ).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('mergePacket', () => {
  it('returns the SparkPlan portion alone when no attachments are provided', async () => {
    const sp = await renderFakePdf('LETTER', 5, 'spark');
    const result = await mergePacket(sp, []);
    expect(result.pageCount).toBe(5);
    expect(result.sparkplanPageCount).toBe(5);
    expect(result.mergedAttachmentCount).toBe(0);
    expect(result.warnings).toHaveLength(0);
    const merged = await PDFDocument.load(result.bytes);
    expect(merged.getPageCount()).toBe(5);
  });

  it('appends title sheet + upload pages in order', async () => {
    const sp = await renderFakePdf('LETTER', 3, 'spark');
    const upload1 = await renderFakePdf('LETTER', 2, 'site');
    const upload2 = await renderFakePdf('LETTER', 4, 'cutsheets');
    const ts1 = await renderTitleSheet('C-201', [612, 792]);
    const ts2 = await renderTitleSheet('X-201', [612, 792]);

    const result = await mergePacket(sp, [
      {
        label: 'site',
        titleSheetBytes: ts1,
        uploadBytes: upload1,
        sheetIdRange: ['C-201', 'C-202', 'C-203'],
      },
      {
        label: 'cutsheets',
        titleSheetBytes: ts2,
        uploadBytes: upload2,
        sheetIdRange: ['X-201', 'X-202', 'X-203', 'X-204', 'X-205'],
      },
    ]);

    // 3 sparkplan + (1 title + 2 upload) + (1 title + 4 upload) = 11
    expect(result.pageCount).toBe(11);
    expect(result.sparkplanPageCount).toBe(3);
    expect(result.mergedAttachmentCount).toBe(2);
    expect(result.warnings).toHaveLength(0);
  });

  it('preserves uploaded page dimensions — Letter + ARCH D mix', async () => {
    const sp = await renderFakePdf('LETTER', 1, 'spark');
    const letterUpload = await renderFakePdf('LETTER', 1, 'letter-up');
    // ARCH D = 1728 × 2592 pt. react-pdf accepts a [w,h] tuple.
    const archDUpload = await renderFakePdf([1728, 2592], 1, 'archd-up');
    const ts1 = await renderTitleSheet('C-201', [612, 792]);
    const ts2 = await renderTitleSheet('C-203', [1728, 2592]);

    const result = await mergePacket(sp, [
      {
        label: 'letter',
        titleSheetBytes: ts1,
        uploadBytes: letterUpload,
        sheetIdRange: ['C-201', 'C-202'],
      },
      {
        label: 'archd',
        titleSheetBytes: ts2,
        uploadBytes: archDUpload,
        sheetIdRange: ['C-203', 'C-204'],
      },
    ]);

    expect(result.pageCount).toBe(5); // 1 spark + 2 (letter title + page) + 2 (archd title + page)
    const merged = await PDFDocument.load(result.bytes);

    // Page indices: 0 = spark, 1 = letter title, 2 = letter upload page,
    //               3 = archd title, 4 = archd upload page
    const sparkPage = merged.getPage(0).getSize();
    expect(Math.round(sparkPage.width)).toBe(612);
    expect(Math.round(sparkPage.height)).toBe(792);

    const letterTitle = merged.getPage(1).getSize();
    expect(Math.round(letterTitle.width)).toBe(612);
    expect(Math.round(letterTitle.height)).toBe(792);

    const letterUploadPage = merged.getPage(2).getSize();
    expect(Math.round(letterUploadPage.width)).toBe(612);
    expect(Math.round(letterUploadPage.height)).toBe(792);

    const archDTitle = merged.getPage(3).getSize();
    expect(Math.round(archDTitle.width)).toBe(1728);
    expect(Math.round(archDTitle.height)).toBe(2592);

    const archDUploadPage = merged.getPage(4).getSize();
    expect(Math.round(archDUploadPage.width)).toBe(1728);
    expect(Math.round(archDUploadPage.height)).toBe(2592);
  });

  it('preserves orientation — Letter landscape upload stays landscape', async () => {
    const sp = await renderFakePdf('LETTER', 1, 'spark');
    const landscapeUpload = await renderFakePdf('LETTER', 1, 'land', 'landscape');
    const ts = await renderTitleSheet('C-201', [792, 612]);

    const result = await mergePacket(sp, [
      {
        label: 'landscape',
        titleSheetBytes: ts,
        uploadBytes: landscapeUpload,
        sheetIdRange: ['C-201', 'C-202'],
      },
    ]);

    const merged = await PDFDocument.load(result.bytes);
    const titlePage = merged.getPage(1).getSize();
    const uploadPage = merged.getPage(2).getSize();
    expect(titlePage.width).toBeGreaterThan(titlePage.height); // landscape
    expect(uploadPage.width).toBeGreaterThan(uploadPage.height); // landscape
  });

  it('surfaces a warning and skips a corrupted upload — does NOT throw', async () => {
    const sp = await renderFakePdf('LETTER', 2, 'spark');
    const ts = await renderTitleSheet('C-201', [612, 792]);
    const corrupted = new Uint8Array([0x00, 0x00, 0x00, 0x00]); // not a PDF

    const result = await mergePacket(sp, [
      {
        label: 'corrupted.pdf',
        titleSheetBytes: ts,
        uploadBytes: corrupted,
        sheetIdRange: ['C-201', 'C-202'],
      },
    ]);

    expect(result.pageCount).toBe(2); // just sparkplan
    expect(result.sparkplanPageCount).toBe(2);
    expect(result.mergedAttachmentCount).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('corrupted.pdf');
  });

  it('surfaces a warning and skips when the upload bytes are empty', async () => {
    const sp = await renderFakePdf('LETTER', 1, 'spark');
    const ts = await renderTitleSheet('C-201', [612, 792]);
    const empty = new Uint8Array(0);

    const result = await mergePacket(sp, [
      {
        label: 'empty.pdf',
        titleSheetBytes: ts,
        uploadBytes: empty,
        sheetIdRange: ['C-201'],
      },
    ]);

    expect(result.mergedAttachmentCount).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('empty.pdf');
  });

  // -------------------------------------------------------------------------
  // Cover-OFF (Sprint 2B PR-3 commit 8) — per-upload toggle. Pre-bordered
  // uploads (architect title block already on the drawing) skip the
  // SparkPlan title sheet entirely.
  // -------------------------------------------------------------------------

  it('appends an upload as-is when hasCover=false (no SparkPlan title sheet)', async () => {
    const sp = await renderFakePdf('LETTER', 2, 'spark');
    const upload = await renderFakePdf('LETTER', 3, 'arch-prepared');

    const result = await mergePacket(sp, [
      {
        label: 'A100.pdf',
        // titleSheetBytes is ignored when hasCover=false; pass an empty
        // Uint8Array to match the orchestrator's actual behavior.
        titleSheetBytes: new Uint8Array(0),
        uploadBytes: upload,
        // All blanks — orchestrator emits these so buildStampMaps marks
        // every upload page shouldStamp=false.
        sheetIdRange: ['', '', ''],
        hasCover: false,
      },
    ]);

    // 2 sparkplan + 3 upload = 5 (no title sheet inserted).
    expect(result.pageCount).toBe(5);
    expect(result.sparkplanPageCount).toBe(2);
    expect(result.mergedAttachmentCount).toBe(1);
    expect(result.warnings).toHaveLength(0);
  });

  it('mixes cover-ON and cover-OFF attachments in order', async () => {
    const sp = await renderFakePdf('LETTER', 1, 'spark');
    const coverOnUpload = await renderFakePdf('LETTER', 2, 'bare');
    const coverOffUpload = await renderFakePdf('LETTER', 4, 'archd');
    const ts = await renderTitleSheet('C-201', [612, 792]);

    const result = await mergePacket(sp, [
      {
        label: 'site-plan.pdf',
        titleSheetBytes: ts,
        uploadBytes: coverOnUpload,
        sheetIdRange: ['C-201', 'C-202', 'C-203'],
        hasCover: true,
      },
      {
        label: 'architect-A100.pdf',
        titleSheetBytes: new Uint8Array(0),
        uploadBytes: coverOffUpload,
        sheetIdRange: ['', '', '', ''],
        hasCover: false,
      },
    ]);

    // 1 spark + (1 title + 2 upload) + (4 upload, no title) = 8
    expect(result.pageCount).toBe(8);
    expect(result.sparkplanPageCount).toBe(1);
    expect(result.mergedAttachmentCount).toBe(2);
  });

  it('continues merging remaining attachments when one fails', async () => {
    const sp = await renderFakePdf('LETTER', 1, 'spark');
    const good = await renderFakePdf('LETTER', 2, 'good');
    const ts1 = await renderTitleSheet('C-201', [612, 792]);
    const ts2 = await renderTitleSheet('C-203', [612, 792]);
    const corrupted = new Uint8Array([0x00]);

    const result = await mergePacket(sp, [
      {
        label: 'bad.pdf',
        titleSheetBytes: ts1,
        uploadBytes: corrupted,
        sheetIdRange: ['C-201'],
      },
      {
        label: 'good.pdf',
        titleSheetBytes: ts2,
        uploadBytes: good,
        sheetIdRange: ['C-203', 'C-204', 'C-205'],
      },
    ]);

    // 1 spark + (skipped) + (1 title + 2 upload) = 4
    expect(result.pageCount).toBe(4);
    expect(result.mergedAttachmentCount).toBe(1);
    expect(result.warnings).toHaveLength(1);
  });
});

describe('getFirstPageSize', () => {
  it('returns [width, height] for a Letter portrait PDF', async () => {
    const bytes = await renderFakePdf('LETTER', 1, 'letter');
    const size = await getFirstPageSize(bytes);
    expect(size).not.toBeNull();
    expect(Math.round(size![0])).toBe(612);
    expect(Math.round(size![1])).toBe(792);
  });

  it('returns the swapped dimensions for landscape', async () => {
    const bytes = await renderFakePdf('LETTER', 1, 'land', 'landscape');
    const size = await getFirstPageSize(bytes);
    expect(size).not.toBeNull();
    expect(Math.round(size![0])).toBe(792);
    expect(Math.round(size![1])).toBe(612);
  });

  it('returns ARCH D dimensions', async () => {
    const bytes = await renderFakePdf([1728, 2592], 1, 'archd');
    const size = await getFirstPageSize(bytes);
    expect(size).not.toBeNull();
    expect(Math.round(size![0])).toBe(1728);
    expect(Math.round(size![1])).toBe(2592);
  });

  it('returns null for corrupted input', async () => {
    const corrupted = new Uint8Array([0x00, 0x00]);
    const size = await getFirstPageSize(corrupted);
    expect(size).toBeNull();
  });
});
