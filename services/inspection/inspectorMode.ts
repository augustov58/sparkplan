/**
 * Inspector Mode - Pre-Inspection AI Audit Service
 * 
 * NEC Compliance Validation Engine
 * Performs automated code compliance checks before inspector review
 * 
 * @module services/inspection/inspectorMode
 * 
 * Key NEC Articles Covered:
 * - NEC 110.3(B) - Equipment used per its listing (panel slot capacity)
 * - NEC 210 - Branch Circuits (loading, 3-pole-in-1-phase)
 * - NEC 215 - Feeders
 * - NEC 220 - Branch-Circuit, Feeder, and Service Load Calculations
 * - NEC 250 - Grounding and Bonding
 * - NEC 408 - Switchboards, Switchgear, and Panelboards
 *
 * NOTE: SparkPlan does not size individual branch-circuit conductors
 * (we size feeders only). Branch-circuit NEC 240.4(D) auditing is
 * intentionally NOT performed here — it is enforced where it belongs,
 * inside the feeder/conductor sizing tools (services/calculations/conductorSizing.ts).
 */

import type { Database } from '@/lib/database.types';
import { isEVEMSMarkerCircuit } from '@/services/calculations/upstreamLoadAggregation';
import { feederBreakerAmps, feederBreakerReasons, feederDesignCurrentA } from '@/services/feeder/feederBreaker';

type Panel = Database['public']['Tables']['panels']['Row'];
type Circuit = Database['public']['Tables']['circuits']['Row'];
type Feeder = Database['public']['Tables']['feeders']['Row'];
type Transformer = Database['public']['Tables']['transformers']['Row'];

// ============================================================================
// TYPES
// ============================================================================

export type IssueSeverity = 'critical' | 'warning' | 'info';
export type IssueCategory = 
  | 'panel' 
  | 'circuit' 
  | 'feeder' 
  | 'grounding' 
  | 'service' 
  | 'conductor'
  | 'protection';

export interface InspectionIssue {
  id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  necArticle: string;
  title: string;
  description: string;
  location: string; // Panel name, circuit number, etc.
  currentValue?: string | number;
  requiredValue?: string | number;
  recommendation: string;
  autoFixable: boolean;
}

export interface InspectionCheck {
  id: string;
  category: IssueCategory;
  necArticle: string;
  description: string;
  passed: boolean;
  details?: string;
}

export interface InspectionResult {
  timestamp: Date;
  projectId: string;
  summary: {
    totalChecks: number;
    passed: number;
    warnings: number;
    critical: number;
    score: number; // 0-100
  };
  issues: InspectionIssue[];
  passedChecks: InspectionCheck[];
  necArticlesReferenced: string[];
}

export interface ProjectInspectionData {
  projectId: string;
  projectType: 'Residential' | 'Commercial' | 'Industrial';
  serviceVoltage: number;
  servicePhase: 1 | 3;
  panels: Panel[];
  circuits: Circuit[];
  feeders: Feeder[];
  transformers: Transformer[];
  grounding?: {
    electrodes: string[];
    gecSize: string;
    bonding: string[];
  };
  /**
   * The service check from the panel schedule (`lib/storedCalcs.ts::
   * scheduleServiceCheck`, #193): Article 220 load + 25% of continuous loads
   * vs the service rating. No check is reported without it.
   */
  /**
   * Each panel's design load in amps, for the 408.30 bus check (#225): the
   * Feeder Manager's `feederDesignLoadVA` in the panel's own phase; the MDP's
   * is the service check. Missing → the panel's own connected load.
   */
  panelDesignAmps?: Record<string, number>;
  serviceCheck?: {
    loadKVA: number;
    adderKVA: number;
    checkAmps: number;
    serviceAmps: number;
    utilizationPct: number;
  } | null;
}

// ============================================================================
// CONSTANTS - NEC TABLES
// ============================================================================

/**
 * NEC Table 250.122 - EGC Sizing
 * Minimum size equipment grounding conductor
 */
const EGC_SIZING_TABLE: Array<{ maxOCPD: number; cuSize: string; alSize: string }> = [
  { maxOCPD: 15, cuSize: '14 AWG', alSize: '12 AWG' },
  { maxOCPD: 20, cuSize: '12 AWG', alSize: '10 AWG' },
  { maxOCPD: 30, cuSize: '10 AWG', alSize: '8 AWG' },
  { maxOCPD: 40, cuSize: '10 AWG', alSize: '8 AWG' },
  { maxOCPD: 60, cuSize: '10 AWG', alSize: '8 AWG' },
  { maxOCPD: 100, cuSize: '8 AWG', alSize: '6 AWG' },
  { maxOCPD: 200, cuSize: '6 AWG', alSize: '4 AWG' },
  { maxOCPD: 300, cuSize: '4 AWG', alSize: '2 AWG' },
  { maxOCPD: 400, cuSize: '3 AWG', alSize: '1 AWG' },
  { maxOCPD: 500, cuSize: '2 AWG', alSize: '1/0 AWG' },
  { maxOCPD: 600, cuSize: '1 AWG', alSize: '2/0 AWG' },
  { maxOCPD: 800, cuSize: '1/0 AWG', alSize: '3/0 AWG' },
  { maxOCPD: 1000, cuSize: '2/0 AWG', alSize: '4/0 AWG' },
  { maxOCPD: 1200, cuSize: '3/0 AWG', alSize: '250 kcmil' },
  { maxOCPD: 1600, cuSize: '4/0 AWG', alSize: '350 kcmil' },
  { maxOCPD: 2000, cuSize: '250 kcmil', alSize: '400 kcmil' },
];

/**
 * AWG to circular mils for comparison
 */
const AWG_TO_CMILS: Record<string, number> = {
  '14 AWG': 4110,
  '12 AWG': 6530,
  '10 AWG': 10380,
  '8 AWG': 16510,
  '6 AWG': 26240,
  '4 AWG': 41740,
  '3 AWG': 52620,
  '2 AWG': 66360,
  '1 AWG': 83690,
  '1/0 AWG': 105600,
  '2/0 AWG': 133100,
  '3/0 AWG': 167800,
  '4/0 AWG': 211600,
  '250 kcmil': 250000,
  '300 kcmil': 300000,
  '350 kcmil': 350000,
  '400 kcmil': 400000,
  '500 kcmil': 500000,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateId(): string {
  return `issue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Compare wire sizes - returns true if actual is >= required
 */
function isWireSizeAdequate(actual: string, required: string): boolean {
  const actualCmils = AWG_TO_CMILS[actual] || 0;
  const requiredCmils = AWG_TO_CMILS[required] || 0;
  return actualCmils >= requiredCmils;
}

/**
 * Get required EGC size per NEC 250.122
 */
function getRequiredEgcSize(ocpdAmps: number, material: 'Cu' | 'Al' = 'Cu'): string {
  for (const row of EGC_SIZING_TABLE) {
    if (ocpdAmps <= row.maxOCPD) {
      return material === 'Cu' ? row.cuSize : row.alSize;
    }
  }
  return material === 'Cu' ? '250 kcmil' : '400 kcmil';
}

/**
 * Calculate total load on a panel from circuits
 */
function calculatePanelLoad(panelId: string, circuits: Circuit[]): number {
  // EVEMS marker circuits are metadata, not load (#156).
  return circuits
    .filter(c => c.panel_id === panelId && !isEVEMSMarkerCircuit(c))
    .reduce((sum, c) => sum + (c.load_watts || 0), 0);
}

/**
 * Count total poles used in a panel
 */
function countPanelPoles(panelId: string, circuits: Circuit[]): number {
  return circuits
    .filter(c => c.panel_id === panelId)
    .reduce((sum, c) => sum + (c.pole || 1), 0);
}

// ============================================================================
// VALIDATION RULES
// ============================================================================

/**
 * Panel Slot Capacity Check (NEC 110.3(B))
 *
 * Modern panelboards must be used within the slot count they are listed for.
 * (NEC 408.36's hard 42-OCPD cap was deleted in NEC 2008 — the limit is now
 * the panel's UL listing, captured per-panel in `panels.num_spaces`.)
 *
 * Fallback mirrors the legacy default used in PanelSchedule.tsx and
 * OneLineDiagram.tsx for any panel row that predates the column.
 */
function checkPanelMaxPoles(panel: Panel, circuits: Circuit[]): InspectionIssue | null {
  const polesUsed = countPanelPoles(panel.id, circuits);
  const slotCapacity = panel.num_spaces ?? (panel.is_main ? 30 : 42);

  if (polesUsed > slotCapacity) {
    return {
      id: generateId(),
      category: 'panel',
      severity: 'critical',
      necArticle: 'NEC 110.3(B)',
      title: 'Panel Exceeds Listed Slot Capacity',
      description: `Panel ${panel.name} has ${polesUsed} poles installed in a ${slotCapacity}-space enclosure. Equipment must be used within its listed capacity per NEC 110.3(B).`,
      location: panel.name,
      currentValue: `${polesUsed} poles`,
      requiredValue: `≤ ${slotCapacity} poles`,
      recommendation: `Remove circuits or upgrade to a larger panel. Consider redistributing loads to a sub-panel.`,
      autoFixable: false,
    };
  }

  // Warning if approaching limit
  if (polesUsed > slotCapacity * 0.9) {
    return {
      id: generateId(),
      category: 'panel',
      severity: 'warning',
      necArticle: 'NEC 110.3(B)',
      title: 'Panel Near Slot Capacity',
      description: `Panel ${panel.name} is using ${polesUsed} of ${slotCapacity} available slots (${Math.round((polesUsed / slotCapacity) * 100)}%).`,
      location: panel.name,
      currentValue: `${polesUsed} poles`,
      requiredValue: `≤ ${slotCapacity} poles`,
      recommendation: `Plan for future expansion. Consider upgrading panel if additional circuits are anticipated.`,
      autoFixable: false,
    };
  }

  return null;
}

/** " (58 A of 200 A)" for a passed bus check, so the pass states its numbers (#225). */
function busLoadingDetail(panel: Panel, circuits: Circuit[], designAmps: number | undefined): string {
  if (!panel.bus_rating || panel.bus_rating <= 0) return '';
  const divisor = panel.voltage * (panel.phase === 3 ? Math.sqrt(3) : 1);
  const amps = designAmps ?? calculatePanelLoad(panel.id, circuits) / divisor;
  return ` (${Math.round(amps)} A of ${panel.bus_rating} A)`;
}

/**
 * Panel Bus Rating vs Load Check — NEC 408.30: the panelboard rating is not
 * less than the minimum feeder capacity required for the Article 220 load
 * (#225). That capacity is the panel's design load: demand + 25% of its
 * continuous loads (215.2(A)(1), the Feeder Manager's `feederDesignLoadVA`,
 * #190); for the MDP, the service check (#193). The caller passes it per
 * panel in amps (`ProjectInspectionData.panelDesignAmps`). Without it the
 * check falls back to the panel's own connected load, in its own phase.
 */
function checkPanelBusLoading(
  panel: Panel,
  circuits: Circuit[],
  designAmps: number | undefined,
): InspectionIssue | null {
  const busAmps = panel.bus_rating;
  if (!busAmps || busAmps <= 0) return null;
  const divisor = panel.voltage * (panel.phase === 3 ? Math.sqrt(3) : 1);
  const loadAmps = designAmps ?? calculatePanelLoad(panel.id, circuits) / divisor;
  const utilizationPercent = (loadAmps / busAmps) * 100;
  const basis = designAmps !== undefined
    ? (panel.is_main
      ? 'the service check (NEC 220 load + 25% of continuous loads)'
      : 'its design load (NEC 220 demand + 25% of continuous loads, 215.2(A)(1))')
    : 'its connected load';

  // Critical if > 100%
  if (utilizationPercent > 100) {
    return {
      id: generateId(),
      category: 'panel',
      severity: 'critical',
      necArticle: 'NEC 408.30',
      title: 'Panel Overloaded Beyond Bus Rating',
      description: `Panel ${panel.name}: ${Math.round(loadAmps)} A (${basis}) exceeds its ${busAmps} A bus rating (${Math.round(utilizationPercent)}%).`,
      location: panel.name,
      currentValue: `${Math.round(loadAmps)} A`,
      requiredValue: `≤ ${busAmps} A`,
      recommendation: `Upgrade panel bus rating or redistribute loads to additional panels.`,
      autoFixable: false,
    };
  }

  // Warning if > 80%
  if (utilizationPercent > 80) {
    return {
      id: generateId(),
      category: 'panel',
      severity: 'warning',
      necArticle: 'NEC 408.30',
      title: 'Panel High Utilization',
      description: `Panel ${panel.name} is at ${Math.round(utilizationPercent)}% of its ${busAmps} A bus (${Math.round(loadAmps)} A, ${basis}). Best practice is to keep utilization below 80%.`,
      location: panel.name,
      currentValue: `${Math.round(utilizationPercent)}%`,
      requiredValue: '≤ 80% (design margin, advisory)',
      recommendation: `Consider load balancing or future panel upgrade for expansion capacity.`,
      autoFixable: false,
    };
  }

  return null;
}

/**
 * NEC 250.122 - EGC Sizing
 * Equipment grounding conductor must be sized per OCPD
 */
function checkEgcSizing(circuit: Circuit, panelName: string): InspectionIssue | null {
  if (!circuit.egc_size) {
    return {
      id: generateId(),
      category: 'grounding',
      severity: 'warning',
      necArticle: 'NEC 250.122',
      title: 'EGC Size Not Specified',
      description: `Circuit ${circuit.circuit_number} (${circuit.description}) does not have an equipment grounding conductor size specified.`,
      location: `${panelName}, Circuit ${circuit.circuit_number}`,
      recommendation: `Specify EGC size per NEC Table 250.122 based on ${circuit.breaker_amps}A OCPD.`,
      autoFixable: true,
    };
  }
  
  const requiredEgc = getRequiredEgcSize(circuit.breaker_amps);
  if (!isWireSizeAdequate(circuit.egc_size, requiredEgc)) {
    return {
      id: generateId(),
      category: 'grounding',
      severity: 'critical',
      necArticle: 'NEC 250.122',
      title: 'EGC Undersized',
      description: `Circuit ${circuit.circuit_number} (${circuit.description}) has ${circuit.egc_size} EGC but requires minimum ${requiredEgc} per Table 250.122 for ${circuit.breaker_amps}A OCPD.`,
      location: `${panelName}, Circuit ${circuit.circuit_number}`,
      currentValue: circuit.egc_size,
      requiredValue: requiredEgc,
      recommendation: `Upsize EGC to at least ${requiredEgc} Cu.`,
      autoFixable: true,
    };
  }
  
  return null;
}

/**
 * NEC 210.20(A) - Branch Circuit Overcurrent Protection vs Load
 *
 * SparkPlan does not size individual branch-circuit conductors, but it DOES
 * audit that the user's chosen breaker amps can handle the user's chosen
 * load_watts at the appropriate circuit voltage. The voltage seen by the
 * circuit depends on pole count and panel phase:
 *   - 1-pole on a 1Φ panel:        line-to-neutral (e.g., 120V from 120/240V)
 *   - 2-pole on a 1Φ panel:        line-to-line   (e.g., 240V from 120/240V)
 *   - 1-pole on a 3Φ panel:        line-to-neutral (e.g., 120V from 208Y/120, 277V from 480Y/277)
 *   - 2-pole on a 3Φ panel:        line-to-line   (e.g., 208V from 208Y/120, 480V from 480Y/277)
 *   - 3-pole on a 3Φ panel:        full 3-phase capacity = breaker × VLL × √3
 *
 * Severity:
 *   - critical: load exceeds breaker capacity outright (breaker would trip).
 *   - warning:  load exceeds 80% of breaker (NEC 210.20(A) continuous-load rule:
 *               OCPD must be ≥ 125% × continuous load, i.e. continuous load ≤ 80%).
 */
function checkCircuitLoading(circuit: Circuit, panel: Panel): InspectionIssue | null {
  const loadVA = circuit.load_watts ?? 0;
  const breakerAmps = circuit.breaker_amps ?? 0;
  if (loadVA <= 0 || breakerAmps <= 0) return null;

  const lineToLine = panel.voltage;
  const lineToNeutral =
    panel.phase === 3
      ? lineToLine / Math.sqrt(3)
      : lineToLine === 120
      ? 120 // 120V-only panel (no neutral split)
      : lineToLine / 2; // 120/240V split-phase

  let circuitVoltage: number;
  let breakerVA: number;
  if (circuit.pole === 1) {
    circuitVoltage = lineToNeutral;
    breakerVA = breakerAmps * lineToNeutral;
  } else if (circuit.pole === 2) {
    circuitVoltage = lineToLine;
    breakerVA = breakerAmps * lineToLine;
  } else {
    // 3-pole 3-phase
    circuitVoltage = lineToLine;
    breakerVA = breakerAmps * lineToLine * Math.sqrt(3);
  }

  const utilizationPct = (loadVA / breakerVA) * 100;
  const desc = circuit.description || `Circuit ${circuit.circuit_number}`;
  const location = `${panel.name}, Circuit ${circuit.circuit_number}`;

  if (utilizationPct > 100) {
    return {
      id: generateId(),
      category: 'protection',
      severity: 'critical',
      necArticle: 'NEC 210.20(A)',
      title: 'Circuit Overloaded — Breaker Undersized',
      description: `Circuit ${circuit.circuit_number} (${desc}) carries ${loadVA} VA on a ${breakerAmps}A / ${Math.round(circuitVoltage)}V ${circuit.pole}-pole breaker (capacity ${Math.round(breakerVA)} VA, ${Math.round(utilizationPct)}% utilized). Load exceeds breaker rating.`,
      location,
      currentValue: `${loadVA} VA on ${breakerAmps}A`,
      requiredValue: `≤ ${Math.round(breakerVA)} VA (or upsize breaker)`,
      recommendation: `Upsize the breaker to handle the load, or split the load across multiple circuits.`,
      autoFixable: false,
    };
  }

  if (utilizationPct > 80) {
    return {
      id: generateId(),
      category: 'protection',
      severity: 'warning',
      necArticle: 'NEC 210.20(A)',
      title: 'Circuit Loading Exceeds 80% of Breaker',
      description: `Circuit ${circuit.circuit_number} (${desc}) is at ${Math.round(utilizationPct)}% of the ${breakerAmps}A / ${Math.round(circuitVoltage)}V breaker. NEC 210.20(A) requires OCPD ≥ 125% of continuous load (i.e., continuous load ≤ 80%).`,
      location,
      currentValue: `${Math.round(utilizationPct)}%`,
      requiredValue: '≤ 80%',
      recommendation: `If this load is continuous (3+ hours), upsize the breaker so the load is ≤ 80% of its rating.`,
      autoFixable: false,
    };
  }

  return null;
}

/**
 * Phase Balance Check
 * Three-phase panels should be reasonably balanced
 */
function checkPhaseBalance(panel: Panel, circuits: Circuit[]): InspectionIssue | null {
  if (panel.phase !== 3) return null;
  
  const panelCircuits = circuits.filter(c => c.panel_id === panel.id);
  if (panelCircuits.length < 3) return null;
  
  // Calculate load per phase
  const phaseLoads = { A: 0, B: 0, C: 0 };
  
  panelCircuits.forEach((circuit, idx) => {
    const circuitNum = circuit.circuit_number;
    const row = Math.ceil(circuitNum / 2);
    const phaseIndex = (row - 1) % 3;
    const phase = ['A', 'B', 'C'][phaseIndex] as 'A' | 'B' | 'C';
    
    if (circuit.pole === 1) {
      phaseLoads[phase] += circuit.load_watts;
    } else if (circuit.pole === 2) {
      // 2-pole spans two phases
      phaseLoads[phase] += circuit.load_watts / 2;
      const nextPhase = phase === 'A' ? 'B' : phase === 'B' ? 'C' : 'A';
      phaseLoads[nextPhase] += circuit.load_watts / 2;
    } else {
      // 3-pole across all phases
      phaseLoads['A'] += circuit.load_watts / 3;
      phaseLoads['B'] += circuit.load_watts / 3;
      phaseLoads['C'] += circuit.load_watts / 3;
    }
  });
  
  const values = Object.values(phaseLoads);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const avg = values.reduce((a, b) => a + b, 0) / 3;
  
  if (avg === 0) return null;
  
  const imbalancePercent = ((max - min) / avg) * 100;
  
  if (imbalancePercent > 20) {
    return {
      id: generateId(),
      category: 'panel',
      severity: 'warning',
      necArticle: 'NEC 220.61',
      title: 'Phase Imbalance Detected',
      description: `Panel ${panel.name} has ${Math.round(imbalancePercent)}% phase imbalance. Phase A: ${Math.round(phaseLoads.A / 1000)}kW, B: ${Math.round(phaseLoads.B / 1000)}kW, C: ${Math.round(phaseLoads.C / 1000)}kW.`,
      location: panel.name,
      currentValue: `${Math.round(imbalancePercent)}%`,
      requiredValue: '≤ 20%',
      recommendation: `Redistribute loads to balance phases. Move some loads from phase ${values.indexOf(max) === 0 ? 'A' : values.indexOf(max) === 1 ? 'B' : 'C'} to phase ${values.indexOf(min) === 0 ? 'A' : values.indexOf(min) === 1 ? 'B' : 'C'}.`,
      autoFixable: false,
    };
  }
  
  return null;
}

/**
 * Feeder Voltage Drop Check
 * NEC recommends ≤3% voltage drop for feeders
 */
function checkFeederVoltageDrop(feeder: Feeder, panels: Panel[]): InspectionIssue | null {
  if (!feeder.voltage_drop_percent) return null;
  
  const sourcePanel = panels.find(p => p.id === feeder.source_panel_id);
  const destPanel = panels.find(p => p.id === feeder.destination_panel_id);
  
  const location = `${sourcePanel?.name || 'Source'} → ${destPanel?.name || 'Destination'}`;
  
  if (feeder.voltage_drop_percent > 3) {
    const severity = feeder.voltage_drop_percent > 5 ? 'critical' : 'warning';
    return {
      id: generateId(),
      category: 'feeder',
      severity,
      necArticle: 'NEC 210.19(A) Informational Note No. 4',
      title: 'Feeder Voltage Drop Exceeds Recommendation',
      description: `Feeder "${feeder.name}" has ${feeder.voltage_drop_percent.toFixed(1)}% voltage drop. NEC recommends maximum 3% for feeders (5% total branch + feeder).`,
      location,
      currentValue: `${feeder.voltage_drop_percent.toFixed(1)}%`,
      requiredValue: '≤ 3%',
      recommendation: `Upsize feeder conductors from ${feeder.phase_conductor_size} to reduce voltage drop, or reduce feeder length if possible.`,
      autoFixable: false,
    };
  }
  
  return null;
}

/**
 * Feeder EGC Sizing Check
 * Per NEC 250.122
 */
function checkFeederEgc(feeder: Feeder, panels: Panel[]): InspectionIssue | null {
  const destPanel = panels.find(p => p.id === feeder.destination_panel_id);
  if (!destPanel) return null;
  
  // #283: the feeder's own breaker (one helper for every reader)
  const ocpdAmps = feederBreakerAmps({ panel: destPanel, feeder }) ?? destPanel.bus_rating;
  const requiredEgc = getRequiredEgcSize(ocpdAmps, feeder.conductor_material as 'Cu' | 'Al');
  
  if (!feeder.egc_size) {
    return {
      id: generateId(),
      category: 'grounding',
      severity: 'warning',
      necArticle: 'NEC 250.122',
      title: 'Feeder EGC Size Not Specified',
      description: `Feeder "${feeder.name}" does not have an EGC size specified.`,
      location: feeder.name,
      recommendation: `Specify EGC size of at least ${requiredEgc} per Table 250.122.`,
      autoFixable: true,
    };
  }
  
  if (!isWireSizeAdequate(feeder.egc_size, requiredEgc)) {
    return {
      id: generateId(),
      category: 'grounding',
      severity: 'critical',
      necArticle: 'NEC 250.122',
      title: 'Feeder EGC Undersized',
      description: `Feeder "${feeder.name}" has ${feeder.egc_size} EGC but requires ${requiredEgc} minimum per Table 250.122 for ${ocpdAmps}A OCPD.`,
      location: feeder.name,
      currentValue: feeder.egc_size,
      requiredValue: requiredEgc,
      recommendation: `Upsize EGC to at least ${requiredEgc}.`,
      autoFixable: true,
    };
  }
  
  return null;
}

/**
 * Feeder conductor protection (#283): the phase conductors must be protected by
 * the feeder's breaker (NEC 240.4, incl. (B)) and carry the design current.
 */
function checkFeederProtection(feeder: Feeder, panels: Panel[]): InspectionIssue | null {
  const destPanel = panels.find(p => p.id === feeder.destination_panel_id);
  if (!destPanel || !feeder.phase_conductor_size) return null;
  const breakerAmps = feederBreakerAmps({ panel: destPanel, feeder });
  const designA = feederDesignCurrentA(feeder.design_load_va ?? 0, destPanel);
  const reasons = feederBreakerReasons(feeder, breakerAmps, designA);
  if (reasons.length === 0) return null;
  // Two defects, two rules: a breaker smaller than the design load is NEC
  // 215.3 (rating ≥ non-continuous + 125 % continuous); a conductor the
  // breaker doesn't protect is NEC 240.4.
  const unprotected = reasons.some(r => r.includes('is not protected'));
  return {
    id: generateId(),
    category: 'feeder',
    severity: 'critical',
    necArticle: unprotected ? 'NEC 240.4' : 'NEC 215.3',
    title: unprotected ? 'Feeder Conductor Not Protected by Its Breaker' : 'Feeder Breaker Smaller Than Its Design Load',
    description: `Feeder "${feeder.name}": ${reasons.join('; ')}.`,
    location: feeder.name,
    currentValue: `${feeder.phase_conductor_size} on ${breakerAmps} A; design ${designA.toFixed(1)} A`,
    requiredValue: unprotected
      ? 'Conductor protected by the feeder breaker (240.4)'
      : 'Breaker at least the design current (215.3)',
    recommendation: 'Recalculate the feeder in Feeder Sizing, or change its breaker.',
    autoFixable: false,
  };
}

/**
 * Main Panel Grounding Check
 * Service entrance requires proper grounding electrode system
 */
function checkMainPanelGrounding(
  panel: Panel,
  grounding?: { electrodes: string[]; gecSize: string; bonding: string[] }
): InspectionIssue[] {
  const issues: InspectionIssue[] = [];
  
  if (!panel.is_main) return issues;
  
  if (!grounding || grounding.electrodes.length === 0) {
    issues.push({
      id: generateId(),
      category: 'grounding',
      severity: 'critical',
      necArticle: 'NEC 250.50',
      title: 'No Grounding Electrodes Specified',
      description: `Main panel ${panel.name} does not have any grounding electrodes specified. NEC 250.50 requires grounding electrode system at service entrance.`,
      location: panel.name,
      recommendation: `Specify grounding electrodes (e.g., ground rods, concrete-encased electrode, water pipe).`,
      autoFixable: false,
    });
  }
  
  if (!grounding?.gecSize) {
    issues.push({
      id: generateId(),
      category: 'grounding',
      severity: 'critical',
      necArticle: 'NEC 250.66',
      title: 'GEC Size Not Specified',
      description: `Main panel ${panel.name} does not have a Grounding Electrode Conductor (GEC) size specified.`,
      location: panel.name,
      recommendation: `Specify GEC size per NEC Table 250.66 based on service conductor size.`,
      autoFixable: false,
    });
  }
  
  // Check for required bonding - "Interior Water Piping" is the actual value stored
  if (!grounding?.bonding || !grounding.bonding.includes('Interior Water Piping')) {
    issues.push({
      id: generateId(),
      category: 'grounding',
      severity: 'warning',
      necArticle: 'NEC 250.104(A)',
      title: 'Metal Water Pipe Bonding Not Specified',
      description: `Bonding of metal water piping system is required per NEC 250.104(A) if present in structure.`,
      location: panel.name,
      recommendation: `If metal water piping is present, ensure it is bonded to the grounding electrode system. Check the "Interior Water Piping" option in Grounding & Bonding.`,
      autoFixable: false,
    });
  }
  
  return issues;
}

/**
 * Service Capacity Check
 * Ensure service is sized for total demand load
 */
function checkServiceCapacity(
  data: ProjectInspectionData
): InspectionIssue | null {
  // #193: the shared service check (the one E-102 and the Service Upgrade
  // Wizard use), not a connected-load × 0.8 estimate of its own
  const mainPanel = data.panels.find(p => p.is_main);
  const check = data.serviceCheck;
  if (!mainPanel || !check || check.serviceAmps <= 0) return null;

  const amps = Math.round(check.checkAmps);
  const utilization = Math.round(check.utilizationPct);
  // The 9.0 kVA is the adder, not the continuous loads themselves
  const basis = `the NEC 220 load of ${check.loadKVA.toFixed(1)} kVA plus ${check.adderKVA.toFixed(1)} kVA, 25% of the continuous loads`;

  if (check.checkAmps > check.serviceAmps) {
    return {
      id: generateId(),
      category: 'service',
      severity: 'critical',
      necArticle: 'NEC 230.42(A)(1)',
      title: 'Service Undersized for Load',
      description: `Service check of ${amps} A (${basis}) exceeds the ${check.serviceAmps} A service.`,
      location: mainPanel.name,
      currentValue: `${amps} A`,
      requiredValue: `≤ ${check.serviceAmps} A`,
      recommendation: `Upgrade the service, add load management (EVEMS, NEC 625.42) or reduce the new loads. The Service Upgrade Wizard and E-102 show the same check.`,
      autoFixable: false,
    };
  }

  if (utilization > 80) {
    return {
      id: generateId(),
      category: 'service',
      severity: 'warning',
      necArticle: 'NEC 230.42(A)(1)',
      title: 'Service Nearing Capacity',
      description: `Service check of ${amps} A (${basis}) is ${utilization}% of the ${check.serviceAmps} A service. Consider future expansion needs.`,
      location: mainPanel.name,
      currentValue: `${utilization}%`,
      requiredValue: '≤ 80% (design margin, advisory)',
      recommendation: `Plan for service upgrade if additional loads are anticipated.`,
      autoFixable: false,
    };
  }

  return null;
}

/**
 * Sub-Panel Missing Feeder Check
 * Sub-panels (non-main panels) should have a feeder defined
 */
function checkSubPanelFeeder(panel: Panel, feeders: Feeder[]): InspectionIssue | null {
  // Main panel doesn't need an incoming feeder
  if (panel.is_main) return null;

  // Check if any feeder has this panel as destination
  const hasFeeder = feeders.some(f => f.destination_panel_id === panel.id);

  if (!hasFeeder) {
    return {
      id: generateId(),
      category: 'feeder',
      severity: 'warning',
      necArticle: 'NEC 215.2',
      title: 'Sub-Panel Missing Feeder Definition',
      description: `Sub-panel "${panel.name}" does not have a feeder defined. Feeders must be properly sized per NEC 215.2.`,
      location: panel.name,
      recommendation: `Define a feeder from the source panel to "${panel.name}" in the Feeder Management section. Include conductor size, length, and EGC.`,
      autoFixable: false,
    };
  }

  return null;
}

/**
 * Residential 3-Pole Circuit Check
 * Single-phase panels cannot have 3-pole circuits
 */
function checkResidential3PoleCircuits(panel: Panel, circuits: Circuit[]): InspectionIssue | null {
  if (panel.phase !== 1) return null;
  
  const threePoleCircuits = circuits.filter(
    c => c.panel_id === panel.id && c.pole === 3
  );
  
  if (threePoleCircuits.length > 0) {
    return {
      id: generateId(),
      category: 'circuit',
      severity: 'critical',
      necArticle: 'NEC 210.4',
      title: 'Invalid 3-Pole Circuit in Single-Phase Panel',
      description: `Panel ${panel.name} is single-phase (${panel.voltage}V 1Φ) but contains ${threePoleCircuits.length} three-pole circuit(s). Three-pole circuits require three-phase power.`,
      location: panel.name,
      currentValue: `${threePoleCircuits.length} x 3-pole circuits`,
      requiredValue: '0 x 3-pole circuits',
      recommendation: `Remove 3-pole circuits or replace with 2-pole circuits for 240V loads in single-phase systems.`,
      autoFixable: false,
    };
  }
  
  return null;
}

// ============================================================================
// MAIN INSPECTION FUNCTION
// ============================================================================

/**
 * Run complete NEC compliance inspection on project data
 */
export function runInspection(data: ProjectInspectionData): InspectionResult {
  const issues: InspectionIssue[] = [];
  const passedChecks: InspectionCheck[] = [];
  const necArticlesReferenced = new Set<string>();
  
  // ============================================================
  // PANEL CHECKS
  // ============================================================
  
  data.panels.forEach(panel => {
    // NEC 110.3(B) - Panel slot capacity (per UL listing / panels.num_spaces)
    const maxPolesIssue = checkPanelMaxPoles(panel, data.circuits);
    if (maxPolesIssue) {
      issues.push(maxPolesIssue);
      necArticlesReferenced.add('NEC 110.3(B)');
    } else {
      const slotCapacity = panel.num_spaces ?? (panel.is_main ? 30 : 42);
      const polesUsed = countPanelPoles(panel.id, data.circuits);
      passedChecks.push({
        id: generateId(),
        category: 'panel',
        necArticle: 'NEC 110.3(B)',
        description: `Panel ${panel.name}: ${polesUsed} of ${slotCapacity} slots used (within listed capacity)`,
        passed: true,
      });
      necArticlesReferenced.add('NEC 110.3(B)');
    }
    
    // Bus loading check
    const busLoadingIssue = checkPanelBusLoading(panel, data.circuits, data.panelDesignAmps?.[panel.id]);
    if (busLoadingIssue) {
      issues.push(busLoadingIssue);
      necArticlesReferenced.add('NEC 408.30');
    } else {
      passedChecks.push({
        id: generateId(),
        category: 'panel',
        necArticle: 'NEC 408.30',
        description: `Panel ${panel.name}: Bus loading acceptable${busLoadingDetail(panel, data.circuits, data.panelDesignAmps?.[panel.id])}`,
        passed: true,
      });
    }
    
    // Phase balance (3-phase only)
    const phaseBalanceIssue = checkPhaseBalance(panel, data.circuits);
    if (phaseBalanceIssue) {
      issues.push(phaseBalanceIssue);
      necArticlesReferenced.add('NEC 220.61');
    } else if (panel.phase === 3) {
      passedChecks.push({
        id: generateId(),
        category: 'panel',
        necArticle: 'NEC 220.61',
        description: `Panel ${panel.name}: Phase balance acceptable`,
        passed: true,
      });
    }
    
    // Residential 3-pole check
    const threePoleIssue = checkResidential3PoleCircuits(panel, data.circuits);
    if (threePoleIssue) {
      issues.push(threePoleIssue);
      necArticlesReferenced.add('NEC 210.4');
    }

    // Sub-panel feeder check
    const feederIssue = checkSubPanelFeeder(panel, data.feeders);
    if (feederIssue) {
      issues.push(feederIssue);
      necArticlesReferenced.add('NEC 215.2');
    } else if (!panel.is_main) {
      // Sub-panel has a feeder defined
      passedChecks.push({
        id: generateId(),
        category: 'feeder',
        necArticle: 'NEC 215.2',
        description: `Sub-panel ${panel.name}: Feeder defined`,
        passed: true,
      });
    }

    // Main panel grounding
    if (panel.is_main) {
      const groundingIssues = checkMainPanelGrounding(panel, data.grounding);
      issues.push(...groundingIssues);
      if (groundingIssues.length === 0 && data.grounding) {
        passedChecks.push({
          id: generateId(),
          category: 'grounding',
          necArticle: 'NEC 250.50',
          description: `${panel.name}: Grounding electrode system specified`,
          passed: true,
        });
      }
      necArticlesReferenced.add('NEC 250.50');
      necArticlesReferenced.add('NEC 250.66');
    }
  });
  
  // ============================================================
  // CIRCUIT CHECKS
  // ============================================================
  
  // NOTE: SparkPlan does not size individual branch-circuit conductors —
  // we only size feeders. So branch-circuit conductor sizing (NEC 240.4(D))
  // and branch-circuit EGC sizing (NEC 250.122) are intentionally NOT audited
  // here. Both rules are enforced inside the feeder/conductor sizing tools.
  //
  // What we DO audit at the circuit level: that the breaker (the OCPD the
  // user picked) is rated for the load (the load_watts the user entered).
  // This is independent of conductor sizing — it's pure NEC 210.20(A).
  data.circuits.forEach(circuit => {
    const panel = data.panels.find(p => p.id === circuit.panel_id);
    if (!panel) return;

    const loadingIssue = checkCircuitLoading(circuit, panel);
    if (loadingIssue) {
      issues.push(loadingIssue);
      necArticlesReferenced.add('NEC 210.20(A)');
    }
  });
  
  // ============================================================
  // FEEDER CHECKS
  // ============================================================
  
  data.feeders.forEach(feeder => {
    // Voltage drop
    const vdIssue = checkFeederVoltageDrop(feeder, data.panels);
    if (vdIssue) {
      issues.push(vdIssue);
      necArticlesReferenced.add('NEC 210.19(A)');
    } else if (feeder.voltage_drop_percent && feeder.voltage_drop_percent <= 3) {
      passedChecks.push({
        id: generateId(),
        category: 'feeder',
        necArticle: 'NEC 210.19(A)',
        description: `Feeder "${feeder.name}": Voltage drop acceptable`,
        passed: true,
      });
    }
    
    // Feeder conductor protected by its breaker (#283)
    const protectionIssue = checkFeederProtection(feeder, data.panels);
    if (protectionIssue) {
      issues.push(protectionIssue);
      necArticlesReferenced.add(protectionIssue.necArticle);
    }

    // Feeder EGC
    const feederEgcIssue = checkFeederEgc(feeder, data.panels);
    if (feederEgcIssue) {
      issues.push(feederEgcIssue);
    } else if (feeder.egc_size) {
      passedChecks.push({
        id: generateId(),
        category: 'grounding',
        necArticle: 'NEC 250.122',
        description: `Feeder "${feeder.name}": EGC properly sized`,
        passed: true,
      });
    }
  });
  
  // ============================================================
  // SERVICE CHECKS
  // ============================================================
  
  const serviceIssue = checkServiceCapacity(data);
  if (serviceIssue) {
    issues.push(serviceIssue);
    necArticlesReferenced.add('NEC 230.42');
  } else {
    passedChecks.push({
      id: generateId(),
      category: 'service',
      necArticle: 'NEC 230.42',
      description: 'Service capacity adequate for calculated load',
      passed: true,
    });
    necArticlesReferenced.add('NEC 230.42');
  }
  
  // ============================================================
  // SUMMARY
  // ============================================================
  
  const totalChecks = issues.length + passedChecks.length;
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const passedCount = passedChecks.length;
  
  // Score: 100 base, -10 per warning, -25 per critical
  let score = 100;
  score -= warningCount * 10;
  score -= criticalCount * 25;
  score = Math.max(0, Math.min(100, score));
  
  return {
    timestamp: new Date(),
    projectId: data.projectId,
    summary: {
      totalChecks,
      passed: passedCount,
      warnings: warningCount,
      critical: criticalCount,
      score,
    },
    issues,
    passedChecks,
    necArticlesReferenced: Array.from(necArticlesReferenced).sort(),
  };
}

/**
 * Get AI explanation for a specific issue
 */
export function getIssueExplanationPrompt(issue: InspectionIssue): string {
  return `
Explain this NEC compliance issue in detail for an electrical contractor:

**Issue:** ${issue.title}
**NEC Article:** ${issue.necArticle}
**Location:** ${issue.location}
**Description:** ${issue.description}
${issue.currentValue ? `**Current Value:** ${issue.currentValue}` : ''}
${issue.requiredValue ? `**Required Value:** ${issue.requiredValue}` : ''}

Please explain:
1. Why this NEC article exists (safety purpose)
2. What could happen if this isn't corrected
3. Step-by-step guidance to fix this issue
4. Any exceptions or special cases to be aware of

Keep the explanation professional but accessible.
  `.trim();
}

