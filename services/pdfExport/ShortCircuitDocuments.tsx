/**
 * Short Circuit Analysis PDF Document Components
 * React PDF document structure for short circuit calculations
 */

import React from 'react';
import { Document, Page, View, StyleSheet } from '@react-pdf/renderer';
import { Text } from './PdfText';
import type { ShortCircuitCalculation } from '../../lib/database.types';
import { SHORT_CIRCUIT_OUTDATED, SHORT_CIRCUIT_STALE, shortCircuitConductorText } from '../../lib/storedCalcs';
import { SERVICE_RATING_CHANGED } from '../calculations/shortCircuitHierarchy';
import { aicStatus, panelAtShortCircuitPoint, type AicStatusKind } from './permitPacketTheme';
import {
  BrandBar,
  Footer as BrandFooter,
  phaseLabel,
  themeStyles,
} from './permitPacketTheme';

// Helvetica + Helvetica-Bold are built-in standard PDF fonts; do not register.

// Professional styling
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#555',
    marginBottom: 3,
  },
  section: {
    marginTop: 15,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  grid: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  gridItem: {
    width: '33.33%',
    paddingRight: 10,
  },
  label: {
    fontSize: 8,
    color: '#666',
    marginBottom: 2,
  },
  value: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
  },
  subValue: {
    fontSize: 9,
    color: '#666',
  },
  table: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    padding: 6,
  },
  tableCell: {
    fontSize: 9,
  },
  tableCellLabel: {
    width: '40%',
    fontSize: 9,
    color: '#666',
  },
  tableCellValue: {
    width: '60%',
    fontSize: 9,
    fontFamily: 'Helvetica',
  },
  complianceBox: {
    marginTop: 15,
    padding: 10,
    borderWidth: 1,
    borderRadius: 4,
  },
  complianceBoxPass: {
    backgroundColor: '#f0fdf4',
    borderColor: '#22c55e',
  },
  complianceBoxFail: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
  },
  complianceTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 5,
  },
  complianceText: {
    fontSize: 9,
  },
  notesBox: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 4,
  },
  notesTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 5,
    color: '#1e40af',
  },
  notesText: {
    fontSize: 9,
    color: '#1e3a8a',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#999',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
  coverPage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverTitle: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 10,
  },
  coverSubtitle: {
    fontSize: 16,
    marginBottom: 5,
    color: '#555',
  },
  coverDate: {
    fontSize: 10,
    color: '#999',
    marginTop: 20,
  },
});

interface ShortCircuitResult {
  faultCurrent: number;
  requiredAIC: number;
  details: {
    sourceFaultCurrent: number;
    conductorImpedance?: number;
    totalImpedance: number;
    faultCurrentAtPoint: number;
  };
  compliance: {
    necArticle: string;
    compliant: boolean;
    message: string;
  };
  /** #278: set when the saved row couldn't be recomputed; the values are as saved. */
  outdated?: string;
}

interface CalcProps {
  calculation: ShortCircuitCalculation;
  projectName: string;
  projectAddress?: string;
  panelName?: string;
  // Sprint 2A C8: per-sheet contractor signature block
  contractorName?: string;
  contractorLicense?: string;
  // Sprint 2A H3: per-sheet ID
  sheetId?: string;
}

export const ShortCircuitCalculationPages: React.FC<CalcProps> = ({
  calculation,
  projectName,
  projectAddress,
  panelName,
  contractorName,
  contractorLicense,
  sheetId,
}) => {
  const results = calculation.results as unknown as ShortCircuitResult;

  return (
    <Page size="LETTER" style={themeStyles.page}>
        <BrandBar pageLabel="SHORT CIRCUIT ANALYSIS" sheetId={sheetId} />
        <View style={themeStyles.titleBlock}>
          <Text style={themeStyles.docTitle}>Short Circuit Calculation Report</Text>
          <Text style={themeStyles.docSubtitle}>
            {projectName}
            {projectAddress ? ` \u2022 ${projectAddress}` : ''}
            {calculation.location_name ? ` \u2022 ${calculation.location_name}` : ''}
          </Text>
        </View>

        {/* Results Summary */}
        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <Text style={styles.label}>FAULT CURRENT</Text>
            <Text style={styles.value}>{(results.faultCurrent / 1000).toFixed(1)} kA</Text>
            <Text style={styles.subValue}>{results.faultCurrent.toLocaleString()} A RMS</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>REQUIRED AIC RATING</Text>
            <Text style={styles.value}>{results.requiredAIC} kA</Text>
            <Text style={styles.subValue}>Minimum equipment rating</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>CALCULATION TYPE</Text>
            <Text style={styles.value}>{calculation.calculation_type === 'service' ? 'Service' : 'Panel'}</Text>
            <Text style={styles.subValue}>
              {new Date(calculation.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {results.outdated && (
          <View style={[styles.complianceBox, styles.complianceBoxFail]}>
            <Text style={styles.complianceTitle}>{`${SHORT_CIRCUIT_OUTDATED.toUpperCase()}`}</Text>
            <Text style={styles.complianceText}>
              {`${results.outdated}. The values on this page are as saved; run the short-circuit calculation again.`}
            </Text>
          </View>
        )}

        {/* Input Parameters */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>INPUT PARAMETERS</Text>
          <View style={styles.table}>
            {calculation.calculation_type === 'service' ? (
              <>
                <View style={styles.tableRow}>
                  <Text style={styles.tableCellLabel}>Service Rating:</Text>
                  <Text style={styles.tableCellValue}>
                    {calculation.service_amps}A, {calculation.service_voltage}V, {phaseLabel(calculation.service_phase ?? '—')}
                  </Text>
                </View>
                {calculation.transformer_kva && (
                  <>
                    <View style={styles.tableRow}>
                      <Text style={styles.tableCellLabel}>Transformer Size:</Text>
                      <Text style={styles.tableCellValue}>{calculation.transformer_kva} kVA</Text>
                    </View>
                    <View style={styles.tableRow}>
                      <Text style={styles.tableCellLabel}>Transformer Impedance:</Text>
                      <Text style={styles.tableCellValue}>{calculation.transformer_impedance}%</Text>
                    </View>
                  </>
                )}
                {calculation.service_conductor_length && (
                  <>
                    <View style={styles.tableRow}>
                      <Text style={styles.tableCellLabel}>Service Conductor:</Text>
                      <Text style={styles.tableCellValue}>
                        {shortCircuitConductorText(calculation)}
                      </Text>
                    </View>
                    <View style={styles.tableRow}>
                      <Text style={styles.tableCellLabel}>Conductor Length:</Text>
                      <Text style={styles.tableCellValue}>{calculation.service_conductor_length} ft</Text>
                    </View>
                    <View style={styles.tableRow}>
                      <Text style={styles.tableCellLabel}>Conduit Type:</Text>
                      <Text style={styles.tableCellValue}>{calculation.service_conduit_type}</Text>
                    </View>
                  </>
                )}
              </>
            ) : (
              <>
                <View style={styles.tableRow}>
                  <Text style={styles.tableCellLabel}>Source Fault Current:</Text>
                  <Text style={styles.tableCellValue}>
                    {calculation.source_fault_current?.toLocaleString()} A
                  </Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.tableCellLabel}>Feeder Conductor:</Text>
                  <Text style={styles.tableCellValue}>
                    {shortCircuitConductorText(calculation)}
                  </Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.tableCellLabel}>Feeder Length:</Text>
                  <Text style={styles.tableCellValue}>{calculation.feeder_length} ft</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.tableCellLabel}>Feeder Voltage/Phase:</Text>
                  <Text style={styles.tableCellValue}>
                    {calculation.feeder_voltage}V, {phaseLabel(calculation.feeder_phase ?? '—')}
                  </Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.tableCellLabel}>Conduit Type:</Text>
                  <Text style={styles.tableCellValue}>{calculation.feeder_conduit_type}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Calculation Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CALCULATION BREAKDOWN</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>Source Fault Current (If):</Text>
              <Text style={styles.tableCellValue}>
                {results.details.sourceFaultCurrent.toLocaleString()} A
              </Text>
            </View>
            {(calculation.calculation_type === 'panel' || (calculation.calculation_type === 'service' && results.details.conductorImpedance && results.details.conductorImpedance > 0)) && (
              <View style={styles.tableRow}>
                <Text style={styles.tableCellLabel}>Conductor Impedance (Z):</Text>
                <Text style={styles.tableCellValue}>{results.details.conductorImpedance?.toFixed(4)} ohms</Text>
              </View>
            )}
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>Total Impedance (Ztotal):</Text>
              <Text style={styles.tableCellValue}>{results.details.totalImpedance.toFixed(4)} ohms</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>Fault Current at Point:</Text>
              <Text style={styles.tableCellValue}>
                {results.details.faultCurrentAtPoint.toLocaleString()} A
              </Text>
            </View>
          </View>
        </View>

        {/* NEC Compliance */}
        <View style={[styles.complianceBox, results.compliance.compliant ? styles.complianceBoxPass : styles.complianceBoxFail]}>
          <Text style={styles.complianceTitle}>{results.compliance.necArticle}</Text>
          <Text style={styles.complianceText}>{results.compliance.message}</Text>
          <Text
            style={[
              styles.complianceText,
              {
                marginTop: 5,
                fontFamily: 'Helvetica-Bold',
                color: results.compliance.compliant ? '#166534' : '#991b1b',
              },
            ]}
          >
            Status: {results.compliance.compliant ? 'COMPLIANT' : 'REQUIRES REVIEW'}
          </Text>
        </View>

        {/* Notes */}
        {calculation.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesTitle}>NOTES</Text>
            <Text style={styles.notesText}>{calculation.notes}</Text>
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

export const ShortCircuitCalculationDocument: React.FC<CalcProps> = (props) => (
  <Document>
    <ShortCircuitCalculationPages {...props} />
  </Document>
);

// ============================================================================
// SHORT CIRCUIT — single-page tabular layout (used in the permit packet)
// ============================================================================
//
// Mirrors VoltageDropPages: summary → table-of-everything → NEC references.
// Avoids the prior one-page-per-panel layout that grew unbounded as projects
// added panels. The standalone ShortCircuitCalculationPages above is kept
// intact for the single-panel "export this calc" flow.

const tableStyles = StyleSheet.create({
  table: {
    width: '100%',
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    padding: 6,
    fontFamily: 'Helvetica-Bold',
    borderBottomWidth: 1,
    borderBottomColor: '#9ca3af',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
  },
  // Columns sum to 100%
  colPanel:      { width: '14%' },
  colType:       { width: '7%'  },
  colSourceIf:   { width: '10%' },
  colFeeder:     { width: '15%' },
  colVoltage:    { width: '8%'  },
  colImpedance:  { width: '10%' },
  colFault:      { width: '11%' },
  colAic:        { width: '8%'  },
  // #307: holds "Required >= 10 kA" / "OK (42 >= 8.6 kA)" on one line
  colCompliance: { width: '17%' },
  cellCenter: { textAlign: 'center', fontSize: 8 },
  cellLeft:   { fontSize: 8 },
  compliantText:    { color: '#059669', fontFamily: 'Helvetica-Bold' },
  nonCompliantText: { color: '#dc2626', fontFamily: 'Helvetica-Bold' },
  summaryBox: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 4,
    padding: 10,
    marginBottom: 15,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  summaryLabel: { fontSize: 9, color: '#4b5563' },
  summaryValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
  infoBox: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 4,
    padding: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  infoText: { fontSize: 8, color: '#1e40af' },
  necReferencesList: { marginTop: 8 },
  necReference: { fontSize: 8, color: '#4b5563', marginBottom: 3, paddingLeft: 10 },
});

interface TableRowData {
  panelLabel: string;
  typeLabel: string;
  sourceIf: number;
  feederLabel: string;
  voltageLabel: string;
  zTotal: number;
  faultCurrentKa: number;
  requiredAicKa: number;
  compliant: boolean;
  necArticle: string;
  /** #278: couldn't be recomputed; printed as saved, marked. */
  outdated: boolean;
  /** #289: its saved source differs from the current upstream (the app's "Stale"); why. */
  staleReason: string | null;
  /** #307: the NEC 110.9 status of the equipment at this point (rating entered or not). */
  aic: { kind: AicStatusKind; text: string };
}

/** A panel's entered interrupting rating (kA, #313) for the E-103 status (#307). */
type RatedPanel = { id: string; name?: string; is_main?: boolean | null; aic_rating?: number | null };

function buildRow(calc: ShortCircuitCalculation, panels: ReadonlyArray<RatedPanel>, stale?: StaleMap): TableRowData {
  const results = calc.results as unknown as ShortCircuitResult;
  const isService = calc.calculation_type === 'service';

  // Panel/location label — use location_name first (set on insert), then panel_name
  // (legacy field, may not exist on current schema), then a calc-type fallback so the
  // row is never blank.
  const legacyPanelName = (calc as { panel_name?: string | null }).panel_name;
  const panelLabel = calc.location_name || legacyPanelName || (isService ? 'Service Main' : 'Panel');

  const conductor = shortCircuitConductorText(calc);
  const feederLabel = conductor
    ? `${conductor} · ${(isService ? calc.service_conductor_length : calc.feeder_length) ?? 0} ft`
    : (isService ? 'Service main' : 'Feeder');

  const voltage = isService ? calc.service_voltage : calc.feeder_voltage;
  const phase = isService ? calc.service_phase : calc.feeder_phase;
  const voltageLabel = voltage != null && phase != null
    ? `${voltage}V ${phaseLabel(phase)}`
    : '—';

  return {
    panelLabel,
    typeLabel: isService ? 'Service' : 'Panel',
    sourceIf: results.details.sourceFaultCurrent,
    feederLabel,
    voltageLabel,
    zTotal: results.details.totalImpedance,
    faultCurrentKa: results.faultCurrent / 1000,
    requiredAicKa: results.requiredAIC,
    compliant: results.compliance.compliant,
    necArticle: results.compliance.necArticle,
    outdated: !!results.outdated,
    staleReason: stale?.get(calc.id)?.reason ?? null,
    aic: aicStatus(
      panelAtShortCircuitPoint(calc, panels)?.aic_rating,
      results.faultCurrent,
      results.requiredAIC,
      results.compliance.compliant,
    ),
  };
}

/** `detectStaleCalculations` output, keyed by calculation id (#289). */
type StaleMap = Map<string, { reason: string }>;

/** Where the service fault current came from, for the references line (#289). */
function sourceReference(calculations: ShortCircuitCalculation[]): string {
  const svc = calculations.find((c) => c.calculation_type === 'service' && !c.panel_id);
  if (!svc) return 'Source fault current at each panel as listed in the Source If column';
  const z = svc.transformer_impedance != null ? `, ${svc.transformer_impedance} % Z` : '';
  const transformer = svc.transformer_kva
    ? `the utility transformer (${svc.transformer_kva} kVA${z})`
    : `a utility transformer estimated from the ${svc.service_amps ?? '—'} A service${z ? ` (${z.slice(2)})` : ''}`;
  const path = svc.service_conductor_size ? ' through the service conductors' : ' at its secondary';
  return `Service fault current calculated from ${transformer}${path} (see Available Fault Current sheet)`;
}

interface TablePagesProps {
  calculations: ShortCircuitCalculation[];
  projectName: string;
  projectAddress?: string;
  contractorName?: string;
  contractorLicense?: string;
  sheetId?: string;
  includeNECReferences?: boolean;
  /** Panel rows whose upstream changed since they were saved (`detectStaleCalculations`, #289). */
  stale?: StaleMap;
  /** The project's panels: each row's status compares the entered rating at its point (#307). */
  panels: ReadonlyArray<RatedPanel>;
}

export const ShortCircuitTablePages: React.FC<TablePagesProps> = ({
  calculations,
  projectName,
  projectAddress,
  contractorName,
  contractorLicense,
  sheetId,
  includeNECReferences = true,
  stale,
  panels,
}) => {
  const rows = calculations.map((c) => buildRow(c, panels, stale));
  const total = rows.length;
  const outdated = rows.filter((r) => r.outdated).length;
  const staleRows = rows.filter((r) => !r.outdated && r.staleReason);
  // #301: a service row is Stale because the project's rating changed, not its upstream
  const staleService = staleRows.filter((r) => r.staleReason!.startsWith(SERVICE_RATING_CHANGED));
  const staleUpstream = staleRows.filter((r) => !r.staleReason!.startsWith(SERVICE_RATING_CHANGED));
  // #307: the counts follow the row statuses; Outdated and Stale come first
  const current = rows.filter((r) => !r.outdated && !r.staleReason);
  const okCount = current.filter((r) => r.aic.kind === 'ok').length;
  const underCount = current.filter((r) => r.aic.kind === 'under').length;
  const notEntered = current.filter((r) => r.aic.kind === 'required').length;
  const reviewCount = current.filter((r) => r.aic.kind === 'review').length;
  const pct = (n: number) => `${n} (${total > 0 ? ((n / total) * 100).toFixed(0) : 0}%)`;
  const maxFault = rows.reduce((m, r) => Math.max(m, r.faultCurrentKa), 0);
  const avgFault = total > 0 ? rows.reduce((s, r) => s + r.faultCurrentKa, 0) / total : 0;
  const maxRequiredAic = rows.reduce((m, r) => Math.max(m, r.requiredAicKa), 0);

  return (
    <Page size="LETTER" orientation="portrait" style={themeStyles.page}>
      <BrandBar pageLabel="SHORT CIRCUIT ANALYSIS" sheetId={sheetId} />

      <View style={themeStyles.titleBlock}>
        <Text style={themeStyles.docTitle}>Short Circuit Calculation Report</Text>
        <Text style={themeStyles.docSubtitle}>
          {projectName}
          {projectAddress ? ` • ${projectAddress}` : ''}
        </Text>
      </View>

      <View style={tableStyles.summaryBox}>
        <Text style={styles.sectionTitle}>Summary</Text>
        <View style={tableStyles.summaryRow}>
          <Text style={tableStyles.summaryLabel}>Total Panels:</Text>
          <Text style={tableStyles.summaryValue}>{total}</Text>
        </View>
        <View style={tableStyles.summaryRow}>
          <Text style={tableStyles.summaryLabel}>Rating entered, OK (NEC 110.9):</Text>
          <Text style={[tableStyles.summaryValue, tableStyles.compliantText]}>{pct(okCount)}</Text>
        </View>
        <View style={tableStyles.summaryRow}>
          <Text style={tableStyles.summaryLabel}>Under-rated:</Text>
          <Text style={[tableStyles.summaryValue, underCount > 0 ? tableStyles.nonCompliantText : {}]}>{pct(underCount)}</Text>
        </View>
        <View style={tableStyles.summaryRow}>
          <Text style={tableStyles.summaryLabel}>Rating not entered:</Text>
          <Text style={tableStyles.summaryValue}>{pct(notEntered)}</Text>
        </View>
        {reviewCount > 0 && (
          <View style={tableStyles.summaryRow}>
            <Text style={tableStyles.summaryLabel}>Above the standard ratings (review):</Text>
            <Text style={[tableStyles.summaryValue, tableStyles.nonCompliantText]}>{pct(reviewCount)}</Text>
          </View>
        )}
        {outdated > 0 && (
          <View style={tableStyles.summaryRow}>
            <Text style={tableStyles.summaryLabel}>{`${SHORT_CIRCUIT_OUTDATED}:`}</Text>
            <Text style={[tableStyles.summaryValue, tableStyles.nonCompliantText]}>{outdated}</Text>
          </View>
        )}
        {staleRows.length > 0 && (
          <View style={tableStyles.summaryRow}>
            <Text style={tableStyles.summaryLabel}>{`${SHORT_CIRCUIT_STALE}:`}</Text>
            <Text style={[tableStyles.summaryValue, tableStyles.nonCompliantText]}>{staleRows.length}</Text>
          </View>
        )}
        <View style={tableStyles.summaryRow}>
          <Text style={tableStyles.summaryLabel}>Maximum Fault Current:</Text>
          <Text style={tableStyles.summaryValue}>{maxFault.toFixed(1)} kA</Text>
        </View>
        <View style={tableStyles.summaryRow}>
          <Text style={tableStyles.summaryLabel}>Average Fault Current:</Text>
          <Text style={tableStyles.summaryValue}>{avgFault.toFixed(1)} kA</Text>
        </View>
        <View style={tableStyles.summaryRow}>
          <Text style={tableStyles.summaryLabel}>Highest Required AIC:</Text>
          <Text style={tableStyles.summaryValue}>{maxRequiredAic} kA</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Per-Panel Short Circuit Analysis</Text>
        {rows.length === 0 ? (
          <View style={tableStyles.infoBox}>
            <Text style={tableStyles.infoText}>
              No short circuit calculations recorded for this project.
            </Text>
          </View>
        ) : (
          <View style={tableStyles.table}>
            <View style={tableStyles.tableHeader}>
              <Text style={[tableStyles.colPanel, tableStyles.cellLeft]}>Panel / Location</Text>
              <Text style={[tableStyles.colType, tableStyles.cellCenter]}>Type</Text>
              <Text style={[tableStyles.colSourceIf, tableStyles.cellCenter]}>Source If (A)</Text>
              <Text style={[tableStyles.colFeeder, tableStyles.cellLeft]}>Feeder</Text>
              <Text style={[tableStyles.colVoltage, tableStyles.cellCenter]}>V / Φ</Text>
              <Text style={[tableStyles.colImpedance, tableStyles.cellCenter]}>Z total (Ω)</Text>
              <Text style={[tableStyles.colFault, tableStyles.cellCenter]}>If at point (kA)</Text>
              <Text style={[tableStyles.colAic, tableStyles.cellCenter]}>Req. AIC (kA)</Text>
              <Text style={[tableStyles.colCompliance, tableStyles.cellCenter]}>NEC 110.9</Text>
            </View>
            {rows.map((row, idx) => (
              <View key={idx} style={tableStyles.tableRow}>
                <Text style={[tableStyles.colPanel, tableStyles.cellLeft]}>{row.panelLabel}</Text>
                <Text style={[tableStyles.colType, tableStyles.cellCenter]}>{row.typeLabel}</Text>
                <Text style={[tableStyles.colSourceIf, tableStyles.cellCenter]}>
                  {Math.round(row.sourceIf).toLocaleString('en-US')}
                </Text>
                <Text style={[tableStyles.colFeeder, tableStyles.cellLeft]}>{row.feederLabel}</Text>
                <Text style={[tableStyles.colVoltage, tableStyles.cellCenter]}>{row.voltageLabel}</Text>
                <Text style={[tableStyles.colImpedance, tableStyles.cellCenter]}>
                  {row.zTotal.toFixed(4)}
                </Text>
                <Text style={[tableStyles.colFault, tableStyles.cellCenter]}>
                  {row.faultCurrentKa.toFixed(1)}
                </Text>
                <Text style={[tableStyles.colAic, tableStyles.cellCenter]}>
                  {row.requiredAicKa}
                </Text>
                <Text
                  style={[
                    tableStyles.colCompliance,
                    tableStyles.cellCenter,
                    row.aic.kind === 'ok' && !row.outdated && !row.staleReason
                      ? tableStyles.compliantText
                      : row.aic.kind === 'required' && !row.outdated && !row.staleReason ? {} : tableStyles.nonCompliantText,
                  ]}
                >
                  {row.outdated ? SHORT_CIRCUIT_OUTDATED : row.staleReason ? SHORT_CIRCUIT_STALE : row.aic.text}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {outdated > 0 && (
        <View style={tableStyles.infoBox}>
          <Text style={tableStyles.infoText}>
            {`${SHORT_CIRCUIT_OUTDATED}: ${outdated === 1 ? 'one calculation was' : `${outdated} calculations were`} saved in a way the current calculator can't reproduce exactly (for example, before the number of conductor sets in parallel was recorded). ${outdated === 1 ? 'Its values are' : 'Their values are'} shown as saved; run the short-circuit calculation again.`}
          </Text>
        </View>
      )}

      {staleUpstream.length > 0 && (
        <View style={tableStyles.infoBox}>
          <Text style={tableStyles.infoText}>
            {`${SHORT_CIRCUIT_STALE}: the upstream fault current changed after ${staleUpstream.length === 1 ? 'this calculation was' : 'these calculations were'} saved (${staleUpstream.map((r) => `${r.panelLabel}: ${r.staleReason!.replace(/^Upstream chain changed: /, '')}`).join('; ')}). ${staleUpstream.length === 1 ? 'Its values are' : 'Their values are'} as saved; run the calculation again with the current upstream value.`}
          </Text>
        </View>
      )}

      {staleService.map((r) => (
        <View key={r.panelLabel} style={tableStyles.infoBox}>
          <Text style={tableStyles.infoText}>
            {`${SHORT_CIRCUIT_STALE}: ${r.panelLabel}: ${r.staleReason}. Its values are as saved; run the service calculation again with the project's service rating.`}
          </Text>
        </View>
      ))}

      {/* #307: no claim of compliance without an entered rating to compare */}
      {notEntered > 0 && (
        <View style={tableStyles.infoBox}>
          <Text style={tableStyles.infoText}>
            {`Equipment interrupting ratings are not entered for ${notEntered === 1 ? 'one point' : `${notEntered} points`}. Each device's interrupting rating shall be at least the available fault current at its line-side terminals (NEC 110.9); the Req. AIC column gives the minimum standard rating.`}
          </Text>
        </View>
      )}

      {rows.length > 0 && okCount === total && (
        <View style={tableStyles.infoBox}>
          <Text style={tableStyles.infoText}>
            Every entered equipment interrupting rating is at least the fault current at its point (NEC 110.9).
          </Text>
        </View>
      )}

      {includeNECReferences && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NEC References</Text>
          <View style={tableStyles.necReferencesList}>
            <Text style={tableStyles.necReference}>
              • NEC 110.9 - Interrupting Rating: equipment intended to interrupt current at fault levels shall have an interrupting rating at nominal voltage sufficient for the current available
            </Text>
            <Text style={tableStyles.necReference}>
              • NEC 110.10 - Circuit Impedance, Short-Circuit Current Ratings, and Other Characteristics
            </Text>
            <Text style={tableStyles.necReference}>
              • IEEE 141 (Red Book) - Recommended Practice for Electric Power Distribution for Industrial Plants
            </Text>
            <Text style={tableStyles.necReference}>
              • NEC Chapter 9 Table 9 - AC Resistance and Reactance for conductor impedance derivation
            </Text>
            <Text style={tableStyles.necReference}>
              {`• ${sourceReference(calculations)}`}
            </Text>
          </View>
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

interface SystemReportProps {
  calculations: ShortCircuitCalculation[];
  projectName: string;
  projectAddress: string;
  panels?: any[];
  // Sprint 2A C8: per-sheet contractor signature block
  contractorName?: string;
  contractorLicense?: string;
}

export const ShortCircuitSystemReport: React.FC<SystemReportProps> = ({
  calculations,
  projectName,
  projectAddress,
  panels,
  contractorName,
  contractorLicense,
}) => {
  return (
    <Document>
      {/* Cover Page */}
      <Page size="LETTER" style={themeStyles.page}>
        <BrandBar pageLabel="SHORT CIRCUIT ANALYSIS" />
        <View style={styles.coverPage}>
          <Text style={styles.coverTitle}>SHORT CIRCUIT ANALYSIS</Text>
          <Text style={styles.coverSubtitle}>{projectName}</Text>
          <Text style={styles.coverSubtitle}>{projectAddress}</Text>
          <Text style={styles.coverDate}>
            Generated: {new Date().toLocaleDateString()}
          </Text>
          <Text style={[styles.coverDate, { marginTop: 5 }]}>
            {calculations.length} Calculation{calculations.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <BrandFooter
          projectName={projectName}
          contractorName={contractorName}
          contractorLicense={contractorLicense}
        />
      </Page>

      {/* Individual Calculation Pages */}
      {calculations.map((calc, index) => {
        const results = calc.results as unknown as ShortCircuitResult;
        const panel = panels?.find(p => p.id === calc.panel_id);

        return (
          <Page key={calc.id} size="LETTER" style={themeStyles.page}>
            <BrandBar pageLabel="SHORT CIRCUIT ANALYSIS" />
            <View style={themeStyles.titleBlock}>
              <Text style={themeStyles.docTitle}>{calc.location_name}</Text>
              {panel && (
                <Text style={themeStyles.docSubtitle}>
                  {`${panel.bus_rating}A Panel \u2022 ${panel.voltage}V \u2022 ${phaseLabel(panel.phase)}`}
                </Text>
              )}
            </View>

            {/* Results Summary */}
            <View style={styles.grid}>
              <View style={styles.gridItem}>
                <Text style={styles.label}>FAULT CURRENT</Text>
                <Text style={styles.value}>{(results.faultCurrent / 1000).toFixed(1)} kA</Text>
                <Text style={styles.subValue}>{results.faultCurrent.toLocaleString()} A</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.label}>REQUIRED AIC</Text>
                <Text style={styles.value}>{results.requiredAIC} kA</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.label}>COMPLIANCE</Text>
                <Text
                  style={[
                    styles.value,
                    { color: results.compliance.compliant ? '#166534' : '#991b1b' },
                  ]}
                >
                  {results.compliance.compliant ? 'Pass' : 'Review'}
                </Text>
              </View>
            </View>

            {/* Calculation Details Table */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>CALCULATION DETAILS</Text>
              <View style={styles.table}>
                {calc.calculation_type === 'service' ? (
                  <>
                    <View style={styles.tableRow}>
                      <Text style={styles.tableCellLabel}>Service:</Text>
                      <Text style={styles.tableCellValue}>
                        {calc.service_amps}A, {calc.service_voltage}V, {phaseLabel(calc.service_phase ?? '—')}
                      </Text>
                    </View>
                    {calc.transformer_kva && (
                      <View style={styles.tableRow}>
                        <Text style={styles.tableCellLabel}>Transformer:</Text>
                        <Text style={styles.tableCellValue}>
                          {calc.transformer_kva} kVA, {calc.transformer_impedance}% Z
                        </Text>
                      </View>
                    )}
                    {calc.service_conductor_length && (
                      <View style={styles.tableRow}>
                        <Text style={styles.tableCellLabel}>Service Conductor:</Text>
                        <Text style={styles.tableCellValue}>
                          {calc.service_conductor_size} {calc.service_conductor_material}, {calc.service_conductor_length} ft
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    <View style={styles.tableRow}>
                      <Text style={styles.tableCellLabel}>Source If:</Text>
                      <Text style={styles.tableCellValue}>
                        {calc.source_fault_current?.toLocaleString()} A
                      </Text>
                    </View>
                    <View style={styles.tableRow}>
                      <Text style={styles.tableCellLabel}>Feeder:</Text>
                      <Text style={styles.tableCellValue}>
                        {calc.feeder_conductor_size} {calc.feeder_material}, {calc.feeder_length} ft
                      </Text>
                    </View>
                  </>
                )}
                <View style={styles.tableRow}>
                  <Text style={styles.tableCellLabel}>Total Impedance:</Text>
                  <Text style={styles.tableCellValue}>{results.details.totalImpedance.toFixed(4)} ohms</Text>
                </View>
              </View>
            </View>

            {/* Compliance */}
            <View style={[styles.complianceBox, results.compliance.compliant ? styles.complianceBoxPass : styles.complianceBoxFail]}>
              <Text style={styles.complianceTitle}>{results.compliance.necArticle}</Text>
              <Text style={styles.complianceText}>{results.compliance.message}</Text>
            </View>

            {calc.notes && (
              <View style={styles.notesBox}>
                <Text style={styles.notesTitle}>NOTES</Text>
                <Text style={styles.notesText}>{calc.notes}</Text>
              </View>
            )}

            <BrandFooter
              projectName={projectName}
              contractorName={contractorName}
              contractorLicense={contractorLicense}
            />
          </Page>
        );
      })}
    </Document>
  );
};
