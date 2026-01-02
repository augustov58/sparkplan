/**
 * Arc Flash Analysis PDF Document Components
 * React PDF document structure for arc flash hazard analysis
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ArcFlashResult } from '../calculations/arcFlash';

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
    fontWeight: 'bold',
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
    fontWeight: 'bold',
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
    fontSize: 10,
    fontWeight: 'bold',
  },
  table: {
    marginTop: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingVertical: 6,
  },
  tableHeader: {
    backgroundColor: '#f3f4f6',
    fontWeight: 'bold',
  },
  tableCol: {
    fontSize: 9,
  },
  hazardBox: {
    padding: 12,
    borderRadius: 4,
    marginTop: 10,
    marginBottom: 15,
  },
  hazardDanger: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  hazardWarning: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  hazardSafe: {
    backgroundColor: '#d1fae5',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  hazardText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  complianceBox: {
    padding: 10,
    backgroundColor: '#eff6ff',
    borderRadius: 4,
    marginTop: 15,
  },
  complianceText: {
    fontSize: 9,
    color: '#1e40af',
    marginBottom: 3,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#666',
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingTop: 10,
  },
});

interface ArcFlashDocumentProps {
  projectName: string;
  projectAddress?: string;
  equipmentName: string;
  arcFlashData: {
    equipmentType: string;
    systemVoltage: number;
    faultCurrent: number;
    workingDistance: number;
    clearingTime: number;
    result: ArcFlashResult;
  };
}

export const ArcFlashDocument: React.FC<ArcFlashDocumentProps> = ({
  projectName,
  projectAddress,
  equipmentName,
  arcFlashData,
}) => {
  const { result } = arcFlashData;

  // Determine hazard level styling
  const getHazardStyle = () => {
    if (result.incidentEnergy >= 40) return styles.hazardDanger;
    if (result.incidentEnergy >= 8) return styles.hazardWarning;
    return styles.hazardSafe;
  };

  const getHazardLabel = () => {
    if (result.incidentEnergy >= 40) return '🔴 DANGER - Extreme Hazard';
    if (result.incidentEnergy >= 8) return '🟡 WARNING - High Hazard';
    return '🟢 CAUTION - Moderate Hazard';
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>ARC FLASH HAZARD ANALYSIS</Text>
          <Text style={styles.subtitle}>{projectName}</Text>
          {projectAddress && <Text style={styles.subtitle}>{projectAddress}</Text>}
          <Text style={{ fontSize: 10, marginTop: 5 }}>Equipment: {equipmentName}</Text>
        </View>

        {/* Incident Energy Result */}
        <View style={[styles.hazardBox, getHazardStyle()]}>
          <Text style={styles.hazardText}>{getHazardLabel()}</Text>
          <Text style={{ fontSize: 14, fontWeight: 'bold', marginTop: 5 }}>
            Incident Energy: {result.incidentEnergy.toFixed(2)} cal/cm²
          </Text>
          <Text style={{ fontSize: 10, marginTop: 3 }}>
            Arc Flash Boundary: {result.arcFlashBoundary.toFixed(1)} inches
          </Text>
        </View>

        {/* Input Parameters */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Input Parameters</Text>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Equipment Type</Text>
              <Text style={styles.value}>{arcFlashData.equipmentType}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>System Voltage</Text>
              <Text style={styles.value}>{arcFlashData.systemVoltage}V</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Working Distance</Text>
              <Text style={styles.value}>{arcFlashData.workingDistance} inches</Text>
            </View>
          </View>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Fault Current</Text>
              <Text style={styles.value}>{arcFlashData.faultCurrent} kA</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Clearing Time</Text>
              <Text style={styles.value}>{arcFlashData.clearingTime} cycles</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Arc Duration</Text>
              <Text style={styles.value}>{result.arcDuration.toFixed(3)} seconds</Text>
            </View>
          </View>
        </View>

        {/* PPE Requirements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Required Personal Protective Equipment (PPE)</Text>
          <View style={styles.table}>
            {/* PPE Category */}
            <View style={[styles.tableRow, { backgroundColor: '#f9fafb', paddingVertical: 8 }]}>
              <Text style={{ ...styles.tableCol, width: '30%', fontWeight: 'bold' }}>
                PPE Category:
              </Text>
              <Text style={{ ...styles.tableCol, width: '70%', fontSize: 11, fontWeight: 'bold' }}>
                {result.ppeCategory}
              </Text>
            </View>

            {/* AR Rating */}
            <View style={styles.tableRow}>
              <Text style={{ ...styles.tableCol, width: '30%' }}>Arc-Rated Clothing:</Text>
              <Text style={{ ...styles.tableCol, width: '70%' }}>
                Minimum {result.arcRating} cal/cm² arc rating
              </Text>
            </View>

            {/* PPE List */}
            <View style={styles.tableRow}>
              <Text style={{ ...styles.tableCol, width: '30%' }}>Required PPE:</Text>
              <View style={{ width: '70%' }}>
                {result.requiredPPE.map((item, index) => (
                  <Text key={index} style={{ ...styles.tableCol, marginBottom: 2 }}>
                    • {item}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* NFPA 70E Compliance */}
        <View style={styles.complianceBox}>
          <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1e40af', marginBottom: 5 }}>
            NFPA 70E Compliance Notes:
          </Text>
          <Text style={styles.complianceText}>
            • This analysis follows IEEE 1584-2018 calculation methods
          </Text>
          <Text style={styles.complianceText}>
            • PPE requirements per NFPA 70E Table 130.7(C)(15)(a)
          </Text>
          <Text style={styles.complianceText}>
            • Arc flash boundary calculated using 1.2 cal/cm² threshold
          </Text>
          <Text style={styles.complianceText}>
            • All personnel must wear appropriate PPE when working within {result.arcFlashBoundary.toFixed(1)}" of energized equipment
          </Text>
        </View>

        {/* Warning Label */}
        <View style={{ marginTop: 20, padding: 12, backgroundColor: '#fef3c7', borderRadius: 4, borderWidth: 1, borderColor: '#f59e0b' }}>
          <Text style={{ fontSize: 9, fontWeight: 'bold', marginBottom: 4, color: '#92400e' }}>
            ⚠️ ARC FLASH HAZARD LABEL REQUIRED
          </Text>
          <Text style={{ fontSize: 8, color: '#92400e' }}>
            Per NFPA 70E 130.5, equipment must be labeled with arc flash boundary,
            incident energy, PPE category, and required protective equipment.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            Arc Flash Analysis per IEEE 1584-2018 and NFPA 70E-2021
          </Text>
          <Text style={{ marginTop: 3 }}>
            This analysis is valid only for the specified equipment configuration and operating conditions
          </Text>
        </View>
      </Page>
    </Document>
  );
};
