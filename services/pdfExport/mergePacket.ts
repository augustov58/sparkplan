/**
 * mergePacket — Sprint 2B PR-3
 *
 * Pure function (no DB, no hooks, no side effects) that merges:
 *   1. The SparkPlan-generated electrical portion of a permit packet
 *   2. A SparkPlan-themed title sheet per uploaded artifact
 *   3. The user's uploaded PDF for each artifact
 *
 * into a single output `Uint8Array`. This is the architectural foundation
 * the merge engine sits on; sheet ID stamping is a separate pass
 * (see `stampSheetIds.ts`) so each concern is independently testable.
 *
 * ## Inputs
 *
 * - `sparkplanBytes`: the react-pdf-rendered electrical packet portion.
 *   Sheet IDs on these pages are already stamped in-place by react-pdf
 *   (Sprint 2A H3 BrandBar pills).
 *
 * - `attachments`: ordered list of user uploads. Each entry carries:
 *     * `titleSheetBytes`: the SparkPlan title sheet rendered for this
 *       upload (from `AttachmentTitleSheet` + `pdf().toBlob()`). Must
 *       already be size-matched to the upload's first page.
 *     * `uploadBytes`: the user's PDF as-uploaded to Supabase Storage.
 *     * `sheetIdRange`: the sheet IDs assigned to the title sheet
 *       (entry 0) and each page of the upload (entries 1..N). Used
 *       downstream by `stampSheetIds()`. This module only logs the
 *       allocations for diagnostics; the actual stamping is the next
 *       pipeline pass.
 *
 * ## Determinism
 *
 * Attachment order is preserved in the merged output. Pages within each
 * upload are preserved in the order pdf-lib exposes them (which is the
 * original visual order — pdf-lib's `getPageIndices()` returns them in
 * the same order Adobe Reader displays them).
 *
 * ## Never throws on bad inputs
 *
 * Per CLAUDE.md "Calculation Service Rules" — calculation services never
 * throw. The merge service is a pure-function module of the same shape;
 * if an upload fails to load (encrypted, corrupted, etc.), we surface a
 * warning in the returned result and skip that attachment instead of
 * propagating an exception. Callers decide how to present warnings.
 *
 * The return type is therefore `MergePacketResult`, not a bare `Uint8Array`.
 *
 * ## Why pdf-lib (not jsPDF, not PDFKit, not server-side)
 *
 * - Same library Sprint 3 will use for PAdES PE seal digital signatures.
 *   One dependency for two sprints.
 * - Pure JS, no native deps — browser-safe.
 * - Handles `copyPages()` cleanly across mixed page sizes (ARCH D + Letter
 *   in the same document), which is the size-aware behavior PR-3 needs.
 */

import { PDFDocument } from 'pdf-lib';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Single attachment in the merge pipeline. The orchestrator builds one of
 * these per user-uploaded artifact before calling `mergePacket`.
 */
export interface AttachmentInput {
  /**
   * Display name — surfaced only in warning messages (e.g., "Failed to
   * load equipment-cut-sheet-v2.pdf"). Not embedded in the PDF.
   */
  label: string;

  /**
   * SparkPlan-themed title sheet rendered via `AttachmentTitleSheet` +
   * react-pdf. Always exactly one page (per AttachmentTitleSheet contract).
   */
  titleSheetBytes: Uint8Array;

  /**
   * The user's uploaded PDF bytes — fetched from Supabase Storage by the
   * orchestrator (we don't fetch from the React layer because that would
   * break the "pure function" contract).
   */
  uploadBytes: Uint8Array;

  /**
   * Sheet IDs assigned to this attachment's pages, ordered:
   *   [0]      → title sheet ID (e.g., "C-201")
   *   [1..N]   → IDs for upload page 1, 2, ..., N (e.g., "C-202", "C-203")
   *
   * Not used during merge — the merge pass concatenates pages, the stamp
   * pass writes the IDs onto those pages. Carried here so the orchestrator
   * has a single contract object to pass through both passes.
   */
  sheetIdRange: string[];
}

export interface MergePacketResult {
  /** Final merged PDF bytes. Always present — even if every attachment failed. */
  bytes: Uint8Array;

  /**
   * Page count of the merged document. Useful for the orchestrator to
   * compute which pages belong to which discipline post-merge.
   */
  pageCount: number;

  /**
   * Page count of the SparkPlan-generated portion (always at the start of
   * the merged output). Used by `stampSheetIds()` to know which pages to
   * skip (already stamped by react-pdf vs. need new stamping).
   */
  sparkplanPageCount: number;

  /**
   * Number of attachments successfully merged. May be less than the input
   * length if any attachment failed to load.
   */
  mergedAttachmentCount: number;

  /**
   * Non-fatal issues encountered during merge. Examples:
   * - "Could not load attachment 'permit-x.pdf': encrypted"
   * - "Skipped attachment 'survey-old.pdf': zero-byte upload"
   *
   * Caller decides how to present these (toast, banner, log). The merged
   * output still includes everything that succeeded.
   */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Load a PDF defensively. Returns null on any failure so the caller can
 * gracefully skip the attachment instead of aborting the whole merge.
 */
async function safeLoad(
  bytes: Uint8Array,
): Promise<PDFDocument | null> {
  try {
    return await PDFDocument.load(bytes, {
      // User uploads come from anything (Bluebeam, Adobe, scanned, etc.) —
      // be as lenient as we can. Encrypted PDFs without owner password
      // typically still parse with this flag; encrypted-with-password
      // PDFs will fail and we'll surface a warning.
      ignoreEncryption: true,
      throwOnInvalidObject: false,
    });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Merge the SparkPlan electrical portion with each uploaded artifact's
 * title sheet + the upload itself. Pure function — no DB, no hooks, no
 * side effects.
 *
 * @example
 *   const result = await mergePacket(sparkplanBytes, [
 *     {
 *       label: 'site_plan.pdf',
 *       titleSheetBytes: siteTitleSheetBytes,
 *       uploadBytes: sitePlanBytes,
 *       sheetIdRange: ['C-201', 'C-202'],
 *     },
 *   ]);
 *   if (result.warnings.length > 0) showBanner(result.warnings.join('; '));
 *   downloadBlob(new Blob([result.bytes], { type: 'application/pdf' }));
 */
export async function mergePacket(
  sparkplanBytes: Uint8Array,
  attachments: AttachmentInput[],
): Promise<MergePacketResult> {
  const warnings: string[] = [];

  // Output document.
  const out = await PDFDocument.create();

  // -----------------------------------------------------------------------
  // SparkPlan portion — always present, always first.
  // -----------------------------------------------------------------------
  let sparkplanPageCount = 0;
  const sparkplan = await safeLoad(sparkplanBytes);
  if (!sparkplan) {
    // This is the only "hard" failure mode — without the SparkPlan portion
    // there's nothing to merge. Even so, return a result with a warning
    // and zero pages rather than throwing (per the no-throw contract).
    warnings.push(
      'SparkPlan electrical portion failed to load — merged output is empty.',
    );
  } else {
    const sparkplanPages = await out.copyPages(
      sparkplan,
      sparkplan.getPageIndices(),
    );
    sparkplanPages.forEach((p) => out.addPage(p));
    sparkplanPageCount = sparkplanPages.length;
  }

  // -----------------------------------------------------------------------
  // Each attachment: title sheet first, then the upload pages.
  // -----------------------------------------------------------------------
  let mergedAttachmentCount = 0;

  for (const att of attachments) {
    const titleDoc = await safeLoad(att.titleSheetBytes);
    if (!titleDoc) {
      warnings.push(
        `Skipped attachment '${att.label}': could not generate title sheet.`,
      );
      continue;
    }
    const uploadDoc = await safeLoad(att.uploadBytes);
    if (!uploadDoc) {
      warnings.push(
        `Skipped attachment '${att.label}': could not load uploaded PDF (encrypted or corrupted).`,
      );
      continue;
    }
    if (uploadDoc.getPageCount() === 0) {
      warnings.push(
        `Skipped attachment '${att.label}': uploaded PDF has zero pages.`,
      );
      continue;
    }

    // Copy + append title sheet (always exactly 1 page by AttachmentTitleSheet's contract).
    const titlePages = await out.copyPages(titleDoc, [0]);
    titlePages.forEach((p) => out.addPage(p));

    // Copy + append every page of the upload, preserving original dimensions.
    const uploadPages = await out.copyPages(uploadDoc, uploadDoc.getPageIndices());
    uploadPages.forEach((p) => out.addPage(p));

    mergedAttachmentCount += 1;
  }

  const bytes = await out.save();

  return {
    bytes,
    pageCount: out.getPageCount(),
    sparkplanPageCount,
    mergedAttachmentCount,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Utilities (exported for orchestrator use + testing)
// ---------------------------------------------------------------------------

/**
 * Inspect the first page of a PDF and return its dimensions in PDF points.
 * The orchestrator uses this to size each title sheet to match its upload.
 *
 * Returns null on parse failure so the orchestrator can fall back to
 * Letter portrait (the most common case — 80-90% of pilot uploads).
 */
export async function getFirstPageSize(
  bytes: Uint8Array,
): Promise<[number, number] | null> {
  const doc = await safeLoad(bytes);
  if (!doc || doc.getPageCount() === 0) return null;
  const { width, height } = doc.getPage(0).getSize();
  return [width, height];
}
