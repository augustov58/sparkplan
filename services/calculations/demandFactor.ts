/**
 * Panel schedule phase loads
 *
 * Per-phase connected load and phase imbalance for one panel's circuits.
 *
 * This file holds no demand factors. A panel's demand comes from
 * `calculateAggregatedLoad` (upstreamLoadAggregation.ts), the function the
 * packet and the panel schedule PDF use. The per-type demand walk that lived
 * here put lighting and water heaters at 125% and electric heat at 75% (#191).
 */

import type { LoadTypeCode } from '../../types';

export interface CircuitLoad {
  id: string;
  description: string;
  loadWatts: number;
  loadType: LoadTypeCode;
  pole: 1 | 2 | 3;
  circuitNumber: number;
  phase?: 'A' | 'B' | 'C';
}

export interface PhaseLoad {
  phase: 'A' | 'B' | 'C';
  connectedLoad_kVA: number;
}

export interface PanelPhaseLoads {
  phaseLoads: PhaseLoad[];
  totalConnectedLoad_kVA: number;
  percentImbalance: number;
}

/**
 * Determine which phase a circuit is on based on circuit number
 * 3-phase panels: 1,2→A, 3,4→B, 5,6→C, then repeat
 * Single-phase panels: 1,2→A, 3,4→B, then repeat
 */
export function getCircuitPhase(circuitNumber: number, panelPhase: 1 | 3): 'A' | 'B' | 'C' {
  if (panelPhase === 1) {
    // Single-phase: alternates A, B
    const row = Math.ceil(circuitNumber / 2);
    return (row % 2 === 1) ? 'A' : 'B';
  } else {
    // Three-phase: cycles A, B, C
    const row = Math.ceil(circuitNumber / 2);
    const phaseIndex = (row - 1) % 3;
    return ['A', 'B', 'C'][phaseIndex] as 'A' | 'B' | 'C';
  }
}

/**
 * Per-phase connected load and phase imbalance for a panel's circuits
 */
export function calculatePanelPhaseLoads(
  circuits: CircuitLoad[],
  phase: 1 | 3
): PanelPhaseLoads {
  const phaseLoadsMap: Record<'A' | 'B' | 'C', { connected: number }> = {
    'A': { connected: 0 },
    'B': { connected: 0 },
    'C': { connected: 0 },
  };

  circuits.forEach(circuit => {
    const circuitPhase = circuit.phase || getCircuitPhase(circuit.circuitNumber, phase);
    const loadVA = circuit.loadWatts;
    
    // For multi-pole circuits, distribute evenly
    if (circuit.pole === 2) {
      if (phase === 1) {
        // 1Φ split-phase (240 V across A↔B): a 2-pole load physically draws
        // through BOTH legs by definition. Split 50/50 between A and B
        // regardless of which "phase row" the slot lands on. Same fix
        // applied to the PDF version in C6.
        phaseLoadsMap['A'].connected += loadVA / 2;
        phaseLoadsMap['B'].connected += loadVA / 2;
      } else {
        // 3Φ panel: 2-pole load spans two adjacent phases (A↔B, B↔C, C↔A).
        phaseLoadsMap[circuitPhase].connected += loadVA / 2;
        const nextPhase = circuitPhase === 'A' ? 'B' : circuitPhase === 'B' ? 'C' : 'A';
        phaseLoadsMap[nextPhase].connected += loadVA / 2;
      }
    } else if (circuit.pole === 3) {
      // 3-pole: split evenly across all three
      phaseLoadsMap['A'].connected += loadVA / 3;
      phaseLoadsMap['B'].connected += loadVA / 3;
      phaseLoadsMap['C'].connected += loadVA / 3;
    } else {
      phaseLoadsMap[circuitPhase].connected += loadVA;
    }
  });

  const totalConnected = circuits.reduce((sum, c) => sum + c.loadWatts, 0) / 1000;

  const phaseLoads: PhaseLoad[] = [];
  const phases = phase === 1 ? ['A', 'B'] as const : ['A', 'B', 'C'] as const;

  phases.forEach(p => {
    phaseLoads.push({
      phase: p,
      connectedLoad_kVA: Math.round((phaseLoadsMap[p].connected / 1000) * 100) / 100,
    });
  });

  // Calculate phase imbalance
  const phaseValues = phaseLoads.map(p => p.connectedLoad_kVA);
  const maxPhase = Math.max(...phaseValues);
  const minPhase = Math.min(...phaseValues);
  const avgPhase = phaseValues.reduce((a, b) => a + b, 0) / phaseValues.length;
  const percentImbalance = avgPhase > 0 ? ((maxPhase - minPhase) / avgPhase) * 100 : 0;

  return {
    phaseLoads,
    totalConnectedLoad_kVA: Math.round(totalConnected * 100) / 100,
    percentImbalance: Math.round(percentImbalance * 10) / 10,
  };
}

/**
 * Get color for load type (for UI display)
 */
export function getLoadTypeColor(type: LoadTypeCode): string {
  const colors: Record<LoadTypeCode, string> = {
    'L': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'M': 'bg-blue-100 text-blue-800 border-blue-300',
    'R': 'bg-green-100 text-green-800 border-green-300',
    'O': 'bg-gray-100 text-gray-800 border-gray-300',
    'H': 'bg-red-100 text-red-800 border-red-300',
    'C': 'bg-cyan-100 text-cyan-800 border-cyan-300',
    'W': 'bg-orange-100 text-orange-800 border-orange-300',
    'D': 'bg-purple-100 text-purple-800 border-purple-300',
    'K': 'bg-pink-100 text-pink-800 border-pink-300',
  };
  return colors[type] || colors['O'];
}

