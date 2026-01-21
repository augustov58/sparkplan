/**
 * Multi-Family EV Readiness PDF Document Components
 * React PDF document structure for multi-family EV calculations
 * NEC 220.84 + NEC 220.57 + NEC 625.42
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import type { MultiFamilyEVResult } from '../calculations/multiFamilyEV';

// Register fonts
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'Helvetica' },
    { src: 'Helvetica-Bold', fontWeight: 'bold' },
  ]
});

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
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    padding: 6,
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
  scenarioBox: {
    marginTop: 10,
    padding: 10,
    borderWidth: 1,
    borderRadius: 4,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  scenarioTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 5,
  },
  scenarioGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
}

/**
 * Single Multi-Family EV Analysis Document
 */
export const MultiFamilyEVDocument: React.FC<MultiFamilyEVDocumentProps> = ({
  result,
  buildingName,
  preparedBy,
  preparedFor,
}) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Multi-Family EV Readiness Analysis</Text>
          <Text style={styles.subtitle}>{buildingName || 'Building Analysis'}</Text>
          <Text style={styles.subtitle}>NEC 220.84 + NEC 220.57 + NEC 625.42</Text>
          {preparedFor && <Text style={styles.subtitle}>Prepared for: {preparedFor}</Text>}
          {preparedBy && <Text style={styles.subtitle}>Prepared by: {preparedBy}</Text>}
          <Text style={styles.subtitle}>{currentDate}</Text>
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
              <Text style={styles.label}>EV DEMAND (NEC 220.57)</Text>
              <Text style={styles.value}>{result.evLoad.loadAmps}A</Text>
              <Text style={styles.subValue}>
                {(result.evLoad.demandVA / 1000).toFixed(1)} kVA @ {(result.evLoad.demandFactor * 100).toFixed(0)}% DF
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

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Generated by NEC Pro Compliance | Multi-Family EV Readiness Analysis</Text>
          <Text>This report is for engineering reference purposes. Verify all calculations per local AHJ requirements.</Text>
        </View>
      </Page>

      {/* Page 2: Scenarios & Cost Comparison */}
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>EV Capacity Scenarios</Text>
          <Text style={styles.subtitle}>{buildingName || 'Building Analysis'}</Text>
        </View>

        {/* Scenario A: No EVEMS */}
        <View style={styles.scenarioBox}>
          <Text style={styles.scenarioTitle}>{result.scenarios.noEVEMS.name}</Text>
          <View style={styles.scenarioGrid}>
            <View style={styles.gridItem3}>
              <Text style={styles.label}>MAX CHARGERS</Text>
              <Text style={styles.value}>{result.scenarios.noEVEMS.maxChargers}</Text>
            </View>
            <View style={styles.gridItem3}>
              <Text style={styles.label}>UPGRADE REQUIRED</Text>
              <Text style={styles.value}>{result.scenarios.noEVEMS.requiresServiceUpgrade ? 'Yes' : 'No'}</Text>
            </View>
            <View style={styles.gridItem3}>
              <Text style={styles.label}>EST. COST</Text>
              <Text style={styles.value}>
                ${result.scenarios.noEVEMS.estimatedCostLow?.toLocaleString()} - ${result.scenarios.noEVEMS.estimatedCostHigh?.toLocaleString()}
              </Text>
            </View>
          </View>
          {result.scenarios.noEVEMS.notes.length > 0 && (
            <View style={{ marginTop: 5 }}>
              {result.scenarios.noEVEMS.notes.map((note, idx) => (
                <Text key={idx} style={{ fontSize: 8, color: '#666' }}>• {note}</Text>
              ))}
            </View>
          )}
        </View>

        {/* Scenario B: With EVEMS */}
        <View style={[styles.scenarioBox, { borderColor: '#3b82f6', backgroundColor: '#eff6ff' }]}>
          <Text style={styles.scenarioTitle}>{result.scenarios.withEVEMS.name}</Text>
          <View style={styles.scenarioGrid}>
            <View style={styles.gridItem3}>
              <Text style={styles.label}>MAX CHARGERS</Text>
              <Text style={[styles.value, { color: '#1e40af' }]}>{result.scenarios.withEVEMS.maxChargers}</Text>
            </View>
            <View style={styles.gridItem3}>
              <Text style={styles.label}>POWER PER CHARGER</Text>
              <Text style={styles.value}>
                {result.scenarios.withEVEMS.powerPerCharger_kW
                  ? `${result.scenarios.withEVEMS.powerPerCharger_kW.toFixed(1)} kW`
                  : 'Dynamic'}
              </Text>
            </View>
            <View style={styles.gridItem3}>
              <Text style={styles.label}>EST. COST</Text>
              <Text style={styles.value}>
                ${result.scenarios.withEVEMS.estimatedCostLow?.toLocaleString()} - ${result.scenarios.withEVEMS.estimatedCostHigh?.toLocaleString()}
              </Text>
            </View>
          </View>
          {result.scenarios.withEVEMS.notes.length > 0 && (
            <View style={{ marginTop: 5 }}>
              {result.scenarios.withEVEMS.notes.map((note, idx) => (
                <Text key={idx} style={{ fontSize: 8, color: '#1e3a8a' }}>• {note}</Text>
              ))}
            </View>
          )}
        </View>

        {/* Scenario C: With Upgrade */}
        <View style={styles.scenarioBox}>
          <Text style={styles.scenarioTitle}>{result.scenarios.withUpgrade.name}</Text>
          <View style={styles.scenarioGrid}>
            <View style={styles.gridItem3}>
              <Text style={styles.label}>MAX CHARGERS</Text>
              <Text style={styles.value}>{result.scenarios.withUpgrade.maxChargers}</Text>
            </View>
            <View style={styles.gridItem3}>
              <Text style={styles.label}>NEW SERVICE SIZE</Text>
              <Text style={styles.value}>{result.scenarios.withUpgrade.recommendedServiceAmps}A</Text>
            </View>
            <View style={styles.gridItem3}>
              <Text style={styles.label}>EST. COST</Text>
              <Text style={styles.value}>
                ${result.scenarios.withUpgrade.estimatedCostLow?.toLocaleString()} - ${result.scenarios.withUpgrade.estimatedCostHigh?.toLocaleString()}
              </Text>
            </View>
          </View>
          {result.scenarios.withUpgrade.notes.length > 0 && (
            <View style={{ marginTop: 5 }}>
              {result.scenarios.withUpgrade.notes.map((note, idx) => (
                <Text key={idx} style={{ fontSize: 8, color: '#666' }}>• {note}</Text>
              ))}
            </View>
          )}
        </View>

        {/* Cost Comparison Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cost Comparison Summary</Text>
          <View style={styles.costTable}>
            <View style={styles.costTableHeader}>
              <Text style={[styles.costTableHeaderCell, { width: '35%' }]}>Scenario</Text>
              <Text style={[styles.costTableHeaderCell, { width: '20%', textAlign: 'center' }]}>Max Chargers</Text>
              <Text style={[styles.costTableHeaderCell, { width: '45%', textAlign: 'right' }]}>Estimated Cost Range</Text>
            </View>
            {result.costComparison.map((item, idx) => (
              <View key={idx} style={styles.costTableRow}>
                <Text style={[styles.costTableCell, { width: '35%' }]}>{item.scenario}</Text>
                <Text style={[styles.costTableCell, { width: '20%', textAlign: 'center' }]}>{item.maxChargers}</Text>
                <Text style={[styles.costTableCell, { width: '45%', textAlign: 'right' }]}>
                  ${item.estimatedCostLow.toLocaleString()} - ${item.estimatedCostHigh.toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Transformer Check (if applicable) */}
        {result.transformerCheck && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Transformer Capacity Check</Text>
            <View style={[styles.complianceBox,
              result.transformerCheck.status === 'red' ? styles.complianceBoxFail :
              result.transformerCheck.status === 'yellow' ? styles.complianceBoxWarning :
              styles.complianceBoxPass
            ]}>
              <View style={styles.grid}>
                <View style={styles.gridItem3}>
                  <Text style={styles.label}>TRANSFORMER CAPACITY</Text>
                  <Text style={styles.value}>{result.transformerCheck.transformerCapacityAmps}A</Text>
                </View>
                <View style={styles.gridItem3}>
                  <Text style={styles.label}>TOTAL LOAD</Text>
                  <Text style={styles.value}>{result.transformerCheck.totalLoadAmps}A</Text>
                </View>
                <View style={styles.gridItem3}>
                  <Text style={styles.label}>UTILIZATION</Text>
                  <Text style={styles.value}>{result.transformerCheck.utilizationPercent}%</Text>
                </View>
              </View>
              <Text style={styles.complianceText}>{result.transformerCheck.recommendation}</Text>
            </View>
          </View>
        )}

        {/* Phase Balance (if applicable) */}
        {result.phaseBalance && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3-Phase Load Balance</Text>
            <View style={[styles.complianceBox, result.phaseBalance.isAcceptable ? styles.complianceBoxPass : styles.complianceBoxWarning]}>
              <View style={styles.grid}>
                <View style={styles.gridItem3}>
                  <Text style={styles.label}>PHASE A</Text>
                  <Text style={styles.value}>{result.phaseBalance.phaseLoads.phaseA}A</Text>
                  <Text style={styles.subValue}>{result.phaseBalance.chargerDistribution.phaseA} chargers</Text>
                </View>
                <View style={styles.gridItem3}>
                  <Text style={styles.label}>PHASE B</Text>
                  <Text style={styles.value}>{result.phaseBalance.phaseLoads.phaseB}A</Text>
                  <Text style={styles.subValue}>{result.phaseBalance.chargerDistribution.phaseB} chargers</Text>
                </View>
                <View style={styles.gridItem3}>
                  <Text style={styles.label}>PHASE C</Text>
                  <Text style={styles.value}>{result.phaseBalance.phaseLoads.phaseC}A</Text>
                  <Text style={styles.subValue}>{result.phaseBalance.chargerDistribution.phaseC} chargers</Text>
                </View>
              </View>
              <Text style={styles.complianceText}>
                Imbalance: {result.phaseBalance.imbalancePercent}% ({result.phaseBalance.isAcceptable ? 'Acceptable' : 'Exceeds 15% recommendation'})
              </Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Generated by NEC Pro Compliance | Multi-Family EV Readiness Analysis</Text>
          <Text>This report is for engineering reference purposes. Verify all calculations per local AHJ requirements.</Text>
        </View>
      </Page>

      {/* Page 3: Compliance & Load Breakdown */}
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Compliance & Load Breakdown</Text>
          <Text style={styles.subtitle}>{buildingName || 'Building Analysis'}</Text>
        </View>

        {/* Compliance Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NEC Compliance Summary</Text>
          <View style={[styles.complianceBox, result.compliance.isCompliant ? styles.complianceBoxPass : styles.complianceBoxWarning]}>
            <Text style={styles.complianceTitle}>
              {result.compliance.isCompliant ? '✓ NEC Compliant Design' : '⚠ Action Required'}
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
          <Text style={styles.sectionTitle}>Detailed Load Breakdown (NEC 220.84)</Text>
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
              <Text style={styles.tableCellLabel}>Total Connected EV Load</Text>
              <Text style={styles.tableCellValue}>{(result.evLoad.totalConnectedVA / 1000).toFixed(1)} kVA</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>NEC 220.57 Demand Factor</Text>
              <Text style={styles.tableCellValue}>{(result.evLoad.demandFactor * 100).toFixed(0)}%</Text>
            </View>
            <View style={[styles.tableRow, { backgroundColor: '#f3f4f6' }]}>
              <Text style={[styles.tableCellLabel, { fontFamily: 'Helvetica-Bold' }]}>Total EV Demand</Text>
              <Text style={[styles.tableCellValue, { fontFamily: 'Helvetica-Bold' }]}>
                {(result.evLoad.demandVA / 1000).toFixed(1)} kVA ({result.evLoad.loadAmps}A)
              </Text>
            </View>
          </View>
        </View>

        {/* Notes Box */}
        <View style={styles.notesBox}>
          <Text style={styles.notesTitle}>Important Notes</Text>
          <Text style={styles.notesText}>
            • This analysis uses NEC 220.84 Optional Calculation for multi-family dwellings (3+ units)
          </Text>
          <Text style={styles.notesText}>
            • EV demand factors per NEC 220.57 are applied based on the number of EVSE units
          </Text>
          <Text style={styles.notesText}>
            • EVEMS scenarios assume NEC 625.42 compliant load management system
          </Text>
          <Text style={styles.notesText}>
            • All branch circuits must still be sized at 125% per NEC 625.40
          </Text>
          <Text style={styles.notesText}>
            • Cost estimates are approximate and vary by location and conditions
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Generated by NEC Pro Compliance | Multi-Family EV Readiness Analysis</Text>
          <Text>This report is for engineering reference purposes. Verify all calculations per local AHJ requirements.</Text>
        </View>
      </Page>
    </Document>
  );
};
