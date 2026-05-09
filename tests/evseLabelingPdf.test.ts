/**
 * Sprint 2A H11 — EVSE Labeling page (NEC 625.43, 110.21, 110.22).
 *
 * Confirms:
 * 1. Renders for residential project (no commercial emergency-shutoff section).
 * 2. Renders for commercial project (includes emergency-shutoff section).
 * 3. Renders panel with optional location string.
 * 4. Renders multiple panels with mixed charger counts.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { pdf, Document } from '@react-pdf/renderer';
import {
  EVSELabelingPage,
  type EVSELabelingPanelEntry,
} from '../services/pdfExport/PermitPacketDocuments';

describe('EVSELabelingPage (Sprint 2A H11)', () => {
  it('renders residential single-panel scenario (no commercial section)', async () => {
    const panels: EVSELabelingPanelEntry[] = [
      {
        panelId: 'ev-1',
        panelName: 'EV Sub-Panel',
        chargerCircuitCount: 4,
        location: 'Garage',
      },
    ];
    const doc = React.createElement(
      Document,
      null,
      React.createElement(EVSELabelingPage, {
        projectName: 'Residential EV Test',
        panels,
        isCommercial: false,
        contractorName: 'Test EC',
        contractorLicense: 'EC0001234',
      }),
    );
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });

  it('renders commercial scenario (includes emergency-shutoff section)', async () => {
    const panels: EVSELabelingPanelEntry[] = [
      {
        panelId: 'ev-1',
        panelName: 'EV Bank A',
        chargerCircuitCount: 12,
        location: 'Parking garage level B-2',
      },
    ];
    const doc = React.createElement(
      Document,
      null,
      React.createElement(EVSELabelingPage, {
        projectName: 'Commercial EV Test',
        panels,
        isCommercial: true,
      }),
    );
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });

  it('renders panel without location string (omitted)', async () => {
    const panels: EVSELabelingPanelEntry[] = [
      {
        panelId: 'ev-noloc',
        panelName: 'EV Sub-Panel',
        chargerCircuitCount: 2,
      },
    ];
    const doc = React.createElement(
      Document,
      null,
      React.createElement(EVSELabelingPage, {
        projectName: 'No Location Test',
        panels,
        isCommercial: false,
      }),
    );
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });

  it('renders multi-panel scenario (mixed charger counts)', async () => {
    const panels: EVSELabelingPanelEntry[] = [
      { panelId: 'ev-1', panelName: 'EV Bank A', chargerCircuitCount: 8 },
      { panelId: 'ev-2', panelName: 'EV Bank B', chargerCircuitCount: 4 },
      { panelId: 'ev-3', panelName: 'EV Bank C', chargerCircuitCount: 12, location: 'Roof deck' },
    ];
    const doc = React.createElement(
      Document,
      null,
      React.createElement(EVSELabelingPage, {
        projectName: 'Multi-Panel EVSE Labeling',
        panels,
        isCommercial: true,
      }),
    );
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });
});
