/**
 * Multi-Family EV Readiness PDF Document Components
 * React PDF document structure for multi-family EV calculations
 * NEC 220.84 + NEC 220.57 + NEC 625.42
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { MultiFamilyEVResult } from '../calculations/multiFamilyEV';
import {
  BrandBar,
  Footer as BrandFooter,
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
  // Sprint 2A consolidation: section/grid/box margins tightened so the
  // Multi-Family EV section fits in 2 pages instead of 3 after the
  // pricing strip + scenario rearrange. Pre-consolidation values were
  // section { mt:15 mb:10 }, grid { mb:15 }, scenarioBox { mt:10 p:10 },
  // complianceBox { mt:15 p:10 }, tableRow { p:6 }, value { fs:14 }.
  section: {
    marginTop: 8,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 5,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  grid: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  gridItem: {
    width: '50%',
    paddingRight: 10,
  },
  gridItem3: {
    width: '33.33%',
    paddingRight: 10,
  },
  label: {
    fontSize: 8,
    color: '#666',
    marginBottom: 2,
  },
  value: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
  },
  subValue: {
    fontSize: 9,
    color: '#666',
  },
  table: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    padding: 4,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    padding: 4,
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
  scenarioBox: {
    marginTop: 6,
    padding: 7,
    borderWidth: 1,
    borderRadius: 4,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  scenarioTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  scenarioGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  // 3-column layout for scenarios: stat (left) | notes (middle) | stat (right).
  scenarioCol_stat: {
    width: '22%',
  },
  scenarioCol_notes: {
    width: '56%',
    paddingLeft: 8,
    paddingRight: 8,
  },
  scenarioCol_statRight: {
    width: '22%',
    textAlign: 'right',
  },
  // Inline 3-phase strip: single row with phase chips instead of the
  // 3-column stack of LABEL/value/subvalue (saves ~50pt of vertical).
  phaseStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  phaseStripCell: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  complianceBox: {
    marginTop: 8,
    padding: 7,
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
  complianceBoxWarning: {
    backgroundColor: '#fffbeb',
    borderColor: '#f59e0b',
  },
  complianceTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 5,
  },
  complianceText: {
    fontSize: 9,
  },
  warningItem: {
    fontSize: 8,
    color: '#92400e',
    marginBottom: 2,
  },
  recommendationItem: {
    fontSize: 8,
    color: '#1e40af',
    marginBottom: 2,
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
  highlight: {
    backgroundColor: '#fef3c7',
    padding: 2,
  },
  costTable: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  costTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e40af',
    padding: 6,
  },
  costTableHeaderCell: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#fff',
  },
  costTableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    padding: 6,
  },
  costTableCell: {
    fontSize: 9,
  },
});

interface MultiFamilyEVDocumentProps {
  result: MultiFamilyEVResult;
  buildingName?: string;
  preparedBy?: string;
  preparedFor?: string;
  // Sprint 2A C8: per-sheet contractor signature block
  contractorName?: string;
  contractorLicense?: string;
  /**
   * Sprint 2A H3: per-sheet IDs. Array of 3 strings, one per internal page
   * (page 1 = system overview, page 2 = panel breakdown, page 3 = compliance
   * narrative). When omitted, no sheet IDs render — kept optional so the
   * standalone document export (outside the permit packet) still works.
   */
  sheetIds?: [string, string];
}

/**
 * Multi-Family EV Analysis — page-level fragment for embedding inside a
 * parent <Document>.
 *
 * Renders 2 internal pages (consolidated from 3 in Sprint 2A PR #40
 * follow-up via style tightening + scenario rearrange):
 *   Page 1 (E-402) — Overview + EV Capacity Scenarios + Transformer/Phase checks
 *   Page 2 (E-403) — NEC Compliance + Detailed Load Breakdown + EV Load Calc
 *
 * Pricing was removed from the scenarios (cost is procurement data, not
 * permit data; AHJs review NEC compliance, not project budget). Cost
 * comparison data lives on the Bid PDF from the Estimating module instead.
 *
 * Each internal page gets its own sheet ID via the `sheetIds` array
 * (a 2-tuple). The packet generator pushes 2 separate entries in the
 * page list but the component still emits both in one call.
 */
export const MultiFamilyEVPages: React.FC<MultiFamilyEVDocumentProps> = ({
  result,
  buildingName,
  preparedBy,
  preparedFor,
  contractorName,
  contractorLicense,
  sheetIds,
}) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <>
      <Page size="LETTER" style={themeStyles.page}>
        <BrandBar pageLabel="MULTI-FAMILY EV READINESS" sheetId={sheetIds?.[0]} />
        <View style={themeStyles.titleBlock}>
          <Text style={themeStyles.docTitle}>Multi-Family EV Readiness Analysis</Text>
          <Text style={themeStyles.docSubtitle}>
            {buildingName || 'Building Analysis'}
            {` \u2022 NEC 220.84 + 220.57 + 625.42`}
            {preparedFor ? ` \u2022 For: ${preparedFor}` : ''}
            {preparedBy ? ` \u2022 By: ${preparedBy}` : ''}
            {` \u2022 ${currentDate}`}
          </Text>
        </View>

        {/* Building Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Building Profile</Text>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.label}>DWELLING UNITS</Text>
              <Text style={styles.value}>{result.input.dwellingUnits}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>TOTAL SQUARE FOOTAGE</Text>
              <Text style={styles.value}>{result.input.totalSqFt.toLocaleString()} sq ft</Text>
            </View>
          </View>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.label}>EXISTING SERVICE</Text>
              <Text style={styles.value}>{result.input.existingServiceAmps}A</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>EV CHARGERS REQUESTED</Text>
              <Text style={styles.value}>{result.input.evChargersRequested}</Text>
            </View>
          </View>
        </View>

        {/* Load Calculations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Load Calculations</Text>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.label}>BUILDING DEMAND (NEC 220.84)</Text>
              <Text style={styles.value}>{result.buildingLoad.buildingLoadAmps}A</Text>
              <Text style={styles.subValue}>
                {(result.buildingLoad.buildingDemandVA / 1000).toFixed(1)} kVA @ {(result.buildingLoad.buildingDemandFactor * 100).toFixed(0)}% DF
              </Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>EV LOAD (NEC 220.57)</Text>
              <Text style={styles.value}>{result.evLoad.loadAmps}A</Text>
              <Text style={styles.subValue}>
                {(result.evLoad.demandVA / 1000).toFixed(1)} kVA ({result.input.evChargersRequested} EVSE @ full load)
              </Text>
            </View>
          </View>
        </View>

        {/* Service Analysis */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Analysis</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>Existing Service Capacity</Text>
              <Text style={styles.tableCellValue}>{result.serviceAnalysis.existingCapacityAmps}A</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>Total System Demand</Text>
              <Text style={styles.tableCellValue}>{result.serviceAnalysis.totalDemandAmps}A</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>Available Capacity</Text>
              <Text style={styles.tableCellValue}>{result.serviceAnalysis.availableCapacityAmps}A</Text>
            </View>
            <View style={[styles.tableRow, { backgroundColor: result.serviceAnalysis.utilizationPercent > 100 ? '#fef2f2' : result.serviceAnalysis.utilizationPercent > 80 ? '#fffbeb' : '#f0fdf4' }]}>
              <Text style={styles.tableCellLabel}>Service Utilization</Text>
              <Text style={[styles.tableCellValue, { fontFamily: 'Helvetica-Bold' }]}>{result.serviceAnalysis.utilizationPercent}%</Text>
            </View>
            {result.serviceAnalysis.upgradeRequired && (
              <View style={[styles.tableRow, { backgroundColor: '#fef2f2' }]}>
                <Text style={styles.tableCellLabel}>Upgrade Required</Text>
                <Text style={[styles.tableCellValue, { fontFamily: 'Helvetica-Bold', color: '#dc2626' }]}>
                  Yes - {result.serviceAnalysis.upgradeType === 'panel_only' ? 'Panel Only' : 'Full Service'} to {result.serviceAnalysis.recommendedServiceAmps}A
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Inline section header (no Page break) — Sprint 2A consolidation
            moved Scenarios + Transformer/Phase from a dedicated page into
            the Overview page after the style tightening shrunk them
            enough to fit. Pricing was REMOVED from the scenarios (cost is
            procurement data, not permit data — AHJs review NEC compliance,
            not project budget). Cost data lives on the Bid PDF instead. */}
        <View style={[styles.section, { marginTop: 12 }]}>
          <Text style={styles.sectionTitle}>EV Capacity Scenarios</Text>
        </View>

        {/* 3-column scenario layout: stat (left) | notes (middle) | stat (right).
            Pre-consolidation this was 2 stacked-grid stats with notes wrapping
            BELOW, which was vertically wasteful. The new layout puts the
            secondary stat (e.g. POWER PER CHARGER, UPGRADE REQUIRED) on the
            right edge so the eye reads: headline number → context bullets
            → secondary stat across one band. Notes use 7pt to fit. */}

        {/* Scenario A: No EVEMS */}
        <View style={styles.scenarioBox}>
          <Text style={styles.scenarioTitle}>{result.scenarios.noEVEMS.name}</Text>
          <View style={styles.scenarioGrid}>
            <View style={styles.scenarioCol_stat}>
              <Text style={styles.label}>MAX CHARGERS</Text>
              <Text style={styles.value}>{result.scenarios.noEVEMS.maxChargers}</Text>
            </View>
            <View style={styles.scenarioCol_notes}>
              {result.scenarios.noEVEMS.notes.map((note, idx) => (
                <Text key={idx} style={{ fontSize: 7, color: '#666', lineHeight: 1.25 }}>• {note}</Text>
              ))}
            </View>
            <View style={styles.scenarioCol_statRight}>
              <Text style={styles.label}>UPGRADE REQUIRED</Text>
              <Text style={styles.value}>{result.scenarios.noEVEMS.requiresServiceUpgrade ? 'Yes' : 'No'}</Text>
            </View>
          </View>
        </View>

        {/* Scenario B: With EVEMS */}
        <View style={[styles.scenarioBox, { borderColor: '#3b82f6', backgroundColor: '#eff6ff' }]}>
          <Text style={styles.scenarioTitle}>{result.scenarios.withEVEMS.name}</Text>
          <View style={styles.scenarioGrid}>
            <View style={styles.scenarioCol_stat}>
              <Text style={styles.label}>MAX CHARGERS</Text>
              <Text style={[styles.value, { color: '#1e40af' }]}>{result.scenarios.withEVEMS.maxChargers}</Text>
            </View>
            <View style={styles.scenarioCol_notes}>
              {result.scenarios.withEVEMS.notes.map((note, idx) => (
                <Text key={idx} style={{ fontSize: 7, color: '#1e3a8a', lineHeight: 1.25 }}>• {note}</Text>
              ))}
            </View>
            <View style={styles.scenarioCol_statRight}>
              <Text style={styles.label}>POWER PER CHARGER</Text>
              <Text style={styles.value}>
                {result.scenarios.withEVEMS.powerPerCharger_kW
                  ? `${result.scenarios.withEVEMS.powerPerCharger_kW.toFixed(1)} kW`
                  : 'Dynamic'}
              </Text>
            </View>
          </View>
        </View>

        {/* Scenario C: With Upgrade */}
        <View style={styles.scenarioBox}>
          <Text style={styles.scenarioTitle}>{result.scenarios.withUpgrade.name}</Text>
          <View style={styles.scenarioGrid}>
            <View style={styles.scenarioCol_stat}>
              <Text style={styles.label}>MAX CHARGERS</Text>
              <Text style={styles.value}>{result.scenarios.withUpgrade.maxChargers}</Text>
            </View>
            <View style={styles.scenarioCol_notes}>
              {result.scenarios.withUpgrade.notes.map((note, idx) => (
                <Text key={idx} style={{ fontSize: 7, color: '#666', lineHeight: 1.25 }}>• {note}</Text>
              ))}
            </View>
            <View style={styles.scenarioCol_statRight}>
              <Text style={styles.label}>NEW SERVICE SIZE</Text>
              <Text style={styles.value}>
                {result.scenarios.withUpgrade.recommendedServiceAmps
                  ? `${result.scenarios.withUpgrade.recommendedServiceAmps}A`
                  : 'N/A'}
              </Text>
            </View>
          </View>
        </View>

        {/* Transformer Check (if applicable) — inline strip matching the
            Phase Balance pattern. */}
        {result.transformerCheck && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Transformer Capacity Check</Text>
            <View style={[styles.complianceBox,
              result.transformerCheck.status === 'red' ? styles.complianceBoxFail :
              result.transformerCheck.status === 'yellow' ? styles.complianceBoxWarning :
              styles.complianceBoxPass
            ]}>
              <View style={styles.phaseStrip}>
                <Text style={styles.phaseStripCell}>
                  CAPACITY · {result.transformerCheck.transformerCapacityAmps}A
                </Text>
                <Text style={styles.phaseStripCell}>
                  TOTAL LOAD · {result.transformerCheck.totalLoadAmps}A
                </Text>
                <Text style={styles.phaseStripCell}>
                  UTILIZATION · {result.transformerCheck.utilizationPercent}%
                </Text>
              </View>
              <Text style={styles.complianceText}>{result.transformerCheck.recommendation}</Text>
            </View>
          </View>
        )}

        {/* Phase Balance (if applicable) — inline horizontal strip
            (was a 3-column LABEL/value/subvalue stack which took ~3×
            the vertical space for the same info). */}
        {result.phaseBalance && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3-Phase Load Balance</Text>
            <View style={[styles.complianceBox, result.phaseBalance.isAcceptable ? styles.complianceBoxPass : styles.complianceBoxWarning]}>
              <View style={styles.phaseStrip}>
                <Text style={styles.phaseStripCell}>
                  PHASE A · {result.phaseBalance.phaseLoads.phaseA}A · {result.phaseBalance.chargerDistribution.phaseA} chgr
                </Text>
                <Text style={styles.phaseStripCell}>
                  PHASE B · {result.phaseBalance.phaseLoads.phaseB}A · {result.phaseBalance.chargerDistribution.phaseB} chgr
                </Text>
                <Text style={styles.phaseStripCell}>
                  PHASE C · {result.phaseBalance.phaseLoads.phaseC}A · {result.phaseBalance.chargerDistribution.phaseC} chgr
                </Text>
              </View>
              <Text style={styles.complianceText}>
                Imbalance: {result.phaseBalance.imbalancePercent}% ({result.phaseBalance.isAcceptable ? 'Acceptable' : 'Exceeds 15% recommendation'})
              </Text>
            </View>
          </View>
        )}

        <BrandFooter
          projectName={buildingName || 'Building Analysis'}
          contractorName={contractorName}
          contractorLicense={contractorLicense}
          sheetId={sheetIds?.[0]}
        />
      </Page>

      {/* Page 2: Compliance & Load Breakdown */}
      <Page size="LETTER" style={themeStyles.page}>
        <BrandBar pageLabel="MULTI-FAMILY EV READINESS" sheetId={sheetIds?.[1]} />
        <View style={themeStyles.titleBlock}>
          <Text style={themeStyles.docTitle}>Compliance & Load Breakdown</Text>
          <Text style={themeStyles.docSubtitle}>{buildingName || 'Building Analysis'}</Text>
        </View>

        {/* Compliance Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NEC Compliance Summary</Text>
          <View style={[styles.complianceBox, result.compliance.isCompliant ? styles.complianceBoxPass : styles.complianceBoxWarning]}>
            <Text
              style={[
                styles.complianceTitle,
                { color: result.compliance.isCompliant ? '#166534' : '#92400e' },
              ]}
            >
              {result.compliance.isCompliant ? 'NEC Compliant Design' : 'Action Required'}
            </Text>
            <Text style={{ fontSize: 9, marginBottom: 8 }}>
              Applicable Articles: {result.compliance.necArticles.join(', ')}
            </Text>

            {result.compliance.warnings.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 3 }}>Warnings:</Text>
                {result.compliance.warnings.map((warning, idx) => (
                  <Text key={idx} style={styles.warningItem}>• {warning}</Text>
                ))}
              </View>
            )}

            {result.compliance.recommendations.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 3 }}>Recommendations:</Text>
                {result.compliance.recommendations.map((rec, idx) => (
                  <Text key={idx} style={styles.recommendationItem}>• {rec}</Text>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Load Breakdown Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Detailed Load Breakdown ({result.buildingLoad.loadDeterminationMethod === 'calculated' ? 'NEC 220.84' : 'NEC 220.87(A)'})
          </Text>
          {result.buildingLoad.loadDeterminationMethod !== 'calculated' && (
            <Text style={{ fontSize: 8, color: '#6b21a8', marginBottom: 5 }}>
              Based on {result.buildingLoad.loadDeterminationMethod === 'utility_bill' ? '12-month utility billing' : '30-day load study'} data
              {result.buildingLoad.utilityCompany ? ` from ${result.buildingLoad.utilityCompany}` : ''}
              {result.buildingLoad.measurementPeriod ? ` (${result.buildingLoad.measurementPeriod})` : ''}
            </Text>
          )}
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { width: '30%' }]}>Category</Text>
              <Text style={[styles.tableHeaderCell, { width: '20%', textAlign: 'right' }]}>Connected</Text>
              <Text style={[styles.tableHeaderCell, { width: '15%', textAlign: 'center' }]}>DF</Text>
              <Text style={[styles.tableHeaderCell, { width: '20%', textAlign: 'right' }]}>Demand</Text>
              <Text style={[styles.tableHeaderCell, { width: '15%' }]}>NEC Ref</Text>
            </View>
            {result.buildingLoad.breakdown.map((item, idx) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={[styles.tableCell, { width: '30%' }]}>{item.category}</Text>
                <Text style={[styles.tableCell, { width: '20%', textAlign: 'right' }]}>
                  {(item.connectedVA / 1000).toFixed(1)} kVA
                </Text>
                <Text style={[styles.tableCell, { width: '15%', textAlign: 'center' }]}>
                  {(item.demandFactor * 100).toFixed(0)}%
                </Text>
                <Text style={[styles.tableCell, { width: '20%', textAlign: 'right' }]}>
                  {(item.demandVA / 1000).toFixed(1)} kVA
                </Text>
                <Text style={[styles.tableCell, { width: '15%', fontSize: 7 }]}>{item.necReference}</Text>
              </View>
            ))}
            {/* Total Row */}
            <View style={[styles.tableRow, { backgroundColor: '#f3f4f6', borderTopWidth: 2, borderTopColor: '#374151' }]}>
              <Text style={[styles.tableCell, { width: '30%', fontFamily: 'Helvetica-Bold' }]}>TOTAL BUILDING DEMAND</Text>
              <Text style={[styles.tableCell, { width: '20%', textAlign: 'right' }]}>
                {(result.buildingLoad.totalConnectedVA / 1000).toFixed(1)} kVA
              </Text>
              <Text style={[styles.tableCell, { width: '15%', textAlign: 'center' }]}>
                {(result.buildingLoad.buildingDemandFactor * 100).toFixed(0)}%
              </Text>
              <Text style={[styles.tableCell, { width: '20%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>
                {(result.buildingLoad.buildingDemandVA / 1000).toFixed(1)} kVA
              </Text>
              <Text style={[styles.tableCell, { width: '15%' }]}></Text>
            </View>
          </View>
        </View>

        {/* EV Load Calculation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>EV Load Calculation (NEC 220.57)</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>Number of EV Chargers</Text>
              <Text style={styles.tableCellValue}>{result.input.evChargersRequested}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>Per-EVSE Load (NEC 220.57(A))</Text>
              <Text style={styles.tableCellValue}>
                {(result.evLoad.totalConnectedVA / result.input.evChargersRequested / 1000).toFixed(1)} kVA each
                (max of 7.2 kVA or nameplate)
              </Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>Total Connected EV Load</Text>
              <Text style={styles.tableCellValue}>{(result.evLoad.totalConnectedVA / 1000).toFixed(1)} kVA</Text>
            </View>
            <View style={[styles.tableRow, { backgroundColor: '#f3f4f6' }]}>
              <Text style={[styles.tableCellLabel, { fontFamily: 'Helvetica-Bold' }]}>Service Demand (No EVEMS)</Text>
              <Text style={[styles.tableCellValue, { fontFamily: 'Helvetica-Bold' }]}>
                {(result.evLoad.demandVA / 1000).toFixed(1)} kVA ({result.evLoad.loadAmps}A) - Full load
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 8, color: '#666', marginTop: 5 }}>
            Note: NEC 220.57 does not provide demand factors for multiple EVSE. Use full connected load unless
            EVEMS (NEC 625.42) is installed, which allows sizing to the EVEMS setpoint.
          </Text>
        </View>

        {/* Notes Box — trimmed to the 3 notes that aren't already
            visible in the tables above. Removed:
              "EV demand factors per NEC Table 220.57…" (NEC 220.57 does
              not provide demand factors for multi-EVSE — misleading)
              "Per-EVSE load calculation uses NEC 220.57(A)…" (already
              shown in the EV Load Calculation table on this page) */}
        <View style={styles.notesBox}>
          <Text style={styles.notesTitle}>Important Notes</Text>
          <Text style={styles.notesText}>
            • This analysis uses NEC 220.84 Optional Calculation for multi-family dwellings (3+ units)
          </Text>
          <Text style={styles.notesText}>
            • EVEMS scenarios assume NEC 625.42 compliant Automatic Load Management System (ALMS)
          </Text>
          <Text style={styles.notesText}>
            • Branch circuit conductors/OCPD must be sized at 125% per NEC 210.20(A) (continuous loads)
          </Text>
        </View>

        <BrandFooter
          projectName={buildingName || 'Building Analysis'}
          contractorName={contractorName}
          contractorLicense={contractorLicense}
          sheetId={sheetIds?.[1]}
        />
      </Page>
    </>
  );
};

/**
 * Single Multi-Family EV Analysis Document (standalone).
 */
export const MultiFamilyEVDocument: React.FC<MultiFamilyEVDocumentProps> = (props) => (
  <Document>
    <MultiFamilyEVPages {...props} />
  </Document>
);
