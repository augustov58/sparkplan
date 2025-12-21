/**
 * Tree Layout Calculator for Riser Diagrams
 *
 * Calculates optimal horizontal positions for panels in a hierarchical
 * electrical diagram using a tree layout algorithm.
 *
 * Algorithm:
 * 1. Build tree structure from panels/transformers
 * 2. Calculate subtree widths bottom-up (recursively)
 * 3. Position nodes centered over their children
 * 4. Ensure minimum separation between siblings
 */

import type { Panel, Transformer } from '@/types';

export interface LayoutNode {
  id: string;
  type: 'panel' | 'transformer';
  level: number; // 0 = MDP, 1 = Level 1, 2 = Level 2, etc.
  children: LayoutNode[];
  // Calculated values
  subtreeWidth: number;
  x: number; // Final calculated X position (before manual offsets)
}

export interface TreeLayoutConfig {
  minNodeSpacing: number; // Minimum space between sibling nodes
  levelSpacing: number; // Vertical space between levels (not used for X calc)
}

const DEFAULT_CONFIG: TreeLayoutConfig = {
  minNodeSpacing: 140, // Matches LEVEL1_SPACING from OneLineDiagram
  levelSpacing: 180,
};

/**
 * Build tree structure from panels and transformers
 */
export function buildTree(
  panels: Panel[],
  transformers: Transformer[]
): LayoutNode | null {
  // Find MDP (main distribution panel)
  const mdp = panels.find(p => p.is_main);
  if (!mdp) return null;

  // Build tree recursively starting from MDP
  return buildNodeTree(mdp.id, 'panel', 0, panels, transformers);
}

function buildNodeTree(
  id: string,
  type: 'panel' | 'transformer',
  level: number,
  panels: Panel[],
  transformers: Transformer[]
): LayoutNode {
  const children: LayoutNode[] = [];

  if (type === 'panel') {
    // Find panels fed from this panel
    const childPanels = panels.filter(
      p => p.fed_from_type === 'panel' && p.fed_from === id
    );
    children.push(
      ...childPanels.map(p =>
        buildNodeTree(p.id, 'panel', level + 1, panels, transformers)
      )
    );

    // Find transformers fed from this panel
    const childTransformers = transformers.filter(t => t.fed_from_panel_id === id);
    children.push(
      ...childTransformers.map(t =>
        buildNodeTree(t.id, 'transformer', level + 1, panels, transformers)
      )
    );
  } else {
    // type === 'transformer'
    // Find panels fed from this transformer
    const childPanels = panels.filter(
      p => p.fed_from_type === 'transformer' && p.fed_from_transformer_id === id
    );
    children.push(
      ...childPanels.map(p =>
        buildNodeTree(p.id, 'panel', level + 1, panels, transformers)
      )
    );
  }

  return {
    id,
    type,
    level,
    children,
    subtreeWidth: 0,
    x: 0,
  };
}

/**
 * Calculate subtree widths bottom-up
 * Returns the width needed to render this node and all its descendants
 */
function calculateSubtreeWidth(
  node: LayoutNode,
  config: TreeLayoutConfig
): number {
  if (node.children.length === 0) {
    // Leaf node: width is just the node itself (0 for simplicity, spacing handles it)
    node.subtreeWidth = config.minNodeSpacing;
    return node.subtreeWidth;
  }

  // Calculate widths for all children first (bottom-up)
  const childWidths = node.children.map(child =>
    calculateSubtreeWidth(child, config)
  );

  // Total width = sum of all child subtree widths
  const totalChildWidth = childWidths.reduce((sum, w) => sum + w, 0);

  // This node's subtree width is the maximum of:
  // 1. Total width of all children
  // 2. Minimum node spacing (for this node itself)
  node.subtreeWidth = Math.max(totalChildWidth, config.minNodeSpacing);

  return node.subtreeWidth;
}

/**
 * Position nodes horizontally using the calculated subtree widths
 *
 * @param node Current node to position
 * @param leftBoundary Left edge of available space for this subtree
 * @param config Layout configuration
 */
function positionNodes(
  node: LayoutNode,
  leftBoundary: number,
  config: TreeLayoutConfig
): void {
  if (node.children.length === 0) {
    // Leaf node: center within its allocated space
    node.x = leftBoundary + config.minNodeSpacing / 2;
    return;
  }

  // Position all children first (left to right)
  let currentX = leftBoundary;
  node.children.forEach(child => {
    positionNodes(child, currentX, config);
    currentX += child.subtreeWidth;
  });

  // Position this node centered over its children
  const firstChild = node.children[0];
  const lastChild = node.children[node.children.length - 1];
  if (!firstChild || !lastChild) return; // Guard check
  node.x = (firstChild.x + lastChild.x) / 2;
}

/**
 * Main function: Calculate tree layout positions
 *
 * Returns a map of panel/transformer IDs to X positions
 */
export function calculateTreeLayout(
  panels: Panel[],
  transformers: Transformer[],
  config: Partial<TreeLayoutConfig> = {}
): Map<string, number> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Build tree structure
  const tree = buildTree(panels, transformers);
  if (!tree) {
    return new Map();
  }

  // Calculate subtree widths (bottom-up)
  calculateSubtreeWidth(tree, finalConfig);

  // Calculate total diagram width and center it
  const totalWidth = tree.subtreeWidth;
  const centerOffset = 0; // We'll center around 0, then shift to canvas center in rendering

  // Position nodes (top-down)
  positionNodes(tree, centerOffset - totalWidth / 2, finalConfig);

  // Flatten tree to map
  const positionMap = new Map<string, number>();
  flattenTreeToMap(tree, positionMap);

  return positionMap;
}

/**
 * Helper: Flatten tree to a map of ID → X position
 */
function flattenTreeToMap(node: LayoutNode, map: Map<string, number>): void {
  map.set(node.id, node.x);
  node.children.forEach(child => flattenTreeToMap(child, map));
}

/**
 * Get all descendant IDs of a node (for dragging entire subtrees)
 */
export function getDescendantIds(
  nodeId: string,
  panels: Panel[],
  transformers: Transformer[]
): string[] {
  const descendants: string[] = [];

  // Check if nodeId is a panel
  const panel = panels.find(p => p.id === nodeId);
  if (panel) {
    collectPanelDescendants(nodeId, panels, transformers, descendants);
  } else {
    // It's a transformer
    collectTransformerDescendants(nodeId, panels, transformers, descendants);
  }

  return descendants;
}

function collectPanelDescendants(
  panelId: string,
  panels: Panel[],
  transformers: Transformer[],
  result: string[]
): void {
  // Find child panels
  const childPanels = panels.filter(
    p => p.fed_from_type === 'panel' && p.fed_from === panelId
  );
  childPanels.forEach(p => {
    result.push(p.id);
    collectPanelDescendants(p.id, panels, transformers, result);
  });

  // Find child transformers
  const childTransformers = transformers.filter(t => t.fed_from_panel_id === panelId);
  childTransformers.forEach(t => {
    result.push(t.id);
    collectTransformerDescendants(t.id, panels, transformers, result);
  });
}

function collectTransformerDescendants(
  transformerId: string,
  panels: Panel[],
  transformers: Transformer[],
  result: string[]
): void {
  // Find child panels
  const childPanels = panels.filter(
    p => p.fed_from_type === 'transformer' && p.fed_from_transformer_id === transformerId
  );
  childPanels.forEach(p => {
    result.push(p.id);
    collectPanelDescendants(p.id, panels, transformers, result);
  });
}
