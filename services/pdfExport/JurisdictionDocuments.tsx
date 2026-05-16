/**
 * Jurisdiction Requirements PDF Document
 *
 * React-PDF document component for jurisdiction permit requirements checklist
 * Included in permit packet when project has jurisdiction_id set
 *
 * Sprint 2C M1: when an `AHJManifest` is passed alongside the legacy
 * `Jurisdiction` row, the page is now driven by the checklist engine
 * (`services/jurisdictionChecklist/checklistEngine`) and groups items by
 * category. When `manifest.requirements` is empty (Orlando today) or no
 * manifest is supplied, the page falls back to the decorative pre-M1
 * rendering so existing callers keep working unchanged.
 *
 * @remarks
 * Follows existing PDF export patterns (PanelScheduleDocuments, ShortCircuitDocuments)
 * - React-PDF components (Document, Page, View, Text)
 * - StyleSheet for consistent formatting
 * - Portrait orientation on LETTER size
 * - Professional layout with checklists
 *
 * @example
 * ```tsx
 * <JurisdictionRequirementsDocument
 *   jurisdiction={jurisdiction}
 *   projectName="Commercial Office Building"
 * />
 * ```
 */

import React from 'react';
import { Page, Text, View, StyleSheet, Document } from '@react-pdf/renderer';
import type { Jurisdiction } from '../../types';
import { DOCUMENT_LABELS, CALCULATION_LABELS } from '../../types';
import {
  BrandBar,
  Footer as BrandFooter,
  themeStyles,
} from './permitPacketTheme';
import type {
  AHJContext,
  AHJManifest,
  AttachmentSummary,
  PacketAST,
} from '../../data/ahj/types';
import { evaluatePacket } from '../jurisdictionChecklist/checklistEngine';
import type {
  ChecklistResult,
  ChecklistResultItem,
} from '../jurisdictionChecklist/types';

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: 'Helvetica',
  },
  header: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 20,
    borderBottom: '2pt solid black',
    paddingBottom: 8,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    color: '#1e40af',  // Blue-700
  },
  jurisdictionInfo: {
    backgroundColor: '#eff6ff',  // Blue-50
    padding: 12,
    borderRadius: 4,
    marginBottom: 15,
  },
  infoText: {
    fontSize: 8,
    color: '#374151',  // Gray-700
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    paddingLeft: 10,
  },
  checkbox: {
    width: 10,
    height: 10,
    border: '1pt solid #22c55e',  // Green-500
    marginRight: 8,
    marginTop: 2,
  },
  itemText: {
    fontSize: 9,
    flex: 1,
  },
  notes: {
    backgroundColor: '#fef3c7',  // Yellow-100
    padding: 10,
    borderRadius: 4,
    marginTop: 10,
    fontSize: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 7,
    color: '#6b7280',  // Gray-500
    textAlign: 'center',
  },

  // ----- Sprint 2C M1: engine-driven checklist styles -----
  summaryBanner: {
    backgroundColor: '#f3f4f6',
    padding: 10,
    borderRadius: 4,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryBannerOk: {
    backgroundColor: '#ecfdf5', // Green-50
  },
  summaryBannerFail: {
    backgroundColor: '#fef2f2', // Red-50
  },
  summaryLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 5,
    paddingLeft: 10,
  },
  glyphPass: {
    width: 14,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#15803d', // Green-700
    marginRight: 6,
  },
  glyphFail: {
    width: 14,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#b91c1c', // Red-700
    marginRight: 6,
  },
  glyphWarn: {
    width: 14,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#a16207', // Amber-700
    marginRight: 6,
  },
  glyphNa: {
    width: 14,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#9ca3af', // Gray-400
    marginRight: 6,
  },
  itemTextNa: {
    fontSize: 9,
    flex: 1,
    color: '#9ca3af', // Gray-400
  },
  itemTextFail: {
    fontSize: 9,
    flex: 1,
    color: '#b91c1c', // Red-700
    fontFamily: 'Helvetica-Bold',
  },
  itemLocation: {
    fontSize: 8,
    color: '#6b7280',
    // Reset family so the italic variant resolves against base Helvetica (Helvetica-Oblique exists).
    // Without this, the rule nests inside `itemTextFail` (Helvetica-Bold) and react-pdf can't find
    // a Helvetica-Bold italic variant, crashing the entire packet render.
    fontFamily: 'Helvetica',
    fontStyle: 'italic',
    marginLeft: 4,
  },
  emptyNotice: {
    backgroundColor: '#fef3c7',
    padding: 10,
    borderRadius: 4,
    marginVertical: 10,
    fontSize: 9,
    color: '#92400e',
  },
  warningsBlock: {
    backgroundColor: '#fef3c7',
    padding: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  warningsTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
    color: '#92400e',
  },
  warningsText: {
    fontSize: 7,
    color: '#92400e',
  },
});

// ============================================================================
// ENGINE-DRIVEN SUB-COMPONENTS (Sprint 2C M1)
// ============================================================================

/**
 * Display labels for each category. Mirrors `AHJRequirement.category`.
 */
const CATEGORY_LABELS: Record<ChecklistResultItem['category'], string> = {
  plan: 'Plans & Drawings',
  application: 'Permit Application Forms',
  narrative: 'Narrative Pages',
  inspection: 'Inspection Hold-Points',
  upload: 'Uploaded Attachments',
};

const CATEGORY_ORDER: ChecklistResultItem['category'][] = [
  'plan',
  'application',
  'narrative',
  'upload',
  'inspection',
];

/**
 * Single rendered checklist row. Picks glyph + style off the severity.
 *
 *   pass → `[X]` green
 *   fail → `MISSING` red (the renderer's blocker — caller MUST fix before AHJ)
 *   warn → `[+]` amber (optional artifact submitted; fine)
 *   na   → dimmed `—` gray  (not applicable; rendered for completeness)
 */
const ChecklistRow: React.FC<{ item: ChecklistResultItem }> = ({ item }) => {
  let glyphStyle = styles.glyphPass;
  let glyph = '[X]';
  let textStyle = styles.itemText;

  switch (item.severity) {
    case 'pass':
      glyphStyle = styles.glyphPass;
      glyph = '[X]';
      textStyle = styles.itemText;
      break;
    case 'fail':
      glyphStyle = styles.glyphFail;
      glyph = '[ ]';
      textStyle = styles.itemTextFail;
      break;
    case 'warn':
      glyphStyle = styles.glyphWarn;
      glyph = '[+]';
      textStyle = styles.itemText;
      break;
    case 'na':
      glyphStyle = styles.glyphNa;
      glyph = '—';
      textStyle = styles.itemTextNa;
      break;
  }

  return (
    <View style={styles.itemRow}>
      <Text style={glyphStyle}>{glyph}</Text>
      <Text style={textStyle}>
        {item.name}
        {item.location ? (
          <Text style={styles.itemLocation}> — see {item.location}</Text>
        ) : null}
        {item.severity === 'fail' ? (
          <Text style={styles.itemLocation}> — MISSING</Text>
        ) : null}
      </Text>
    </View>
  );
};

/**
 * Engine-driven checklist body. Groups items by category in CATEGORY_ORDER,
 * suppresses empty groups, renders one row per item.
 */
const EngineDrivenChecklist: React.FC<{
  result: ChecklistResult;
  manifest: AHJManifest;
}> = ({ result, manifest }) => {
  if (result.items.length === 0) {
    // Empty manifest.requirements path (Orlando today). Render a one-line
    // notice so the page isn't visually empty.
    return (
      <View style={styles.emptyNotice}>
        <Text>
          No checklist requirements defined yet for {manifest.name}. The
          Sprint 2C M1 manifest agents will populate the per-jurisdiction
          requirements list.
        </Text>
      </View>
    );
  }

  // Group items by category, preserving manifest order within each group.
  const itemsByCategory = new Map<
    ChecklistResultItem['category'],
    ChecklistResultItem[]
  >();
  for (const item of result.items) {
    const bucket = itemsByCategory.get(item.category) ?? [];
    bucket.push(item);
    itemsByCategory.set(item.category, bucket);
  }

  return (
    <>
      {CATEGORY_ORDER.map((category) => {
        const items = itemsByCategory.get(category);
        if (!items || items.length === 0) return null;
        return (
          <View key={category} style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>
              {CATEGORY_LABELS[category]} ({items.length})
            </Text>
            {items.map((item) => (
              <ChecklistRow key={item.id} item={item} />
            ))}
          </View>
        );
      })}
    </>
  );
};

/**
 * Top-of-page summary banner: "X / Y required satisfied". Color-codes the
 * banner green when 0 failing, red when ≥1 failing.
 */
const SummaryBanner: React.FC<{ result: ChecklistResult }> = ({ result }) => {
  const { summary } = result;
  if (summary.total === 0) return null;
  const ok = summary.failing === 0;
  const bannerStyle = ok
    ? { ...styles.summaryBanner, ...styles.summaryBannerOk }
    : { ...styles.summaryBanner, ...styles.summaryBannerFail };
  return (
    <View style={bannerStyle}>
      <Text style={styles.summaryLabel}>
        {summary.passing} of {summary.totalRequired} required items satisfied
      </Text>
      <Text style={styles.summaryLabel}>
        {summary.failing > 0
          ? `${summary.failing} missing — packet incomplete`
          : 'Packet complete'}
      </Text>
    </View>
  );
};

// ============================================================================
// COMPONENT
// ============================================================================

interface JurisdictionRequirementsDocumentProps {
  /**
   * Legacy Jurisdiction row (from `public.jurisdictions`). When supplied
   * without a manifest, drives the pre-Sprint-2C-M1 decorative rendering
   * (required_documents + required_calculations as flat checklists). When
   * a manifest is also supplied, drives the jurisdiction-info box at the
   * top of the page (NEC edition, AHJ name, review days, source URL) but
   * the checklist body comes from the engine.
   */
  jurisdiction: Jurisdiction;
  projectName: string;
  // Sprint 2A C8: per-sheet contractor signature block
  contractorName?: string;
  contractorLicense?: string;
  // Sprint 2A H3: per-sheet ID
  sheetId?: string;
  // ----- Sprint 2C M1: engine integration props -----
  /**
   * Active AHJ manifest. When supplied, drives the engine-driven
   * checklist body. Empty `manifest.requirements` yields the "no
   * requirements defined yet" notice.
   */
  manifest?: AHJManifest;
  /**
   * Per-project AHJ-evaluation context (scope / lane / buildingType /
   * subjurisdiction). Required for engine evaluation; ignored if
   * `manifest` is absent.
   */
  ahjContext?: AHJContext;
  /**
   * Read-only packet AST (sheet IDs + section keys) — engine consumes
   * this for `requirement.detect(...)` predicates. Defaults to `{}` when
   * not supplied (predicates degrade gracefully).
   */
  packet?: PacketAST;
  /**
   * Project's uploaded artifact summaries — engine consumes this for
   * upload-detection predicates. Defaults to `[]` when not supplied.
   */
  attachments?: AttachmentSummary[];
}

export const JurisdictionRequirementsPages: React.FC<JurisdictionRequirementsDocumentProps> = ({
  jurisdiction,
  projectName,
  contractorName,
  contractorLicense,
  sheetId,
  manifest,
  ahjContext,
  packet,
  attachments,
}) => {
  // Sprint 2C M1: when a manifest is supplied, run the engine. Engine is
  // pure / never throws, but we still defensively shape the input.
  const engineResult: ChecklistResult | null =
    manifest && ahjContext
      ? evaluatePacket(packet ?? {}, attachments ?? [], manifest, ahjContext)
      : null;

  return (
    <Page size="LETTER" orientation="portrait" style={themeStyles.page}>
        <BrandBar pageLabel="JURISDICTION REQUIREMENTS" sheetId={sheetId} />
        <View style={themeStyles.titleBlock}>
          <Text style={themeStyles.docTitle}>Jurisdiction Requirements Checklist</Text>
          <Text style={themeStyles.docSubtitle}>{projectName}</Text>
        </View>

        {/* Jurisdiction Info Box */}
        <View style={styles.jurisdictionInfo}>
          <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>
            {manifest?.name ?? jurisdiction.jurisdiction_name}
          </Text>
          {jurisdiction.ahj_name && (
            <Text style={styles.infoText}>
              Authority: {jurisdiction.ahj_name}
            </Text>
          )}
          <Text style={{ ...styles.infoText, marginTop: 4 }}>
            NEC {jurisdiction.nec_edition} Adopted
            {jurisdiction.estimated_review_days &&
              ` • Typical Review: ${jurisdiction.estimated_review_days} days`}
          </Text>
        </View>

        {/* Sprint 2C M1: engine-driven checklist (when a manifest is supplied) */}
        {engineResult && manifest ? (
          <>
            <SummaryBanner result={engineResult} />
            <EngineDrivenChecklist result={engineResult} manifest={manifest} />
            {engineResult.warnings.length > 0 && (
              <View style={styles.warningsBlock}>
                <Text style={styles.warningsTitle}>
                  Engine notes ({engineResult.warnings.length})
                </Text>
                {engineResult.warnings.map((w, i) => (
                  <Text key={i} style={styles.warningsText}>
                    • {w}
                  </Text>
                ))}
              </View>
            )}
          </>
        ) : (
          <>
            {/* Legacy pre-M1 rendering — preserved for callers that pass a
                Jurisdiction row without a manifest. */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Required Documents ({jurisdiction.required_documents.length})
              </Text>
              {jurisdiction.required_documents.map((doc, index) => (
                <View key={index} style={styles.checklistItem}>
                  <View style={styles.checkbox} />
                  <Text style={styles.itemText}>
                    {DOCUMENT_LABELS[doc as keyof typeof DOCUMENT_LABELS] || doc}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Required Calculations ({jurisdiction.required_calculations.length})
              </Text>
              {jurisdiction.required_calculations.map((calc, index) => (
                <View key={index} style={styles.checklistItem}>
                  <View style={styles.checkbox} />
                  <Text style={styles.itemText}>
                    {CALCULATION_LABELS[calc as keyof typeof CALCULATION_LABELS] || calc}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Special Notes Section */}
        {jurisdiction.notes && (
          <View style={styles.notes}>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>
              Special Requirements:
            </Text>
            <Text style={{ fontSize: 8 }}>
              {jurisdiction.notes}
            </Text>
          </View>
        )}

        {/* Data Source Section */}
        {(jurisdiction.data_source || jurisdiction.source_url) && (
          <View style={{ marginTop: 15, padding: 10, backgroundColor: '#f9fafb', borderRadius: 4 }}>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', marginBottom: 4, color: '#374151' }}>
              Data Source:
            </Text>
            {jurisdiction.data_source && (
              <Text style={{ fontSize: 8, color: '#4b5563', marginBottom: 2 }}>
                {jurisdiction.data_source}
              </Text>
            )}
            {jurisdiction.source_url && (
              <Text style={{ fontSize: 8, color: '#1e40af', marginBottom: 2 }}>
                {jurisdiction.source_url}
              </Text>
            )}
            {jurisdiction.last_verified_date && (
              <Text style={{ fontSize: 7, color: '#6b7280', marginTop: 2 }}>
                Last verified: {new Date(jurisdiction.last_verified_date).toLocaleDateString()}
              </Text>
            )}
          </View>
        )}

        <BrandFooter
          projectName={projectName}
          contractorName={contractorName}
          contractorLicense={contractorLicense}
          sheetId={sheetId}
        />
      </Page>
  );
};

export const JurisdictionRequirementsDocument: React.FC<JurisdictionRequirementsDocumentProps> = (props) => (
  <Document>
    <JurisdictionRequirementsPages {...props} />
  </Document>
);
