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
  cachedConnectedVA: number;
  loadDifferenceVA: number;
  loadDifferencePercent: number;
  message: string;
}

/**
 * Calculates the current CONNECTED load for a panel from its direct circuits
 * (Not demand - just simple sum for comparison purposes)
 */
function calculatePanelCurrentConnectedLoad(
  panelId: string,
  circuits: Circuit[]
): number {
  return circuits
    .filter(c => c.panel_id === panelId)
    .reduce((sum, c) => sum + (c.load_watts || 0), 0);
}

/**
 * Checks if a feeder's cached load values are stale compared to current panel loads
 * 
 * Note: This compares CONNECTED loads for simplicity. The actual demand calculation
 * happens in upstreamLoadAggregation.ts when the feeder is recalculated.
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
      cachedConnectedVA: 0,
      loadDifferenceVA: 0,
      loadDifferencePercent: 0,
      message: 'Feeder to transformer - load sync N/A',
    };
  }

  const currentConnected = calculatePanelCurrentConnectedLoad(feeder.destination_panel_id, circuits);
  const cachedConnected = feeder.total_load_va || 0;

  const difference = Math.abs(currentConnected - cachedConnected);
  const percentDiff = cachedConnected > 0 
    ? (difference / cachedConnected) * 100 
    : (currentConnected > 0 ? 100 : 0);

  const isStale = percentDiff > thresholdPercent;

  let message = '';
  if (isStale) {
    if (currentConnected > cachedConnected) {
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
    currentConnectedVA: currentConnected,
    cachedConnectedVA: cachedConnected,
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
