/**
 * Jurisdiction Requirements PDF Document
 *
 * React-PDF document component for jurisdiction permit requirements checklist
 * Included in permit packet when project has jurisdiction_id set
 *
 * @remarks
 * Follows existing PDF export patterns (PanelScheduleDocuments, ShortCircuitDocuments)
 * - React-PDF components (Document, Page, View, Text)
 * - StyleSheet for consistent formatting
 * - Portrait orientation on LETTER size
 * - Professional layout with checklists
 *
 * @example
 * ```tsx
 * <JurisdictionRequirementsDocument
 *   jurisdiction={jurisdiction}
 *   projectName="Commercial Office Building"
 * />
 * ```
 */

import React from 'react';
import { Page, Text, View, StyleSheet, Document } from '@react-pdf/renderer';
import type { Jurisdiction } from '../../types';
import { DOCUMENT_LABELS, CALCULATION_LABELS } from '../../types';

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: 'Helvetica',
  },
  header: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 20,
    borderBottom: '2pt solid black',
    paddingBottom: 8,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1e40af',  // Blue-700
  },
  jurisdictionInfo: {
    backgroundColor: '#eff6ff',  // Blue-50
    padding: 12,
    borderRadius: 4,
    marginBottom: 15,
  },
  infoText: {
    fontSize: 8,
    color: '#374151',  // Gray-700
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    paddingLeft: 10,
  },
  checkbox: {
    width: 10,
    height: 10,
    border: '1pt solid #22c55e',  // Green-500
    marginRight: 8,
    marginTop: 2,
  },
  itemText: {
    fontSize: 9,
    flex: 1,
  },
  notes: {
    backgroundColor: '#fef3c7',  // Yellow-100
    padding: 10,
    borderRadius: 4,
    marginTop: 10,
    fontSize: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 7,
    color: '#6b7280',  // Gray-500
    textAlign: 'center',
  },
});

// ============================================================================
// COMPONENT
// ============================================================================

interface JurisdictionRequirementsDocumentProps {
  jurisdiction: Jurisdiction;
  projectName: string;
}

export const JurisdictionRequirementsDocument: React.FC<JurisdictionRequirementsDocumentProps> = ({
  jurisdiction,
  projectName,
}) => {
  return (
    <Document>
      <Page size="LETTER" orientation="portrait" style={styles.page}>

        {/* Header */}
        <Text style={styles.header}>
          JURISDICTION REQUIREMENTS CHECKLIST
        </Text>

        {/* Project Info */}
        <Text style={{ fontSize: 10, marginBottom: 15 }}>
          Project: {projectName}
        </Text>

        {/* Jurisdiction Info Box */}
        <View style={styles.jurisdictionInfo}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 4 }}>
            {jurisdiction.jurisdiction_name}
          </Text>
          {jurisdiction.ahj_name && (
            <Text style={styles.infoText}>
              Authority: {jurisdiction.ahj_name}
            </Text>
          )}
          <Text style={{ ...styles.infoText, marginTop: 4 }}>
            NEC {jurisdiction.nec_edition} Adopted
            {jurisdiction.estimated_review_days &&
              ` • Typical Review: ${jurisdiction.estimated_review_days} days`}
          </Text>
        </View>

        {/* Required Documents Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Required Documents ({jurisdiction.required_documents.length})
          </Text>
          {jurisdiction.required_documents.map((doc, index) => (
            <View key={index} style={styles.checklistItem}>
              <View style={styles.checkbox} />
              <Text style={styles.itemText}>
                {DOCUMENT_LABELS[doc as keyof typeof DOCUMENT_LABELS] || doc}
              </Text>
            </View>
          ))}
        </View>

        {/* Required Calculations Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Required Calculations ({jurisdiction.required_calculations.length})
          </Text>
          {jurisdiction.required_calculations.map((calc, index) => (
            <View key={index} style={styles.checklistItem}>
              <View style={styles.checkbox} />
              <Text style={styles.itemText}>
                {CALCULATION_LABELS[calc as keyof typeof CALCULATION_LABELS] || calc}
              </Text>
            </View>
          ))}
        </View>

        {/* Special Notes Section */}
        {jurisdiction.notes && (
          <View style={styles.notes}>
            <Text style={{ fontSize: 8, fontWeight: 'bold', marginBottom: 4 }}>
              Special Requirements:
            </Text>
            <Text style={{ fontSize: 8 }}>
              {jurisdiction.notes}
            </Text>
          </View>
        )}

        {/* Data Source Section */}
        {(jurisdiction.data_source || jurisdiction.source_url) && (
          <View style={{ marginTop: 15, padding: 10, backgroundColor: '#f9fafb', borderRadius: 4 }}>
            <Text style={{ fontSize: 8, fontWeight: 'bold', marginBottom: 4, color: '#374151' }}>
              Data Source:
            </Text>
            {jurisdiction.data_source && (
              <Text style={{ fontSize: 8, color: '#4b5563', marginBottom: 2 }}>
                {jurisdiction.data_source}
              </Text>
            )}
            {jurisdiction.source_url && (
              <Text style={{ fontSize: 8, color: '#1e40af', marginBottom: 2 }}>
                {jurisdiction.source_url}
              </Text>
            )}
            {jurisdiction.last_verified_date && (
              <Text style={{ fontSize: 7, color: '#6b7280', marginTop: 2 }}>
                Last verified: {new Date(jurisdiction.last_verified_date).toLocaleDateString()}
              </Text>
            )}
          </View>
        )}

        {/* Footer Disclaimer */}
        <View style={styles.footer}>
          <Text>
            This checklist is for reference only. Verify requirements with{' '}
            {jurisdiction.ahj_name || 'your local Authority Having Jurisdiction (AHJ)'}{' '}
            before submittal.
          </Text>
        </View>
      </Page>
    </Document>
  );
};
