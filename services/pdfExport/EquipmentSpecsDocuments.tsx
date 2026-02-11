/**
 * Equipment Specifications PDF Document
 *
 * Generates professional equipment specification sheets for electrical permit applications
 * following existing PDF patterns (React-PDF, StyleSheet, professional formatting).
 *
 * @module services/pdfExport/EquipmentSpecsDocuments
 */

import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import type { PanelEquipmentSpecs, TransformerEquipmentSpecs } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

interface Panel {
  id: string;
  name: string;
  voltage: number;
  phase: 1 | 3;
  bus_rating: number;
  main_breaker_amps?: number;
  location?: string;
  // Equipment specs
  manufacturer?: string;
  model_number?: string;
  nema_enclosure_type?: string;
  ul_listing?: string;
  aic_rating?: number;
  series_rating?: boolean;
  notes?: string;
}

interface Transformer {
  id: string;
  name: string;
  kva_rating: number;
  primary_voltage: number;
  primary_phase: 1 | 3;
  secondary_voltage: number;
  secondary_phase: 1 | 3;
  location?: string;
  // Equipment specs
  manufacturer?: string;
  model_number?: string;
  winding_type?: string;
  impedance_percent?: number;
  cooling_type?: string;
  ul_listing?: string;
  temperature_rise?: number;
  notes?: string;
}

interface EquipmentSpecsDocumentProps {
  projectName: string;
  projectAddress?: string;
  panels: Panel[];
  transformers: Transformer[];
  includeNECReferences?: boolean;
}

// ============================================================================
// STYLES (Following existing pattern from PanelScheduleDocuments.tsx)
// ============================================================================

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff'
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    paddingBottom: 10
  },
  title: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 5
  },
  projectInfo: {
    fontSize: 9,
    color: '#666',
    marginTop: 5
  },
  section: {
    marginBottom: 20
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 10,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#000'
  },
  table: {
    marginBottom: 15
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8
  },
  tableRow: {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#000',
    paddingVertical: 4,
    paddingHorizontal: 4
  },
  tableRowAlt: {
    flexDirection: 'row',
    backgroundColor: '#f9f9f9',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#000',
    paddingVertical: 4,
    paddingHorizontal: 4
  },
  // Column widths (total = 100%)
  col_name: { width: '12%', fontSize: 8 },
  col_voltage: { width: '8%', fontSize: 8 },
  col_bus: { width: '8%', fontSize: 8 },
  col_manufacturer: { width: '12%', fontSize: 8 },
  col_model: { width: '12%', fontSize: 8 },
  col_nema: { width: '8%', fontSize: 8 },
  col_aic: { width: '8%', fontSize: 8 },
  col_ul: { width: '20%', fontSize: 7 },
  col_notes: { width: '12%', fontSize: 7 },
  // Transformer columns
  col_tr_name: { width: '10%', fontSize: 8 },
  col_tr_kva: { width: '10%', fontSize: 8 },
  col_tr_primary: { width: '10%', fontSize: 8 },
  col_tr_secondary: { width: '10%', fontSize: 8 },
  col_tr_manufacturer: { width: '12%', fontSize: 8 },
  col_tr_model: { width: '12%', fontSize: 8 },
  col_tr_type: { width: '10%', fontSize: 7 },
  col_tr_cooling: { width: '8%', fontSize: 7 },
  col_tr_ul: { width: '18%', fontSize: 7 },
  // NEC references
  necBox: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f0f7ff',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 4
  },
  necTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 5,
    color: '#1e40af'
  },
  necList: {
    fontSize: 8,
    lineHeight: 1.4,
    color: '#374151'
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 7,
    color: '#666',
    textAlign: 'center',
    borderTopWidth: 0.5,
    borderTopColor: '#ccc',
    paddingTop: 5
  }
});

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * Panel Equipment Specifications Table
 */
const PanelSpecsTable: React.FC<{ panels: Panel[] }> = ({ panels }) => {
  if (panels.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PANELBOARDS</Text>
        <Text style={{ fontSize: 9, color: '#666', fontStyle: 'italic' }}>
          No panels with equipment specifications
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>PANELBOARDS</Text>
      <View style={styles.table}>
        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={styles.col_name}>Panel</Text>
          <Text style={styles.col_voltage}>Voltage</Text>
          <Text style={styles.col_bus}>Bus (A)</Text>
          <Text style={styles.col_manufacturer}>Manufacturer</Text>
          <Text style={styles.col_model}>Model</Text>
          <Text style={styles.col_nema}>NEMA</Text>
          <Text style={styles.col_aic}>AIC (kA)</Text>
          <Text style={styles.col_ul}>UL Listing</Text>
          <Text style={styles.col_notes}>Notes</Text>
        </View>

        {/* Table Rows */}
        {panels.map((panel, index) => (
          <View key={panel.id} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
            <Text style={styles.col_name}>{panel.name}</Text>
            <Text style={styles.col_voltage}>
              {panel.voltage}V {panel.phase}Φ
            </Text>
            <Text style={styles.col_bus}>{panel.bus_rating}A</Text>
            <Text style={styles.col_manufacturer}>{panel.manufacturer || '—'}</Text>
            <Text style={styles.col_model}>{panel.model_number || '—'}</Text>
            <Text style={styles.col_nema}>{panel.nema_enclosure_type || '—'}</Text>
            <Text style={styles.col_aic}>
              {panel.aic_rating ? `${panel.aic_rating} kA` : '—'}
              {panel.series_rating && '*'}
            </Text>
            <Text style={styles.col_ul}>{panel.ul_listing || '—'}</Text>
            <Text style={styles.col_notes}>{panel.notes || '—'}</Text>
          </View>
        ))}
      </View>

      {/* Series Rating Footnote */}
      {panels.some(p => p.series_rating) && (
        <Text style={{ fontSize: 7, color: '#666', marginTop: 5 }}>
          * Series-rated system per NEC 240.86
        </Text>
      )}
    </View>
  );
};

/**
 * Transformer Equipment Specifications Table
 */
const TransformerSpecsTable: React.FC<{ transformers: Transformer[] }> = ({ transformers }) => {
  if (transformers.length === 0) {
    return null; // Don't show section if no transformers
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>TRANSFORMERS</Text>
      <View style={styles.table}>
        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={styles.col_tr_name}>Name</Text>
          <Text style={styles.col_tr_kva}>kVA</Text>
          <Text style={styles.col_tr_primary}>Primary</Text>
          <Text style={styles.col_tr_secondary}>Secondary</Text>
          <Text style={styles.col_tr_manufacturer}>Manufacturer</Text>
          <Text style={styles.col_tr_model}>Model</Text>
          <Text style={styles.col_tr_type}>Type</Text>
          <Text style={styles.col_tr_cooling}>Cooling</Text>
          <Text style={styles.col_tr_ul}>UL Listing</Text>
        </View>

        {/* Table Rows */}
        {transformers.map((transformer, index) => (
          <View key={transformer.id} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
            <Text style={styles.col_tr_name}>{transformer.name}</Text>
            <Text style={styles.col_tr_kva}>{transformer.kva_rating}</Text>
            <Text style={styles.col_tr_primary}>
              {transformer.primary_voltage}V {transformer.primary_phase}Φ
            </Text>
            <Text style={styles.col_tr_secondary}>
              {transformer.secondary_voltage}V {transformer.secondary_phase}Φ
            </Text>
            <Text style={styles.col_tr_manufacturer}>{transformer.manufacturer || '—'}</Text>
            <Text style={styles.col_tr_model}>{transformer.model_number || '—'}</Text>
            <Text style={styles.col_tr_type}>{transformer.winding_type || '—'}</Text>
            <Text style={styles.col_tr_cooling}>{transformer.cooling_type || '—'}</Text>
            <Text style={styles.col_tr_ul}>{transformer.ul_listing || '—'}</Text>
          </View>
        ))}
      </View>

      {/* Transformer Notes */}
      {transformers.some(t => t.notes) && (
        <View style={{ marginTop: 10 }}>
          <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', marginBottom: 3 }}>Notes:</Text>
          {transformers.filter(t => t.notes).map((t, index) => (
            <Text key={t.id} style={{ fontSize: 7, color: '#374151', marginBottom: 2 }}>
              • {t.name}: {t.notes}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
};

/**
 * NEC References Section
 */
const NECReferences: React.FC = () => (
  <View style={styles.necBox}>
    <Text style={styles.necTitle}>NEC CODE REFERENCES</Text>
    <View style={styles.necList}>
      <Text style={{ marginBottom: 4 }}>
        • <Text style={{ fontFamily: 'Helvetica-Bold' }}>NEC 110.3(B)</Text> - Listed Equipment:
        All equipment must be listed and labeled by a qualified testing laboratory (UL, ETL, etc.)
        and installed in accordance with listing instructions.
      </Text>
      <Text style={{ marginBottom: 4 }}>
        • <Text style={{ fontFamily: 'Helvetica-Bold' }}>NEC 110.9</Text> - Interrupting Rating:
        Equipment intended to interrupt current at fault levels must have an adequate interrupting
        rating for the maximum available fault current at its line terminals.
      </Text>
      <Text style={{ marginBottom: 4 }}>
        • <Text style={{ fontFamily: 'Helvetica-Bold' }}>NEC 240.86</Text> - Series Ratings:
        Where circuit breakers or fuses are applied in combination to achieve series-rated protection,
        they must be tested and marked for this application. Series-rated systems require specific
        manufacturer approvals.
      </Text>
      <Text>
        • <Text style={{ fontFamily: 'Helvetica-Bold' }}>NEC 408.20</Text> - Enclosure Types:
        Panelboards must be provided in cabinets or cutout boxes with suitable enclosure types per
        NEMA 250 based on environmental conditions.
      </Text>
    </View>
  </View>
);

// ============================================================================
// MAIN DOCUMENT
// ============================================================================

/**
 * Equipment Specifications PDF Document
 *
 * @param props - Document properties
 * @returns React-PDF Document component
 */
export const EquipmentSpecsDocument: React.FC<EquipmentSpecsDocumentProps> = ({
  projectName,
  projectAddress,
  panels,
  transformers,
  includeNECReferences = true
}) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <Document>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>EQUIPMENT SPECIFICATIONS</Text>
          <Text style={styles.projectInfo}>Project: {projectName}</Text>
          {projectAddress && <Text style={styles.projectInfo}>Location: {projectAddress}</Text>}
          <Text style={styles.projectInfo}>Date: {currentDate}</Text>
        </View>

        {/* Panel Specifications Table */}
        <PanelSpecsTable panels={panels} />

        {/* Transformer Specifications Table */}
        <TransformerSpecsTable transformers={transformers} />

        {/* NEC References */}
        {includeNECReferences && <NECReferences />}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            Generated by SparkPlan • {currentDate} • For permit application purposes
          </Text>
        </View>
      </Page>
    </Document>
  );
};
