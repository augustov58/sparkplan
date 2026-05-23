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
import { lineToNeutralVoltage } from '../../lib/electricalDisplay';

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
  // NEC 220 demand-by-load-type breakdown table — sits under the Load
  // Summary card so AHJ inspectors see the per-load-type factor application
  // (NEC 220.44 receptacles, 220.50 motors, 220.60 HVAC, etc.) without
  // flipping to the separate Load Calculation Summary page. Compact 4-col
  // row format (LoadType | Connected | Demand | NEC) at fontSize 7 so it
  // fits below a 42-row schedule on the same page.
  breakdownTable: {
    marginTop: 4,
    paddingTop: 3,
    borderTopWidth: 0.5,
    borderTopColor: '#999',
    borderTopStyle: 'solid',
  },
  breakdownHeader: {
    flexDirection: 'row',
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: '#444',
    marginBottom: 1,
  },
  breakdownRow: {
    flexDirection: 'row',
    fontSize: 7,
    marginBottom: 0.5,
  },
  breakdownColType: { width: '32%' },
  breakdownColConnected: { width: '17%', textAlign: 'right' },
  breakdownColDemand: { width: '17%', textAlign: 'right' },
  breakdownColFactor: { width: '10%', textAlign: 'right' },
  breakdownColNec: { width: '24%', textAlign: 'right', color: '#666', fontFamily: 'Helvetica-Oblique' },
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
  /**
   * Sprint 2C M6 fix-up #4 (2026-05-21): building type gates the single-family-MDP
   * dwelling-demand display so commercial restaurants with "Kitchen Hood" /
   * "Range" circuits don't false-positive as dwellings, and multi-family MDPs
   * with "Common Laundry" feeders don't apply per-unit NEC 220.82/.83 instead
   * of building-level NEC 220.84. Only 'single_family_residential' projects
   * enter the single-family-MDP detection path. Multi-family UNIT panels
   * still activate via isDwellingUnitPanel (which doesn't require this gate).
   */
  buildingType?: 'single_family_residential' | 'multi_family' | 'commercial';
  /**
   * Aggregated load for this panel — the same `calculateAggregatedLoad` result
   * the in-app Panel Summary uses. When provided AND meaningful (downstream
   * panels > 0 OR demand < connected, i.e. EVEMS feeder clamp engaged), the
   * Load Summary card surfaces Demand kVA + Demand Amps alongside the
   * connected sum so AHJ reviewers see the NEC-sized number (e.g. a 1000A
   * MDP bus is verified against 999A demand, not the 1380A nameplate sum).
   *
   * Pass `undefined` (or a result where demand equals connected) to fall
   * back to the legacy connected-sum / per-leg-amps display.
   *
   * `necReference` is the dominant article applied (e.g. "NEC 220.84" for
   * multi-family aggregate, "NEC 625.42" for EVEMS-clamped EV panels) and
   * renders as an inline annotation on the Demand label.
   */
  aggregatedLoad?: {
    totalDemandVA: number;
    totalConnectedVA: number;
    downstreamPanelCount: number;
    necReference?: string;
    /**
     * Per-load-type breakdown showing the NEC 220 cascade application
     * (e.g. "Receptacles: 9.0 → 9.0 kVA @ 100% per NEC 220.44",
     * "Motors: 5.0 → 6.3 kVA @ 125% per NEC 220.50"). Renders as a compact
     * audit-trail table below the Load Summary card so AHJ inspectors can
     * verify how the aggregate demand was derived without consulting the
     * external Load Calculation Summary page.
     */
    demandBreakdown?: Array<{
      loadType: string;
      connectedVA: number;
      demandVA: number;
      demandFactor: number;
      necReference: string;
    }>;
  };
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
  buildingType,
  aggregatedLoad,
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

  // NEC 220.82/.83 Optional Method demand for dwelling panels.
  //
  // Sprint 2C M6 fix-up #2 (2026-05-21): the upstream isDwellingUnitPanel
  // helper is intentionally narrow — it matches ONLY multi-family unit
  // panels ("Unit 101", "Apt 3B") and explicitly rejects single-family
  // MDPs ("Main Panel", "House Panel", "Multifamily Test MDP"). That's
  // correct for multi-family aggregate MDPs (which use NEC 220.84, not
  // 220.82/.83) but excludes single-family service panels, which DO use
  // 220.82/.83. So we layer a second check here: a panel marked is_main
  // with dwelling-shape circuits (kitchen / range / laundry / dryer /
  // water heater / dishwasher) is a single-family MDP and gets the
  // dwelling demand. Multi-family aggregate MDPs DON'T have these
  // circuits (their loads are feeders to unit panels), so this check
  // doesn't false-positive on them. Sub-panels (is_main=false) keep the
  // connected-sum + per-leg amps display since 220.82/.83 applies at the
  // service level, not per sub-panel.
  const dwellingCircuitsForCalc = realCircuits.map(c => ({
    description: c.description,
    loadWatts: c.load_watts || 0,
  }));
  const hasDwellingShape = dwellingCircuitsForCalc.some(c => {
    const d = (c.description ?? '').toLowerCase();
    return (
      d.includes('kitchen') ||
      d.includes('range') ||
      d.includes('laundry') ||
      d.includes('dryer') ||
      d.includes('water heater') ||
      d.includes('dishwasher')
    );
  });
  const isUnitPanel = isDwellingUnitPanel(panel.name, dwellingCircuitsForCalc);
  // Gate single-family MDP detection on buildingType === 'single_family_residential'.
  // - Multi-family aggregate MDPs (buildingType === 'multi_family') stay
  //   on the non-dwelling display because they use NEC 220.84 (table demand
  //   factors by unit count), not per-unit 220.82/.83.
  // - Commercial buildings (buildingType === 'commercial') don't use the
  //   dwelling method at all, even if they have "Kitchen Hood" circuits.
  // - Multi-family UNIT panels still activate via isUnitPanel (which
  //   doesn't depend on buildingType — it matches by panel name pattern).
  // - Legacy callers (buildingType=undefined) default to single-family
  //   behavior to preserve the dwelling display for projects that haven't
  //   set buildingType yet; net effect for them matches Sprint 2C M5 behavior.
  const isSingleFamilyContext =
    buildingType === 'single_family_residential' || buildingType === undefined;
  const isSingleFamilyMDP =
    panel.is_main === true && hasDwellingShape && isSingleFamilyContext;
  const dwellingUnitDemand = (isUnitPanel || isSingleFamilyMDP)
    ? calculateDwellingUnitDemandVA(dwellingCircuitsForCalc)
    : null;

  const phaseBalancing = calculatePhaseBalancing(sortedCircuits, panel.phase);
  const voltage = panel.voltage;

  // Sprint 2C M6 fix-up (2026-05-21): per-leg line current uses the
  // line-to-neutral voltage, NOT line-to-line. The phaseA_VA tally
  // already represents the leg's load referenced to neutral (half of
  // 240V 2P loads + all 120V 1P loads on that leg), so dividing by
  // L-L (240V) would give half the actual line current. Previous
  // value of ~113 A for a 51.8 kVA single-phase panel was numerically
  // off by 2× — the correct value is ~226 A per leg connected.
  const vLN = lineToNeutralVoltage(voltage, panel.phase);

  // Calculate amps per phase using the corrected divisor.
  let phaseA_Amps = 0;
  let phaseB_Amps = 0;
  let phaseC_Amps = 0;

  if (panel.phase === 1) {
    phaseA_Amps = phaseBalancing.phaseA_VA / vLN;
  } else {
    // Three-phase wye: I_line = phase_VA / V_LN.
    phaseA_Amps = phaseBalancing.phaseA_VA / vLN;
    phaseB_Amps = phaseBalancing.phaseB_VA / vLN;
    phaseC_Amps = phaseBalancing.phaseC_VA / vLN;
  }

  const totalVA =
    phaseBalancing.phaseA_VA +
    phaseBalancing.phaseB_VA +
    phaseBalancing.phaseC_VA;

  // Show the NEC-applied demand on any non-dwelling panel where the
  // aggregator produced a positive result. This fires for:
  //   1. Aggregator MDPs (downstream panels — NEC 220.84 multi-family, or
  //      standard NEC 220 cascade for commercial)
  //   2. EVEMS-clamped EV panels (demand < connected due to NEC 625.42)
  //   3. Commercial / industrial sub-panels (demand may equal connected
  //      when all loads are at 100% factor, but the inspector still wants
  //      to see Demand kVA + Demand Amps with the NEC 220 audit trail).
  // Dwelling unit panels (Unit 101, single-family MDPs) bypass this in
  // favor of `dwellingUnitDemand` from NEC 220.82/.83.
  const hasAggregatedDemand =
    !dwellingUnitDemand &&
    !!aggregatedLoad &&
    aggregatedLoad.totalDemandVA > 0;
  const voltageDivisor = panel.voltage * (panel.phase === 3 ? Math.sqrt(3) : 1);
  const aggregatedDemandAmps = hasAggregatedDemand
    ? aggregatedLoad!.totalDemandVA / voltageDivisor
    : 0;
  // EVEMS callout is now redundant when the Load Summary already shows the
  // setpoint as Demand kVA / Demand Amps. Keep the separate card only when
  // the setpoint marker exists but the aggregatedLoad path didn't surface it
  // (e.g. caller passed no aggregatedLoad). Otherwise the AHJ reviewer sees
  // the same numbers twice on a page that's already tight on vertical space.
  const hasEvemsInLoadSummary =
    hasAggregatedDemand &&
    (aggregatedLoad?.necReference ?? '').includes('625.42');
  // Render the NEC 220 breakdown rows only when the aggregator actually
  // computed per-load-type splits AND there's a meaningful reduction OR
  // multiple categories. Skip for single-category panels where the
  // breakdown would just restate the Load Summary numbers.
  const breakdownRows = (aggregatedLoad?.demandBreakdown ?? [])
    .filter(b => b.connectedVA > 0 || b.demandVA > 0);
  const showBreakdown = hasAggregatedDemand && breakdownRows.length >= 1;

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
            the content area, react-pdf otherwise splits this card mid-content.

            Sprint 2C M6 fix-up (2026-05-21): for DWELLING panels, NEC 220.82/
            220.83 is the authoritative sizing method — the dwelling demand is
            NOT the raw circuit sum (220.83 uses a 3 VA/sq ft baseline that
            displaces lighting/SABC/laundry). Showing connected-line-amps for
            a 240V split-phase dwelling panel would also be misleading because
            NEC demand factors substantially reduce actual service current.

            So we branch: dwelling panels show DEMAND values matching the
            in-app Panel Summary + Dwelling Load Calculator. Non-dwelling
            panels (commercial / industrial) keep the connected sum + per-leg
            amperage display since those are the relevant questions for those
            panel types. */}
        {/* Load Summary — single consolidated card. Three modes:
            1. Dwelling unit panel (NEC 220.82/.83): Total Circuits | Demand kVA |
               Demand Amps | General@Tiered | Climate@100% — five columns merge the
               former "Dwelling Demand Breakdown" card into the Load Summary so
               42-circuit panels don't overflow to a second page.
            2. Aggregator / EVEMS-clamped (NEC 220.84 or 625.42): Total Circuits |
               Connected kVA | Demand kVA | Demand Amps — surfaces the AHJ-relevant
               sized-current alongside the connected nameplate sum. MDPs on a 1000A
               bus that summed to 1380A nameplate now show the 999A demand explicitly.
            3. Default (panel-local, no factor reduction): Total Circuits |
               Connected kVA | per-leg / per-phase connected amps. Unchanged from
               the prior layout for panels where demand == connected. */}
        <View style={styles.summarySection} wrap={false}>
          <Text style={styles.summaryTitle}>
            {dwellingUnitDemand
              ? 'Load Summary (NEC Dwelling Demand)'
              : hasAggregatedDemand
                ? `Load Summary (NEC Demand${aggregatedLoad?.necReference ? ` — ${aggregatedLoad.necReference}` : ''})`
                : 'Load Summary & Phase Balance'}
          </Text>

          {dwellingUnitDemand ? (
            <>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Circuits</Text>
                  <Text style={styles.summaryValue}>{sortedCircuits.length}</Text>
                </View>

                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Demand Load</Text>
                  <Text style={styles.summaryValue}>
                    {(dwellingUnitDemand.totalDemandVA / 1000).toFixed(1)} kVA
                  </Text>
                </View>

                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Demand Amps</Text>
                  <Text style={styles.summaryValue}>
                    {(dwellingUnitDemand.totalDemandVA / voltageDivisor).toFixed(1)}A
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
              {(() => {
                // Surface the NEC 220.83 tier derivation as an inspector-readable
                // formula. Reverses the math from calculateDwellingUnitDemandVA:
                // first 10 kVA @ 100% + remainder @ 40%, so we reconstruct the
                // "general bucket connected" from the demand result. When
                // general demand <= 10 kVA, no tier applied — all of it was
                // under the threshold.
                const genDemandKVA = dwellingUnitDemand.generalDemandVA / 1000;
                const genConnectedKVA = dwellingUnitDemand.generalConnectedVA / 1000;
                const tierFormula = genDemandKVA <= 10
                  ? `General: ${genConnectedKVA.toFixed(1)} kVA @ 100% (under NEC 220.83 tier threshold)`
                  : `General: 10.0 kVA × 100% + ${(genConnectedKVA - 10).toFixed(1)} kVA × 40% = ${genDemandKVA.toFixed(1)} kVA per NEC 220.83`;
                return (
                  <Text style={[styles.summaryLabel, { marginTop: 4, fontSize: 7, fontStyle: 'italic' }]}>
                    {tierFormula}. Climate: larger of heating/cooling @ 100% per NEC 220.60 (non-coincident).
                  </Text>
                );
              })()}
            </>
          ) : hasAggregatedDemand ? (
            <>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Circuits</Text>
                  <Text style={styles.summaryValue}>{sortedCircuits.length}</Text>
                </View>

                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Connected Load (sum)</Text>
                  <Text style={styles.summaryValue}>
                    {(aggregatedLoad!.totalConnectedVA / 1000).toFixed(1)} kVA
                  </Text>
                </View>

                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Demand Load</Text>
                  <Text style={styles.summaryValue}>
                    {(aggregatedLoad!.totalDemandVA / 1000).toFixed(1)} kVA
                  </Text>
                </View>

                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Demand Amps</Text>
                  <Text style={styles.summaryValue}>
                    {aggregatedDemandAmps.toFixed(1)}A
                  </Text>
                </View>
              </View>
              <Text style={[styles.summaryLabel, { marginTop: 4, fontSize: 7, fontStyle: 'italic' }]}>
                {aggregatedLoad?.downstreamPanelCount && aggregatedLoad.downstreamPanelCount > 0
                  ? `Aggregated demand across ${aggregatedLoad.downstreamPanelCount} downstream panel${aggregatedLoad.downstreamPanelCount === 1 ? '' : 's'} per ${aggregatedLoad.necReference || 'NEC 220'} — verify bus rating against Demand Amps, not the nameplate sum.`
                  : `Demand reflects ${aggregatedLoad?.necReference || 'NEC 220'} — feeder/service sizing uses Demand Amps; branch conductors stay at full nameplate per NEC 220.57(A).`}
              </Text>
              {showBreakdown && (
                <View style={styles.breakdownTable}>
                  <View style={styles.breakdownHeader}>
                    <Text style={styles.breakdownColType}>Load Type</Text>
                    <Text style={styles.breakdownColConnected}>Connected</Text>
                    <Text style={styles.breakdownColDemand}>Demand</Text>
                    <Text style={styles.breakdownColFactor}>Factor</Text>
                    <Text style={styles.breakdownColNec}>NEC</Text>
                  </View>
                  {breakdownRows.map((b, i) => (
                    <View key={i} style={styles.breakdownRow}>
                      <Text style={styles.breakdownColType}>{b.loadType}</Text>
                      <Text style={styles.breakdownColConnected}>
                        {(b.connectedVA / 1000).toFixed(1)} kVA
                      </Text>
                      <Text style={styles.breakdownColDemand}>
                        {(b.demandVA / 1000).toFixed(1)} kVA
                      </Text>
                      <Text style={styles.breakdownColFactor}>
                        {(b.demandFactor * 100).toFixed(0)}%
                      </Text>
                      <Text style={styles.breakdownColNec}>
                        {b.necReference.replace(/^NEC\s+/, '').replace(/\s*\(.*$/, '')}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : (
            <>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Circuits</Text>
                  <Text style={styles.summaryValue}>{sortedCircuits.length}</Text>
                </View>

                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Connected Load (sum)</Text>
                  <Text style={styles.summaryValue}>
                    {(totalVA / 1000).toFixed(1)} kVA
                  </Text>
                </View>

                {panel.phase === 3 ? (
                  <>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Phase A (connected)</Text>
                      <Text style={styles.summaryValue}>
                        {phaseA_Amps.toFixed(1)}A
                      </Text>
                    </View>

                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Phase B (connected)</Text>
                      <Text style={styles.summaryValue}>
                        {phaseB_Amps.toFixed(1)}A
                      </Text>
                    </View>

                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Phase C (connected)</Text>
                      <Text style={styles.summaryValue}>
                        {phaseC_Amps.toFixed(1)}A
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Connected Line Amps (per leg)</Text>
                    <Text style={styles.summaryValue}>
                      {phaseA_Amps.toFixed(1)}A
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.summaryLabel, { marginTop: 4, fontSize: 7, fontStyle: 'italic' }]}>
                Connected load sums all circuits at nameplate; per-leg amps use line-to-neutral voltage. Service sizing uses NEC 220 demand-method values — see Load Calculation Summary.
              </Text>
            </>
          )}
        </View>

        {/* NEC 625.42 EVEMS Setpoint callout — only rendered when the Load
            Summary above didn't already integrate the setpoint as Demand kVA /
            Demand Amps. Avoids duplicating identical numbers on a page that's
            tight on vertical space. */}
        {evemsSetpointMarker && evemsSetpointMarker.load_watts && evemsSetpointMarker.load_watts > 0 && !hasEvemsInLoadSummary && (
          <View style={styles.summarySection} wrap={false}>
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
                  {(evemsSetpointMarker.load_watts / voltageDivisor).toFixed(1)}A
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
  /** Mirrors PanelSchedulePDFProps.buildingType — gates single-family-MDP
   *  dwelling-demand detection so commercial / multi-family aggregate MDPs
   *  with dwelling-shape circuit names (Kitchen Hood, Common Laundry) don't
   *  false-positive into the NEC 220.82/.83 display branch. */
  buildingType?: 'single_family_residential' | 'multi_family' | 'commercial';
  /** Per-panel aggregated demand (NEC 220.84 multi-family aggregate, EVEMS
   *  feeder clamp per 625.42, or standard NEC 220 cascade with downstream
   *  feeders). Keyed by panel.id. Mirrors PanelSchedulePDFProps.aggregatedLoad
   *  — see that interface for the trigger semantics. Optional; panels not in
   *  the map fall back to the legacy connected-sum display. */
  aggregatedLoadByPanel?: Map<string, {
    totalDemandVA: number;
    totalConnectedVA: number;
    downstreamPanelCount: number;
    necReference?: string;
    demandBreakdown?: Array<{
      loadType: string;
      connectedVA: number;
      demandVA: number;
      demandFactor: number;
      necReference: string;
    }>;
  }>;
}

export const MultiPanelDocument: React.FC<MultiPanelDocumentProps> = ({
  panels,
  circuitsByPanel,
  projectName,
  projectAddress,
  contractorName,
  contractorLicense,
  showExistingNewMarkers = false,
  buildingType,
  aggregatedLoadByPanel,
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

          {/* Phase Balancing Summary — see sibling implementation in
              PanelSchedulePages above for full branch rationale (dwelling vs
              aggregator/EVEMS vs default). Mirror logic kept here to keep
              MultiPanelDocument self-contained for the standalone "export
              all panels" download path. */}
          {(() => {
            const phaseBalancing = calculatePhaseBalancing(circuits, panel.phase);
            const totalVA =
              phaseBalancing.phaseA_VA +
              phaseBalancing.phaseB_VA +
              phaseBalancing.phaseC_VA;
            const vLN = lineToNeutralVoltage(panel.voltage, panel.phase);
            const phaseA_Amps = phaseBalancing.phaseA_VA / vLN;
            const phaseB_Amps = phaseBalancing.phaseB_VA / vLN;
            const phaseC_Amps = phaseBalancing.phaseC_VA / vLN;
            const voltageDivisor = panel.voltage * (panel.phase === 3 ? Math.sqrt(3) : 1);

            const dwellingCircuitsForCalc = circuits.map(c => ({
              description: c.description,
              loadWatts: c.load_watts || 0,
            }));
            const hasDwellingShape2 = dwellingCircuitsForCalc.some(c => {
              const d = (c.description ?? '').toLowerCase();
              return (
                d.includes('kitchen') ||
                d.includes('range') ||
                d.includes('laundry') ||
                d.includes('dryer') ||
                d.includes('water heater') ||
                d.includes('dishwasher')
              );
            });
            const isUnitPanel2 = isDwellingUnitPanel(panel.name, dwellingCircuitsForCalc);
            const isSingleFamilyContext2 =
              buildingType === 'single_family_residential' || buildingType === undefined;
            const isSingleFamilyMDP2 =
              panel.is_main === true && hasDwellingShape2 && isSingleFamilyContext2;
            const dwellingDemand = (isUnitPanel2 || isSingleFamilyMDP2)
              ? calculateDwellingUnitDemandVA(dwellingCircuitsForCalc)
              : null;

            const aggLoad = aggregatedLoadByPanel?.get(panel.id);
            const hasAggregatedDemand =
              !dwellingDemand &&
              !!aggLoad &&
              aggLoad.totalDemandVA > 0;
            const aggDemandAmps = hasAggregatedDemand
              ? aggLoad!.totalDemandVA / voltageDivisor
              : 0;
            const breakdownRows2 = (aggLoad?.demandBreakdown ?? [])
              .filter(b => b.connectedVA > 0 || b.demandVA > 0);
            const showBreakdown2 = hasAggregatedDemand && breakdownRows2.length >= 1;

            return (
              <View style={styles.summarySection} wrap={false}>
                <Text style={styles.summaryTitle}>
                  {dwellingDemand
                    ? 'Load Summary (NEC Dwelling Demand)'
                    : hasAggregatedDemand
                      ? `Load Summary (NEC Demand${aggLoad?.necReference ? ` — ${aggLoad.necReference}` : ''})`
                      : 'Load Summary & Phase Balance'}
                </Text>

                {dwellingDemand ? (
                  <>
                    <View style={styles.summaryGrid}>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Total Circuits</Text>
                        <Text style={styles.summaryValue}>{circuits.length}</Text>
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Demand Load</Text>
                        <Text style={styles.summaryValue}>
                          {(dwellingDemand.totalDemandVA / 1000).toFixed(1)} kVA
                        </Text>
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Demand Amps</Text>
                        <Text style={styles.summaryValue}>
                          {(dwellingDemand.totalDemandVA / voltageDivisor).toFixed(1)}A
                        </Text>
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>General @ Tiered</Text>
                        <Text style={styles.summaryValue}>
                          {(dwellingDemand.generalDemandVA / 1000).toFixed(1)} kVA
                        </Text>
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Climate @ 100%</Text>
                        <Text style={styles.summaryValue}>
                          {(dwellingDemand.climateDemandVA / 1000).toFixed(1)} kVA
                        </Text>
                      </View>
                    </View>
                    {(() => {
                      const genDemandKVA = dwellingDemand.generalDemandVA / 1000;
                      const genConnectedKVA = dwellingDemand.generalConnectedVA / 1000;
                      const tierFormula = genDemandKVA <= 10
                        ? `General: ${genConnectedKVA.toFixed(1)} kVA @ 100% (under NEC 220.83 tier threshold)`
                        : `General: 10.0 kVA × 100% + ${(genConnectedKVA - 10).toFixed(1)} kVA × 40% = ${genDemandKVA.toFixed(1)} kVA per NEC 220.83`;
                      return (
                        <Text style={[styles.summaryLabel, { marginTop: 4, fontSize: 7, fontStyle: 'italic' }]}>
                          {tierFormula}. Climate: larger of heating/cooling @ 100% per NEC 220.60 (non-coincident).
                        </Text>
                      );
                    })()}
                  </>
                ) : hasAggregatedDemand ? (
                  <>
                    <View style={styles.summaryGrid}>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Total Circuits</Text>
                        <Text style={styles.summaryValue}>{circuits.length}</Text>
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Connected Load (sum)</Text>
                        <Text style={styles.summaryValue}>
                          {(aggLoad!.totalConnectedVA / 1000).toFixed(1)} kVA
                        </Text>
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Demand Load</Text>
                        <Text style={styles.summaryValue}>
                          {(aggLoad!.totalDemandVA / 1000).toFixed(1)} kVA
                        </Text>
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Demand Amps</Text>
                        <Text style={styles.summaryValue}>
                          {aggDemandAmps.toFixed(1)}A
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.summaryLabel, { marginTop: 4, fontSize: 7, fontStyle: 'italic' }]}>
                      {aggLoad?.downstreamPanelCount && aggLoad.downstreamPanelCount > 0
                        ? `Aggregated demand across ${aggLoad.downstreamPanelCount} downstream panel${aggLoad.downstreamPanelCount === 1 ? '' : 's'} per ${aggLoad.necReference || 'NEC 220'} — verify bus rating against Demand Amps, not the nameplate sum.`
                        : `Demand reflects ${aggLoad?.necReference || 'NEC 220'} — feeder/service sizing uses Demand Amps; branch conductors stay at full nameplate per NEC 220.57(A).`}
                    </Text>
                    {showBreakdown2 && (
                      <View style={styles.breakdownTable}>
                        <View style={styles.breakdownHeader}>
                          <Text style={styles.breakdownColType}>Load Type</Text>
                          <Text style={styles.breakdownColConnected}>Connected</Text>
                          <Text style={styles.breakdownColDemand}>Demand</Text>
                          <Text style={styles.breakdownColFactor}>Factor</Text>
                          <Text style={styles.breakdownColNec}>NEC</Text>
                        </View>
                        {breakdownRows2.map((b, i) => (
                          <View key={i} style={styles.breakdownRow}>
                            <Text style={styles.breakdownColType}>{b.loadType}</Text>
                            <Text style={styles.breakdownColConnected}>
                              {(b.connectedVA / 1000).toFixed(1)} kVA
                            </Text>
                            <Text style={styles.breakdownColDemand}>
                              {(b.demandVA / 1000).toFixed(1)} kVA
                            </Text>
                            <Text style={styles.breakdownColFactor}>
                              {(b.demandFactor * 100).toFixed(0)}%
                            </Text>
                            <Text style={styles.breakdownColNec}>
                              {b.necReference.replace(/^NEC\s+/, '').replace(/\s*\(.*$/, '')}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.summaryGrid}>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Total Circuits</Text>
                      <Text style={styles.summaryValue}>{circuits.length}</Text>
                    </View>

                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Connected Load (sum)</Text>
                      <Text style={styles.summaryValue}>
                        {(totalVA / 1000).toFixed(1)} kVA
                      </Text>
                    </View>

                    {panel.phase === 3 ? (
                      <>
                        <View style={styles.summaryItem}>
                          <Text style={styles.summaryLabel}>Phase A (connected)</Text>
                          <Text style={styles.summaryValue}>
                            {phaseA_Amps.toFixed(1)}A
                          </Text>
                        </View>

                        <View style={styles.summaryItem}>
                          <Text style={styles.summaryLabel}>Phase B (connected)</Text>
                          <Text style={styles.summaryValue}>
                            {phaseB_Amps.toFixed(1)}A
                          </Text>
                        </View>

                        <View style={styles.summaryItem}>
                          <Text style={styles.summaryLabel}>Phase C (connected)</Text>
                          <Text style={styles.summaryValue}>
                            {phaseC_Amps.toFixed(1)}A
                          </Text>
                        </View>
                      </>
                    ) : (
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Connected Line Amps (per leg)</Text>
                        <Text style={styles.summaryValue}>
                          {phaseA_Amps.toFixed(1)}A
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })()}

          {/* NEC 625.42 EVEMS Setpoint callout — only when not already
              integrated into the Load Summary as Demand kVA / Demand Amps
              (which happens when aggregatedLoadByPanel surfaced the EVEMS
              clamp). Prevents the same numbers from rendering twice on a
              page that's already tight on vertical space. */}
          {(() => {
            const aggLoad = aggregatedLoadByPanel?.get(panel.id);
            const hasEvemsInLoadSummary =
              !!aggLoad &&
              aggLoad.totalDemandVA > 0 &&
              aggLoad.totalDemandVA < aggLoad.totalConnectedVA - 1 &&
              (aggLoad.necReference ?? '').includes('625.42');
            if (!evemsSetpoint || !evemsSetpoint.load_watts || evemsSetpoint.load_watts <= 0) return null;
            if (hasEvemsInLoadSummary) return null;
            const voltageDivisor = panel.voltage * (panel.phase === 3 ? Math.sqrt(3) : 1);
            return (
              <View style={styles.summarySection} wrap={false}>
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
                      {(evemsSetpoint.load_watts / voltageDivisor).toFixed(1)}A
                    </Text>
                  </View>
                </View>
              </View>
            );
          })()}

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
