/**
 * Reproduce the VoltageDrop PDF render failure in a Node environment so we get
 * full non-minified stack traces. Delete this file once the bug is fixed.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { pdf, Document } from '@react-pdf/renderer';
import { VoltageDropDocument, VoltageDropPages } from '../services/pdfExport/VoltageDropDocuments';

// Minimal feeder/panel/transformer shapes. The fields that matter are the ones
// the component actually reads in calculateAllFeederVoltageDrops + render.
const mkFeeder = (overrides: Partial<any> = {}): any => ({
  id: 'f1',
  name: 'F-1',
  source_panel_id: 'p1',
  destination_panel_id: 'p2',
  destination_transformer_id: null,
  conductor_material: 'Cu',
  distance_ft: 100,
  total_load_va: 24000,
  ...overrides,
});

const mkPanel = (overrides: Partial<any> = {}): any => ({
  id: 'p1',
  name: 'MDP',
  voltage: 240,
  phase: 1,
  ...overrides,
});

describe('VoltageDropDocument renders in Node', () => {
  it('renders standalone', async () => {
    const feeders = [mkFeeder()];
    const panels = [mkPanel({ id: 'p1', name: 'MDP' }), mkPanel({ id: 'p2', name: 'H1' })];
    const blob = await pdf(
      React.createElement(VoltageDropDocument, {
        projectName: 'Test Project',
        projectAddress: '123 Main St',
        feeders,
        panels,
        transformers: [],
        includeNECReferences: true,
      })
    ).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });

  it('renders VoltageDropPages embedded in a Document', async () => {
    const feeders = [mkFeeder()];
    const panels = [mkPanel({ id: 'p1', name: 'MDP' }), mkPanel({ id: 'p2', name: 'H1' })];
    const doc = React.createElement(
      Document,
      null,
      React.createElement(VoltageDropPages, {
        projectName: 'Test Project',
        projectAddress: '123 Main St',
        feeders,
        panels,
        transformers: [],
        includeNECReferences: true,
      })
    );
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });

  it('renders with no feeders', async () => {
    const blob = await pdf(
      React.createElement(VoltageDropDocument, {
        projectName: 'Test Project',
        feeders: [],
        panels: [],
        transformers: [],
        includeNECReferences: true,
      })
    ).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });

  it('renders with non-compliant feeder (triggers WarningsSection)', async () => {
    const feeders = [mkFeeder({ distance_ft: 2000, total_load_va: 100000 })];
    const panels = [mkPanel({ id: 'p1', name: 'MDP' }), mkPanel({ id: 'p2', name: 'Far' })];
    const blob = await pdf(
      React.createElement(VoltageDropDocument, {
        projectName: 'Test Project',
        feeders,
        panels,
        transformers: [],
        includeNECReferences: true,
      })
    ).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });
});
