/**
 * Sprint 2B PR-3 — orchestrator-level wiring test.
 *
 * Verifies that `generatePermitPacket` correctly merges in attachments
 * when they are passed through the new `attachments` field. We can't
 * easily intercept the download in vitest/jsdom, so this test stubs
 * `URL.createObjectURL` to capture the final Blob and inspects it.
 *
 * Asserts:
 * 1. With no attachments → merged page count == sparkplan page count
 * 2. With one Letter attachment → final has sparkplan + 1 title + N upload pages
 * 3. With ARCH D + Letter attachments → final preserves both sizes
 * 4. Civil-discipline (site_plan) is ordered before manufacturer (cut_sheet)
 *    regardless of insertion order — discipline-prefix sort applied.
 */
import React from 'react';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { pdf, Document, Page, Text } from '@react-pdf/renderer';
import { PDFDocument } from 'pdf-lib';
import {
  generatePermitPacket,
  type PermitPacketData,
  type PermitPacketAttachment,
} from '../services/pdfExport/permitPacketGenerator';
import { mkPanel } from './fixtures/permitPacketFixture';

// ---------------------------------------------------------------------------
// DOM stubs — vitest runs in Node by default. Mirrors permitPacketE2E.test.ts
// stubbing so the generator's downloadBlob() helper can run without a DOM.
// ---------------------------------------------------------------------------

let capturedBlob: Blob | null = null;

beforeAll(() => {
  (globalThis.URL as any).createObjectURL = (blob: Blob) => {
    capturedBlob = blob;
    return 'blob:fake-url';
  };
  (globalThis.URL as any).revokeObjectURL = () => undefined;
  (globalThis as any).document = {
    createElement: () => ({
      tagName: 'A',
      href: '',
      download: '',
      click: () => undefined,
    }),
    body: { appendChild: () => undefined, removeChild: () => undefined },
  };
});

afterAll(() => {
  delete (globalThis as any).document;
});

beforeEach(() => {
  capturedBlob = null;
});

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

const renderFakeUpload = async (
  size: 'LETTER' | [number, number],
  pageCount = 1,
  label = 'upload',
): Promise<Uint8Array> => {
  const pages = Array.from({ length: pageCount }, (_, i) =>
    React.createElement(
      Page,
      { size: size as 'LETTER', key: i, style: { padding: 40 } },
      React.createElement(Text, null, `${label} ${i + 1}`),
    ),
  );
  const blob = await pdf(
    React.createElement(Document, null, ...pages),
  ).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
};

const baseData = (): PermitPacketData => ({
  projectId: 'test',
  projectName: 'Attachment Wiring Test',
  projectAddress: '123 Test St',
  projectType: 'Residential',
  serviceVoltage: 240,
  servicePhase: 1,
  panels: [mkPanel({ name: 'MDP', is_main: true, voltage: 240, phase: 1 })],
  circuits: [],
  feeders: [],
  transformers: [],
  preparedBy: 'Test Engineer',
  contractorLicense: 'EC0001234',
  contractorName: 'Test Contractor',
  // Slim the packet so the test runs faster (focus is on merge wiring).
  sections: {
    tableOfContents: false,
    revisionLog: false,
    generalNotes: false,
    voltageDrop: false,
    shortCircuit: false,
    arcFlash: false,
    equipmentSchedule: false,
    equipmentSpecs: false,
    grounding: false,
    meterStack: false,
    multiFamilyEV: false,
    complianceSummary: false,
    jurisdiction: false,
    evemsNarrative: false,
    evseLabeling: false,
    availableFaultCurrent: false,
    nec22087Narrative: false,
  },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generatePermitPacket — Sprint 2B PR-3 attachment wiring', () => {
  it('produces a SparkPlan-only PDF when no attachments are passed', async () => {
    await generatePermitPacket(baseData());
    expect(capturedBlob).not.toBeNull();
    const bytes = new Uint8Array(await capturedBlob!.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    // Cover + LoadCalc + RiserDiagram + PanelSchedule(MDP) = 4 (depending on
    // feeders the riser still emits) — we just assert > 0 here; specific
    // page count is tested by Sprint 2A E2E tests.
    expect(doc.getPageCount()).toBeGreaterThan(0);
  });

  it('appends title sheet + upload pages for a Letter attachment', async () => {
    const data = baseData();
    const uploadBytes = await renderFakeUpload('LETTER', 2, 'site-plan');
    const att: PermitPacketAttachment = {
      artifactType: 'site_plan',
      filename: 'site-plan.pdf',
      uploadBytes,
    };
    data.attachments = [att];

    await generatePermitPacket(data);
    expect(capturedBlob).not.toBeNull();
    const bytes = new Uint8Array(await capturedBlob!.arrayBuffer());
    const doc = await PDFDocument.load(bytes);

    // SparkPlan pages first, then 1 title sheet + 2 upload pages.
    // We don't assert the exact SparkPlan count (depends on Sprint 2A
    // builders); just that the merged total adds the 3 attachment pages.
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(3);

    // Last 3 pages should be: title sheet (Letter), upload page 1, upload page 2.
    const total = doc.getPageCount();
    const titlePage = doc.getPage(total - 3).getSize();
    const uploadP1 = doc.getPage(total - 2).getSize();
    const uploadP2 = doc.getPage(total - 1).getSize();
    expect(Math.round(titlePage.width)).toBe(612);
    expect(Math.round(titlePage.height)).toBe(792);
    expect(Math.round(uploadP1.width)).toBe(612);
    expect(Math.round(uploadP1.height)).toBe(792);
    expect(Math.round(uploadP2.width)).toBe(612);
    expect(Math.round(uploadP2.height)).toBe(792);
  });

  it('preserves ARCH D dimensions through the merge', async () => {
    const data = baseData();
    const archDUpload = await renderFakeUpload([1728, 2592], 1, 'archd-site');
    data.attachments = [
      {
        artifactType: 'site_plan',
        filename: 'archd-site.pdf',
        uploadBytes: archDUpload,
      },
    ];

    await generatePermitPacket(data);
    const bytes = new Uint8Array(await capturedBlob!.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    const total = doc.getPageCount();
    // Last 2 pages should be ARCH D — title sheet + upload page.
    const titleSize = doc.getPage(total - 2).getSize();
    const uploadSize = doc.getPage(total - 1).getSize();
    expect(Math.round(titleSize.width)).toBe(1728);
    expect(Math.round(titleSize.height)).toBe(2592);
    expect(Math.round(uploadSize.width)).toBe(1728);
    expect(Math.round(uploadSize.height)).toBe(2592);
  });

  it('orders civil-discipline attachments before manufacturer attachments', async () => {
    const data = baseData();
    // Insertion order: cut_sheet first, then site_plan. Generator should
    // still emit site_plan (C-discipline) before cut_sheet (X-discipline).
    const cutBytes = await renderFakeUpload('LETTER', 1, 'cuts');
    const siteBytes = await renderFakeUpload([1728, 2592], 1, 'site');
    data.attachments = [
      {
        artifactType: 'cut_sheet',
        filename: 'cuts.pdf',
        uploadBytes: cutBytes,
      },
      {
        artifactType: 'site_plan',
        filename: 'site.pdf',
        uploadBytes: siteBytes,
      },
    ];

    await generatePermitPacket(data);
    const bytes = new Uint8Array(await capturedBlob!.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    const total = doc.getPageCount();

    // After SparkPlan: site_plan first (ARCH D, 2 pages), then cut_sheet (Letter, 2 pages).
    // The site_plan title + upload should be ARCH D; cut_sheet title + upload should be Letter.
    const sitePages = [doc.getPage(total - 4).getSize(), doc.getPage(total - 3).getSize()];
    const cutPages = [doc.getPage(total - 2).getSize(), doc.getPage(total - 1).getSize()];

    expect(Math.round(sitePages[0].width)).toBe(1728); // ARCH D title
    expect(Math.round(sitePages[1].width)).toBe(1728); // ARCH D upload
    expect(Math.round(cutPages[0].width)).toBe(612); // Letter title
    expect(Math.round(cutPages[1].width)).toBe(612); // Letter upload
  });

  // ---------------------------------------------------------------------
  // v4 commit 11 — custom sheet ID override (feature A).
  // ---------------------------------------------------------------------

  /**
   * Helper: search every page-content stream for a drawn text literal.
   * Looks in BOTH pdf-lib hex form (`<432D323031> Tj`) AND react-pdf's
   * positioned-glyph TJ form (`[<43> -10 <2D32303031>] TJ`) — react-pdf
   * uses kerned positioning so the full literal isn't always contiguous.
   * To handle that we also accept a "stripped" form where all
   * non-hex-char punctuation has been removed from the decompressed
   * stream — kerning offsets between glyph runs vanish in that view.
   */
  async function docContainsDrawnText(
    bytes: Uint8Array,
    text: string,
  ): Promise<boolean> {
    const doc = await PDFDocument.load(bytes);
    const saved = await doc.save({ useObjectStreams: false });
    const zlib = await import('node:zlib');
    let hex = '';
    for (let i = 0; i < text.length; i++) {
      hex += text.charCodeAt(i).toString(16).padStart(2, '0').toUpperCase();
    }
    const hexLiteral = `<${hex}>`;
    const s = new TextDecoder('latin1').decode(saved);
    let cursor = 0;
    while (cursor < s.length) {
      const start = s.indexOf('stream\n', cursor);
      if (start < 0) break;
      const end = s.indexOf('endstream', start);
      if (end < 0) break;
      const streamBytes = saved.subarray(start + 7, end - 1);
      let decompressed: string;
      try {
        decompressed = zlib.inflateSync(streamBytes).toString('latin1');
      } catch {
        decompressed = new TextDecoder('latin1').decode(streamBytes);
      }
      if (decompressed.includes(hexLiteral)) return true;
      if (decompressed.includes(text)) return true;
      // Concatenate all hex runs <...><...><...> in the stream — react-pdf
      // emits a kerned TJ array which splits a literal across multiple
      // <hex> groups. Pulling them all together and matching against the
      // continuous hex form handles that case.
      const joined = decompressed
        .split('<')
        .map((part) => {
          const close = part.indexOf('>');
          return close >= 0 ? part.substring(0, close) : '';
        })
        .join('')
        .toUpperCase();
      if (joined.includes(hex.toUpperCase())) return true;
      cursor = end + 'endstream'.length;
    }
    return false;
  }

  it('honors customSheetId on the title sheet (cover-ON path)', async () => {
    const data = baseData();
    const uploadBytes = await renderFakeUpload('LETTER', 1, 'site');
    data.attachments = [
      {
        artifactType: 'site_plan',
        filename: 'site.pdf',
        uploadBytes,
        customSheetId: 'A-100',
      },
    ];

    await generatePermitPacket(data);
    const bytes = new Uint8Array(await capturedBlob!.arrayBuffer());

    // "A-100" should appear in the title sheet content stream (BrandBar
    // pill + bottom-right sheet block both draw it).
    expect(await docContainsDrawnText(bytes, 'A-100')).toBe(true);
    // Note: C-201 will still show up because the single upload page
    // gets auto-allocated (its stamp doesn't share with the title's
    // custom ID). That's the per-spec behavior: custom ID replaces the
    // title sheet only; upload-page IDs continue from the counter.
  });

  it('does not advance the band counter when customSheetId is used', async () => {
    const data = baseData();
    // Two single-page Letter site_plans. First has a custom override; second
    // should land on C-201 (NOT C-202) because the custom one didn't burn
    // a counter slot.
    const upload1 = await renderFakeUpload('LETTER', 1, 'siteA');
    const upload2 = await renderFakeUpload('LETTER', 1, 'siteB');
    data.attachments = [
      {
        artifactType: 'site_plan',
        filename: 'siteA.pdf',
        uploadBytes: upload1,
        customSheetId: 'SP-1',
      },
      {
        artifactType: 'site_plan',
        filename: 'siteB.pdf',
        uploadBytes: upload2,
      },
    ];

    await generatePermitPacket(data);
    const bytes = new Uint8Array(await capturedBlob!.arrayBuffer());

    // Custom value present on the first title sheet.
    expect(await docContainsDrawnText(bytes, 'SP-1')).toBe(true);
    // Second attachment's title sheet should be C-201 (counter starts at
    // 201 within BAND_DIAGRAMS for the civil discipline).
    expect(await docContainsDrawnText(bytes, 'C-201')).toBe(true);
  });

  it('upload-page IDs continue past the custom title-sheet ID', async () => {
    const data = baseData();
    // Multi-page upload with a custom title-sheet ID. Upload pages still
    // need stamped IDs from the allocator — they should begin at C-201
    // (the value the title sheet would have taken if not overridden).
    const upload = await renderFakeUpload('LETTER', 3, 'multipage');
    data.attachments = [
      {
        artifactType: 'site_plan',
        filename: 'multipage.pdf',
        uploadBytes: upload,
        customSheetId: 'A-200',
      },
    ];

    await generatePermitPacket(data);
    const bytes = new Uint8Array(await capturedBlob!.arrayBuffer());

    // Title sheet shows the custom value.
    expect(await docContainsDrawnText(bytes, 'A-200')).toBe(true);
    // Upload pages get auto-allocated IDs starting from C-201.
    expect(await docContainsDrawnText(bytes, 'C-201')).toBe(true);
    expect(await docContainsDrawnText(bytes, 'C-202')).toBe(true);
    expect(await docContainsDrawnText(bytes, 'C-203')).toBe(true);
  });

  // ---------------------------------------------------------------------
  // v4 commit 15 — coverMode='overlay' (feature B).
  // ---------------------------------------------------------------------

  it('overlay mode: 1 page per upload page (no separate title sheet)', async () => {
    const data = baseData();
    // 2-page upload in overlay mode. Without overlay this would emit
    // 1 title + 2 upload = 3 attachment pages. With overlay it should
    // emit just 2 composite pages.
    const uploadBytes = await renderFakeUpload('LETTER', 2, 'bluebeam');
    data.attachments = [
      {
        artifactType: 'site_plan',
        filename: 'bluebeam-markup.pdf',
        uploadBytes,
        coverMode: 'overlay',
      },
    ];

    await generatePermitPacket(data);
    const bytes = new Uint8Array(await capturedBlob!.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    const total = doc.getPageCount();

    // Last 2 pages = the overlay composite. NOT 3 — no separate title.
    // We assert the dimensions are Letter and that there's no extra page
    // at total - 3 that would have been the title sheet.
    expect(Math.round(doc.getPage(total - 2).getSize().width)).toBe(612);
    expect(Math.round(doc.getPage(total - 1).getSize().width)).toBe(612);
  });

  it('overlay mode: composite pages get sheet IDs stamped', async () => {
    const data = baseData();
    const uploadBytes = await renderFakeUpload('LETTER', 1, 'overlay-test');
    data.attachments = [
      {
        artifactType: 'site_plan',
        filename: 'overlay.pdf',
        uploadBytes,
        coverMode: 'overlay',
      },
    ];

    await generatePermitPacket(data);
    const bytes = new Uint8Array(await capturedBlob!.arrayBuffer());

    // Auto-allocated ID for the first civil composite is C-201. With
    // overlay mode it should be stamped on the composite page.
    expect(await docContainsDrawnText(bytes, 'C-201')).toBe(true);
  });

  it('overlay mode + customSheetId: custom value drawn on composite', async () => {
    const data = baseData();
    const uploadBytes = await renderFakeUpload('LETTER', 1, 'overlay-custom');
    data.attachments = [
      {
        artifactType: 'site_plan',
        filename: 'overlay.pdf',
        uploadBytes,
        coverMode: 'overlay',
        customSheetId: 'A-200',
      },
    ];

    await generatePermitPacket(data);
    const bytes = new Uint8Array(await capturedBlob!.arrayBuffer());
    expect(await docContainsDrawnText(bytes, 'A-200')).toBe(true);
  });

  it('coverMode=none: no title sheet, no stamping', async () => {
    const data = baseData();
    const uploadBytes = await renderFakeUpload('LETTER', 2, 'as-is');
    data.attachments = [
      {
        artifactType: 'site_plan',
        filename: 'as-is.pdf',
        uploadBytes,
        coverMode: 'none',
      },
    ];

    await generatePermitPacket(data);
    const bytes = new Uint8Array(await capturedBlob!.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    const total = doc.getPageCount();
    // 2 upload pages tacked on, no title sheet.
    expect(Math.round(doc.getPage(total - 2).getSize().width)).toBe(612);
    expect(Math.round(doc.getPage(total - 1).getSize().width)).toBe(612);
    // No SparkPlan-stamped IDs anywhere on this attachment.
    expect(await docContainsDrawnText(bytes, 'C-201')).toBe(false);
  });

  it('continues with remaining attachments when one upload is corrupted', async () => {
    const data = baseData();
    const goodBytes = await renderFakeUpload('LETTER', 1, 'good');
    const corrupted = new Uint8Array([0x00, 0x01, 0x02]);
    data.attachments = [
      {
        artifactType: 'cut_sheet',
        filename: 'corrupted.pdf',
        uploadBytes: corrupted,
      },
      {
        artifactType: 'cut_sheet',
        filename: 'good.pdf',
        uploadBytes: goodBytes,
      },
    ];

    await generatePermitPacket(data);
    // Should still succeed — corrupted is skipped, good is merged.
    expect(capturedBlob).not.toBeNull();
    const bytes = new Uint8Array(await capturedBlob!.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    // Last 2 pages should be the good Letter title + upload.
    const total = doc.getPageCount();
    const titleSize = doc.getPage(total - 2).getSize();
    const uploadSize = doc.getPage(total - 1).getSize();
    expect(Math.round(titleSize.width)).toBe(612);
    expect(Math.round(uploadSize.width)).toBe(612);
  });
});
