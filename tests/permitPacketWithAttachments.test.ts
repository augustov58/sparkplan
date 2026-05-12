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
