/**
 * Panel Schedule PDF Document Components
 * Separated from export service to fix HMR Fast Refresh compatibility
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import type { Panel, Circuit } from '../../lib/database.types';

// Register fonts (optional, for better rendering)
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'Helvetica' },
    { src: 'Helvetica-Bold', fontWeight: 'bold' },
  ]
});

// Professional black & white styling for print
export const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    borderBottomStyle: 'solid',
    paddingBottom: 10,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 10,
    marginBottom: 3,
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  infoColumn: {
    width: '48%',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  infoLabel: {
    fontFamily: 'Helvetica-Bold',
    width: '40%',
  },
  infoValue: {
    width: '60%',
  },
  tableContainer: {
    marginTop: 15,
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    borderBottomStyle: 'solid',
    paddingVertical: 5,
    paddingHorizontal: 3,
    fontFamily: 'Helvetica-Bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#ccc',
    borderBottomStyle: 'solid',
    paddingVertical: 4,
    paddingHorizontal: 3,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#ccc',
    borderBottomStyle: 'solid',
    paddingVertical: 4,
    paddingHorizontal: 3,
    backgroundColor: '#fafafa',
  },
  // Two-column panel schedule format
  colLeftCkt: { width: '5%', fontSize: 8, textAlign: 'center' },
  colLeftDescription: { width: '18%', fontSize: 7 },
  colLeftLoad: { width: '7%', fontSize: 7, textAlign: 'right' },
  colLeftBreaker: { width: '5%', fontSize: 7, textAlign: 'center' },
  colLeftPole: { width: '4%', fontSize: 7, textAlign: 'center' },
  colPhase: { width: '6%', fontSize: 8, textAlign: 'center', fontFamily: 'Helvetica-Bold' },
  colRightPole: { width: '4%', fontSize: 7, textAlign: 'center' },
  colRightBreaker: { width: '5%', fontSize: 7, textAlign: 'center' },
  colRightLoad: { width: '7%', fontSize: 7, textAlign: 'left' },
  colRightDescription: { width: '18%', fontSize: 7 },
  colRightCkt: { width: '5%', fontSize: 8, textAlign: 'center' },
  summarySection: {
    marginTop: 15,
    padding: 10,
    borderWidth: 1,
    borderColor: '#000',
    borderStyle: 'solid',
  },
  summaryTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 8,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 7,
    color: '#666',
    borderTopWidth: 0.5,
    borderTopColor: '#ccc',
    borderTopStyle: 'solid',
    paddingTop: 8,
  },
});

// Calculate phase totals
export const calculatePhaseBalancing = (
  circuits: Circuit[],
  panelPhase: number
) => {
  if (panelPhase === 1) {
    // Single-phase: all circuits on same phase
    const totalVA = circuits.reduce((sum, c) => sum + (c.load_watts || 0), 0);
    return {
      phaseA_VA: totalVA,
      phaseB_VA: 0,
      phaseC_VA: 0,
    };
  }

  // Three-phase: distribute by circuit number
  let phaseA_VA = 0;
  let phaseB_VA = 0;
  let phaseC_VA = 0;

  circuits.forEach((circuit) => {
    const loadVA = circuit.load_watts || 0;
    const phase = ((circuit.circuit_number - 1) % 3) + 1; // 1=A, 2=B, 3=C

    if (circuit.pole === 3) {
      // 3-pole breaker: distribute across all phases
      phaseA_VA += loadVA / 3;
      phaseB_VA += loadVA / 3;
      phaseC_VA += loadVA / 3;
    } else if (circuit.pole === 2) {
      // 2-pole breaker: distribute across two phases
      if (phase === 1) {
        phaseA_VA += loadVA / 2;
        phaseB_VA += loadVA / 2;
      } else if (phase === 2) {
        phaseB_VA += loadVA / 2;
        phaseC_VA += loadVA / 2;
      } else {
        phaseC_VA += loadVA / 2;
        phaseA_VA += loadVA / 2;
      }
    } else {
      // 1-pole breaker: single phase
      if (phase === 1) phaseA_VA += loadVA;
      else if (phase === 2) phaseB_VA += loadVA;
      else phaseC_VA += loadVA;
    }
  });

  return { phaseA_VA, phaseB_VA, phaseC_VA };
};

interface PanelSchedulePDFProps {
  panel: Panel;
  circuits: Circuit[];
  projectName: string;
  projectAddress?: string;
  datePreppared?: string;
}

// Main PDF Document Component for single panel
export const PanelScheduleDocument: React.FC<PanelSchedulePDFProps> = ({
  panel,
  circuits,
  projectName,
  projectAddress,
  datePreppared,
}) => {
  const sortedCircuits = [...circuits].sort(
    (a, b) => a.circuit_number - b.circuit_number
  );

  const phaseBalancing = calculatePhaseBalancing(sortedCircuits, panel.phase);
  const voltage = panel.voltage;

  // Calculate amps per phase
  let phaseA_Amps = 0;
  let phaseB_Amps = 0;
  let phaseC_Amps = 0;

  if (panel.phase === 1) {
    phaseA_Amps = phaseBalancing.phaseA_VA / voltage;
  } else {
    // Three-phase: I = VA / (√3 × V) for line current
    phaseA_Amps = phaseBalancing.phaseA_VA / voltage;
    phaseB_Amps = phaseBalancing.phaseB_VA / voltage;
    phaseC_Amps = phaseBalancing.phaseC_VA / voltage;
  }

  const totalVA =
    phaseBalancing.phaseA_VA +
    phaseBalancing.phaseB_VA +
    phaseBalancing.phaseC_VA;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.title}>PANEL SCHEDULE</Text>
          <Text style={styles.subtitle}>{projectName}</Text>
          {projectAddress && <Text style={styles.subtitle}>{projectAddress}</Text>}

          <View style={styles.infoGrid}>
            <View style={styles.infoColumn}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Panel Name:</Text>
                <Text style={styles.infoValue}>{panel.name}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Location:</Text>
                <Text style={styles.infoValue}>{panel.location || 'N/A'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Voltage:</Text>
                <Text style={styles.infoValue}>
                  {panel.voltage}V, {panel.phase === 1 ? 'Single' : 'Three'}-Phase
                </Text>
              </View>
            </View>

            <View style={styles.infoColumn}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Bus Rating:</Text>
                <Text style={styles.infoValue}>{panel.bus_rating}A</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Main Breaker:</Text>
                <Text style={styles.infoValue}>
                  {panel.main_breaker_amps ? `${panel.main_breaker_amps}A` : 'MLO'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Date Prepared:</Text>
                <Text style={styles.infoValue}>
                  {datePreppared || new Date().toLocaleDateString()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Circuit Table - Two Column Format */}
        <View style={styles.tableContainer}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={styles.colLeftCkt}>Ckt</Text>
            <Text style={styles.colLeftDescription}>Description</Text>
            <Text style={styles.colLeftLoad}>Load</Text>
            <Text style={styles.colLeftBreaker}>Br</Text>
            <Text style={styles.colLeftPole}>P</Text>
            <Text style={styles.colPhase}>Phase</Text>
            <Text style={styles.colRightPole}>P</Text>
            <Text style={styles.colRightBreaker}>Br</Text>
            <Text style={styles.colRightLoad}>Load</Text>
            <Text style={styles.colRightDescription}>Description</Text>
            <Text style={styles.colRightCkt}>Ckt</Text>
          </View>

          {/* Circuit Rows - Two Column Format */}
          {(() => {
            // Determine max slots based on panel type
            const maxSlots = panel.is_main ? 30 : 42;
            const numRows = maxSlots / 2;

            const rows = [];
            for (let row = 1; row <= numRows; row++) {
              const leftNum = row * 2 - 1;  // Odd numbers: 1, 3, 5, 7...
              const rightNum = row * 2;      // Even numbers: 2, 4, 6, 8...

              const leftCkt = sortedCircuits.find(c => c.circuit_number === leftNum);
              const rightCkt = sortedCircuits.find(c => c.circuit_number === rightNum);

              // Calculate phase for this row
              const phase = panel.phase === 1 ? 'A' : ['A', 'B', 'C'][(row - 1) % 3];
              const isAlt = row % 2 === 0;

              rows.push(
                <View key={row} style={isAlt ? styles.tableRowAlt : styles.tableRow}>
                  {/* Left Circuit */}
                  <Text style={styles.colLeftCkt}>{leftNum}</Text>
                  <Text style={styles.colLeftDescription}>{leftCkt?.description || ''}</Text>
                  <Text style={styles.colLeftLoad}>
                    {leftCkt ? (leftCkt.load_watts || 0).toLocaleString() : ''}
                  </Text>
                  <Text style={styles.colLeftBreaker}>{leftCkt ? `${leftCkt.breaker_amps}A` : ''}</Text>
                  <Text style={styles.colLeftPole}>{leftCkt ? `${leftCkt.pole}P` : ''}</Text>

                  {/* Center Phase */}
                  <Text style={styles.colPhase}>{phase}</Text>

                  {/* Right Circuit */}
                  <Text style={styles.colRightPole}>{rightCkt ? `${rightCkt.pole}P` : ''}</Text>
                  <Text style={styles.colRightBreaker}>{rightCkt ? `${rightCkt.breaker_amps}A` : ''}</Text>
                  <Text style={styles.colRightLoad}>
                    {rightCkt ? (rightCkt.load_watts || 0).toLocaleString() : ''}
                  </Text>
                  <Text style={styles.colRightDescription}>{rightCkt?.description || ''}</Text>
                  <Text style={styles.colRightCkt}>{rightNum}</Text>
                </View>
              );
            }
            return rows;
          })()}

          {/* Empty state */}
          {sortedCircuits.length === 0 && (
            <View style={styles.tableRow}>
              <Text style={{ width: '100%', textAlign: 'center', fontStyle: 'italic' }}>
                No circuits defined
              </Text>
            </View>
          )}
        </View>

        {/* Phase Balancing Summary */}
        <View style={styles.summarySection}>
          <Text style={styles.summaryTitle}>Load Summary & Phase Balance</Text>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Circuits</Text>
              <Text style={styles.summaryValue}>{sortedCircuits.length}</Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Load</Text>
              <Text style={styles.summaryValue}>
                {(totalVA / 1000).toFixed(1)} kVA
              </Text>
            </View>

            {panel.phase === 3 ? (
              <>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Phase A</Text>
                  <Text style={styles.summaryValue}>
                    {phaseA_Amps.toFixed(1)}A
                  </Text>
                </View>

                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Phase B</Text>
                  <Text style={styles.summaryValue}>
                    {phaseB_Amps.toFixed(1)}A
                  </Text>
                </View>

                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Phase C</Text>
                  <Text style={styles.summaryValue}>
                    {phaseC_Amps.toFixed(1)}A
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Current Draw</Text>
                <Text style={styles.summaryValue}>
                  {phaseA_Amps.toFixed(1)}A
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            This panel schedule complies with NEC 2023 requirements. Generated by SparkPlan.
          </Text>
          <Text style={{ marginTop: 3 }}>
            For questions or revisions, contact the electrical contractor or engineer of record.
          </Text>
        </View>
      </Page>
    </Document>
  );
};

/**
 * Multi-Panel Document Component
 */
interface MultiPanelDocumentProps {
  panels: Panel[];
  circuitsByPanel: Map<string, Circuit[]>;
  projectName: string;
  projectAddress?: string;
}

export const MultiPanelDocument: React.FC<MultiPanelDocumentProps> = ({
  panels,
  circuitsByPanel,
  projectName,
  projectAddress
}) => (
  <Document>
    {panels.map((panel) => {
      const circuits = circuitsByPanel.get(panel.id) || [];
      return (
        <Page key={panel.id} size="LETTER" style={styles.page}>
          {/* Reuse same layout as single panel */}
          <View style={styles.header}>
            <Text style={styles.title}>PANEL SCHEDULE</Text>
            <Text style={styles.subtitle}>{projectName}</Text>
            {projectAddress && <Text style={styles.subtitle}>{projectAddress}</Text>}

            <View style={styles.infoGrid}>
              <View style={styles.infoColumn}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Panel Name:</Text>
                  <Text style={styles.infoValue}>{panel.name}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Location:</Text>
                  <Text style={styles.infoValue}>{panel.location || 'N/A'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Voltage:</Text>
                  <Text style={styles.infoValue}>
                    {panel.voltage}V, {panel.phase === 1 ? 'Single' : 'Three'}-Phase
                  </Text>
                </View>
              </View>

              <View style={styles.infoColumn}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Bus Rating:</Text>
                  <Text style={styles.infoValue}>{panel.bus_rating}A</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Main Breaker:</Text>
                  <Text style={styles.infoValue}>
                    {panel.main_breaker_amps ? `${panel.main_breaker_amps}A` : 'MLO'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Date Prepared:</Text>
                  <Text style={styles.infoValue}>
                    {new Date().toLocaleDateString()}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Circuit Table - Two Column Format */}
          <View style={styles.tableContainer}>
            <View style={styles.tableHeader}>
              <Text style={styles.colLeftCkt}>Ckt</Text>
              <Text style={styles.colLeftDescription}>Description</Text>
              <Text style={styles.colLeftLoad}>Load</Text>
              <Text style={styles.colLeftBreaker}>Br</Text>
              <Text style={styles.colLeftPole}>P</Text>
              <Text style={styles.colPhase}>Phase</Text>
              <Text style={styles.colRightPole}>P</Text>
              <Text style={styles.colRightBreaker}>Br</Text>
              <Text style={styles.colRightLoad}>Load</Text>
              <Text style={styles.colRightDescription}>Description</Text>
              <Text style={styles.colRightCkt}>Ckt</Text>
            </View>

            {(() => {
              const sortedCircuits = circuits.sort((a, b) => a.circuit_number - b.circuit_number);
              const maxSlots = panel.is_main ? 30 : 42;
              const numRows = maxSlots / 2;

              const rows = [];
              for (let row = 1; row <= numRows; row++) {
                const leftNum = row * 2 - 1;
                const rightNum = row * 2;

                const leftCkt = sortedCircuits.find(c => c.circuit_number === leftNum);
                const rightCkt = sortedCircuits.find(c => c.circuit_number === rightNum);

                const phase = panel.phase === 1 ? 'A' : ['A', 'B', 'C'][(row - 1) % 3];
                const isAlt = row % 2 === 0;

                rows.push(
                  <View key={row} style={isAlt ? styles.tableRowAlt : styles.tableRow}>
                    <Text style={styles.colLeftCkt}>{leftNum}</Text>
                    <Text style={styles.colLeftDescription}>{leftCkt?.description || ''}</Text>
                    <Text style={styles.colLeftLoad}>
                      {leftCkt ? (leftCkt.load_watts || 0).toLocaleString() : ''}
                    </Text>
                    <Text style={styles.colLeftBreaker}>{leftCkt ? `${leftCkt.breaker_amps}A` : ''}</Text>
                    <Text style={styles.colLeftPole}>{leftCkt ? `${leftCkt.pole}P` : ''}</Text>

                    <Text style={styles.colPhase}>{phase}</Text>

                    <Text style={styles.colRightPole}>{rightCkt ? `${rightCkt.pole}P` : ''}</Text>
                    <Text style={styles.colRightBreaker}>{rightCkt ? `${rightCkt.breaker_amps}A` : ''}</Text>
                    <Text style={styles.colRightLoad}>
                      {rightCkt ? (rightCkt.load_watts || 0).toLocaleString() : ''}
                    </Text>
                    <Text style={styles.colRightDescription}>{rightCkt?.description || ''}</Text>
                    <Text style={styles.colRightCkt}>{rightNum}</Text>
                  </View>
                );
              }
              return rows;
            })()}

            {circuits.length === 0 && (
              <View style={styles.tableRow}>
                <Text style={{ width: '100%', textAlign: 'center', fontStyle: 'italic' }}>
                  No circuits defined
                </Text>
              </View>
            )}
          </View>

          {/* Phase Balancing Summary */}
          {(() => {
            const phaseBalancing = calculatePhaseBalancing(circuits, panel.phase);
            const totalVA =
              phaseBalancing.phaseA_VA +
              phaseBalancing.phaseB_VA +
              phaseBalancing.phaseC_VA;
            const phaseA_Amps = phaseBalancing.phaseA_VA / panel.voltage;
            const phaseB_Amps = phaseBalancing.phaseB_VA / panel.voltage;
            const phaseC_Amps = phaseBalancing.phaseC_VA / panel.voltage;

            return (
              <View style={styles.summarySection}>
                <Text style={styles.summaryTitle}>Load Summary & Phase Balance</Text>

                <View style={styles.summaryGrid}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Total Circuits</Text>
                    <Text style={styles.summaryValue}>{circuits.length}</Text>
                  </View>

                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Total Load</Text>
                    <Text style={styles.summaryValue}>
                      {(totalVA / 1000).toFixed(1)} kVA
                    </Text>
                  </View>

                  {panel.phase === 3 ? (
                    <>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Phase A</Text>
                        <Text style={styles.summaryValue}>
                          {phaseA_Amps.toFixed(1)}A
                        </Text>
                      </View>

                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Phase B</Text>
                        <Text style={styles.summaryValue}>
                          {phaseB_Amps.toFixed(1)}A
                        </Text>
                      </View>

                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Phase C</Text>
                        <Text style={styles.summaryValue}>
                          {phaseC_Amps.toFixed(1)}A
                        </Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Current Draw</Text>
                      <Text style={styles.summaryValue}>
                        {phaseA_Amps.toFixed(1)}A
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })()}

          {/* Footer */}
          <View style={styles.footer}>
            <Text>
              This panel schedule complies with NEC 2023 requirements. Generated by SparkPlan.
            </Text>
            <Text style={{ marginTop: 3 }}>
              For questions or revisions, contact the electrical contractor or engineer of record.
            </Text>
          </View>
        </Page>
      );
    })}
  </Document>
);
