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
import type { Circuit } from '../../lib/database.types';
import { isEVEMSManagedPanel } from '../calculations/upstreamLoadAggregation';
import {
  BrandBar,
  Footer as BrandFooter,
  phaseLabel,
  formatAicKa,
  themeStyles,
} from './permitPacketTheme';

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
  // Sprint 2A H15: optional circuits for EV-panel detection (EVEMS marker
  // circuits). Without circuits, EV detection falls back to name pattern.
  circuits?: Circuit[];
  includeNECReferences?: boolean;
  // Sprint 2A C8: per-sheet contractor signature block
  contractorName?: string;
  contractorLicense?: string;
  // Sprint 2A H3: per-sheet ID (e.g., '203')
  sheetId?: string;
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
              {panel.voltage}V {phaseLabel(panel.phase)}
            </Text>
            <Text style={styles.col_bus}>{panel.bus_rating}A</Text>
            <Text style={styles.col_manufacturer}>{panel.manufacturer || '—'}</Text>
            <Text style={styles.col_model}>{panel.model_number || '—'}</Text>
            <Text style={styles.col_nema}>{panel.nema_enclosure_type || '—'}</Text>
            <Text style={styles.col_aic}>
              {formatAicKa(panel.aic_rating) ?? '—'}
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
              {transformer.primary_voltage}V {phaseLabel(transformer.primary_phase)}
            </Text>
            <Text style={styles.col_tr_secondary}>
              {transformer.secondary_voltage}V {phaseLabel(transformer.secondary_phase)}
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
 * Sprint 2A H15 — EV Charging Supply Equipment listings card.
 *
 * Required by Orlando's "EV Charging Station Permit Checklist" item #7
 * (both paths): "electrical specifications of EV chargers to include UL-2202
 * and UL-2594 listing and label information." This card cites the listing
 * standards by number on the Equipment Specs sheet so AHJ reviewers can
 * cross-check the contractor-supplied cut sheets (uploaded in Sprint 2B)
 * against the named standards.
 *
 * Renders only when at least one EV-bank panel is detected — either by
 * EVEMS marker circuit (NEC 625.42 managed) or by name pattern fallback
 * (residential duplex EV panels without EVEMS).
 */
const EVChargingListingsCard: React.FC<{
  evPanels: Panel[];
}> = ({ evPanels }) => {
  if (evPanels.length === 0) return null;

  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.sectionTitle}>EV CHARGING SUPPLY EQUIPMENT — APPLICABLE LISTING STANDARDS</Text>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.col_name, { width: '15%' }]}>Panel</Text>
          <Text style={{ width: '15%', fontSize: 8 }}>UL Standard</Text>
          <Text style={{ width: '70%', fontSize: 8 }}>Title</Text>
        </View>

        {evPanels.map((panel, idx) => (
          <React.Fragment key={panel.id}>
            <View style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={[styles.col_name, { width: '15%' }]}>{panel.name}</Text>
              <Text style={{ width: '15%', fontSize: 8, fontFamily: 'Helvetica-Bold' }}>UL-2202</Text>
              <Text style={{ width: '70%', fontSize: 7.5 }}>
                Standard for Electric Vehicle (EV) Charging System Equipment
              </Text>
            </View>
            <View style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={[styles.col_name, { width: '15%' }]}> </Text>
              <Text style={{ width: '15%', fontSize: 8, fontFamily: 'Helvetica-Bold' }}>UL-2594</Text>
              <Text style={{ width: '70%', fontSize: 7.5 }}>
                Standard for Electric Vehicle Supply Equipment (EVSE)
              </Text>
            </View>
          </React.Fragment>
        ))}
      </View>

      <View style={styles.necBox} wrap={false}>
        <Text style={styles.necTitle}>EVSE LISTING REQUIREMENT</Text>
        <View style={styles.necList}>
          <Text>
            Each EV charger installed under this permit shall bear the listing
            mark of UL-2202 (charging system) and/or UL-2594 (supply equipment)
            as applicable to its construction. Manufacturer cut sheets submitted
            with this packet must show the listing label or carry the listing
            file number from the appropriate NRTL (UL, ETL, or equivalent).
          </Text>
        </View>
      </View>
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
/**
 * Sprint 2A H15 \u2014 detect EV-bank panels for the UL-2202/2594 listings card.
 *
 * Two signals: (a) panel has an EVEMS marker circuit (NEC 625.42 managed
 * panel \u2014 most reliable), (b) panel name matches a common EV/charger pattern
 * (fallback for residential duplex EV panels with no EVEMS). Either signal
 * is enough \u2014 false positives just trigger a UL standards card on a panel
 * that may have no EVSE, which is safe (the card cites standards generically).
 */
const EV_NAME_PATTERN = /\b(ev|evse|charger|charging|level\s*2|l2)\b/i;

const detectEVPanels = (panels: Panel[], circuits: Circuit[] | undefined): Panel[] => {
  const dbCircuits = circuits ?? [];
  return panels.filter(
    p => isEVEMSManagedPanel(p.id, dbCircuits) || EV_NAME_PATTERN.test(p.name),
  );
};

export const EquipmentSpecsPages: React.FC<EquipmentSpecsDocumentProps> = ({
  projectName,
  projectAddress,
  panels,
  transformers,
  circuits,
  includeNECReferences = true,
  contractorName,
  contractorLicense,
  sheetId,
}) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const evPanels = detectEVPanels(panels, circuits);

  return (
    <Page size="LETTER" orientation="landscape" style={themeStyles.page}>
      <BrandBar pageLabel="EQUIPMENT SPECIFICATIONS" sheetId={sheetId} />
      <View style={themeStyles.titleBlock}>
        <Text style={themeStyles.docTitle}>Equipment Specifications</Text>
        <Text style={themeStyles.docSubtitle}>
          {projectName}
          {projectAddress ? ` \u2022 ${projectAddress}` : ''}
          {` \u2022 ${currentDate}`}
        </Text>
      </View>

      {/* Panel Specifications Table */}
      <PanelSpecsTable panels={panels} />

      {/* Transformer Specifications Table */}
      <TransformerSpecsTable transformers={transformers} />

      {/* Sprint 2A H15: EV charging listing standards (UL-2202 + UL-2594) */}
      <EVChargingListingsCard evPanels={evPanels} />

      {/* NEC References */}
      {includeNECReferences && <NECReferences />}

      <BrandFooter
        projectName={projectName}
        contractorName={contractorName}
        contractorLicense={contractorLicense}
        sheetId={sheetId}
      />
    </Page>
  );
};

export const EquipmentSpecsDocument: React.FC<EquipmentSpecsDocumentProps> = (props) => (
  <Document>
    <EquipmentSpecsPages {...props} />
  </Document>
);
