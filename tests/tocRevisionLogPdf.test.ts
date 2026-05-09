/**
 * Sprint 2A H1 + H2 — TOC and Revision Log PDF render tests.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { pdf, Document } from '@react-pdf/renderer';
import {
  TableOfContentsPage,
  RevisionLogPage,
} from '../services/pdfExport/PermitPacketDocuments';

describe('TableOfContentsPage (Sprint 2A H1)', () => {
  it('renders with a small entry list', async () => {
    const doc = React.createElement(
      Document,
      null,
      React.createElement(TableOfContentsPage, {
        projectName: 'TOC Test',
        entries: [
          { sheetId: '002', title: 'Revision Log' },
          { sheetId: '003', title: 'General Notes' },
          { sheetId: '101', title: 'Load Calculation Summary' },
          { sheetId: '301', title: 'Panel Schedule — MDP' },
        ],
        contractorName: 'Test EC',
        contractorLicense: 'EC0001234',
        sheetId: '001',
      }),
    );
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });

  it('renders with an empty entry list (cover-only packet)', async () => {
    const doc = React.createElement(
      Document,
      null,
      React.createElement(TableOfContentsPage, {
        projectName: 'Empty TOC Test',
        entries: [],
      }),
    );
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });
});

describe('RevisionLogPage (Sprint 2A H2)', () => {
  it('auto-populates a Rev 0 row when no revisions are supplied', async () => {
    const doc = React.createElement(
      Document,
      null,
      React.createElement(RevisionLogPage, {
        projectName: 'Auto-Populate Test',
        contractorName: 'Augusto E Valbuena',
        contractorLicense: 'PE-12252528',
      }),
    );
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });

  it('renders explicit multi-revision history', async () => {
    const doc = React.createElement(
      Document,
      null,
      React.createElement(RevisionLogPage, {
        projectName: 'Multi-Rev Test',
        revisions: [
          {
            rev: 'Rev 0',
            date: '2026-04-15',
            description: 'Initial submittal',
            by: 'Test EC',
          },
          {
            rev: 'Rev 1',
            date: '2026-04-22',
            description: 'AHJ comments — corrected AIC rating on E-104, added EVEMS narrative',
            by: 'Test EC',
          },
          {
            rev: 'Rev 2',
            date: '2026-05-01',
            description: 'PE-sealed for 277/480V scope per Orlando AHJ',
            by: 'Augusto E Valbuena, PE',
          },
        ],
      }),
    );
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });
});
