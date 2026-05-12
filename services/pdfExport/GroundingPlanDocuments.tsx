/**
 * Grounding Plan PDF Document
 * React PDF document for grounding electrode system per NEC Article 250.
 *
 * Sprint 2A PR 4 / M3: project-specific grounding detail. When the project
 * has a `grounding_details` DB row, that row is the source of truth (preserves
 * user-entered electrode/bonding selections + any installed GEC override).
 * When the row is missing, the page derives a project-specific default from
 * the service ampacity using `calculateGroundingDetail` so the packet always
 * shows a real GEC size + electrode list rather than generic boilerplate.
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Database } from '../../lib/database.types';
import {
  BrandBar,
  Footer as BrandFooter,
  themeStyles,
} from './permitPacketTheme';
import {
  calculateGroundingDetail,
  type ConductorMaterial,
  type GroundingElectrode,
  type BondingRequirement,
} from '../calculations/groundingElectrodeConductor';

type GroundingDetail = Database['public']['Tables']['grounding_details']['Row'];

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
    marginBottom: 12,
  },
  gridItem: {
    width: '50%',
    paddingRight: 10,
  },
  label: {
    fontSize: 8,
    color: '#666',
    marginBottom: 2,
  },
  value: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  table: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableHeader: {
    backgroundColor: '#f3f4f6',
    fontFamily: 'Helvetica-Bold',
  },
  tableCol: {
    fontSize: 9,
  },
  // GEC project-specific summary card. wrap={false} keeps the card together
  // on a single page (Sprint 2A architectural pattern).
  gecCard: {
    marginTop: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1e40af',
    backgroundColor: '#eff6ff',
    borderRadius: 4,
  },
  gecCardHeader: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a8a',
    marginBottom: 6,
  },
  gecCardRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  gecCardLabel: {
    width: '40%',
    fontSize: 9,
    color: '#1e3a8a',
  },
  gecCardValue: {
    width: '60%',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#0b1d4f',
  },
  gecCardNote: {
    fontSize: 8,
    color: '#1e40af',
    marginTop: 6,
    fontStyle: 'italic',
  },
  compliantBox: {
    padding: 12,
    backgroundColor: '#d1fae5',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#10b981',
    marginTop: 15,
  },
  nonCompliantBox: {
    padding: 12,
    backgroundColor: '#fee2e2',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#dc2626',
    marginTop: 15,
  },
  necReference: {
    padding: 10,
    backgroundColor: '#eff6ff',
    borderRadius: 4,
    marginTop: 15,
  },
  necText: {
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
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingLeft: 5,
  },
  checkboxUnchecked: {
    fontSize: 10,
    marginRight: 6,
    color: '#666',
    fontFamily: 'Courier',
  },
  checkboxChecked: {
    fontSize: 10,
    marginRight: 6,
    color: '#10b981',
    fontFamily: 'Courier',
  },
  itemText: {
    fontSize: 9,
    flex: 1,
  },
  warningRow: {
    fontSize: 9,
    color: '#7c2d12',
    marginBottom: 3,
  },
});

interface GroundingPlanDocumentProps {
  projectName: string;
  projectAddress?: string;
  /**
   * Optional persisted grounding row. When omitted, the page derives a
   * project-specific default from `serviceAmperage` + `conductorMaterial`.
   * When present, the row's `gec_size` / `electrodes` / `bonding` fields
   * are used as the source of truth (and merged with the standard NEC
   * electrode + bonding catalogue so the packet still shows the full list
   * with checkbox state).
   */
  grounding?: GroundingDetail | null;
  serviceAmperage: number;
  conductorMaterial: ConductorMaterial;
  /**
   * Optional explicit service conductor size. When provided this is used
   * for direct NEC 250.66 lookup instead of the ampacity-based assumption.
   */
  serviceConductorSize?: string;
  // Sprint 2A C8: per-sheet contractor signature block
  contractorName?: string;
  contractorLicense?: string;
  // Sprint 2A H3: per-sheet ID
  sheetId?: string;
}

/**
 * Map raw `grounding_details.electrodes[]` strings (free-form labels) to
 * our `STANDARD_ELECTRODES` keys. Best-effort substring match.
 */
function presentElectrodeKeysFromDb(electrodes: string[] | null | undefined): string[] {
  if (!electrodes || electrodes.length === 0) return [];
  const keys: string[] = [];
  const text = electrodes.join('|').toLowerCase();
  if (text.includes('water pipe') || text.includes('water-pipe')) keys.push('metal-water-pipe');
  if (text.includes('frame') || text.includes('structural')) keys.push('metal-frame-building');
  if (text.includes('concrete') || text.includes('ufer')) keys.push('concrete-encased-electrode');
  if (text.includes('ring')) keys.push('ground-ring');
  if (text.includes('rod') || text.includes('pipe electrode')) keys.push('rod-pipe-electrode');
  if (text.includes('plate')) keys.push('plate-electrode');
  return Array.from(new Set(keys));
}

export const GroundingPlanPages: React.FC<GroundingPlanDocumentProps> = ({
  projectName,
  projectAddress,
  grounding,
  serviceAmperage,
  conductorMaterial,
  serviceConductorSize,
  contractorName,
  contractorLicense,
  sheetId,
}) => {
  // 1. Resolve project-specific grounding detail.
  //    - When the DB has electrodes, use them as the present-set.
  //    - When the DB has gec_size, treat it as an installed override.
  const dbPresentKeys = presentElectrodeKeysFromDb(grounding?.electrodes ?? undefined);
  const detail = calculateGroundingDetail({
    serviceAmps: serviceAmperage,
    conductorMaterial,
    serviceConductorSize,
    presentElectrodeKeys: dbPresentKeys.length > 0 ? dbPresentKeys : undefined,
    installedGecSize: grounding?.gec_size ?? undefined,
  });

  const presentElectrodes: GroundingElectrode[] = detail.electrodes;
  const bondingRequirements: BondingRequirement[] = detail.bondingRequirements;
  const isCompliant =
    presentElectrodes.some(e => e.present) && !!detail.gecSize;

  return (
    <Page size="LETTER" style={themeStyles.page}>
      <BrandBar pageLabel="GROUNDING PLAN" sheetId={sheetId} />
      <View style={themeStyles.titleBlock}>
        <Text style={themeStyles.docTitle}>Grounding Electrode System Plan</Text>
        <Text style={themeStyles.docSubtitle}>
          {projectName}
          {projectAddress ? ` • ${projectAddress}` : ''}
          {` • Per NEC Article 250`}
        </Text>
      </View>

      {/* Service Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Service Information</Text>
        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Service Amperage</Text>
            <Text style={styles.value}>{serviceAmperage}A</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.label}>Conductor Material</Text>
            <Text style={styles.value}>
              {conductorMaterial === 'Cu' ? 'Copper' : 'Aluminum'}
            </Text>
          </View>
        </View>
      </View>

      {/* GEC Project-Specific Summary Card — wrap={false} so react-pdf
          does NOT split this card across pages (Sprint 2A pattern). */}
      <View style={styles.gecCard} wrap={false}>
        <Text style={styles.gecCardHeader}>
          Grounding Electrode Conductor (NEC 250.66) — Project Detail
        </Text>
        <View style={styles.gecCardRow}>
          <Text style={styles.gecCardLabel}>Service ampacity</Text>
          <Text style={styles.gecCardValue}>{serviceAmperage}A</Text>
        </View>
        <View style={styles.gecCardRow}>
          <Text style={styles.gecCardLabel}>
            Service conductor{detail.serviceConductorAssumed ? ' (assumed)' : ''}
          </Text>
          <Text style={styles.gecCardValue}>
            {detail.serviceConductorSize} {conductorMaterial}
          </Text>
        </View>
        <View style={styles.gecCardRow}>
          <Text style={styles.gecCardLabel}>Required GEC (NEC Table 250.66)</Text>
          <Text style={styles.gecCardValue}>
            {detail.tableMinimumGecSize} {conductorMaterial}
          </Text>
        </View>
        {detail.gecSize !== detail.tableMinimumGecSize && (
          <View style={styles.gecCardRow}>
            <Text style={styles.gecCardLabel}>Installed GEC (override)</Text>
            <Text style={styles.gecCardValue}>
              {detail.gecSize} {conductorMaterial}
            </Text>
          </View>
        )}
        <Text style={styles.gecCardNote}>
          GEC sized per NEC Table 250.66 based on the largest ungrounded service
          conductor (or equivalent area for parallel sets). Installation per
          NEC 250.64 — continuous, no splices except per 250.64(C); protected
          from physical damage per 250.64(B).
        </Text>
      </View>

      {/* Grounding Electrode System — present electrodes (per NEC 250.50 / 250.52) */}
      <View style={styles.section} wrap={false}>
        <Text style={styles.sectionTitle}>
          Grounding Electrode System (NEC 250.50 / 250.52)
        </Text>
        <Text style={{ fontSize: 9, marginBottom: 8 }}>
          Electrodes present at the building (all present electrodes shall be
          bonded together to form the grounding electrode system):
        </Text>
        {presentElectrodes.map(e => (
          <View key={e.key} style={styles.checklistItem}>
            <Text style={e.present ? styles.checkboxChecked : styles.checkboxUnchecked}>
              {e.present ? '[X]' : '[ ]'}
            </Text>
            <Text style={styles.itemText}>
              {e.label} — {e.necReference}
            </Text>
          </View>
        ))}
      </View>

      {/* Bonding Requirements — NEC 250.92 / 250.94 / 250.104 */}
      <View style={styles.section} wrap={false}>
        <Text style={styles.sectionTitle}>
          Bonding Requirements (NEC 250.92 / 250.94 / 250.104)
        </Text>
        {bondingRequirements.map(b => (
          <View key={b.key} style={styles.checklistItem}>
            <Text style={b.required ? styles.checkboxChecked : styles.checkboxUnchecked}>
              {b.required ? '[X]' : '[ ]'}
            </Text>
            <Text style={styles.itemText}>
              {b.label} — {b.necReference}
            </Text>
          </View>
        ))}
      </View>

      {/* Installation Requirements Checklist (field-verify items) */}
      <View style={styles.section} wrap={false}>
        <Text style={styles.sectionTitle}>Installation Requirements (field-verify)</Text>
        <View style={styles.checklistItem}>
          <Text style={styles.checkboxUnchecked}>[ ]</Text>
          <Text style={styles.itemText}>
            All grounding electrodes bonded together per NEC 250.50
          </Text>
        </View>
        <View style={styles.checklistItem}>
          <Text style={styles.checkboxUnchecked}>[ ]</Text>
          <Text style={styles.itemText}>
            GEC installed continuous from service to electrodes (no splices
            except per NEC 250.64(C))
          </Text>
        </View>
        <View style={styles.checklistItem}>
          <Text style={styles.checkboxUnchecked}>[ ]</Text>
          <Text style={styles.itemText}>
            GEC protected from physical damage per NEC 250.64(B)
          </Text>
        </View>
        <View style={styles.checklistItem}>
          <Text style={styles.checkboxUnchecked}>[ ]</Text>
          <Text style={styles.itemText}>
            Metal water pipe (where used as electrode) supplemented with
            additional electrode per NEC 250.53(D)(2)
          </Text>
        </View>
        <View style={styles.checklistItem}>
          <Text style={styles.checkboxUnchecked}>[ ]</Text>
          <Text style={styles.itemText}>
            Ground rods driven full depth (8 ft minimum) or 45° angle if rock
            per NEC 250.53(G)
          </Text>
        </View>
        <View style={styles.checklistItem}>
          <Text style={styles.checkboxUnchecked}>[ ]</Text>
          <Text style={styles.itemText}>
            Bonding jumper installed around water meter / dielectric joints
            per NEC 250.68(B)
          </Text>
        </View>
        <View style={styles.checklistItem}>
          <Text style={styles.checkboxUnchecked}>[ ]</Text>
          <Text style={styles.itemText}>
            Grounding electrode system accessible for inspection and testing
          </Text>
        </View>
      </View>

      {/* Compliance status + Warnings */}
      {isCompliant ? (
        <View style={styles.compliantBox} wrap={false}>
          <Text
            style={{
              fontSize: 10,
              fontFamily: 'Helvetica-Bold',
              color: '#065f46',
              marginBottom: 5,
            }}
          >
            NEC ARTICLE 250 — DESIGN COMPLIANT
          </Text>
          <Text style={{ fontSize: 9, color: '#065f46' }}>
            Grounding electrode system designed to NEC requirements for{' '}
            {serviceAmperage}A service. Required GEC: {detail.gecSize}{' '}
            {conductorMaterial}.
          </Text>
        </View>
      ) : (
        <View style={styles.nonCompliantBox} wrap={false}>
          <Text
            style={{
              fontSize: 10,
              fontFamily: 'Helvetica-Bold',
              color: '#991b1b',
              marginBottom: 5,
            }}
          >
            INCOMPLETE GROUNDING SYSTEM
          </Text>
          <Text style={{ fontSize: 9, color: '#991b1b' }}>
            Additional information required to verify NEC Article 250 compliance.
          </Text>
        </View>
      )}

      {detail.warnings.length > 0 && (
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Design Warnings</Text>
          {detail.warnings.map((w, i) => (
            <Text key={i} style={styles.warningRow}>
              • {w}
            </Text>
          ))}
        </View>
      )}

      {/* NEC References */}
      <View style={styles.necReference} wrap={false}>
        <Text
          style={{
            fontSize: 10,
            fontFamily: 'Helvetica-Bold',
            color: '#1e40af',
            marginBottom: 5,
          }}
        >
          Key NEC References:
        </Text>
        <Text style={styles.necText}>
          • NEC 250.50 — Grounding electrode system (all present electrodes bonded)
        </Text>
        <Text style={styles.necText}>
          • NEC 250.52 — Grounding electrode types and specifications
        </Text>
        <Text style={styles.necText}>
          • NEC 250.53 — Installation requirements for grounding electrodes
        </Text>
        <Text style={styles.necText}>
          • NEC 250.64 — GEC installation, protection, and termination
        </Text>
        <Text style={styles.necText}>
          • NEC 250.66 — Size of grounding electrode conductor (GEC)
        </Text>
        <Text style={styles.necText}>
          • NEC 250.92 / 250.94 — Service bonding + intersystem bonding terminal
        </Text>
        <Text style={styles.necText}>
          • NEC 250.104 — Bonding of metal piping and structural steel
        </Text>
        <Text style={styles.necText}>
          • NEC 250.122 — Size of equipment grounding conductor (EGC)
        </Text>
      </View>

      <BrandFooter
        projectName={projectName}
        contractorName={contractorName}
        contractorLicense={contractorLicense}
        sheetId={sheetId}
      />
    </Page>
  );
};

export const GroundingPlanDocument: React.FC<GroundingPlanDocumentProps> = (props) => (
  <Document>
    <GroundingPlanPages {...props} />
  </Document>
);
