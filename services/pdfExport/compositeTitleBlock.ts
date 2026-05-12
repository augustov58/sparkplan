/**
 * compositeTitleBlock — Sprint 2B PR-3 v4
 *
 * Pure function that composites a SparkPlan-rendered title-block-only PDF
 * (from `AttachmentTitleBlock` + react-pdf) ON TOP of each page of a
 * contractor's uploaded PDF.
 *
 * Used by the overlay cover mode: instead of inserting a separate title
 * sheet preceding the upload (the `separate` mode), the orchestrator
 * pre-composites the title block onto the upload itself so the result is
 * a single sheet with the contractor's drawing in the middle and the
 * SparkPlan title block wrapping it. This matches the architectural
 * plan-set convention where a single sheet carries both the drawing and
 * its title block.
 *
 * ## Why a separate pure function
 *
 * Same architectural reason `mergePacket` and `stampSheetIds` are separate
 * — each pipeline stage has one job and is independently testable.
 * `compositeTitleBlock` runs BEFORE `mergePacket` (the orchestrator
 * pre-composites overlay uploads then hands the composite bytes to
 * mergePacket as the "uploadBytes" with no separate title-sheet).
 *
 * ## Never throws
 *
 * Per CLAUDE.md "Calculation Service Rules". Corrupted inputs surface as
 * warnings in the returned result; the caller falls back to the cover-OFF
 * (`none`) path if compositing failed.
 *
 * ## Why pdf-lib's embedPdf + drawPage
 *
 * `embedPdf()` produces an XObject reference to the source page; `drawPage`
 * paints that XObject at arbitrary coordinates on a destination page. The
 * destination page's existing pixel content stays untouched outside the
 * drawn region — and inside the region, the embedded page's transparent
 * areas (alpha=0) let the underlying content show through (per
 * AttachmentTitleBlock's transparent-bg contract).
 *
 * If the upload is N pages, we embed the title block once and draw it on
 * every upload page (saves storage + render time).
 */

import { PDFDocument } from 'pdf-lib';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompositeInput {
  /**
   * The contractor's uploaded PDF (bytes from Supabase Storage). Each page
   * of this PDF receives the title block composited on top.
   */
  uploadBytes: Uint8Array;

  /**
   * The SparkPlan title-block PDF (rendered via `AttachmentTitleBlock` +
   * react-pdf). Must be EXACTLY ONE PAGE and at the same dimensions as
   * the upload's first page — the orchestrator sizes it via
   * `pageSize: [uploadWidth, uploadHeight]`.
   */
  titleBlockBytes: Uint8Array;

  /**
   * Sheet ID assigned to the composite page. Not used during composite —
   * carried here so callers passing this through to stampSheetIds can use
   * one input object end-to-end.
   */
  sheetId: string;

  /**
   * Display label — surfaced only in warning messages (e.g., "Failed to
   * composite cut-sheet.pdf"). Not embedded in the PDF.
   */
  label: string;
}

export interface CompositeResult {
  /**
   * Final composite PDF bytes — same page count as `uploadBytes`, with
   * the title block painted on every page. Always present (returns the
   * original `uploadBytes` if compositing failed).
   */
  composedPdf: Uint8Array;

  /**
   * Number of pages in the output. Equal to `uploadBytes.pageCount` on
   * success; 0 when both input loads failed.
   */
  pageCount: number;

  /**
   * Non-fatal issues encountered during compositing. Examples:
   *   - "Skipped overlay for 'survey.pdf': could not load upload PDF."
   *   - "Skipped overlay for 'survey.pdf': could not load title block PDF."
   *   - "Composited 'survey.pdf' but the upload's first page (612×792)
   *      doesn't match the title block (1728×2592) — title block was
   *      scaled to fit each upload page."
   * Caller decides how to present the warnings.
   */
  warnings: string[];

  /**
   * Indicates whether ANY title block was painted. False means the result
   * is just the upload pass-through (caller may want to log this or fall
   * back to the 'none' cover mode).
   */
  composited: boolean;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

async function safeLoad(bytes: Uint8Array): Promise<PDFDocument | null> {
  try {
    return await PDFDocument.load(bytes, {
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
 * Composite a SparkPlan title block onto every page of a contractor's
 * upload. Pure function — no DB, no hooks, no side effects, never throws.
 *
 * @example
 *   const result = await compositeTitleBlock({
 *     uploadBytes,
 *     titleBlockBytes,
 *     sheetId: 'A-100',
 *     label: 'site-plan.pdf',
 *   });
 *   if (!result.composited) {
 *     // Fall back to the 'none' cover mode — append the upload as-is.
 *   }
 *   // result.composedPdf is the bytes to splice into the merged packet.
 */
export async function compositeTitleBlock(
  input: CompositeInput,
): Promise<CompositeResult> {
  const { uploadBytes, titleBlockBytes, label } = input;
  const warnings: string[] = [];

  // Load the upload first — without it, there's nothing to composite onto.
  const uploadDoc = await safeLoad(uploadBytes);
  if (!uploadDoc) {
    warnings.push(
      `Skipped overlay for '${label}': could not load uploaded PDF (encrypted or corrupted).`,
    );
    return {
      composedPdf: uploadBytes,
      pageCount: 0,
      warnings,
      composited: false,
    };
  }

  const uploadPageCount = uploadDoc.getPageCount();
  if (uploadPageCount === 0) {
    warnings.push(
      `Skipped overlay for '${label}': uploaded PDF has zero pages.`,
    );
    return {
      composedPdf: uploadBytes,
      pageCount: 0,
      warnings,
      composited: false,
    };
  }

  // Load the title block. Must be at least 1 page; we use page 0.
  const titleDoc = await safeLoad(titleBlockBytes);
  if (!titleDoc || titleDoc.getPageCount() === 0) {
    warnings.push(
      `Skipped overlay for '${label}': could not load SparkPlan title block.`,
    );
    return {
      composedPdf: uploadBytes,
      pageCount: uploadPageCount,
      warnings,
      composited: false,
    };
  }

  // Embed the title block as a reusable XObject. This means we only pay
  // the byte cost once even when the upload is multi-page (e.g., a 10-page
  // cut-sheet PDF). Each page draws the same XObject reference.
  let embeddedTitleBlock;
  try {
    embeddedTitleBlock = await uploadDoc.embedPdf(titleBlockBytes, [0]);
  } catch (err) {
    warnings.push(
      `Skipped overlay for '${label}': could not embed title block (${err instanceof Error ? err.message : String(err)}).`,
    );
    return {
      composedPdf: uploadBytes,
      pageCount: uploadPageCount,
      warnings,
      composited: false,
    };
  }
  if (!embeddedTitleBlock || embeddedTitleBlock.length === 0) {
    warnings.push(
      `Skipped overlay for '${label}': title block embed returned no pages.`,
    );
    return {
      composedPdf: uploadBytes,
      pageCount: uploadPageCount,
      warnings,
      composited: false,
    };
  }
  const titleBlockPage = embeddedTitleBlock[0];

  // Per-page draw. We scale the title block to each page's dimensions —
  // if the upload is mixed-size (rare but possible — multi-page PDFs from
  // different scanners), each page still gets a correctly-positioned
  // title block. The orchestrator sizes the title block to the FIRST
  // page's dimensions; mismatch with later pages produces a single warning
  // (so the caller knows the title block was rescaled).
  const titleBlockSize = titleDoc.getPage(0).getSize();
  let scaledPages = 0;

  for (let i = 0; i < uploadPageCount; i++) {
    const page = uploadDoc.getPage(i);
    const { width: pw, height: ph } = page.getSize();
    if (
      Math.abs(pw - titleBlockSize.width) > 1 ||
      Math.abs(ph - titleBlockSize.height) > 1
    ) {
      scaledPages += 1;
    }
    try {
      page.drawPage(titleBlockPage, {
        x: 0,
        y: 0,
        width: pw,
        height: ph,
      });
    } catch (err) {
      warnings.push(
        `Could not paint title block on page ${i + 1} of '${label}': ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  if (scaledPages > 0) {
    warnings.push(
      `Composited '${label}' but ${scaledPages} of ${uploadPageCount} page(s) had different dimensions than the title block — title block was scaled to fit each page.`,
    );
  }

  let composedPdf: Uint8Array;
  try {
    composedPdf = await uploadDoc.save();
  } catch (err) {
    warnings.push(
      `Could not serialize composite for '${label}': ${err instanceof Error ? err.message : String(err)}`,
    );
    return {
      composedPdf: uploadBytes,
      pageCount: uploadPageCount,
      warnings,
      composited: false,
    };
  }

  return {
    composedPdf,
    pageCount: uploadPageCount,
    warnings,
    composited: true,
  };
}
