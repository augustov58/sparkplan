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

import React, { useState, useEffect, useRef } from 'react';
import { Project, PanelCircuit, ProjectType } from '../types';
import { generateOneLineDescription } from '../services/geminiService';
import { RefreshCcw, Download, Zap, Plus, Trash2, Grid, Bolt, List, Image, FileCode, Edit2, X, Save } from 'lucide-react';
import { useCircuits } from '../hooks/useCircuits';
import { usePanels } from '../hooks/usePanels';
import { useTransformers } from '../hooks/useTransformers';
import { FeederManager } from './FeederManager';
import { BulkCircuitCreator } from './BulkCircuitCreator';
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

interface OneLineDiagramProps {
  project: Project;
  updateProject?: (p: Project) => void;
}

export const OneLineDiagram: React.FC<OneLineDiagramProps> = ({ project, updateProject }) => {
  // Use panels, circuits, and transformers from database
  const { panels, createPanel, updatePanel, deletePanel, getMainPanel } = usePanels(project.id);
  const { circuits, createCircuit, deleteCircuit } = useCircuits(project.id);
  const { transformers, createTransformer, deleteTransformer } = useTransformers(project.id);

  const [description, setDescription] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const diagramRef = useRef<SVGSVGElement>(null);

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

    if (panel?.is_main) {
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
  };

  // ISSUE #18 FIX: Cancel editing
  const cancelEditPanel = () => {
    setEditingPanel(null);
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
        phase: editingPanel.phase
      });

      setEditingPanel(null);
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
    if (conflict.occupied) {
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
        const conflictMessages = conflicts.map(c =>
          `Circuit ${c.circuit.circuit_number} (${c.circuit.description}): Slot ${c.conflict.conflictingSlot} occupied by ${c.conflict.conflictingCircuit.pole}P circuit "${c.conflict.conflictingCircuit.description}"`
        ).join('\n');

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
    LEVEL1_PANEL_Y: 320,
    LEVEL2_PANEL_Y: 450,  // Increased from 430 to accommodate bus
    LEVEL3_PANEL_Y: 580,  // Increased from 540 to accommodate bus

    // Bus bar offsets (distance below element bottom)
    BUS_OFFSET: 40,

    // Line styling
    BUS_STROKE_WIDTH: 4,
    FEEDER_STROKE_WIDTH: 2,
    VERTICAL_DROP_STROKE_WIDTH: 2,

    // Horizontal spacing
    LEVEL1_SPACING: 140,
    LEVEL2_SPACING: 90,
    LEVEL3_SPACING: 70,

    // Element dimensions
    PANEL_HEIGHT: 30,
    PANEL_WIDTH: 50,
    TRANSFORMER_HEIGHT: 35,
    TRANSFORMER_WIDTH: 60,
    MDP_HEIGHT: 40,
    MDP_WIDTH: 60
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

          {/* Vertical drops to downstream elements */}
          {downstreamElements.map((element, idx) => (
            <line
              key={`drop-${idx}`}
              x1={element.x}
              y1={busY}
              x2={element.x}
              y2={element.topY}
              stroke={strokeColor}
              strokeWidth={DIAGRAM_CONSTANTS.VERTICAL_DROP_STROKE_WIDTH}
            />
          ))}
        </>
      );
    } else if (downstreamElements.length === 1) {
      // Direct vertical line (no bus needed)
      const element = downstreamElements[0];
      return (
        <line
          x1={parentX}
          y1={parentBottomY}
          x2={element.x}
          y2={element.topY}
          stroke={strokeColor}
          strokeWidth={DIAGRAM_CONSTANTS.FEEDER_STROKE_WIDTH}
        />
      );
    }

    return null;
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Circuit Design & One-Line</h2>
          <p className="text-sm text-gray-500">Design branch circuits and generate system diagram.</p>
        </div>
        <div className="flex gap-2">
            <button 
              onClick={handleGenerate}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium hover:bg-gray-50 text-gray-700"
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Col: Panel & Circuit Editors */}
        <div className="space-y-6">
           {/* Add Panel */}
           <div className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm">
             <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
               <Grid className="w-4 h-4 text-electric-500" /> Add Panel/Bus
             </h3>
             <div className="space-y-3">
               <div>
                 <label className="text-xs font-semibold text-gray-500 uppercase">Panel Name</label>
                 <input
                    type="text"
                    value={newPanel.name}
                    onChange={e => setNewPanel({...newPanel, name: e.target.value})}
                    placeholder="e.g. LP - Lighting Panel"
                    className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
                 />
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="text-xs font-semibold text-gray-500 uppercase">Voltage (V)</label>
                   <select
                      value={newPanel.voltage}
                      onChange={e => setNewPanel({...newPanel, voltage: Number(e.target.value)})}
                      className="w-full border-gray-200 rounded text-sm py-2"
                   >
                     <option value="120">120V</option>
                     <option value="208">208V</option>
                     <option value="240">240V</option>
                     <option value="277">277V</option>
                     <option value="480">480V</option>
                   </select>
                 </div>
                 <div>
                   <label className="text-xs font-semibold text-gray-500 uppercase">Phase</label>
                   <select
                      value={newPanel.phase}
                      onChange={e => setNewPanel({...newPanel, phase: Number(e.target.value) as 1 | 3})}
                      className="w-full border-gray-200 rounded text-sm py-2"
                   >
                     <option value="1">Single-Phase</option>
                     <option value="3">Three-Phase</option>
                   </select>
                 </div>
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="text-xs font-semibold text-gray-500 uppercase">Bus Rating (A)</label>
                   <input
                      type="number"
                      value={newPanel.busRating}
                      onChange={e => setNewPanel({...newPanel, busRating: Number(e.target.value)})}
                      className="w-full border-gray-200 rounded text-sm py-2"
                   />
                 </div>
                 <div>
                   <label className="text-xs font-semibold text-gray-500 uppercase">Main Breaker (A)</label>
                   <input
                      type="number"
                      value={newPanel.mainBreakerAmps}
                      onChange={e => setNewPanel({...newPanel, mainBreakerAmps: Number(e.target.value)})}
                      className="w-full border-gray-200 rounded text-sm py-2"
                   />
                 </div>
               </div>
               <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Location</label>
                  <input
                    type="text"
                    value={newPanel.location}
                    onChange={e => setNewPanel({...newPanel, location: e.target.value})}
                    placeholder="Optional"
                    className="w-full border-gray-200 rounded text-sm py-2"
                 />
               </div>
               <div className="flex items-center">
                 <input
                   type="checkbox"
                   id="isMainPanel"
                   checked={newPanel.isMain}
                   onChange={e => setNewPanel({...newPanel, isMain: e.target.checked})}
                   className="rounded border-gray-300 text-electric-500 focus:ring-electric-500"
                 />
                 <label htmlFor="isMainPanel" className="ml-2 text-sm text-gray-700 cursor-pointer">
                   This is the Main Distribution Panel (MDP)
                 </label>
               </div>

               {!newPanel.isMain && (
                 <>
                   <div>
                     <label className="text-xs font-semibold text-gray-500 uppercase">Fed From</label>
                     <select
                        value={newPanel.fedFromType}
                        onChange={e => setNewPanel({...newPanel, fedFromType: e.target.value as 'panel' | 'transformer', fedFromId: ''})}
                        className="w-full border-gray-200 rounded text-sm py-2"
                     >
                       <option value="panel">Panel</option>
                       <option value="transformer">Transformer</option>
                     </select>
                   </div>
                   <div>
                     <label className="text-xs font-semibold text-gray-500 uppercase">
                       Select {newPanel.fedFromType === 'panel' ? 'Panel' : 'Transformer'}
                     </label>
                     <select
                        value={newPanel.fedFromId}
                        onChange={e => setNewPanel({...newPanel, fedFromId: e.target.value})}
                        className="w-full border-gray-200 rounded text-sm py-2"
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

           {/* Add Circuit */}
           <div className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm">
             <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
               <Plus className="w-4 h-4 text-electric-500" /> Add Circuit
             </h3>
             <div className="space-y-3">
               <div>
                 <label className="text-xs font-semibold text-gray-500 uppercase">Assign to Panel</label>
                 <select
                    value={newCircuit.panelId || ''}
                    onChange={e => {
                      // Reset circuit number when panel changes (different panels have different occupied slots)
                      setNewCircuit({...newCircuit, panelId: e.target.value, circuitNumber: undefined});
                    }}
                    className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
                 >
                   {panels.length === 0 && <option value="">No panels available</option>}
                   {panels.map(panel => (
                     <option key={panel.id} value={panel.id}>
                       {panel.name} ({panel.bus_rating}A)
                     </option>
                   ))}
                 </select>
               </div>
               <div>
                 <label className="text-xs font-semibold text-gray-500 uppercase">Description</label>
                 <input
                    type="text"
                    value={newCircuit.description}
                    onChange={e => setNewCircuit({...newCircuit, description: e.target.value})}
                    placeholder="e.g. Master Bedroom Plugs"
                    className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
                 />
               </div>
               <div>
                 <label className="text-xs font-semibold text-gray-500 uppercase">
                   Circuit Number (Starting Slot)
                 </label>
                 <select
                    value={newCircuit.circuitNumber || ''}
                    onChange={e => setNewCircuit({...newCircuit, circuitNumber: Number(e.target.value)})}
                    className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
                    disabled={!newCircuit.panelId}
                 >
                   <option value="">Auto (next available)</option>
                   {getValidCircuitNumbers(newCircuit.panelId || '', newCircuit.pole || 1).map(num => {
                     const pole = newCircuit.pole || 1;
                     const spanSlots = pole > 1 ? ` (spans ${[...Array(pole)].map((_, i) => num + (i * 2)).join(', ')})` : '';
                     return (
                       <option key={num} value={num}>
                         Slot {num}{spanSlots}
                       </option>
                     );
                   })}
                 </select>
               </div>
              <div className="grid grid-cols-5 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Load (VA)</label>
                  <input
                     type="number"
                     value={newCircuit.loadWatts || ''}
                     onChange={e => setNewCircuit({...newCircuit, loadWatts: Number(e.target.value)})}
                     placeholder="0"
                     className="w-full border-gray-200 rounded text-sm py-2"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Type</label>
                  <select
                     value={newCircuit.loadType || 'O'}
                     onChange={e => setNewCircuit({...newCircuit, loadType: e.target.value})}
                     className="w-full border-gray-200 rounded text-sm py-2"
                     title="Load Type for NEC 220 Demand Factor"
                  >
                    <option value="L">L - Lighting</option>
                    <option value="M">M - Motor</option>
                    <option value="R">R - Receptacle</option>
                    <option value="O">O - Other</option>
                    <option value="H">H - Heating</option>
                    <option value="C">C - Cooling</option>
                    <option value="W">W - Water Htr</option>
                    <option value="D">D - Dryer</option>
                    <option value="K">K - Kitchen</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Breaker</label>
                  <select
                     value={newCircuit.breakerAmps}
                     onChange={e => setNewCircuit({...newCircuit, breakerAmps: Number(e.target.value)})}
                     className="w-full border-gray-200 rounded text-sm py-2"
                  >
                    <option value="15">15A</option>
                    <option value="20">20A</option>
                    <option value="30">30A</option>
                    <option value="40">40A</option>
                    <option value="50">50A</option>
                    <option value="60">60A</option>
                    <option value="100">100A</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Poles</label>
                  {(() => {
                    const selectedPanel = panels.find(p => p.id === newCircuit.panelId);
                    const isSinglePhasePanel = selectedPanel?.phase === 1;
                    return (
                      <select
                         value={newCircuit.pole}
                         onChange={e => {
                           const newPole = Number(e.target.value) as 1|2|3;
                           // Reset circuit number when pole changes so dropdown recalculates
                           setNewCircuit({...newCircuit, pole: newPole, circuitNumber: undefined});
                         }}
                         className="w-full border-gray-200 rounded text-sm py-2"
                      >
                        <option value="1">1P</option>
                        <option value="2">2P</option>
                        {/* ISSUE #17 FIX: Disable 3P for single-phase panels */}
                        <option value="3" disabled={isSinglePhasePanel}>
                          3P {isSinglePhasePanel && '(3Φ only)'}
                        </option>
                      </select>
                    );
                  })()}
                </div>
                <div>
                   <label className="text-xs font-semibold text-gray-500 uppercase">Wire</label>
                   <input
                     type="text"
                     value={newCircuit.conductorSize}
                     onChange={e => setNewCircuit({...newCircuit, conductorSize: e.target.value})}
                     placeholder="12 AWG"
                     className="w-full border-gray-200 rounded text-sm py-2"
                  />
                </div>
              </div>
               <div className="flex gap-2">
                 <button
                    onClick={addCircuit}
                    disabled={!newCircuit.panelId}
                    className="flex-1 bg-gray-900 text-white text-sm font-medium py-2 rounded hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   Add Circuit
                 </button>
                 <button
                    onClick={openBulkCreator}
                    disabled={!newCircuit.panelId}
                    className="flex-1 bg-electric-400 text-black text-sm font-medium py-2 rounded hover:bg-electric-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    title="Add multiple circuits at once"
                 >
                   <List className="w-4 h-4" />
                   Bulk Add
                 </button>
               </div>
             </div>
           </div>

           {/* Add Transformer */}
           <div className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm">
             <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
               <Bolt className="w-4 h-4 text-orange-500" /> Add Transformer
             </h3>
             <div className="space-y-3">
               <div>
                 <label className="text-xs font-semibold text-gray-500 uppercase">Transformer Name</label>
                 <input
                    type="text"
                    value={newTransformer.name}
                    onChange={e => setNewTransformer({...newTransformer, name: e.target.value})}
                    placeholder="e.g. XFMR-1"
                    className="w-full border-gray-200 rounded text-sm py-2"
                 />
               </div>
               <div>
                 <label className="text-xs font-semibold text-gray-500 uppercase">Fed From Panel</label>
                 <select
                    value={newTransformer.fedFromPanelId}
                    onChange={e => setNewTransformer({...newTransformer, fedFromPanelId: e.target.value})}
                    className="w-full border-gray-200 rounded text-sm py-2"
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
                   <label className="text-xs font-semibold text-gray-500 uppercase">kVA Rating</label>
                   <select
                      value={newTransformer.kvaRating}
                      onChange={e => setNewTransformer({...newTransformer, kvaRating: Number(e.target.value)})}
                      className="w-full border-gray-200 rounded text-sm py-2"
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
                   <label className="text-xs font-semibold text-gray-500 uppercase">Primary Breaker</label>
                   <input
                      type="number"
                      value={newTransformer.primaryBreakerAmps}
                      onChange={e => setNewTransformer({...newTransformer, primaryBreakerAmps: Number(e.target.value)})}
                      className="w-full border-gray-200 rounded text-sm py-2"
                   />
                 </div>
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="text-xs font-semibold text-gray-500 uppercase">Secondary Voltage</label>
                   <select
                      value={newTransformer.secondaryVoltage}
                      onChange={e => setNewTransformer({...newTransformer, secondaryVoltage: Number(e.target.value)})}
                      className="w-full border-gray-200 rounded text-sm py-2"
                   >
                     <option value="120">120V</option>
                     <option value="208">208V</option>
                     <option value="240">240V</option>
                     <option value="277">277V</option>
                     <option value="480">480V</option>
                   </select>
                 </div>
                 <div>
                   <label className="text-xs font-semibold text-gray-500 uppercase">Secondary Phase</label>
                   <select
                      value={newTransformer.secondaryPhase}
                      onChange={e => setNewTransformer({...newTransformer, secondaryPhase: Number(e.target.value) as 1 | 3})}
                      className="w-full border-gray-200 rounded text-sm py-2"
                   >
                     <option value="1">Single-Phase</option>
                     <option value="3">Three-Phase</option>
                   </select>
                 </div>
               </div>
               <div>
                 <label className="text-xs font-semibold text-gray-500 uppercase">Location (Optional)</label>
                 <input
                    type="text"
                    value={newTransformer.location}
                    onChange={e => setNewTransformer({...newTransformer, location: e.target.value})}
                    placeholder="e.g. Electrical Room"
                    className="w-full border-gray-200 rounded text-sm py-2"
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
             <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
               <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase">
                 Transformers ({transformers.length})
               </div>
               <div className="divide-y divide-gray-50 max-h-[200px] overflow-y-auto">
                 {transformers.map(xfmr => {
                   const sourcePanel = panels.find(p => p.id === xfmr.fed_from_panel_id);
                   return (
                     <div key={xfmr.id} className="p-3 flex justify-between items-center hover:bg-gray-50 group">
                       <div>
                         <div className="flex items-center gap-2">
                            <Bolt className="w-4 h-4 text-orange-500" />
                            <span className="text-sm font-medium text-gray-900">{xfmr.name}</span>
                         </div>
                         <div className="text-xs text-gray-500 ml-6">
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
           <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
             <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase">
               Panels ({panels.length})
             </div>
             <div className="divide-y divide-gray-50 max-h-[200px] overflow-y-auto">
               {panels.map(panel => {
                 const mainPanelCount = panels.filter(p => p.is_main).length;
                 const canDelete = !panel.is_main || mainPanelCount > 1;
                 const isEditing = editingPanel?.id === panel.id;

                 return (
                   <div key={panel.id} className={`p-3 ${isEditing ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50'} group`}>
                     {isEditing ? (
                       // ISSUE #18 FIX: Edit form for panel
                       <div className="space-y-3">
                         <div className="flex items-center justify-between">
                           <span className="text-xs font-semibold text-blue-700 uppercase">Editing Panel</span>
                           <button onClick={cancelEditPanel} className="text-gray-400 hover:text-gray-600">
                             <X className="w-4 h-4" />
                           </button>
                         </div>
                         <input
                           type="text"
                           value={editingPanel.name}
                           onChange={e => setEditingPanel({ ...editingPanel, name: e.target.value })}
                           className="w-full border-gray-200 rounded text-sm py-1.5 px-2"
                           placeholder="Panel Name"
                         />
                         <div className="grid grid-cols-2 gap-2">
                           <div>
                             <label className="text-[10px] text-gray-500 uppercase">Voltage</label>
                             <select
                               value={editingPanel.voltage}
                               onChange={e => setEditingPanel({ ...editingPanel, voltage: Number(e.target.value) })}
                               className="w-full border-gray-200 rounded text-xs py-1"
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
                             <label className="text-[10px] text-gray-500 uppercase">Phase</label>
                             <select
                               value={editingPanel.phase}
                               onChange={e => setEditingPanel({ ...editingPanel, phase: Number(e.target.value) as 1 | 3 })}
                               className="w-full border-gray-200 rounded text-xs py-1"
                               disabled={panel.is_main && isResidentialProject}
                             >
                               <option value="1">1Φ</option>
                               <option value="3">3Φ</option>
                             </select>
                           </div>
                         </div>
                         <div className="grid grid-cols-2 gap-2">
                           <div>
                             <label className="text-[10px] text-gray-500 uppercase">Bus Rating</label>
                             <input
                               type="number"
                               value={editingPanel.busRating}
                               onChange={e => setEditingPanel({ ...editingPanel, busRating: Number(e.target.value) })}
                               className="w-full border-gray-200 rounded text-xs py-1 px-2"
                             />
                           </div>
                           <div>
                             <label className="text-[10px] text-gray-500 uppercase">Main Breaker</label>
                             <input
                               type="number"
                               value={editingPanel.mainBreakerAmps}
                               onChange={e => setEditingPanel({ ...editingPanel, mainBreakerAmps: Number(e.target.value) })}
                               className="w-full border-gray-200 rounded text-xs py-1 px-2"
                             />
                           </div>
                         </div>
                         <input
                           type="text"
                           value={editingPanel.location}
                           onChange={e => setEditingPanel({ ...editingPanel, location: e.target.value })}
                           className="w-full border-gray-200 rounded text-xs py-1 px-2"
                           placeholder="Location (optional)"
                         />
                         {panel.is_main && isResidentialProject && (
                           <div className="text-[10px] text-amber-600 bg-amber-50 p-2 rounded">
                             ⚠️ Residential: Voltage/Phase locked to 240V/1Φ
                           </div>
                         )}
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
                              <span className="text-sm font-medium text-gray-900">{panel.name}</span>
                              {panel.is_main && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">MAIN</span>}
                              {panel.is_main && mainPanelCount > 1 && (
                                <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold">DUPLICATE</span>
                              )}
                           </div>
                           <div className="text-xs text-gray-500 ml-6">
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
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-lg h-[600px] overflow-hidden relative shadow-inner flex flex-col">
            <div className="absolute top-4 left-4 z-20 bg-white/90 backdrop-blur px-3 py-1 text-xs font-mono border border-gray-200 rounded">
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
                className="bg-white hover:bg-gray-50 disabled:bg-gray-100 text-gray-700 px-3 py-1 rounded text-xs font-medium border border-gray-200 flex items-center gap-1 transition-colors shadow-sm"
                title="Export as PNG Image"
              >
                <Image className="w-3 h-3" />
                PNG
              </button>
              <button
                onClick={() => handleExportDiagram('svg')}
                disabled={exporting || panels.length === 0}
                className="bg-white hover:bg-gray-50 disabled:bg-gray-100 text-gray-700 px-3 py-1 rounded text-xs font-medium border border-gray-200 flex items-center gap-1 transition-colors shadow-sm"
                title="Export as SVG Vector"
              >
                <FileCode className="w-3 h-3" />
                SVG
              </button>
            </div>
            
            <DiagramPanZoom className="w-full h-full flex-1">
            <svg ref={diagramRef} className="w-full bg-white" viewBox="0 0 800 750" preserveAspectRatio="xMidYMid meet" style={{ minWidth: '800px', minHeight: '750px' }}>
                <defs>
                    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                        <path d="M0,0 L0,6 L9,3 z" fill="#9CA3AF" />
                    </marker>
                </defs>

                {/* Enhanced Grid Background */}
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E5E7EB" strokeWidth="0.5"/>
                </pattern>
                <rect width="100%" height="100%" fill="#FAFAFA" />
                <rect width="100%" height="100%" fill="url(#grid)" opacity="0.5" />

                {/* Utility Service - Enhanced */}
                <defs>
                    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.15"/>
                    </filter>
                    <filter id="shadow-lg" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#000000" floodOpacity="0.2"/>
                    </filter>
                </defs>
                <circle 
                    cx={serviceX} 
                    cy={50} 
                    r="22" 
                    stroke="#1F2937" 
                    strokeWidth="2.5" 
                    fill="white"
                    filter="url(#shadow)"
                />
                <circle 
                    cx={serviceX} 
                    cy={50} 
                    r="18" 
                    stroke="#3B82F6" 
                    strokeWidth="1" 
                    fill="none"
                    strokeDasharray="2,2"
                />
                <text x={serviceX} y={56} textAnchor="middle" className="text-xs font-bold font-mono fill-gray-900">UTIL</text>
                <text x={serviceX} y={28} textAnchor="middle" className="text-[10px] font-semibold fill-gray-700">
                  {project.serviceVoltage}V {project.servicePhase}Φ
                </text>

                {/* Service Drop Line - Enhanced */}
                <line x1={serviceX} y1={72} x2={serviceX} y2={88} stroke="#1F2937" strokeWidth="4" strokeLinecap="round" />

                {/* Meter - Enhanced */}
                <rect 
                    x={serviceX - 22} 
                    y={88} 
                    width="44" 
                    height="34" 
                    rx="3"
                    stroke="#1F2937" 
                    strokeWidth="2.5" 
                    fill="white"
                    filter="url(#shadow)"
                />
                <rect 
                    x={serviceX - 18} 
                    y={92} 
                    width="36" 
                    height="26" 
                    rx="2"
                    stroke="#6B7280" 
                    strokeWidth="1" 
                    fill="#F9FAFB"
                />
                <text x={serviceX} y={111} textAnchor="middle" className="text-sm font-bold fill-gray-900">M</text>

                {/* Service Line to First Panel - Enhanced */}
                <line x1={serviceX} y1={122} x2={serviceX} y2={160} stroke="#1F2937" strokeWidth="4" strokeLinecap="round" />

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

                  return (
                    <>
                      {/* Main Distribution Panel (MDP) */}
                      {mainPanel && (
                        <>
                          {/* MDP Box - Enhanced with shadow */}
                          <rect
                            x={serviceX - 35}
                            y={170}
                            width="70"
                            height="45"
                            rx="4"
                            stroke="#DC2626"
                            strokeWidth="3"
                            fill="#FEF2F2"
                            filter="url(#shadow-lg)"
                          />
                          <rect
                            x={serviceX - 33}
                            y={172}
                            width="66"
                            height="41"
                            rx="3"
                            stroke="#FCA5A5"
                            strokeWidth="1"
                            fill="none"
                          />
                          <text x={serviceX} y={198} textAnchor="middle" className="text-sm font-bold fill-red-800">
                            MDP
                          </text>

                          {/* MDP Labels - Outside Box Above - Enhanced */}
                          <text x={serviceX} y={155} textAnchor="middle" className="text-sm font-bold fill-gray-900">
                            {mainPanel.name}
                          </text>

                          {/* MDP Labels - Outside Box Below - Enhanced (positioned ABOVE bus bar) */}
                          <rect
                            x={serviceX - 90}
                            y={220}
                            width="180"
                            height="28"
                            fill="white"
                            fillOpacity="0.95"
                            rx="3"
                            stroke="#E5E7EB"
                            strokeWidth="1"
                          />
                          <text x={serviceX} y={232} textAnchor="middle" className="text-[10px] font-semibold fill-gray-700">
                            {mainPanel.voltage}V {mainPanel.phase}Φ • {mainPanel.bus_rating}A Bus • {mainPanel.main_breaker_amps}A Main
                          </text>
                          <text x={serviceX} y={243} textAnchor="middle" className="text-[9px] font-medium fill-electric-600">
                            {circuits.filter(c => c.panel_id === mainPanel.id).length} circuits
                          </text>

                          {/* Bus from MDP - Enhanced (always render when there are downstream elements) */}
                          {totalElements > 0 && (
                            <>
                              {/* Vertical feeder line from MDP to bus bar */}
                              <line 
                                x1={serviceX} 
                                y1={215} 
                                x2={serviceX} 
                                y2={250} 
                                stroke="#1F2937" 
                                strokeWidth="4" 
                                strokeLinecap="round"
                              />
                              {/* Horizontal bus bar - positioned at y=250 */}
                              <line
                                x1={Math.max(150, serviceX - (totalElements * 70))}
                                y1={250}
                                x2={Math.min(650, serviceX + (totalElements * 70))}
                                y2={250}
                                stroke="#1F2937"
                                strokeWidth="5"
                                strokeLinecap="round"
                                filter="url(#shadow)"
                              />
                            </>
                          )}

                          {/* Render panels fed directly from MDP */}
                          {panelsFedFromMain.map((panel, index) => {
                            const spacing = 140;
                            const startX = serviceX - ((totalElements - 1) * spacing / 2);
                            const xPos = startX + (index * spacing);
                            const panelCircuits = circuits.filter(c => c.panel_id === panel.id);

                            // ✅ NEW: Get downstream elements for this panel
                            const downstream = getDownstreamElements(panel.id);
                            const downstreamPanelsFed = panels.filter(p => p.fed_from_type === 'panel' && p.fed_from === panel.id);
                            const downstreamTransformersFed = transformers.filter(t => t.fed_from_panel_id === panel.id);

                            // ✅ FIX: Calculate total downstream elements to avoid overlap
                            const totalDownstream = downstreamPanelsFed.length + downstreamTransformersFed.length;

                            // ✅ NEW: Build downstream position array for bus bar rendering
                            const downstreamPositions: { x: number; topY: number }[] = [];

                            // Panels come first
                            downstreamPanelsFed.forEach((_, downIndex) => {
                              downstreamPositions.push({
                                x: xPos + (downIndex - (totalDownstream - 1) / 2) * DIAGRAM_CONSTANTS.LEVEL2_SPACING,
                                topY: DIAGRAM_CONSTANTS.LEVEL2_PANEL_Y
                              });
                            });

                            // Transformers come after
                            downstreamTransformersFed.forEach((_, downIndex) => {
                              const transformerIndex = downstreamPanelsFed.length + downIndex;
                              downstreamPositions.push({
                                x: xPos + (transformerIndex - (totalDownstream - 1) / 2) * DIAGRAM_CONSTANTS.LEVEL2_SPACING,
                                topY: DIAGRAM_CONSTANTS.LEVEL2_PANEL_Y
                              });
                            });

                            return (
                              <g key={`panel-${panel.id}`}>
                                {/* Panel Label - Above Box (with background to prevent overlap) */}
                                <rect
                                  x={xPos - 30}
                                  y={300}
                                  width="60"
                                  height="12"
                                  fill="white"
                                  fillOpacity="0.9"
                                  rx="2"
                                />
                                <text x={xPos} y={310} textAnchor="middle" className="text-xs font-bold fill-gray-900">
                                  {panel.name}
                                </text>

                                {/* Connection Line - Enhanced (from bus bar to panel) */}
                                <line 
                                    x1={xPos} 
                                    y1={250} 
                                    x2={xPos} 
                                    y2={320} 
                                    stroke="#4B5563" 
                                    strokeWidth="2.5" 
                                    strokeLinecap="round"
                                />

                                {/* Panel Box - Enhanced with shadow */}
                                <rect
                                  x={xPos - 28}
                                  y={320}
                                  width="56"
                                  height="35"
                                  rx="4"
                                  stroke="#3B82F6"
                                  strokeWidth="2.5"
                                  fill="#EFF6FF"
                                  filter="url(#shadow)"
                                />
                                <rect
                                  x={xPos - 26}
                                  y={322}
                                  width="52"
                                  height="31"
                                  rx="3"
                                  stroke="#93C5FD"
                                  strokeWidth="1"
                                  fill="none"
                                />
                                <text x={xPos} y={342} textAnchor="middle" className="text-sm font-bold fill-blue-800">
                                  P
                                </text>

                                {/* Panel Info - Below Box - Enhanced with background to mask riser line */}
                                <rect
                                  x={xPos - 55}
                                  y={360}
                                  width="110"
                                  height="40"
                                  fill="white"
                                  fillOpacity="0.95"
                                  rx="3"
                                  stroke="#E5E7EB"
                                  strokeWidth="1"
                                />
                                <text x={xPos} y={365} textAnchor="middle" className="text-[10px] font-semibold fill-gray-700">
                                  {panel.voltage}V {panel.phase}Φ • {panel.bus_rating}A
                                </text>
                                <text x={xPos} y={376} textAnchor="middle" className="text-[9px] font-medium fill-gray-600">
                                  {panel.main_breaker_amps ? `${panel.main_breaker_amps}A Main` : 'MLO'}
                                </text>
                                <text x={xPos} y={387} textAnchor="middle" className="text-[8px] font-medium fill-electric-600">
                                  {panelCircuits.length} ckt • {(panelCircuits.reduce((sum, c) => sum + (c.load_watts || 0), 0) / 1000).toFixed(1)}kVA
                                </text>
                                {panel.location && (
                                  <text x={xPos} y={395} textAnchor="middle" className="text-[7px] fill-gray-400 italic">
                                    {panel.location}
                                  </text>
                                )}

                                {/* ✅ NEW: Render bus bar for downstream elements (horizontal bus + vertical drops) */}
                                {totalDownstream > 0 && renderBusBar(
                                  xPos,
                                  DIAGRAM_CONSTANTS.LEVEL1_PANEL_Y + DIAGRAM_CONSTANTS.PANEL_HEIGHT,
                                  downstreamPositions,
                                  "#4B5563"
                                )}

                                {/* ✅ NEW: Render downstream panels fed from this panel */}
                                {downstreamPanelsFed.map((downPanel, downIndex) => {
                                  const downPanelCircuits = circuits.filter(c => c.panel_id === downPanel.id);
                                  // ✅ FIX: Position based on total downstream elements (panels come first)
                                  const downPanelX = xPos + (downIndex - (totalDownstream - 1) / 2) * DIAGRAM_CONSTANTS.LEVEL2_SPACING;
                                  const downPanelY = DIAGRAM_CONSTANTS.LEVEL2_PANEL_Y;

                                  return (
                                    <g key={`panel-down-${downPanel.id}`}>
                                      {/* Panel Label - Above Box (with background to mask riser line) */}
                                      <rect
                                        x={downPanelX - 30}
                                        y={downPanelY - 18}
                                        width="60"
                                        height="12"
                                        fill="white"
                                        fillOpacity="0.95"
                                        rx="2"
                                        stroke="#E5E7EB"
                                        strokeWidth="1"
                                      />
                                      <text x={downPanelX} y={downPanelY - 12} textAnchor="middle" className="text-xs font-bold fill-gray-900">
                                        {downPanel.name}
                                      </text>

                                      {/* Panel Box */}
                                      <rect
                                        x={downPanelX - 25}
                                        y={downPanelY}
                                        width="50"
                                        height="30"
                                        rx="3"
                                        stroke="#3B82F6"
                                        strokeWidth="2"
                                        fill="#EFF6FF"
                                      />
                                      <text x={downPanelX} y={downPanelY + 20} textAnchor="middle" className="text-xs font-bold fill-blue-700">
                                        P
                                      </text>

                                      {/* Panel Info - with background to mask riser line */}
                                      <rect
                                        x={downPanelX - 50}
                                        y={downPanelY + 38}
                                        width="100"
                                        height="30"
                                        fill="white"
                                        fillOpacity="0.95"
                                        rx="3"
                                        stroke="#E5E7EB"
                                        strokeWidth="1"
                                      />
                                      <text x={downPanelX} y={downPanelY + 43} textAnchor="middle" className="text-[9px] fill-gray-600">
                                        {downPanel.voltage}V {downPanel.phase}Φ • {downPanel.bus_rating}A
                                      </text>
                                      <text x={downPanelX} y={downPanelY + 53} textAnchor="middle" className="text-[8px] fill-gray-500">
                                        {downPanel.main_breaker_amps ? `${downPanel.main_breaker_amps}A` : 'MLO'}
                                      </text>
                                      <text x={downPanelX} y={downPanelY + 63} textAnchor="middle" className="text-[7px] fill-electric-600">
                                        {downPanelCircuits.length} ckt • {(downPanelCircuits.reduce((sum, c) => sum + (c.load_watts || 0), 0) / 1000).toFixed(1)}kVA
                                      </text>
                                    </g>
                                  );
                                })}

                                {/* ✅ NEW: Render downstream transformers fed from this panel */}
                                {downstreamTransformersFed.map((downXfmr, downIndex) => {
                                  // ✅ FIX: Position transformers after panels (add panel count to index)
                                  const transformerIndex = downstreamPanelsFed.length + downIndex;
                                  const downXfmrX = xPos + (transformerIndex - (totalDownstream - 1) / 2) * DIAGRAM_CONSTANTS.LEVEL2_SPACING;
                                  const downXfmrY = DIAGRAM_CONSTANTS.LEVEL2_PANEL_Y;
                                  const transformerFedPanels = panels.filter(p => p.fed_from_transformer_id === downXfmr.id);

                                  // Build positions for panels fed from this transformer
                                  const transformerDownstreamPositions = transformerFedPanels.map((_, tfIndex) => ({
                                    x: downXfmrX + (tfIndex - (transformerFedPanels.length - 1) / 2) * DIAGRAM_CONSTANTS.LEVEL3_SPACING,
                                    topY: DIAGRAM_CONSTANTS.LEVEL3_PANEL_Y
                                  }));

                                  return (
                                    <g key={`xfmr-down-${downXfmr.id}`}>
                                      {/* Transformer Label (with background to mask riser line) */}
                                      <rect
                                        x={downXfmrX - 40}
                                        y={downXfmrY - 18}
                                        width="80"
                                        height="12"
                                        fill="white"
                                        fillOpacity="0.95"
                                        rx="2"
                                        stroke="#E5E7EB"
                                        strokeWidth="1"
                                      />
                                      <text x={downXfmrX} y={downXfmrY - 12} textAnchor="middle" className="text-xs font-bold fill-gray-900">
                                        {downXfmr.name}
                                      </text>

                                      {/* ❌ REMOVED: Diagonal connection line (now handled by bus bar above) */}

                                      {/* Transformer Box - Enhanced */}
                                      <rect
                                        x={downXfmrX - 32}
                                        y={downXfmrY}
                                        width="64"
                                        height="38"
                                        rx="4"
                                        stroke="#F59E0B"
                                        strokeWidth="2.5"
                                        fill="#FEF3C7"
                                        filter="url(#shadow)"
                                      />
                                      <rect
                                        x={downXfmrX - 30}
                                        y={downXfmrY + 2}
                                        width="60"
                                        height="34"
                                        rx="3"
                                        stroke="#FCD34D"
                                        strokeWidth="1"
                                        fill="none"
                                      />
                                      <text x={downXfmrX} y={downXfmrY + 24} textAnchor="middle" className="text-sm font-bold fill-orange-900">
                                        XFMR
                                      </text>

                                      {/* Transformer Info - Enhanced */}
                                      <text x={downXfmrX} y={downXfmrY + 50} textAnchor="middle" className="text-[10px] font-semibold fill-orange-800">
                                        {downXfmr.kva_rating} kVA
                                      </text>
                                      <text x={downXfmrX} y={downXfmrY + 61} textAnchor="middle" className="text-[9px] font-medium fill-orange-700">
                                        {downXfmr.primary_voltage}V → {downXfmr.secondary_voltage}V
                                      </text>

                                      {/* ✅ NEW: Render bus bar for transformer-fed panels (orange for transformer) */}
                                      {transformerFedPanels.length > 0 && renderBusBar(
                                        downXfmrX,
                                        downXfmrY + DIAGRAM_CONSTANTS.TRANSFORMER_HEIGHT,
                                        transformerDownstreamPositions,
                                        "#F59E0B"
                                      )}

                                      {/* Panels fed from this downstream transformer */}
                                      {transformerFedPanels.map((tfPanel, tfIndex) => {
                                        const tfPanelCircuits = circuits.filter(c => c.panel_id === tfPanel.id);
                                        const tfPanelX = downXfmrX + (tfIndex - (transformerFedPanels.length - 1) / 2) * DIAGRAM_CONSTANTS.LEVEL3_SPACING;
                                        const tfPanelY = DIAGRAM_CONSTANTS.LEVEL3_PANEL_Y;

                                        return (
                                          <g key={`panel-tf-${tfPanel.id}`}>
                                            {/* Panel Label (with background to mask riser line) */}
                                            <rect
                                              x={tfPanelX - 30}
                                              y={tfPanelY - 18}
                                              width="60"
                                              height="12"
                                              fill="white"
                                              fillOpacity="0.95"
                                              rx="2"
                                              stroke="#E5E7EB"
                                              strokeWidth="1"
                                            />
                                            <text x={tfPanelX} y={tfPanelY - 12} textAnchor="middle" className="text-xs font-bold fill-gray-900">
                                              {tfPanel.name}
                                            </text>

                                            {/* ❌ REMOVED: Diagonal connection line (now handled by bus bar above) */}

                                            {/* Panel Box - Enhanced */}
                                            <rect
                                              x={tfPanelX - 28}
                                              y={tfPanelY}
                                              width="56"
                                              height="35"
                                              rx="4"
                                              stroke="#3B82F6"
                                              strokeWidth="2.5"
                                              fill="#EFF6FF"
                                              filter="url(#shadow)"
                                            />
                                            <rect
                                              x={tfPanelX - 26}
                                              y={tfPanelY + 2}
                                              width="52"
                                              height="31"
                                              rx="3"
                                              stroke="#93C5FD"
                                              strokeWidth="1"
                                              fill="none"
                                            />
                                            <text x={tfPanelX} y={tfPanelY + 22} textAnchor="middle" className="text-sm font-bold fill-blue-800">
                                              P
                                            </text>

                                            {/* Panel Info - Enhanced with background to mask riser line */}
                                            <rect
                                              x={tfPanelX - 50}
                                              y={tfPanelY + 40}
                                              width="100"
                                              height="30"
                                              fill="white"
                                              fillOpacity="0.95"
                                              rx="3"
                                              stroke="#E5E7EB"
                                              strokeWidth="1"
                                            />
                                            <text x={tfPanelX} y={tfPanelY + 45} textAnchor="middle" className="text-[10px] font-semibold fill-gray-700">
                                              {tfPanel.voltage}V {tfPanel.phase}Φ • {tfPanel.bus_rating}A
                                            </text>
                                            <text x={tfPanelX} y={tfPanelY + 56} textAnchor="middle" className="text-[9px] font-medium fill-gray-600">
                                              {tfPanel.main_breaker_amps ? `${tfPanel.main_breaker_amps}A` : 'MLO'}
                                            </text>
                                            <text x={tfPanelX} y={tfPanelY + 67} textAnchor="middle" className="text-[8px] font-medium fill-electric-600">
                                              {tfPanelCircuits.length} ckt • {(tfPanelCircuits.reduce((sum, c) => sum + (c.load_watts || 0), 0) / 1000).toFixed(1)}kVA
                                            </text>
                                          </g>
                                        );
                                      })}
                                    </g>
                                  );
                                })}
                              </g>
                            );
                          })}

                          {/* Render transformers and their downstream panels */}
                          {transformersFedFromMain.map((xfmr, xfmrIndex) => {
                            const spacing = 140;
                            const baseIndex = panelsFedFromMain.length + xfmrIndex;
                            const startX = serviceX - ((totalElements - 1) * spacing / 2);
                            const xPos = startX + (baseIndex * spacing);

                            // Find panels fed from this transformer
                            const downstreamPanels = panels.filter(p => p.fed_from_transformer_id === xfmr.id);

                            // ✅ NEW: Build downstream position array for bus bar rendering
                            const mdpTransformerDownstreamPositions = downstreamPanels.map((_, pIndex) => ({
                              x: xPos + (pIndex - (downstreamPanels.length - 1) / 2) * DIAGRAM_CONSTANTS.LEVEL2_SPACING,
                              topY: DIAGRAM_CONSTANTS.LEVEL2_PANEL_Y
                            }));

                            return (
                              <g key={`xfmr-${xfmr.id}`}>
                                {/* Transformer Label - Above Box (with background to prevent overlap) */}
                                <rect
                                  x={xPos - 40}
                                  y={300}
                                  width="80"
                                  height="12"
                                  fill="white"
                                  fillOpacity="0.9"
                                  rx="2"
                                />
                                <text x={xPos} y={310} textAnchor="middle" className="text-xs font-bold fill-gray-900">
                                  {xfmr.name}
                                </text>

                                {/* Line from bus to transformer - Enhanced */}
                                <line x1={xPos} y1={250} x2={xPos} y2={320} stroke="#4B5563" strokeWidth="2.5" strokeLinecap="round" />

                                {/* Transformer Box - Enhanced */}
                                <rect
                                  x={xPos - 32}
                                  y={320}
                                  width="64"
                                  height="38"
                                  rx="4"
                                  stroke="#F59E0B"
                                  strokeWidth="2.5"
                                  fill="#FEF3C7"
                                  filter="url(#shadow)"
                                />
                                <rect
                                  x={xPos - 30}
                                  y={322}
                                  width="60"
                                  height="34"
                                  rx="3"
                                  stroke="#FCD34D"
                                  strokeWidth="1"
                                  fill="none"
                                />
                                <text x={xPos} y={344} textAnchor="middle" className="text-sm font-bold fill-orange-900">
                                  XFMR
                                </text>

                                {/* Transformer Info - Enhanced */}
                                <text x={xPos} y={370} textAnchor="middle" className="text-[10px] font-semibold fill-orange-800">
                                  {xfmr.kva_rating} kVA
                                </text>
                                <text x={xPos} y={381} textAnchor="middle" className="text-[9px] font-medium fill-orange-700">
                                  {xfmr.primary_voltage}V → {xfmr.secondary_voltage}V
                                </text>

                                {/* ✅ NEW: Render bus bar for transformer-fed panels (orange for transformer) */}
                                {downstreamPanels.length > 0 && renderBusBar(
                                  xPos,
                                  DIAGRAM_CONSTANTS.LEVEL1_PANEL_Y + DIAGRAM_CONSTANTS.TRANSFORMER_HEIGHT,
                                  mdpTransformerDownstreamPositions,
                                  "#F59E0B"
                                )}

                                {/* Downstream panels from transformer */}
                                {downstreamPanels.map((panel, pIndex) => {
                                  const panelCircuits = circuits.filter(c => c.panel_id === panel.id);
                                  const panelX = xPos + (pIndex - (downstreamPanels.length - 1) / 2) * DIAGRAM_CONSTANTS.LEVEL2_SPACING;
                                  const panelY = DIAGRAM_CONSTANTS.LEVEL2_PANEL_Y;

                                  return (
                                    <g key={`panel-xfmr-${panel.id}`}>
                                      {/* Panel Label - Above Box (with background to mask riser line) */}
                                      <rect
                                        x={panelX - 30}
                                        y={panelY - 18}
                                        width="60"
                                        height="12"
                                        fill="white"
                                        fillOpacity="0.95"
                                        rx="2"
                                        stroke="#E5E7EB"
                                        strokeWidth="1"
                                      />
                                      <text x={panelX} y={panelY - 12} textAnchor="middle" className="text-xs font-bold fill-gray-900">
                                        {panel.name}
                                      </text>

                                      {/* ❌ REMOVED: Diagonal connection line (now handled by bus bar above) */}

                                      {/* Panel Box - Smaller */}
                                      <rect
                                        x={panelX - 25}
                                        y={panelY}
                                        width="50"
                                        height="30"
                                        rx="3"
                                        stroke="#3B82F6"
                                        strokeWidth="2"
                                        fill="#EFF6FF"
                                      />
                                      <text x={panelX} y={panelY + 20} textAnchor="middle" className="text-xs font-bold fill-blue-700">
                                        P
                                      </text>

                                      {/* Panel Info - Below Box with background to mask riser line */}
                                      <rect
                                        x={panelX - 50}
                                        y={panelY + 38}
                                        width="100"
                                        height="30"
                                        fill="white"
                                        fillOpacity="0.95"
                                        rx="3"
                                        stroke="#E5E7EB"
                                        strokeWidth="1"
                                      />
                                      <text x={panelX} y={panelY + 43} textAnchor="middle" className="text-[9px] fill-gray-600">
                                        {panel.voltage}V {panel.phase}Φ • {panel.bus_rating}A
                                      </text>
                                      <text x={panelX} y={panelY + 53} textAnchor="middle" className="text-[8px] fill-gray-500">
                                        {panel.main_breaker_amps ? `${panel.main_breaker_amps}A` : 'MLO'}
                                      </text>
                                      <text x={panelX} y={panelY + 63} textAnchor="middle" className="text-[7px] fill-electric-600">
                                        {panelCircuits.length} ckt • {(panelCircuits.reduce((sum, c) => sum + (c.load_watts || 0), 0) / 1000).toFixed(1)}kVA
                                      </text>
                                    </g>
                                  );
                                })}
                              </g>
                            );
                          })}
                        </>
                      )}

                      {/* No Panels Message */}
                      {panels.length === 0 && (
                        <text x={400} y={300} textAnchor="middle" className="text-sm fill-gray-400">
                          Add panels using the form on the left to see them here
                        </text>
                      )}

                      {/* Bus from MDP - Render AFTER all panels/transformers so it appears on top */}
                      {mainPanel && totalElements > 0 && (
                        <>
                          {/* Vertical feeder line from MDP to bus bar */}
                          <line 
                            x1={serviceX} 
                            y1={215} 
                            x2={serviceX} 
                            y2={250} 
                            stroke="#1F2937" 
                            strokeWidth="4" 
                            strokeLinecap="round"
                          />
                          {/* Horizontal bus bar - positioned at y=250 (VERY THICK for visibility, rendered on top) */}
                          <line
                            x1={Math.max(150, serviceX - (totalElements * 70))}
                            y1={250}
                            x2={Math.min(650, serviceX + (totalElements * 70))}
                            y2={250}
                            stroke="#1F2937"
                            strokeWidth="10"
                            strokeLinecap="round"
                            filter="url(#shadow)"
                          />
                          {/* Additional bus bar line for extra visibility (red accent) */}
                          <line
                            x1={Math.max(150, serviceX - (totalElements * 70))}
                            y1={250}
                            x2={Math.min(650, serviceX + (totalElements * 70))}
                            y2={250}
                            stroke="#DC2626"
                            strokeWidth="8"
                            strokeLinecap="round"
                            opacity="0.4"
                          />
                        </>
                      )}
                    </>
                  );
                })()}
            </svg>
            </DiagramPanZoom>

            {description && (
                <div className="p-4 bg-gray-50 border-t border-gray-100 text-xs text-gray-600 max-h-32 overflow-y-auto">
                    <h4 className="font-bold text-gray-900 mb-1">AI Analysis</h4>
                    {description}
                </div>
            )}
        </div>
      </div>

      {/* Feeder Management Section */}
      <div className="mt-8 pt-8 border-t border-gray-200">
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
