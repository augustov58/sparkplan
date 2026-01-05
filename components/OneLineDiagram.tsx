/**
 * One-Line Electrical Diagram Component
 *
 * Renders IEEE Std 315 compliant one-line diagram showing electrical system hierarchy
 * from utility service entrance through transformers and panels.
 *
 * @module components/OneLineDiagram
 *
 * ## Architecture Decision (ADR-006)
 *
 * This component is **intentionally a 1614-line monolith** (see ADR-006).
 * Splitting would introduce props drilling nightmare and make debugging harder.
 *
 * **Key Design Principles**:
 * 1. **Tight coupling justified**: SVG rendering logic inseparable from hierarchy traversal
 * 2. **All logic in one place**: Easier debugging of complex electrical relationships
 * 3. **Performance**: Single React component = single reconciliation pass
 *
 * ## Rendering System
 *
 * ### Coordinate System (Y-axis hierarchy, top to bottom)
 *
 * ```
 * Y=50    ┌──────────┐  Utility Service Entrance (circle symbol)
 * Y=90    │  Meter   │  Service metering point
 * Y=170   │   MDP    │  Main Distribution Panel (red border)
 * Y=250   ═══════════  MDP Bus Bar (4px thick horizontal line)
 * Y=320   │ Panel │ │Transformer│  Level 1: Fed from MDP
 * Y=390   ═════════════  Level 1 Bus Bar (if 2+ downstream)
 * Y=450   │ Panel │     Level 2: Fed from Level 1 panels
 * Y=525   ═════════     Level 2 Bus Bar
 * Y=580   │ Panel │     Level 3: Fed from Level 2 transformers
 * ```
 *
 * **X-axis (horizontal)**: Elements spread around parent X coordinate
 * - Service entrance: X=400 (center of viewBox 0 0 800 750)
 * - Downstream elements: `parentX + (index - count/2) * spacing`
 *
 * ### Bus Bar Rendering (IEEE Std 315)
 *
 * **Decision Tree**:
 * - **0 downstream elements**: No line
 * - **1 downstream element**: Direct vertical line (2px)
 * - **2+ downstream elements**: Horizontal bus bar (4px) + vertical drops (2px)
 *
 * **Example**:
 * ```
 * MDP (X=400)
 *   │ (vertical feeder)
 * ══┼══ (horizontal bus, Y=250)
 *  │ │ │ (vertical drops)
 * P1 P2 P3 (panels at Y=320, X=310, 400, 490)
 * ```
 *
 * ### Color Coding
 * - **Red (#DC2626)**: Main Distribution Panel (MDP)
 * - **Blue (#3B82F6)**: Standard panels
 * - **Orange (#F59E0B)**: Transformers
 * - **Gray (#4B5563)**: Panel-fed connections
 * - **Orange (#F59E0B)**: Transformer-fed connections
 *
 * ## Hierarchy Traversal
 *
 * **Algorithm**: Recursive depth-first rendering
 *
 * 1. **Render static elements** (Utility, Meter, MDP)
 * 2. **Find Level 1 elements** (panels/transformers fed from MDP)
 * 3. **For each Level 1 panel**:
 *    - Render panel at Y=320
 *    - Find downstream panels/transformers
 *    - Render bus bar if 2+ downstream
 *    - **Recursively render Level 2** (Y=450)
 * 4. **For each Level 1 transformer**:
 *    - Render transformer at Y=320
 *    - Find panels fed from transformer
 *    - Render bus bar if 2+ panels
 *    - Render Level 3 panels (Y=580)
 *
 * **Performance**: O(n) where n = panels + transformers (single pass)
 *
 * ## Key Helper Functions
 *
 * - `DIAGRAM_CONSTANTS` (line 549): All coordinate constants in one place
 * - `renderBusBar()` (line 587): Renders horizontal bus + vertical drops
 * - `getDownstreamElements()` (line 1055): Finds panels/transformers fed from panel
 *
 * ## State Management
 *
 * **Data sources**: usePanels(), useCircuits(), useTransformers() hooks
 * - Real-time subscriptions keep diagram synchronized across tabs
 * - Optimistic updates for instant UI feedback
 *
 * **Local state**: Form data for creating panels/circuits/transformers
 *
 * ## IEEE Std 315 Compliance
 *
 * - **Symbols**: Circle (utility), Rectangle (panel), Trapezoid (transformer)
 * - **Line weights**: Bus bars 4px, feeders 2px
 * - **Horizontal buses**: Industry standard for distribution points
 *
 * ## Known Limitations
 *
 * 1. **Fixed viewBox height (750px)**: Systems >5 levels may render off-screen
 * 2. **Horizontal crowding**: 10+ panels at one level may overlap text
 * 3. **No collision detection**: Manual spacing only
 *
 * ## Future Enhancements (Not Implemented)
 *
 * - [ ] Dynamic viewBox sizing based on hierarchy depth
 * - [ ] Pan/zoom for large systems
 * - [ ] Collapsible branches (click to expand/collapse)
 * - [ ] Export to PDF/SVG
 *
 * @see {@link /docs/adr/006-one-line-diagram-monolith.md} - Justification for monolith
 * @see {@link /CASCADING_HIERARCHY_FIX.md} - Bus bar implementation details
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Project, PanelCircuit, ProjectType } from '../types';
import { generateOneLineDescription } from '../services/geminiService';
import { RefreshCcw, Download, Zap, Plus, Trash2, Grid, Bolt, List, Image, FileCode, Edit2, X, Save } from 'lucide-react';
import { useCircuits } from '../hooks/useCircuits';
import { usePanels } from '../hooks/usePanels';
import { useTransformers } from '../hooks/useTransformers';
import { useFeeders } from '../hooks/useFeeders';
import { FeederManager } from './FeederManager';
import { BulkCircuitCreator } from './BulkCircuitCreator';
import { EquipmentSpecForm } from './EquipmentSpecForm';
import { useTheme } from './ThemeContext';
import {
  validatePanelForm,
  validateCircuitForm,
  validateTransformerForm,
  showValidationErrors
} from '../lib/validation-utils';
import {
  validatePanelConnection,
  getConnectionValidationHelp
} from '../services/validation/panelConnectionValidation';
import { DiagramPanZoom } from './DiagramPanZoom';
import { exportDiagram, DiagramExportOptions } from '../services/pdfExport/oneLineDiagramExport';
import { calculateTreeLayout, getDescendantIds } from '../services/diagram/treeLayoutCalculator';
import type { Database } from '../lib/database.types';

// Database types for glyph functions
type Panel = Database['public']['Tables']['panels']['Row'];
type Transformer = Database['public']['Tables']['transformers']['Row'];

interface OneLineDiagramProps {
  project: Project;
  updateProject?: (p: Project) => void;
  diagramOnly?: boolean; // When true, show only the diagram (enlarged, full-width)
}

export const OneLineDiagram: React.FC<OneLineDiagramProps> = ({ project, updateProject, diagramOnly = false }) => {
  // Use panels, circuits, transformers, and feeders from database
  const { panels, createPanel, updatePanel, deletePanel, getMainPanel } = usePanels(project.id);
  const { circuits, createCircuit, deleteCircuit } = useCircuits(project.id);
  const { transformers, createTransformer, deleteTransformer } = useTransformers(project.id);
  const { feeders } = useFeeders(project.id);

  // Theme for SVG colors
  const { isDark } = useTheme();

  // Theme-aware SVG colors
  const svgColors = {
    gridStroke: isDark ? '#334155' : '#e2e8f0',
    symbolFill: isDark ? '#1e293b' : '#ffffff',
    symbolStroke: isDark ? '#64748b' : '#374151',
    lineStroke: isDark ? '#64748b' : '#374151',
    textFill: isDark ? '#e2e8f0' : '#1e293b',
    textMuted: isDark ? '#94a3b8' : '#64748b',
  };

  const [description, setDescription] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const diagramRef = useRef<SVGSVGElement>(null);

  // Manual dragging state for fine-tuning panel positions
  const [manualOffsets, setManualOffsets] = useState<Map<string, number>>(new Map());
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartOffset, setDragStartOffset] = useState(0);

  // Panel Editor State (for editing existing panels including MDP)
  const [editingPanel, setEditingPanel] = useState<{
    id: string;
    name: string;
    busRating: number;
    mainBreakerAmps: number;
    location: string;
    voltage: number;
    phase: 1 | 3;
  } | null>(null);

  // Equipment Specifications Editor State
  const [showEquipmentSpecs, setShowEquipmentSpecs] = useState(false);
  const [editingEquipmentSpecs, setEditingEquipmentSpecs] = useState<any>(null);

  // Check if project is residential (affects allowed configurations)
  const isResidentialProject = project.type === ProjectType.RESIDENTIAL;

  // Panel Editor State
  const [newPanel, setNewPanel] = useState({
    name: '',
    busRating: 200,
    mainBreakerAmps: 200,
    location: '',
    voltage: project.serviceVoltage,
    phase: project.servicePhase,
    isMain: false,
    fedFromType: 'panel' as 'panel' | 'transformer' | 'service',
    fedFromId: '' // Can be panel ID or transformer ID depending on fedFromType
  });

  // Circuit Editor State
  const [newCircuit, setNewCircuit] = useState<Partial<PanelCircuit> & { panelId?: string; loadType?: string }>({
    circuitNumber: 1,
    description: '',
    breakerAmps: 20,
    pole: 1,
    conductorSize: '12 AWG',
    loadWatts: 0,
    panelId: undefined,
    loadType: 'O' // Default to Other
  });

  // Transformer Editor State
  const [newTransformer, setNewTransformer] = useState({
    name: '',
    location: '',
    kvaRating: 75,
    primaryVoltage: project.serviceVoltage,
    primaryPhase: project.servicePhase,
    primaryBreakerAmps: 100,
    secondaryVoltage: 208,
    secondaryPhase: 3 as 1 | 3,
    fedFromPanelId: ''
  });

  // Bulk Circuit Creator State
  const [showBulkCreator, setShowBulkCreator] = useState(false);
  const [bulkCreatorPanelId, setBulkCreatorPanelId] = useState<string | null>(null);

  // Note: MDP is now added manually by user
  // This gives more control over when/how the main panel is created

  // Set default panel to main when panels load
  useEffect(() => {
    if (panels.length > 0 && !newCircuit.panelId) {
      const mainPanel = getMainPanel();
      if (mainPanel) {
        setNewCircuit(prev => ({ ...prev, panelId: mainPanel.id }));
      }
    }
  }, [panels, newCircuit.panelId, getMainPanel]);

  // Calculate tree layout positions (automatic collision-free spacing)
  const treeLayoutPositions = useMemo(() => {
    return calculateTreeLayout(panels, transformers, {
      minNodeSpacing: 140, // Matches LEVEL1_SPACING
      levelSpacing: 180,
    });
  }, [panels, transformers]);

  /**
   * Calculate maximum depth of panel hierarchy (for dynamic viewBox height)
   */
  const calculateMaxDepth = useMemo(() => {
    const mainPanel = panels.find(p => p.is_main);
    if (!mainPanel) return 3; // Default to 3 levels

    const getDepth = (panelId: string, transformerId: string | null, currentDepth: number): number => {
      // Find panels fed from this panel or transformer
      const childPanels = transformerId
        ? panels.filter(p => p.fed_from_type === 'transformer' && p.fed_from_transformer_id === transformerId)
        : panels.filter(p => p.fed_from_type === 'panel' && p.fed_from === panelId);

      // Find transformers fed from this panel
      const childTransformers = transformerId ? [] : transformers.filter(t => t.fed_from_panel_id === panelId);

      if (childPanels.length === 0 && childTransformers.length === 0) {
        return currentDepth;
      }

      let maxChildDepth = currentDepth;

      // Check depth of child panels
      childPanels.forEach(child => {
        const depth = getDepth(child.id, null, currentDepth + 1);
        maxChildDepth = Math.max(maxChildDepth, depth);
      });

      // Check depth of child transformers and their panels
      childTransformers.forEach(xfmr => {
        const depth = getDepth('', xfmr.id, currentDepth + 1);
        maxChildDepth = Math.max(maxChildDepth, depth);
      });

      return maxChildDepth;
    };

    return getDepth(mainPanel.id, null, 0);
  }, [panels, transformers]);

  /**
   * Calculate Y position for a given level (0 = MDP, 1 = Level 1, 2 = Level 2, etc.)
   */
  const getLevelY = (level: number): number => {
    const BASE_Y = 380; // Level 1 Y position (updated to match LEVEL1_PANEL_Y = 380)
    const LEVEL_SPACING = 210; // Vertical space between levels (increased for proper bus drop clearance)
    return BASE_Y + (level - 1) * LEVEL_SPACING;
  };

  // Dynamic viewBox height based on hierarchy depth
  const viewBoxHeight = useMemo(() => {
    const minHeight = 1100; // Increased to accommodate Level3 at Y=800 + panel height + padding
    const calculatedHeight = getLevelY(calculateMaxDepth) + 300; // Add padding below lowest level
    return Math.max(minHeight, calculatedHeight);
  }, [calculateMaxDepth]);

  // Dynamic viewBox width based on actual content positions
  const viewBoxWidth = useMemo(() => {
    const minWidth = 800; // Minimum width for narrow diagrams
    const SERVICE_X = 400; // Center X position (matches serviceX constant)

    // Calculate maximum X position used by any element
    let maxX = SERVICE_X + 50; // Start with service/MDP center + panel half-width

    // Check all tree layout positions + manual offsets
    // IMPORTANT: Actual positions = SERVICE_X + treeLayoutPosition + manualOffset
    treeLayoutPositions.forEach((treePos, nodeId) => {
      const manualOffset = manualOffsets.get(nodeId) || 0;
      const actualX = SERVICE_X + treePos + manualOffset; // ← Add SERVICE_X!
      maxX = Math.max(maxX, actualX);
    });

    // Add padding for elements that extend beyond panel centers:
    // - Panel width: 65px (32.5px on each side from center) - realistic panel proportions
    // - Feeder label boxes: ~100px (extend to the right)
    // - Right margin: 80px (breathing room)
    const PANEL_HALF_WIDTH = 33; // Updated to match new PANEL_W (65px)
    const FEEDER_LABEL_EXTENSION = 100;
    const RIGHT_MARGIN = 80;

    const calculatedWidth = maxX + PANEL_HALF_WIDTH + FEEDER_LABEL_EXTENSION + RIGHT_MARGIN;

    // Round up to nearest 100 for cleaner numbers
    const roundedWidth = Math.ceil(calculatedWidth / 100) * 100;

    const finalWidth = Math.max(minWidth, roundedWidth);

    // Debug logging
    console.log('📐 ViewBox Width Calculation:', {
      maxElementX: maxX,
      calculatedWidth,
      roundedWidth,
      finalWidth,
      elementCount: treeLayoutPositions.size
    });

    return finalWidth;
  }, [treeLayoutPositions, manualOffsets]);

  // Load manual offsets from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`diagram-manual-offsets-${project.id}`);
    if (saved) {
      try {
        const offsets = JSON.parse(saved);
        setManualOffsets(new Map(Object.entries(offsets).map(([k, v]) => [k, Number(v)])));
      } catch (e) {
        console.error('Failed to load manual offsets:', e);
      }
    }
  }, [project.id]);

  // Save manual offsets to localStorage when they change
  useEffect(() => {
    if (manualOffsets.size > 0) {
      const offsetsObj = Object.fromEntries(manualOffsets);
      localStorage.setItem(`diagram-manual-offsets-${project.id}`, JSON.stringify(offsetsObj));
    }
  }, [manualOffsets, project.id]);

  // Handle dragging mouse events
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingNodeId && diagramRef.current) {
        const svg = diagramRef.current;
        const svgRect = svg.getBoundingClientRect();
        const viewBox = svg.viewBox.baseVal;
        const scaleX = viewBox.width / svgRect.width;
        const deltaX = (e.clientX - dragStartX) * scaleX;
        const newOffset = dragStartOffset + deltaX;

        // Update offset for dragged node AND all descendants (move entire subtree together)
        setManualOffsets(prev => {
          const updated = new Map(prev);

          // Calculate how much the parent moved this frame
          const parentCurrentOffset = prev.get(draggingNodeId) || 0;
          const delta = newOffset - parentCurrentOffset;

          // Apply same delta to parent
          updated.set(draggingNodeId, newOffset);

          // Apply same delta to all descendants (so they move together)
          const descendants = getDescendantIds(draggingNodeId, panels, transformers);
          descendants.forEach(descendantId => {
            const descendantCurrentOffset = prev.get(descendantId) || 0;
            updated.set(descendantId, descendantCurrentOffset + delta);
          });

          return updated;
        });
      }
    };

    const handleMouseUp = () => {
      setDraggingNodeId(null);
    };

    if (draggingNodeId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingNodeId, dragStartX, dragStartOffset, panels, transformers]);

  // Handle dragging touch events (mobile support)
  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (draggingNodeId && diagramRef.current && e.touches.length === 1) {
        e.preventDefault(); // Prevent scrolling while dragging
        const touch = e.touches[0];
        const svg = diagramRef.current;
        const svgRect = svg.getBoundingClientRect();
        const viewBox = svg.viewBox.baseVal;
        const scaleX = viewBox.width / svgRect.width;
        const deltaX = (touch.clientX - dragStartX) * scaleX;
        const newOffset = dragStartOffset + deltaX;

        // Update offset for dragged node AND all descendants (move entire subtree together)
        setManualOffsets(prev => {
          const updated = new Map(prev);

          // Calculate how much the parent moved this frame
          const parentCurrentOffset = prev.get(draggingNodeId) || 0;
          const delta = newOffset - parentCurrentOffset;

          // Apply same delta to parent
          updated.set(draggingNodeId, newOffset);

          // Apply same delta to all descendants (so they move together)
          const descendants = getDescendantIds(draggingNodeId, panels, transformers);
          descendants.forEach(descendantId => {
            const descendantCurrentOffset = prev.get(descendantId) || 0;
            updated.set(descendantId, descendantCurrentOffset + delta);
          });

          return updated;
        });
      }
    };

    const handleTouchEnd = () => {
      setDraggingNodeId(null);
    };

    if (draggingNodeId) {
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
      window.addEventListener('touchcancel', handleTouchEnd);
      return () => {
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
        window.removeEventListener('touchcancel', handleTouchEnd);
      };
    }
  }, [draggingNodeId, dragStartX, dragStartOffset, panels, transformers]);

  /**
   * Get final X position for a node (tree layout + manual offset)
   * Returns position centered around serviceX (400)
   */
  const getFinalPosition = (nodeId: string, serviceX: number): number => {
    const treePos = treeLayoutPositions.get(nodeId) || 0;
    const manualOffset = manualOffsets.get(nodeId) || 0;
    return serviceX + treePos + manualOffset;
  };

  /**
   * Render draggable grip handle for all panels (allows manual positioning)
   */
  const renderDragGrip = (nodeId: string, x: number, y: number, hasDownstream: boolean) => {
    // Always show drag handle to allow manual positioning of any panel

    const gripX = x + 30; // Right side of panel (25 for center + 5 offset)
    const isDragging = draggingNodeId === nodeId;

    return (
      <g
        key={`grip-${nodeId}`}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={(e: React.MouseEvent) => {
          e.stopPropagation();
          const currentOffset = manualOffsets.get(nodeId) || 0;
          setDraggingNodeId(nodeId);
          setDragStartX(e.clientX);
          setDragStartOffset(currentOffset);
        }}
        onTouchStart={(e: React.TouchEvent) => {
          e.stopPropagation();
          if (e.touches.length === 1) {
            const touch = e.touches[0];
            const currentOffset = manualOffsets.get(nodeId) || 0;
            setDraggingNodeId(nodeId);
            setDragStartX(touch.clientX);
            setDragStartOffset(currentOffset);
          }
        }}
      >
        {/* Visual feedback when dragging */}
        {isDragging && (
          <line
            x1={gripX}
            y1={y + 5}
            x2={gripX}
            y2={y + 40}
            stroke="#3B82F6"
            strokeWidth="2"
            strokeDasharray="4,4"
            opacity="0.5"
          />
        )}

        {/* Grip dots */}
        {[12, 17, 22, 27, 32].map((offset, i) => (
          <circle
            key={i}
            cx={gripX}
            cy={y + offset}
            r="2"
            fill={isDragging ? "#3B82F6" : "#9CA3AF"}
            opacity={isDragging ? 1 : 0.6}
          />
        ))}

        {/* Hit area */}
        <rect
          x={gripX - 8}
          y={y + 8}
          width="16"
          height="36"
          fill="transparent"
        />
      </g>
    );
  };

  /**
   * Recursively render a panel/transformer and all its descendants
   * Supports unlimited hierarchy depth
   *
   * @param nodeId - Panel or transformer ID
   * @param nodeType - 'panel' or 'transformer'
   * @param level - Current level (1 = first level after MDP, 2 = second level, etc.)
   * @param parentY - Y position of parent element (for calculating bus position)
   * @param index - Index among siblings (for alternating label directions)
   * @param serviceX - X position of service entrance (for tree layout positioning)
   * @param parentPanelId - ID of parent panel (for feeder labels), null if fed from MDP
   * @param parentTransformerId - ID of parent transformer (for feeder labels), null if fed from panel
   */
  const renderNodeAndDescendants = (
    nodeId: string,
    nodeType: 'panel' | 'transformer',
    level: number,
    parentY: number,
    index: number,
    serviceX: number,
    parentPanelId: string | null = null,
    parentTransformerId: string | null = null
  ): React.ReactElement | null => {
    const currentY = getLevelY(level);
    const xPos = getFinalPosition(nodeId, serviceX);

    if (nodeType === 'panel') {
      const panel = panels.find(p => p.id === nodeId);
      if (!panel) return null;

      const panelCircuits = circuits.filter(c => c.panel_id === panel.id);

      // Get downstream elements
      const downstreamPanels = panels.filter(p => p.fed_from_type === 'panel' && p.fed_from === nodeId);
      const downstreamTransformers = transformers.filter(t => t.fed_from_panel_id === nodeId);
      const totalDownstream = downstreamPanels.length + downstreamTransformers.length;

      // Build downstream positions for bus bar
      const downstreamPositions: { x: number; topY: number }[] = [];
      downstreamPanels.forEach(dp => {
        downstreamPositions.push({ x: getFinalPosition(dp.id, serviceX), topY: getLevelY(level + 1) - DIAGRAM_CONSTANTS.PORT_OFFSET });
      });
      downstreamTransformers.forEach(dt => {
        downstreamPositions.push({ x: getFinalPosition(dt.id, serviceX), topY: getLevelY(level + 1) - DIAGRAM_CONSTANTS.PORT_OFFSET });
      });

      // Calculate bus Y position
      const busY = parentY + DIAGRAM_CONSTANTS.BUS_OFFSET;

      // ✅ PHASE 4: Render professional panel glyph
      const panelGlyph = renderPanelGlyph(xPos, currentY, panel, false);

      return (
        <g key={`panel-${panel.id}-level-${level}`}>
          {/* Feeder Label - shows wire size and conduit from parent to this panel */}
          {renderFeederLabel(
            xPos,
            busY,
            currentY,
            parentPanelId,
            panel.id,
            null,
            index % 2 === 0 ? 'right' : 'left'
          )}

          {/* ✅ Professional panel symbol with connection ports */}
          {panelGlyph.element}

          {/* Bus bar for downstream elements (port-based routing) */}
          {totalDownstream > 0 && renderBusBar(xPos, currentY + DIAGRAM_CONSTANTS.PANEL_HEIGHT, downstreamPositions, "#4B5563")}

          {/* Drag grip */}
          {renderDragGrip(panel.id, xPos, currentY, totalDownstream > 0)}

          {/* Recursively render downstream panels */}
          {downstreamPanels.map((dp, dpIndex) =>
            renderNodeAndDescendants(dp.id, 'panel', level + 1, currentY + DIAGRAM_CONSTANTS.PANEL_HEIGHT, dpIndex, serviceX, panel.id, null)
          )}

          {/* Recursively render downstream transformers */}
          {downstreamTransformers.map((dt, dtIndex) =>
            renderNodeAndDescendants(dt.id, 'transformer', level + 1, currentY + DIAGRAM_CONSTANTS.PANEL_HEIGHT, downstreamPanels.length + dtIndex, serviceX, panel.id, null)
          )}
        </g>
      );
    } else {
      // Transformer rendering
      const transformer = transformers.find(t => t.id === nodeId);
      if (!transformer) return null;

      const downstreamPanels = panels.filter(p => p.fed_from_type === 'transformer' && p.fed_from_transformer_id === nodeId);
      const downstreamPositions = downstreamPanels.map(dp => ({
        x: getFinalPosition(dp.id, serviceX),
        topY: getLevelY(level + 1) - DIAGRAM_CONSTANTS.PORT_OFFSET
      }));

      const busY = parentY + DIAGRAM_CONSTANTS.BUS_OFFSET;

      // ✅ PHASE 4: Render professional transformer glyph
      const transformerGlyph = renderTransformerGlyph(xPos, currentY, transformer);

      return (
        <g key={`xfmr-${transformer.id}-level-${level}`}>
          {/* Feeder Label - shows wire size and conduit from parent panel to this transformer */}
          {renderFeederLabel(
            xPos,
            busY,
            currentY,
            parentPanelId,
            null,
            transformer.id,
            index % 2 === 0 ? 'right' : 'left'
          )}

          {/* ✅ Professional transformer symbol with connection ports */}
          {transformerGlyph.element}

          {/* Bus bar for downstream panels (port-based routing) */}
          {downstreamPanels.length > 0 && renderBusBar(xPos, currentY + DIAGRAM_CONSTANTS.TRANSFORMER_HEIGHT, downstreamPositions, "#F59E0B")}

          {/* Drag grip */}
          {renderDragGrip(transformer.id, xPos, currentY, downstreamPanels.length > 0)}

          {/* Recursively render downstream panels */}
          {downstreamPanels.map((dp, dpIndex) =>
            renderNodeAndDescendants(dp.id, 'panel', level + 1, currentY + DIAGRAM_CONSTANTS.TRANSFORMER_HEIGHT, dpIndex, serviceX, null, transformer.id)
          )}
        </g>
      );
    }
  };

  /**
   * Render feeder label with wire size and conduit info
   * Shows label with leader line and loop grabbing the feeder
   *
   * @param feederLineX - X position of the vertical feeder line
   * @param feederStartY - Y start position of feeder line
   * @param feederEndY - Y end position of feeder line
   * @param sourcePanelId - Source panel ID
   * @param destPanelId - Destination panel ID (or null if transformer)
   * @param destTransformerId - Destination transformer ID (or null if panel)
   * @param offsetDirection - 'left' or 'right' to position label
   */
  const renderFeederLabel = (
    feederLineX: number,
    feederStartY: number,
    feederEndY: number,
    sourcePanelId: string | null,
    destPanelId: string | null,
    destTransformerId: string | null,
    offsetDirection: 'left' | 'right' = 'right'
  ) => {
    // Find matching feeder in database
    const feeder = feeders.find(f => {
      const sourceMatches = f.source_panel_id === sourcePanelId;
      const destMatches = destPanelId
        ? f.destination_panel_id === destPanelId
        : f.destination_transformer_id === destTransformerId;
      return sourceMatches && destMatches;
    });

    // No feeder data = no label
    if (!feeder || !feeder.phase_conductor_size || !feeder.conduit_size) {
      return null;
    }

    // Calculate label position
    const loopY = (feederStartY + feederEndY) / 2; // Middle of feeder line
    const loopRadius = 4;
    const leaderLength = 40;
    const labelOffsetX = offsetDirection === 'right' ? leaderLength : -leaderLength;
    const labelX = feederLineX + labelOffsetX;

    // Build label text lines
    const line1 = `${feeder.phase_conductor_size} ${feeder.conductor_material}`;
    const line2 = feeder.egc_size ? `+ ${feeder.egc_size} EGC` : '';
    const line3 = feeder.conduit_size;

    // Estimate label dimensions (reduced for more compact labels)
    const charWidth = 4.5;  // Reduced from 6
    const lineHeight = 9;   // Reduced from 12
    const padding = 3;      // Reduced from 4
    const maxLineLength = Math.max(line1.length, line2.length, line3.length);
    const labelWidth = maxLineLength * charWidth + padding * 2;
    const labelHeight = (line2 ? 3 : 2) * lineHeight + padding * 2;

    // Adjust label box position based on direction
    const labelBoxX = offsetDirection === 'right' ? labelX : labelX - labelWidth;

    return (
      <g key={`feeder-label-${feeder.id}`}>
        {/* Loop on feeder line */}
        <circle
          cx={feederLineX}
          cy={loopY}
          r={loopRadius}
          fill={svgColors.symbolFill}
          stroke="#6366F1"
          strokeWidth="2"
        />

        {/* Leader line from loop to label */}
        <line
          x1={feederLineX + (offsetDirection === 'right' ? loopRadius : -loopRadius)}
          y1={loopY}
          x2={labelX}
          y2={loopY}
          stroke="#6366F1"
          strokeWidth="1.5"
          strokeDasharray="2,2"
        />

        {/* Label box with border */}
        <rect
          x={labelBoxX}
          y={loopY - labelHeight / 2}
          width={labelWidth}
          height={labelHeight}
          fill={svgColors.symbolFill}
          stroke="#6366F1"
          strokeWidth="1.5"
          rx="3"
        />

        {/* Label text */}
        <text
          x={labelBoxX + padding}
          y={loopY - labelHeight / 2 + lineHeight}
          fontSize="6.5"
          fontWeight="500"
          className="fill-gray-800"
          textAnchor="start"
        >
          {line1}
        </text>
        {line2 && (
          <text
            x={labelBoxX + padding}
            y={loopY - labelHeight / 2 + lineHeight * 2}
            fontSize="8"
            fontWeight="500"
            className="fill-gray-800"
            textAnchor="start"
          >
            {line2}
          </text>
        )}
        <text
          x={labelBoxX + padding}
          y={loopY - labelHeight / 2 + lineHeight * (line2 ? 3 : 2)}
          fontSize="6.5"
          fontWeight="500"
          className="fill-indigo-600"
          textAnchor="start"
        >
          {line3}
        </text>
      </g>
    );
  };

  const handleGenerate = async () => {
    setLoading(true);
    const desc = await generateOneLineDescription(project);
    setDescription(desc || "Failed to generate.");
    setLoading(false);
  };

  const addPanel = async () => {
    if (!newPanel.name) return;

    // Validate panel data
    const validation = validatePanelForm({
      name: newPanel.name,
      voltage: newPanel.voltage,
      phase: newPanel.phase,
      bus_rating: newPanel.busRating,
      main_breaker_amps: newPanel.mainBreakerAmps || null,
      location: newPanel.location || null,
    });

    if (!validation.success) {
      showValidationErrors(validation.errors);
      return;
    }

    // ISSUE #17 FIX: Validate MDP voltage/phase for residential projects
    if (newPanel.isMain && isResidentialProject) {
      // Residential projects must have 120/240V single-phase service
      if (newPanel.voltage !== 240 || newPanel.phase !== 1) {
        alert(
          `❌ Invalid MDP Configuration for Residential Project\n\n` +
          `Residential projects require 120/240V single-phase service.\n\n` +
          `Current selection: ${newPanel.voltage}V ${newPanel.phase}-phase\n` +
          `Required: 240V single-phase\n\n` +
          `Please set the MDP to 240V Single-Phase, or change the project type to Commercial/Industrial for other voltage systems.`
        );
        return;
      }
    }

    // Determine fed_from values based on type
    let fedFrom = null;
    let fedFromTransformerId = null;
    let fedFromType: 'panel' | 'transformer' | 'service' = 'service';

    if (!newPanel.isMain) {
      if (newPanel.fedFromType === 'panel') {
        fedFrom = newPanel.fedFromId || getMainPanel()?.id || null;
        fedFromType = 'panel';
      } else if (newPanel.fedFromType === 'transformer') {
        fedFromTransformerId = newPanel.fedFromId || null;
        fedFromType = 'transformer';
      }
    }

    // Validate voltage/phase compatibility (Issue #5)
    if (!newPanel.isMain) {
      let sourceVoltage: number | null = null;
      let sourcePhase: number | null = null;
      let sourceDescription = '';

      if (fedFromType === 'panel' && fedFrom) {
        const sourcePanel = panels.find(p => p.id === fedFrom);
        if (sourcePanel) {
          sourceVoltage = sourcePanel.voltage;
          sourcePhase = sourcePanel.phase;
          sourceDescription = `panel "${sourcePanel.name}"`;
        }
      } else if (fedFromType === 'transformer' && fedFromTransformerId) {
        const sourceTransformer = transformers.find(t => t.id === fedFromTransformerId);
        if (sourceTransformer) {
          sourceVoltage = sourceTransformer.secondary_voltage;
          sourcePhase = sourceTransformer.secondary_phase;
          sourceDescription = `transformer "${sourceTransformer.name}" secondary`;
        }
      }

      // Perform compatibility validation
      if (sourceVoltage !== null && sourcePhase !== null) {
        const compatibilityResult = validatePanelConnection(
          sourceVoltage,
          sourcePhase,
          newPanel.voltage,
          newPanel.phase
        );

        if (compatibilityResult.severity === 'block') {
          // BLOCK: Show error and prevent creation
          const helpMessage = getConnectionValidationHelp(
            sourceVoltage,
            sourcePhase,
            newPanel.voltage,
            newPanel.phase
          );
          alert(`❌ Cannot create panel connection\n\nFrom: ${sourceDescription} (${sourceVoltage}V ${sourcePhase}φ)\nTo: "${newPanel.name}" (${newPanel.voltage}V ${newPanel.phase}φ)\n\n${helpMessage}`);
          return;
        } else if (compatibilityResult.severity === 'warn') {
          // WARN: Show warning but allow creation if user confirms
          const helpMessage = getConnectionValidationHelp(
            sourceVoltage,
            sourcePhase,
            newPanel.voltage,
            newPanel.phase
          );
          const confirmed = confirm(`⚠️ Unusual panel connection\n\nFrom: ${sourceDescription} (${sourceVoltage}V ${sourcePhase}φ)\nTo: "${newPanel.name}" (${newPanel.voltage}V ${newPanel.phase}φ)\n\n${helpMessage}\n\nDo you want to proceed?`);
          if (!confirmed) {
            return;
          }
        }
        // 'allow' severity - proceed without warning
      }
    }

    const panelData = {
      project_id: project.id,
      name: newPanel.name,
      bus_rating: newPanel.busRating,
      voltage: newPanel.voltage,
      phase: newPanel.phase,
      main_breaker_amps: newPanel.mainBreakerAmps,
      location: newPanel.location || '',
      fed_from: fedFrom,
      fed_from_transformer_id: fedFromTransformerId,
      fed_from_type: fedFromType,
      is_main: newPanel.isMain
    };

    await createPanel(panelData);
    setNewPanel({
      name: '',
      busRating: 200,
      mainBreakerAmps: 200,
      location: '',
      voltage: project.serviceVoltage,
      phase: project.servicePhase,
      isMain: false,
      fedFromType: 'panel',
      fedFromId: ''
    });
  };

  const removePanel = async (id: string) => {
    const panel = panels.find(p => p.id === id);
    if (!panel) return; // Guard check

    if (panel.is_main) {
      const mainPanels = panels.filter(p => p.is_main);

      // Warn user if deleting the only main panel
      if (mainPanels.length === 1) {
        const confirmMessage = `Delete "${panel.name}" (Main Distribution Panel)?\n\n⚠️ WARNING: This is your only main panel. Deleting it will remove the service entrance.\n\nYou'll need to create a new MDP before adding any subpanels.\n\nAre you sure you want to delete it?`;
        if (!confirm(confirmMessage)) {
          return;
        }
      } else {
        // Multiple main panels - confirm deletion
        if (!confirm(`Delete "${panel.name}"? (You have ${mainPanels.length} main panels)`)) {
          return;
        }
      }
    } else {
      // Non-main panel - simple confirmation
      if (!confirm(`Delete panel "${panel.name}"?`)) {
        return;
      }
    }

    await deletePanel(id);
  };

  // ISSUE #18 FIX: Start editing a panel
  const startEditPanel = (panelId: string) => {
    const panel = panels.find(p => p.id === panelId);
    if (!panel) return;

    setEditingPanel({
      id: panel.id,
      name: panel.name,
      busRating: panel.bus_rating,
      mainBreakerAmps: panel.main_breaker_amps || panel.bus_rating,
      location: panel.location || '',
      voltage: panel.voltage,
      phase: panel.phase
    });

    // Initialize equipment specs from panel data
    setEditingEquipmentSpecs({
      manufacturer: (panel as any).manufacturer,
      model_number: (panel as any).model_number,
      nema_enclosure_type: (panel as any).nema_enclosure_type,
      ul_listing: (panel as any).ul_listing,
      aic_rating: (panel as any).aic_rating,
      series_rating: (panel as any).series_rating,
      notes: (panel as any).notes
    });
    setShowEquipmentSpecs(false); // Collapsed by default
  };

  // ISSUE #18 FIX: Cancel editing
  const cancelEditPanel = () => {
    setEditingPanel(null);
    setEditingEquipmentSpecs(null);
    setShowEquipmentSpecs(false);
  };

  // ISSUE #18 FIX: Save panel edits
  const saveEditPanel = async () => {
    if (!editingPanel) return;

    const panel = panels.find(p => p.id === editingPanel.id);
    if (!panel) return;

    // Validate residential constraints if editing MDP
    if (panel.is_main && isResidentialProject) {
      if (editingPanel.voltage !== 240 || editingPanel.phase !== 1) {
        alert(
          `❌ Invalid MDP Configuration for Residential Project\n\n` +
          `Residential projects require 120/240V single-phase service.\n\n` +
          `Please set the MDP to 240V Single-Phase, or change the project type in Project Setup.`
        );
        return;
      }
    }

    // Check if voltage/phase change would affect downstream panels
    if (panel.voltage !== editingPanel.voltage || panel.phase !== editingPanel.phase) {
      const downstreamPanels = panels.filter(p => p.fed_from === editingPanel.id);
      if (downstreamPanels.length > 0) {
        const confirmed = confirm(
          `⚠️ Changing voltage/phase may affect ${downstreamPanels.length} downstream panel(s).\n\n` +
          `Downstream panels: ${downstreamPanels.map(p => p.name).join(', ')}\n\n` +
          `You may need to update or delete these panels after this change.\n\n` +
          `Continue with the change?`
        );
        if (!confirmed) return;
      }
    }

    try {
      await updatePanel(editingPanel.id, {
        name: editingPanel.name,
        bus_rating: editingPanel.busRating,
        main_breaker_amps: editingPanel.mainBreakerAmps,
        location: editingPanel.location,
        voltage: editingPanel.voltage,
        phase: editingPanel.phase,
        // Equipment specifications
        ...(editingEquipmentSpecs && {
          manufacturer: editingEquipmentSpecs.manufacturer,
          model_number: editingEquipmentSpecs.model_number,
          nema_enclosure_type: editingEquipmentSpecs.nema_enclosure_type,
          ul_listing: editingEquipmentSpecs.ul_listing,
          aic_rating: editingEquipmentSpecs.aic_rating,
          series_rating: editingEquipmentSpecs.series_rating,
          notes: editingEquipmentSpecs.notes
        })
      });

      setEditingPanel(null);
      setEditingEquipmentSpecs(null);
      setShowEquipmentSpecs(false);
    } catch (error) {
      console.error('Failed to update panel:', error);
      alert('Failed to update panel. Please try again.');
    }
  };

  // Helper to get all occupied slots for a panel (including multi-pole spans)
  const getOccupiedSlots = (panelId: string) => {
    const panelCircuits = circuits.filter(c => c.panel_id === panelId);
    const occupied = new Set<number>();

    for (const circuit of panelCircuits) {
      if (circuit.pole === 1) {
        occupied.add(circuit.circuit_number);
      } else {
        // Multi-pole circuit occupies multiple slots
        for (let i = 0; i < circuit.pole; i++) {
          occupied.add(circuit.circuit_number + (i * 2));
        }
      }
    }

    return occupied;
  };

  // Helper to find next available circuit number
  const getNextAvailableCircuitNumber = (panelId: string, pole: number) => {
    const occupied = getOccupiedSlots(panelId);

    // Iterate through ALL circuit numbers (both odd and even)
    // Odd = left side (1, 3, 5...), Even = right side (2, 4, 6...)
    for (let candidateNumber = 1; candidateNumber <= 100; candidateNumber++) {
      // Check if this candidate and all its multi-pole span slots are available
      let allSlotsAvailable = true;
      for (let i = 0; i < pole; i++) {
        if (occupied.has(candidateNumber + (i * 2))) {
          allSlotsAvailable = false;
          break;
        }
      }

      if (allSlotsAvailable) {
        return candidateNumber;
      }
    }

    return 1; // Fallback
  };

  // Helper to get valid circuit numbers for dropdown (based on pole count and panel size)
  const getValidCircuitNumbers = (panelId: string, pole: number) => {
    if (!panelId) return [];

    const panel = panels.find(p => p.id === panelId);
    if (!panel) return [];

    const occupied = getOccupiedSlots(panelId);

    // Calculate max circuit number based on panel bus rating
    // Typical: 42 circuits for 200A panel, scale based on bus rating
    const maxCircuits = Math.min(42, Math.ceil(panel.bus_rating / 10));

    const validNumbers: number[] = [];

    // Iterate through ALL circuit numbers (both odd and even)
    // Odd = left side (1, 3, 5...), Even = right side (2, 4, 6...)
    for (let candidateNumber = 1; candidateNumber <= maxCircuits; candidateNumber++) {
      // For multi-pole circuits, ensure all span slots fit within panel
      // Multi-pole circuits span consecutive slots on the SAME side (odd→odd or even→even)
      const lastSlot = candidateNumber + ((pole - 1) * 2);
      if (lastSlot > maxCircuits) {
        continue; // Can't fit in panel, try next number
      }

      // Check if this candidate and all its multi-pole span slots are available
      let allSlotsAvailable = true;
      for (let i = 0; i < pole; i++) {
        if (occupied.has(candidateNumber + (i * 2))) {
          allSlotsAvailable = false;
          break;
        }
      }

      if (allSlotsAvailable) {
        validNumbers.push(candidateNumber);
      }
    }

    return validNumbers;
  };

  // Helper to check if circuit number conflicts with multi-pole circuits
  const isCircuitNumberOccupied = (circuitNumber: number, panelId: string, pole: number) => {
    const panelCircuits = circuits.filter(c => c.panel_id === panelId);

    // Check if ANY existing multi-pole circuit would conflict with this new circuit
    for (const existingCircuit of panelCircuits) {
      if (existingCircuit.pole > 1) {
        // Calculate which slots this existing circuit occupies
        const startSlot = existingCircuit.circuit_number;
        const occupiedSlots = [];
        for (let i = 0; i < existingCircuit.pole; i++) {
          occupiedSlots.push(startSlot + (i * 2));
        }

        // Check if our new circuit would conflict
        // Calculate slots our new circuit would occupy
        const newOccupiedSlots = [];
        for (let i = 0; i < pole; i++) {
          newOccupiedSlots.push(circuitNumber + (i * 2));
        }

        // Check for overlap
        for (const newSlot of newOccupiedSlots) {
          if (occupiedSlots.includes(newSlot)) {
            return {
              occupied: true,
              conflictingCircuit: existingCircuit,
              conflictingSlot: newSlot
            };
          }
        }
      }
    }

    return { occupied: false };
  };

  const addCircuit = async () => {
    if (!newCircuit.description || !newCircuit.panelId) return;

    const panel = panels.find(p => p.id === newCircuit.panelId);
    const panelCircuits = circuits.filter(c => c.panel_id === newCircuit.panelId);

    const pole = newCircuit.pole || 1;
    // Smart circuit number: auto-skip occupied slots from multi-pole circuits
    const circuitNumber = newCircuit.circuitNumber || getNextAvailableCircuitNumber(newCircuit.panelId, pole);
    const breakerAmps = newCircuit.breakerAmps || 20;
    const loadWatts = newCircuit.loadWatts || 0;
    const conductorSize = newCircuit.conductorSize || '12 AWG';

    // ISSUE #17 FIX: Block 3-pole circuits in single-phase panels
    if (panel && panel.phase === 1 && pole === 3) {
      alert(
        `❌ Invalid Circuit Configuration\n\n` +
        `3-pole circuits cannot be installed in single-phase panels.\n\n` +
        `Panel "${panel.name}" is single-phase (120/240V).\n` +
        `Single-phase panels only support 1-pole or 2-pole breakers.\n\n` +
        `For 3-phase loads, you need a 3-phase panel.`
      );
      return;
    }

    // Check for multi-pole circuit conflicts
    const conflict = isCircuitNumberOccupied(circuitNumber, newCircuit.panelId, pole);
    if (conflict.occupied && conflict.conflictingCircuit) {
      alert(`Cannot create circuit at slot ${circuitNumber}.\n\nSlot ${conflict.conflictingSlot} is occupied by ${conflict.conflictingCircuit.pole}-pole circuit "${conflict.conflictingCircuit.description}" starting at slot ${conflict.conflictingCircuit.circuit_number}.\n\nPlease choose a different circuit number.`);
      return;
    }

    // Validate circuit data
    const validation = validateCircuitForm({
      circuit_number: circuitNumber,
      description: newCircuit.description,
      breaker_amps: breakerAmps,
      pole,
      load_watts: loadWatts,
      conductor_size: conductorSize,
    });

    if (!validation.success) {
      showValidationErrors(validation.errors);
      return;
    }

    const circuitData = {
      project_id: project.id,
      panel_id: newCircuit.panelId,
      circuit_number: circuitNumber,
      description: newCircuit.description,
      breaker_amps: breakerAmps,
      pole,
      load_watts: loadWatts,
      conductor_size: conductorSize,
      load_type: newCircuit.loadType || 'O'
    };

    await createCircuit(circuitData);

    // Auto-calculate next available circuit number for the same pole type
    const nextNumber = getNextAvailableCircuitNumber(newCircuit.panelId, pole);

    setNewCircuit({
      ...newCircuit,
      circuitNumber: nextNumber,
      description: '',
      loadWatts: 0,
      loadType: 'O'
    });
  };

  const removeCircuit = async (id: string) => {
    await deleteCircuit(id);
  };

  // Handle diagram export
  const handleExportDiagram = async (format: 'svg' | 'png' | 'pdf') => {
    if (!diagramRef.current) {
      alert('No diagram to export. Please add panels first.');
      return;
    }
    setExporting(true);
    try {
      await exportDiagram(
        diagramRef.current,
        project.name,
        project.address,
        project.serviceVoltage,
        project.servicePhase,
        { format, scale: 2 }
      );
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setExporting(false);
    }
  };

  const openBulkCreator = () => {
    if (!newCircuit.panelId) {
      alert('Please select a panel first');
      return;
    }
    const panelCircuits = circuits.filter(c => c.panel_id === newCircuit.panelId);
    const nextCircuitNumber = panelCircuits.length > 0
      ? Math.max(...panelCircuits.map(c => c.circuit_number)) + 1
      : 1;

    setBulkCreatorPanelId(newCircuit.panelId);
    setShowBulkCreator(true);
  };

  const handleBulkCreateCircuits = async (bulkCircuits: any[]) => {
    if (!bulkCreatorPanelId) return;

    // Get the target panel
    const targetPanel = panels.find(p => p.id === bulkCreatorPanelId);

    try {
      // ISSUE #17 FIX: Validate no 3-pole circuits in single-phase panels
      if (targetPanel && targetPanel.phase === 1) {
        const invalidCircuits = bulkCircuits.filter(c => c.pole === 3);
        if (invalidCircuits.length > 0) {
          const invalidNames = invalidCircuits.map(c => 
            `Circuit ${c.circuit_number}: "${c.description}" (3-pole)`
          ).join('\n');
          
          alert(
            `❌ Invalid Circuit Configuration\n\n` +
            `3-pole circuits cannot be installed in single-phase panels.\n\n` +
            `Panel "${targetPanel.name}" is single-phase (120/240V).\n` +
            `The following circuits are invalid:\n\n${invalidNames}\n\n` +
            `Please change these to 1-pole or 2-pole breakers.`
          );
          return;
        }
      }

      // Validate all circuits for multi-pole conflicts BEFORE creating any
      const conflicts = [];
      for (const circuit of bulkCircuits) {
        const conflict = isCircuitNumberOccupied(circuit.circuit_number, bulkCreatorPanelId, circuit.pole);
        if (conflict.occupied) {
          conflicts.push({
            circuit,
            conflict
          });
        }
      }

      if (conflicts.length > 0) {
        const conflictMessages = conflicts
          .filter(c => c.conflict.conflictingCircuit) // Filter out undefined
          .map(c =>
            `Circuit ${c.circuit.circuit_number} (${c.circuit.description}): Slot ${c.conflict.conflictingSlot} occupied by ${c.conflict.conflictingCircuit!.pole}P circuit "${c.conflict.conflictingCircuit!.description}"`
          )
          .join('\n');

        alert(`Cannot create circuits due to multi-pole slot conflicts:\n\n${conflictMessages}\n\nPlease fix the circuit numbers and try again.`);
        return;
      }

      // Create all circuits
      for (const circuit of bulkCircuits) {
        await createCircuit({
          project_id: project.id,
          panel_id: bulkCreatorPanelId,
          circuit_number: circuit.circuit_number,
          description: circuit.description,
          breaker_amps: circuit.breaker_amps,
          pole: circuit.pole,
          load_watts: circuit.load_watts,
          conductor_size: circuit.conductor_size,
          egc_size: circuit.egc_size
        });
      }

      alert(`Successfully created ${bulkCircuits.length} circuits`);
    } catch (error) {
      console.error('Error creating bulk circuits:', error);
      throw error;
    }
  };

  const addTransformer = async () => {
    if (!newTransformer.name || !newTransformer.fedFromPanelId) return;

    // Validate transformer data
    const validation = validateTransformerForm({
      name: newTransformer.name,
      kva_rating: newTransformer.kvaRating,
      primary_voltage: newTransformer.primaryVoltage,
      secondary_voltage: newTransformer.secondaryVoltage,
      primary_phase: newTransformer.primaryPhase,
      secondary_phase: newTransformer.secondaryPhase,
      connection_type: 'delta-wye',
    });

    if (!validation.success) {
      showValidationErrors(validation.errors);
      return;
    }

    const transformerData = {
      project_id: project.id,
      name: newTransformer.name,
      location: newTransformer.location || '',
      kva_rating: newTransformer.kvaRating,
      primary_voltage: newTransformer.primaryVoltage,
      primary_phase: newTransformer.primaryPhase,
      primary_breaker_amps: newTransformer.primaryBreakerAmps,
      secondary_voltage: newTransformer.secondaryVoltage,
      secondary_phase: newTransformer.secondaryPhase,
      fed_from_panel_id: newTransformer.fedFromPanelId,
      connection_type: 'delta-wye' as const
    };

    await createTransformer(transformerData);
    setNewTransformer({
      name: '',
      location: '',
      kvaRating: 75,
      primaryVoltage: project.serviceVoltage,
      primaryPhase: project.servicePhase,
      primaryBreakerAmps: 100,
      secondaryVoltage: 208,
      secondaryPhase: 3,
      fedFromPanelId: ''
    });
  };

  const removeTransformer = async (id: string) => {
    // Check if any panels are fed from this transformer
    const dependentPanels = panels.filter(p => p.fed_from_transformer_id === id);
    if (dependentPanels.length > 0) {
      alert(`Cannot delete transformer. ${dependentPanels.length} panel(s) are fed from it: ${dependentPanels.map(p => p.name).join(', ')}`);
      return;
    }
    await deleteTransformer(id);
  };

  const serviceX = 400;
  const serviceY = 50;

  // ✅ NEW: One-line diagram rendering constants
  const DIAGRAM_CONSTANTS = {
    // Vertical positions
    UTILITY_Y: 50,
    METER_Y: 90,
    MDP_Y: 170,
    MDP_BUS_Y: 250,
    LEVEL1_PANEL_Y: 380,  // Increased from 360 to provide longer bus drop lines
    LEVEL2_PANEL_Y: 590,  // Increased: 380 + 210 (LEVEL_SPACING)
    LEVEL3_PANEL_Y: 800,  // Increased: 590 + 210 (LEVEL_SPACING)

    // Bus bar offsets (distance below element bottom)
    BUS_OFFSET: 50,       // Distance from parent bottom port to horizontal bus

    // Line styling
    BUS_STROKE_WIDTH: 4,
    FEEDER_STROKE_WIDTH: 2,
    VERTICAL_DROP_STROKE_WIDTH: 2,

    // Horizontal spacing
    LEVEL1_SPACING: 140,
    LEVEL2_SPACING: 90,
    LEVEL3_SPACING: 70,

    // Professional panel symbol dimensions (realistic electrical panel)
    PANEL_W: 65,            // Panel width (narrower, realistic proportions)
    PANEL_H: 100,           // Panel height (taller, vertical orientation like real panels)
    PANEL_HEADER_H: 18,     // Header strip height
    MDP_W: 80,              // MDP width (larger than standard panel)
    MDP_H: 110,             // MDP height (taller than standard panel)

    // Professional transformer symbol dimensions (coil/core style)
    XFMR_W: 100,            // Transformer width (upgraded from 60)
    XFMR_H: 70,             // Transformer height (upgraded from 35)
    XFMR_COIL_W: 20,        // Individual coil width
    XFMR_CORE_W: 4,         // Center core width
    XFMR_TURNS: 3,          // Number of coil turns to draw

    // Connection anchors
    PORT_OFFSET: 0,         // Distance from symbol edge to port center (0 = lines connect directly to symbol edge)
    PORT_RADIUS: 3,         // Visual port circle radius

    // Typography
    HEADER_FONT: 11,        // Header text size
    BODY_FONT: 9,           // Body text size
    SMALL_FONT: 8,          // Small details size

    // Legacy dimensions (kept for backward compatibility)
    PANEL_HEIGHT: 100,      // Updated to match PANEL_H
    PANEL_WIDTH: 65,        // Updated to match PANEL_W
    TRANSFORMER_HEIGHT: 70, // Updated to match XFMR_H
    TRANSFORMER_WIDTH: 100, // Updated to match XFMR_W
    MDP_HEIGHT: 110,        // Updated to match MDP_H
    MDP_WIDTH: 80           // Updated to match MDP_W
  };

  /**
   * Helper to render text with tight white background mask (prevents feeder lines from obscuring text)
   * @param x - X position (text anchor)
   * @param y - Y position (text baseline)
   * @param text - Text content
   * @param textAnchor - Text alignment ('start', 'middle', 'end')
   * @param className - Tailwind CSS classes for text styling
   * @param fontSize - Approximate font size for mask sizing (default: 12)
   */
  const renderMaskedText = (
    x: number,
    y: number,
    text: string | number,
    textAnchor: 'start' | 'middle' | 'end' = 'middle',
    className: string = 'text-xs fill-gray-900',
    fontSize: number = 12
  ) => {
    // Estimate text width (rough approximation: 0.6 * fontSize * character count)
    const charCount = String(text).length;
    const estimatedWidth = charCount * fontSize * 0.6;

    // Calculate mask rectangle position based on text anchor
    let maskX = x;
    if (textAnchor === 'middle') {
      maskX = x - estimatedWidth / 2;
    } else if (textAnchor === 'end') {
      maskX = x - estimatedWidth;
    }

    // Mask height slightly larger than font size
    const maskHeight = fontSize * 1.2;
    const maskY = y - fontSize * 0.85; // Adjust for text baseline

    // Add small padding
    const padding = 2;

    return (
      <g>
        {/* Background mask */}
        <rect
          x={maskX - padding}
          y={maskY - padding}
          width={estimatedWidth + padding * 2}
          height={maskHeight + padding * 2}
          fill={isDark ? '#0f172a' : '#f1f5f9'}
          stroke="none"
        />
        {/* Text on top */}
        <text x={x} y={y} textAnchor={textAnchor} fontSize={fontSize} className={className}>
          {text}
        </text>
      </g>
    );
  };

  // ============================================================================
  // PHASE 2: PROFESSIONAL GLYPH RENDERING FUNCTIONS
  // ============================================================================

  /**
   * Renders a professional panel symbol (realistic electrical panel with door)
   * Returns connection anchors for port-based routing
   */
  const renderPanelGlyph = (
    x: number,
    y: number,
    panel: Panel,
    isMDP: boolean = false
  ): { element: React.ReactNode; topPort: { x: number; y: number }; bottomPort: { x: number; y: number } } => {
    const width = isMDP ? DIAGRAM_CONSTANTS.MDP_W : DIAGRAM_CONSTANTS.PANEL_W;
    const height = isMDP ? DIAGRAM_CONSTANTS.MDP_H : DIAGRAM_CONSTANTS.PANEL_H;
    const headerHeight = DIAGRAM_CONSTANTS.PANEL_HEADER_H;

    // Connection ports
    const topPort = { x, y: y - DIAGRAM_CONSTANTS.PORT_OFFSET };
    const bottomPort = { x, y: y + height + DIAGRAM_CONSTANTS.PORT_OFFSET };

    // Color coding by voltage (MDP stays red, high voltage = dark yellow, low voltage = blue)
    let panelColor = '#3B82F6'; // Default blue for low voltage
    if (isMDP) {
      panelColor = '#DC2626'; // Red for MDP
    } else if (panel.voltage === 480 || panel.voltage === 277) {
      panelColor = '#D97706'; // Dark amber for high voltage
    }

    const element = (
      <g>
        {/* Panel enclosure (outer box) */}
        <rect
          x={x - width / 2}
          y={y}
          width={width}
          height={height}
          fill="#E5E7EB"
          stroke="#6B7280"
          strokeWidth={2}
          rx={2}
        />

        {/* Panel door (inner rectangle with slight inset) */}
        <rect
          x={x - width / 2 + 3}
          y={y + 3}
          width={width - 6}
          height={height - 6}
          fill={svgColors.symbolFill}
          stroke={panelColor}
          strokeWidth={isMDP ? 2.5 : 2}
          rx={1}
        />

        {/* Door hinges (left side, 3 small rectangles) */}
        <rect x={x - width / 2 + 1} y={y + 15} width={4} height={8} fill="#4B5563" rx={1} />
        <rect x={x - width / 2 + 1} y={y + height / 2 - 4} width={4} height={8} fill="#4B5563" rx={1} />
        <rect x={x - width / 2 + 1} y={y + height - 23} width={4} height={8} fill="#4B5563" rx={1} />

        {/* Handle/Lock (right side) */}
        <circle
          cx={x + width / 2 - 6}
          cy={y + height / 2}
          r={3}
          fill="#6B7280"
          stroke="#374151"
          strokeWidth={1}
        />

        {/* Header label plate */}
        <rect
          x={x - width / 2 + 6}
          y={y + 8}
          width={width - 12}
          height={headerHeight}
          fill={panelColor}
          rx={1}
        />

        {/* Panel name in header */}
        <text
          x={x}
          y={y + 8 + headerHeight / 2 + 4}
          textAnchor="middle"
          fontSize={DIAGRAM_CONSTANTS.HEADER_FONT}
          fontWeight="bold"
          fill="white"
        >
          {panel.name}
        </text>

        {/* Directory window (shows circuit info) */}
        <rect
          x={x - width / 2 + 8}
          y={y + headerHeight + 14}
          width={width - 16}
          height={height - headerHeight - 38}
          fill="#F9FAFB"
          stroke="#D1D5DB"
          strokeWidth={1}
          rx={1}
        />

        {/* Circuit lines in directory (simulated) */}
        {[0, 1, 2, 3].map(i => (
          <line
            key={i}
            x1={x - width / 2 + 12}
            y1={y + headerHeight + 20 + i * 8}
            x2={x + width / 2 - 12}
            y2={y + headerHeight + 20 + i * 8}
            stroke="#9CA3AF"
            strokeWidth={0.5}
          />
        ))}

        {/* Ratings at bottom */}
        <text
          x={x}
          y={y + height - 18}
          textAnchor="middle"
          fontSize={DIAGRAM_CONSTANTS.SMALL_FONT}
          fontWeight="bold"
          fill="#374151"
        >
          {panel.bus_rating}A • {panel.main_breaker_amps ? `${panel.main_breaker_amps}A` : 'MLO'}
        </text>

        {/* Voltage/phase at very bottom */}
        <text
          x={x}
          y={y + height - 6}
          textAnchor="middle"
          fontSize={DIAGRAM_CONSTANTS.SMALL_FONT - 1}
          fill="#6B7280"
        >
          {panel.voltage}V {panel.phase === 3 ? '3Φ' : '1Φ'}
        </text>

        {/* Connection ports (visual indicators) */}
        <circle
          cx={topPort.x}
          cy={topPort.y}
          r={DIAGRAM_CONSTANTS.PORT_RADIUS}
          fill="#10B981"
          stroke="white"
          strokeWidth={1}
        />
        <circle
          cx={bottomPort.x}
          cy={bottomPort.y}
          r={DIAGRAM_CONSTANTS.PORT_RADIUS}
          fill="#10B981"
          stroke="white"
          strokeWidth={1}
        />
      </g>
    );

    return { element, topPort, bottomPort };
  };

  /**
   * Renders a professional transformer symbol (coil/core style)
   * Returns connection anchors for port-based routing
   */
  const renderTransformerGlyph = (
    x: number,
    y: number,
    transformer: Transformer
  ): { element: React.ReactNode; topPort: { x: number; y: number }; bottomPort: { x: number; y: number } } => {
    const width = DIAGRAM_CONSTANTS.XFMR_W;
    const height = DIAGRAM_CONSTANTS.XFMR_H;
    const coilWidth = DIAGRAM_CONSTANTS.XFMR_COIL_W;
    const coreWidth = DIAGRAM_CONSTANTS.XFMR_CORE_W;
    const turns = DIAGRAM_CONSTANTS.XFMR_TURNS;

    // Connection ports
    const topPort = { x, y: y - DIAGRAM_CONSTANTS.PORT_OFFSET };
    const bottomPort = { x, y: y + height + DIAGRAM_CONSTANTS.PORT_OFFSET };

    // Calculate coil positions (left primary, right secondary)
    const primaryX = x - coreWidth / 2 - coilWidth / 2;
    const secondaryX = x + coreWidth / 2 + coilWidth / 2;
    const coilY = y + height / 2;
    const coilHeight = height * 0.6;
    const turnHeight = coilHeight / turns;

    const element = (
      <g>
        {/* Background card */}
        <rect
          x={x - width / 2}
          y={y}
          width={width}
          height={height}
          fill={svgColors.symbolFill}
          stroke="#9333EA"
          strokeWidth={2}
          rx={4}
        />

        {/* Iron core (center) */}
        <rect
          x={x - coreWidth / 2}
          y={y + height * 0.15}
          width={coreWidth}
          height={height * 0.7}
          fill="#6B7280"
          stroke="#374151"
          strokeWidth={1}
        />

        {/* Primary coil (left) - sine wave pattern */}
        <g>
          {Array.from({ length: turns }).map((_, i) => (
            <ellipse
              key={`primary-${i}`}
              cx={primaryX}
              cy={coilY - coilHeight / 2 + i * turnHeight + turnHeight / 2}
              rx={coilWidth / 2}
              ry={turnHeight / 2.5}
              fill="none"
              stroke="#DC2626"
              strokeWidth={2}
            />
          ))}
        </g>

        {/* Secondary coil (right) - sine wave pattern */}
        <g>
          {Array.from({ length: turns }).map((_, i) => (
            <ellipse
              key={`secondary-${i}`}
              cx={secondaryX}
              cy={coilY - coilHeight / 2 + i * turnHeight + turnHeight / 2}
              rx={coilWidth / 2}
              ry={turnHeight / 2.5}
              fill="none"
              stroke="#3B82F6"
              strokeWidth={2}
            />
          ))}
        </g>

        {/* Transformer name */}
        <text
          x={x}
          y={y + 12}
          textAnchor="middle"
          fontSize={DIAGRAM_CONSTANTS.HEADER_FONT}
          fontWeight="bold"
          fill="#9333EA"
        >
          {transformer.name}
        </text>

        {/* kVA rating */}
        <text
          x={x}
          y={y + height - 6}
          textAnchor="middle"
          fontSize={DIAGRAM_CONSTANTS.BODY_FONT}
          fill="#374151"
        >
          {transformer.kva_rating}kVA
        </text>

        {/* Primary voltage (left side) */}
        <text
          x={x - width / 2 + 8}
          y={y + height / 2}
          textAnchor="start"
          fontSize={DIAGRAM_CONSTANTS.SMALL_FONT}
          fill="#DC2626"
        >
          {transformer.primary_voltage}V
        </text>

        {/* Secondary voltage (right side) */}
        <text
          x={x + width / 2 - 8}
          y={y + height / 2}
          textAnchor="end"
          fontSize={DIAGRAM_CONSTANTS.SMALL_FONT}
          fill="#3B82F6"
        >
          {transformer.secondary_voltage}V
        </text>

        {/* Connection ports (visual indicators) */}
        <circle
          cx={topPort.x}
          cy={topPort.y}
          r={DIAGRAM_CONSTANTS.PORT_RADIUS}
          fill="#10B981"
          stroke="white"
          strokeWidth={1}
        />
        <circle
          cx={bottomPort.x}
          cy={bottomPort.y}
          r={DIAGRAM_CONSTANTS.PORT_RADIUS}
          fill="#10B981"
          stroke="white"
          strokeWidth={1}
        />
      </g>
    );

    return { element, topPort, bottomPort };
  };

  // ============================================================================
  // PHASE 3: PORT-BASED BUSBAR ROUTING
  // ============================================================================

  /**
   * Renders orthogonal busbar routing from parent bottomPort to child topPorts
   * Supports direct vertical connection (1 child) or horizontal bus + drops (2+ children)
   */
  const renderBusBarFromPorts = (
    parentBottomPort: { x: number; y: number },
    childTopPorts: { x: number; y: number }[],
    strokeColor: string = "#4B5563"
  ): React.ReactNode => {
    if (childTopPorts.length === 0) return null;

    // Single child: Direct vertical line
    if (childTopPorts.length === 1) {
      const childPort = childTopPorts[0];
      if (!childPort) return null;

      return (
        <line
          x1={parentBottomPort.x}
          y1={parentBottomPort.y}
          x2={childPort.x}
          y2={childPort.y}
          stroke={strokeColor}
          strokeWidth={DIAGRAM_CONSTANTS.FEEDER_STROKE_WIDTH}
          strokeDasharray="none"
        />
      );
    }

    // Multiple children: Horizontal bus with vertical drops
    // Bus positioned midway between parent bottom and child tops
    const busY = (parentBottomPort.y + Math.min(...childTopPorts.map(p => p.y))) / 2;
    const minX = Math.min(...childTopPorts.map(p => p.x));
    const maxX = Math.max(...childTopPorts.map(p => p.x));

    return (
      <g>
        {/* Vertical line from parent bottom port to bus */}
        <line
          x1={parentBottomPort.x}
          y1={parentBottomPort.y}
          x2={parentBottomPort.x}
          y2={busY}
          stroke={strokeColor}
          strokeWidth={DIAGRAM_CONSTANTS.FEEDER_STROKE_WIDTH}
        />

        {/* Horizontal bus bar */}
        <line
          x1={minX}
          y1={busY}
          x2={maxX}
          y2={busY}
          stroke={strokeColor}
          strokeWidth={DIAGRAM_CONSTANTS.BUS_STROKE_WIDTH}
        />

        {/* Vertical drops from bus to child top ports */}
        {childTopPorts.map((childPort, idx) => (
          <line
            key={`bus-drop-${idx}`}
            x1={childPort.x}
            y1={busY}
            x2={childPort.x}
            y2={childPort.y}
            stroke={strokeColor}
            strokeWidth={DIAGRAM_CONSTANTS.VERTICAL_DROP_STROKE_WIDTH}
          />
        ))}
      </g>
    );
  };

  // ✅ NEW: Helper to determine if horizontal bus is needed (2+ downstream elements)
  const needsHorizontalBus = (downstreamCount: number) => {
    return downstreamCount >= 2;
  };

  // ✅ NEW: Helper to render horizontal bus with vertical drops
  const renderBusBar = (
    parentX: number,
    parentBottomY: number,
    downstreamElements: { x: number; topY: number }[],
    strokeColor: string = "#4B5563"
  ) => {
    if (downstreamElements.length === 0) return null;

    const busY = parentBottomY + DIAGRAM_CONSTANTS.BUS_OFFSET;
    const needsBus = needsHorizontalBus(downstreamElements.length);

    if (needsBus) {
      // Calculate bus bar extents
      const minX = Math.min(...downstreamElements.map(e => e.x));
      const maxX = Math.max(...downstreamElements.map(e => e.x));

      return (
        <>
          {/* Vertical line from parent to bus */}
          <line
            x1={parentX}
            y1={parentBottomY}
            x2={parentX}
            y2={busY}
            stroke={strokeColor}
            strokeWidth={DIAGRAM_CONSTANTS.FEEDER_STROKE_WIDTH}
          />

          {/* Horizontal bus bar */}
          <line
            x1={minX}
            y1={busY}
            x2={maxX}
            y2={busY}
            stroke={strokeColor}
            strokeWidth={DIAGRAM_CONSTANTS.BUS_STROKE_WIDTH}
          />

          {/* Vertical drops to downstream elements (connect to topPort, not panel top) */}
          {downstreamElements.map((element, idx) => {
            // Panels have topPort at topY - PORT_OFFSET to connect properly
            const connectionY = element.topY - DIAGRAM_CONSTANTS.PORT_OFFSET;
            return (
              <line
                key={`drop-${idx}`}
                x1={element.x}
                y1={busY}
                x2={element.x}
                y2={connectionY}
                stroke={strokeColor}
                strokeWidth={DIAGRAM_CONSTANTS.VERTICAL_DROP_STROKE_WIDTH}
              />
            );
          })}
        </>
      );
    } else if (downstreamElements.length === 1) {
      // Single downstream element - prefer straight vertical line
      const element = downstreamElements[0];
      if (!element) return null;
      const connectionY = element.topY - DIAGRAM_CONSTANTS.PORT_OFFSET;

      // If parent and child are closely aligned (within 5px), draw straight vertical line
      const horizontalOffset = Math.abs(parentX - element.x);
      if (horizontalOffset <= 5) {
        return (
          <line
            x1={parentX}
            y1={parentBottomY}
            x2={parentX}
            y2={connectionY}
            stroke={strokeColor}
            strokeWidth={DIAGRAM_CONSTANTS.FEEDER_STROKE_WIDTH}
          />
        );
      }

      // Otherwise, use orthogonal routing: vertical down, horizontal jog, vertical down
      const jogY = parentBottomY + DIAGRAM_CONSTANTS.BUS_OFFSET;
      return (
        <>
          {/* Vertical line from parent down to jog point */}
          <line
            x1={parentX}
            y1={parentBottomY}
            x2={parentX}
            y2={jogY}
            stroke={strokeColor}
            strokeWidth={DIAGRAM_CONSTANTS.FEEDER_STROKE_WIDTH}
          />
          {/* Horizontal jog to child X position */}
          <line
            x1={parentX}
            y1={jogY}
            x2={element.x}
            y2={jogY}
            stroke={strokeColor}
            strokeWidth={DIAGRAM_CONSTANTS.FEEDER_STROKE_WIDTH}
          />
          {/* Vertical line down to child */}
          <line
            x1={element.x}
            y1={jogY}
            x2={element.x}
            y2={connectionY}
            stroke={strokeColor}
            strokeWidth={DIAGRAM_CONSTANTS.FEEDER_STROKE_WIDTH}
          />
        </>
      );
    }

    return null;
  };

  // ========================================
  // DIAGRAM-ONLY MODE (Enlarged, Full-Width)
  // ========================================
  if (diagramOnly) {
    return (
      <div className="w-full h-[calc(100vh-4rem)] animate-in fade-in duration-500">
        <div className="bg-slate-800 border border-slate-700 rounded-lg h-full overflow-auto relative shadow-inner flex flex-col">
            <div className="absolute top-4 left-4 z-20 bg-slate-800/90 backdrop-blur px-3 py-1 text-xs font-mono border border-slate-700 rounded">
               {project.serviceVoltage}V {project.servicePhase}Φ Service
            </div>

            {/* Export Buttons */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 flex gap-2">
              <button
                onClick={() => handleExportDiagram('pdf')}
                disabled={exporting || panels.length === 0}
                className="bg-electric-500 hover:bg-electric-600 disabled:bg-gray-300 text-black px-3 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors shadow-sm"
                title="Export as PDF (Print)"
              >
                <Download className="w-3 h-3" />
                {exporting ? 'Exporting...' : 'PDF'}
              </button>
              <button
                onClick={() => handleExportDiagram('png')}
                disabled={exporting || panels.length === 0}
                className="bg-slate-800 hover:bg-slate-800 disabled:bg-slate-700 text-slate-300 px-3 py-1 rounded text-xs font-medium border border-slate-700 flex items-center gap-1 transition-colors shadow-sm"
                title="Export as PNG Image"
              >
                <Image className="w-3 h-3" />
                PNG
              </button>
              <button
                onClick={() => handleExportDiagram('svg')}
                disabled={exporting || panels.length === 0}
                className="bg-slate-800 hover:bg-slate-800 disabled:bg-slate-700 text-slate-300 px-3 py-1 rounded text-xs font-medium border border-slate-700 flex items-center gap-1 transition-colors shadow-sm"
                title="Export as SVG Vector"
              >
                <FileCode className="w-3 h-3" />
                SVG
              </button>
              {manualOffsets.size > 0 && (
                <button
                  onClick={() => {
                    setManualOffsets(new Map());
                    localStorage.removeItem(`diagram-manual-offsets-${project.id}`);
                  }}
                  className="bg-slate-800 hover:bg-slate-800 text-slate-300 px-3 py-1 rounded text-xs font-medium border border-slate-700 flex items-center gap-1 transition-colors shadow-sm"
                  title="Reset all manual panel positions to automatic layout"
                >
                  <RefreshCcw className="w-3 h-3" />
                  Reset Layout
                </button>
              )}
            </div>

            <DiagramPanZoom className="w-full h-full flex-1">
            <svg ref={diagramRef} className="w-full bg-slate-800" viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} preserveAspectRatio="xMidYMid meet" style={{ minWidth: `${viewBoxWidth}px`, minHeight: `${viewBoxHeight}px` }}>
                <defs>
                    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                        <path d="M0,0 L0,6 L9,3 z" fill="#9CA3AF" />
                    </marker>
                </defs>

                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke={svgColors.gridStroke} strokeWidth="1"/>
                </pattern>
                <rect width="100%" height="100%" fill="url(#grid)" />

                {/* Utility Service */}
                <circle cx={serviceX} cy={50} r="20" stroke={svgColors.symbolStroke} strokeWidth="2" fill={svgColors.symbolFill} />
                <text x={serviceX} y={55} textAnchor="middle" fontSize="10" fontWeight="bold" className="font-mono" fill={svgColors.textFill}>UTIL</text>
                <text x={serviceX} y={30} textAnchor="middle" fontSize="8" fill={svgColors.textMuted}>
                  {project.serviceVoltage}V {project.servicePhase}Φ
                </text>

                {/* Service Drop Line */}
                <line x1={serviceX} y1={70} x2={serviceX} y2={90} stroke={svgColors.lineStroke} strokeWidth="3" />

                {/* Meter */}
                <rect x={serviceX - 20} y={90} width="40" height="30" stroke={svgColors.symbolStroke} strokeWidth="2" fill={svgColors.symbolFill} />
                <text x={serviceX} y={110} textAnchor="middle" fontSize="10" fontWeight="bold">M</text>

                {/* Service Line to First Panel */}
                <line x1={serviceX} y1={120} x2={serviceX} y2={160} stroke="#111827" strokeWidth="3" />

                {/* Render System Hierarchy */}
                {(() => {
                  const mainPanel = getMainPanel();

                  if (!mainPanel) {
                    return (
                      <text x={400} y={300} textAnchor="middle" fontSize="12" className="fill-gray-400">
                        No main panel configured. Go to Circuit Design to add panels.
                      </text>
                    );
                  }

                  // Build hierarchy: panels fed from main, transformers, panels fed from transformers
                  const panelsFedFromMain = panels.filter(p => !p.is_main && p.fed_from_type === 'panel' && p.fed_from === mainPanel?.id);
                  const transformersFedFromMain = transformers.filter(t => t.fed_from_panel_id === mainPanel?.id);

                  // Calculate total elements for spacing
                  const totalElements = panelsFedFromMain.length + transformersFedFromMain.length;

                  // ✅ BUILD MDP DOWNSTREAM POSITIONS (using tree layout + manual offsets)
                  const mdpDownstreamPositions: { x: number; topY: number }[] = [];

                  // Add all panels fed from MDP (use topPort.y for accurate connection)
                  panelsFedFromMain.forEach((panel) => {
                    mdpDownstreamPositions.push({
                      x: getFinalPosition(panel.id, serviceX),
                      topY: DIAGRAM_CONSTANTS.LEVEL1_PANEL_Y - DIAGRAM_CONSTANTS.PORT_OFFSET
                    });
                  });

                  // Add all transformers fed from MDP (use topPort.y for accurate connection)
                  transformersFedFromMain.forEach((xfmr) => {
                    mdpDownstreamPositions.push({
                      x: getFinalPosition(xfmr.id, serviceX),
                      topY: DIAGRAM_CONSTANTS.LEVEL1_PANEL_Y - DIAGRAM_CONSTANTS.PORT_OFFSET
                    });
                  });

                  return (
                    <>
                      {/* Main Distribution Panel (MDP) */}
                      {mainPanel && (() => {
                        // ✅ PHASE 4: Render professional MDP glyph
                        const mdpGlyph = renderPanelGlyph(serviceX, DIAGRAM_CONSTANTS.MDP_Y, mainPanel, true);

                        return (
                          <>
                            {/* ✅ Professional MDP symbol with connection ports */}
                            {mdpGlyph.element}

                          {/* ✅ FIXED: MDP Bus Bar using actual bottomPort position for accurate connections */}
                          {totalElements > 0 && renderBusBar(
                            serviceX,
                            mdpGlyph.bottomPort.y, // Use actual bottomPort.y for proper connection
                            mdpDownstreamPositions,
                            "#111827"
                          )}

                          {/* ✅ NEW: Use recursive rendering for unlimited depth */}
                          {panelsFedFromMain.map((panel, index) => renderNodeAndDescendants(panel.id, 'panel', 1, DIAGRAM_CONSTANTS.MDP_Y + DIAGRAM_CONSTANTS.MDP_HEIGHT, index, serviceX, mainPanel?.id || null, null))}
                          {transformersFedFromMain.map((xfmr, index) => renderNodeAndDescendants(xfmr.id, 'transformer', 1, DIAGRAM_CONSTANTS.MDP_Y + DIAGRAM_CONSTANTS.MDP_HEIGHT, panelsFedFromMain.length + index, serviceX, mainPanel?.id || null, null))}
                        </>
                        );
                      })()}

                      {/* Message when no panels exist */}
                      {panels.length === 0 && (
                        <text x={400} y={300} textAnchor="middle" fontSize="12" className="fill-gray-400">
                          Add panels using the Circuit Design page to see them here
                        </text>
                      )}
                    </>
                  );
                })()}
            </svg>
            </DiagramPanZoom>

            {description && (
                <div className="p-4 bg-slate-800 border-t border-slate-700 text-xs text-slate-400 max-h-32 overflow-y-auto">
                    <h4 className="font-bold text-white mb-1">AI Analysis</h4>
                    {description}
                </div>
            )}
        </div>
      </div>
    );
  }

  // ========================================
  // FULL LAYOUT MODE (Circuit Design Page)
  // ========================================
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-medium text-white">Circuit Design & One-Line</h2>
          <p className="text-sm text-slate-500">Design branch circuits and generate system diagram.</p>
        </div>
        <div className="flex gap-2">
            <button 
              onClick={handleGenerate}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm font-medium hover:bg-slate-800 text-slate-300"
            >
              <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {description ? 'Regenerate Analysis' : 'Analyze Topology'}
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-electric-400 rounded-md text-sm font-medium hover:bg-electric-500 text-black">
              <Download className="w-4 h-4" />
              Export DWG/PDF
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">

        {/* Left Col: Panel & Circuit Editors */}
        <div className="space-y-6 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto lg:pr-2">
           {/* Add Panel */}
           <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 shadow-sm">
             <h3 className="font-medium text-white mb-4 flex items-center gap-2">
               <Grid className="w-4 h-4 text-electric-500" /> Add Panel/Bus
             </h3>
             <div className="space-y-3">
               <div>
                 <label className="text-xs font-semibold text-slate-500 uppercase">Panel Name</label>
                 <input
                    type="text"
                    value={newPanel.name}
                    onChange={e => setNewPanel({...newPanel, name: e.target.value})}
                    placeholder="e.g. LP - Lighting Panel"
                    className="w-full border-slate-700 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
                 />
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="text-xs font-semibold text-slate-500 uppercase">Voltage (V)</label>
                   <select
                      value={newPanel.voltage}
                      onChange={e => setNewPanel({...newPanel, voltage: Number(e.target.value)})}
                      className="w-full border-slate-700 rounded text-sm py-2"
                   >
                     <option value="120">120V</option>
                     <option value="208">208V</option>
                     <option value="240">240V</option>
                     <option value="277">277V</option>
                     <option value="480">480V</option>
                   </select>
                 </div>
                 <div>
                   <label className="text-xs font-semibold text-slate-500 uppercase">Phase</label>
                   <select
                      value={newPanel.phase}
                      onChange={e => setNewPanel({...newPanel, phase: Number(e.target.value) as 1 | 3})}
                      className="w-full border-slate-700 rounded text-sm py-2"
                   >
                     <option value="1">Single-Phase</option>
                     <option value="3">Three-Phase</option>
                   </select>
                 </div>
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="text-xs font-semibold text-slate-500 uppercase">Bus Rating (A)</label>
                   <input
                      type="number"
                      value={newPanel.busRating}
                      onChange={e => setNewPanel({...newPanel, busRating: Number(e.target.value)})}
                      className="w-full border-slate-700 rounded text-sm py-2"
                   />
                 </div>
                 <div>
                   <label className="text-xs font-semibold text-slate-500 uppercase">Main Breaker (A)</label>
                   <input
                      type="number"
                      value={newPanel.mainBreakerAmps}
                      onChange={e => setNewPanel({...newPanel, mainBreakerAmps: Number(e.target.value)})}
                      className="w-full border-slate-700 rounded text-sm py-2"
                   />
                 </div>
               </div>
               <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Location</label>
                  <input
                    type="text"
                    value={newPanel.location}
                    onChange={e => setNewPanel({...newPanel, location: e.target.value})}
                    placeholder="Optional"
                    className="w-full border-slate-700 rounded text-sm py-2"
                 />
               </div>
               <div className="flex items-center">
                 <input
                   type="checkbox"
                   id="isMainPanel"
                   checked={newPanel.isMain}
                   onChange={e => setNewPanel({...newPanel, isMain: e.target.checked})}
                   className="rounded border-slate-600 text-electric-500 focus:ring-electric-500"
                 />
                 <label htmlFor="isMainPanel" className="ml-2 text-sm text-slate-300 cursor-pointer">
                   This is the Main Distribution Panel (MDP)
                 </label>
               </div>

               {!newPanel.isMain && (
                 <>
                   <div>
                     <label className="text-xs font-semibold text-slate-500 uppercase">Fed From</label>
                     <select
                        value={newPanel.fedFromType}
                        onChange={e => setNewPanel({...newPanel, fedFromType: e.target.value as 'panel' | 'transformer', fedFromId: ''})}
                        className="w-full border-slate-700 rounded text-sm py-2"
                     >
                       <option value="panel">Panel</option>
                       <option value="transformer">Transformer</option>
                     </select>
                   </div>
                   <div>
                     <label className="text-xs font-semibold text-slate-500 uppercase">
                       Select {newPanel.fedFromType === 'panel' ? 'Panel' : 'Transformer'}
                     </label>
                     <select
                        value={newPanel.fedFromId}
                        onChange={e => setNewPanel({...newPanel, fedFromId: e.target.value})}
                        className="w-full border-slate-700 rounded text-sm py-2"
                     >
                       <option value="">Auto-select from MDP</option>
                       {newPanel.fedFromType === 'panel' && panels.map(panel => (
                         <option key={panel.id} value={panel.id}>
                           {panel.name} ({panel.voltage}V {panel.phase}Φ)
                         </option>
                       ))}
                       {newPanel.fedFromType === 'transformer' && transformers.map(xfmr => (
                         <option key={xfmr.id} value={xfmr.id}>
                           {xfmr.name} ({xfmr.secondary_voltage}V {xfmr.secondary_phase}Φ)
                         </option>
                       ))}
                     </select>
                   </div>
                 </>
               )}

               <button
                  onClick={addPanel}
                  className="w-full bg-electric-400 text-black text-sm font-medium py-2 rounded hover:bg-electric-500 transition-colors"
               >
                 Add Panel
               </button>
             </div>
           </div>

           {/* Add Transformer */}
           <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 shadow-sm">
             <h3 className="font-medium text-white mb-4 flex items-center gap-2">
               <Bolt className="w-4 h-4 text-orange-500" /> Add Transformer
             </h3>
             <div className="space-y-3">
               <div>
                 <label className="text-xs font-semibold text-slate-500 uppercase">Transformer Name</label>
                 <input
                    type="text"
                    value={newTransformer.name}
                    onChange={e => setNewTransformer({...newTransformer, name: e.target.value})}
                    placeholder="e.g. XFMR-1"
                    className="w-full border-slate-700 rounded text-sm py-2"
                 />
               </div>
               <div>
                 <label className="text-xs font-semibold text-slate-500 uppercase">Fed From Panel</label>
                 <select
                    value={newTransformer.fedFromPanelId}
                    onChange={e => setNewTransformer({...newTransformer, fedFromPanelId: e.target.value})}
                    className="w-full border-slate-700 rounded text-sm py-2"
                 >
                   <option value="">Select panel...</option>
                   {panels.map(panel => (
                     <option key={panel.id} value={panel.id}>
                       {panel.name} ({panel.voltage}V {panel.phase}Φ)
                     </option>
                   ))}
                 </select>
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="text-xs font-semibold text-slate-500 uppercase">kVA Rating</label>
                   <select
                      value={newTransformer.kvaRating}
                      onChange={e => setNewTransformer({...newTransformer, kvaRating: Number(e.target.value)})}
                      className="w-full border-slate-700 rounded text-sm py-2"
                   >
                     <option value="15">15 kVA</option>
                     <option value="30">30 kVA</option>
                     <option value="45">45 kVA</option>
                     <option value="75">75 kVA</option>
                     <option value="112.5">112.5 kVA</option>
                     <option value="150">150 kVA</option>
                     <option value="225">225 kVA</option>
                     <option value="300">300 kVA</option>
                     <option value="500">500 kVA</option>
                   </select>
                 </div>
                 <div>
                   <label className="text-xs font-semibold text-slate-500 uppercase">Primary Breaker</label>
                   <input
                      type="number"
                      value={newTransformer.primaryBreakerAmps}
                      onChange={e => setNewTransformer({...newTransformer, primaryBreakerAmps: Number(e.target.value)})}
                      className="w-full border-slate-700 rounded text-sm py-2"
                   />
                 </div>
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="text-xs font-semibold text-slate-500 uppercase">Secondary Voltage</label>
                   <select
                      value={newTransformer.secondaryVoltage}
                      onChange={e => setNewTransformer({...newTransformer, secondaryVoltage: Number(e.target.value)})}
                      className="w-full border-slate-700 rounded text-sm py-2"
                   >
                     <option value="120">120V</option>
                     <option value="208">208V</option>
                     <option value="240">240V</option>
                     <option value="277">277V</option>
                     <option value="480">480V</option>
                   </select>
                 </div>
                 <div>
                   <label className="text-xs font-semibold text-slate-500 uppercase">Secondary Phase</label>
                   <select
                      value={newTransformer.secondaryPhase}
                      onChange={e => setNewTransformer({...newTransformer, secondaryPhase: Number(e.target.value) as 1 | 3})}
                      className="w-full border-slate-700 rounded text-sm py-2"
                   >
                     <option value="1">Single-Phase</option>
                     <option value="3">Three-Phase</option>
                   </select>
                 </div>
               </div>
               <div>
                 <label className="text-xs font-semibold text-slate-500 uppercase">Location (Optional)</label>
                 <input
                    type="text"
                    value={newTransformer.location}
                    onChange={e => setNewTransformer({...newTransformer, location: e.target.value})}
                    placeholder="e.g. Electrical Room"
                    className="w-full border-slate-700 rounded text-sm py-2"
                 />
               </div>
               <button
                  onClick={addTransformer}
                  disabled={!newTransformer.fedFromPanelId || !newTransformer.name}
                  className="w-full bg-orange-500 text-white text-sm font-medium py-2 rounded hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 Add Transformer
               </button>
             </div>
           </div>

           {/* Transformers List */}
           {transformers.length > 0 && (
             <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
               <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 text-xs font-medium text-slate-500 uppercase">
                 Transformers ({transformers.length})
               </div>
               <div className="divide-y divide-gray-50 max-h-[200px] overflow-y-auto">
                 {transformers.map(xfmr => {
                   const sourcePanel = panels.find(p => p.id === xfmr.fed_from_panel_id);
                   return (
                     <div key={xfmr.id} className="p-3 flex justify-between items-center hover:bg-slate-800 group">
                       <div>
                         <div className="flex items-center gap-2">
                            <Bolt className="w-4 h-4 text-orange-500" />
                            <span className="text-sm font-medium text-white">{xfmr.name}</span>
                         </div>
                         <div className="text-xs text-slate-500 ml-6">
                           {xfmr.kva_rating} kVA • {xfmr.primary_voltage}V → {xfmr.secondary_voltage}V
                           {sourcePanel && ` • From ${sourcePanel.name}`}
                         </div>
                       </div>
                       <button onClick={() => removeTransformer(xfmr.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100">
                         <Trash2 className="w-4 h-4" />
                       </button>
                     </div>
                   );
                 })}
               </div>
             </div>
           )}

           {/* Panels List */}
           <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
             <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 text-xs font-medium text-slate-500 uppercase">
               Panels ({panels.length})
             </div>
             <div className="divide-y divide-gray-50 max-h-[200px] overflow-y-auto">
               {panels.map(panel => {
                 const mainPanelCount = panels.filter(p => p.is_main).length;
                 const canDelete = !panel.is_main || mainPanelCount > 1;
                 const isEditing = editingPanel?.id === panel.id;

                 return (
                   <div key={panel.id} className={`p-3 ${isEditing ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-slate-800'} group`}>
                     {isEditing ? (
                       // ISSUE #18 FIX: Edit form for panel
                       <div className="space-y-3">
                         <div className="flex items-center justify-between">
                           <span className="text-xs font-semibold text-blue-700 uppercase">Editing Panel</span>
                           <button onClick={cancelEditPanel} className="text-slate-500 hover:text-slate-400">
                             <X className="w-4 h-4" />
                           </button>
                         </div>
                         <input
                           type="text"
                           value={editingPanel.name}
                           onChange={e => setEditingPanel({ ...editingPanel, name: e.target.value })}
                           className="w-full border-slate-700 rounded text-sm py-1.5 px-2"
                           placeholder="Panel Name"
                         />
                         <div className="grid grid-cols-2 gap-2">
                           <div>
                             <label className="text-[10px] text-slate-500 uppercase">Voltage</label>
                             <select
                               value={editingPanel.voltage}
                               onChange={e => setEditingPanel({ ...editingPanel, voltage: Number(e.target.value) })}
                               className="w-full border-slate-700 rounded text-xs py-1"
                               disabled={panel.is_main && isResidentialProject}
                             >
                               <option value="120">120V</option>
                               <option value="208">208V</option>
                               <option value="240">240V</option>
                               <option value="277">277V</option>
                               <option value="480">480V</option>
                             </select>
                           </div>
                           <div>
                             <label className="text-[10px] text-slate-500 uppercase">Phase</label>
                             <select
                               value={editingPanel.phase}
                               onChange={e => setEditingPanel({ ...editingPanel, phase: Number(e.target.value) as 1 | 3 })}
                               className="w-full border-slate-700 rounded text-xs py-1"
                               disabled={panel.is_main && isResidentialProject}
                             >
                               <option value="1">1Φ</option>
                               <option value="3">3Φ</option>
                             </select>
                           </div>
                         </div>
                         <div className="grid grid-cols-2 gap-2">
                           <div>
                             <label className="text-[10px] text-slate-500 uppercase">Bus Rating</label>
                             <input
                               type="number"
                               value={editingPanel.busRating}
                               onChange={e => setEditingPanel({ ...editingPanel, busRating: Number(e.target.value) })}
                               className="w-full border-slate-700 rounded text-xs py-1 px-2"
                             />
                           </div>
                           <div>
                             <label className="text-[10px] text-slate-500 uppercase">Main Breaker</label>
                             <input
                               type="number"
                               value={editingPanel.mainBreakerAmps}
                               onChange={e => setEditingPanel({ ...editingPanel, mainBreakerAmps: Number(e.target.value) })}
                               className="w-full border-slate-700 rounded text-xs py-1 px-2"
                             />
                           </div>
                         </div>
                         <input
                           type="text"
                           value={editingPanel.location}
                           onChange={e => setEditingPanel({ ...editingPanel, location: e.target.value })}
                           className="w-full border-slate-700 rounded text-xs py-1 px-2"
                           placeholder="Location (optional)"
                         />
                         {panel.is_main && isResidentialProject && (
                           <div className="text-[10px] text-amber-600 bg-amber-50 p-2 rounded">
                             ⚠️ Residential: Voltage/Phase locked to 240V/1Φ
                           </div>
                         )}

                         {/* Equipment Specifications Section (Expandable) */}
                         <div className="border-t border-slate-700 pt-3 mt-3">
                           <button
                             onClick={() => setShowEquipmentSpecs(!showEquipmentSpecs)}
                             className="w-full flex items-center justify-between text-xs font-medium text-slate-300 hover:text-blue-600 transition-colors"
                             type="button"
                           >
                             <span className="flex items-center gap-1">
                               <Bolt className="w-3 h-3" />
                               Equipment Specifications (Optional)
                             </span>
                             <span className="text-slate-500">
                               {showEquipmentSpecs ? '▼' : '▶'}
                             </span>
                           </button>

                           {showEquipmentSpecs && editingPanel && (
                             <div className="mt-3 p-3 bg-slate-800 rounded border border-slate-700">
                               <EquipmentSpecForm
                                 type="panel"
                                 currentData={editingEquipmentSpecs || {}}
                                 voltage={editingPanel.voltage}
                                 phase={editingPanel.phase}
                                 busRating={editingPanel.busRating}
                                 onChange={(specs) => setEditingEquipmentSpecs(specs)}
                               />
                             </div>
                           )}
                         </div>

                         <button
                           onClick={saveEditPanel}
                           className="w-full bg-blue-500 text-white text-xs font-medium py-1.5 rounded hover:bg-blue-600 flex items-center justify-center gap-1"
                         >
                           <Save className="w-3 h-3" />
                           Save Changes
                         </button>
                       </div>
                     ) : (
                       // Normal panel display
                       <div className="flex justify-between items-center">
                         <div>
                           <div className="flex items-center gap-2">
                              <Zap className={`w-4 h-4 ${panel.is_main ? 'text-red-500' : 'text-electric-500'}`} />
                              <span className="text-sm font-medium text-white">{panel.name}</span>
                              {panel.is_main && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">MAIN</span>}
                              {panel.is_main && mainPanelCount > 1 && (
                                <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold">DUPLICATE</span>
                              )}
                           </div>
                           <div className="text-xs text-slate-500 ml-6">
                             {panel.bus_rating}A Bus • {panel.main_breaker_amps}A Main • {panel.voltage}V {panel.phase}Φ • {circuits.filter(c => c.panel_id === panel.id).length} ckts
                           </div>
                         </div>
                         <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                           {/* ISSUE #18 FIX: Edit button for all panels including MDP */}
                           <button 
                             onClick={() => startEditPanel(panel.id)} 
                             className="text-gray-300 hover:text-blue-500"
                             title="Edit panel"
                           >
                             <Edit2 className="w-4 h-4" />
                           </button>
                           {canDelete && (
                             <button 
                               onClick={() => removePanel(panel.id)} 
                               className="text-gray-300 hover:text-red-500"
                               title="Delete panel"
                             >
                               <Trash2 className="w-4 h-4" />
                             </button>
                           )}
                         </div>
                       </div>
                     )}
                   </div>
                 );
               })}
             </div>
           </div>
        </div>

        {/* Right Col: Diagram */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg h-[600px] lg:h-[calc(100vh-12rem)] lg:sticky lg:top-4 overflow-auto relative shadow-inner flex flex-col">
            <div className="absolute top-4 left-4 z-20 bg-slate-800/90 backdrop-blur px-3 py-1 text-xs font-mono border border-slate-700 rounded">
               {project.serviceVoltage}V {project.servicePhase}Φ Service
            </div>
            
            {/* Export Buttons */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 flex gap-2">
              <button
                onClick={() => handleExportDiagram('pdf')}
                disabled={exporting || panels.length === 0}
                className="bg-electric-500 hover:bg-electric-600 disabled:bg-gray-300 text-black px-3 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors shadow-sm"
                title="Export as PDF (Print)"
              >
                <Download className="w-3 h-3" />
                {exporting ? 'Exporting...' : 'PDF'}
              </button>
              <button
                onClick={() => handleExportDiagram('png')}
                disabled={exporting || panels.length === 0}
                className="bg-slate-800 hover:bg-slate-800 disabled:bg-slate-700 text-slate-300 px-3 py-1 rounded text-xs font-medium border border-slate-700 flex items-center gap-1 transition-colors shadow-sm"
                title="Export as PNG Image"
              >
                <Image className="w-3 h-3" />
                PNG
              </button>
              <button
                onClick={() => handleExportDiagram('svg')}
                disabled={exporting || panels.length === 0}
                className="bg-slate-800 hover:bg-slate-800 disabled:bg-slate-700 text-slate-300 px-3 py-1 rounded text-xs font-medium border border-slate-700 flex items-center gap-1 transition-colors shadow-sm"
                title="Export as SVG Vector"
              >
                <FileCode className="w-3 h-3" />
                SVG
              </button>
              {manualOffsets.size > 0 && (
                <button
                  onClick={() => {
                    setManualOffsets(new Map());
                    localStorage.removeItem(`diagram-manual-offsets-${project.id}`);
                  }}
                  className="bg-slate-800 hover:bg-slate-800 text-slate-300 px-3 py-1 rounded text-xs font-medium border border-slate-700 flex items-center gap-1 transition-colors shadow-sm"
                  title="Reset all manual panel positions to automatic layout"
                >
                  <RefreshCcw className="w-3 h-3" />
                  Reset Layout
                </button>
              )}
            </div>
            
            <DiagramPanZoom className="w-full h-full flex-1">
            <svg ref={diagramRef} className="w-full bg-slate-800" viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} preserveAspectRatio="xMidYMid meet" style={{ minWidth: `${viewBoxWidth}px`, minHeight: `${viewBoxHeight}px` }}>
                <defs>
                    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                        <path d="M0,0 L0,6 L9,3 z" fill="#9CA3AF" />
                    </marker>
                </defs>

                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke={svgColors.gridStroke} strokeWidth="1"/>
                </pattern>
                <rect width="100%" height="100%" fill="url(#grid)" />

                {/* Utility Service */}
                <circle cx={serviceX} cy={50} r="20" stroke={svgColors.symbolStroke} strokeWidth="2" fill={svgColors.symbolFill} />
                <text x={serviceX} y={55} textAnchor="middle" fontSize="10" fontWeight="bold" className="font-mono" fill={svgColors.textFill}>UTIL</text>
                <text x={serviceX} y={30} textAnchor="middle" fontSize="8" fill={svgColors.textMuted}>
                  {project.serviceVoltage}V {project.servicePhase}Φ
                </text>

                {/* Service Drop Line */}
                <line x1={serviceX} y1={70} x2={serviceX} y2={90} stroke={svgColors.lineStroke} strokeWidth="3" />

                {/* Meter */}
                <rect x={serviceX - 20} y={90} width="40" height="30" stroke={svgColors.symbolStroke} strokeWidth="2" fill={svgColors.symbolFill} />
                <text x={serviceX} y={110} textAnchor="middle" fontSize="10" fontWeight="bold">M</text>

                {/* Service Line to First Panel */}
                <line x1={serviceX} y1={120} x2={serviceX} y2={160} stroke="#111827" strokeWidth="3" />

                {/* Render System Hierarchy */}
                {(() => {
                  const mainPanel = panels.find(p => p.is_main);

                  // ✅ NEW: Recursive function to get all downstream elements for a panel
                  const getDownstreamElements = (panelId: string) => {
                    const downstreamPanels = panels.filter(p =>
                      (p.fed_from_type === 'panel' && p.fed_from === panelId) ||
                      (p.fed_from_type === 'transformer' && panels.find(tp => tp.id === panelId && tp.fed_from_transformer_id))
                    );
                    const downstreamTransformers = transformers.filter(t => t.fed_from_panel_id === panelId);
                    return { panels: downstreamPanels, transformers: downstreamTransformers };
                  };

                  // Build hierarchy: panels fed from main, transformers, panels fed from transformers
                  const panelsFedFromMain = panels.filter(p => !p.is_main && p.fed_from_type === 'panel' && p.fed_from === mainPanel?.id);
                  const transformersFedFromMain = transformers.filter(t => t.fed_from_panel_id === mainPanel?.id);

                  // Calculate total elements for spacing
                  const totalElements = panelsFedFromMain.length + transformersFedFromMain.length;

                  // ✅ BUILD MDP DOWNSTREAM POSITIONS (using tree layout + manual offsets)
                  const mdpDownstreamPositions: { x: number; topY: number }[] = [];

                  // Add all panels fed from MDP (use topPort.y for accurate connection)
                  panelsFedFromMain.forEach((panel) => {
                    mdpDownstreamPositions.push({
                      x: getFinalPosition(panel.id, serviceX),
                      topY: DIAGRAM_CONSTANTS.LEVEL1_PANEL_Y - DIAGRAM_CONSTANTS.PORT_OFFSET
                    });
                  });

                  // Add all transformers fed from MDP (use topPort.y for accurate connection)
                  transformersFedFromMain.forEach((xfmr) => {
                    mdpDownstreamPositions.push({
                      x: getFinalPosition(xfmr.id, serviceX),
                      topY: DIAGRAM_CONSTANTS.LEVEL1_PANEL_Y - DIAGRAM_CONSTANTS.PORT_OFFSET
                    });
                  });

                  return (
                    <>
                      {/* Main Distribution Panel (MDP) */}
                      {mainPanel && (() => {
                        // ✅ PHASE 4: Render professional MDP glyph
                        const mdpGlyph = renderPanelGlyph(serviceX, DIAGRAM_CONSTANTS.MDP_Y, mainPanel, true);

                        return (
                          <>
                            {/* ✅ Professional MDP symbol with connection ports */}
                            {mdpGlyph.element}

                          {/* ✅ FIXED: MDP Bus Bar using actual bottomPort position for accurate connections */}
                          {totalElements > 0 && renderBusBar(
                            serviceX,
                            mdpGlyph.bottomPort.y, // Use actual bottomPort.y for proper connection
                            mdpDownstreamPositions,
                            "#111827"
                          )}

                          {/* ✅ NEW: Use recursive rendering for unlimited depth */}
                          {panelsFedFromMain.map((panel, index) => renderNodeAndDescendants(panel.id, 'panel', 1, DIAGRAM_CONSTANTS.MDP_Y + DIAGRAM_CONSTANTS.MDP_HEIGHT, index, serviceX, mainPanel?.id || null, null))}
                          {transformersFedFromMain.map((xfmr, index) => renderNodeAndDescendants(xfmr.id, 'transformer', 1, DIAGRAM_CONSTANTS.MDP_Y + DIAGRAM_CONSTANTS.MDP_HEIGHT, panelsFedFromMain.length + index, serviceX, mainPanel?.id || null, null))}
                        </>
                        );
                      })()}

                      {/* Message when no panels exist */}
                      {panels.length === 0 && (
                        <text x={400} y={300} textAnchor="middle" fontSize="12" className="fill-gray-400">
                          Add panels using the form on the left to see them here
                        </text>
                      )}
                    </>
                  );
                })()}
            </svg>
            </DiagramPanZoom>

            {description && (
                <div className="p-4 bg-slate-800 border-t border-slate-700 text-xs text-slate-400 max-h-32 overflow-y-auto">
                    <h4 className="font-bold text-white mb-1">AI Analysis</h4>
                    {description}
                </div>
            )}
        </div>
      </div>

      {/* Feeder Management Section */}
      <div className="mt-8 pt-8 border-t border-slate-700">
        <FeederManager
          projectId={project.id}
          projectVoltage={project.serviceVoltage}
          projectPhase={project.servicePhase}
        />
      </div>

      {/* Bulk Circuit Creator Modal */}
      {bulkCreatorPanelId && (() => {
        const bulkPanel = panels.find(p => p.id === bulkCreatorPanelId);
        return (
          <BulkCircuitCreator
            isOpen={showBulkCreator}
            onClose={() => setShowBulkCreator(false)}
            panelId={bulkCreatorPanelId}
            startingCircuitNumber={
              circuits.filter(c => c.panel_id === bulkCreatorPanelId).length > 0
                ? Math.max(...circuits.filter(c => c.panel_id === bulkCreatorPanelId).map(c => c.circuit_number)) + 1
                : 1
            }
            onCreateCircuits={handleBulkCreateCircuits}
            panelPhase={bulkPanel?.phase || 3}
            panelName={bulkPanel?.name || 'Panel'}
          />
        );
      })()}
    </div>
  );
};
