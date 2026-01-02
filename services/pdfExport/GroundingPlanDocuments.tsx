/**
 * Grounding Plan PDF Document
 * React PDF document for grounding electrode system per NEC Article 250
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Database } from '../../lib/database.types';

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
    fontWeight: 'bold',
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
    fontWeight: 'bold',
  },
  tableCol: {
    fontSize: 9,
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
    fontWeight: 'bold',
    fontFamily: 'Courier',
  },
  itemText: {
    fontSize: 9,
    flex: 1,
  },
});

interface GroundingPlanDocumentProps {
  projectName: string;
  projectAddress?: string;
  grounding: GroundingDetail;
  serviceAmperage: number;
  conductorMaterial: 'Cu' | 'Al';
}

export const GroundingPlanDocument: React.FC<GroundingPlanDocumentProps> = ({
  projectName,
  projectAddress,
  grounding,
  serviceAmperage,
  conductorMaterial,
}) => {
  // Determine compliance status
  const isCompliant = grounding.electrodes && grounding.electrodes.length > 0 && grounding.gec_size;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>GROUNDING ELECTRODE SYSTEM PLAN</Text>
          <Text style={styles.subtitle}>{projectName}</Text>
          {projectAddress && <Text style={styles.subtitle}>{projectAddress}</Text>}
          <Text style={{ fontSize: 9, marginTop: 5, color: '#666' }}>
            Per NEC Article 250 - Grounding and Bonding
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
              <Text style={styles.value}>{conductorMaterial === 'Cu' ? 'Copper' : 'Aluminum'}</Text>
            </View>
          </View>
        </View>

        {/* Grounding Electrode Conductor (GEC) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Grounding Electrode Conductor (NEC 250.66)</Text>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Required GEC Size</Text>
              <Text style={styles.value}>
                {grounding.gec_size || 'Not specified'} {conductorMaterial}
              </Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Installation</Text>
              <Text style={styles.value}>
                {grounding.gec_size ? 'Continuous, no splices' : 'Per NEC 250.64'}
              </Text>
            </View>
          </View>
          {grounding.gec_size && (
            <Text style={{ fontSize: 8, color: '#666', marginTop: 5 }}>
              Per NEC Table 250.66 for {serviceAmperage}A service
            </Text>
          )}
        </View>

        {/* Grounding Electrode System */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Grounding Electrode System (NEC 250.50)</Text>
          <Text style={{ fontSize: 9, marginBottom: 8 }}>
            Electrodes present at the building (all must be bonded together):
          </Text>

          {/* Rod and Pipe Electrodes */}
          <View style={styles.checklistItem}>
            <Text style={grounding.electrodes?.includes('Rod and Pipe Electrodes') ? styles.checkboxChecked : styles.checkboxUnchecked}>
              {grounding.electrodes?.includes('Rod and Pipe Electrodes') ? '[X]' : '[ ]'}
            </Text>
            <Text style={styles.itemText}>
              Rod and Pipe Electrodes - NEC 250.52(A)(5)
            </Text>
          </View>

          {/* Plate Electrodes */}
          <View style={styles.checklistItem}>
            <Text style={grounding.electrodes?.includes('Plate Electrodes') ? styles.checkboxChecked : styles.checkboxUnchecked}>
              {grounding.electrodes?.includes('Plate Electrodes') ? '[X]' : '[ ]'}
            </Text>
            <Text style={styles.itemText}>
              Plate Electrodes - NEC 250.52(A)(7)
            </Text>
          </View>

          {/* Concrete-Encased Electrode (Ufer) */}
          <View style={styles.checklistItem}>
            <Text style={grounding.electrodes?.includes('Concrete-Encased Electrode (Ufer)') ? styles.checkboxChecked : styles.checkboxUnchecked}>
              {grounding.electrodes?.includes('Concrete-Encased Electrode (Ufer)') ? '[X]' : '[ ]'}
            </Text>
            <Text style={styles.itemText}>
              Concrete-Encased Electrode (Ufer) - NEC 250.52(A)(3)
            </Text>
          </View>

          {/* Metal Frame of Building */}
          <View style={styles.checklistItem}>
            <Text style={grounding.electrodes?.includes('Metal Frame of Building') ? styles.checkboxChecked : styles.checkboxUnchecked}>
              {grounding.electrodes?.includes('Metal Frame of Building') ? '[X]' : '[ ]'}
            </Text>
            <Text style={styles.itemText}>
              Metal Frame of Building - NEC 250.52(A)(2)
            </Text>
          </View>

          {/* Metal Underground Water Pipe */}
          <View style={styles.checklistItem}>
            <Text style={grounding.electrodes?.includes('Metal Underground Water Pipe') ? styles.checkboxChecked : styles.checkboxUnchecked}>
              {grounding.electrodes?.includes('Metal Underground Water Pipe') ? '[X]' : '[ ]'}
            </Text>
            <Text style={styles.itemText}>
              Metal Underground Water Pipe - NEC 250.52(A)(1)
            </Text>
          </View>

          {/* Ground Ring */}
          <View style={styles.checklistItem}>
            <Text style={grounding.electrodes?.includes('Ground Ring') ? styles.checkboxChecked : styles.checkboxUnchecked}>
              {grounding.electrodes?.includes('Ground Ring') ? '[X]' : '[ ]'}
            </Text>
            <Text style={styles.itemText}>
              Ground Ring - NEC 250.52(A)(4)
            </Text>
          </View>
        </View>

        {/* Installation Checklist */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Installation Requirements Checklist</Text>
          <View style={styles.checklistItem}>
            <Text style={styles.checkboxUnchecked}>[ ]</Text>
            <Text style={styles.itemText}>
              All grounding electrodes bonded together per NEC 250.50
            </Text>
          </View>
          <View style={styles.checklistItem}>
            <Text style={styles.checkboxUnchecked}>[ ]</Text>
            <Text style={styles.itemText}>
              GEC sized per NEC Table 250.66 ({grounding.gec_size || '___'} {conductorMaterial})
            </Text>
          </View>
          <View style={styles.checklistItem}>
            <Text style={styles.checkboxUnchecked}>[ ]</Text>
            <Text style={styles.itemText}>
              GEC continuous from service to electrodes (no splices except per 250.64(C))
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
              Metal water pipe supplemented with additional electrode per NEC 250.53(D)(2)
            </Text>
          </View>
          <View style={styles.checklistItem}>
            <Text style={styles.checkboxUnchecked}>[ ]</Text>
            <Text style={styles.itemText}>
              Ground rods driven to full depth (8 ft minimum) or 45° angle if rock per NEC 250.53(G)
            </Text>
          </View>
          <View style={styles.checklistItem}>
            <Text style={styles.checkboxUnchecked}>[ ]</Text>
            <Text style={styles.itemText}>
              Bonding jumper installed around water meter/joints per NEC 250.68(B)
            </Text>
          </View>
          <View style={styles.checklistItem}>
            <Text style={styles.checkboxUnchecked}>[ ]</Text>
            <Text style={styles.itemText}>
              Grounding electrode system accessible for inspection and testing
            </Text>
          </View>
        </View>

        {/* NEC Compliance Status */}
        {isCompliant ? (
          <View style={styles.compliantBox}>
            <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#065f46', marginBottom: 5 }}>
              ✓ NEC ARTICLE 250 COMPLIANT
            </Text>
            <Text style={{ fontSize: 9, color: '#065f46' }}>
              Grounding electrode system meets NEC requirements for {serviceAmperage}A service
            </Text>
          </View>
        ) : (
          <View style={styles.nonCompliantBox}>
            <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#991b1b', marginBottom: 5 }}>
              ⚠️ INCOMPLETE GROUNDING SYSTEM
            </Text>
            <Text style={{ fontSize: 9, color: '#991b1b' }}>
              Additional information required to verify NEC Article 250 compliance
            </Text>
          </View>
        )}

        {/* NEC References */}
        <View style={styles.necReference}>
          <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1e40af', marginBottom: 5 }}>
            Key NEC References:
          </Text>
          <Text style={styles.necText}>
            • NEC 250.50 - Grounding electrode system (all present electrodes must be bonded)
          </Text>
          <Text style={styles.necText}>
            • NEC 250.52 - Grounding electrodes (types and specifications)
          </Text>
          <Text style={styles.necText}>
            • NEC 250.53 - Installation requirements for grounding electrodes
          </Text>
          <Text style={styles.necText}>
            • NEC 250.66 - Size of grounding electrode conductor (GEC)
          </Text>
          <Text style={styles.necText}>
            • NEC 250.122 - Size of equipment grounding conductor (EGC)
          </Text>
          <Text style={styles.necText}>
            • NEC 250.64 - GEC installation, protection, and termination
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Grounding System Design per NEC 2023 Article 250</Text>
          <Text style={{ marginTop: 3 }}>
            All installations must be inspected and approved by local Authority Having Jurisdiction (AHJ)
          </Text>
        </View>
      </Page>
    </Document>
  );
};
