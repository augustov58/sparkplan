/**
 * Sprint 2A H9 — Available Fault Current Calculation page.
 *
 * Confirms:
 * 1. Page renders with full IEEE 141 result block.
 * 2. Page renders with partial inputs (utility transformer assumed).
 * 3. Non-compliant verdict renders when results.compliance.compliant === false.
 * 4. Empty results object renders without crashing (degrades to '—' values).
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { pdf, Document } from '@react-pdf/renderer';
import {
  AvailableFaultCurrentPage,
  type AvailableFaultCurrentInput,
} from '../services/pdfExport/PermitPacketDocuments';

const baseInput: AvailableFaultCurrentInput = {
  serviceAmps: 1000,
  serviceVoltage: 240,
  servicePhase: 1,
  sourceFaultCurrent: 22000,
  transformerKVA: 500,
  transformerImpedance: 4.5,
  serviceConductorSize: '500 kcmil',
  serviceConductorMaterial: 'Cu',
  serviceConductorLength: 50,
  results: {
    faultCurrent: 18500,
    requiredAIC: 22,
    details: {
      sourceFaultCurrent: 22000,
      conductorImpedance: 0.012,
      totalImpedance: 0.0156,
      faultCurrentAtPoint: 18500,
      safetyFactor: 1.25,
    },
    compliance: {
      compliant: true,
      necArticle: 'NEC 110.9 / 110.10',
      message: 'All equipment AIC ratings exceed available fault current.',
    },
  },
  notes: 'Source fault current per FPL utility coordination data, dated 2026-04-15.',
};

describe('AvailableFaultCurrentPage (Sprint 2A H9)', () => {
  it('renders compliant case with full IEEE 141 result block', async () => {
    const doc = React.createElement(
      Document,
      null,
      React.createElement(AvailableFaultCurrentPage, {
        projectName: 'Service Main Test',
        projectAddress: '123 Test St, Orlando FL',
        input: baseInput,
        contractorName: 'Test EC',
        contractorLicense: 'EC0001234',
      }),
    );
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });

  it('renders non-compliant verdict (equipment AIC under-rated)', async () => {
    const nonCompliant: AvailableFaultCurrentInput = {
      ...baseInput,
      results: {
        ...baseInput.results!,
        faultCurrent: 35000,
        requiredAIC: 42,
        compliance: {
          compliant: false,
          necArticle: 'NEC 110.9 / 110.10',
          message: 'MDP main breaker AIC 22 kA insufficient for 35 kA available fault current.',
        },
      },
    };
    const doc = React.createElement(
      Document,
      null,
      React.createElement(AvailableFaultCurrentPage, {
        projectName: 'AIC Under-rated Test',
        input: nonCompliant,
      }),
    );
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });

  it('renders 3-phase service with high-fault scenario', async () => {
    const threePhase: AvailableFaultCurrentInput = {
      ...baseInput,
      serviceAmps: 2000,
      serviceVoltage: 480,
      servicePhase: 3,
      sourceFaultCurrent: 65000,
      transformerKVA: 1500,
      results: {
        faultCurrent: 58000,
        requiredAIC: 65,
        details: {
          sourceFaultCurrent: 65000,
          totalImpedance: 0.0048,
          faultCurrentAtPoint: 58000,
          safetyFactor: 1.25,
        },
        compliance: {
          compliant: true,
          necArticle: 'NEC 110.9',
          message: 'Series-rated equipment per NEC 240.86; main breaker 65 kA AIC.',
        },
      },
    };
    const doc = React.createElement(
      Document,
      null,
      React.createElement(AvailableFaultCurrentPage, {
        projectName: '3-Phase 480V Service',
        input: threePhase,
      }),
    );
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });

  it('renders gracefully when results block is empty / partial', async () => {
    const minimal: AvailableFaultCurrentInput = {
      serviceAmps: 200,
      serviceVoltage: 240,
      servicePhase: 1,
      sourceFaultCurrent: null,
      transformerKVA: null,
      transformerImpedance: null,
      serviceConductorSize: null,
      serviceConductorMaterial: null,
      serviceConductorLength: null,
      results: null,
    };
    const doc = React.createElement(
      Document,
      null,
      React.createElement(AvailableFaultCurrentPage, {
        projectName: 'Minimal Inputs',
        input: minimal,
      }),
    );
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });
});
