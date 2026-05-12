/**
 * AttachmentTitleSheet (Sprint 2B PR-3)
 *
 * SparkPlan-themed cover page rendered immediately before each user-uploaded
 * artifact in the merged permit packet. Carries:
 *   - BrandBar at top (logo + page label + sheet ID pill)
 *   - Large drawing title ("SITE PLAN", "EQUIPMENT CUT SHEETS", etc.)
 *   - Sheet ID prominent in the body (not just the brand bar)
 *   - "Provided by [Contractor]" attribution block
 *   - "Date Received" block (the date the contractor uploaded the artifact)
 *   - Project metadata block
 *   - Empty signature / seal area
 *
 * ## Size-aware rendering
 *
 * The component accepts an explicit `pageSize` tuple — `[width_pt, height_pt]`
 * in PDF points (72 per inch). The orchestrator (`permitPacketGenerator.tsx`)
 * inspects the upload's first page via `pdf-lib` and forwards the dimensions
 * here so the title sheet matches the upload page-for-page. Letter portrait,
 * Letter landscape, ARCH D 24x36, custom architectural sheets — all rendered
 * by the same component.
 *
 * Landscape detection: `width > height`. When landscape, the central content
 * card stretches wider; otherwise it lays out vertically.
 *
 * ## Wrap behavior
 *
 * Sprint 2A pattern (`wrap={false}`) — the central content card never splits
 * across pages. Title sheets are designed to be one page exactly; if an
 * overflow ever happened react-pdf would re-emit the BrandBar (with the same
 * sheetId) on the spillover page, breaking the sheet ID uniqueness invariant.
 *
 * ## Pure render
 *
 * No hooks, no DB, no side effects — just react-pdf primitives. The
 * orchestrator owns "fetch attachment bytes, call this component, render
 * to Uint8Array via `pdf()`".
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
   * 8.5x11, so this default is exercised 80-90% of the time.
   */
  pageSize?: [number, number];
}

// ---------------------------------------------------------------------------
// Local styles — keyed off the shared theme but adapted for a title-sheet
// layout (much more whitespace, bigger banner, no per-sheet contractor block).
// ---------------------------------------------------------------------------

const localStyles = StyleSheet.create({
  // Outer body padding (slightly looser than the dense electrical sheets).
  page: {
    paddingTop: 28,
    paddingHorizontal: 40,
    paddingBottom: 36,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#111827',
    backgroundColor: '#ffffff',
  },

  // Outer card that wraps the whole title page content (no auto-pagination
  // — uses Sprint 2A `wrap={false}` to keep the card cohesive).
  card: {
    borderWidth: 1.5,
    borderColor: BRAND_DARK,
    borderRadius: 4,
    padding: 22,
    marginTop: 18,
  },

  // Big banner title (e.g., "SITE PLAN").
  bannerTitle: {
    fontSize: 30,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_DARK,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  bannerDescription: {
    fontSize: 10.5,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 18,
  },

  // Inline sheet ID badge — bigger than the BrandBar pill so it scans from
  // across a desk (matches the AHJ-citation pattern from Sprint 2A H3).
  sheetIdRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  sheetIdBadge: {
    backgroundColor: BRAND_YELLOW,
    borderWidth: 1,
    borderColor: BRAND_DARK,
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 4,
  },
  sheetIdBadgeText: {
    color: BRAND_DARK,
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.5,
  },

  // Two-column metadata strip.
  metaRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 8,
    marginBottom: 4,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 7,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },
  metaSubValue: {
    fontSize: 9,
    color: '#374151',
    marginTop: 1,
  },

  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginVertical: 10,
  },

  // Project info two-column grid.
  projectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  projectCell: {
    width: '50%',
    paddingVertical: 4,
    paddingRight: 8,
  },

  // Signature / seal block — empty placeholder for the AHJ or PE to wet-sign
  // onto the title sheet (some AHJs require artifact attribution + seal).
  sigBlock: {
    marginTop: 18,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
  },
  sigRow: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 4,
  },
  sigField: {
    flex: 1,
  },
  sigLine: {
    borderBottomWidth: 0.75,
    borderBottomColor: '#374151',
    height: 22,
    marginBottom: 2,
  },
  sigLabel: {
    fontSize: 7,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Bottom-of-page note (fixed) — clarifies that the next page is the actual
  // user-supplied artifact, not generated content.
  bottomNote: {
    position: 'absolute',
    bottom: 18,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#9ca3af',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 4,
  },
  bottomNoteText: {
    fontSize: 7,
    color: '#9ca3af',
  },

  // Landscape variants — kept narrow because most uploads are portrait.
  bannerTitleLandscape: {
    fontSize: 38,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_DARK,
    letterSpacing: 2.5,
    textAlign: 'center',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  cardLandscape: {
    borderWidth: 1.5,
    borderColor: BRAND_DARK,
    borderRadius: 4,
    padding: 28,
    marginTop: 22,
  },
});

// ---------------------------------------------------------------------------
// Component
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

/**
 * Render a SparkPlan-themed title sheet that precedes a user-uploaded
 * artifact in the merged permit packet.
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
  const isLandscape = width > height;
  const title = displayTitle?.trim() || ARTIFACT_DISPLAY_TITLES[artifactType];
  const description = ARTIFACT_DESCRIPTIONS[artifactType];
  const receivedLabel = dateReceived ? formatDate(dateReceived) : todayStr();

  const pageStyle = { ...localStyles.page, ...themeStyles.page, paddingBottom: 36 };

  return (
    <Page size={pageSize} style={pageStyle}>
      <BrandBar
        pageLabel={`${title.toUpperCase()} — TITLE SHEET`}
        sheetId={sheetId}
      />

      {/* Central content card — wrap={false} per Sprint 2A pattern. The
          title sheet is always 1 page; if react-pdf ever tried to split it
          the fixed BrandBar would re-render with the same sheetId on the
          spillover page (breaking the H3 uniqueness invariant). */}
      <View
        style={isLandscape ? localStyles.cardLandscape : localStyles.card}
        wrap={false}
      >
        <Text
          style={isLandscape ? localStyles.bannerTitleLandscape : localStyles.bannerTitle}
        >
          {title}
        </Text>
        <Text style={localStyles.bannerDescription}>{description}</Text>

        <View style={localStyles.sheetIdRow}>
          <View style={localStyles.sheetIdBadge}>
            <Text style={localStyles.sheetIdBadgeText}>{sheetId}</Text>
          </View>
        </View>

        <View style={localStyles.divider} />

        {/* Provided by / Date received row */}
        <View style={localStyles.metaRow}>
          <View style={localStyles.metaCol}>
            <Text style={localStyles.metaLabel}>Provided By</Text>
            <Text style={localStyles.metaValue}>
              {contractorName || 'Project Contractor'}
            </Text>
            {contractorLicense ? (
              <Text style={localStyles.metaSubValue}>
                License #: {contractorLicense}
              </Text>
            ) : null}
          </View>
          <View style={localStyles.metaCol}>
            <Text style={localStyles.metaLabel}>Date Received</Text>
            <Text style={localStyles.metaValue}>{receivedLabel}</Text>
          </View>
        </View>

        <View style={localStyles.divider} />

        {/* Project metadata block */}
        <View style={localStyles.projectGrid}>
          <View style={localStyles.projectCell}>
            <Text style={localStyles.metaLabel}>Project Name</Text>
            <Text style={localStyles.metaValue}>{projectName}</Text>
          </View>
          <View style={localStyles.projectCell}>
            <Text style={localStyles.metaLabel}>Project Address</Text>
            <Text style={localStyles.metaValue}>
              {projectAddress || 'Not specified'}
            </Text>
          </View>
          {permitNumber ? (
            <View style={localStyles.projectCell}>
              <Text style={localStyles.metaLabel}>Permit Number</Text>
              <Text style={localStyles.metaValue}>{permitNumber}</Text>
            </View>
          ) : null}
          <View style={localStyles.projectCell}>
            <Text style={localStyles.metaLabel}>Artifact Type</Text>
            <Text style={localStyles.metaValue}>{title}</Text>
          </View>
        </View>

        {/* Signature / seal area — left intentionally empty so an AHJ
            reviewer or PE can wet-sign the title sheet attributing the
            following artifact. */}
        <View style={localStyles.sigBlock}>
          <Text style={localStyles.metaLabel}>Signature / Seal Area</Text>
          <View style={localStyles.sigRow}>
            <View style={localStyles.sigField}>
              <View style={localStyles.sigLine} />
              <Text style={localStyles.sigLabel}>Signature</Text>
            </View>
            <View style={localStyles.sigField}>
              <View style={localStyles.sigLine} />
              <Text style={localStyles.sigLabel}>Date</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Fixed bottom note — clarifies the user-supplied content follows */}
      <View style={localStyles.bottomNote} fixed>
        <Text style={localStyles.bottomNoteText}>
          SparkPlan {'•'} {projectName}
        </Text>
        <Text style={localStyles.bottomNoteText}>
          User-supplied artifact follows this sheet
        </Text>
        <Text style={localStyles.bottomNoteText}>
          Generated {todayStr()}
        </Text>
      </View>
    </Page>
  );
};

export default AttachmentTitleSheet;
