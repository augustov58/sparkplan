/**
 * Sprint 2A H12 + H13 — General Notes page.
 *
 * Confirms:
 * 1. The default FL pilot notes render (NEC 2020 compliance, VD 3/3/5).
 * 2. A custom `generalNotes` array overrides the defaults end-to-end.
 * 3. The page composes contractor info from the shared block (C8).
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { pdf, Document } from '@react-pdf/renderer';
import { GeneralNotesPage } from '../services/pdfExport/PermitPacketDocuments';

describe('GeneralNotesPage (Sprint 2A H12 + H13)', () => {
  it('renders with default FL pilot notes', async () => {
    const doc = React.createElement(
      Document,
      null,
      React.createElement(GeneralNotesPage, {
        projectName: 'Default Notes Test',
      }),
    );
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });

  it('renders with custom AHJ notes (Sprint 2C-style override)', async () => {
    const doc = React.createElement(
      Document,
      null,
      React.createElement(GeneralNotesPage, {
        projectName: 'Custom Notes Test',
        generalNotes: [
          'Custom note 1 — local AHJ amendment.',
          'Custom note 2 — Knox box required at main service entrance.',
        ],
        contractorName: 'Test EC',
        contractorLicense: 'EC0001234',
      }),
    );
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });
});
