/**
 * AttachmentTitleBlock — Sprint 2B PR-3 v4 (overlay mode)
 *
 * Renders ONLY the SparkPlan architectural title block (perimeter rule +
 * BrandBar + right-margin vertical strip + bottom-right sheet number block
 * + bottom-left "Original sheet size" boilerplate). DOES NOT render the
 * centered "SITE PLAN" banner title or the "User-supplied artifact follows"
 * placeholder text — those belong on the separate-cover sheet (the
 * `AttachmentTitleSheet` component) where the title block surrounds an
 * intentionally-empty page.
 *
 * Used by the overlay merge path: the orchestrator renders this component
 * at the upload's page size, then `compositeTitleBlock()` (commit 14) uses
 * pdf-lib to composite the rendered PDF onto each page of the contractor's
 * upload. Result: one sheet, with the contractor's drawing in the middle
 * area and the SparkPlan title block wrapping it.
 *
 * ## Transparent page background
 *
 * Page style sets `backgroundColor: 'transparent'` so the title block
 * doesn't paint a white rectangle over the upload's pixel content when
 * composited. react-pdf's @react-pdf/renderer respects the
 * `backgroundColor` style on `<Page>` — verified in the matching unit
 * test. If a future @react-pdf version forces an opaque page color, the
 * fallback strategy is to render the title block elements directly via
 * pdf-lib drawText / drawRectangle in `compositeTitleBlock()`, skipping
 * react-pdf altogether for the overlay path.
 *
 * ## Layout parity with AttachmentTitleSheet
 *
 * Geometry, scale buckets, and constant values are copied verbatim from
 * `AttachmentTitleSheet.tsx` so the title block placement is identical
 * between separate-cover and overlay modes. Only the central content
 * area + the "follows" note are stripped out.
 */

import React from 'react';
import { Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import {
  BrandBar,
  BRAND_DARK,
  BRAND_YELLOW,
  todayStr,
} from './permitPacketTheme';
import {
  ARTIFACT_DISPLAY_TITLES,
  __layoutInternals__ as titleSheetInternals,
} from './AttachmentTitleSheet';
import type { ArtifactType } from '../../hooks/useProjectAttachments';

const { PERIMETER_INSET, getScale, formatOriginalSize } = titleSheetInternals;
const PERIMETER_STROKE = 1.25;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AttachmentTitleBlockProps {
  /** Sheet ID (e.g., "C-201", "A-100"). Drawn in the BrandBar pill + bottom-right block. */
  sheetId: string;
  /** Discriminator for the title block's pageLabel. */
  artifactType: ArtifactType;
  /** Override the default ARTIFACT_DISPLAY_TITLES label. */
  displayTitle?: string;
  /** Contractor name in the "Prepared For" cell. */
  contractorName?: string;
  /** Optional contractor license. */
  contractorLicense?: string;
  /** Project metadata. */
  projectName: string;
  projectAddress?: string;
  permitNumber?: string;
  /** Upload date — drives the revisions footer. */
  dateReceived?: string;
  /** Page dimensions in PDF points (72 per inch). Default Letter portrait. */
  pageSize?: [number, number];
}

// ---------------------------------------------------------------------------
// Styles — mirror AttachmentTitleSheet for visual parity.
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    padding: 0,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#111827',
    // CRITICAL: transparent page background so the upload content shows
    // through. If this stops working in a future @react-pdf release we
    // need a fallback path (see file header).
    backgroundColor: 'transparent',
  },
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
    // Opaque background so the right-margin strip clearly delimits the
    // drawing area from the title-block cells, mirroring industry plan
    // sets. The contractor's pixel content underneath the strip is
    // covered intentionally — title-block real estate.
    backgroundColor: '#ffffff',
  },
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
  originalBlock: {
    position: 'absolute',
    flexDirection: 'column',
    borderWidth: 0.75,
    borderColor: '#6b7280',
    backgroundColor: '#ffffff',
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const AttachmentTitleBlock: React.FC<AttachmentTitleBlockProps> = ({
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
  const receivedLabel = dateReceived ? formatDate(dateReceived) : todayStr();

  const innerLeft = PERIMETER_INSET;
  const innerRight = width - PERIMETER_INSET;
  const innerTop = PERIMETER_INSET;
  const innerBottom = height - PERIMETER_INSET;
  const innerWidth = innerRight - innerLeft;
  const innerHeight = innerBottom - innerTop;

  const brandBarHeight = 28;
  const contentTop = innerTop + brandBarHeight + 6;

  const stripLeft = innerRight - scale.rightStripWidth;
  const stripTop = contentTop;
  const stripBottom = innerBottom;
  const stripHeight = stripBottom - stripTop;

  const sheetBlockRight = innerRight;
  const sheetBlockBottom = innerBottom;
  const sheetBlockLeft = sheetBlockRight - scale.sheetBlockWidth;
  const sheetBlockTop = sheetBlockBottom - scale.sheetBlockHeight;

  const origBlockLeft = innerLeft;
  const origBlockBottom = innerBottom;
  const origBlockWidth = scale.isLarge ? 200 : 140;
  const origBlockHeight = scale.isLarge ? 64 : 50;
  const origBlockTop = origBlockBottom - origBlockHeight;

  return (
    <Page size={pageSize} style={styles.page} wrap={false}>
      {/* Layout-anchor sized to the full page so react-pdf gives the Page
          its actual dimensions even though every visible element is
          absolutely positioned. */}
      <View style={{ width, height }} />

      {/* Perimeter rule */}
      <View
        style={{
          ...styles.perimeter,
          left: PERIMETER_INSET,
          top: PERIMETER_INSET,
          width: innerWidth,
          height: innerHeight,
        }}
      />

      {/* Top BrandBar */}
      <View
        style={{
          position: 'absolute',
          left: innerLeft,
          right: width - innerRight,
          top: innerTop,
        }}
      >
        <BrandBar
          pageLabel={`${title.toUpperCase()} — OVERLAID TITLE BLOCK`}
          sheetId={sheetId}
        />
      </View>

      {/* Bottom-left original-size + boilerplate. */}
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

      {/* Bottom-right sheet-number block. */}
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

      {/* Right-margin vertical strip. */}
      <View
        style={{
          ...styles.rightStrip,
          left: stripLeft,
          top: stripTop,
          width: scale.rightStripWidth,
          height: stripHeight - scale.sheetBlockHeight,
        }}
      >
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

        <View style={{ ...styles.stripCell, padding: scale.stripCellPad }}>
          <Text style={{ ...styles.stripCellLabel, fontSize: scale.labelFont }}>
            Project
          </Text>
          <Text style={{ ...styles.stripCellValue, fontSize: scale.bodyFont }}>
            {projectName}
          </Text>
        </View>

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

        <View style={{ ...styles.stripCell, padding: scale.stripCellPad }}>
          <Text style={{ ...styles.stripCellLabel, fontSize: scale.labelFont }}>
            Permit / Job No.
          </Text>
          <Text style={{ ...styles.stripCellValue, fontSize: scale.bodyFont }}>
            {permitNumber || 'TBD'}
          </Text>
        </View>

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

        <View style={{ padding: scale.stripCellPad }}>
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

export default AttachmentTitleBlock;
