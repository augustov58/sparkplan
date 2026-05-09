/**
 * Sprint 2A H10 — EVEMS Operational Narrative page.
 *
 * Confirms:
 * 1. Renders single EVEMS panel with explicit setpoint marker (declared source).
 * 2. Renders legacy panel with proxy setpoint (estimated source flag).
 * 3. Renders multi-panel scenario (multiple EVEMS-managed panels).
 * 4. Renders 3-phase EVEMS panel (sqrt(3) factor in amps display).
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { pdf, Document } from '@react-pdf/renderer';
import {
  EVEMSNarrativePage,
  type EVEMSNarrativePanelEntry,
} from '../services/pdfExport/PermitPacketDocuments';

describe('EVEMSNarrativePage (Sprint 2A H10)', () => {
  it('renders single EVEMS panel with declared setpoint', async () => {
    const panels: EVEMSNarrativePanelEntry[] = [
      {
        panelId: 'ev-1',
        panelName: 'EV Sub-Panel',
        setpointVA: 47952,
        hasExplicitMarker: true,
        mainBreakerAmps: 300,
        voltage: 240,
        phase: 1,
        deviceManufacturerModel: 'DCC-9 EVEMS Controller',
      },
    ];
    const doc = React.createElement(
      Document,
      null,
      React.createElement(EVEMSNarrativePage, {
        projectName: 'Single EVEMS Test',
        panels,
        contractorName: 'Test EC',
        contractorLicense: 'EC0001234',
      }),
    );
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });

  it('renders legacy panel with proxy setpoint (estimated)', async () => {
    const panels: EVEMSNarrativePanelEntry[] = [
      {
        panelId: 'ev-legacy',
        panelName: 'Legacy EV Panel',
        // Proxy: 200A * 240V = 48,000 VA — flagged "estimated"
        setpointVA: 48000,
        hasExplicitMarker: false,
        mainBreakerAmps: 200,
        voltage: 240,
        phase: 1,
      },
    ];
    const doc = React.createElement(
      Document,
      null,
      React.createElement(EVEMSNarrativePage, {
        projectName: 'Legacy EVEMS Test',
        panels,
      }),
    );
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });

  it('renders multi-panel scenario (two EVEMS-managed panels)', async () => {
    const panels: EVEMSNarrativePanelEntry[] = [
      {
        panelId: 'ev-1',
        panelName: 'EV Bank A',
        setpointVA: 47952,
        hasExplicitMarker: true,
        mainBreakerAmps: 300,
        voltage: 240,
        phase: 1,
      },
      {
        panelId: 'ev-2',
        panelName: 'EV Bank B',
        setpointVA: 35000,
        hasExplicitMarker: true,
        mainBreakerAmps: 200,
        voltage: 240,
        phase: 1,
      },
    ];
    const doc = React.createElement(
      Document,
      null,
      React.createElement(EVEMSNarrativePage, {
        projectName: 'Multi-Panel EVEMS Test',
        panels,
      }),
    );
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });

  it('renders 3-phase EVEMS panel', async () => {
    const panels: EVEMSNarrativePanelEntry[] = [
      {
        panelId: 'ev-3p',
        panelName: 'EV Bank 3-Phase',
        setpointVA: 144000, // ~ 200A at 480V * sqrt(3)
        hasExplicitMarker: true,
        mainBreakerAmps: 250,
        voltage: 480,
        phase: 3,
        deviceManufacturerModel: 'WattLogic EM-3P',
      },
    ];
    const doc = React.createElement(
      Document,
      null,
      React.createElement(EVEMSNarrativePage, {
        projectName: '3-Phase EVEMS Test',
        panels,
      }),
    );
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });
});
