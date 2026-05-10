/**
 * One-shot regeneration of the grounding-page audit fixture.
 *
 * Renders the GroundingPlanPages component for a 1000A multifamily
 * service with no DB grounding row, so the page must derive a project-
 * specific GEC + electrode list from NEC Table 250.66. Writes the
 * resulting one-page PDF to example_reports/.
 *
 * Run with: npx tsx scripts/generate-grounding-fixture.ts
 *
 * Sprint 2A PR 4 / M3 — fixture regenerator.
 */

import React from 'react';
import { promises as fs } from 'fs';
import path from 'path';
import { pdf, Document } from '@react-pdf/renderer';
import { GroundingPlanPages } from '../services/pdfExport/GroundingPlanDocuments';

async function main() {
  const doc = React.createElement(
    Document,
    null,
    React.createElement(GroundingPlanPages, {
      projectName: '12-Unit Multifamily + EVEMS (audit fixture)',
      projectAddress: '123 Demo Ave, Orlando FL',
      grounding: null,
      serviceAmperage: 1000,
      conductorMaterial: 'Cu',
      contractorName: 'SparkPlan Demo EC',
      contractorLicense: 'EC-0001234',
      sheetId: 'E-204',
    }),
  );

  const blob = await pdf(doc).toBlob();
  const buf = Buffer.from(await blob.arrayBuffer());
  const outDir = path.resolve(process.cwd(), 'example_reports');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(
    outDir,
    `Grounding_Plan_Audit_Fixture_${new Date().toISOString().slice(0, 10)}.pdf`,
  );
  await fs.writeFile(outPath, buf);
  console.log(`Wrote ${buf.length} bytes → ${outPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
