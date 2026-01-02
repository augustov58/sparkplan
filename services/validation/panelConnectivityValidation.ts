/**
 * Panel Connectivity Validation Service
 * 
 * Validates electrical panel connectivity for feeder creation.
 * Ensures feeders can only be created between electrically connected panels.
 * 
 * @module services/validation/panelConnectivityValidation
 */

import type { Database } from '@/lib/database.types';

type Panel = Database['public']['Tables']['panels']['Row'];
type Transformer = Database['public']['Tables']['transformers']['Row'];

export interface ConnectivityValidation {
  isConnected: boolean;
  path: string[];
  message: string;
  technicalReason?: string;
}

/**
 * Builds an adjacency map of the electrical system showing which panels
 * are directly connected (via feeders, not through transformers)
 */
function buildPanelGraph(
  panels: Panel[],
  transformers: Transformer[]
): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();

  // Initialize all panels in the graph
  panels.forEach(panel => {
    graph.set(panel.id, new Set());
  });

  // Add edges for panel-to-panel connections (same voltage system)
  panels.forEach(panel => {
    if (panel.fed_from_type === 'panel' && panel.fed_from) {
      // Panel is fed from another panel - bidirectional edge
      graph.get(panel.fed_from)?.add(panel.id);
      graph.get(panel.id)?.add(panel.fed_from);
    }
  });

  // NOTE: Panels connected via transformer are NOT considered directly connected
  // because a feeder from LP(480V) to PP(208V via transformer) would be invalid
  // They're on different voltage systems

  return graph;
}

/**
 * Finds the voltage/phase "segment" a panel belongs to
 * Panels on different segments cannot have feeders between them
 * 
 * A segment is defined by:
 * - All panels at the same voltage/phase connected via direct feeders
 * - OR panels derived via line-to-neutral (e.g., 208V 3ph -> 120V 1ph)
 */
function getPanelSegmentRoot(
  panel: Panel,
  panels: Panel[],
  transformers: Transformer[]
): string | null {
  // Trace back to find the root of this voltage segment
  let current: Panel | undefined = panel;

  console.log(`📍 Tracing segment root for ${panel.name}:`, {
    fed_from_type: panel.fed_from_type,
    fed_from: panel.fed_from,
    totalPanels: panels.length
  });

  while (current) {
    if (current.fed_from_type === 'service') {
      // This is the service entrance - it's the root
      console.log(`  ✓ Found service entrance: ${current.name}`);
      return current.id;
    }

    if (current.fed_from_type === 'panel' && current.fed_from) {
      const parent = panels.find(p => p.id === current!.fed_from);
      console.log(`  → Looking for parent of ${current.name}:`, {
        fed_from: current.fed_from,
        parentFound: !!parent,
        parentName: parent?.name
      });

      if (parent) {
        // Check if same voltage - if different, current is a segment boundary
        if (parent.voltage !== current.voltage) {
          // This panel is the start of a new segment (line-to-neutral derivative)
          console.log(`  ⚡ Voltage change: ${parent.name} (${parent.voltage}V) → ${current.name} (${current.voltage}V)`);
          return current.id;
        }
        current = parent;
        continue; // ✅ Continue to next iteration to trace parent's hierarchy
      } else {
        console.log(`  ❌ Parent not found! Returning ${current.name}.id`);
        return current.id;
      }
    }

    if (current.fed_from_type === 'transformer' && current.fed_from_transformer_id) {
      // Transformer creates a new voltage segment - this panel is the root
      console.log(`  🔌 Transformer segment boundary: ${current.name}`);
      return current.id;
    }

    // Fallback - should not reach here in normal cases
    console.log(`  ⚠️ Unexpected fallback for ${current.name}`);
    break;
  }
  
  return panel.id;
}

/**
 * Validates if two panels can have a feeder created between them
 * 
 * Rules:
 * 1. Panels must be on the same voltage segment (connected without transformer)
 * 2. Cannot create feeder between panels on different branches separated by transformer
 * 3. Source panel must be upstream of destination (or at same level for parallel feeders)
 * 
 * @param sourcePanelId - ID of the source panel
 * @param destPanelId - ID of the destination panel  
 * @param panels - All panels in the project
 * @param transformers - All transformers in the project
 * @returns Validation result with message
 */
export function validateFeederConnectivity(
  sourcePanelId: string,
  destPanelId: string,
  panels: Panel[],
  transformers: Transformer[]
): ConnectivityValidation {
  const sourcePanel = panels.find(p => p.id === sourcePanelId);
  const destPanel = panels.find(p => p.id === destPanelId);

  if (!sourcePanel || !destPanel) {
    return {
      isConnected: false,
      path: [],
      message: 'One or both panels not found',
      technicalReason: 'Invalid panel IDs provided',
    };
  }

  // DEBUG: Log panel info
  console.log('🔍 Connectivity Check:', {
    source: `${sourcePanel.name} (${sourcePanel.voltage}V ${sourcePanel.phase}φ, fed_from_type: ${sourcePanel.fed_from_type})`,
    dest: `${destPanel.name} (${destPanel.voltage}V ${destPanel.phase}φ, fed_from_type: ${destPanel.fed_from_type}, fed_from: ${destPanel.fed_from})`,
  });

  // Rule 1: Same panel cannot have feeder to itself
  if (sourcePanelId === destPanelId) {
    return {
      isConnected: false,
      path: [],
      message: 'Cannot create feeder to the same panel',
      technicalReason: 'Source and destination must be different panels',
    };
  }
  
  // Rule 1b: If source is MDP (service entrance), check if dest is directly fed from it
  // This is a fast path for the most common case
  if (sourcePanel.is_main && destPanel.fed_from === sourcePanelId) {
    return {
      isConnected: true,
      path: [sourcePanel.name, destPanel.name],
      message: `Valid feeder: ${sourcePanel.name} (service entrance) → ${destPanel.name}`,
    };
  }

  // Rule 2: Check if panels are on the same voltage segment
  const sourceRoot = getPanelSegmentRoot(sourcePanel, panels, transformers);
  const destRoot = getPanelSegmentRoot(destPanel, panels, transformers);

  console.log('🔍 Segment roots:', {
    sourceRoot,
    destRoot,
    same: sourceRoot === destRoot
  });

  if (sourceRoot !== destRoot) {
    // Find out why they're on different segments
    const sourceSegmentPanel = panels.find(p => p.id === sourceRoot);
    const destSegmentPanel = panels.find(p => p.id === destRoot);

    console.log('❌ Different segments:', {
      sourceSegment: sourceSegmentPanel?.name,
      destSegment: destSegmentPanel?.name
    });

    return {
      isConnected: false,
      path: [],
      message: `Cannot create feeder between panels on different voltage segments`,
      technicalReason: `${sourcePanel.name} (${sourcePanel.voltage}V ${sourcePanel.phase}φ) is on a different ` +
        `electrical segment than ${destPanel.name} (${destPanel.voltage}V ${destPanel.phase}φ). ` +
        `These panels are separated by a transformer or are on different service branches.`,
    };
  }

  // Rule 3: Check if destination panel is directly fed from source (most common case)
  if (isDirectlyFedFrom(sourcePanelId, destPanelId, panels)) {
    return {
      isConnected: true,
      path: [sourcePanel.name, destPanel.name],
      message: `Valid feeder path: ${sourcePanel.name} → ${destPanel.name}`,
    };
  }
  
  // Rule 3b: Check if destination panel is downstream of source (multi-level hierarchy)
  const downstreamPath = findDownstreamPath(sourcePanelId, destPanelId, panels);
  console.log('🔍 Downstream path check:', {
    found: downstreamPath.length > 0,
    path: downstreamPath
  });
  if (downstreamPath.length > 0) {
    console.log('✅ Valid downstream path found');
    return {
      isConnected: true,
      path: downstreamPath,
      message: `Valid feeder path: ${sourcePanel.name} → ${destPanel.name}`,
    };
  }

  // Rule 4: Check if panels are connected but in reverse direction
  const upstreamPath = findDownstreamPath(destPanelId, sourcePanelId, panels);
  if (upstreamPath.length > 0) {
    return {
      isConnected: false,
      path: [],
      message: `Invalid feeder direction: ${destPanel.name} is upstream of ${sourcePanel.name}`,
      technicalReason: `Feeders must flow from upstream (source) to downstream (load) panels. ` +
        `${destPanel.name} feeds ${sourcePanel.name}, not the other way around.`,
    };
  }

  // Rule 5: Check if they're in the same branch at all
  const graph = buildPanelGraph(panels, transformers);
  const connected = areConnectedBFS(sourcePanelId, destPanelId, graph);

  if (!connected) {
    return {
      isConnected: false,
      path: [],
      message: `Panels are not electrically connected`,
      technicalReason: `${sourcePanel.name} and ${destPanel.name} are on different branches ` +
        `of the distribution system with no direct electrical path between them.`,
    };
  }

  // Panels are on same segment but not in direct hierarchy - allow with warning
  return {
    isConnected: true,
    path: [sourcePanel.name, destPanel.name],
    message: `Valid connection: ${sourcePanel.name} → ${destPanel.name} (same electrical segment)`,
  };
}

/**
 * Finds if destPanelId is downstream of sourcePanelId
 * Returns the path if found, empty array otherwise
 */
function findDownstreamPath(
  sourcePanelId: string,
  destPanelId: string,
  panels: Panel[]
): string[] {
  const path: string[] = [];
  const sourcePanel = panels.find(p => p.id === sourcePanelId);
  
  // Start from destination and trace back to source
  let current: Panel | undefined = panels.find(p => p.id === destPanelId);
  
  while (current) {
    path.unshift(current.name);
    
    if (current.id === sourcePanelId) {
      // Found the source - return the path
      return path;
    }
    
    // Check if this panel is fed from the source panel (direct connection)
    // This handles cases where fed_from is set but fed_from_type might not be 'panel'
    if (current.fed_from === sourcePanelId) {
      path.unshift(sourcePanel?.name || 'Source');
      return path;
    }
    
    // Trace back through panel hierarchy (only if fed from another panel)
    if (current.fed_from_type === 'panel' && current.fed_from) {
      current = panels.find(p => p.id === current!.fed_from);
    } else {
      // Reached service entrance, transformer, or end of path
      break;
    }
  }
  
  return [];
}

/**
 * Checks if destination is directly fed from source (forward lookup)
 * More reliable than tracing backward
 */
function isDirectlyFedFrom(
  sourcePanelId: string,
  destPanelId: string,
  panels: Panel[]
): boolean {
  const destPanel = panels.find(p => p.id === destPanelId);
  if (!destPanel) return false;
  
  // Check if destination's fed_from matches source
  return destPanel.fed_from === sourcePanelId;
}

/**
 * BFS to check if two panels are connected at all
 */
function areConnectedBFS(
  startId: string,
  endId: string,
  graph: Map<string, Set<string>>
): boolean {
  if (startId === endId) return true;
  
  const visited = new Set<string>();
  const queue = [startId];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    
    if (current === endId) return true;
    
    if (visited.has(current)) continue;
    visited.add(current);
    
    const neighbors = graph.get(current);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }
  }
  
  return false;
}

/**
 * Gets all panels that can be valid feeder destinations from a source panel
 * 
 * @param sourcePanelId - The source panel ID
 * @param panels - All panels in the project
 * @param transformers - All transformers in the project
 * @returns Array of valid destination panel IDs
 */
export function getValidFeederDestinations(
  sourcePanelId: string,
  panels: Panel[],
  transformers: Transformer[]
): Panel[] {
  const validDestinations: Panel[] = [];

  panels.forEach(panel => {
    if (panel.id === sourcePanelId) return; // Skip self

    // CRITICAL FIX: Only allow panels that are DOWNSTREAM of the source,
    // not just on the same voltage segment (siblings should be excluded)
    // Check if panel is directly or indirectly downstream
    const isDownstream = isPanelDownstream(sourcePanelId, panel.id, panels);

    if (isDownstream) {
      // Double-check connectivity for safety
      const validation = validateFeederConnectivity(
        sourcePanelId,
        panel.id,
        panels,
        transformers
      );

      if (validation.isConnected) {
        validDestinations.push(panel);
      }
    }
  });

  return validDestinations;
}

/**
 * Checks if a panel is downstream of another (directly or indirectly)
 */
export function isPanelDownstream(
  upstreamPanelId: string,
  potentialDownstreamId: string,
  panels: Panel[]
): boolean {
  const path = findDownstreamPath(upstreamPanelId, potentialDownstreamId, panels);
  return path.length > 0;
}

/**
 * Gets all downstream panels from a given panel (recursive)
 */
export function getAllDownstreamPanels(
  panelId: string,
  panels: Panel[]
): Panel[] {
  const downstream: Panel[] = [];

  // Find all panels directly fed from this panel
  const directChildren = panels.filter(
    p => p.fed_from_type === 'panel' && p.fed_from === panelId
  );

  for (const child of directChildren) {
    downstream.push(child);
    // Recursively get children of children
    downstream.push(...getAllDownstreamPanels(child.id, panels));
  }

  return downstream;
}

/**
 * Enhanced connectivity validation that supports transformers as sources and destinations
 *
 * Handles all four combinations:
 * - Panel → Panel (delegates to validateFeederConnectivity)
 * - Panel → Transformer
 * - Transformer → Panel
 * - Transformer → Transformer
 *
 * @param sourcePanelId - Source panel ID (null if source is transformer)
 * @param sourceTransformerId - Source transformer ID (null if source is panel)
 * @param destPanelId - Destination panel ID (null if destination is transformer)
 * @param destTransformerId - Destination transformer ID (null if destination is panel)
 * @param panels - All panels in the project
 * @param transformers - All transformers in the project
 * @returns Validation result with message
 */
export function validateFeederConnectivityEnhanced(
  sourcePanelId: string | null,
  sourceTransformerId: string | null,
  destPanelId: string | null,
  destTransformerId: string | null,
  panels: Panel[],
  transformers: Transformer[]
): ConnectivityValidation {
  // Case 1: Panel → Panel (use existing logic)
  if (sourcePanelId && destPanelId) {
    return validateFeederConnectivity(sourcePanelId, destPanelId, panels, transformers);
  }

  // Case 2: Panel → Transformer
  if (sourcePanelId && destTransformerId) {
    const sourcePanel = panels.find(p => p.id === sourcePanelId);
    const destTransformer = transformers.find(t => t.id === destTransformerId);

    if (!sourcePanel || !destTransformer) {
      return {
        isConnected: false,
        path: [],
        message: 'Source panel or destination transformer not found',
        technicalReason: 'Invalid IDs provided',
      };
    }

    // Transformer must be fed from this panel (directly)
    if (destTransformer.fed_from_panel_id === sourcePanelId) {
      return {
        isConnected: true,
        path: [sourcePanel.name, destTransformer.name],
        message: `Valid feeder: ${sourcePanel.name} → ${destTransformer.name}`,
      };
    }

    // Check if transformer is downstream of source panel (through other panels)
    const isDownstream = isTransformerDownstreamOfPanel(sourcePanelId, destTransformerId, panels, transformers);
    if (isDownstream) {
      return {
        isConnected: true,
        path: [sourcePanel.name, '...', destTransformer.name],
        message: `Valid feeder: ${sourcePanel.name} → ${destTransformer.name} (downstream)`,
      };
    }

    return {
      isConnected: false,
      path: [],
      message: `Transformer ${destTransformer.name} is not fed from panel ${sourcePanel.name}`,
      technicalReason: `${destTransformer.name} must be downstream of ${sourcePanel.name} to create a feeder.`,
    };
  }

  // Case 3: Transformer → Panel
  if (sourceTransformerId && destPanelId) {
    const sourceTransformer = transformers.find(t => t.id === sourceTransformerId);
    const destPanel = panels.find(p => p.id === destPanelId);

    if (!sourceTransformer || !destPanel) {
      return {
        isConnected: false,
        path: [],
        message: 'Source transformer or destination panel not found',
        technicalReason: 'Invalid IDs provided',
      };
    }

    // Panel must be fed from this transformer (directly or indirectly)
    if (destPanel.fed_from_type === 'transformer' && destPanel.fed_from_transformer_id === sourceTransformerId) {
      return {
        isConnected: true,
        path: [sourceTransformer.name, destPanel.name],
        message: `Valid feeder: ${sourceTransformer.name} → ${destPanel.name}`,
      };
    }

    // Check if panel is downstream of transformer (through other panels)
    const isDownstream = isPanelDownstreamOfTransformer(sourceTransformerId, destPanelId, panels, transformers);
    if (isDownstream) {
      return {
        isConnected: true,
        path: [sourceTransformer.name, '...', destPanel.name],
        message: `Valid feeder: ${sourceTransformer.name} → ${destPanel.name} (downstream)`,
      };
    }

    return {
      isConnected: false,
      path: [],
      message: `Panel ${destPanel.name} is not fed from transformer ${sourceTransformer.name}`,
      technicalReason: `${destPanel.name} must be downstream of ${sourceTransformer.name} to create a feeder. ` +
        `Currently fed from: ${destPanel.fed_from_type || 'unknown'}`,
    };
  }

  // Case 4: Transformer → Transformer
  if (sourceTransformerId && destTransformerId) {
    const sourceTransformer = transformers.find(t => t.id === sourceTransformerId);
    const destTransformer = transformers.find(t => t.id === destTransformerId);

    if (!sourceTransformer || !destTransformer) {
      return {
        isConnected: false,
        path: [],
        message: 'Source or destination transformer not found',
        technicalReason: 'Invalid IDs provided',
      };
    }

    // Same transformer cannot feed itself
    if (sourceTransformerId === destTransformerId) {
      return {
        isConnected: false,
        path: [],
        message: 'Cannot create feeder to the same transformer',
        technicalReason: 'Source and destination must be different transformers',
      };
    }

    // Destination transformer must be downstream of source transformer
    // This means the destination is fed from a panel that's on the secondary side of the source
    const isDownstream = isTransformerDownstreamOfTransformer(sourceTransformerId, destTransformerId, panels, transformers);
    if (isDownstream) {
      return {
        isConnected: true,
        path: [sourceTransformer.name, '...', destTransformer.name],
        message: `Valid feeder: ${sourceTransformer.name} → ${destTransformer.name}`,
      };
    }

    return {
      isConnected: false,
      path: [],
      message: `Transformers are not electrically connected`,
      technicalReason: `${destTransformer.name} must be downstream of ${sourceTransformer.name}. ` +
        `They are on different voltage segments or branches.`,
    };
  }

  // Should never reach here
  return {
    isConnected: false,
    path: [],
    message: 'Invalid feeder configuration',
    technicalReason: 'Must specify either source panel or transformer, and destination panel or transformer',
  };
}

/**
 * Check if a transformer is downstream of a panel (directly or through intermediate panels)
 */
function isTransformerDownstreamOfPanel(
  panelId: string,
  transformerId: string,
  panels: Panel[],
  transformers: Transformer[]
): boolean {
  const transformer = transformers.find(t => t.id === transformerId);
  if (!transformer) return false;

  // Check if transformer is directly fed from this panel
  if (transformer.fed_from_panel_id === panelId) return true;

  // Check if transformer is fed from a panel that's downstream of the source panel
  if (transformer.fed_from_panel_id) {
    const intermediatePath = findDownstreamPath(panelId, transformer.fed_from_panel_id, panels);
    return intermediatePath.length > 0;
  }

  return false;
}

/**
 * Check if a panel is downstream of a transformer (directly or through intermediate panels)
 */
function isPanelDownstreamOfTransformer(
  transformerId: string,
  panelId: string,
  panels: Panel[],
  transformers: Transformer[]
): boolean {
  const panel = panels.find(p => p.id === panelId);
  if (!panel) return false;

  // Trace back from panel to see if we reach the transformer
  let current: Panel | undefined = panel;
  const visited = new Set<string>();

  while (current && !visited.has(current.id)) {
    visited.add(current.id);

    // Check if this panel is directly fed from the transformer
    if (current.fed_from_type === 'transformer' && current.fed_from_transformer_id === transformerId) {
      return true;
    }

    // Trace back through panel hierarchy
    if (current.fed_from_type === 'panel' && current.fed_from) {
      current = panels.find(p => p.id === current!.fed_from);
    } else {
      break;
    }
  }

  return false;
}

/**
 * Check if a transformer is downstream of another transformer
 * (through intermediate panels on the secondary side)
 */
function isTransformerDownstreamOfTransformer(
  sourceTransformerId: string,
  destTransformerId: string,
  panels: Panel[],
  transformers: Transformer[]
): boolean {
  const sourceTransformer = transformers.find(t => t.id === sourceTransformerId);
  const destTransformer = transformers.find(t => t.id === destTransformerId);

  if (!sourceTransformer || !destTransformer) return false;

  // Find all panels fed from source transformer (secondary side)
  const secondarySidePanels = panels.filter(
    p => p.fed_from_type === 'transformer' && p.fed_from_transformer_id === sourceTransformerId
  );

  // Check if destination transformer is downstream of any of these panels
  for (const panel of secondarySidePanels) {
    if (isTransformerDownstreamOfPanel(panel.id, destTransformerId, panels, transformers)) {
      return true;
    }
  }

  return false;
}

