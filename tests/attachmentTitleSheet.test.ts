/**
 * Sprint 2B PR-3 — AttachmentTitleSheet behavioral contract.
 *
 * The title sheet is the SparkPlan-themed cover page that precedes every
 * user-uploaded artifact in the merged permit packet. These tests assert:
 *
 * 1. The component renders without throwing for every ArtifactType.
 * 2. Size-aware rendering — Letter, Letter landscape, ARCH D (24x36).
 * 3. The page actually picks up the requested size (assert via pdf-lib
 *    on the rendered output).
 * 4. The bound sheet ID is one page exactly (no overflow).
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { pdf, Document } from '@react-pdf/renderer';
import { PDFDocument } from 'pdf-lib';
import {
  AttachmentTitleSheet,
  ARTIFACT_DISPLAY_TITLES,
} from '../services/pdfExport/AttachmentTitleSheet';
import type { ArtifactType } from '../hooks/useProjectAttachments';

const renderToBytes = async (
  el: React.ReactElement,
): Promise<Uint8Array> => {
  const blob = await pdf(React.createElement(Document, null, el)).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
};

const baseProps = {
  sheetId: 'C-201',
  artifactType: 'site_plan' as ArtifactType,
  projectName: 'Test Project',
  projectAddress: '123 Main St, Orlando FL 32801',
  contractorName: 'Augusto E Valbuena',
  contractorLicense: 'PE-12252528',
};

describe('AttachmentTitleSheet', () => {
  it('renders without throwing for default Letter portrait', async () => {
    const bytes = await renderToBytes(
      React.createElement(AttachmentTitleSheet, baseProps),
    );
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it('emits exactly one page', async () => {
    const bytes = await renderToBytes(
      React.createElement(AttachmentTitleSheet, baseProps),
    );
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it('matches the requested page dimensions — Letter portrait', async () => {
    const bytes = await renderToBytes(
      React.createElement(AttachmentTitleSheet, {
        ...baseProps,
        pageSize: [612, 792],
      }),
    );
    const doc = await PDFDocument.load(bytes);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(612);
    expect(Math.round(height)).toBe(792);
  });

  it('matches the requested page dimensions — Letter landscape', async () => {
    const bytes = await renderToBytes(
      React.createElement(AttachmentTitleSheet, {
        ...baseProps,
        pageSize: [792, 612],
      }),
    );
    const doc = await PDFDocument.load(bytes);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(792);
    expect(Math.round(height)).toBe(612);
  });

  it('matches the requested page dimensions — ARCH D 24x36 portrait', async () => {
    // ARCH D = 24 × 36 inches = 1728 × 2592 pt at 72 DPI.
    const bytes = await renderToBytes(
      React.createElement(AttachmentTitleSheet, {
        ...baseProps,
        pageSize: [1728, 2592],
      }),
    );
    const doc = await PDFDocument.load(bytes);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(1728);
    expect(Math.round(height)).toBe(2592);
    expect(doc.getPageCount()).toBe(1);
  });

  it('matches the requested page dimensions — ARCH D landscape', async () => {
    const bytes = await renderToBytes(
      React.createElement(AttachmentTitleSheet, {
        ...baseProps,
        pageSize: [2592, 1728],
      }),
    );
    const doc = await PDFDocument.load(bytes);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(2592);
    expect(Math.round(height)).toBe(1728);
    expect(doc.getPageCount()).toBe(1);
  });

  it('renders for every ArtifactType', async () => {
    const types: ArtifactType[] = [
      'site_plan',
      'cut_sheet',
      'fire_stopping',
      'noc',
      'hoa_letter',
      'survey',
      'manufacturer_data',
      'hvhz_anchoring',
    ];
    for (const t of types) {
      const bytes = await renderToBytes(
        React.createElement(AttachmentTitleSheet, {
          ...baseProps,
          artifactType: t,
          sheetId: t === 'site_plan' || t === 'survey' || t === 'hvhz_anchoring'
            ? 'C-201'
            : 'X-201',
        }),
      );
      const doc = await PDFDocument.load(bytes);
      expect(doc.getPageCount(), `${t} should render exactly one page`).toBe(1);
    }
  });

  it('exposes a display title for every ArtifactType', () => {
    const types: ArtifactType[] = [
      'site_plan',
      'cut_sheet',
      'fire_stopping',
      'noc',
      'hoa_letter',
      'survey',
      'manufacturer_data',
      'hvhz_anchoring',
    ];
    for (const t of types) {
      expect(ARTIFACT_DISPLAY_TITLES[t]).toBeTruthy();
      expect(typeof ARTIFACT_DISPLAY_TITLES[t]).toBe('string');
    }
  });

  it('renders when optional fields (license, address, permit number) are omitted', async () => {
    const bytes = await renderToBytes(
      React.createElement(AttachmentTitleSheet, {
        sheetId: 'C-201',
        artifactType: 'site_plan',
        projectName: 'Minimal Test',
      }),
    );
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });
});
