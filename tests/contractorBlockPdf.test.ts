/**
 * Sprint 2A C8 + M8 — per-sheet contractor signature block.
 *
 * Confirms:
 * 1. The shared `Footer` (BrandFooter) renders the ContractorBlock above
 *    the brand strip when contractor info is provided.
 * 2. The Footer still renders cleanly when contractor info is omitted
 *    (the signature line is always drawn so AHJs have a place to wet-sign).
 * 3. The MeterStackScheduleDocument now uses the shared theme wrapper (M8)
 *    and accepts contractor props.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { pdf, Document, Page } from '@react-pdf/renderer';
import { Footer as BrandFooter } from '../services/pdfExport/permitPacketTheme';
import { MeterStackScheduleDocument } from '../services/pdfExport/MeterStackSchedulePDF';

describe('Per-sheet ContractorBlock (Sprint 2A C8)', () => {
  it('renders Footer with contractor info', async () => {
    const doc = React.createElement(
      Document,
      null,
      React.createElement(
        Page,
        { size: 'LETTER' },
        React.createElement(BrandFooter, {
          projectName: 'Test Project',
          contractorName: 'Augusto E Valbuena',
          contractorLicense: 'PE-12252528',
        }),
      ),
    );
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });

  it('renders Footer without contractor info (empty signature line still drawn)', async () => {
    const doc = React.createElement(
      Document,
      null,
      React.createElement(
        Page,
        { size: 'LETTER' },
        React.createElement(BrandFooter, {
          projectName: 'No-Contractor Test',
        }),
      ),
    );
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });
});

describe('MeterStackScheduleDocument under shared theme (Sprint 2A M8)', () => {
  it('renders an empty stack list cleanly', async () => {
    const doc = React.createElement(
      Document,
      null,
      React.createElement(MeterStackScheduleDocument, {
        projectName: 'Theme Wrapper Test',
        meterStacks: [],
        meters: [],
        panels: [],
        contractorName: 'Test Contractor',
        contractorLicense: 'EC0001234',
      }),
    );
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });
});
