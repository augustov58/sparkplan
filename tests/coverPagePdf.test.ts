/**
 * Node reproduction for the redesigned CoverPage. Confirms the themed
 * page renders without runtime errors. Delete once the full permit-packet
 * theme rollout is complete.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { pdf, Document } from '@react-pdf/renderer';
import { CoverPage } from '../services/pdfExport/PermitPacketDocuments';

describe('CoverPage (themed) renders in Node', () => {
  it('renders minimal props', async () => {
    const doc = React.createElement(
      Document,
      null,
      React.createElement(CoverPage, {
        projectName: 'Test Project',
        projectAddress: '123 Main St',
        projectType: 'Commercial',
        serviceVoltage: 480,
        servicePhase: 3,
      })
    );
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });

  it('renders with all optional fields populated', async () => {
    const doc = React.createElement(
      Document,
      null,
      React.createElement(CoverPage, {
        projectName: 'Commercial Building (Test)',
        projectAddress: '456 Example Ave, Miami FL',
        projectType: 'Commercial',
        serviceVoltage: 480,
        servicePhase: 3,
        preparedBy: 'Augusto E Valbuena',
        permitNumber: 'P-2026-0042',
        contractorLicense: '12252528',
        scopeOfWork: 'New 400A service with 9 sub-panels and 5 transformers.',
        serviceType: 'overhead',
        meterLocation: 'Exterior north wall',
        serviceConductorRouting: 'Underground from utility pole to service entrance',
      })
    );
    const blob = await pdf(doc).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });
});
