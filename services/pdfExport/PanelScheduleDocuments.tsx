/**
 * Panel Schedule PDF Document Components
 * Separated from export service to fix HMR Fast Refresh compatibility
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Panel, Circuit } from '../../lib/database.types';
import {
  BrandBar,
  Footer as BrandFooter,
  themeStyles,
} from './permitPacketTheme';
import { getCircuitPhase } from '../calculations/demandFactor';
import {
  calculateDwellingUnitDemandVA,
  isDwellingUnitPanel,
} from '../calculations/residentialLoad';
import {
  isEVEMSMarkerCircuit,
  findEVEMSSetpointMarker,
} from '../calculations/upstreamLoadAggregation';

// Helvetica + Helvetica-Bold are built-in PDF standard fonts in react-pdf —
// calling Font.register() on them corrupts the font cache and causes
// "Cannot read properties of null (reading 'props')" at render time.

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
  // PROPOSED — NEW INSTALLATION banner (Sprint 2C M3 follow-on, 2026-05-17).
  // Amber palette matches the in-app warning treatment and stands out
  // against the otherwise-neutral schedule cover so AHJ reviewers can't
  // miss it. Only renders when panel.is_proposed && showExistingNewMarkers.
  proposedBanner: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#d97706',
    borderStyle: 'solid',
    borderRadius: 3,
    padding: 6,
    marginBottom: 8,
  },
  proposedBannerText: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#78350f',
    letterSpacing: 0.5,
  },
  proposedBannerSub: {
    fontSize: 8,
    color: '#92400e',
    marginTop: 2,
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
  // Sprint 2A H1+H2+H3 follow-up: tightened to recover vertical space lost
  // to the C8 contractor block + sheet ID footer. 42-circuit panels were
  // pushing the Load Summary + Dwelling Unit Demand sections past the page
  // bottom; this layout fits both summary cards on one page for any panel
  // size up through 42 circuits.
  summarySection: {
    marginTop: 8,
    padding: 6,
    borderWidth: 1,
    borderColor: '#000',
    borderStyle: 'solid',
  },
  summaryTitle: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 7,
    marginBottom: 1,
  },
  summaryValue: {
    fontSize: 10.5,
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
    // Split-phase 1Φ-3W (US residential 120/240 V): two opposite-polarity hot
    // legs A and B. 1-pole circuits sit on whichever leg their slot is wired
    // to; 2-pole 240 V circuits (range, dryer, A/C, water heater) span BOTH
    // legs by definition — that's how they get 240 V — so their load is
    // split 50/50 across A and B for balancing purposes.
    let phaseA_VA = 0;
    let phaseB_VA = 0;

    circuits.forEach((c) => {
      const loadVA = c.load_watts || 0;
      if (c.pole === 2) {
        phaseA_VA += loadVA / 2;
        phaseB_VA += loadVA / 2;
      } else {
        const phase = getCircuitPhase(c.circuit_number, 1);
        if (phase === 'A') phaseA_VA += loadVA;
        else phaseB_VA += loadVA;
      }
    });

    return { phaseA_VA, phaseB_VA, phaseC_VA: 0 };
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
  // Sprint 2A C8: per-sheet contractor signature block
  contractorName?: string;
  contractorLicense?: string;
  // Sprint 2A H3: per-sheet ID
  sheetId?: string;
  /**
   * When true, circuits flagged `is_proposed` render with a trailing " *" and
   * a "* = Proposed new circuit" legend appears below the title block. Caller
   * gates this on Project Status = Existing Construction so new-construction
   * packets stay visually unchanged.
   */
  showExistingNewMarkers?: boolean;
}

// Main PDF Component for single panel — page-level fragment for embedding.
export const PanelSchedulePages: React.FC<PanelSchedulePDFProps> = ({
  panel,
  circuits,
  projectName,
  projectAddress,
  datePreppared,
  contractorName,
  contractorLicense,
  sheetId,
  showExistingNewMarkers = false,
}) => {
  // Helper: append " *" to a description when (a) markers are enabled AND
  // (b) the circuit is flagged as a proposed new addition. Returns the raw
  // description otherwise. Sprint 2C M3 follow-on (2026-05-17): when the
  // circuit is proposed, render the whole description in Helvetica-Bold
  // so new circuits visually pop on a dense schedule with 30-42 rows.
  const decorateDescription = (c: Circuit | undefined): React.ReactNode => {
    if (!c) return '';
    if (!(showExistingNewMarkers && c.is_proposed)) return c.description;
    return (
      <Text style={{ fontFamily: 'Helvetica-Bold' }}>
        {`${c.description} *`}
      </Text>
    );
  };
  // Whether to surface the legend below the title block. Only render the
  // legend if markers are enabled AND at least one circuit is actually
  // flagged — keeps existing-construction packets with zero proposed
  // circuits visually clean.
  const showLegend = showExistingNewMarkers && circuits.some(c => c.is_proposed);
  // Filter EVEMS metadata marker circuits — they convey the NEC 625.42
  // setpoint to the load aggregator but aren't physical branches; rendering
  // them on a "20A 2P" placeholder breaker with a 47 kVA load looks like a
  // code violation to an AHJ reviewer. The setpoint is shown separately in
  // its own info block below the Load Summary.
  const realCircuits = circuits.filter(c => !isEVEMSMarkerCircuit(c));
  const evemsSetpointMarker = findEVEMSSetpointMarker(panel.id, circuits);
  const sortedCircuits = [...realCircuits].sort(
    (a, b) => a.circuit_number - b.circuit_number
  );

  // NEC 220.82 Optional Method demand for dwelling unit panels — surfaced
  // as a separate callout below the Load Summary so AHJ reviewers see the
  // sized-for demand alongside raw connected. Same pattern as the EVEMS
  // setpoint callout below.
  const dwellingCircuitsForCalc = realCircuits.map(c => ({
    description: c.description,
    loadWatts: c.load_watts || 0,
  }));
  const dwellingUnitDemand = isDwellingUnitPanel(panel.name, dwellingCircuitsForCalc)
    ? calculateDwellingUnitDemandVA(dwellingCircuitsForCalc)
    : null;

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
    <Page size="LETTER" style={themeStyles.page}>
      <BrandBar pageLabel={`PANEL SCHEDULE - ${panel.name}`} sheetId={sheetId} />
      <View style={themeStyles.titleBlock}>
        <Text style={themeStyles.docTitle}>Panel Schedule</Text>
        <Text style={themeStyles.docSubtitle}>
          {projectName}
          {projectAddress ? ` \u2022 ${projectAddress}` : ''}
        </Text>
      </View>
      <View style={styles.header}>

          {/* Sprint 2C M3 follow-on (2026-05-17): NEW INSTALLATION banner.
              Surfaces at the top of the title block (above the spec grid) so
              an AHJ reviewer flipping to this panel's schedule cover knows
              instantly it represents a new (proposed) installation rather
              than an existing field panel being modified. Suppressed when
              showExistingNewMarkers is off (new-construction projects). */}
          {showExistingNewMarkers && panel.is_proposed && (
            <View style={styles.proposedBanner}>
              <Text style={styles.proposedBannerText}>
                PROPOSED &mdash; NEW INSTALLATION
              </Text>
              <Text style={styles.proposedBannerSub}>
                This panel does not yet exist in the field. Install per this schedule.
              </Text>
            </View>
          )}

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

        {/* Existing/New legend — only when project is existing-construction
            AND at least one circuit is flagged as proposed. */}
        {showLegend && (
          <View style={{ marginBottom: 4, marginTop: -4 }}>
            <Text style={{ fontSize: 8, fontStyle: 'italic', color: '#555' }}>
              * = Proposed new circuit
            </Text>
          </View>
        )}

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
            // Panels have an explicit num_spaces column; fall back for legacy rows.
            const maxSlots = panel.num_spaces ?? (panel.is_main ? 30 : 42);
            const numRows = maxSlots / 2;

            const rows = [];
            for (let row = 1; row <= numRows; row++) {
              const leftNum = row * 2 - 1;  // Odd numbers: 1, 3, 5, 7...
              const rightNum = row * 2;      // Even numbers: 2, 4, 6, 8...

              const leftCkt = sortedCircuits.find(c => c.circuit_number === leftNum);
              const rightCkt = sortedCircuits.find(c => c.circuit_number === rightNum);

              // Phase for this row (left & right slots share the same bus stab,
              // so one letter labels the row). Split-phase panels alternate A/B
              // per row; three-phase panels rotate A/B/C — see getCircuitPhase
              // contract in services/calculations/demandFactor.ts.
              const phase = getCircuitPhase(leftNum, panel.phase === 3 ? 3 : 1);
              const isAlt = row % 2 === 0;

              rows.push(
                <View key={row} style={isAlt ? styles.tableRowAlt : styles.tableRow}>
                  {/* Left Circuit */}
                  <Text style={styles.colLeftCkt}>{leftNum}</Text>
                  <Text style={styles.colLeftDescription}>{decorateDescription(leftCkt)}</Text>
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
                  <Text style={styles.colRightDescription}>{decorateDescription(rightCkt)}</Text>
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

        {/* Phase Balancing Summary — wrap={false} keeps the entire card on
            one page; with the contractor block + sheet ID footer reducing
            the content area, react-pdf otherwise splits this card mid-content. */}
        <View style={styles.summarySection} wrap={false}>
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

        {/* NEC 220.82 Dwelling Unit demand callout — shows the actual sized-for
            demand on a per-unit panel so AHJ reviewers don't read raw connected
            load (e.g. 36 kVA / 150 A) and assume the panel is over-capacity. */}
        {dwellingUnitDemand && (
          <View style={styles.summarySection} wrap={false}>
            <Text style={styles.summaryTitle}>Dwelling Unit Demand (NEC 220.82 Optional Method)</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Demand</Text>
                <Text style={styles.summaryValue}>
                  {(dwellingUnitDemand.totalDemandVA / 1000).toFixed(1)} kVA
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Demand Amps</Text>
                <Text style={styles.summaryValue}>
                  {(
                    dwellingUnitDemand.totalDemandVA /
                    (panel.voltage * (panel.phase === 3 ? Math.sqrt(3) : 1))
                  ).toFixed(1)}
                  A
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>General @ Tiered</Text>
                <Text style={styles.summaryValue}>
                  {(dwellingUnitDemand.generalDemandVA / 1000).toFixed(1)} kVA
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Climate @ 100%</Text>
                <Text style={styles.summaryValue}>
                  {(dwellingUnitDemand.climateDemandVA / 1000).toFixed(1)} kVA
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* NEC 625.42 EVEMS Setpoint callout — visible to AHJ reviewers */}
        {evemsSetpointMarker && evemsSetpointMarker.load_watts && evemsSetpointMarker.load_watts > 0 && (
          <View style={styles.summarySection}>
            <Text style={styles.summaryTitle}>EVEMS Aggregate Setpoint (NEC 625.42)</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Setpoint</Text>
                <Text style={styles.summaryValue}>
                  {(evemsSetpointMarker.load_watts / 1000).toFixed(1)} kVA
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Setpoint Amps</Text>
                <Text style={styles.summaryValue}>
                  {(
                    evemsSetpointMarker.load_watts /
                    (panel.voltage * (panel.phase === 3 ? Math.sqrt(3) : 1))
                  ).toFixed(1)}
                  A
                </Text>
              </View>
            </View>
          </View>
        )}

        <BrandFooter
          projectName={projectName}
          contractorName={contractorName}
          contractorLicense={contractorLicense}
          sheetId={sheetId}
        />
      </Page>
  );
};

// Standalone single-panel Document (used by panel-specific PDF exporters).
export const PanelScheduleDocument: React.FC<PanelSchedulePDFProps> = (props) => (
  <Document>
    <PanelSchedulePages {...props} />
  </Document>
);

/**
 * Multi-Panel Document Component
 */
interface MultiPanelDocumentProps {
  panels: Panel[];
  circuitsByPanel: Map<string, Circuit[]>;
  projectName: string;
  projectAddress?: string;
  // Sprint 2A C8: per-sheet contractor signature block
  contractorName?: string;
  contractorLicense?: string;
  /** Mirrors PanelSchedulePDFProps.showExistingNewMarkers. */
  showExistingNewMarkers?: boolean;
}

export const MultiPanelDocument: React.FC<MultiPanelDocumentProps> = ({
  panels,
  circuitsByPanel,
  projectName,
  projectAddress,
  contractorName,
  contractorLicense,
  showExistingNewMarkers = false,
}) => (
  <Document>
    {panels.map((panel) => {
      const allCircuits = circuitsByPanel.get(panel.id) || [];
      // Hide EVEMS metadata marker circuits from the schedule. They convey
      // the NEC 625.42 setpoint to the load aggregator but aren't physical
      // branches; rendering them on a "20A 2P" placeholder breaker with a
      // 47 kVA load looks like a code violation to an AHJ reviewer.
      const circuits = allCircuits.filter(c => !isEVEMSMarkerCircuit(c));
      const evemsSetpoint = findEVEMSSetpointMarker(panel.id, allCircuits);
      return (
        <Page key={panel.id} size="LETTER" style={themeStyles.page}>
          <BrandBar pageLabel={`PANEL SCHEDULE - ${panel.name}`} />
          <View style={themeStyles.titleBlock}>
            <Text style={themeStyles.docTitle}>Panel Schedule</Text>
            <Text style={themeStyles.docSubtitle}>
              {projectName}
              {projectAddress ? ` \u2022 ${projectAddress}` : ''}
            </Text>
          </View>
          <View style={styles.header}>

            {/* PROPOSED — NEW INSTALLATION banner (Sprint 2C M3 follow-on,
                2026-05-17). Mirrors the banner on PanelSchedulePages above. */}
            {showExistingNewMarkers && panel.is_proposed && (
              <View style={styles.proposedBanner}>
                <Text style={styles.proposedBannerText}>
                  PROPOSED &mdash; NEW INSTALLATION
                </Text>
                <Text style={styles.proposedBannerSub}>
                  This panel does not yet exist in the field. Install per this schedule.
                </Text>
              </View>
            )}

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

          {/* Existing/New legend — mirrors PanelSchedulePages above. */}
          {showExistingNewMarkers && circuits.some(c => c.is_proposed) && (
            <View style={{ marginBottom: 4, marginTop: -4 }}>
              <Text style={{ fontSize: 8, fontStyle: 'italic', color: '#555' }}>
                * = Proposed new circuit
              </Text>
            </View>
          )}

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
              const maxSlots = panel.num_spaces ?? (panel.is_main ? 30 : 42);
              const numRows = maxSlots / 2;
              const decorate = (c: Circuit | undefined): React.ReactNode => {
                if (!c) return '';
                if (!(showExistingNewMarkers && c.is_proposed)) return c.description;
                return (
                  <Text style={{ fontFamily: 'Helvetica-Bold' }}>
                    {`${c.description} *`}
                  </Text>
                );
              };

              const rows = [];
              for (let row = 1; row <= numRows; row++) {
                const leftNum = row * 2 - 1;
                const rightNum = row * 2;

                const leftCkt = sortedCircuits.find(c => c.circuit_number === leftNum);
                const rightCkt = sortedCircuits.find(c => c.circuit_number === rightNum);

                const phase = getCircuitPhase(leftNum, panel.phase === 3 ? 3 : 1);
                const isAlt = row % 2 === 0;

                rows.push(
                  <View key={row} style={isAlt ? styles.tableRowAlt : styles.tableRow}>
                    <Text style={styles.colLeftCkt}>{leftNum}</Text>
                    <Text style={styles.colLeftDescription}>{decorate(leftCkt)}</Text>
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
                    <Text style={styles.colRightDescription}>{decorate(rightCkt)}</Text>
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

          {/* NEC 625.42 EVEMS Setpoint callout — replaces the misleading
              "EVEMS Aggregate Setpoint" row in the circuit table with a
              clearly-labeled info block AHJ reviewers can read at a glance. */}
          {evemsSetpoint && evemsSetpoint.load_watts && evemsSetpoint.load_watts > 0 && (
            <View style={styles.summarySection}>
              <Text style={styles.summaryTitle}>EVEMS Aggregate Setpoint (NEC 625.42)</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Setpoint</Text>
                  <Text style={styles.summaryValue}>
                    {(evemsSetpoint.load_watts / 1000).toFixed(1)} kVA
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Setpoint Amps</Text>
                  <Text style={styles.summaryValue}>
                    {(
                      evemsSetpoint.load_watts /
                      (panel.voltage * (panel.phase === 3 ? Math.sqrt(3) : 1))
                    ).toFixed(1)}
                    A
                  </Text>
                </View>
              </View>
            </View>
          )}

          <BrandFooter
            projectName={projectName}
            contractorName={contractorName}
            contractorLicense={contractorLicense}
          />
        </Page>
      );
    })}
  </Document>
);
