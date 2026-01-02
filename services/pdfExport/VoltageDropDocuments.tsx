/**
 * Voltage Drop Report PDF Document Component
 *
 * Generates professional voltage drop analysis report for all feeders in a project.
 * Uses React-PDF renderer for PDF generation.
 *
 * @module services/pdfExport/VoltageDropDocuments
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font
} from '@react-pdf/renderer';
import type { Feeder, Panel, Transformer } from '../../lib/database.types';
import { calculateFeederSizing } from '../calculations/feederSizing';
import type { FeederCalculationInput, FeederCalculationResult } from '../../types';

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 20,
    borderBottom: '2pt solid #1f2937',
    paddingBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#6b7280',
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    borderBottom: '1pt solid #d1d5db',
    paddingBottom: 4,
  },
  table: {
    display: 'flex',
    width: '100%',
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    padding: 6,
    fontWeight: 'bold',
    borderBottom: '1pt solid #9ca3af',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 6,
    borderBottom: '0.5pt solid #e5e7eb',
  },
  // Column widths for voltage drop table
  col1: { width: '12%' }, // Feeder Name
  col2: { width: '15%' }, // From → To
  col3: { width: '10%' }, // Distance
  col4: { width: '15%' }, // Conductor
  col5: { width: '10%' }, // Current
  col6: { width: '10%' }, // VD Volts
  col7: { width: '10%' }, // VD %
  col8: { width: '18%' }, // Compliance
  cellCenter: {
    textAlign: 'center',
  },
  cellRight: {
    textAlign: 'right',
  },
  compliantText: {
    color: '#059669',
    fontWeight: 'bold',
  },
  nonCompliantText: {
    color: '#dc2626',
    fontWeight: 'bold',
  },
  infoBox: {
    backgroundColor: '#eff6ff',
    border: '1pt solid #3b82f6',
    borderRadius: 4,
    padding: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  warningBox: {
    backgroundColor: '#fef3c7',
    border: '1pt solid #f59e0b',
    borderRadius: 4,
    padding: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  infoText: {
    fontSize: 8,
    color: '#1e40af',
    marginBottom: 2,
  },
  warningText: {
    fontSize: 8,
    color: '#92400e',
    marginBottom: 2,
  },
  necReferencesList: {
    marginTop: 8,
  },
  necReference: {
    fontSize: 8,
    color: '#4b5563',
    marginBottom: 3,
    paddingLeft: 10,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 7,
    color: '#9ca3af',
    textAlign: 'center',
    borderTop: '0.5pt solid #e5e7eb',
    paddingTop: 5,
  },
  summaryBox: {
    backgroundColor: '#f9fafb',
    border: '1pt solid #d1d5db',
    borderRadius: 4,
    padding: 10,
    marginBottom: 15,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 9,
    color: '#4b5563',
  },
  summaryValue: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1f2937',
  },
});

// ============================================================================
// INTERFACES
// ============================================================================

export interface VoltageDropDocumentProps {
  projectName: string;
  projectAddress?: string;
  feeders: Feeder[];
  panels: Panel[];
  transformers: Transformer[];
  includeNECReferences?: boolean;
}

interface FeederVoltageDropData {
  feeder: Feeder;
  fromName: string;
  toName: string;
  calculation: FeederCalculationResult;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get panel or transformer name by ID
 */
function getEquipmentName(
  id: string | null | undefined,
  panels: Panel[],
  transformers: Transformer[]
): string {
  if (!id) return 'Unknown';

  const panel = panels.find(p => p.id === id);
  if (panel) return panel.name;

  const transformer = transformers.find(t => t.id === id);
  if (transformer) return transformer.name;

  return 'Unknown';
}

/**
 * Calculate voltage drop for all feeders
 */
function calculateAllFeederVoltageDrops(
  feeders: Feeder[],
  panels: Panel[],
  transformers: Transformer[]
): FeederVoltageDropData[] {
  return feeders.map(feeder => {
    const fromName = getEquipmentName(feeder.source_panel_id, panels, transformers);
    const toName = getEquipmentName(
      feeder.destination_panel_id || feeder.destination_transformer_id,
      panels,
      transformers
    );

    // Get source panel to determine voltage and phase
    const sourcePanel = panels.find(p => p.id === feeder.source_panel_id);
    const voltage = sourcePanel?.voltage || 120; // Default to 120V if not found
    const phase = (sourcePanel?.phase || 1) as 1 | 3; // Default to 1-phase

    // Build input for feeder sizing calculation
    const input: FeederCalculationInput = {
      source_voltage: voltage,
      source_phase: phase,
      destination_voltage: voltage,
      destination_phase: phase,
      total_load_va: feeder.total_load_va || 0,
      continuous_load_va: (feeder.total_load_va || 0) * 0.8, // Assume 80% continuous (conservative)
      noncontinuous_load_va: (feeder.total_load_va || 0) * 0.2,
      distance_ft: feeder.distance_ft || 0,
      conductor_material: (feeder.conductor_material as 'Cu' | 'Al') || 'Cu',
      ambient_temperature_c: 30, // Default ambient temperature
      num_current_carrying: 3, // Default for typical 3-conductor + ground
      max_voltage_drop_percent: 3.0,
    };

    const calculation = calculateFeederSizing(input);

    return {
      feeder,
      fromName,
      toName,
      calculation,
    };
  });
}

/**
 * Get summary statistics
 */
function getSummaryStats(feederData: FeederVoltageDropData[]): {
  totalFeeders: number;
  compliantFeeders: number;
  nonCompliantFeeders: number;
  maxVoltageDropPercent: number;
  avgVoltageDropPercent: number;
} {
  const totalFeeders = feederData.length;
  const compliantFeeders = feederData.filter(f => f.calculation.meets_voltage_drop).length;
  const nonCompliantFeeders = totalFeeders - compliantFeeders;

  const voltageDrops = feederData.map(f => f.calculation.voltage_drop_percent);
  const maxVoltageDropPercent = voltageDrops.length > 0 ? Math.max(...voltageDrops) : 0;
  const avgVoltageDropPercent = voltageDrops.length > 0
    ? voltageDrops.reduce((a, b) => a + b, 0) / voltageDrops.length
    : 0;

  return {
    totalFeeders,
    compliantFeeders,
    nonCompliantFeeders,
    maxVoltageDropPercent,
    avgVoltageDropPercent,
  };
}

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * Header Component
 */
const Header: React.FC<{ projectName: string; projectAddress?: string }> = ({
  projectName,
  projectAddress,
}) => (
  <View style={styles.header}>
    <Text style={styles.title}>VOLTAGE DROP ANALYSIS REPORT</Text>
    <Text style={styles.subtitle}>{projectName}</Text>
    {projectAddress && <Text style={styles.subtitle}>{projectAddress}</Text>}
    <Text style={styles.subtitle}>
      Generated: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
    </Text>
  </View>
);

/**
 * Summary Box Component
 */
const SummaryBox: React.FC<{ stats: ReturnType<typeof getSummaryStats> }> = ({ stats }) => (
  <View style={styles.summaryBox}>
    <Text style={styles.sectionTitle}>Summary</Text>
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>Total Feeders:</Text>
      <Text style={styles.summaryValue}>{stats.totalFeeders}</Text>
    </View>
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>Compliant (≤3%):</Text>
      <Text style={[styles.summaryValue, styles.compliantText]}>
        {stats.compliantFeeders} ({stats.totalFeeders > 0 ? ((stats.compliantFeeders / stats.totalFeeders) * 100).toFixed(0) : 0}%)
      </Text>
    </View>
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>Non-Compliant (&gt;3%):</Text>
      <Text style={[styles.summaryValue, stats.nonCompliantFeeders > 0 ? styles.nonCompliantText : {}]}>
        {stats.nonCompliantFeeders} ({stats.totalFeeders > 0 ? ((stats.nonCompliantFeeders / stats.totalFeeders) * 100).toFixed(0) : 0}%)
      </Text>
    </View>
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>Maximum Voltage Drop:</Text>
      <Text style={styles.summaryValue}>{stats.maxVoltageDropPercent.toFixed(2)}%</Text>
    </View>
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>Average Voltage Drop:</Text>
      <Text style={styles.summaryValue}>{stats.avgVoltageDropPercent.toFixed(2)}%</Text>
    </View>
  </View>
);

/**
 * Voltage Drop Table Component
 */
const VoltageDropTable: React.FC<{ feederData: FeederVoltageDropData[] }> = ({ feederData }) => {
  if (feederData.length === 0) {
    return (
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          No feeders found in this project. Add feeders to see voltage drop analysis.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.table}>
      {/* Header Row */}
      <View style={styles.tableHeader}>
        <Text style={[styles.col1, styles.cellCenter]}>Feeder</Text>
        <Text style={[styles.col2, styles.cellCenter]}>From → To</Text>
        <Text style={[styles.col3, styles.cellCenter]}>Distance</Text>
        <Text style={[styles.col4, styles.cellCenter]}>Conductor</Text>
        <Text style={[styles.col5, styles.cellCenter]}>Current</Text>
        <Text style={[styles.col6, styles.cellCenter]}>VD (V)</Text>
        <Text style={[styles.col7, styles.cellCenter]}>VD (%)</Text>
        <Text style={[styles.col8, styles.cellCenter]}>Compliance</Text>
      </View>

      {/* Data Rows */}
      {feederData.map((data, index) => (
        <View key={index} style={styles.tableRow}>
          <Text style={styles.col1}>{data.feeder.name}</Text>
          <Text style={styles.col2}>{data.fromName} → {data.toName}</Text>
          <Text style={[styles.col3, styles.cellCenter]}>
            {data.feeder.distance_ft || 0} ft
          </Text>
          <Text style={styles.col4}>
            {data.calculation.phase_conductor_size || 'N/A'} {data.feeder.conductor_material || 'Cu'}
          </Text>
          <Text style={[styles.col5, styles.cellCenter]}>
            {(data.calculation.design_current_amps || 0).toFixed(1)} A
          </Text>
          <Text style={[styles.col6, styles.cellCenter]}>
            {(data.calculation.voltage_drop_volts || 0).toFixed(2)}
          </Text>
          <Text style={[styles.col7, styles.cellCenter]}>
            {(data.calculation.voltage_drop_percent || 0).toFixed(2)}%
          </Text>
          <Text
            style={[
              styles.col8,
              styles.cellCenter,
              data.calculation.meets_voltage_drop ? styles.compliantText : styles.nonCompliantText,
            ]}
          >
            {data.calculation.meets_voltage_drop ? '✓ Compliant' : '✗ Non-Compliant'}
          </Text>
        </View>
      ))}
    </View>
  );
};

/**
 * Warnings Section Component
 */
const WarningsSection: React.FC<{ feederData: FeederVoltageDropData[] }> = ({ feederData }) => {
  const nonCompliantFeeders = feederData.filter(f => !f.calculation.meets_voltage_drop);

  if (nonCompliantFeeders.length === 0) {
    return (
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          ✓ All feeders meet NEC 210.19 voltage drop recommendation (≤3%).
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>⚠️ Voltage Drop Warnings</Text>
      {nonCompliantFeeders.map((data, index) => (
        <View key={index} style={styles.warningBox}>
          <Text style={styles.warningText}>
            {data.feeder.name}: {data.calculation.voltage_drop_percent.toFixed(2)}% voltage drop exceeds 3% recommendation
          </Text>
          {data.calculation.warnings.map((warning, wIndex) => (
            <Text key={wIndex} style={styles.warningText}>• {warning}</Text>
          ))}
        </View>
      ))}
    </View>
  );
};

/**
 * NEC References Section Component
 */
const NECReferencesSection: React.FC = () => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>NEC References</Text>
    <View style={styles.necReferencesList}>
      <Text style={styles.necReference}>
        • NEC 210.19(A)(1) Informational Note No. 4 - Voltage drop should not exceed 3% for branch circuits
      </Text>
      <Text style={styles.necReference}>
        • NEC 215.2(A)(1)(b) Informational Note No. 2 - Voltage drop should not exceed 3% for feeders
      </Text>
      <Text style={styles.necReference}>
        • NEC Chapter 9 Table 9 - AC Resistance and Reactance for conductors (used for calculations)
      </Text>
      <Text style={styles.necReference}>
        • Total voltage drop (feeder + branch circuit) should not exceed 5% per NEC recommendations
      </Text>
      <Text style={styles.necReference}>
        • Voltage drop calculated using AC impedance method (Z = √(R² + X²)) for accuracy
      </Text>
      <Text style={styles.necReference}>
        • Power factor assumed at 0.85 for general loads (typical for commercial/industrial)
      </Text>
    </View>
  </View>
);

/**
 * Footer Component
 */
const Footer: React.FC = () => (
  <View style={styles.footer}>
    <Text>
      This report was generated by NEC Pro Compliance. Voltage drop calculated per NEC Chapter 9 Table 9 (AC Impedance Method).
    </Text>
    <Text>
      For critical loads, verify calculations with licensed professional engineer. NEC 2023 Edition.
    </Text>
  </View>
);

// ============================================================================
// MAIN DOCUMENT
// ============================================================================

/**
 * Main Voltage Drop Report PDF Document
 */
export const VoltageDropDocument: React.FC<VoltageDropDocumentProps> = ({
  projectName,
  projectAddress,
  feeders,
  panels,
  transformers,
  includeNECReferences = true,
}) => {
  // Calculate voltage drop for all feeders
  const feederData = calculateAllFeederVoltageDrops(feeders, panels, transformers);
  const stats = getSummaryStats(feederData);

  return (
    <Document>
      <Page size="LETTER" orientation="portrait" style={styles.page}>
        {/* Header */}
        <Header projectName={projectName} projectAddress={projectAddress} />

        {/* Summary Box */}
        <SummaryBox stats={stats} />

        {/* Voltage Drop Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Feeder Voltage Drop Analysis</Text>
          <VoltageDropTable feederData={feederData} />
        </View>

        {/* Warnings Section */}
        <WarningsSection feederData={feederData} />

        {/* NEC References */}
        {includeNECReferences && <NECReferencesSection />}

        {/* Footer */}
        <Footer />
      </Page>
    </Document>
  );
};
