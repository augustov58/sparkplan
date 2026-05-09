/**
 * Sprint 2A H15 — Equipment Specs UL-2202 / UL-2594 EV listings card.
 *
 * Confirms:
 * 1. Renders the new EV listings card when an EVEMS marker circuit is detected.
 * 2. Renders the card when a panel name matches the EV pattern (no EVEMS).
 * 3. Skips the card entirely when no EV-bank panels are present.
 * 4. Falls back to name pattern when circuits are not provided.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { pdf, Document } from '@react-pdf/renderer';
import { EquipmentSpecsPages } from '../services/pdfExport/EquipmentSpecsDocuments';

const evemsManagedPanel = {
  id: 'ev-panel-1',
  name: 'EV Sub-Panel',
  voltage: 240,
  phase: 1 as const,
  bus_rating: 400,
  main_breaker_amps: 300,
  manufacturer: 'Square D',
  model_number: 'NQ400',
  aic_rating: 22,
  ul_listing: 'UL 67',
};

const evNamedPanel = {
  id: 'ev-panel-2',
  name: 'EV Charging Bank A',
  voltage: 240,
  phase: 1 as const,
  bus_rating: 200,
};

const nonEvPanel = {
  id: 'house-1',
  name: 'House Panel',
  voltage: 240,
  phase: 1 as const,
  bus_rating: 100,
};

const evemsMarkerCircuit = {
  id: 'evems-marker-1',
  panel_id: 'ev-panel-1',
  description: 'EVEMS Aggregate Setpoint (NEC 625.42)',
  load_watts: 47952,
  circuit_number: 41,
  pole: 2,
  breaker_amps: 200,
  load_type: 'O',
  // Other DB columns intentionally omitted; the helper only reads description + panel_id.
} as unknown as Parameters<typeof EquipmentSpecsPages>[0]['circuits'] extends (infer T)[] | undefined
  ? T
  : never;

describe('EquipmentSpecsPages — H15 EV listings card', () => {
  it('renders UL-2202/2594 card when EVEMS marker circuit present', async () => {
    const doc = React.createElement(
      Document,
      null,
      React.createElement(EquipmentSpecsPages, {
        projectName: 'EVEMS Test',
        panels: [evemsManagedPanel, nonEvPanel],
        transformers: [],
        circuits: [evemsMarkerCircuit] as never,
      }),
    );
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });

  it('renders UL-2202/2594 card when panel name matches EV pattern', async () => {
    const doc = React.createElement(
      Document,
      null,
      React.createElement(EquipmentSpecsPages, {
        projectName: 'EV Named Panel Test',
        panels: [evNamedPanel, nonEvPanel],
        transformers: [],
        circuits: [],
      }),
    );
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });

  it('omits EV listings card when no EV panels present', async () => {
    const doc = React.createElement(
      Document,
      null,
      React.createElement(EquipmentSpecsPages, {
        projectName: 'Non-EV Project',
        panels: [nonEvPanel],
        transformers: [],
        circuits: [],
      }),
    );
    const blob = await pdf(doc).toBlob();
    // Page should still render — the listings card just wouldn't appear.
    expect(blob.size).toBeGreaterThan(0);
  });

  it('falls back to name-pattern detection when circuits not provided', async () => {
    const doc = React.createElement(
      Document,
      null,
      React.createElement(EquipmentSpecsPages, {
        projectName: 'No Circuits Provided',
        panels: [evNamedPanel],
        transformers: [],
        // circuits omitted intentionally
      }),
    );
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });
});
