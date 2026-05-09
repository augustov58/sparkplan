/**
 * InvoicePdfDocument — React-PDF renderer for a single T&M invoice.
 *
 * Sections:
 *   1. Header — SparkPlan brand bar + customer info + invoice meta
 *   2. Labor lines (one row per time entry, period-filtered)
 *   3. Material lines
 *   4. Subtotal / tax / total breakdown
 *   5. Payment terms + remit-to + notes
 *
 * Reuses BrandBar from `permitPacketTheme.tsx` for brand consistency.
 *
 * Style note: Helvetica only; avoid non-StandardEncoding glyphs. See
 * permitPacketTheme.tsx header for the gotchas.
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import {
  BrandBar,
  todayStr,
  BRAND_DARK,
  BRAND_YELLOW,
} from './permitPacketTheme';
import { formatUSD, formatHours } from '@/services/billing/billingMath';
import { STATUS_LABEL, type InvoiceStatus } from '@/services/billing/invoiceStatusTransitions';
import type { Database } from '@/lib/database.types';

type Invoice = Database['public']['Tables']['invoices']['Row'];
type TimeEntry = Database['public']['Tables']['time_entries']['Row'];
type MaterialEntry = Database['public']['Tables']['material_entries']['Row'];

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingHorizontal: 32,
    paddingBottom: 48,
    fontSize: 9.5,
    fontFamily: 'Helvetica',
    color: '#111827',
  },

  // --- Header block under the BrandBar ---
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
    paddingBottom: 10,
    borderBottom: `1pt solid ${BRAND_DARK}`,
  },
  billTo: { flex: 1 },
  billToLabel: {
    fontSize: 8,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 3,
  },
  billToName: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  billToLine: { fontSize: 9, color: '#333', marginBottom: 1 },
  invoiceMeta: {
    width: 200,
    paddingLeft: 12,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  metaLabel: { fontSize: 9, color: '#666' },
  metaValue: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  invoiceTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_DARK,
    marginBottom: 6,
  },
  statusPill: {
    alignSelf: 'flex-start',
    backgroundColor: BRAND_YELLOW,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
    marginBottom: 6,
  },
  statusPillText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_DARK,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // --- Section heading ---
  sectionHeading: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_DARK,
    marginTop: 8,
    marginBottom: 4,
    paddingBottom: 3,
    borderBottom: '0.5pt solid #ddd',
  },

  // --- Tables ---
  table: { marginBottom: 6 },
  thead: { flexDirection: 'row', backgroundColor: '#f3f4ed', paddingVertical: 3, paddingHorizontal: 2 },
  th: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#555', textTransform: 'uppercase' },
  tr: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderBottom: '0.25pt solid #eee',
  },
  td: { fontSize: 9, color: '#333' },

  // --- Totals block ---
  totals: {
    marginTop: 10,
    alignSelf: 'flex-end',
    width: 240,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  totalsLabel: { fontSize: 9, color: '#444' },
  totalsValue: { fontSize: 9 },
  totalsGrand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginTop: 4,
    borderTop: `1pt solid ${BRAND_DARK}`,
    borderBottom: `1pt solid ${BRAND_DARK}`,
  },
  totalsGrandLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  totalsGrandValue: { fontSize: 10, fontFamily: 'Helvetica-Bold' },

  // --- Notes / footer ---
  notes: {
    marginTop: 16,
    padding: 8,
    backgroundColor: '#faf9f7',
    borderLeft: `2pt solid ${BRAND_YELLOW}`,
  },
  notesLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#444',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 3,
  },
  notesText: { fontSize: 9, color: '#333', lineHeight: 1.4 },

  footer: {
    position: 'absolute',
    bottom: 18,
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#888',
    borderTop: '0.5pt solid #ccc',
    paddingTop: 4,
  },
});

interface InvoicePdfDocumentProps {
  invoice: Invoice;
  /** Time entries already filtered to those linked to this invoice. */
  timeEntries: TimeEntry[];
  /** Material entries already filtered to those linked to this invoice. */
  materialEntries: MaterialEntry[];
  /** Project name (shown in footer). */
  projectName: string;
  /** Optional contractor name + license for the remit-to block. */
  contractorName?: string;
  contractorLicense?: string;
}

export const InvoicePdfDocument: React.FC<InvoicePdfDocumentProps> = ({
  invoice,
  timeEntries,
  materialEntries,
  projectName,
  contractorName,
  contractorLicense,
}) => {
  const status = invoice.status as InvoiceStatus;
  const statusLabel = STATUS_LABEL[status] ?? invoice.status;

  // Column widths (sum to 100% of content width). Use flex shares.
  const laborCols = { date: 0.13, worker: 0.22, code: 0.13, desc: 0.32, hrs: 0.08, rate: 0.06, amt: 0.12 };
  const matCols = { date: 0.13, desc: 0.36, qty: 0.10, unit: 0.07, price: 0.13, mkup: 0.07, amt: 0.14 };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <BrandBar pageLabel="INVOICE" />

        {/* Top header */}
        <View style={styles.headerRow}>
          <View style={styles.billTo}>
            <Text style={styles.invoiceTitle}>Invoice {invoice.invoice_number}</Text>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>{statusLabel}</Text>
            </View>
            <Text style={styles.billToLabel}>Bill to</Text>
            <Text style={styles.billToName}>{invoice.customer_name || 'Customer'}</Text>
            {invoice.customer_address ? (
              invoice.customer_address.split('\n').map((line, i) => (
                <Text key={i} style={styles.billToLine}>{line}</Text>
              ))
            ) : null}
            {invoice.customer_email ? (
              <Text style={styles.billToLine}>{invoice.customer_email}</Text>
            ) : null}
            {invoice.customer_po_number ? (
              <Text style={styles.billToLine}>PO #: {invoice.customer_po_number}</Text>
            ) : null}
          </View>

          <View style={styles.invoiceMeta}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Invoice date</Text>
              <Text style={styles.metaValue}>{invoice.invoice_date}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Due date</Text>
              <Text style={styles.metaValue}>{invoice.due_date || '—'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Period</Text>
              <Text style={styles.metaValue}>
                {invoice.period_start} to {invoice.period_end}
              </Text>
            </View>
            {invoice.description ? (
              <View style={[styles.metaRow, { marginTop: 4 }]}>
                <Text style={[styles.metaLabel, { fontSize: 8 }]}>{invoice.description}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Labor */}
        {timeEntries.length > 0 && (
          <>
            <Text style={styles.sectionHeading}>Labor</Text>
            <View style={styles.table}>
              <View style={styles.thead}>
                <Text style={[styles.th, { flex: laborCols.date }]}>Date</Text>
                <Text style={[styles.th, { flex: laborCols.worker }]}>Worker</Text>
                <Text style={[styles.th, { flex: laborCols.code }]}>Code</Text>
                <Text style={[styles.th, { flex: laborCols.desc }]}>Description</Text>
                <Text style={[styles.th, { flex: laborCols.hrs, textAlign: 'right' }]}>Hours</Text>
                <Text style={[styles.th, { flex: laborCols.rate, textAlign: 'right' }]}>Rate</Text>
                <Text style={[styles.th, { flex: laborCols.amt, textAlign: 'right' }]}>Amount</Text>
              </View>
              {timeEntries.map((t) => (
                <View key={t.id} style={styles.tr} wrap={false}>
                  <Text style={[styles.td, { flex: laborCols.date }]}>{t.work_date}</Text>
                  <Text style={[styles.td, { flex: laborCols.worker }]}>{t.worker_name}</Text>
                  <Text style={[styles.td, { flex: laborCols.code }]}>{t.cost_code || '—'}</Text>
                  <Text style={[styles.td, { flex: laborCols.desc }]}>{t.description || '—'}</Text>
                  <Text style={[styles.td, { flex: laborCols.hrs, textAlign: 'right' }]}>
                    {formatHours(t.hours)}
                  </Text>
                  <Text style={[styles.td, { flex: laborCols.rate, textAlign: 'right' }]}>
                    {formatUSD(t.billable_rate)}
                  </Text>
                  <Text style={[styles.td, { flex: laborCols.amt, textAlign: 'right' }]}>
                    {formatUSD(t.billable_amount)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Materials */}
        {materialEntries.length > 0 && (
          <>
            <Text style={styles.sectionHeading}>Materials</Text>
            <View style={styles.table}>
              <View style={styles.thead}>
                <Text style={[styles.th, { flex: matCols.date }]}>Date</Text>
                <Text style={[styles.th, { flex: matCols.desc }]}>Description</Text>
                <Text style={[styles.th, { flex: matCols.qty, textAlign: 'right' }]}>Qty</Text>
                <Text style={[styles.th, { flex: matCols.unit }]}>Unit</Text>
                <Text style={[styles.th, { flex: matCols.price, textAlign: 'right' }]}>Price</Text>
                <Text style={[styles.th, { flex: matCols.mkup, textAlign: 'right' }]}>Mkup</Text>
                <Text style={[styles.th, { flex: matCols.amt, textAlign: 'right' }]}>Amount</Text>
              </View>
              {materialEntries.map((m) => (
                <View key={m.id} style={styles.tr} wrap={false}>
                  <Text style={[styles.td, { flex: matCols.date }]}>{m.installed_date}</Text>
                  <Text style={[styles.td, { flex: matCols.desc }]}>{m.description}</Text>
                  <Text style={[styles.td, { flex: matCols.qty, textAlign: 'right' }]}>
                    {m.quantity}
                  </Text>
                  <Text style={[styles.td, { flex: matCols.unit }]}>{m.unit || '—'}</Text>
                  <Text style={[styles.td, { flex: matCols.price, textAlign: 'right' }]}>
                    {formatUSD(m.billing_unit_price)}
                  </Text>
                  <Text style={[styles.td, { flex: matCols.mkup, textAlign: 'right' }]}>
                    {m.markup_pct}%
                  </Text>
                  <Text style={[styles.td, { flex: matCols.amt, textAlign: 'right' }]}>
                    {formatUSD(m.billing_amount)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {timeEntries.length === 0 && materialEntries.length === 0 && (
          <Text style={[styles.td, { marginTop: 12, color: '#888' }]}>
            (No labor or material lines on this invoice.)
          </Text>
        )}

        {/* Totals */}
        <View style={styles.totals}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Labor subtotal</Text>
            <Text style={styles.totalsValue}>{formatUSD(invoice.subtotal_labor)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Materials subtotal</Text>
            <Text style={styles.totalsValue}>{formatUSD(invoice.subtotal_materials)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{formatUSD(invoice.subtotal)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Tax</Text>
            <Text style={styles.totalsValue}>{formatUSD(invoice.tax_amount)}</Text>
          </View>
          <View style={styles.totalsGrand}>
            <Text style={styles.totalsGrandLabel}>Total due</Text>
            <Text style={styles.totalsGrandValue}>{formatUSD(invoice.total)}</Text>
          </View>
          {invoice.paid_amount > 0 && (
            <>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Paid</Text>
                <Text style={styles.totalsValue}>{formatUSD(invoice.paid_amount)}</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text style={[styles.totalsLabel, { fontFamily: 'Helvetica-Bold' }]}>
                  Balance due
                </Text>
                <Text style={[styles.totalsValue, { fontFamily: 'Helvetica-Bold' }]}>
                  {formatUSD(invoice.balance_due)}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Notes / remit */}
        {invoice.notes ? (
          <View style={styles.notes}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        ) : null}

        {(contractorName || contractorLicense) ? (
          <View style={[styles.notes, { marginTop: 8 }]}>
            <Text style={styles.notesLabel}>Remit to</Text>
            {contractorName ? (
              <Text style={styles.notesText}>{contractorName}</Text>
            ) : null}
            {contractorLicense ? (
              <Text style={styles.notesText}>License #: {contractorLicense}</Text>
            ) : null}
          </View>
        ) : null}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>SparkPlan {'•'} {projectName}</Text>
          <Text
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
          <Text>Generated {todayStr()}</Text>
        </View>
      </Page>
    </Document>
  );
};
