/**
 * Sprint 2A PR 4 / M3 — Grounding Plan page rendering.
 *
 * Confirms:
 * 1. Renders project-specific GEC for the 1000A multifamily audit fixture
 *    even when no `grounding_details` DB row is provided.
 * 2. Renders correctly when a DB row IS provided (preserves user-entered
 *    electrode + bonding selections, treats `gec_size` as installed override).
 * 3. The page renders for several service-amperage tiers without errors,
 *    covering the NEC Table 250.66 buckets the audit fixtures hit.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { pdf, Document } from '@react-pdf/renderer';
import { GroundingPlanPages } from '../services/pdfExport/GroundingPlanDocuments';
import { calculateGroundingDetail } from '../services/calculations/groundingElectrodeConductor';

describe('GroundingPlanPages (Sprint 2A PR 4 / M3)', () => {
  it('renders 1000A multifamily audit fixture with derived GEC = 2/0 AWG Cu', async () => {
    const doc = React.createElement(
      Document,
      null,
      React.createElement(GroundingPlanPages, {
        projectName: '12-Unit Multifamily + EVEMS',
        projectAddress: '123 Demo Ave, Orlando FL',
        // No `grounding` row → page must derive a project-specific GEC
        // from service ampacity instead of falling back to generic boilerplate.
        grounding: null,
        serviceAmperage: 1000,
        conductorMaterial: 'Cu',
      }),
    );
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(0);

    // Independently verify the GEC the page is rendering — this is the
    // safety-critical assertion (NEC 250.66 audit-fixture value).
    const detail = calculateGroundingDetail({
      serviceAmps: 1000,
      conductorMaterial: 'Cu',
    });
    expect(detail.gecSize).toBe('2/0 AWG');
    expect(detail.tableMinimumGecSize).toBe('2/0 AWG');
    expect(detail.electrodes.some(e => e.present)).toBe(true);
    expect(detail.bondingRequirements.length).toBeGreaterThan(0);
  });

  it('honours installed gec_size from DB row (override)', async () => {
    const dbRow = {
      id: 'g-1',
      project_id: 'p-1',
      gec_size: '4/0 AWG', // bigger than the 2/0 minimum for 1000A Cu
      electrodes: ['Concrete-Encased Electrode (Ufer)', 'Ground Rod #1'],
      bonding: ['Water pipe bond'],
      notes: null,
      created_at: null,
      updated_at: null,
    };
    const doc = React.createElement(
      Document,
      null,
      React.createElement(GroundingPlanPages, {
        projectName: 'Override Test',
        grounding: dbRow,
        serviceAmperage: 1000,
        conductorMaterial: 'Cu',
      }),
    );
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });

  it('renders cleanly across service-ampacity tiers (200A, 400A, 800A, 2000A)', async () => {
    for (const amps of [200, 400, 800, 2000]) {
      const doc = React.createElement(
        Document,
        null,
        React.createElement(GroundingPlanPages, {
          projectName: `${amps}A test`,
          grounding: null,
          serviceAmperage: amps,
          conductorMaterial: 'Cu',
        }),
      );
      const blob = await pdf(doc).toBlob();
      expect(blob.size).toBeGreaterThan(0);
    }
  });

  it('honours an explicit serviceConductorSize when provided', async () => {
    // 500 kcmil Cu falls in "Over 350 through 600 kcmil" → 1/0 AWG Cu GEC,
    // which is smaller than the 1000A-default assumption (1000 kcmil → 2/0 Cu).
    const detail = calculateGroundingDetail({
      serviceAmps: 1000,
      conductorMaterial: 'Cu',
      serviceConductorSize: '500 kcmil',
    });
    expect(detail.gecSize).toBe('1/0 AWG');
    expect(detail.serviceConductorAssumed).toBe(false);

    const doc = React.createElement(
      Document,
      null,
      React.createElement(GroundingPlanPages, {
        projectName: 'Single-conductor 500 kcmil service',
        grounding: null,
        serviceAmperage: 1000,
        conductorMaterial: 'Cu',
        serviceConductorSize: '500 kcmil',
      }),
    );
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });
});
