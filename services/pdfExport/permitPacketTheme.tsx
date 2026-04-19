/**
 * Shared theme for SparkPlan permit packet PDFs.
 *
 * Every page in the packet imports from this module so the 27-page
 * output reads as one document instead of a stack of mismatched PDFs.
 * Factored out of services/pdfExport/CommercialLoadDocument.tsx.
 *
 * Font constraints (built-in Helvetica StandardEncoding only):
 * - PHASE uses "Ø" (U+00D8), which IS in Helvetica. "Φ", "φ", and
 *   "\u03C6" fall back to wrong glyphs (Æ) or render literal escapes.
 * - Ω, Σ, √, ≤, ≥, ✓, ✗, →, •: either spell out or use ASCII
 *   equivalents ("ohm", "sqrt", "<=", ">=", "Y/N", "->", "-").
 * - JSX text vs JS string: "\u2022" inside JSX children renders
 *   literally; only JS string literals interpret escapes.
 */

import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';

// ==================== BRAND CONSTANTS ====================

export const BRAND_DARK = '#2d3b2d';
export const BRAND_YELLOW = '#FFCC00';

/** Phase symbol. Use this everywhere instead of Φ / φ / \u03C6. */
export const PHASE = 'Ø';

/** Format 1 / 3 as "1Ø" / "3Ø". */
export const phaseLabel = (phase: number | string): string => `${phase}${PHASE}`;

// ==================== HELPERS ====================

export const todayStr = (): string =>
  new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

// ==================== STYLES ====================

export const themeStyles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingHorizontal: 32,
    paddingBottom: 44, // room for footer
    fontSize: 9.5,
    fontFamily: 'Helvetica',
    color: '#111827',
  },

  // --- Brand bar (fixed to top of every page) ---
  brandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: BRAND_DARK,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  brandBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandBolt: {
    width: 11,
    height: 11,
    backgroundColor: BRAND_YELLOW,
    marginRight: 6,
  },
  brandName: {
    color: '#ffffff',
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
  },
  brandBarRight: {
    color: '#cfd8cf',
    fontSize: 8,
  },

  // --- Document title block ---
  titleBlock: {
    marginBottom: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: BRAND_DARK,
    paddingBottom: 4,
  },
  docTitle: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_DARK,
    marginBottom: 1,
  },
  docSubtitle: {
    fontSize: 9,
    color: '#6b7280',
  },

  // --- Section headers ---
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    backgroundColor: BRAND_DARK,
    paddingVertical: 3,
    paddingHorizontal: 7,
    marginTop: 8,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  subSectionTitle: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_DARK,
    marginTop: 6,
    marginBottom: 2,
  },

  // --- Project info grid (4-col) ---
  projectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  projectCell: {
    width: '25%',
    paddingVertical: 2,
    paddingRight: 6,
  },
  projectCellWide: {
    width: '50%',
    paddingVertical: 2,
    paddingRight: 6,
  },
  projectLabel: {
    fontSize: 6.5,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 0,
  },
  projectValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },

  // --- Summary cards (key metrics row) ---
  summaryRow: {
    flexDirection: 'row',
    marginTop: 4,
    marginBottom: 4,
    gap: 6,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 3,
    padding: 6,
  },
  summaryCardHighlight: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: BRAND_YELLOW,
    borderRadius: 3,
    padding: 6,
    backgroundColor: '#fffbe6',
  },
  summaryLabel: {
    fontSize: 6.5,
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_DARK,
  },
  summaryUnit: {
    fontSize: 9,
    color: '#6b7280',
    marginLeft: 2,
  },
  summarySub: {
    fontSize: 7.5,
    color: '#6b7280',
    marginTop: 1,
  },

  // --- Tables ---
  table: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#fafafa',
  },
  tableTotalRow: {
    flexDirection: 'row',
    backgroundColor: BRAND_DARK,
    paddingVertical: 3,
  },
  th: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
    padding: 3.5,
    textAlign: 'left',
  },
  td: {
    fontSize: 7.5,
    color: '#111827',
    padding: 3.5,
  },
  tdNum: {
    fontSize: 7.5,
    color: '#111827',
    padding: 3.5,
    textAlign: 'right',
  },
  tdBold: {
    fontSize: 8,
    color: '#ffffff',
    padding: 3.5,
    fontFamily: 'Helvetica-Bold',
  },
  tdBoldNum: {
    fontSize: 8,
    color: '#ffffff',
    padding: 3.5,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
  },

  // --- Callouts ---
  warningBox: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderLeftWidth: 2.5,
    borderLeftColor: '#f59e0b',
    padding: 5,
    marginBottom: 3,
  },
  warningText: {
    fontSize: 8.5,
    color: '#78350f',
  },
  noteBox: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderLeftWidth: 2.5,
    borderLeftColor: '#3b82f6',
    padding: 5,
    marginBottom: 3,
  },
  noteText: {
    fontSize: 8.5,
    color: '#1e3a8a',
  },

  // --- Scope-of-work paragraph / prose block ---
  proseBlock: {
    fontSize: 9,
    lineHeight: 1.5,
    color: '#111827',
    marginBottom: 4,
  },

  // --- Signature block ---
  signatureBlock: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
  },
  sigField: {
    flex: 1,
  },
  sigLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#6b7280',
    height: 18,
    marginBottom: 2,
  },
  sigLabel: {
    fontSize: 6.5,
    color: '#6b7280',
    textTransform: 'uppercase',
  },

  // --- Footer (fixed to bottom of every page) ---
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#9ca3af',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 4,
  },
  footerText: {
    fontSize: 7,
    color: '#9ca3af',
  },
});

// ==================== COMPONENTS ====================

interface BrandBarProps {
  /** Right-aligned page label, e.g., "PERMIT APPLICATION" or "VOLTAGE DROP". */
  pageLabel: string;
}

export const BrandBar: React.FC<BrandBarProps> = ({ pageLabel }) => (
  <View style={themeStyles.brandBar} fixed>
    <View style={themeStyles.brandBarLeft}>
      <View style={themeStyles.brandBolt} />
      <Text style={themeStyles.brandName}>SPARKPLAN</Text>
    </View>
    <Text style={themeStyles.brandBarRight}>{pageLabel}</Text>
  </View>
);

interface FooterProps {
  /** Left-column: project name (so packets from different jobs are distinguishable). */
  projectName: string;
}

export const Footer: React.FC<FooterProps> = ({ projectName }) => (
  <View style={themeStyles.footer} fixed>
    <Text style={themeStyles.footerText}>
      SparkPlan {'\u2022'} {projectName}
    </Text>
    <Text
      style={themeStyles.footerText}
      render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
    />
    <Text style={themeStyles.footerText}>Generated {todayStr()}</Text>
  </View>
);
