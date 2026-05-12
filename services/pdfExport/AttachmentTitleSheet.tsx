/**
 * AttachmentTitleSheet (Sprint 2B PR-3 — v3 redesign)
 *
 * SparkPlan-themed cover page rendered immediately before each user-uploaded
 * artifact in the merged permit packet. Re-laid out (commit 6) to follow
 * architectural title-block conventions so the page fills any size from
 * 8.5 × 11 portrait up to ARCH D 36 × 48 landscape without leaving the
 * content stranded in the top 40% of a large sheet.
 *
 * ## Layout (matches the HOK / Royal Caribbean A100 plan-set convention)
 *
 *   +----------------------------------------------------+ <- perimeter rule
 *   | BrandBar (full width inside the rule)              |
 *   |                                              ┌─────┤
 *   |                                              │ R   │  Right-margin
 *   |                                              │ I   │  vertical title
 *   |     Drawing title (center, large)            │ G   │  block strip
 *   |     "SITE PLAN"                              │ H   │  (architect,
 *   |     description                              │ T   │   project name,
 *   |                                              │     │   prepared for,
 *   |     Provided-by + Date-received block        │ T   │   address,
 *   |                                              │ I   │   FL PE reg,
 *   |     "User-supplied artifact follows"         │ T   │   seal area,
 *   |     placeholder note                         │ L   │   key plan box,
 *   |                                              │ E   │   NFC stamp,
 *   |                                              │     │   revision log)
 *   |  +------------------+                        │ B   │
 *   |  | Original is:     |              ┌─────────┤ L   │
 *   |  | 36 × 48 in       |              │  C-201  │ K   │  Sheet number
 *   |  | Do not scale     |              │   ──    │     │  (large, bottom
 *   |  +------------------+              │ TITLE   │     │   right — first
 *   |                                    │ SHEET   │     │   place AHJ
 *   |                                    └─────────┴─────┘  reviewers look)
 *   +----------------------------------------------------+
 *
 * ## Size-aware rendering
 *
 * Accepts an explicit `pageSize` tuple — `[width_pt, height_pt]` in PDF
 * points (72 per inch). The merge orchestrator probes the first page of
 * the upload via pdf-lib and forwards the dimensions so this title sheet
 * matches the upload page-for-page (Letter portrait, Letter landscape,
 * ARCH D 24 × 36, ARCH E 36 × 48 — all rendered by the same component).
 *
 * Two layout modes adapt automatically based on page size:
 *
 *   - SMALL (Letter portrait / Letter landscape, width < 1000pt):
 *       Right-margin strip width = 160pt
 *       Sheet number block = 80 × 50pt
 *       Banner title font = 26pt (portrait) / 32pt (landscape)
 *
 *   - LARGE (ARCH C / D / E — width >= 1000pt):
 *       Right-margin strip width = 240pt
 *       Sheet number block = 130 × 80pt
 *       Banner title font = 44pt
 *
 * The perimeter rule inset (36pt) is constant — looks right at all sizes.
 *
 * ## Wrap behavior
 *
 * Sprint 2A pattern (`wrap={false}` on the outer Page-level View) — the
 * title sheet is one page exactly. The perimeter rule, right-margin strip,
 * and bottom-right sheet number block are all absolutely-positioned so
 * react-pdf has no opportunity to re-flow them across pages.
 *
 * ## Pure render
 *
 * No hooks, no DB, no side effects — just react-pdf primitives.
 */

import React from 'react';
import { Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import {
  BrandBar,
  themeStyles,
  BRAND_DARK,
  BRAND_YELLOW,
  todayStr,
} from './permitPacketTheme';
import type { ArtifactType } from '../../hooks/useProjectAttachments';

// ---------------------------------------------------------------------------
// Display titles — drives the big banner text + the BrandBar pageLabel.
// ---------------------------------------------------------------------------

/**
 * Human-readable display title for each artifact type. Used when the caller
 * doesn't supply an explicit `displayTitle` override.
 */
export const ARTIFACT_DISPLAY_TITLES: Record<ArtifactType, string> = {
  site_plan: 'Site Plan',
  cut_sheet: 'Equipment Cut Sheets',
  fire_stopping: 'Fire Stopping Schedule',
  noc: 'Notice of Commencement',
  hoa_letter: 'HOA / Condo Approval Letter',
  survey: 'Property Survey',
  manufacturer_data: 'Manufacturer Installation Data',
  hvhz_anchoring: 'HVHZ / Outdoor Anchoring Detail',
};

/**
 * Short descriptor shown under the big title — the same description the
 * AttachmentUploadCard surfaces to the user during upload.
 */
export const ARTIFACT_DESCRIPTIONS: Record<ArtifactType, string> = {
  site_plan:
    'Property layout, equipment locations, utility connections',
  cut_sheet:
    'Manufacturer specification sheets — panels, breakers, EVSE, UL listings, ratings',
  fire_stopping:
    'UL-listed firestop assemblies for rated-wall penetrations',
  noc:
    'FL Statute 713 — required for jobs over $5,000',
  hoa_letter:
    'Homeowner association / condo board approval',
  survey:
    'Stamped property survey',
  manufacturer_data:
    'Vendor-supplied installation manuals and technical bulletins',
  hvhz_anchoring:
    'FL Product Approval / Miami-Dade NOA / signed-sealed structural plans for outdoor pedestal/bollard EVSE',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AttachmentTitleSheetProps {
  /** Sheet ID assigned by the merge orchestrator (e.g., "C-201", "X-203"). */
  sheetId: string;

  /** Discriminator for default labels + descriptions. */
  artifactType: ArtifactType;

  /**
   * Human-friendly title displayed in the body banner. Falls back to
   * `ARTIFACT_DISPLAY_TITLES[artifactType]` when not provided.
   */
  displayTitle?: string;

  /** Contractor name printed in the "Provided by" attribution block. */
  contractorName?: string;

  /** Optional contractor license (printed under the contractor name). */
  contractorLicense?: string;

  /** Project metadata block — mirrors the cover page's PROJECT INFORMATION. */
  projectName: string;
  projectAddress?: string;
  permitNumber?: string;

  /**
   * Date the contractor uploaded the artifact. ISO 8601 string. Falls back
   * to today (`todayStr()`) when not provided.
   */
  dateReceived?: string;

  /**
   * Page size in PDF points — `[width, height]`. The merge orchestrator
   * inspects the first page of the upload via `pdf-lib` and forwards those
   * dimensions here so the title sheet matches the upload.
   *
   * Default `[612, 792]` is US Letter portrait — the same as omitting the
   * `size` prop entirely on a react-pdf `<Page>`. Pilot uploads are mostly
   * 8.5×11, so this default is exercised 80-90% of the time.
   */
  pageSize?: [number, number];
}

// ---------------------------------------------------------------------------
// Layout constants — derived from page size so a single component handles
// Letter portrait through ARCH E landscape with the same architectural
// title-block visual hierarchy.
// ---------------------------------------------------------------------------

const PERIMETER_INSET = 36;          // distance from page edge to perimeter rule
const PERIMETER_STROKE = 1.25;

/**
 * Compute the size-bucket scalars used throughout the layout. Two buckets —
 * SMALL (8.5×11 / 11×17 / Letter landscape) and LARGE (ARCH C / D / E) —
 * because trying to interpolate every dimension linearly looks worse than
 * picking two sane sets of constants that each look right at their scale.
 */
function getScale(width: number, height: number) {
  const isLandscape = width > height;
  const isLarge = Math.max(width, height) >= 1000; // ARCH C+ falls in this bucket

  return {
    isLandscape,
    isLarge,

    // Width of the right-margin vertical title block strip.
    rightStripWidth: isLarge ? 240 : 160,

    // Size of the bottom-right "Sheet Number" corner block (the AHJ-anchor).
    sheetBlockWidth: isLarge ? 130 : 92,
    sheetBlockHeight: isLarge ? 84 : 58,

    // Banner ("SITE PLAN") font size.
    bannerFont: isLarge ? 44 : isLandscape ? 32 : 26,

    // Smaller text scales.
    bodyFont: isLarge ? 11 : 10,
    labelFont: isLarge ? 8 : 7,
    sheetIdFont: isLarge ? 32 : 22,

    // Inner padding for the right-strip cells.
    stripCellPad: isLarge ? 10 : 7,
  };
}

// ---------------------------------------------------------------------------
// Local styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // No padding on the Page itself — we use absolute positioning inside a
  // perimeter rule to take full control of the entire sheet.
  page: {
    padding: 0,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#111827',
    backgroundColor: '#ffffff',
  },

  // Perimeter rule + outer canvas. Absolutely positioned so it fills the
  // entire page edge-to-edge regardless of page size.
  perimeter: {
    position: 'absolute',
    borderWidth: PERIMETER_STROKE,
    borderColor: BRAND_DARK,
    borderStyle: 'solid',
  },

  rightStrip: {
    position: 'absolute',
    borderLeftWidth: PERIMETER_STROKE,
    borderLeftColor: BRAND_DARK,
    flexDirection: 'column',
  },

  // Cells inside the right-margin strip — each represents one row of the
  // architect's title block (project name, prepared for, seal, etc.).
  stripCell: {
    borderBottomWidth: 0.75,
    borderBottomColor: BRAND_DARK,
    flexDirection: 'column',
  },
  stripCellLabel: {
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  stripCellValue: {
    color: '#111827',
    fontFamily: 'Helvetica-Bold',
  },
  stripCellSubValue: {
    color: '#374151',
    marginTop: 2,
  },
  stripStampBox: {
    borderWidth: 1,
    borderColor: BRAND_DARK,
    flex: 1,
    margin: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripStampText: {
    color: BRAND_DARK,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.5,
    textAlign: 'center',
  },

  // Main content (drawing title + provided-by). Centered horizontally
  // within the area to the left of the right-margin strip.
  contentArea: {
    position: 'absolute',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    fontFamily: 'Helvetica-Bold',
    color: BRAND_DARK,
    letterSpacing: 2,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  bannerDescription: {
    color: '#4b5563',
    textAlign: 'center',
  },

  metaRow: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 18,
  },
  metaCol: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  metaLabel: {
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  metaValue: {
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },
  metaSubValue: {
    color: '#374151',
  },

  followsNote: {
    marginTop: 20,
    color: '#6b7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Bottom-left "Original is X × Y" + boilerplate.
  originalBlock: {
    position: 'absolute',
    flexDirection: 'column',
    borderWidth: 0.75,
    borderColor: '#6b7280',
    backgroundColor: '#fafafa',
  },
  originalLabel: {
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  originalValue: {
    color: '#111827',
    fontFamily: 'Helvetica-Bold',
  },

  // Bottom-right corner "Sheet Number" block — the eye-magnet for AHJ
  // reviewers. Large, bold, yellow-banded.
  sheetBlock: {
    position: 'absolute',
    borderWidth: 1.25,
    borderColor: BRAND_DARK,
    flexDirection: 'column',
    backgroundColor: '#ffffff',
  },
  sheetBlockHeader: {
    backgroundColor: BRAND_DARK,
    color: BRAND_YELLOW,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingVertical: 3,
    fontFamily: 'Helvetica-Bold',
  },
  sheetBlockNumber: {
    flex: 1,
    color: BRAND_DARK,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    letterSpacing: 1.5,
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
};

/** Pretty-print the original page dimensions in inches (rounded to 0.1"). */
function formatOriginalSize(widthPt: number, heightPt: number): string {
  const widthIn = widthPt / 72;
  const heightIn = heightPt / 72;
  const fmt = (n: number) =>
    Math.abs(n - Math.round(n)) < 0.05 ? `${Math.round(n)}` : n.toFixed(1);
  return `${fmt(widthIn)} × ${fmt(heightIn)} in`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Render a SparkPlan-themed title sheet that precedes a user-uploaded
 * artifact in the merged permit packet. Uses architectural title-block
 * conventions so the page fills correctly at any size from Letter
 * portrait through ARCH E landscape.
 */
export const AttachmentTitleSheet: React.FC<AttachmentTitleSheetProps> = ({
  sheetId,
  artifactType,
  displayTitle,
  contractorName,
  contractorLicense,
  projectName,
  projectAddress,
  permitNumber,
  dateReceived,
  pageSize = [612, 792],
}) => {
  const [width, height] = pageSize;
  const scale = getScale(width, height);
  const title = displayTitle?.trim() || ARTIFACT_DISPLAY_TITLES[artifactType];
  const description = ARTIFACT_DESCRIPTIONS[artifactType];
  const receivedLabel = dateReceived ? formatDate(dateReceived) : todayStr();

  // Inset-perimeter geometry — recomputed inside the component so each
  // pageSize generates its own absolutely-positioned layout.
  const innerLeft = PERIMETER_INSET;
  const innerRight = width - PERIMETER_INSET;
  const innerTop = PERIMETER_INSET;
  const innerBottom = height - PERIMETER_INSET;
  const innerWidth = innerRight - innerLeft;
  const innerHeight = innerBottom - innerTop;

  // Reserve room at the top of the inner area for the BrandBar (BrandBar
  // is fixed to its theme height — measured to be ~28pt including margin).
  const brandBarHeight = 28;
  const contentTop = innerTop + brandBarHeight + 6;

  // Right-margin strip
  const stripLeft = innerRight - scale.rightStripWidth;
  const stripTop = contentTop;
  const stripBottom = innerBottom;
  const stripHeight = stripBottom - stripTop;

  // Sheet-number block (bottom-right corner)
  const sheetBlockRight = innerRight;
  const sheetBlockBottom = innerBottom;
  const sheetBlockLeft = sheetBlockRight - scale.sheetBlockWidth;
  const sheetBlockTop = sheetBlockBottom - scale.sheetBlockHeight;

  // Original-size block (bottom-left)
  const origBlockLeft = innerLeft;
  const origBlockBottom = innerBottom;
  const origBlockWidth = scale.isLarge ? 200 : 140;
  const origBlockHeight = scale.isLarge ? 64 : 50;
  const origBlockTop = origBlockBottom - origBlockHeight;

  // Main content area (to the left of the right strip, above the bottom-left
  // original-size block + the bottom-right sheet block).
  const contentLeft = innerLeft;
  const contentRight = stripLeft;
  const contentWidth = contentRight - contentLeft;
  const contentBottomReserve = Math.max(origBlockHeight, scale.sheetBlockHeight) + 12;
  const contentHeight = innerBottom - contentTop - contentBottomReserve;

  // Right-strip rows. Split the strip vertically into roughly equal blocks
  // for: title-block header, project name, prepared for, address, FL PE
  // info, seal area (flex-grow), NFC stamp, revision log.
  // The strip's `stripCell` borderBottoms cleanly delineate them.

  return (
    <Page size={pageSize} style={styles.page} wrap={false}>
      {/* Layout-anchor View — flex:1 with explicit width/height so react-pdf
          gives the Page its full `size` dimensions even though every other
          child is absolutely positioned. Without this, the page collapses
          to 0×0 because absolutely-positioned children take themselves out
          of the layout flow. */}
      <View style={{ width, height }} />

      {/* Perimeter rule — fills the entire page edge-to-edge. */}
      <View
        style={{
          ...styles.perimeter,
          left: PERIMETER_INSET,
          top: PERIMETER_INSET,
          width: innerWidth,
          height: innerHeight,
        }}
      />

      {/* Top BrandBar inside the perimeter rule. Positioned just below the
          top edge — BrandBar's own component uses position absolute by
          default? No, it doesn't — wrap it. */}
      <View
        style={{
          position: 'absolute',
          left: innerLeft,
          right: width - innerRight,
          top: innerTop,
        }}
      >
        <BrandBar
          pageLabel={`${title.toUpperCase()} — TITLE SHEET`}
          sheetId={sheetId}
        />
      </View>

      {/* Main content area: drawing title + description + provided-by.
          Centered both axes within the area to the left of the right strip. */}
      <View
        style={{
          ...styles.contentArea,
          left: contentLeft,
          top: contentTop,
          width: contentWidth,
          height: contentHeight,
        }}
      >
        <Text
          style={{
            ...styles.bannerTitle,
            fontSize: scale.bannerFont,
            marginBottom: 8,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            ...styles.bannerDescription,
            fontSize: scale.bodyFont + 1,
            marginBottom: 4,
          }}
        >
          {description}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={{ ...styles.metaLabel, fontSize: scale.labelFont }}>
              Provided By
            </Text>
            <Text style={{ ...styles.metaValue, fontSize: scale.bodyFont + 1 }}>
              {contractorName || 'Project Contractor'}
            </Text>
            {contractorLicense ? (
              <Text
                style={{ ...styles.metaSubValue, fontSize: scale.bodyFont - 1 }}
              >
                License #: {contractorLicense}
              </Text>
            ) : null}
          </View>
          <View style={styles.metaCol}>
            <Text style={{ ...styles.metaLabel, fontSize: scale.labelFont }}>
              Date Received
            </Text>
            <Text style={{ ...styles.metaValue, fontSize: scale.bodyFont + 1 }}>
              {receivedLabel}
            </Text>
          </View>
        </View>

        <Text
          style={{
            ...styles.followsNote,
            fontSize: scale.bodyFont,
          }}
        >
          User-supplied artifact follows this sheet
        </Text>
      </View>

      {/* Bottom-left: original-size + do-not-scale boilerplate. */}
      <View
        style={{
          ...styles.originalBlock,
          left: origBlockLeft,
          top: origBlockTop,
          width: origBlockWidth,
          height: origBlockHeight,
          padding: scale.stripCellPad,
        }}
      >
        <Text style={{ ...styles.originalLabel, fontSize: scale.labelFont }}>
          Original Sheet Size
        </Text>
        <Text
          style={{
            ...styles.originalValue,
            fontSize: scale.bodyFont,
            marginTop: 2,
          }}
        >
          {formatOriginalSize(width, height)}
        </Text>
        <Text
          style={{
            ...styles.originalLabel,
            fontSize: scale.labelFont - 0.5,
            marginTop: 6,
          }}
        >
          Do not scale contents — refer to dimensions
        </Text>
      </View>

      {/* Bottom-right: large "Sheet Number" corner block. AHJ reviewers
          look here first; the BrandBar pill is the redundant copy. */}
      <View
        style={{
          ...styles.sheetBlock,
          left: sheetBlockLeft,
          top: sheetBlockTop,
          width: scale.sheetBlockWidth,
          height: scale.sheetBlockHeight,
        }}
      >
        <Text
          style={{
            ...styles.sheetBlockHeader,
            fontSize: scale.labelFont,
          }}
        >
          Sheet
        </Text>
        <Text
          style={{
            ...styles.sheetBlockNumber,
            fontSize: scale.sheetIdFont,
            paddingTop: scale.isLarge ? 14 : 8,
          }}
        >
          {sheetId}
        </Text>
      </View>

      {/* Right-margin vertical title block strip (architect-style). */}
      <View
        style={{
          ...styles.rightStrip,
          left: stripLeft,
          top: stripTop,
          width: scale.rightStripWidth,
          height: stripHeight - scale.sheetBlockHeight, // leave room for the sheet block
        }}
      >
        {/* Title block header */}
        <View
          style={{
            ...styles.stripCell,
            padding: scale.stripCellPad,
            backgroundColor: BRAND_DARK,
          }}
        >
          <Text
            style={{
              color: BRAND_YELLOW,
              fontFamily: 'Helvetica-Bold',
              fontSize: scale.labelFont + 0.5,
              textTransform: 'uppercase',
              letterSpacing: 1.2,
              textAlign: 'center',
            }}
          >
            Title Block
          </Text>
        </View>

        {/* Project name */}
        <View style={{ ...styles.stripCell, padding: scale.stripCellPad }}>
          <Text style={{ ...styles.stripCellLabel, fontSize: scale.labelFont }}>
            Project
          </Text>
          <Text style={{ ...styles.stripCellValue, fontSize: scale.bodyFont }}>
            {projectName}
          </Text>
        </View>

        {/* Project address */}
        <View style={{ ...styles.stripCell, padding: scale.stripCellPad }}>
          <Text style={{ ...styles.stripCellLabel, fontSize: scale.labelFont }}>
            Project Address
          </Text>
          <Text
            style={{
              ...styles.stripCellValue,
              fontSize: scale.bodyFont - 0.5,
            }}
          >
            {projectAddress || 'Not specified'}
          </Text>
        </View>

        {/* Prepared for / Contractor */}
        <View style={{ ...styles.stripCell, padding: scale.stripCellPad }}>
          <Text style={{ ...styles.stripCellLabel, fontSize: scale.labelFont }}>
            Prepared For
          </Text>
          <Text style={{ ...styles.stripCellValue, fontSize: scale.bodyFont }}>
            {contractorName || 'Project Contractor'}
          </Text>
          {contractorLicense ? (
            <Text
              style={{
                ...styles.stripCellSubValue,
                fontSize: scale.bodyFont - 1,
              }}
            >
              License #: {contractorLicense}
            </Text>
          ) : null}
        </View>

        {/* Permit / Job number */}
        <View style={{ ...styles.stripCell, padding: scale.stripCellPad }}>
          <Text style={{ ...styles.stripCellLabel, fontSize: scale.labelFont }}>
            Permit / Job No.
          </Text>
          <Text style={{ ...styles.stripCellValue, fontSize: scale.bodyFont }}>
            {permitNumber || 'TBD'}
          </Text>
        </View>

        {/* FL PE registration footprint (SparkPlan PE seal lane — Sprint 3) */}
        <View style={{ ...styles.stripCell, padding: scale.stripCellPad }}>
          <Text style={{ ...styles.stripCellLabel, fontSize: scale.labelFont }}>
            FL Reg. / Seal
          </Text>
          <Text
            style={{
              ...styles.stripCellSubValue,
              fontSize: scale.bodyFont - 1,
            }}
          >
            Engineer of Record — see Sheet E-001
          </Text>
        </View>

        {/* Seal area — empty box for wet stamp */}
        <View
          style={{
            ...styles.stripCell,
            padding: 0,
            flex: 1,
            minHeight: scale.isLarge ? 120 : 80,
          }}
        >
          <View style={styles.stripStampBox}>
            <Text
              style={{
                ...styles.stripStampText,
                fontSize: scale.labelFont + 0.5,
              }}
            >
              SEAL{'\n'}AREA
            </Text>
          </View>
        </View>

        {/* NOT FOR CONSTRUCTION stamp area */}
        <View
          style={{
            ...styles.stripCell,
            padding: scale.stripCellPad,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: '#b91c1c',
              fontFamily: 'Helvetica-Bold',
              fontSize: scale.labelFont + 1,
              letterSpacing: 1.5,
              textAlign: 'center',
            }}
          >
            NOT FOR{'\n'}CONSTRUCTION
          </Text>
        </View>

        {/* Revision log placeholder */}
        <View
          style={{
            padding: scale.stripCellPad,
          }}
        >
          <Text style={{ ...styles.stripCellLabel, fontSize: scale.labelFont }}>
            Revisions
          </Text>
          <Text
            style={{
              ...styles.stripCellSubValue,
              fontSize: scale.bodyFont - 1,
              marginTop: 2,
            }}
          >
            {receivedLabel} — Issued for Permit
          </Text>
        </View>
      </View>
    </Page>
  );
};

export default AttachmentTitleSheet;

// Exported for unit-test scrutiny of the layout math.
export const __layoutInternals__ = { getScale, formatOriginalSize, PERIMETER_INSET };
