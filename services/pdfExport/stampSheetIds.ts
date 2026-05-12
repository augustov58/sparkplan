/**
 * stampSheetIds — Sprint 2B PR-3
 *
 * Pure function (no DB, no hooks, no side effects) that stamps sheet IDs
 * onto the bottom-right corner of pages in a merged permit packet.
 *
 * ## Why a separate pass from mergePacket
 *
 * react-pdf already stamps sheet IDs onto the SparkPlan-generated pages
 * (Sprint 2A H3 BrandBar pills). Stamping them again would double-print.
 * The merge pipeline therefore runs two passes:
 *
 *   1. mergePacket()    → concatenates SparkPlan + (title + upload) chunks
 *   2. stampSheetIds()  → writes sheet IDs onto pages NOT already stamped
 *                          (title sheets keep their react-pdf stamp;
 *                          user-uploaded pages get a new pdf-lib stamp)
 *
 * The skipFirstN parameter tells the stamper how many pages at the start
 * of the merged document are already stamped and should NOT be touched.
 * For the canonical pipeline:
 *
 *   skipFirstN = sparkplan.pageCount + sum(per-attachment title pages)
 *
 * Actually — title sheets ARE already stamped by react-pdf via the
 * AttachmentTitleSheet's BrandBar pill. So the right value is:
 *
 *   skipFirstN = sparkplan.pageCount
 *   AND for each attachment, also skip the title sheet (1 page)
 *
 * Simplest API: pass a `shouldStamp: boolean[]` aligned to merged pages.
 * The orchestrator builds this map from the AttachmentInput list. This is
 * more explicit than skipFirstN — handles mixed page ranges cleanly.
 *
 * ## Position
 *
 * Bottom-right corner regardless of page size or orientation. Uses the
 * per-page `getSize()` so ARCH D (24x36) and Letter pages get correctly
 * positioned stamps. Hard-coded offsets:
 *
 *   x = width - 60   (60 pt = ~0.83 inch in from the right)
 *   y = 20            (20 pt = ~0.28 inch up from the bottom)
 *
 * Font: built-in Helvetica-Bold @ 9pt, dark gray. Style mirrors the
 * Sprint 2A sheet-ID footer badge from `permitPacketTheme.tsx`.
 *
 * ## Per-page contractor footer
 *
 * Out of scope. User-uploaded pages should NOT get a SparkPlan contractor
 * footer — uploads carry their own attribution via the preceding title
 * sheet. So this function ONLY stamps the sheet ID, nothing else.
 *
 * ## Never throws
 *
 * Per CLAUDE.md "Calculation Service Rules". Returns warnings + the
 * (potentially unmodified) bytes when something goes wrong. Callers
 * never have to wrap this in try/catch.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StampSheetIdsInput {
  /**
   * Merged PDF bytes (output of `mergePacket`).
   */
  merged: Uint8Array;

  /**
   * Sheet ID per merged page, aligned by index. Length must equal the
   * merged document's total page count. Use empty string for pages with
   * no sheet ID (those will be skipped).
   */
  sheetIdMap: string[];

  /**
   * Boolean mask: should page i be stamped by this pass? Length must
   * equal `sheetIdMap.length`. SparkPlan-generated pages + title sheets
   * are already stamped by react-pdf and should be `false`. Only the
   * user-uploaded pages need stamping (`true`).
   *
   * Aligning two arrays (sheetIdMap + shouldStamp) keeps the contract
   * explicit — the orchestrator declares EVERY page's identity, and a
   * stamp pass + sheet-ID map can be reused for the toc/manifest if
   * Sprint 2C ever wants to render a per-page index.
   */
  shouldStamp: boolean[];
}

export interface StampSheetIdsResult {
  /** Stamped PDF bytes (or the original `merged` bytes if no pages needed stamping). */
  bytes: Uint8Array;

  /** Number of pages actually stamped. */
  stampedCount: number;

  /** Non-fatal issues — e.g., mismatched array lengths. */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Stamp sheet IDs onto the bottom-right of pages flagged in `shouldStamp`.
 *
 * @example
 *   const stamped = await stampSheetIds({
 *     merged: mergeResult.bytes,
 *     sheetIdMap: ['', '', 'C-201', 'C-202', 'C-203'],
 *     shouldStamp: [false, false, false, true, true],
 *   });
 *   // Pages 0 + 1 are SparkPlan (already stamped via react-pdf).
 *   // Page 2 is the title sheet (already stamped via AttachmentTitleSheet BrandBar).
 *   // Pages 3 + 4 are the user-uploaded artifact — stamped by this pass.
 */
export async function stampSheetIds(
  input: StampSheetIdsInput,
): Promise<StampSheetIdsResult> {
  const { merged, sheetIdMap, shouldStamp } = input;
  const warnings: string[] = [];

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(merged, {
      ignoreEncryption: true,
      throwOnInvalidObject: false,
    });
  } catch (err) {
    return {
      bytes: merged,
      stampedCount: 0,
      warnings: [
        `Could not load merged PDF for stamping: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  const pageCount = doc.getPageCount();
  if (sheetIdMap.length !== pageCount || shouldStamp.length !== pageCount) {
    warnings.push(
      `Length mismatch: merged has ${pageCount} pages, sheetIdMap has ${sheetIdMap.length}, shouldStamp has ${shouldStamp.length}. Stamping the overlap only.`,
    );
  }

  const n = Math.min(pageCount, sheetIdMap.length, shouldStamp.length);

  // Load Helvetica-Bold once — pdf-lib caches embedded fonts so a single
  // call here is reused across every stamp draw.
  let font;
  try {
    font = await doc.embedFont(StandardFonts.HelveticaBold);
  } catch (err) {
    return {
      bytes: merged,
      stampedCount: 0,
      warnings: [
        ...warnings,
        `Could not embed Helvetica-Bold for stamping: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  let stampedCount = 0;
  for (let i = 0; i < n; i++) {
    if (!shouldStamp[i]) continue;
    const sheetId = sheetIdMap[i];
    if (!sheetId) continue;

    const page = doc.getPage(i);
    const { width } = page.getSize();
    const fontSize = 9;
    const textWidth = font.widthOfTextAtSize(sheetId, fontSize);

    // Position: bottom-right, with a small inset so the stamp never sits
    // at the literal edge (which AHJ scanners sometimes crop). Uses each
    // page's own width so ARCH D (1728 pt wide) and Letter (612 pt wide)
    // both get correctly positioned stamps.
    const margin = 24;
    const x = width - textWidth - margin;
    const y = 20;

    try {
      page.drawText(sheetId, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0.176, 0.231, 0.176), // BRAND_DARK (#2d3b2d)
      });
      stampedCount += 1;
    } catch (err) {
      warnings.push(
        `Could not stamp page ${i + 1} (sheet ${sheetId}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  let bytes: Uint8Array;
  try {
    bytes = await doc.save();
  } catch (err) {
    return {
      bytes: merged,
      stampedCount: 0,
      warnings: [
        ...warnings,
        `Could not serialize stamped PDF: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  return {
    bytes,
    stampedCount,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Convenience: build the shouldStamp mask from a merge structure
// ---------------------------------------------------------------------------

/**
 * Helper for the orchestrator: given the merged-document structure (which
 * pages are SparkPlan vs. which pages are uploads), build the boolean
 * mask + sheet-ID array that `stampSheetIds` expects.
 *
 * Each attachment contributes entries depending on its cover mode:
 *
 *   - separate (`hasCover === true`, default) — `1 + uploadPageCount`
 *       entries: [titlePage, ...uploadPages]. Title page is not stamped
 *       (AttachmentTitleSheet's BrandBar already drew the sheet ID);
 *       upload pages are stamped.
 *
 *   - none (`hasCover === false`, `overlay !== true`) —
 *       `uploadPageCount` entries, all upload-page slots with empty
 *       sheet IDs and shouldStamp=false. Architect's own numbering
 *       carries the identifier.
 *
 *   - overlay (`hasCover === false`, `overlay === true`) —
 *       `uploadPageCount` entries (composite pages). Each gets its
 *       assigned sheet ID AND a stamp draw. v4 commit 15.
 *
 * SparkPlan pages get `false` everywhere (already stamped by react-pdf).
 */
export function buildStampMaps(args: {
  sparkplanPageCount: number;
  attachments: Array<{
    /**
     * Sheet IDs. Layout depends on cover mode:
     * - separate (cover-ON): `[title, ...upload pages]`
     * - none (cover-OFF, no overlay): length === uploadPageCount,
     *   typically all `''`
     * - overlay (cover-OFF + overlay=true): length === uploadPageCount,
     *   each entry is the composite page's ID (stamped)
     */
    sheetIdRange: string[];
    /**
     * Optional flag — when false, this attachment contributes only
     * upload pages (no title page, no stamping unless `overlay=true`).
     * Default true preserves the original PR-3 cover-ON behavior.
     */
    hasCover?: boolean;
    /**
     * v4 commit 15: overlay-mode flag. When true (only meaningful with
     * `hasCover=false`), every upload-page slot gets shouldStamp=true.
     */
    overlay?: boolean;
  }>;
}): { sheetIdMap: string[]; shouldStamp: boolean[] } {
  const sheetIdMap: string[] = [];
  const shouldStamp: boolean[] = [];

  // SparkPlan portion — no IDs needed here (already stamped by react-pdf).
  // Empty strings just keep the array aligned to the merged page count.
  for (let i = 0; i < args.sparkplanPageCount; i++) {
    sheetIdMap.push('');
    shouldStamp.push(false);
  }

  for (const att of args.attachments) {
    if (att.sheetIdRange.length === 0) continue;

    if (att.hasCover === false) {
      // No title page in the merged output. Stamp behavior depends on
      // whether this is overlay mode or 'none'.
      const stampOnUpload = att.overlay === true;
      for (const id of att.sheetIdRange) {
        sheetIdMap.push(id);
        // Empty IDs are never stamped regardless of mode.
        shouldStamp.push(stampOnUpload && id !== '');
      }
    } else {
      // Cover-ON (separate): first entry is the title page (no stamp,
      // BrandBar already painted), remaining entries are upload pages
      // (stamp each).
      sheetIdMap.push(att.sheetIdRange[0]);
      shouldStamp.push(false);
      for (let j = 1; j < att.sheetIdRange.length; j++) {
        sheetIdMap.push(att.sheetIdRange[j]);
        shouldStamp.push(true);
      }
    }
  }

  return { sheetIdMap, shouldStamp };
}
