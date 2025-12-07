/**
 * Inspector Mode - Pre-Inspection AI Audit Service
 * 
 * NEC Compliance Validation Engine
 * Performs automated code compliance checks before inspector review
 * 
 * @module services/inspection/inspectorMode
 * 
 * Key NEC Articles Covered:
 * - NEC 210 - Branch Circuits
 * - NEC 215 - Feeders
 * - NEC 220 - Branch-Circuit, Feeder, and Service Load Calculations
 * - NEC 240 - Overcurrent Protection
 * - NEC 250 - Grounding and Bonding
 * - NEC 408 - Switchboards, Switchgear, and Panelboards
 * - NEC 430 - Motors
 */

import type { Database } from '@/lib/database.types';

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
}

// ============================================================================
// CONSTANTS - NEC TABLES
// ============================================================================

/**
 * NEC 240.4(D) - Small Conductor Protection Limits
 * Maximum overcurrent protection for small conductors
 */
const CONDUCTOR_PROTECTION_LIMITS: Record<string, { maxAmps: number; material: 'Cu' | 'Al' }> = {
  '14 AWG Cu': { maxAmps: 15, material: 'Cu' },
  '12 AWG Cu': { maxAmps: 20, material: 'Cu' },
  '10 AWG Cu': { maxAmps: 30, material: 'Cu' },
  '14 AWG Al': { maxAmps: 15, material: 'Al' },
  '12 AWG Al': { maxAmps: 15, material: 'Al' },
  '10 AWG Al': { maxAmps: 25, material: 'Al' },
};

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
  return circuits
    .filter(c => c.panel_id === panelId)
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
 * NEC 408.36 - Panel Maximum Poles
 * Maximum of 42 overcurrent devices (excluding main)
 */
function checkPanelMaxPoles(panel: Panel, circuits: Circuit[]): InspectionIssue | null {
  const polesUsed = countPanelPoles(panel.id, circuits);
  const MAX_POLES = 42;
  
  if (polesUsed > MAX_POLES) {
    return {
      id: generateId(),
      category: 'panel',
      severity: 'critical',
      necArticle: 'NEC 408.36',
      title: 'Panel Exceeds Maximum Overcurrent Devices',
      description: `Panel ${panel.name} has ${polesUsed} poles installed, exceeding the maximum of ${MAX_POLES} overcurrent devices permitted per NEC 408.36.`,
      location: panel.name,
      currentValue: polesUsed,
      requiredValue: MAX_POLES,
      recommendation: `Consider upgrading to a larger panel (e.g., 400A with 84 spaces) or splitting loads between multiple panels.`,
      autoFixable: false,
    };
  }
  
  // Warning if approaching limit
  if (polesUsed > MAX_POLES * 0.9) {
    return {
      id: generateId(),
      category: 'panel',
      severity: 'warning',
      necArticle: 'NEC 408.36',
      title: 'Panel Near Maximum Capacity',
      description: `Panel ${panel.name} is using ${polesUsed} of ${MAX_POLES} available poles (${Math.round(polesUsed / MAX_POLES * 100)}%).`,
      location: panel.name,
      currentValue: polesUsed,
      requiredValue: MAX_POLES,
      recommendation: `Plan for future expansion. Consider upgrading panel if additional circuits are anticipated.`,
      autoFixable: false,
    };
  }
  
  return null;
}

/**
 * Panel Bus Rating vs Load Check
 * Panel should not be loaded beyond its bus rating
 */
function checkPanelBusLoading(
  panel: Panel, 
  circuits: Circuit[],
  servicePhase: 1 | 3
): InspectionIssue | null {
  const totalLoadVA = calculatePanelLoad(panel.id, circuits);
  const busAmps = panel.bus_rating;
  const voltage = panel.voltage;
  
  // Calculate maximum VA capacity
  let maxCapacityVA: number;
  if (servicePhase === 1) {
    maxCapacityVA = busAmps * voltage;
  } else {
    maxCapacityVA = busAmps * voltage * Math.sqrt(3);
  }
  
  const utilizationPercent = (totalLoadVA / maxCapacityVA) * 100;
  
  // Critical if > 100%
  if (utilizationPercent > 100) {
    return {
      id: generateId(),
      category: 'panel',
      severity: 'critical',
      necArticle: 'NEC 408.30',
      title: 'Panel Overloaded Beyond Bus Rating',
      description: `Panel ${panel.name} load of ${Math.round(totalLoadVA / 1000)} kVA exceeds ${busAmps}A bus capacity of ${Math.round(maxCapacityVA / 1000)} kVA (${Math.round(utilizationPercent)}% utilization).`,
      location: panel.name,
      currentValue: `${Math.round(totalLoadVA / 1000)} kVA`,
      requiredValue: `≤ ${Math.round(maxCapacityVA / 1000)} kVA`,
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
      description: `Panel ${panel.name} is at ${Math.round(utilizationPercent)}% of bus capacity. Best practice is to keep utilization below 80%.`,
      location: panel.name,
      currentValue: `${Math.round(utilizationPercent)}%`,
      requiredValue: '≤ 80%',
      recommendation: `Consider load balancing or future panel upgrade for expansion capacity.`,
      autoFixable: false,
    };
  }
  
  return null;
}

/**
 * NEC 240.4(D) - Small Conductor Protection
 * Check that conductors are protected by appropriate OCPD
 */
function checkConductorProtection(circuit: Circuit, panelName: string): InspectionIssue | null {
  const conductor = circuit.conductor_size;
  const breakerAmps = circuit.breaker_amps;
  
  // Check if conductor is in protection limits table
  const limitKey = Object.keys(CONDUCTOR_PROTECTION_LIMITS).find(k => 
    conductor.includes(k.split(' ')[0]) && 
    (conductor.toLowerCase().includes('cu') || !conductor.toLowerCase().includes('al'))
  );
  
  if (limitKey) {
    const limit = CONDUCTOR_PROTECTION_LIMITS[limitKey];
    if (breakerAmps > limit.maxAmps) {
      return {
        id: generateId(),
        category: 'conductor',
        severity: 'critical',
        necArticle: 'NEC 240.4(D)',
        title: 'Conductor Overcurrent Protection Exceeded',
        description: `Circuit ${circuit.circuit_number} (${circuit.description}) uses ${conductor} conductor on ${breakerAmps}A breaker. NEC 240.4(D) limits this conductor to ${limit.maxAmps}A protection.`,
        location: `${panelName}, Circuit ${circuit.circuit_number}`,
        currentValue: `${breakerAmps}A breaker`,
        requiredValue: `≤ ${limit.maxAmps}A`,
        recommendation: `Reduce breaker to ${limit.maxAmps}A or upsize conductor to accommodate ${breakerAmps}A protection.`,
        autoFixable: false,
      };
    }
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
 * Receptacle Circuit VA/Outlet Check
 * Standard assumption is 180VA per general-purpose receptacle
 */
function checkReceptacleLoading(circuit: Circuit, panelName: string): InspectionIssue | null {
  // Only check receptacle circuits
  if (circuit.load_type !== 'R') return null;
  
  const loadWatts = circuit.load_watts;
  const breakerAmps = circuit.breaker_amps;
  
  // Calculate maximum VA for circuit
  const maxVA = breakerAmps * 120; // Assuming 120V receptacle circuit
  
  // Estimate outlets (180VA per outlet assumption)
  const estimatedOutlets = Math.ceil(loadWatts / 180);
  const vaPerOutlet = estimatedOutlets > 0 ? loadWatts / estimatedOutlets : 0;
  
  // If load exceeds circuit capacity
  if (loadWatts > maxVA * 0.8) { // 80% loading rule
    return {
      id: generateId(),
      category: 'circuit',
      severity: 'warning',
      necArticle: 'NEC 210.21(B)',
      title: 'Receptacle Circuit High Loading',
      description: `Circuit ${circuit.circuit_number} (${circuit.description}) has ${loadWatts}VA load on ${breakerAmps}A circuit (${Math.round(loadWatts / maxVA * 100)}% utilized).`,
      location: `${panelName}, Circuit ${circuit.circuit_number}`,
      currentValue: `${loadWatts}VA`,
      requiredValue: `≤ ${Math.round(maxVA * 0.8)}VA (80%)`,
      recommendation: `Consider splitting loads between multiple circuits or reducing outlet count.`,
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
  
  const ocpdAmps = destPanel.main_breaker_amps || destPanel.feeder_breaker_amps || destPanel.bus_rating;
  const requiredEgc = getRequiredEgcSize(ocpdAmps, feeder.conductor_material);
  
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
  
  // Check for required bonding
  if (!grounding?.bonding || !grounding.bonding.includes('Water Pipe')) {
    issues.push({
      id: generateId(),
      category: 'grounding',
      severity: 'warning',
      necArticle: 'NEC 250.104(A)',
      title: 'Metal Water Pipe Bonding Not Specified',
      description: `Bonding of metal water piping system is required per NEC 250.104(A) if present in structure.`,
      location: panel.name,
      recommendation: `If metal water piping is present, ensure it is bonded to the grounding electrode system.`,
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
  const mainPanel = data.panels.find(p => p.is_main);
  if (!mainPanel) return null;
  
  // Calculate total demand load from all panels
  let totalDemandVA = 0;
  data.panels.forEach(panel => {
    const panelLoad = calculatePanelLoad(panel.id, data.circuits);
    // Apply general demand factor estimate (this is simplified)
    totalDemandVA += panelLoad * 0.8; // 80% demand factor estimate
  });
  
  const serviceAmps = mainPanel.main_breaker_amps || mainPanel.bus_rating;
  const voltage = mainPanel.voltage;
  const phase = mainPanel.phase;
  
  let serviceCapacityVA: number;
  if (phase === 1) {
    serviceCapacityVA = serviceAmps * voltage;
  } else {
    serviceCapacityVA = serviceAmps * voltage * Math.sqrt(3);
  }
  
  const utilization = (totalDemandVA / serviceCapacityVA) * 100;
  
  if (utilization > 100) {
    return {
      id: generateId(),
      category: 'service',
      severity: 'critical',
      necArticle: 'NEC 230.42',
      title: 'Service Undersized for Load',
      description: `Calculated demand load of ${Math.round(totalDemandVA / 1000)} kVA exceeds ${serviceAmps}A service capacity of ${Math.round(serviceCapacityVA / 1000)} kVA.`,
      location: mainPanel.name,
      currentValue: `${Math.round(totalDemandVA / 1000)} kVA`,
      requiredValue: `≤ ${Math.round(serviceCapacityVA / 1000)} kVA`,
      recommendation: `Upgrade service to accommodate load or reduce connected loads.`,
      autoFixable: false,
    };
  }
  
  if (utilization > 80) {
    return {
      id: generateId(),
      category: 'service',
      severity: 'warning',
      necArticle: 'NEC 230.42',
      title: 'Service Nearing Capacity',
      description: `Service is at ${Math.round(utilization)}% of capacity. Consider future expansion needs.`,
      location: mainPanel.name,
      currentValue: `${Math.round(utilization)}%`,
      requiredValue: '≤ 80%',
      recommendation: `Plan for service upgrade if additional loads are anticipated.`,
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
    // NEC 408.36 - Max poles
    const maxPolesIssue = checkPanelMaxPoles(panel, data.circuits);
    if (maxPolesIssue) {
      issues.push(maxPolesIssue);
      necArticlesReferenced.add('NEC 408.36');
    } else {
      passedChecks.push({
        id: generateId(),
        category: 'panel',
        necArticle: 'NEC 408.36',
        description: `Panel ${panel.name}: Pole count within limits`,
        passed: true,
      });
      necArticlesReferenced.add('NEC 408.36');
    }
    
    // Bus loading check
    const busLoadingIssue = checkPanelBusLoading(panel, data.circuits, data.servicePhase);
    if (busLoadingIssue) {
      issues.push(busLoadingIssue);
      necArticlesReferenced.add('NEC 408.30');
    } else {
      passedChecks.push({
        id: generateId(),
        category: 'panel',
        necArticle: 'NEC 408.30',
        description: `Panel ${panel.name}: Bus loading acceptable`,
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
  
  data.circuits.forEach(circuit => {
    const panel = data.panels.find(p => p.id === circuit.panel_id);
    const panelName = panel?.name || 'Unknown Panel';
    
    // Conductor protection
    const conductorIssue = checkConductorProtection(circuit, panelName);
    if (conductorIssue) {
      issues.push(conductorIssue);
      necArticlesReferenced.add('NEC 240.4(D)');
    }
    
    // EGC sizing
    const egcIssue = checkEgcSizing(circuit, panelName);
    if (egcIssue) {
      issues.push(egcIssue);
    } else if (circuit.egc_size) {
      passedChecks.push({
        id: generateId(),
        category: 'grounding',
        necArticle: 'NEC 250.122',
        description: `Circuit ${circuit.circuit_number}: EGC properly sized`,
        passed: true,
      });
    }
    necArticlesReferenced.add('NEC 250.122');
    
    // Receptacle loading
    const receptacleIssue = checkReceptacleLoading(circuit, panelName);
    if (receptacleIssue) {
      issues.push(receptacleIssue);
      necArticlesReferenced.add('NEC 210.21(B)');
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

