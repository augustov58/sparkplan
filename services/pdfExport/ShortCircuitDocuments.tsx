/**
 * Short Circuit Analysis PDF Document Components
 * React PDF document structure for short circuit calculations
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import type { ShortCircuitCalculation } from '../../lib/database.types';

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
    safetyFactor: number;
  };
  compliance: {
    necArticle: string;
    compliant: boolean;
    message: string;
  };
}

interface CalcProps {
  calculation: ShortCircuitCalculation;
  projectName: string;
  projectAddress?: string;
  panelName?: string;
}

export const ShortCircuitCalculationDocument: React.FC<CalcProps> = ({
  calculation,
  projectName,
  projectAddress,
  panelName,
}) => {
  const results = calculation.results as unknown as ShortCircuitResult;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>SHORT CIRCUIT CALCULATION REPORT</Text>
          <Text style={styles.subtitle}>{projectName}</Text>
          {projectAddress && <Text style={styles.subtitle}>{projectAddress}</Text>}
          <Text style={styles.subtitle}>{calculation.location_name}</Text>
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

        {/* Input Parameters */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>INPUT PARAMETERS</Text>
          <View style={styles.table}>
            {calculation.calculation_type === 'service' ? (
              <>
                <View style={styles.tableRow}>
                  <Text style={styles.tableCellLabel}>Service Rating:</Text>
                  <Text style={styles.tableCellValue}>
                    {calculation.service_amps}A, {calculation.service_voltage}V, {calculation.service_phase}φ
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
                        {calculation.service_conductor_size} {calculation.service_conductor_material}
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
                    {calculation.feeder_conductor_size} {calculation.feeder_material}
                  </Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.tableCellLabel}>Feeder Length:</Text>
                  <Text style={styles.tableCellValue}>{calculation.feeder_length} ft</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.tableCellLabel}>Feeder Voltage/Phase:</Text>
                  <Text style={styles.tableCellValue}>
                    {calculation.feeder_voltage}V, {calculation.feeder_phase}φ
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
                <Text style={styles.tableCellValue}>{results.details.conductorImpedance?.toFixed(4)} Ω</Text>
              </View>
            )}
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>Total Impedance (Ztotal):</Text>
              <Text style={styles.tableCellValue}>{results.details.totalImpedance.toFixed(4)} Ω</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>Fault Current at Point:</Text>
              <Text style={styles.tableCellValue}>
                {results.details.faultCurrentAtPoint.toLocaleString()} A
              </Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>Safety Factor Applied:</Text>
              <Text style={styles.tableCellValue}>{results.details.safetyFactor}×</Text>
            </View>
          </View>
        </View>

        {/* NEC Compliance */}
        <View style={[styles.complianceBox, results.compliance.compliant ? styles.complianceBoxPass : styles.complianceBoxFail]}>
          <Text style={styles.complianceTitle}>{results.compliance.necArticle}</Text>
          <Text style={styles.complianceText}>{results.compliance.message}</Text>
          <Text style={[styles.complianceText, { marginTop: 5, fontFamily: 'Helvetica-Bold' }]}>
            Status: {results.compliance.compliant ? '✓ COMPLIANT' : '✗ REQUIRES REVIEW'}
          </Text>
        </View>

        {/* Notes */}
        {calculation.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesTitle}>NOTES</Text>
            <Text style={styles.notesText}>{calculation.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          Generated by SparkPlan • {new Date().toLocaleDateString()} • Page 1 of 1
        </Text>
      </Page>
    </Document>
  );
};

interface SystemReportProps {
  calculations: ShortCircuitCalculation[];
  projectName: string;
  projectAddress: string;
  panels?: any[];
}

export const ShortCircuitSystemReport: React.FC<SystemReportProps> = ({
  calculations,
  projectName,
  projectAddress,
  panels,
}) => {
  return (
    <Document>
      {/* Cover Page */}
      <Page size="LETTER" style={styles.page}>
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
      </Page>

      {/* Individual Calculation Pages */}
      {calculations.map((calc, index) => {
        const results = calc.results as unknown as ShortCircuitResult;
        const panel = panels?.find(p => p.id === calc.panel_id);

        return (
          <Page key={calc.id} size="LETTER" style={styles.page}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>{calc.location_name}</Text>
              {panel && (
                <Text style={styles.subtitle}>
                  {panel.bus_rating}A Panel • {panel.voltage}V • {panel.phase}φ
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
                <Text style={styles.value}>
                  {results.compliance.compliant ? '✓ Pass' : '✗ Review'}
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
                        {calc.service_amps}A, {calc.service_voltage}V, {calc.service_phase}φ
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
                  <Text style={styles.tableCellValue}>{results.details.totalImpedance.toFixed(4)} Ω</Text>
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

            {/* Footer */}
            <Text style={styles.footer}>
              {projectName} • Page {index + 2} of {calculations.length + 1}
            </Text>
          </Page>
        );
      })}
    </Document>
  );
};
