/**
 * One-shot regeneration of the full audit-packet PDF using the same fixture
 * the E2E test suite exercises. Writes two variants to example_reports/:
 *
 *   1. Default flow — uses the test fixture's `groundingSystem` DB row.
 *   2. M3-flow      — same fixture with `groundingSystem: undefined`, so the
 *                     grounding card derives a project-specific GEC + electrode
 *                     list from NEC Table 250.66 (the Sprint 2A PR 4 / M3 path).
 *
 * Run with: npx tsx scripts/generate-full-packet-fixture.ts
 *
 * Sprint 2A PR #40 + #41 — visual-inspection helper. Mirrors the exact code
 * path the "Download Permit Packet" button runs (see permitPacketE2E.test.ts).
 */

import { promises as fs } from 'fs';
import path from 'path';

import {
  generatePermitPacket,
  type PermitPacketData,
} from '../services/pdfExport/permitPacketGenerator';
import { fullPacket } from '../tests/fixtures/permitPacketFixture';

// ---------- DOM stubs (script runs in plain Node) ----------------------------

type CapturedDownload = {
  fileName: string;
  bytes: number;
  blob: Blob;
};

const downloads: CapturedDownload[] = [];

function installDomStubs() {
  (globalThis.URL as any).createObjectURL = () => 'blob:fake-url';
  (globalThis.URL as any).revokeObjectURL = () => {};

  // Capture the Blob the generator hands to URL.createObjectURL by
  // monkeypatching the global Blob constructor: every Blob built by
  // @react-pdf/renderer flows through this constructor, and we keep the
  // most-recently-built one as `__lastBlob` so the anchor click can grab it.
  const OriginalBlob = globalThis.Blob;
  (globalThis as any).Blob = class extends OriginalBlob {
    constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
      super(parts, options);
      (globalThis as any).__lastBlob = this;
    }
  };

  (globalThis as any).document = {
    createElement: (tag: string) => {
      const el: any = {
        tagName: tag.toUpperCase(),
        href: '',
        download: '',
        click: () => {
          downloads.push({
            fileName: el.download,
            bytes: (globalThis as any).__lastBlob?.size ?? 0,
            blob: (globalThis as any).__lastBlob,
          });
        },
        setAttribute: () => {},
      };
      return el;
    },
    body: {
      appendChild: () => {},
      removeChild: () => {},
    },
  };
}

async function generateAndSave(
  packet: PermitPacketData,
  outName: string,
): Promise<{ path: string; bytes: number }> {
  downloads.length = 0;
  await generatePermitPacket(packet);
  if (downloads.length !== 1) {
    throw new Error(
      `Expected 1 download, got ${downloads.length} (${downloads.map((d) => d.fileName).join(', ')})`,
    );
  }
  const dl = downloads[0];
  const buf = Buffer.from(await dl.blob.arrayBuffer());
  const outDir = path.resolve(process.cwd(), 'example_reports');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, outName);
  await fs.writeFile(outPath, buf);
  return { path: outPath, bytes: buf.length };
}

async function main() {
  installDomStubs();

  // Variant A: default flow (with the test fixture's groundingSystem DB row).
  // arcFlashData omitted to mirror the real React component's
  // hard-coded `arcFlashData: undefined` (the production-reachable flow).
  const variantA: PermitPacketData = { ...fullPacket, arcFlashData: undefined };
  const a = await generateAndSave(
    variantA,
    `Permit_Packet_Inspection_DefaultGrounding_${new Date().toISOString().slice(0, 10)}.pdf`,
  );
  console.log(`Variant A (default grounding): ${a.bytes.toLocaleString()} bytes → ${a.path}`);

  // Variant B: M3 derived-GEC path — no groundingSystem row, so the
  // GroundingPlanPages component must compute the GEC from NEC Table 250.66
  // using the service ampacity (audit fixture is 400A @ 480V).
  const variantB: PermitPacketData = {
    ...fullPacket,
    arcFlashData: undefined,
    groundingSystem: undefined,
  };
  const b = await generateAndSave(
    variantB,
    `Permit_Packet_Inspection_DerivedGEC_${new Date().toISOString().slice(0, 10)}.pdf`,
  );
  console.log(`Variant B (M3 derived GEC):    ${b.bytes.toLocaleString()} bytes → ${b.path}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
