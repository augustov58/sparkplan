/**
 * Feeder Load Synchronization Service
 * 
 * Tracks when feeder calculations become stale due to changes in
 * downstream panel loads. Provides utilities for detecting and
 * handling load updates.
 * 
 * @module services/feeder/feederLoadSync
 * 
 * Issue: Once a feeder is created between 2 panels, it should also update
 * if the load is changed in the panel later on - or at least show a notification.
 */

import type { Feeder } from '@/types';
import type { Database } from '@/lib/database.types';

type Circuit = Database['public']['Tables']['circuits']['Row'];

export interface FeederLoadStatus {
  feederId: string;
  feederName: string;
  destinationPanelId: string;
  destinationPanelName?: string;
  isStale: boolean;
  currentConnectedVA: number;
  currentDemandVA: number;
  cachedConnectedVA: number;
  cachedDemandVA: number;
  loadDifferenceVA: number;
  loadDifferencePercent: number;
  message: string;
}

/**
 * Calculates the current load for a panel from its circuits
 * Uses demand factor calculations per NEC Article 220
 */
function calculatePanelCurrentLoad(
  panelId: string,
  circuits: Circuit[]
): { connectedVA: number; demandVA: number } {
  const panelCircuits = circuits.filter(c => c.panel_id === panelId);
  
  if (panelCircuits.length === 0) {
    return { connectedVA: 0, demandVA: 0 };
  }

  // Calculate connected load (simple sum)
  const connectedVA = panelCircuits.reduce((sum, c) => sum + (c.load_watts || 0), 0);

  // Calculate demand load with simplified NEC 220 factors
  // This is a simplified version - full implementation in demandFactor.ts
  let demandVA = 0;
  
  // Group by load type
  const byType = panelCircuits.reduce((acc, c) => {
    const type = c.load_type || 'O';
    if (!acc[type]) acc[type] = [];
    acc[type].push(c);
    return acc;
  }, {} as Record<string, Circuit[]>);

  // Apply demand factors per load type
  for (const [type, typeCircuits] of Object.entries(byType)) {
    const typeTotal = typeCircuits.reduce((sum, c) => sum + (c.load_watts || 0), 0);
    
    switch (type) {
      case 'L': // Lighting - NEC 220.42
        // First 3kVA at 100%, next 117kVA at 35%, remainder at 25%
        if (typeTotal <= 3000) {
          demandVA += typeTotal;
        } else if (typeTotal <= 120000) {
          demandVA += 3000 + (typeTotal - 3000) * 0.35;
        } else {
          demandVA += 3000 + 117000 * 0.35 + (typeTotal - 120000) * 0.25;
        }
        break;
      
      case 'R': // Receptacles - NEC 220.44
        // First 10kVA at 100%, remainder at 50%
        if (typeTotal <= 10000) {
          demandVA += typeTotal;
        } else {
          demandVA += 10000 + (typeTotal - 10000) * 0.5;
        }
        break;
      
      case 'M': // Motors - NEC 430.24
        // Largest at 125%, others at 100%
        const motorLoads = typeCircuits.map(c => c.load_watts || 0).sort((a, b) => b - a);
        if (motorLoads.length > 0) {
          demandVA += motorLoads[0] * 1.25; // Largest at 125%
          demandVA += motorLoads.slice(1).reduce((sum, w) => sum + w, 0); // Others at 100%
        }
        break;
      
      default:
        // Other loads at 100%
        demandVA += typeTotal;
    }
  }

  return {
    connectedVA: Math.round(connectedVA),
    demandVA: Math.round(demandVA),
  };
}

/**
 * Checks if a feeder's cached load values are stale compared to current panel loads
 * 
 * @param feeder - The feeder to check
 * @param circuits - All circuits in the project
 * @param thresholdPercent - Percentage difference to consider stale (default 5%)
 * @returns FeederLoadStatus with details about staleness
 */
export function checkFeederLoadStatus(
  feeder: Feeder,
  circuits: Circuit[],
  thresholdPercent: number = 5
): FeederLoadStatus {
  // Only check feeders that go to panels (not transformers)
  if (!feeder.destination_panel_id) {
    return {
      feederId: feeder.id,
      feederName: feeder.name,
      destinationPanelId: '',
      isStale: false,
      currentConnectedVA: 0,
      currentDemandVA: 0,
      cachedConnectedVA: 0,
      cachedDemandVA: 0,
      loadDifferenceVA: 0,
      loadDifferencePercent: 0,
      message: 'Feeder to transformer - load sync N/A',
    };
  }

  const currentLoad = calculatePanelCurrentLoad(feeder.destination_panel_id, circuits);
  const cachedLoad = feeder.total_load_va || 0;
  const cachedDesign = feeder.design_load_va || 0;

  const difference = Math.abs(currentLoad.connectedVA - cachedLoad);
  const percentDiff = cachedLoad > 0 ? (difference / cachedLoad) * 100 : 
    (currentLoad.connectedVA > 0 ? 100 : 0);

  const isStale = percentDiff > thresholdPercent;

  let message = '';
  if (isStale) {
    if (currentLoad.connectedVA > cachedLoad) {
      message = `Load increased by ${difference.toLocaleString()} VA (${percentDiff.toFixed(1)}%) - recalculation recommended`;
    } else {
      message = `Load decreased by ${difference.toLocaleString()} VA (${percentDiff.toFixed(1)}%) - recalculation recommended`;
    }
  } else {
    message = 'Feeder sizing is current';
  }

  return {
    feederId: feeder.id,
    feederName: feeder.name,
    destinationPanelId: feeder.destination_panel_id,
    isStale,
    currentConnectedVA: currentLoad.connectedVA,
    currentDemandVA: currentLoad.demandVA,
    cachedConnectedVA: cachedLoad,
    cachedDemandVA: cachedDesign,
    loadDifferenceVA: difference,
    loadDifferencePercent: Math.round(percentDiff * 10) / 10,
    message,
  };
}

/**
 * Gets all stale feeders for a project
 */
export function getStaleFeedersList(
  feeders: Feeder[],
  circuits: Circuit[],
  thresholdPercent: number = 5
): FeederLoadStatus[] {
  return feeders
    .map(feeder => checkFeederLoadStatus(feeder, circuits, thresholdPercent))
    .filter(status => status.isStale);
}

/**
 * Gets feeders that need recalculation because a specific panel's load changed
 */
export function getFeedersAffectedByPanelChange(
  panelId: string,
  feeders: Feeder[]
): Feeder[] {
  return feeders.filter(f => f.destination_panel_id === panelId);
}

