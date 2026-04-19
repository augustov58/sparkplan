/**
 * Commercial Load Calculation PDF Document
 *
 * Submittal-quality report for commercial/industrial load calculations per NEC
 * Article 220 Part III/IV. Content flows through a single <Page> so react-pdf
 * creates physical page breaks only when content actually overflows — a small
 * project renders on 1 page, a dense project expands to 2+ as needed.
 *
 * Flow: brand bar → title → project info grid → service sizing summary
 *       → load breakdown table → service sizing math → input parameters
 *       (receptacles / HVAC / motors / kitchen / special) → warnings → notes
 *       → signature block. BrandBar & Footer are `fixed` so they repeat.
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Project } from '../../types';
import type {
  CommercialLoadResult,
  HVACLoad,
  MotorLoad,
  KitchenEquipment,
  SpecialLoad,
  OccupancyType,
} from '../calculations/commercialLoad';
import { OCCUPANCY_LABELS, LIGHTING_UNIT_LOAD } from '../calculations/commercialLoad';

// Helvetica + Helvetica-Bold are built-in standard PDF fonts; do not register.

// ==================== STYLES ====================

// Brand color constants (matches app's Tailwind theme)
const BRAND_YELLOW = '#FFCC00';
const BRAND_DARK = '#2d3b2d';

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingHorizontal: 32,
    paddingBottom: 44, // leave room for footer
    fontSize: 9.5,
    fontFamily: 'Helvetica',
    color: '#111827',
  },

  // --- Header band across the top of every page ---
  brandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: BRAND_DARK,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  brandBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandBolt: {
    width: 11,
    height: 11,
    backgroundColor: BRAND_YELLOW,
    marginRight: 6,
  },
  brandName: {
    color: '#ffffff',
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
  },
  brandBarRight: {
    color: '#cfd8cf',
    fontSize: 8,
  },

  // --- Document title block ---
  titleBlock: {
    marginBottom: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: BRAND_DARK,
    paddingBottom: 4,
  },
  docTitle: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_DARK,
    marginBottom: 1,
  },
  docSubtitle: {
    fontSize: 9,
    color: '#6b7280',
  },

  // --- Section headers ---
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    backgroundColor: BRAND_DARK,
    paddingVertical: 3,
    paddingHorizontal: 7,
    marginTop: 8,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  subSectionTitle: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_DARK,
    marginTop: 6,
    marginBottom: 2,
  },

  // --- Project info grid (4 col for tighter layout) ---
  projectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  projectCell: {
    width: '25%',
    paddingVertical: 2,
    paddingRight: 6,
  },
  projectLabel: {
    fontSize: 6.5,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 0,
  },
  projectValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },

  // --- Summary cards (compact) ---
  summaryRow: {
    flexDirection: 'row',
    marginTop: 4,
    marginBottom: 4,
    gap: 6,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 3,
    padding: 6,
  },
  summaryCardHighlight: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: BRAND_YELLOW,
    borderRadius: 3,
    padding: 6,
    backgroundColor: '#fffbe6',
  },
  summaryLabel: {
    fontSize: 6.5,
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_DARK,
  },
  summaryUnit: {
    fontSize: 9,
    color: '#6b7280',
    marginLeft: 2,
  },
  summarySub: {
    fontSize: 7.5,
    color: '#6b7280',
    marginTop: 1,
  },

  // --- Tables ---
  table: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#fafafa',
  },
  tableTotalRow: {
    flexDirection: 'row',
    backgroundColor: BRAND_DARK,
    paddingVertical: 3,
  },
  th: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
    padding: 3.5,
    textAlign: 'left',
  },
  td: {
    fontSize: 7.5,
    color: '#111827',
    padding: 3.5,
  },
  tdNum: {
    fontSize: 7.5,
    color: '#111827',
    padding: 3.5,
    textAlign: 'right',
  },
  tdBold: {
    fontSize: 8,
    color: '#ffffff',
    padding: 3.5,
    fontFamily: 'Helvetica-Bold',
  },
  tdBoldNum: {
    fontSize: 8,
    color: '#ffffff',
    padding: 3.5,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
  },

  // --- Callouts ---
  warningBox: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderLeftWidth: 2.5,
    borderLeftColor: '#f59e0b',
    padding: 5,
    marginBottom: 3,
  },
  warningText: {
    fontSize: 8.5,
    color: '#78350f',
  },
  noteBox: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderLeftWidth: 2.5,
    borderLeftColor: '#3b82f6',
    padding: 5,
    marginBottom: 3,
  },
  noteText: {
    fontSize: 8.5,
    color: '#1e3a8a',
  },

  // --- Signature block ---
  signatureBlock: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
  },
  sigField: {
    flex: 1,
  },
  sigLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#6b7280',
    height: 18,
    marginBottom: 2,
  },
  sigLabel: {
    fontSize: 6.5,
    color: '#6b7280',
    textTransform: 'uppercase',
  },

  // --- Service-sizing math block ---
  mathBlock: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 6,
    marginTop: 3,
    marginBottom: 3,
  },
  mathLine: {
    fontSize: 8.5,
    color: '#374151',
    marginBottom: 2,
    fontFamily: 'Helvetica',
  },
  mathResult: {
    fontSize: 9.5,
    color: BRAND_DARK,
    fontFamily: 'Helvetica-Bold',
    marginTop: 3,
  },

  // --- Footer ---
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#9ca3af',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 4,
  },

  necRef: {
    fontSize: 7,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  overrideBadge: {
    fontSize: 7,
    color: '#92400e',
    fontFamily: 'Helvetica-Bold',
    marginTop: 2,
  },
});

// ==================== PROPS ====================

export interface CommercialLoadDocumentProps {
  project: Pick<Project, 'id' | 'name' | 'address' | 'necEdition'>;
  occupancyType: OccupancyType;
  totalFloorArea: number;
  generalReceptacleCount: number;
  showWindowLighting_linearFeet: number;
  signOutlets: number;
  hvacLoads: HVACLoad[];
  motorLoads: MotorLoad[];
  kitchenEquipment: KitchenEquipment[];
  specialLoads: SpecialLoad[];
  serviceVoltage: number;
  servicePhase: 1 | 3;
  result: CommercialLoadResult;
  /** Effective main breaker after any user override in the UI */
  effectiveMainBreaker: number;
  /** Effective bus rating after any user override in the UI */
  effectiveBusRating: number;
  isMainBreakerOverridden: boolean;
  isBusOverridden: boolean;
  /** Optional — if known, name of engineer/designer. Shown in signature block. */
  preparedBy?: string;
}

// ==================== HELPERS ====================

const fmtVA = (va: number): string => va.toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmtKVA = (va: number): string => (va / 1000).toFixed(2);
const fmtA = (a: number, decimals = 1): string => a.toFixed(decimals);
const fmtPct = (p: number): string => p.toFixed(1);
const todayStr = (): string =>
  new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

// ==================== COMPONENTS ====================

const BrandBar: React.FC<{ pageLabel: string }> = ({ pageLabel }) => (
  <View style={styles.brandBar} fixed>
    <View style={styles.brandBarLeft}>
      <View style={styles.brandBolt} />
      <Text style={styles.brandName}>SPARKPLAN</Text>
    </View>
    <Text style={styles.brandBarRight}>{pageLabel}</Text>
  </View>
);

const Footer: React.FC = () => (
  <View style={styles.footer} fixed>
    <Text>SparkPlan • sparkplan.app</Text>
    <Text
      render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
    />
    <Text>Generated {todayStr()}</Text>
  </View>
);

// ==================== DOCUMENT ====================

export const CommercialLoadDocument: React.FC<CommercialLoadDocumentProps> = (props) => {
  const {
    project,
    occupancyType,
    totalFloorArea,
    generalReceptacleCount,
    showWindowLighting_linearFeet,
    signOutlets,
    hvacLoads,
    motorLoads,
    kitchenEquipment,
    specialLoads,
    serviceVoltage,
    servicePhase,
    result,
    effectiveMainBreaker,
    effectiveBusRating,
    isMainBreakerOverridden,
    isBusOverridden,
    preparedBy,
  } = props;

  const utilization = (result.calculatedAmps / effectiveMainBreaker) * 100;
  const serviceSizingLoad_VA = result.loadBreakdown.reduce(
    (t, it) => t + it.serviceSizingLoad_VA,
    0
  );

  return (
    <Document
      title={`Commercial Load Calculation — ${project.name}`}
      author="SparkPlan"
      subject="Commercial Load Calculation Report"
    >
      {/* Single Page — content flows naturally; react-pdf creates new physical pages only when needed.
          Brand bar & footer are `fixed` so they repeat on every physical page. */}
      <Page size="LETTER" style={styles.page}>
        <BrandBar pageLabel="COMMERCIAL LOAD CALCULATION" />

        <View style={styles.titleBlock}>
          <Text style={styles.docTitle}>Commercial Load Calculation Report</Text>
          <Text style={styles.docSubtitle}>
            Per NEC {project.necEdition ?? '2023'} Article 220, Part III &amp; IV — Non-Dwelling Feeder &amp; Service Load
          </Text>
        </View>

        {/* Project Info — 4-column grid packs 8 fields into 2 rows */}
        <Text style={styles.sectionTitle}>PROJECT INFORMATION</Text>
        <View style={styles.projectGrid}>
          <View style={styles.projectCell}>
            <Text style={styles.projectLabel}>Project</Text>
            <Text style={styles.projectValue}>{project.name}</Text>
          </View>
          <View style={styles.projectCell}>
            <Text style={styles.projectLabel}>Address</Text>
            <Text style={styles.projectValue}>{project.address || '—'}</Text>
          </View>
          <View style={styles.projectCell}>
            <Text style={styles.projectLabel}>Date</Text>
            <Text style={styles.projectValue}>{todayStr()}</Text>
          </View>
          <View style={styles.projectCell}>
            <Text style={styles.projectLabel}>NEC Edition</Text>
            <Text style={styles.projectValue}>NEC {project.necEdition ?? '2023'}</Text>
          </View>
          <View style={styles.projectCell}>
            <Text style={styles.projectLabel}>Occupancy</Text>
            <Text style={styles.projectValue}>{OCCUPANCY_LABELS[occupancyType]}</Text>
          </View>
          <View style={styles.projectCell}>
            <Text style={styles.projectLabel}>Floor Area</Text>
            <Text style={styles.projectValue}>{totalFloorArea.toLocaleString()} sq ft</Text>
          </View>
          <View style={styles.projectCell}>
            <Text style={styles.projectLabel}>Service</Text>
            <Text style={styles.projectValue}>
              {serviceVoltage}V {servicePhase}Φ
            </Text>
          </View>
          <View style={styles.projectCell}>
            <Text style={styles.projectLabel}>Lighting Load</Text>
            <Text style={styles.projectValue}>
              {LIGHTING_UNIT_LOAD[occupancyType]} VA/sq ft
            </Text>
          </View>
          {preparedBy && (
            <View style={styles.projectCell}>
              <Text style={styles.projectLabel}>Prepared By</Text>
              <Text style={styles.projectValue}>{preparedBy}</Text>
            </View>
          )}
        </View>

        {/* Service Sizing Summary — the money section: breaker, bus, utilization */}
        <Text style={styles.sectionTitle}>SERVICE SIZING SUMMARY</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCardHighlight}>
            <Text style={styles.summaryLabel}>MAIN BREAKER (OCPD)</Text>
            <Text style={styles.summaryValue}>
              {effectiveMainBreaker}
              <Text style={styles.summaryUnit}> A</Text>
            </Text>
            <Text style={styles.summarySub}>NEC 240.6(A), 215.3</Text>
            {isMainBreakerOverridden && (
              <Text style={styles.overrideBadge}>OVERRIDE (NEC: {result.recommendedMainBreakerAmps}A)</Text>
            )}
          </View>
          <View style={styles.summaryCardHighlight}>
            <Text style={styles.summaryLabel}>SERVICE BUS RATING</Text>
            <Text style={styles.summaryValue}>
              {effectiveBusRating}
              <Text style={styles.summaryUnit}> A</Text>
            </Text>
            <Text style={styles.summarySub}>Commercial equipment</Text>
            {isBusOverridden && (
              <Text style={styles.overrideBadge}>OVERRIDE (NEC: {result.recommendedServiceBusRating}A)</Text>
            )}
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>UTILIZATION</Text>
            <Text
              style={[
                styles.summaryValue,
                {
                  color:
                    utilization > 95 ? '#b91c1c' : utilization > 80 ? '#d97706' : '#15803d',
                },
              ]}
            >
              {fmtPct(utilization)}
              <Text style={styles.summaryUnit}> %</Text>
            </Text>
            <Text style={styles.summarySub}>
              {fmtA(result.calculatedAmps)}A / {effectiveMainBreaker}A
            </Text>
          </View>
        </View>

        {/* Load Breakdown — the itemized table with NEC refs. Connected/Demand totals are in the
            bottom row here; no separate totals cards needed. */}
        <Text style={styles.sectionTitle}>LOAD BREAKDOWN BY CATEGORY</Text>
        <View style={styles.table}>
          {/* Header */}
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, { width: '32%' }]}>Category</Text>
            <Text style={[styles.th, { width: '13%', textAlign: 'right' }]}>Connected (VA)</Text>
            <Text style={[styles.th, { width: '10%', textAlign: 'right' }]}>Demand %</Text>
            <Text style={[styles.th, { width: '13%', textAlign: 'right' }]}>Demand (VA)</Text>
            <Text style={[styles.th, { width: '8%', textAlign: 'center' }]}>Cont.</Text>
            <Text style={[styles.th, { width: '14%', textAlign: 'right' }]}>Sizing (VA)</Text>
            <Text style={[styles.th, { width: '10%' }]}>NEC Ref</Text>
          </View>
          {/* Rows */}
          {result.loadBreakdown.map((item, idx) => (
            <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={[styles.td, { width: '32%' }]}>{item.category}</Text>
              <Text style={[styles.tdNum, { width: '13%' }]}>{fmtVA(item.connectedLoad_VA)}</Text>
              <Text style={[styles.tdNum, { width: '10%' }]}>{item.demandFactor.toFixed(0)}%</Text>
              <Text style={[styles.tdNum, { width: '13%' }]}>{fmtVA(item.demandLoad_VA)}</Text>
              <Text style={[styles.td, { width: '8%', textAlign: 'center' }]}>
                {item.isContinuous ? 'Yes' : '—'}
              </Text>
              <Text style={[styles.tdNum, { width: '14%' }]}>{fmtVA(item.serviceSizingLoad_VA)}</Text>
              <Text style={[styles.td, { width: '10%', fontSize: 7 }]}>{item.necReference}</Text>
            </View>
          ))}
          {/* Total */}
          <View style={styles.tableTotalRow}>
            <Text style={[styles.tdBold, { width: '32%' }]}>TOTAL</Text>
            <Text style={[styles.tdBoldNum, { width: '13%' }]}>{fmtVA(result.totalConnectedLoad_VA)}</Text>
            <Text style={[styles.tdBold, { width: '10%' }]}> </Text>
            <Text style={[styles.tdBoldNum, { width: '13%' }]}>{fmtVA(result.totalDemandLoad_VA)}</Text>
            <Text style={[styles.tdBold, { width: '8%' }]}> </Text>
            <Text style={[styles.tdBoldNum, { width: '14%' }]}>{fmtVA(serviceSizingLoad_VA)}</Text>
            <Text style={[styles.tdBold, { width: '10%' }]}> </Text>
          </View>
        </View>

        {/* Service Sizing Math */}
        <Text style={styles.sectionTitle}>SERVICE SIZING CALCULATION</Text>
        <View style={styles.mathBlock}>
          <Text style={styles.mathLine}>
            Service sizing load (NEC 215.3, 230.42): {fmtVA(serviceSizingLoad_VA)} VA
          </Text>
          <Text style={styles.mathLine}>
            {servicePhase === 3
              ? `I = VA ÷ (V × √3) = ${fmtVA(serviceSizingLoad_VA)} ÷ (${serviceVoltage} × 1.732)`
              : `I = VA ÷ V = ${fmtVA(serviceSizingLoad_VA)} ÷ ${serviceVoltage}`}
          </Text>
          <Text style={styles.mathResult}>
            Calculated current = {fmtA(result.calculatedAmps)} A
          </Text>
          <Text style={[styles.mathLine, { marginTop: 6 }]}>
            Next standard OCPD ≥ {fmtA(result.calculatedAmps)}A (NEC Table 240.6(A)) = {result.recommendedMainBreakerAmps}A
            {isMainBreakerOverridden && `  →  user override: ${effectiveMainBreaker}A`}
          </Text>
          <Text style={styles.mathLine}>
            Next standard bus rating ≥ {effectiveMainBreaker}A = {result.recommendedServiceBusRating}A
            {isBusOverridden && `  →  user override: ${effectiveBusRating}A`}
          </Text>
        </View>

        {/* Input parameters follow the math — inspectors want to verify the inputs
            that produced the numbers above. */}
        <Text style={styles.sectionTitle}>INPUT PARAMETERS</Text>

        {/* Receptacles / Lighting auxiliaries */}
        <Text style={styles.subSectionTitle}>General Receptacles &amp; Special Outlets</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, { width: '55%' }]}>Item</Text>
            <Text style={[styles.th, { width: '25%', textAlign: 'right' }]}>Quantity</Text>
            <Text style={[styles.th, { width: '20%' }]}>NEC Ref</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.td, { width: '55%' }]}>General Receptacles (180 VA each)</Text>
            <Text style={[styles.tdNum, { width: '25%' }]}>{generalReceptacleCount}</Text>
            <Text style={[styles.td, { width: '20%', fontSize: 7 }]}>220.14(I), 220.44</Text>
          </View>
          <View style={styles.tableRowAlt}>
            <Text style={[styles.td, { width: '55%' }]}>Show Window Lighting (200 VA/linear ft)</Text>
            <Text style={[styles.tdNum, { width: '25%' }]}>{showWindowLighting_linearFeet} ft</Text>
            <Text style={[styles.td, { width: '20%', fontSize: 7 }]}>220.14(G)</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.td, { width: '55%' }]}>Sign Outlets (1,200 VA each)</Text>
            <Text style={[styles.tdNum, { width: '25%' }]}>{signOutlets}</Text>
            <Text style={[styles.td, { width: '20%', fontSize: 7 }]}>220.14(F)</Text>
          </View>
        </View>

        {/* HVAC */}
        {hvacLoads.length > 0 && (
          <>
            <Text style={styles.subSectionTitle}>HVAC Equipment (NEC 220.14(C), 440.22)</Text>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.th, { width: '40%' }]}>Description</Text>
                <Text style={[styles.th, { width: '20%', textAlign: 'right' }]}>MCA/FLA (A)</Text>
                <Text style={[styles.th, { width: '15%', textAlign: 'right' }]}>Voltage</Text>
                <Text style={[styles.th, { width: '10%', textAlign: 'center' }]}>Phase</Text>
                <Text style={[styles.th, { width: '15%', textAlign: 'center' }]}>Continuous</Text>
              </View>
              {hvacLoads.map((h, i) => (
                <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={[styles.td, { width: '40%' }]}>{h.description}</Text>
                  <Text style={[styles.tdNum, { width: '20%' }]}>{h.nameplateFLA}</Text>
                  <Text style={[styles.tdNum, { width: '15%' }]}>{h.voltage}V</Text>
                  <Text style={[styles.td, { width: '10%', textAlign: 'center' }]}>{h.phase}Φ</Text>
                  <Text style={[styles.td, { width: '15%', textAlign: 'center' }]}>
                    {h.isContinuous ? 'Yes' : 'No'}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Motors */}
        {motorLoads.length > 0 && (
          <>
            <Text style={styles.subSectionTitle}>Motor Loads (NEC 430.24, Tables 430.248/430.250)</Text>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.th, { width: '40%' }]}>Description</Text>
                <Text style={[styles.th, { width: '15%', textAlign: 'right' }]}>HP</Text>
                <Text style={[styles.th, { width: '15%', textAlign: 'right' }]}>FLA (A)</Text>
                <Text style={[styles.th, { width: '15%', textAlign: 'right' }]}>Voltage</Text>
                <Text style={[styles.th, { width: '15%', textAlign: 'center' }]}>Phase</Text>
              </View>
              {motorLoads.map((m, i) => (
                <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={[styles.td, { width: '40%' }]}>{m.description}</Text>
                  <Text style={[styles.tdNum, { width: '15%' }]}>{m.horsepower}</Text>
                  <Text style={[styles.tdNum, { width: '15%' }]}>{m.fullLoadAmps}</Text>
                  <Text style={[styles.tdNum, { width: '15%' }]}>{m.voltage}V</Text>
                  <Text style={[styles.td, { width: '15%', textAlign: 'center' }]}>{m.phase}Φ</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Kitchen */}
        {kitchenEquipment.length > 0 && (
          <>
            <Text style={styles.subSectionTitle}>Kitchen Equipment (NEC 220.56)</Text>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.th, { width: '70%' }]}>Description</Text>
                <Text style={[styles.th, { width: '30%', textAlign: 'right' }]}>Nameplate (kW)</Text>
              </View>
              {kitchenEquipment.map((k, i) => (
                <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={[styles.td, { width: '70%' }]}>{k.description}</Text>
                  <Text style={[styles.tdNum, { width: '30%' }]}>{k.nameplateRating_kW}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Special loads */}
        {specialLoads.length > 0 && (
          <>
            <Text style={styles.subSectionTitle}>Special Loads</Text>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.th, { width: '55%' }]}>Description</Text>
                <Text style={[styles.th, { width: '25%', textAlign: 'right' }]}>Load (VA)</Text>
                <Text style={[styles.th, { width: '20%', textAlign: 'center' }]}>Continuous</Text>
              </View>
              {specialLoads.map((s, i) => (
                <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={[styles.td, { width: '55%' }]}>{s.description}</Text>
                  <Text style={[styles.tdNum, { width: '25%' }]}>{fmtVA(s.load_VA)}</Text>
                  <Text style={[styles.td, { width: '20%', textAlign: 'center' }]}>
                    {s.isContinuous ? 'Yes' : 'No'}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Warnings */}
        {result.warnings.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>WARNINGS</Text>
            {result.warnings.map((w, i) => (
              <View key={i} style={styles.warningBox}>
                <Text style={styles.warningText}>{w}</Text>
              </View>
            ))}
          </>
        )}

        {/* Notes */}
        {result.notes.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>CALCULATION NOTES</Text>
            {result.notes.map((n, i) => (
              <View key={i} style={styles.noteBox}>
                <Text style={styles.noteText}>{n}</Text>
              </View>
            ))}
          </>
        )}

        {/* Certification signature block — at the end where it belongs in a submittal */}
        <Text style={styles.sectionTitle}>CERTIFICATION</Text>
        <View style={styles.signatureBlock}>
          <View style={styles.sigField}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>Prepared By (Signature)</Text>
          </View>
          <View style={styles.sigField}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>License No.</Text>
          </View>
          <View style={styles.sigField}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>Date</Text>
          </View>
        </View>

        <Footer />
      </Page>
    </Document>
  );
};
