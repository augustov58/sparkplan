/**
 * Commercial Load Calculation PDF Document
 *
 * Three-page submittal-quality report for commercial/industrial load calculations
 * per NEC Article 220 Part III/IV. Matches the visual conventions of other
 * SparkPlan PDF exports (ShortCircuit, MultiFamilyEV, VoltageDrop).
 *
 * Pages:
 *   1. Executive Summary — project info, service sizing, utilization
 *   2. Load Breakdown — itemized table + service sizing math
 *   3. Inputs & Notes — raw inputs (HVAC/Motors/Kitchen/Special) + notes & warnings
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
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

// Register Helvetica for professional typography (matches other PDFs in this codebase)
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'Helvetica' },
    { src: 'Helvetica-Bold', fontWeight: 'bold' },
  ],
});

// ==================== STYLES ====================

// Brand color constants (matches app's Tailwind theme)
const BRAND_YELLOW = '#FFCC00';
const BRAND_DARK = '#2d3b2d';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    paddingBottom: 60, // leave room for footer
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#111827',
  },

  // --- Header band across the top of every page ---
  brandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: BRAND_DARK,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  brandBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandBolt: {
    width: 14,
    height: 14,
    backgroundColor: BRAND_YELLOW,
    marginRight: 6,
  },
  brandName: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
  },
  brandBarRight: {
    color: '#cfd8cf',
    fontSize: 8,
  },

  // --- Document title block ---
  titleBlock: {
    marginBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: BRAND_DARK,
    paddingBottom: 8,
  },
  docTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_DARK,
    marginBottom: 2,
  },
  docSubtitle: {
    fontSize: 10,
    color: '#6b7280',
  },

  // --- Section headers ---
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    backgroundColor: BRAND_DARK,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 14,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  subSectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_DARK,
    marginTop: 8,
    marginBottom: 4,
  },

  // --- Project info grid (3 col) ---
  projectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  projectCell: {
    width: '33.33%',
    paddingVertical: 4,
    paddingRight: 8,
  },
  projectLabel: {
    fontSize: 7,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  projectValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },

  // --- Summary cards ---
  summaryRow: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 10,
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    padding: 10,
  },
  summaryCardHighlight: {
    flex: 1,
    borderWidth: 2,
    borderColor: BRAND_YELLOW,
    borderRadius: 4,
    padding: 10,
    backgroundColor: '#fffbe6',
  },
  summaryLabel: {
    fontSize: 7,
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  summaryValue: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_DARK,
  },
  summaryUnit: {
    fontSize: 10,
    color: '#6b7280',
    marginLeft: 2,
  },
  summarySub: {
    fontSize: 8,
    color: '#6b7280',
    marginTop: 3,
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
    paddingVertical: 4,
  },
  th: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
    padding: 5,
    textAlign: 'left',
  },
  td: {
    fontSize: 8,
    color: '#111827',
    padding: 5,
  },
  tdNum: {
    fontSize: 8,
    color: '#111827',
    padding: 5,
    textAlign: 'right',
  },
  tdBold: {
    fontSize: 9,
    color: '#ffffff',
    padding: 5,
    fontFamily: 'Helvetica-Bold',
  },
  tdBoldNum: {
    fontSize: 9,
    color: '#ffffff',
    padding: 5,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
  },

  // --- Callouts ---
  warningBox: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
    padding: 8,
    marginBottom: 6,
  },
  warningText: {
    fontSize: 9,
    color: '#78350f',
  },
  noteBox: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
    padding: 8,
    marginBottom: 6,
  },
  noteText: {
    fontSize: 9,
    color: '#1e3a8a',
  },

  // --- Signature block ---
  signatureBlock: {
    flexDirection: 'row',
    marginTop: 30,
    gap: 16,
  },
  sigField: {
    flex: 1,
  },
  sigLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#6b7280',
    height: 24,
    marginBottom: 2,
  },
  sigLabel: {
    fontSize: 7,
    color: '#6b7280',
    textTransform: 'uppercase',
  },

  // --- Service-sizing math block ---
  mathBlock: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 10,
    marginTop: 6,
    marginBottom: 6,
  },
  mathLine: {
    fontSize: 9,
    color: '#374151',
    marginBottom: 3,
    fontFamily: 'Helvetica',
  },
  mathResult: {
    fontSize: 10,
    color: BRAND_DARK,
    fontFamily: 'Helvetica-Bold',
    marginTop: 4,
  },

  // --- Footer ---
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#9ca3af',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 6,
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
      {/* ============ PAGE 1 — EXECUTIVE SUMMARY ============ */}
      <Page size="LETTER" style={styles.page}>
        <BrandBar pageLabel="COMMERCIAL LOAD CALCULATION" />

        <View style={styles.titleBlock}>
          <Text style={styles.docTitle}>Commercial Load Calculation Report</Text>
          <Text style={styles.docSubtitle}>
            Per NEC {project.necEdition ?? '2023'} Article 220, Part III &amp; IV — Non-Dwelling Feeder &amp; Service Load
          </Text>
        </View>

        {/* Project Info */}
        <Text style={styles.sectionTitle}>PROJECT INFORMATION</Text>
        <View style={styles.projectGrid}>
          <View style={styles.projectCell}>
            <Text style={styles.projectLabel}>Project Name</Text>
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
            <Text style={styles.projectLabel}>NEC Edition</Text>
            <Text style={styles.projectValue}>NEC {project.necEdition ?? '2023'}</Text>
          </View>
          <View style={styles.projectCell}>
            <Text style={styles.projectLabel}>Lighting Unit Load</Text>
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

        {/* Service Sizing Summary */}
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
              <Text style={styles.overrideBadge}>MANUAL OVERRIDE (NEC auto: {result.recommendedMainBreakerAmps}A)</Text>
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
              <Text style={styles.overrideBadge}>MANUAL OVERRIDE (NEC auto: {result.recommendedServiceBusRating}A)</Text>
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

        {/* Totals */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>CONNECTED LOAD</Text>
            <Text style={styles.summaryValue}>
              {fmtKVA(result.totalConnectedLoad_VA)}
              <Text style={styles.summaryUnit}> kVA</Text>
            </Text>
            <Text style={styles.summarySub}>{fmtVA(result.totalConnectedLoad_VA)} VA</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>DEMAND LOAD</Text>
            <Text style={styles.summaryValue}>
              {fmtKVA(result.totalDemandLoad_VA)}
              <Text style={styles.summaryUnit}> kVA</Text>
            </Text>
            <Text style={styles.summarySub}>{fmtVA(result.totalDemandLoad_VA)} VA</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>CALCULATED CURRENT</Text>
            <Text style={styles.summaryValue}>
              {fmtA(result.calculatedAmps)}
              <Text style={styles.summaryUnit}> A</Text>
            </Text>
            <Text style={styles.summarySub}>
              at {serviceVoltage}V {servicePhase}Φ
            </Text>
          </View>
        </View>

        {/* Signature block */}
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

      {/* ============ PAGE 2 — LOAD BREAKDOWN ============ */}
      <Page size="LETTER" style={styles.page}>
        <BrandBar pageLabel="LOAD BREAKDOWN" />

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

        <Footer />
      </Page>

      {/* ============ PAGE 3 — INPUTS, NOTES, WARNINGS ============ */}
      <Page size="LETTER" style={styles.page}>
        <BrandBar pageLabel="INPUTS &amp; NOTES" />

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

        <Footer />
      </Page>
    </Document>
  );
};
