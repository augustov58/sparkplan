/**
 * Bid PDF generator for an estimate.
 *
 * Uses @react-pdf/renderer (same library as the permit packet) and the brand
 * theme from services/pdfExport/permitPacketTheme so a SparkPlan bid PDF
 * looks and feels like a SparkPlan permit packet — same brand strip, same
 * footer treatment.
 *
 * Pages:
 *   1. Cover — customer info, scope, total summary card
 *   2. Detailed line items, grouped by category
 *   3. Terms & conditions
 *   4. Signature page
 *
 * Output: a `<Document>` ready to be passed to `pdf()` for browser blob
 * generation. Storage upload is the caller's job.
 */

import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { Database } from '@/lib/database.types';
import {
  BrandBar,
  Footer as BrandFooter,
  themeStyles,
  todayStr,
  BRAND_DARK,
  BRAND_YELLOW,
} from '@/services/pdfExport/permitPacketTheme';
import { computeEstimateTotals } from './estimateMath';

type Estimate = Database['public']['Tables']['estimates']['Row'];
type LineItem = Database['public']['Tables']['estimate_line_items']['Row'];
type Project = Database['public']['Tables']['projects']['Row'];

const PAGE_LABEL = 'BID / ESTIMATE';

interface EstimateBidDocumentProps {
  estimate: Estimate;
  lineItems: LineItem[];
  project: Pick<Project, 'name' | 'address'> | null;
  contractorName?: string;
  contractorLicense?: string;
}

const styles = StyleSheet.create({
  totalCard: {
    borderWidth: 1.5,
    borderColor: BRAND_YELLOW,
    backgroundColor: '#fffbe6',
    borderRadius: 4,
    padding: 12,
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 1,
  },
  totalLabel: {
    fontSize: 10,
    color: '#6b7280',
  },
  totalValue: {
    fontSize: 10,
    color: '#111827',
    fontFamily: 'Helvetica-Bold',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: BRAND_DARK,
  },
  grandTotalLabel: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_DARK,
  },
  grandTotalValue: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_DARK,
  },
  customerBlock: {
    marginVertical: 8,
    padding: 8,
    borderWidth: 0.75,
    borderColor: '#e5e7eb',
    borderRadius: 3,
  },
  scopeBlock: {
    marginTop: 6,
    marginBottom: 6,
  },
  lineItemTable: {
    borderWidth: 0.75,
    borderColor: '#d1d5db',
    marginBottom: 8,
  },
  lineItemRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#f3f4f6',
    paddingVertical: 2,
  },
  lineItemHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    paddingVertical: 3,
    borderBottomWidth: 0.75,
    borderBottomColor: '#d1d5db',
  },
  cellDescription: { width: '52%', paddingHorizontal: 4, fontSize: 8 },
  cellQty: { width: '10%', paddingHorizontal: 4, fontSize: 8, textAlign: 'right' },
  cellUnit: { width: '8%', paddingHorizontal: 4, fontSize: 8 },
  cellPrice: { width: '15%', paddingHorizontal: 4, fontSize: 8, textAlign: 'right' },
  cellTotal: { width: '15%', paddingHorizontal: 4, fontSize: 8, textAlign: 'right', fontFamily: 'Helvetica-Bold' },
  categoryHeader: {
    backgroundColor: BRAND_DARK,
    color: '#ffffff',
    paddingVertical: 3,
    paddingHorizontal: 5,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
    marginTop: 6,
  },
});

const fmt$ = (n: number): string =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CATEGORY_ORDER: Array<LineItem['category']> = [
  'material',
  'labor',
  'equipment',
  'subcontract',
  'other',
];

const CATEGORY_LABELS: Record<string, string> = {
  material: 'MATERIALS',
  labor: 'LABOR',
  equipment: 'EQUIPMENT',
  subcontract: 'SUBCONTRACTORS',
  other: 'OTHER',
};

export const EstimateBidDocument: React.FC<EstimateBidDocumentProps> = ({
  estimate,
  lineItems,
  project,
  contractorName,
  contractorLicense,
}) => {
  const totals = computeEstimateTotals({
    lineItems: lineItems.map((li) => ({
      category: li.category,
      quantity: li.quantity,
      unit_price: li.unit_price,
      taxable: li.taxable,
    })),
    markupPct: estimate.markup_pct,
    taxPct: estimate.tax_pct,
  });

  // Group line items by category for the detail table.
  const byCategory: Record<string, LineItem[]> = {};
  for (const li of lineItems) {
    const k = li.category;
    if (!byCategory[k]) byCategory[k] = [];
    byCategory[k].push(li);
  }
  // Sort each group by position.
  for (const k of Object.keys(byCategory)) {
    byCategory[k].sort((a, b) => a.position - b.position);
  }

  const projectName = project?.name ?? 'Project';
  const projectAddress = project?.address ?? '';
  const expiresStr = estimate.expires_at
    ? new Date(estimate.expires_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'N/A';

  return (
    <Document
      title={`Bid — ${estimate.name}`}
      author="SparkPlan"
      subject={`Estimate ${estimate.estimate_number ?? ''} for ${projectName}`}
    >
      {/* ============== COVER ============== */}
      <Page size="LETTER" style={themeStyles.page}>
        <BrandBar pageLabel={PAGE_LABEL} />

        <View style={themeStyles.titleBlock}>
          <Text style={themeStyles.docTitle}>{estimate.name}</Text>
          <Text style={themeStyles.docSubtitle}>
            {estimate.estimate_number ? `Estimate #${estimate.estimate_number}  •  ` : ''}
            Revision {estimate.revision}  •  Prepared {todayStr()}
          </Text>
        </View>

        {/* Customer block */}
        <View style={styles.customerBlock}>
          <Text style={themeStyles.subSectionTitle}>PREPARED FOR</Text>
          <Text style={themeStyles.proseBlock}>
            {estimate.customer_name ?? '(Customer name not provided)'}
            {'\n'}
            {estimate.customer_email ?? ''}
            {estimate.customer_email && estimate.customer_address ? '\n' : ''}
            {estimate.customer_address ?? ''}
          </Text>
        </View>

        {/* Project block */}
        <View style={styles.customerBlock}>
          <Text style={themeStyles.subSectionTitle}>PROJECT</Text>
          <Text style={themeStyles.proseBlock}>
            {projectName}
            {projectAddress ? `\n${projectAddress}` : ''}
          </Text>
        </View>

        {/* Total summary card */}
        <View style={styles.totalCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Materials</Text>
            <Text style={styles.totalValue}>{fmt$(totals.subtotalMaterials)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Labor</Text>
            <Text style={styles.totalValue}>{fmt$(totals.subtotalLabor)}</Text>
          </View>
          {totals.subtotalEquipment + totals.subtotalSubcontract + totals.subtotalOther > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Equipment / Subcontract / Other</Text>
              <Text style={styles.totalValue}>
                {fmt$(totals.subtotalEquipment + totals.subtotalSubcontract + totals.subtotalOther)}
              </Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{fmt$(totals.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              Overhead + Profit ({estimate.markup_pct.toFixed(1)}%)
            </Text>
            <Text style={styles.totalValue}>{fmt$(totals.markupAmount)}</Text>
          </View>
          {totals.taxAmount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                Sales tax ({estimate.tax_pct.toFixed(2)}% on materials)
              </Text>
              <Text style={styles.totalValue}>{fmt$(totals.taxAmount)}</Text>
            </View>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>TOTAL</Text>
            <Text style={styles.grandTotalValue}>{fmt$(totals.total)}</Text>
          </View>
        </View>

        {estimate.scope_summary && (
          <View style={styles.scopeBlock}>
            <Text style={themeStyles.subSectionTitle}>SCOPE OF WORK</Text>
            <Text style={themeStyles.proseBlock}>{estimate.scope_summary}</Text>
          </View>
        )}

        <Text style={themeStyles.proseBlock}>
          This bid is valid through{' '}
          <Text style={{ fontFamily: 'Helvetica-Bold' }}>{expiresStr}</Text>.
        </Text>

        <BrandFooter
          projectName={projectName}
          contractorName={contractorName}
          contractorLicense={contractorLicense}
        />
      </Page>

      {/* ============== DETAIL ============== */}
      <Page size="LETTER" style={themeStyles.page}>
        <BrandBar pageLabel={PAGE_LABEL} />

        <View style={themeStyles.titleBlock}>
          <Text style={themeStyles.docTitle}>Detailed Line Items</Text>
          <Text style={themeStyles.docSubtitle}>
            All quantities and prices are itemized below.
          </Text>
        </View>

        {CATEGORY_ORDER.map((cat) => {
          const rows = byCategory[cat] ?? [];
          if (rows.length === 0) return null;
          const groupTotal = rows.reduce((acc, r) => acc + r.line_total, 0);
          return (
            <View key={cat} wrap={false}>
              <Text style={styles.categoryHeader}>{CATEGORY_LABELS[cat] ?? cat.toUpperCase()}</Text>
              <View style={styles.lineItemTable}>
                <View style={styles.lineItemHeader}>
                  <Text style={styles.cellDescription}>Description</Text>
                  <Text style={styles.cellQty}>Qty</Text>
                  <Text style={styles.cellUnit}>Unit</Text>
                  <Text style={styles.cellPrice}>Unit Price</Text>
                  <Text style={styles.cellTotal}>Total</Text>
                </View>
                {rows.map((r) => (
                  <View key={r.id} style={styles.lineItemRow}>
                    <Text style={styles.cellDescription}>{r.description}</Text>
                    <Text style={styles.cellQty}>{r.quantity.toLocaleString()}</Text>
                    <Text style={styles.cellUnit}>{r.unit ?? ''}</Text>
                    <Text style={styles.cellPrice}>{fmt$(r.unit_price)}</Text>
                    <Text style={styles.cellTotal}>{fmt$(r.line_total)}</Text>
                  </View>
                ))}
                <View style={[styles.lineItemRow, { backgroundColor: '#f9fafb' }]}>
                  <Text style={[styles.cellDescription, { fontFamily: 'Helvetica-Bold' }]}>
                    {CATEGORY_LABELS[cat] ?? cat} subtotal
                  </Text>
                  <Text style={styles.cellQty} />
                  <Text style={styles.cellUnit} />
                  <Text style={styles.cellPrice} />
                  <Text style={styles.cellTotal}>{fmt$(groupTotal)}</Text>
                </View>
              </View>
            </View>
          );
        })}

        <BrandFooter
          projectName={projectName}
          contractorName={contractorName}
          contractorLicense={contractorLicense}
        />
      </Page>

      {/* ============== TERMS + SIGNATURE ============== */}
      <Page size="LETTER" style={themeStyles.page}>
        <BrandBar pageLabel={PAGE_LABEL} />

        <View style={themeStyles.titleBlock}>
          <Text style={themeStyles.docTitle}>Terms &amp; Signature</Text>
        </View>

        {estimate.exclusions && (
          <View style={styles.scopeBlock} wrap={false}>
            <Text style={themeStyles.subSectionTitle}>EXCLUSIONS</Text>
            <Text style={themeStyles.proseBlock}>{estimate.exclusions}</Text>
          </View>
        )}

        {estimate.payment_terms && (
          <View style={styles.scopeBlock} wrap={false}>
            <Text style={themeStyles.subSectionTitle}>PAYMENT TERMS</Text>
            <Text style={themeStyles.proseBlock}>{estimate.payment_terms}</Text>
          </View>
        )}

        <View style={styles.scopeBlock} wrap={false}>
          <Text style={themeStyles.subSectionTitle}>VALIDITY</Text>
          <Text style={themeStyles.proseBlock}>
            Pricing in this bid is valid through {expiresStr}. Material costs are
            subject to fluctuation; bids submitted past the validity date may
            require re-pricing before acceptance.
          </Text>
        </View>

        <View style={themeStyles.signatureBlock} wrap={false}>
          <View style={themeStyles.sigField}>
            <View style={themeStyles.sigLine} />
            <Text style={themeStyles.sigLabel}>Customer signature / Date</Text>
          </View>
          <View style={themeStyles.sigField}>
            <View style={themeStyles.sigLine} />
            <Text style={themeStyles.sigLabel}>Contractor signature / Date</Text>
          </View>
        </View>

        <BrandFooter
          projectName={projectName}
          contractorName={contractorName}
          contractorLicense={contractorLicense}
        />
      </Page>
    </Document>
  );
};
