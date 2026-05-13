/**
 * Tests for useProjectAttachments hook (Sprint 2B PR-2).
 *
 * The hook itself is a React hook; without jsdom we can't render it. Instead,
 * we exercise:
 *   - The pure validator `validateAttachmentFile`
 *   - The pure path builder `buildStoragePath`
 *   - The pdf-lib page counter `countPdfPages` (creates a real PDF in-memory)
 *
 * The supabase mutations (upload + insert + delete) are covered by the
 * orchestrator's interactive verification step — RLS + Storage policies
 * can't be meaningfully simulated in node without a full Supabase mock that
 * would just retrace the mock setup.
 */

import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  validateAttachmentFile,
  buildStoragePath,
  countPdfPages,
  ARTIFACT_TYPES,
  STORAGE_BUCKET,
} from '../hooks/useProjectAttachments';

// Helper: synthesize a File from text content. The vitest/node environment
// has globalThis.File via undici.
function makeFile(name: string, type: string, sizeBytes: number): File {
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type });
}

describe('useProjectAttachments — validateAttachmentFile', () => {
  it('accepts a valid PDF under the size limit', () => {
    const file = makeFile('site-plan.pdf', 'application/pdf', 1024);
    expect(validateAttachmentFile(file, 25)).toBeNull();
  });

  it('accepts PDFs by extension when MIME is missing (scanner output)', () => {
    const file = makeFile('survey.pdf', '', 2048);
    expect(validateAttachmentFile(file, 25)).toBeNull();
  });

  it('rejects non-PDF files', () => {
    const png = makeFile('photo.png', 'image/png', 1024);
    expect(validateAttachmentFile(png, 25)).toEqual({ kind: 'invalid_type' });
  });

  it('rejects files larger than the configured size limit', () => {
    const oversized = makeFile('big.pdf', 'application/pdf', 30 * 1024 * 1024); // 30MB
    const result = validateAttachmentFile(oversized, 25);
    expect(result).toEqual({ kind: 'too_large', maxSizeMB: 25 });
  });

  it('size-limit is configurable per slot', () => {
    const file = makeFile('mid.pdf', 'application/pdf', 8 * 1024 * 1024);
    expect(validateAttachmentFile(file, 5)).toEqual({ kind: 'too_large', maxSizeMB: 5 });
    expect(validateAttachmentFile(file, 10)).toBeNull();
  });

  it('rejects files with valid extension but wrong MIME and no .pdf suffix', () => {
    const evil = makeFile('payload.exe', 'application/octet-stream', 100);
    expect(validateAttachmentFile(evil, 25)).toEqual({ kind: 'invalid_type' });
  });
});

describe('useProjectAttachments — buildStoragePath', () => {
  it('builds path with user_id / project_id / artifact_type prefix', () => {
    const path = buildStoragePath('user-1', 'proj-1', 'site_plan', 'plan.pdf');
    expect(path.startsWith('user-1/proj-1/site_plan/')).toBe(true);
    expect(path.endsWith('plan.pdf')).toBe(true);
  });

  it('prepends a timestamp before the filename to avoid collisions', () => {
    const a = buildStoragePath('u', 'p', 'cut_sheet', 'spec.pdf');
    // Sleep a millisecond is unreliable in tight loops; instead just match the
    // pattern: at least 10-digit timestamp + underscore.
    expect(a).toMatch(/^u\/p\/cut_sheet\/\d{10,}_spec\.pdf$/);
  });

  it('sanitizes path separators in filenames', () => {
    const path = buildStoragePath(
      'u',
      'p',
      'noc',
      'subdir/escape\\attempt.pdf',
    );
    // The artifact_type path segment is still 'noc' — no extra slashes leak in.
    const segments = path.split('/');
    expect(segments.length).toBe(4);
    expect(segments[2]).toBe('noc');
    expect(segments[3]).not.toContain('/');
    expect(segments[3]).not.toContain('\\');
  });
});

describe('useProjectAttachments — countPdfPages', () => {
  it('returns the page count of a valid PDF', async () => {
    // Build a real 3-page PDF in memory.
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.addPage();
    doc.addPage();
    const bytes = await doc.save();
    const file = new File([bytes], 'three.pdf', { type: 'application/pdf' });

    const count = await countPdfPages(file);
    expect(count).toBe(3);
  });

  it('returns null when the file is not a valid PDF', async () => {
    const file = new File(['not a pdf'], 'fake.pdf', { type: 'application/pdf' });
    const count = await countPdfPages(file);
    expect(count).toBeNull();
  });
});

describe('useProjectAttachments — module exports', () => {
  it('exposes the full ARTIFACT_TYPES enum matching the migration CHECK', () => {
    // Migration trail (any drift here = guaranteed RLS reject):
    //   PR-1 originals (7): site_plan, cut_sheet, fire_stopping, noc,
    //                       hoa_letter, survey, manufacturer_data
    //   PR-3 (H19):         hvhz_anchoring
    //   PR-4 (H21/H22/H25/H26/H30/H33): zoning_application,
    //                       fire_review_application, notarized_addendum,
    //                       property_ownership_search,
    //                       flood_elevation_certificate,
    //                       private_provider_documentation
    expect([...ARTIFACT_TYPES].sort()).toEqual(
      [
        'cut_sheet',
        'fire_review_application',
        'fire_stopping',
        'flood_elevation_certificate',
        'hoa_letter',
        'hvhz_anchoring',
        'manufacturer_data',
        'noc',
        'notarized_addendum',
        'private_provider_documentation',
        'property_ownership_search',
        'site_plan',
        'survey',
        'zoning_application',
      ].sort(),
    );
  });

  it('uses the permit-attachments storage bucket', () => {
    expect(STORAGE_BUCKET).toBe('permit-attachments');
  });
});
