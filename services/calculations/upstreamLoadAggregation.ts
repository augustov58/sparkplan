/**
 * Upstream Load Aggregation Service
 * 
 * Per NEC Article 220, when calculating loads for feeders and services,
 * the load from downstream panels must be aggregated upstream.
 * 
 * This service calculates the total load a panel must serve, including:
 * - Direct circuits connected to the panel
 * - Downstream panels fed from this panel
 * - Transformers fed from this panel (secondary side loads)
 * 
 * @module services/calculations/upstreamLoadAggregation
 * 
 * Issue: When connecting one panel to another through the one-line,
 * the load from the panel downstream should be translated upstream to the feeding panel.
 */

import type { Database } from '@/lib/database.types';

type Panel = Database['public']['Tables']['panels']['Row'];
type Transformer = Database['public']['Tables']['transformers']['Row'];
type Circuit = Database['public']['Tables']['circuits']['Row'];

export interface AggregatedLoad {
  panelId: string;
  panelName: string;
  
  // Direct load from circuits on this panel
  directConnectedVA: number;
  directDemandVA: number;
  
  // Load from downstream panels (demand load is used per NEC)
  downstreamPanelsConnectedVA: number;
  downstreamPanelsDemandVA: number;
  downstreamPanelCount: number;
  
  // Load from transformers fed from this panel
  transformerLoadVA: number;
  transformerCount: number;
  
  // Total aggregated load
  totalConnectedVA: number;
  totalDemandVA: number;
  
  // Breakdown by downstream source
  breakdown: Array<{
    sourceId: string;
    sourceName: string;
    sourceType: 'circuit' | 'panel' | 'transformer';
    connectedVA: number;
    demandVA: number;
  }>;
  
  // NEC references applied
  necReferences: string[];
}

/**
 * Calculates demand load for a set of circuits using NEC 220 factors
 */
function calculateDemandLoad(circuits: Circuit[]): { connectedVA: number; demandVA: number } {
  if (circuits.length === 0) {
    return { connectedVA: 0, demandVA: 0 };
  }

  const connectedVA = circuits.reduce((sum, c) => sum + (c.load_watts || 0), 0);
  let demandVA = 0;

  // Group by load type
  const byType = circuits.reduce((acc, c) => {
    const type = c.load_type || 'O';
    if (!acc[type]) acc[type] = [];
    acc[type].push(c);
    return acc;
  }, {} as Record<string, Circuit[]>);

  for (const [type, typeCircuits] of Object.entries(byType)) {
    const typeTotal = typeCircuits.reduce((sum, c) => sum + (c.load_watts || 0), 0);
    
    switch (type) {
      case 'L': // Lighting - NEC 220.42
        if (typeTotal <= 3000) {
          demandVA += typeTotal;
        } else if (typeTotal <= 120000) {
          demandVA += 3000 + (typeTotal - 3000) * 0.35;
        } else {
          demandVA += 3000 + 117000 * 0.35 + (typeTotal - 120000) * 0.25;
        }
        break;
      
      case 'R': // Receptacles - NEC 220.44
        if (typeTotal <= 10000) {
          demandVA += typeTotal;
        } else {
          demandVA += 10000 + (typeTotal - 10000) * 0.5;
        }
        break;
      
      case 'M': // Motors - NEC 430.24
        const motorLoads = typeCircuits.map(c => c.load_watts || 0).sort((a, b) => b - a);
        if (motorLoads.length > 0) {
          demandVA += motorLoads[0] * 1.25;
          demandVA += motorLoads.slice(1).reduce((sum, w) => sum + w, 0);
        }
        break;
      
      default:
        demandVA += typeTotal;
    }
  }

  return { connectedVA, demandVA: Math.round(demandVA) };
}

/**
 * Calculates the total aggregated load for a panel including all downstream loads
 * 
 * Per NEC 220.40 (General), feeder and service loads are calculated using
 * demand factors that can be applied to the total connected load.
 * 
 * When a panel feeds other panels:
 * - Use the DEMAND load of downstream panels (not connected)
 * - This prevents over-sizing feeders based on unlikely simultaneous use
 * 
 * @param panelId - The panel to calculate aggregated load for
 * @param panels - All panels in the project
 * @param circuits - All circuits in the project
 * @param transformers - All transformers in the project
 * @param visited - Set of already visited panels (prevents circular references)
 * @returns AggregatedLoad with full breakdown
 */
export function calculateAggregatedLoad(
  panelId: string,
  panels: Panel[],
  circuits: Circuit[],
  transformers: Transformer[],
  visited: Set<string> = new Set()
): AggregatedLoad {
  // Prevent infinite loops from circular references
  if (visited.has(panelId)) {
    return createEmptyAggregatedLoad(panelId, 'Circular reference detected');
  }
  visited.add(panelId);

  const panel = panels.find(p => p.id === panelId);
  if (!panel) {
    return createEmptyAggregatedLoad(panelId, 'Panel not found');
  }

  const breakdown: AggregatedLoad['breakdown'] = [];
  const necReferences: string[] = ['NEC 220.40 (Feeder Load)'];

  // 1. Calculate direct load from circuits on this panel
  const panelCircuits = circuits.filter(c => c.panel_id === panelId);
  const directLoad = calculateDemandLoad(panelCircuits);
  
  if (directLoad.connectedVA > 0) {
    breakdown.push({
      sourceId: panelId,
      sourceName: `${panel.name} Direct Loads`,
      sourceType: 'circuit',
      connectedVA: directLoad.connectedVA,
      demandVA: directLoad.demandVA,
    });
  }

  // 2. Find and aggregate downstream panels
  const downstreamPanels = panels.filter(
    p => p.fed_from_type === 'panel' && p.fed_from === panelId
  );

  let downstreamPanelsConnectedVA = 0;
  let downstreamPanelsDemandVA = 0;

  for (const downPanel of downstreamPanels) {
    // Recursively calculate load for downstream panel
    const downstreamLoad = calculateAggregatedLoad(
      downPanel.id,
      panels,
      circuits,
      transformers,
      new Set(visited) // Create new set for each branch
    );

    // Use DEMAND load for upstream aggregation per NEC
    downstreamPanelsConnectedVA += downstreamLoad.totalConnectedVA;
    downstreamPanelsDemandVA += downstreamLoad.totalDemandVA;

    breakdown.push({
      sourceId: downPanel.id,
      sourceName: downPanel.name,
      sourceType: 'panel',
      connectedVA: downstreamLoad.totalConnectedVA,
      demandVA: downstreamLoad.totalDemandVA,
    });
  }

  if (downstreamPanels.length > 0) {
    necReferences.push('NEC 220.61 (Feeder Neutral Load)');
  }

  // 3. Find and aggregate transformers fed from this panel
  const fedTransformers = transformers.filter(t => t.fed_from_panel_id === panelId);
  let transformerLoadVA = 0;

  for (const xfmr of fedTransformers) {
    // Find panels fed by this transformer
    const xfmrPanels = panels.filter(p => p.fed_from_transformer_id === xfmr.id);
    
    let xfmrTotalVA = 0;
    for (const xfmrPanel of xfmrPanels) {
      const xfmrPanelLoad = calculateAggregatedLoad(
        xfmrPanel.id,
        panels,
        circuits,
        transformers,
        new Set(visited)
      );
      xfmrTotalVA += xfmrPanelLoad.totalDemandVA;
    }

    // If transformer has no panels, use its kVA rating as a placeholder
    if (xfmrPanels.length === 0 && xfmr.kva_rating) {
      xfmrTotalVA = xfmr.kva_rating * 1000;
    }

    transformerLoadVA += xfmrTotalVA;

    breakdown.push({
      sourceId: xfmr.id,
      sourceName: xfmr.name || `Transformer ${xfmr.kva_rating}kVA`,
      sourceType: 'transformer',
      connectedVA: xfmrTotalVA,
      demandVA: xfmrTotalVA, // Transformer loads already in demand
    });
  }

  if (fedTransformers.length > 0) {
    necReferences.push('NEC 220.43 (Show-Window/Track Lighting)'); // Example for specific loads
  }

  // Calculate totals
  const totalConnectedVA = directLoad.connectedVA + downstreamPanelsConnectedVA + transformerLoadVA;
  const totalDemandVA = directLoad.demandVA + downstreamPanelsDemandVA + transformerLoadVA;

  return {
    panelId,
    panelName: panel.name,
    directConnectedVA: directLoad.connectedVA,
    directDemandVA: directLoad.demandVA,
    downstreamPanelsConnectedVA,
    downstreamPanelsDemandVA,
    downstreamPanelCount: downstreamPanels.length,
    transformerLoadVA,
    transformerCount: fedTransformers.length,
    totalConnectedVA,
    totalDemandVA,
    breakdown,
    necReferences,
  };
}

/**
 * Creates an empty aggregated load result
 */
function createEmptyAggregatedLoad(panelId: string, message: string): AggregatedLoad {
  return {
    panelId,
    panelName: message,
    directConnectedVA: 0,
    directDemandVA: 0,
    downstreamPanelsConnectedVA: 0,
    downstreamPanelsDemandVA: 0,
    downstreamPanelCount: 0,
    transformerLoadVA: 0,
    transformerCount: 0,
    totalConnectedVA: 0,
    totalDemandVA: 0,
    breakdown: [],
    necReferences: [],
  };
}

/**
 * Gets a summary of all panels with their aggregated loads
 * Useful for displaying in UI or reports
 */
export function getAllPanelAggregatedLoads(
  panels: Panel[],
  circuits: Circuit[],
  transformers: Transformer[]
): AggregatedLoad[] {
  return panels.map(panel => 
    calculateAggregatedLoad(panel.id, panels, circuits, transformers)
  );
}

/**
 * Determines which panels are affected when a circuit load changes
 * (All upstream panels need their aggregated loads recalculated)
 */
export function getAffectedUpstreamPanels(
  panelId: string,
  panels: Panel[]
): Panel[] {
  const affected: Panel[] = [];
  
  let current = panels.find(p => p.id === panelId);
  while (current) {
    if (current.fed_from_type === 'panel' && current.fed_from) {
      const upstream = panels.find(p => p.id === current!.fed_from);
      if (upstream) {
        affected.push(upstream);
        current = upstream;
      } else {
        break;
      }
    } else {
      break;
    }
  }
  
  return affected;
}

