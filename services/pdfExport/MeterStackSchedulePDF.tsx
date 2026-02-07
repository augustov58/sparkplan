/**
 * Meter Stack Schedule PDF Document
 * CT cabinet specifications and meter schedule for multi-family permit packets.
 *
 * NEC References:
 * - NEC 408 - Switchboards, Panelboards, and Distribution Boards
 * - NEC 312 - Cabinets, Cutout Boxes, and Meter Socket Enclosures
 * - NEC 230 - Services
 */

import React from 'react';
import { Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import type { Database } from '../../lib/database.types';

type MeterStack = Database['public']['Tables']['meter_stacks']['Row'];
type Meter = Database['public']['Tables']['meters']['Row'];
type Panel = Database['public']['Tables']['panels']['Row'];

// Register fonts
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'Helvetica' },
    { src: 'Helvetica-Bold', fontWeight: 'bold' },
  ]
});

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
  specGrid: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  specLabel: {
    width: '40%',
    fontSize: 9,
    color: '#555',
  },
  specValue: {
    width: '60%',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    padding: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    padding: 5,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    padding: 5,
    backgroundColor: '#fafafa',
  },
  colPos: { width: '10%', fontSize: 9 },
  colName: { width: '30%', fontSize: 9 },
  colType: { width: '15%', fontSize: 9 },
  colPanel: { width: '25%', fontSize: 9 },
  colBreaker: { width: '20%', fontSize: 9 },
  headerText: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  necRef: {
    marginTop: 15,
    padding: 8,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  necRefText: {
    fontSize: 8,
    color: '#1e40af',
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#999',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 5,
  },
});

interface MeterStackScheduleProps {
  projectName: string;
  projectAddress?: string;
  meterStacks: MeterStack[];
  meters: Meter[];
  panels: Panel[];
}

function getMeterTypeLabel(type: string): string {
  switch (type) {
    case 'unit': return 'Dwelling Unit';
    case 'house': return 'House/Common';
    case 'ev': return 'EV Charging';
    case 'common': return 'Common Area';
    default: return type;
  }
}

export const MeterStackScheduleDocument: React.FC<MeterStackScheduleProps> = ({
  projectName,
  projectAddress,
  meterStacks,
  meters,
  panels,
}) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <>
      {meterStacks.map((meterStack) => {
        const stackMeters = meters
          .filter(m => m.meter_stack_id === meterStack.id)
          .sort((a, b) => (a.position_number || 0) - (b.position_number || 0));

        return (
          <Page key={meterStack.id} size="LETTER" style={styles.page}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Meter Stack Schedule</Text>
              <Text style={styles.subtitle}>{projectName}</Text>
              {projectAddress && <Text style={styles.subtitle}>{projectAddress}</Text>}
              <Text style={{ fontSize: 8, color: '#999', marginTop: 3 }}>
                Date: {currentDate}
              </Text>
            </View>

            {/* CT Cabinet Specifications */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>CT Cabinet Specifications</Text>

              <View style={styles.specGrid}>
                <Text style={styles.specLabel}>Name:</Text>
                <Text style={styles.specValue}>{meterStack.name}</Text>
              </View>
              <View style={styles.specGrid}>
                <Text style={styles.specLabel}>Location:</Text>
                <Text style={styles.specValue}>{meterStack.location || 'Not specified'}</Text>
              </View>
              <View style={styles.specGrid}>
                <Text style={styles.specLabel}>Bus Rating:</Text>
                <Text style={styles.specValue}>{meterStack.bus_rating_amps}A</Text>
              </View>
              <View style={styles.specGrid}>
                <Text style={styles.specLabel}>System Voltage:</Text>
                <Text style={styles.specValue}>{meterStack.voltage}V {meterStack.phase}-Phase</Text>
              </View>
              <View style={styles.specGrid}>
                <Text style={styles.specLabel}>Meter Positions:</Text>
                <Text style={styles.specValue}>
                  {stackMeters.length} used / {meterStack.num_meter_positions} total
                </Text>
              </View>
              {meterStack.ct_ratio && (
                <View style={styles.specGrid}>
                  <Text style={styles.specLabel}>CT Ratio:</Text>
                  <Text style={styles.specValue}>{meterStack.ct_ratio}</Text>
                </View>
              )}
              {meterStack.manufacturer && (
                <View style={styles.specGrid}>
                  <Text style={styles.specLabel}>Manufacturer:</Text>
                  <Text style={styles.specValue}>{meterStack.manufacturer}</Text>
                </View>
              )}
              {meterStack.model_number && (
                <View style={styles.specGrid}>
                  <Text style={styles.specLabel}>Model:</Text>
                  <Text style={styles.specValue}>{meterStack.model_number}</Text>
                </View>
              )}
            </View>

            {/* Meter Schedule Table */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Meter Schedule ({stackMeters.length} Meters)
              </Text>

              {/* Table Header */}
              <View style={styles.tableHeader}>
                <View style={styles.colPos}><Text style={styles.headerText}>Pos.</Text></View>
                <View style={styles.colName}><Text style={styles.headerText}>Meter Name</Text></View>
                <View style={styles.colType}><Text style={styles.headerText}>Type</Text></View>
                <View style={styles.colPanel}><Text style={styles.headerText}>Panel Served</Text></View>
                <View style={styles.colBreaker}><Text style={styles.headerText}>Breaker (A)</Text></View>
              </View>

              {/* Table Rows */}
              {stackMeters.map((meter, idx) => {
                const panel = meter.panel_id
                  ? panels.find(p => p.id === meter.panel_id)
                  : null;

                return (
                  <View key={meter.id} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                    <View style={styles.colPos}>
                      <Text style={{ fontSize: 9 }}>{meter.position_number || idx + 1}</Text>
                    </View>
                    <View style={styles.colName}>
                      <Text style={{ fontSize: 9 }}>{meter.name}</Text>
                    </View>
                    <View style={styles.colType}>
                      <Text style={{ fontSize: 9 }}>{getMeterTypeLabel(meter.meter_type)}</Text>
                    </View>
                    <View style={styles.colPanel}>
                      <Text style={{ fontSize: 9 }}>{panel?.name || '—'}</Text>
                    </View>
                    <View style={styles.colBreaker}>
                      <Text style={{ fontSize: 9 }}>
                        {meter.breaker_amps ? `${meter.breaker_amps}A` : '—'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* NEC References */}
            <View style={styles.necRef}>
              <Text style={styles.necRefText}>
                NEC Article 408 - Switchboards, Panelboards, and Distribution Boards{'\n'}
                NEC Article 312 - Cabinets, Cutout Boxes, and Meter Socket Enclosures{'\n'}
                NEC Article 230 - Services{'\n'}
                All meter positions shall be accessible per NEC 110.26.
              </Text>
            </View>

            {/* Footer */}
            <View style={styles.footer} fixed>
              <Text>{projectName} — Meter Stack Schedule</Text>
              <Text>Generated by NEC Pro Compliance</Text>
            </View>
          </Page>
        );
      })}
    </>
  );
};
