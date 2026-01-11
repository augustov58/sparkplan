/**
 * Panel Schedule Component - NEC Article 220 Compliant
 * Professional electrical panel schedule with load type classification
 * and demand factor calculations per NEC 2023
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Project } from '../types';
import { LayoutGrid, Download, Edit2, Save, X, Trash2, Settings, Calculator, Info, ArrowDown, Plus } from 'lucide-react';
import { usePanels } from '../hooks/usePanels';
import { useCircuits } from '../hooks/useCircuits';
import { useTransformers } from '../hooks/useTransformers';
import { exportPanelSchedulePDF, exportAllPanelsPDF } from '../services/pdfExport/panelSchedulePDF';
import { 
  calculatePanelDemand, 
  getCircuitPhase, 
  getLoadTypeColor,
  type CircuitLoad 
} from '../services/calculations/demandFactor';
import { calculateAggregatedLoad } from '../services/calculations/upstreamLoadAggregation';
import type { LoadTypeCode } from '../types';

// Load type options for dropdown
const LOAD_TYPES: { code: LoadTypeCode; label: string }[] = [
  { code: 'L', label: 'Lighting' },
  { code: 'M', label: 'Motor' },
  { code: 'R', label: 'Receptacles' },
  { code: 'O', label: 'Other' },
  { code: 'H', label: 'Heating' },
  { code: 'C', label: 'Cooling' },
  { code: 'W', label: 'Water Heater' },
  { code: 'D', label: 'Dryer' },
  { code: 'K', label: 'Kitchen' },
];

interface PanelScheduleProps {
  project: Project;
}

export const PanelSchedule: React.FC<PanelScheduleProps> = ({ project }) => {
  const { panels, updatePanel } = usePanels(project.id);
  const { circuits, createCircuit, updateCircuit, deleteCircuit } = useCircuits(project.id);
  const { transformers } = useTransformers(project.id);

  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [editingCircuit, setEditingCircuit] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    description?: string;
    breakerAmps?: number;
    loadWatts?: number;
    loadType?: LoadTypeCode;
    circuitNumber?: number;
  }>({});
  const [showDemandDetails, setShowDemandDetails] = useState(true);
  const [addingCircuit, setAddingCircuit] = useState<'left' | 'right' | null>(null);
  const [newCircuit, setNewCircuit] = useState<{
    description?: string;
    breakerAmps?: number;
    loadWatts?: number;
    loadType?: LoadTypeCode;
    pole?: 1 | 2 | 3;
    conductorSize?: string;
    circuitNumber?: number;
  }>({
    breakerAmps: 20,
    loadWatts: 0,
    loadType: 'O',
    pole: 1,
    conductorSize: '12 AWG',
  });
  // State for breaker slot assignment
  const [assigningFeederId, setAssigningFeederId] = useState<string | null>(null);

  // Select first panel by default
  React.useEffect(() => {
    if (panels.length > 0 && !selectedPanelId && panels[0]) {
      setSelectedPanelId(panels[0].id);
    }
  }, [panels, selectedPanelId]);

  const selectedPanel = panels.find(p => p.id === selectedPanelId);
  const panelCircuits = circuits.filter(c => c.panel_id === selectedPanelId);

  // Find downstream panels fed from this panel
  const downstreamPanels = useMemo(() => {
    if (!selectedPanelId) return [];
    return panels.filter(p => p.fed_from_type === 'panel' && p.fed_from === selectedPanelId);
  }, [selectedPanelId, panels]);

  // Find transformers fed from this panel
  const downstreamTransformers = useMemo(() => {
    if (!selectedPanelId) return [];
    return transformers.filter(t => t.fed_from_panel_id === selectedPanelId);
  }, [selectedPanelId, transformers]);

  // Create "virtual feeder circuits" for downstream equipment
  // These represent the feeder breakers in this panel that feed downstream equipment
  const feederCircuits = useMemo(() => {
    const feeders: Array<{
      id: string;
      isFeeder: true;
      type: 'panel' | 'transformer';
      name: string;
      loadVA: number;
      breakerAmps: number;
      pole: 1 | 2 | 3;
      circuitNumber: number | null; // null = unassigned
      targetId: string;
    }> = [];

    const occupancy = project.settings?.occupancyType || 'commercial';

    // Add downstream panels as feeder circuits
    downstreamPanels.forEach(panel => {
      // Calculate the demand load for this downstream panel
      const panelLoad = calculateAggregatedLoad(panel.id, panels, circuits, transformers, occupancy);
      
      feeders.push({
        id: `feeder-panel-${panel.id}`,
        isFeeder: true,
        type: 'panel',
        name: `→ PANEL ${panel.name}`,
        loadVA: panelLoad.totalDemandVA,
        breakerAmps: panel.feeder_breaker_amps || panel.main_breaker_amps || 100,
        pole: panel.phase === 3 ? 3 : 2,
        circuitNumber: null, // Could be assigned if panel stores feeder circuit number
        targetId: panel.id,
      });
    });

    // Add transformers as feeder circuits
    downstreamTransformers.forEach(xfmr => {
      // Find panels fed by this transformer to calculate load
      const xfmrPanels = panels.filter(p => p.fed_from_transformer_id === xfmr.id);
      let totalLoad = 0;
      xfmrPanels.forEach(p => {
        const pLoad = calculateAggregatedLoad(p.id, panels, circuits, transformers, occupancy);
        totalLoad += pLoad.totalDemandVA;
      });
      // If no panels, use transformer kVA rating
      if (xfmrPanels.length === 0 && xfmr.kva_rating) {
        totalLoad = xfmr.kva_rating * 1000;
      }

      feeders.push({
        id: `feeder-xfmr-${xfmr.id}`,
        isFeeder: true,
        type: 'transformer',
        name: `→ XFMR ${xfmr.name || xfmr.kva_rating + 'kVA'}`,
        loadVA: totalLoad,
        breakerAmps: Math.ceil(totalLoad / (selectedPanel?.voltage || 480) / (selectedPanel?.phase === 3 ? Math.sqrt(3) : 1)),
        pole: selectedPanel?.phase === 3 ? 3 : 2,
        circuitNumber: null,
        targetId: xfmr.id,
      });
    });

    return feeders;
  }, [downstreamPanels, downstreamTransformers, panels, circuits, transformers, selectedPanel, project.settings?.occupancyType]);

  // Split feeder circuits into breaker-fed (assigned to specific slot) and lug-fed (feed-thru lug)
  const { breakerFedPanels, lugFedPanels } = useMemo(() => {
    const breaker: typeof feederCircuits = [];
    const lug: typeof feederCircuits = [];

    feederCircuits.forEach(f => {
      if (f.type === 'panel') {
        const panel = panels.find(p => p.id === f.targetId);
        if (panel?.fed_from_circuit_number) {
          // Panel is fed from a specific breaker - show in circuit grid
          breaker.push({ ...f, circuitNumber: panel.fed_from_circuit_number });
        } else {
          // Panel is fed via feed-thru lug - show in separate section
          lug.push(f);
        }
      } else {
        // Transformers always go to lug section for now (could extend later)
        lug.push(f);
      }
    });

    return { breakerFedPanels: breaker, lugFedPanels: lug };
  }, [feederCircuits, panels]);

  // Calculate demand factors (direct circuits only - feeders calculated separately)
  const demandResult = useMemo(() => {
    if (!selectedPanel) return null;
    
    // If no direct circuits but has feeder circuits, return minimal result
    if (panelCircuits.length === 0 && feederCircuits.length === 0) return null;

    const circuitLoads: CircuitLoad[] = panelCircuits.map(c => ({
      id: c.id,
      description: c.description,
      loadWatts: c.load_watts || 0,
      loadType: (c.load_type as LoadTypeCode) || 'O',
      pole: c.pole,
      circuitNumber: c.circuit_number,
      phase: getCircuitPhase(c.circuit_number, selectedPanel.phase),
    }));

    // Calculate direct circuit demand
    const directDemand = panelCircuits.length > 0 
      ? calculatePanelDemand(circuitLoads, selectedPanel.voltage, selectedPanel.phase)
      : null;

    // Calculate total including feeders
    const feederTotalVA = feederCircuits.reduce((sum, f) => sum + f.loadVA, 0);
    const directTotalVA = directDemand?.totalDemandLoad_kVA ? directDemand.totalDemandLoad_kVA * 1000 : 0;
    const directConnectedVA = directDemand?.totalConnectedLoad_kVA ? directDemand.totalConnectedLoad_kVA * 1000 : 0;

    // Return enhanced result with feeder info
    return directDemand ? {
      ...directDemand,
      // Add feeder totals
      feederTotalVA,
      totalWithFeeders_kVA: (directTotalVA + feederTotalVA) / 1000,
      connectedWithFeeders_kVA: (directConnectedVA + feederTotalVA) / 1000,
    } : {
      // Minimal result when only feeders exist (no direct circuits)
      totalConnectedLoad_kVA: feederTotalVA / 1000,
      totalDemandLoad_kVA: feederTotalVA / 1000,
      demandAmps: feederTotalVA / (selectedPanel.voltage * (selectedPanel.phase === 3 ? Math.sqrt(3) : 1)),
      percentImbalance: 0,
      // phaseLoads must be an array with objects matching the expected structure
      phaseLoads: [
        { phase: 'A' as const, connectedLoad_kVA: feederTotalVA / 1000 / (selectedPanel.phase === 3 ? 3 : 2), demandLoad_kVA: feederTotalVA / 1000 / (selectedPanel.phase === 3 ? 3 : 2) },
        { phase: 'B' as const, connectedLoad_kVA: feederTotalVA / 1000 / (selectedPanel.phase === 3 ? 3 : 2), demandLoad_kVA: feederTotalVA / 1000 / (selectedPanel.phase === 3 ? 3 : 2) },
        { phase: 'C' as const, connectedLoad_kVA: selectedPanel.phase === 3 ? feederTotalVA / 1000 / 3 : 0, demandLoad_kVA: selectedPanel.phase === 3 ? feederTotalVA / 1000 / 3 : 0 },
      ],
      necReferences: [],
      loadsByType: [], // Empty since no direct circuits
      feederTotalVA,
      totalWithFeeders_kVA: feederTotalVA / 1000,
      connectedWithFeeders_kVA: feederTotalVA / 1000,
    };
  }, [selectedPanel, panelCircuits, feederCircuits]);

  // Calculate aggregated load including downstream panels
  // Uses occupancyType from project settings for correct demand factor selection
  const aggregatedLoad = useMemo(() => {
    if (!selectedPanel) return null;
    const occupancy = project.settings?.occupancyType || 'commercial';
    return calculateAggregatedLoad(selectedPanel.id, panels, circuits, transformers, occupancy);
  }, [selectedPanel, panels, circuits, transformers, project.settings?.occupancyType]);

  // Generate slots based on panel type (industry standard)
  // MDP/Main Distribution Panels: typically 24-30 poles
  // Branch Panels: typically 42 poles
  const totalSlots = selectedPanel
    ? (selectedPanel.is_main ? 30 : 42)  // MDP = 30 poles, Branch panels = 42 poles
    : 42;

  // Helper to find circuit at specific slot number
  const getCircuit = (num: number) => panelCircuits.find(c => c.circuit_number === num);

  // Helper to find breaker-fed panel at specific slot number
  const getFeederAtSlot = (slotNum: number) =>
    breakerFedPanels.find(f => f.circuitNumber === slotNum);

  // Get phase letter for a row
  const getPhaseForRow = (rowNum: number) => {
    if (!selectedPanel) return 'A';
    if (selectedPanel.phase === 3) {
      return ['A', 'B', 'C'][(rowNum - 1) % 3];
    }
    return ['A', 'B'][(rowNum - 1) % 2];
  };

  // Memoized callbacks for better performance
  const startEdit = useCallback((circuit: any) => {
    setEditingCircuit(circuit.id);
    setEditForm({
      description: circuit.description,
      breakerAmps: circuit.breaker_amps,
      loadWatts: circuit.load_watts,
      loadType: circuit.load_type || 'O',
      circuitNumber: circuit.circuit_number,
    });
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingCircuit) return;
    await updateCircuit(editingCircuit, {
      description: editForm.description,
      breaker_amps: editForm.breakerAmps,
      load_watts: editForm.loadWatts,
      load_type: editForm.loadType,
      circuit_number: editForm.circuitNumber,
    });
    setEditingCircuit(null);
    setEditForm({});
  }, [editingCircuit, editForm, updateCircuit]);

  const cancelEdit = useCallback(() => {
    setEditingCircuit(null);
    setEditForm({});
  }, []);

  const handleDeleteCircuit = useCallback(async (circuit: any) => {
    if (confirm(`Delete circuit ${circuit.circuit_number} - "${circuit.description}"?`)) {
      await deleteCircuit(circuit.id);
    }
  }, [deleteCircuit]);

  const handleExportPDF = async () => {
    if (!selectedPanel) return;
    try {
      await exportPanelSchedulePDF(selectedPanel, panelCircuits, project.name, project.address);
    } catch (error) {
      alert(`Failed to export PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleExportAllPanels = async () => {
    if (panels.length === 0) return;
    try {
      const circuitsByPanel = new Map<string, typeof panelCircuits>();
      panels.forEach(panel => {
        circuitsByPanel.set(panel.id, circuits.filter(c => c.panel_id === panel.id));
      });
      await exportAllPanelsPDF(panels, circuitsByPanel, project.name, project.address);
    } catch (error) {
      alert(`Failed to export PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Get all occupied slot numbers (including multi-pole circuit expansions and breaker-fed panels)
  const getOccupiedSlots = (): Set<number> => {
    if (!selectedPanelId) return new Set();
    const panelCkts = circuits.filter(c => c.panel_id === selectedPanelId);
    const occupied = new Set<number>();

    // Add slots occupied by direct circuits
    panelCkts.forEach(ckt => {
      // Add the circuit's base number
      occupied.add(ckt.circuit_number);

      // Add slots occupied by multi-pole circuits
      // 1-pole: occupies 1 slot (e.g., slot 1)
      // 2-pole: occupies 2 slots (e.g., slots 1 and 3)
      // 3-pole: occupies 3 slots (e.g., slots 1, 3, and 5)
      if (ckt.pole > 1) {
        for (let i = 1; i < ckt.pole; i++) {
          occupied.add(ckt.circuit_number + (i * 2));
        }
      }
    });

    // Add slots occupied by breaker-fed panels
    breakerFedPanels.forEach(f => {
      if (f.circuitNumber) {
        occupied.add(f.circuitNumber);
        // Handle multi-pole feeders (2P or 3P breakers)
        if (f.pole > 1) {
          for (let i = 1; i < f.pole; i++) {
            occupied.add(f.circuitNumber + (i * 2));
          }
        }
      }
    });

    return occupied;
  };

  // Check if a circuit with given number and pole count can be placed
  const isCircuitSlotAvailable = (circuitNumber: number, pole: number): boolean => {
    const occupied = getOccupiedSlots();

    // Check if the base slot and all required slots are free
    for (let i = 0; i < pole; i++) {
      const slotNumber = circuitNumber + (i * 2);
      if (occupied.has(slotNumber)) {
        return false; // Slot is occupied
      }
    }

    return true; // All required slots are free
  };

  const getNextAvailableCircuitNumber = (side: 'left' | 'right', pole: number = 1) => {
    const startNumber = side === 'left' ? 1 : 2;
    const occupied = getOccupiedSlots();

    // Find the first available slot on this side
    for (let num = startNumber; num <= 100; num += 2) {
      if (isCircuitSlotAvailable(num, pole)) {
        return num;
      }
    }

    // If no slot available, return a high number (shouldn't happen in practice)
    return side === 'left' ? 101 : 102;
  };

  const startAddCircuit = (side: 'left' | 'right') => {
    const circuitNumber = getNextAvailableCircuitNumber(side, 1);
    setNewCircuit({
      breakerAmps: 20,
      loadWatts: 0,
      loadType: 'O',
      pole: 1,
      conductorSize: '12 AWG',
      circuitNumber,
    });
    setAddingCircuit(side);
  };

  // Recalculate circuit number when pole count changes
  const handlePoleChange = (newPole: 1 | 2 | 3) => {
    const currentNumber = newCircuit.circuitNumber;

    // If current number is still valid for new pole count, keep it
    if (currentNumber && isCircuitSlotAvailable(currentNumber, newPole)) {
      setNewCircuit({...newCircuit, pole: newPole});
    } else {
      // Otherwise, find next available slot for this pole count
      const nextAvailable = getNextAvailableCircuitNumber(addingCircuit || 'left', newPole);
      setNewCircuit({...newCircuit, pole: newPole, circuitNumber: nextAvailable});
    }
  };

  // Handle manual circuit number entry
  const handleCircuitNumberChange = (value: string) => {
    const num = parseInt(value);

    // Allow empty or invalid input (user is typing)
    if (value === '' || isNaN(num)) {
      setNewCircuit({...newCircuit, circuitNumber: undefined});
      return;
    }

    // Validate side (left = odd, right = even)
    const isLeftSide = addingCircuit === 'left';
    const isOdd = num % 2 === 1;

    if ((isLeftSide && !isOdd) || (!isLeftSide && isOdd)) {
      // Wrong side - show warning but allow the value
      console.warn(`Circuit ${num} is on the ${isOdd ? 'left' : 'right'} side, but you're adding to the ${addingCircuit} side`);
    }

    setNewCircuit({...newCircuit, circuitNumber: num});
  };

  const handleAddCircuit = async () => {
    if (!selectedPanelId || !newCircuit.description) {
      alert('Please enter a circuit description');
      return;
    }

    const circuitNumber = newCircuit.circuitNumber || getNextAvailableCircuitNumber(addingCircuit || 'left', newCircuit.pole || 1);
    const pole = newCircuit.pole || 1;

    // CRITICAL: Validate that the slot is available
    if (!isCircuitSlotAvailable(circuitNumber, pole)) {
      const occupiedSlots = [];
      for (let i = 0; i < pole; i++) {
        const slotNumber = circuitNumber + (i * 2);
        occupiedSlots.push(slotNumber);
      }
      alert(`Cannot add ${pole}-pole circuit at slot ${circuitNumber}. Slots ${occupiedSlots.join(', ')} are occupied or would conflict with existing circuits.`);
      return;
    }

    try {
      await createCircuit({
        project_id: project.id,
        panel_id: selectedPanelId,
        circuit_number: circuitNumber,
        description: newCircuit.description,
        breaker_amps: newCircuit.breakerAmps || 20,
        load_watts: newCircuit.loadWatts || 0,
        pole: pole,
        load_type: newCircuit.loadType || 'O',
        conductor_size: newCircuit.conductorSize || '12 AWG',
      });

      // Reset form only if successful
      setNewCircuit({
        breakerAmps: 20,
        loadWatts: 0,
        loadType: 'O',
        pole: 1,
        conductorSize: '12 AWG',
      });
      setAddingCircuit(null);
    } catch (error) {
      console.error('Failed to create circuit:', error);
      alert(`Failed to add circuit: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const cancelAddCircuit = () => {
    setNewCircuit({
      breakerAmps: 20,
      loadWatts: 0,
      loadType: 'O',
      pole: 1,
      conductorSize: '12 AWG',
    });
    setAddingCircuit(null);
  };

  // Get available slots for feeder assignment (returns slots that can fit a given pole count)
  const getAvailableSlotsForFeeder = (pole: number) => {
    const occupied = getOccupiedSlots();
    const available: number[] = [];

    // Check both left (odd) and right (even) sides
    for (let num = 1; num <= totalSlots; num++) {
      // Check if this slot and all required slots are free
      let canFit = true;
      for (let i = 0; i < pole; i++) {
        const slotToCheck = num + (i * 2);
        if (occupied.has(slotToCheck) || slotToCheck > totalSlots) {
          canFit = false;
          break;
        }
      }
      if (canFit) {
        available.push(num);
      }
    }

    return available;
  };

  // Assign a feeder panel to a specific breaker slot
  const assignFeederToSlot = async (panelId: string, circuitNumber: number) => {
    try {
      await updatePanel(panelId, { fed_from_circuit_number: circuitNumber });
      setAssigningFeederId(null);
    } catch (error) {
      console.error('Failed to assign feeder to slot:', error);
      alert('Failed to assign feeder to breaker slot');
    }
  };

  // Unassign a feeder panel from its breaker slot (move back to feed-thru lug)
  const unassignFeederFromSlot = async (panelId: string) => {
    if (!confirm('Move this panel to feed-thru lug connection?')) return;
    try {
      await updatePanel(panelId, { fed_from_circuit_number: null });
    } catch (error) {
      console.error('Failed to unassign feeder from slot:', error);
      alert('Failed to unassign feeder from breaker slot');
    }
  };

  // Check if a slot is occupied by a multi-pole circuit above it
  const getMultiPoleCircuitAbove = (slotNumber: number) => {
    for (let i = 1; i < slotNumber; i++) {
      const ckt = getCircuit(i);
      if (ckt && ckt.pole > 1) {
        const occupiedSlots = [];
        for (let j = 0; j < ckt.pole; j++) {
          occupiedSlots.push(ckt.circuit_number + (j * 2));
        }
        if (occupiedSlots.includes(slotNumber)) {
          return ckt;
        }
      }
    }
    return null;
  };

  // Check if a slot is occupied by a multi-pole feeder breaker above it
  const getMultiPoleFeederAbove = (slotNumber: number) => {
    for (const feeder of breakerFedPanels) {
      if (feeder.circuitNumber && feeder.pole > 1 && feeder.circuitNumber < slotNumber) {
        const occupiedSlots = [];
        for (let j = 0; j < feeder.pole; j++) {
          occupiedSlots.push(feeder.circuitNumber + (j * 2));
        }
        if (occupiedSlots.includes(slotNumber)) {
          return feeder;
        }
      }
    }
    return null;
  };

  // Calculate load per phase for a circuit
  const getLoadPerPhase = (ckt: any, phase: 'A' | 'B' | 'C') => {
    if (!ckt || !ckt.load_watts) return null;
    const cktPhase = getCircuitPhase(ckt.circuit_number, selectedPanel?.phase || 3);
    
    if (ckt.pole === 1) {
      return cktPhase === phase ? (ckt.load_watts / 1000).toFixed(2) : null;
    } else if (ckt.pole === 2) {
      // 2-pole spans two phases
      const phases = selectedPanel?.phase === 3 
        ? [cktPhase, cktPhase === 'A' ? 'B' : cktPhase === 'B' ? 'C' : 'A']
        : [cktPhase, cktPhase === 'A' ? 'B' : 'A'];
      return phases.includes(phase) ? ((ckt.load_watts / 1000) / 2).toFixed(2) : null;
    } else if (ckt.pole === 3) {
      // 3-pole spans all three phases
      return ((ckt.load_watts / 1000) / 3).toFixed(2);
    }
    return null;
  };

  const renderRow = (rowNum: number) => {
    const leftNum = (rowNum * 2) - 1;
    const rightNum = rowNum * 2;
    const leftCkt = getCircuit(leftNum);
    const rightCkt = getCircuit(rightNum);
    const leftFeeder = getFeederAtSlot(leftNum);
    const rightFeeder = getFeederAtSlot(rightNum);
    const leftMultiPoleAbove = getMultiPoleCircuitAbove(leftNum);
    const rightMultiPoleAbove = getMultiPoleCircuitAbove(rightNum);
    const leftMultiPoleFeederAbove = getMultiPoleFeederAbove(leftNum);
    const rightMultiPoleFeederAbove = getMultiPoleFeederAbove(rightNum);
    const phase = getPhaseForRow(rowNum);
    const isEditing = (ckt: any) => ckt && editingCircuit === ckt.id;

    // Left side circuit cell
    const renderLeftCircuit = () => {
      // Check for multi-pole circuit continuation from above
      if (leftMultiPoleAbove) {
        return (
          <>
            <td colSpan={5} className="p-1 bg-gray-50 text-center text-xs text-gray-400 italic border-r border-gray-200">
              ↑ {leftMultiPoleAbove.pole}P
            </td>
          </>
        );
      }
      // Check for multi-pole feeder continuation from above
      if (leftMultiPoleFeederAbove) {
        return (
          <>
            <td colSpan={5} className="p-1 bg-purple-50 text-center text-xs text-purple-400 italic border-r border-gray-200">
              ↑ {leftMultiPoleFeederAbove.pole}P FDR
            </td>
          </>
        );
      }
      // Check for breaker-fed panel at this slot
      if (leftFeeder) {
        return (
          <>
            <td className="p-1 border-r border-gray-100 text-xs bg-purple-50 group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {leftFeeder.pole > 1 && (
                    <span className="text-[10px] font-bold text-purple-600">{leftFeeder.pole}P</span>
                  )}
                  <span className="font-bold text-purple-800 truncate max-w-[100px]" title={leftFeeder.name}>
                    {leftFeeder.name}
                  </span>
                </div>
                <button
                  onClick={() => unassignFeederFromSlot(leftFeeder.targetId)}
                  className="opacity-0 group-hover:opacity-100 text-[10px] px-1 py-0.5 bg-purple-200 hover:bg-purple-300 text-purple-700 rounded transition-opacity"
                  title="Move to feed-thru lug"
                >
                  ✕
                </button>
              </div>
            </td>
            <td className="p-1 border-r border-gray-100 text-center text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-300">
              FDR
            </td>
            <td className="p-1 border-r border-gray-100 text-center text-xs font-mono bg-purple-50/50 text-purple-600">
              {((leftFeeder.loadVA / 1000) / (selectedPanel?.phase === 3 ? 3 : 2)).toFixed(2)}
            </td>
            <td className="p-1 border-r border-gray-100 text-center text-xs font-mono bg-purple-50/50 text-purple-600">
              {((leftFeeder.loadVA / 1000) / (selectedPanel?.phase === 3 ? 3 : 2)).toFixed(2)}
            </td>
            <td className="p-1 border-r border-gray-200 text-center text-xs font-mono bg-purple-50/50 text-purple-600">
              {selectedPanel?.phase === 3 ? ((leftFeeder.loadVA / 1000) / 3).toFixed(2) : ''}
            </td>
          </>
        );
      }
      // Empty slot (SPARE)
      if (!leftCkt) {
        return (
          <>
            <td className="p-1 border-r border-gray-100 text-xs text-gray-300">SPARE</td>
            <td className="p-1 border-r border-gray-100 text-center text-xs"></td>
            <td className="p-1 border-r border-gray-100 text-center text-xs font-mono bg-gray-50"></td>
            <td className="p-1 border-r border-gray-100 text-center text-xs font-mono bg-gray-50"></td>
            <td className="p-1 border-r border-gray-200 text-center text-xs font-mono bg-gray-50"></td>
          </>
        );
      }

      const loadType = (leftCkt.load_type as LoadTypeCode) || 'O';
      
      if (isEditing(leftCkt)) {
        return (
          <>
            <td className="p-1 border-r border-gray-100">
              <input
                type="text"
                value={editForm.description || ''}
                onChange={e => setEditForm({...editForm, description: e.target.value})}
                className="w-full text-xs border border-electric-300 rounded px-1 py-0.5"
              />
            </td>
            <td className="p-1 border-r border-gray-100">
              <select
                value={editForm.loadType || 'O'}
                onChange={e => setEditForm({...editForm, loadType: e.target.value as LoadTypeCode})}
                className="w-full text-xs border border-electric-300 rounded px-0.5 py-0.5"
              >
                {LOAD_TYPES.map(lt => (
                  <option key={lt.code} value={lt.code}>{lt.code}</option>
                ))}
              </select>
            </td>
            <td colSpan={3} className="p-1 border-r border-gray-200">
              <input
                type="number"
                value={editForm.loadWatts || ''}
                onChange={e => setEditForm({...editForm, loadWatts: Number(e.target.value)})}
                className="w-full text-xs border border-electric-300 rounded px-1 py-0.5 text-center"
                placeholder="VA"
              />
            </td>
          </>
        );
      }

      return (
        <>
          <td className="p-1 border-r border-gray-100 text-xs group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {leftCkt.pole > 1 && (
                  <span className="text-[10px] font-bold text-electric-600">{leftCkt.pole}P</span>
                )}
                <span className="truncate max-w-[120px]">{leftCkt.description}</span>
              </div>
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                <button onClick={() => startEdit(leftCkt)} className="hover:text-electric-500">
                  <Edit2 className="w-3 h-3 text-gray-400" />
                </button>
                <button onClick={() => handleDeleteCircuit(leftCkt)} className="hover:text-red-500">
                  <Trash2 className="w-3 h-3 text-gray-400" />
                </button>
              </div>
            </div>
          </td>
          <td className={`p-1 border-r border-gray-100 text-center text-[10px] font-bold ${getLoadTypeColor(loadType)} border`}>
            {loadType}
          </td>
          <td className="p-1 border-r border-gray-100 text-center text-xs font-mono bg-gray-50 text-gray-600">
            {getLoadPerPhase(leftCkt, 'A') || ''}
          </td>
          <td className="p-1 border-r border-gray-100 text-center text-xs font-mono bg-gray-50 text-gray-600">
            {getLoadPerPhase(leftCkt, 'B') || ''}
          </td>
          <td className="p-1 border-r border-gray-200 text-center text-xs font-mono bg-gray-50 text-gray-600">
            {selectedPanel?.phase === 3 ? (getLoadPerPhase(leftCkt, 'C') || '') : ''}
          </td>
        </>
      );
    };

    // Right side circuit cell (mirrored)
    const renderRightCircuit = () => {
      // Check for multi-pole circuit continuation from above
      if (rightMultiPoleAbove) {
        return (
          <>
            <td colSpan={5} className="p-1 bg-gray-50 text-center text-xs text-gray-400 italic border-l border-gray-200">
              ↑ {rightMultiPoleAbove.pole}P
            </td>
          </>
        );
      }
      // Check for multi-pole feeder continuation from above
      if (rightMultiPoleFeederAbove) {
        return (
          <>
            <td colSpan={5} className="p-1 bg-purple-50 text-center text-xs text-purple-400 italic border-l border-gray-200">
              ↑ {rightMultiPoleFeederAbove.pole}P FDR
            </td>
          </>
        );
      }
      // Check for breaker-fed panel at this slot
      if (rightFeeder) {
        return (
          <>
            <td className="p-1 border-l border-gray-200 text-center text-xs font-mono bg-purple-50/50 text-purple-600">
              {selectedPanel?.phase === 3 ? ((rightFeeder.loadVA / 1000) / 3).toFixed(2) : ''}
            </td>
            <td className="p-1 border-l border-gray-100 text-center text-xs font-mono bg-purple-50/50 text-purple-600">
              {((rightFeeder.loadVA / 1000) / (selectedPanel?.phase === 3 ? 3 : 2)).toFixed(2)}
            </td>
            <td className="p-1 border-l border-gray-100 text-center text-xs font-mono bg-purple-50/50 text-purple-600">
              {((rightFeeder.loadVA / 1000) / (selectedPanel?.phase === 3 ? 3 : 2)).toFixed(2)}
            </td>
            <td className="p-1 border-l border-gray-100 text-center text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-300">
              FDR
            </td>
            <td className="p-1 border-l border-gray-100 text-xs text-right bg-purple-50 group">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => unassignFeederFromSlot(rightFeeder.targetId)}
                  className="opacity-0 group-hover:opacity-100 text-[10px] px-1 py-0.5 bg-purple-200 hover:bg-purple-300 text-purple-700 rounded transition-opacity"
                  title="Move to feed-thru lug"
                >
                  ✕
                </button>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-purple-800 truncate max-w-[100px]" title={rightFeeder.name}>
                    {rightFeeder.name}
                  </span>
                  {rightFeeder.pole > 1 && (
                    <span className="text-[10px] font-bold text-purple-600">{rightFeeder.pole}P</span>
                  )}
                </div>
              </div>
            </td>
          </>
        );
      }
      // Empty slot (SPARE)
      if (!rightCkt) {
        return (
          <>
            <td className="p-1 border-l border-gray-200 text-center text-xs font-mono bg-gray-50"></td>
            <td className="p-1 border-l border-gray-100 text-center text-xs font-mono bg-gray-50"></td>
            <td className="p-1 border-l border-gray-100 text-center text-xs font-mono bg-gray-50"></td>
            <td className="p-1 border-l border-gray-100 text-center text-xs"></td>
            <td className="p-1 border-l border-gray-100 text-xs text-gray-300 text-right">SPARE</td>
          </>
        );
      }

      const loadType = (rightCkt.load_type as LoadTypeCode) || 'O';
      
      if (isEditing(rightCkt)) {
        return (
          <>
            <td colSpan={3} className="p-1 border-l border-gray-200">
              <input
                type="number"
                value={editForm.loadWatts || ''}
                onChange={e => setEditForm({...editForm, loadWatts: Number(e.target.value)})}
                className="w-full text-xs border border-electric-300 rounded px-1 py-0.5 text-center"
                placeholder="VA"
              />
            </td>
            <td className="p-1 border-l border-gray-100">
              <select
                value={editForm.loadType || 'O'}
                onChange={e => setEditForm({...editForm, loadType: e.target.value as LoadTypeCode})}
                className="w-full text-xs border border-electric-300 rounded px-0.5 py-0.5"
              >
                {LOAD_TYPES.map(lt => (
                  <option key={lt.code} value={lt.code}>{lt.code}</option>
                ))}
              </select>
            </td>
            <td className="p-1 border-l border-gray-100">
              <input
                type="text"
                value={editForm.description || ''}
                onChange={e => setEditForm({...editForm, description: e.target.value})}
                className="w-full text-xs border border-electric-300 rounded px-1 py-0.5"
              />
            </td>
          </>
        );
      }

      return (
        <>
          <td className="p-1 border-l border-gray-200 text-center text-xs font-mono bg-gray-50 text-gray-600">
            {selectedPanel?.phase === 3 ? (getLoadPerPhase(rightCkt, 'C') || '') : ''}
          </td>
          <td className="p-1 border-l border-gray-100 text-center text-xs font-mono bg-gray-50 text-gray-600">
            {getLoadPerPhase(rightCkt, 'B') || ''}
          </td>
          <td className="p-1 border-l border-gray-100 text-center text-xs font-mono bg-gray-50 text-gray-600">
            {getLoadPerPhase(rightCkt, 'A') || ''}
          </td>
          <td className={`p-1 border-l border-gray-100 text-center text-[10px] font-bold ${getLoadTypeColor(loadType)} border`}>
            {loadType}
          </td>
          <td className="p-1 border-l border-gray-100 text-xs text-right group">
            <div className="flex items-center justify-between">
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                <button onClick={() => startEdit(rightCkt)} className="hover:text-electric-500">
                  <Edit2 className="w-3 h-3 text-gray-400" />
                </button>
                <button onClick={() => handleDeleteCircuit(rightCkt)} className="hover:text-red-500">
                  <Trash2 className="w-3 h-3 text-gray-400" />
                </button>
              </div>
              <div className="flex items-center gap-1">
                <span className="truncate max-w-[120px]">{rightCkt.description}</span>
                {rightCkt.pole > 1 && (
                  <span className="text-[10px] font-bold text-electric-600">{rightCkt.pole}P</span>
                )}
              </div>
            </div>
          </td>
        </>
      );
    };

    return (
      <tr key={rowNum} className="border-b border-gray-100 hover:bg-gray-50/50">
        {/* Left Circuit Number */}
        <td className="p-1 w-8 text-center text-xs font-mono text-gray-500 bg-gray-50 border-r border-gray-200">
          {leftCkt && isEditing(leftCkt) ? (
            <input
              type="number"
              value={editForm.circuitNumber || ''}
              onChange={e => setEditForm({...editForm, circuitNumber: Number(e.target.value)})}
              className="w-full text-xs border border-electric-300 rounded px-1 py-0.5 text-center"
              min="1"
            />
          ) : leftNum}
        </td>

        {/* Left Circuit Data */}
        {renderLeftCircuit()}

        {/* Breaker columns - show circuit or feeder data */}
        <td className={`p-1 w-10 text-center text-xs font-mono border-r border-gray-100 ${leftFeeder ? 'bg-purple-50 text-purple-700' : 'bg-white'}`}>
          {leftFeeder ? leftFeeder.breakerAmps : (leftCkt?.breaker_amps || '')}
        </td>
        <td className={`p-1 w-10 text-center text-xs font-mono border-r border-gray-100 ${leftFeeder ? 'bg-purple-50 text-purple-700' : 'bg-white'}`}>
          {leftFeeder ? leftFeeder.pole : (leftCkt?.pole || '')}
        </td>

        {/* Center Phase indicator */}
        <td className="p-1 w-8 text-center text-xs font-bold bg-electric-50 text-electric-700 border-x border-gray-300">
          {phase}
        </td>

        {/* Right breaker columns - show circuit or feeder data */}
        <td className={`p-1 w-10 text-center text-xs font-mono border-l border-gray-100 ${rightFeeder ? 'bg-purple-50 text-purple-700' : 'bg-white'}`}>
          {rightFeeder ? rightFeeder.pole : (rightCkt?.pole || '')}
        </td>
        <td className={`p-1 w-10 text-center text-xs font-mono border-l border-gray-100 ${rightFeeder ? 'bg-purple-50 text-purple-700' : 'bg-white'}`}>
          {rightFeeder ? rightFeeder.breakerAmps : (rightCkt?.breaker_amps || '')}
        </td>
        
        {/* Right Circuit Data */}
        {renderRightCircuit()}

        {/* Right Circuit Number */}
        <td className="p-1 w-8 text-center text-xs font-mono text-gray-500 bg-gray-50 border-l border-gray-200">
          {rightCkt && isEditing(rightCkt) ? (
            <input
              type="number"
              value={editForm.circuitNumber || ''}
              onChange={e => setEditForm({...editForm, circuitNumber: Number(e.target.value)})}
              className="w-full text-xs border border-electric-300 rounded px-1 py-0.5 text-center"
              min="1"
            />
          ) : rightNum}
        </td>
      </tr>
    );
  };

  if (panels.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <LayoutGrid className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No panels available. Add panels in Circuit Design tab.</p>
        </div>
      </div>
    );
  }

  if (!selectedPanel) return null;

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Panel Tabs */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {panels.map(panel => (
          <button
            key={panel.id}
            onClick={() => setSelectedPanelId(panel.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              selectedPanelId === panel.id
                ? 'border-electric-500 text-electric-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {panel.name}
            <span className="ml-2 text-xs text-gray-400">
              ({circuits.filter(c => c.panel_id === panel.id).length})
            </span>
          </button>
        ))}
      </div>

      {/* Panel Header Info */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 border-b border-gray-200">
          <div>
            <span className="text-[10px] uppercase text-gray-500 font-semibold">Main Breaker</span>
            <div className="text-sm font-bold">{selectedPanel.main_breaker_amps || 'MLO'} A</div>
          </div>
          <div>
            <span className="text-[10px] uppercase text-gray-500 font-semibold">Voltage</span>
            <div className="text-sm font-bold">{selectedPanel.voltage}V / {selectedPanel.phase === 3 ? '120V' : '120V'}</div>
          </div>
          <div>
            <span className="text-[10px] uppercase text-gray-500 font-semibold">Bus Rating</span>
            <div className="text-sm font-bold">{selectedPanel.bus_rating} A</div>
          </div>
          <div>
            <span className="text-[10px] uppercase text-gray-500 font-semibold">Phase / Wire</span>
            <div className="text-sm font-bold">{selectedPanel.phase}Φ / {selectedPanel.phase === 3 ? 4 : 3}W</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center p-3 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-gray-900">{selectedPanel.name}</h2>
            {selectedPanel.location && (
              <span className="text-xs text-gray-500">Location: {selectedPanel.location}</span>
            )}
          </div>
          <div className="flex gap-2">
            {editingCircuit && (
              <div className="flex gap-1">
                <button
                  onClick={saveEdit}
                  className="flex items-center gap-1 px-3 py-1.5 bg-electric-400 text-black rounded text-xs font-medium hover:bg-electric-500"
                >
                  <Save className="w-3 h-3" /> Save
                </button>
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-xs font-medium hover:bg-gray-300"
                >
                  <X className="w-3 h-3" /> Cancel
                </button>
              </div>
            )}
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded text-xs font-medium hover:bg-gray-50"
            >
              <Download className="w-3 h-3" /> Export PDF
            </button>
            {panels.length > 1 && (
              <button
                onClick={handleExportAllPanels}
                className="flex items-center gap-1 px-3 py-1.5 bg-electric-400 text-black rounded text-xs font-medium hover:bg-electric-500"
              >
                <Download className="w-3 h-3" /> All Panels
              </button>
            )}
          </div>
        </div>

        {/* Panel Schedule Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-800 text-white">
              <tr>
                <th className="p-1.5 w-8 text-center font-semibold border-r border-gray-600">#</th>
                <th className="p-1.5 text-left font-semibold" style={{minWidth: '140px'}}>CIRCUIT DESCRIPTION</th>
                <th className="p-1.5 w-8 text-center font-semibold">CODE</th>
                <th colSpan={3} className="p-1.5 text-center font-semibold bg-gray-700">LOAD/PHASE (KVA)</th>
                <th className="p-1.5 w-10 text-center font-semibold border-l border-gray-600">TRIP</th>
                <th className="p-1.5 w-10 text-center font-semibold">POLES</th>
                <th className="p-1.5 w-8 text-center font-semibold bg-electric-600 text-black border-x border-gray-600">Φ</th>
                <th className="p-1.5 w-10 text-center font-semibold">POLES</th>
                <th className="p-1.5 w-10 text-center font-semibold border-r border-gray-600">TRIP</th>
                <th colSpan={3} className="p-1.5 text-center font-semibold bg-gray-700">LOAD/PHASE (KVA)</th>
                <th className="p-1.5 w-8 text-center font-semibold">CODE</th>
                <th className="p-1.5 text-right font-semibold" style={{minWidth: '140px'}}>CIRCUIT DESCRIPTION</th>
                <th className="p-1.5 w-8 text-center font-semibold border-l border-gray-600">#</th>
              </tr>
              <tr className="bg-gray-700 text-gray-300 text-[10px]">
                <th className="p-1 border-r border-gray-600"></th>
                <th className="p-1"></th>
                <th className="p-1"></th>
                <th className="p-1 text-center border-l border-gray-600">A</th>
                <th className="p-1 text-center">B</th>
                <th className="p-1 text-center border-r border-gray-600">{selectedPanel.phase === 3 ? 'C' : ''}</th>
                <th className="p-1"></th>
                <th className="p-1"></th>
                <th className="p-1 bg-electric-600"></th>
                <th className="p-1"></th>
                <th className="p-1"></th>
                <th className="p-1 text-center border-l border-gray-600">{selectedPanel.phase === 3 ? 'C' : ''}</th>
                <th className="p-1 text-center">B</th>
                <th className="p-1 text-center border-r border-gray-600">A</th>
                <th className="p-1"></th>
                <th className="p-1"></th>
                <th className="p-1 border-l border-gray-600"></th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {Array.from({ length: Math.ceil(totalSlots / 2) }).map((_, i) => renderRow(i + 1))}

              {/* Add Circuit Row - Inline */}
              <tr className="bg-electric-50 border-t-2 border-electric-300 hover:bg-electric-100">
                {/* Left Side - Add Circuit */}
                {addingCircuit === 'left' ? (
                  <>
                    <td className="p-1 text-center" style={{minWidth: '55px'}}>
                      <input
                        type="number"
                        value={newCircuit.circuitNumber || ''}
                        onChange={e => handleCircuitNumberChange(e.target.value)}
                        placeholder="#"
                        className={`w-full border rounded px-1.5 py-0.5 text-xs text-center font-medium ${
                          newCircuit.circuitNumber && !isCircuitSlotAvailable(newCircuit.circuitNumber, newCircuit.pole || 1)
                            ? 'border-red-500 bg-red-50'
                            : 'border-gray-300'
                        }`}
                        style={{minWidth: '50px'}}
                        title={
                          newCircuit.circuitNumber && !isCircuitSlotAvailable(newCircuit.circuitNumber, newCircuit.pole || 1)
                            ? 'Slot occupied or conflicts with existing circuit'
                            : 'Circuit number (odd numbers for left side)'
                        }
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        value={newCircuit.description || ''}
                        onChange={e => setNewCircuit({...newCircuit, description: e.target.value})}
                        placeholder="Description"
                        className="w-full border border-gray-300 rounded px-1 py-0.5 text-xs"
                        autoFocus
                      />
                    </td>
                    <td className="p-1">
                      <select
                        value={newCircuit.loadType || 'O'}
                        onChange={e => setNewCircuit({...newCircuit, loadType: e.target.value as LoadTypeCode})}
                        className="w-full border border-gray-300 rounded px-1 py-0.5 text-[10px]"
                      >
                        {LOAD_TYPES.map(lt => <option key={lt.code} value={lt.code}>{lt.code}</option>)}
                      </select>
                    </td>
                    <td colSpan={3} className="p-1">
                      <input
                        type="number"
                        value={newCircuit.loadWatts || ''}
                        onChange={e => setNewCircuit({...newCircuit, loadWatts: Number(e.target.value)})}
                        placeholder="VA"
                        className="w-full border border-gray-300 rounded px-1 py-0.5 text-xs"
                      />
                    </td>
                    <td className="p-1">
                      <select
                        value={newCircuit.breakerAmps || 20}
                        onChange={e => setNewCircuit({...newCircuit, breakerAmps: Number(e.target.value)})}
                        className="w-full border border-gray-300 rounded px-1 py-0.5 text-[10px]"
                      >
                        <option value="15">15</option>
                        <option value="20">20</option>
                        <option value="30">30</option>
                        <option value="40">40</option>
                        <option value="50">50</option>
                        <option value="60">60</option>
                        <option value="100">100</option>
                      </select>
                    </td>
                    <td className="p-1">
                      <select
                        value={newCircuit.pole || 1}
                        onChange={e => handlePoleChange(Number(e.target.value) as 1 | 2 | 3)}
                        className="w-full border border-gray-300 rounded px-1 py-0.5 text-[10px]"
                      >
                        <option value="1">1P</option>
                        <option value="2">2P</option>
                        {selectedPanel?.phase === 3 && <option value="3">3P</option>}
                      </select>
                    </td>
                  </>
                ) : (
                  <>
                    <td colSpan={2} className="p-2 text-center">
                      <button
                        onClick={() => startAddCircuit('left')}
                        className="text-xs text-electric-600 hover:text-electric-700 font-medium flex items-center justify-center gap-1 w-full"
                      >
                        <Plus className="w-3 h-3" /> Add Circuit
                      </button>
                    </td>
                    <td colSpan={6}></td>
                  </>
                )}

                {/* Center Phase Column */}
                <td className="p-1 bg-electric-600"></td>

                {/* Right Side - Add Circuit */}
                {addingCircuit === 'right' ? (
                  <>
                    <td className="p-1">
                      <select
                        value={newCircuit.pole || 1}
                        onChange={e => handlePoleChange(Number(e.target.value) as 1 | 2 | 3)}
                        className="w-full border border-gray-300 rounded px-1 py-0.5 text-[10px]"
                      >
                        <option value="1">1P</option>
                        <option value="2">2P</option>
                        {selectedPanel?.phase === 3 && <option value="3">3P</option>}
                      </select>
                    </td>
                    <td className="p-1">
                      <select
                        value={newCircuit.breakerAmps || 20}
                        onChange={e => setNewCircuit({...newCircuit, breakerAmps: Number(e.target.value)})}
                        className="w-full border border-gray-300 rounded px-1 py-0.5 text-[10px]"
                      >
                        <option value="15">15</option>
                        <option value="20">20</option>
                        <option value="30">30</option>
                        <option value="40">40</option>
                        <option value="50">50</option>
                        <option value="60">60</option>
                        <option value="100">100</option>
                      </select>
                    </td>
                    <td colSpan={3} className="p-1">
                      <input
                        type="number"
                        value={newCircuit.loadWatts || ''}
                        onChange={e => setNewCircuit({...newCircuit, loadWatts: Number(e.target.value)})}
                        placeholder="VA"
                        className="w-full border border-gray-300 rounded px-1 py-0.5 text-xs"
                      />
                    </td>
                    <td className="p-1">
                      <select
                        value={newCircuit.loadType || 'O'}
                        onChange={e => setNewCircuit({...newCircuit, loadType: e.target.value as LoadTypeCode})}
                        className="w-full border border-gray-300 rounded px-1 py-0.5 text-[10px]"
                      >
                        {LOAD_TYPES.map(lt => <option key={lt.code} value={lt.code}>{lt.code}</option>)}
                      </select>
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        value={newCircuit.description || ''}
                        onChange={e => setNewCircuit({...newCircuit, description: e.target.value})}
                        placeholder="Description"
                        className="w-full border border-gray-300 rounded px-1 py-0.5 text-xs"
                      />
                    </td>
                    <td className="p-1 text-center" style={{minWidth: '55px'}}>
                      <input
                        type="number"
                        value={newCircuit.circuitNumber || ''}
                        onChange={e => handleCircuitNumberChange(e.target.value)}
                        placeholder="#"
                        className={`w-full border rounded px-1.5 py-0.5 text-xs text-center font-medium ${
                          newCircuit.circuitNumber && !isCircuitSlotAvailable(newCircuit.circuitNumber, newCircuit.pole || 1)
                            ? 'border-red-500 bg-red-50'
                            : 'border-gray-300'
                        }`}
                        style={{minWidth: '50px'}}
                        title={
                          newCircuit.circuitNumber && !isCircuitSlotAvailable(newCircuit.circuitNumber, newCircuit.pole || 1)
                            ? 'Slot occupied or conflicts with existing circuit'
                            : 'Circuit number (even numbers for right side)'
                        }
                      />
                    </td>
                  </>
                ) : (
                  <>
                    <td colSpan={6}></td>
                    <td colSpan={2} className="p-2 text-center">
                      <button
                        onClick={() => startAddCircuit('right')}
                        className="text-xs text-electric-600 hover:text-electric-700 font-medium flex items-center justify-center gap-1 w-full"
                      >
                        <Plus className="w-3 h-3" /> Add Circuit
                      </button>
                    </td>
                  </>
                )}
              </tr>

              {/* Save/Cancel Row - shown when adding circuit */}
              {addingCircuit && (
                <tr className="bg-electric-100 border-b border-electric-300">
                  <td colSpan={17} className="p-2 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={handleAddCircuit}
                        disabled={!newCircuit.description}
                        className="flex items-center gap-1 px-3 py-1 bg-gray-900 hover:bg-black text-white rounded text-xs font-medium disabled:opacity-50"
                      >
                        <Save className="w-3 h-3" /> Save Circuit
                      </button>
                      <button
                        onClick={cancelAddCircuit}
                        className="flex items-center gap-1 px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs font-medium"
                      >
                        <X className="w-3 h-3" /> Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {/* Feed-Thru Lug Section - Panels/Transformers NOT assigned to breaker slots */}
              {lugFedPanels.length > 0 && (
                <>
                  <tr className="bg-purple-50 border-t-2 border-purple-300">
                    <td colSpan={17} className="p-2 text-xs font-bold text-purple-800">
                      ⚡ FEED-THRU LUGS (Not Breaker-Fed)
                    </td>
                  </tr>
                  {lugFedPanels.map((feeder, idx) => (
                    <tr key={feeder.id} className={`${idx % 2 === 0 ? 'bg-purple-50/50' : 'bg-white'} hover:bg-purple-100/50`}>
                      <td className="p-1 text-center text-xs font-mono text-purple-600">
                        {feeder.type === 'panel' && assigningFeederId === feeder.targetId ? (
                          <select
                            className="w-full text-[10px] border border-purple-300 rounded px-0.5 py-0.5 bg-white"
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                assignFeederToSlot(feeder.targetId, parseInt(e.target.value));
                              }
                            }}
                            onBlur={() => setAssigningFeederId(null)}
                            autoFocus
                          >
                            <option value="">Slot #</option>
                            {getAvailableSlotsForFeeder(feeder.pole).map(slot => (
                              <option key={slot} value={slot}>
                                {slot} ({slot % 2 === 1 ? 'L' : 'R'})
                              </option>
                            ))}
                          </select>
                        ) : feeder.type === 'panel' ? (
                          <button
                            onClick={() => setAssigningFeederId(feeder.targetId)}
                            className="text-[10px] px-1 py-0.5 bg-purple-200 hover:bg-purple-300 text-purple-700 rounded"
                            title="Assign to breaker slot"
                          >
                            +BKR
                          </button>
                        ) : '—'}
                      </td>
                      <td className="p-1 border-r border-gray-100">
                        <span className="text-xs font-bold text-purple-800">{feeder.name}</span>
                        <span className="text-[10px] text-purple-500 ml-1">
                          ({feeder.type === 'panel' ? 'Panel' : 'Transformer'})
                        </span>
                      </td>
                      <td className="p-1 text-center text-xs font-mono">{feeder.breakerAmps}A</td>
                      {/* Phase loads - distributed evenly for feeders */}
                      <td className="p-1 text-center text-xs font-mono bg-purple-50/30">
                        {((feeder.loadVA / 1000) / (selectedPanel?.phase === 3 ? 3 : 2)).toFixed(2)}
                      </td>
                      <td className="p-1 text-center text-xs font-mono bg-purple-50/30">
                        {((feeder.loadVA / 1000) / (selectedPanel?.phase === 3 ? 3 : 2)).toFixed(2)}
                      </td>
                      <td className="p-1 text-center text-xs font-mono bg-purple-50/30">
                        {selectedPanel?.phase === 3 ? ((feeder.loadVA / 1000) / 3).toFixed(2) : ''}
                      </td>
                      <td className="p-1 text-center text-xs font-mono">{(feeder.loadVA / 1000).toFixed(1)}</td>
                      <td className="p-1 text-center">
                        <span className={`text-[10px] px-1 py-0.5 rounded ${feeder.type === 'panel' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                          {feeder.pole}P
                        </span>
                      </td>
                      {/* Center bus bar section */}
                      <td className="p-1 bg-electric-500 text-electric-100 text-center text-[10px] font-mono">
                        LUG
                      </td>
                      <td className="p-1 text-center">
                        <span className={`text-[10px] px-1 py-0.5 rounded ${feeder.type === 'panel' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                          {feeder.pole}P
                        </span>
                      </td>
                      <td className="p-1 text-center text-xs font-mono">{(feeder.loadVA / 1000).toFixed(1)}</td>
                      {/* Right phase loads */}
                      <td className="p-1 text-center text-xs font-mono bg-purple-50/30">
                        {selectedPanel?.phase === 3 ? ((feeder.loadVA / 1000) / 3).toFixed(2) : ''}
                      </td>
                      <td className="p-1 text-center text-xs font-mono bg-purple-50/30">
                        {((feeder.loadVA / 1000) / (selectedPanel?.phase === 3 ? 3 : 2)).toFixed(2)}
                      </td>
                      <td className="p-1 text-center text-xs font-mono bg-purple-50/30">
                        {((feeder.loadVA / 1000) / (selectedPanel?.phase === 3 ? 3 : 2)).toFixed(2)}
                      </td>
                      <td className="p-1 text-center text-xs font-mono">{feeder.breakerAmps}A</td>
                      <td className="p-1 border-l border-gray-100">
                        <span className="text-xs font-bold text-purple-800">{feeder.name}</span>
                      </td>
                      <td className="p-1 text-center text-xs font-mono text-purple-600">—</td>
                    </tr>
                  ))}
                  <tr className="bg-purple-100 border-b border-purple-300">
                    <td colSpan={6} className="p-2 text-right text-xs font-semibold text-purple-800">
                      FEED-THRU TOTAL:
                    </td>
                    <td className="p-2 text-center text-xs font-mono font-bold text-purple-900">
                      {(lugFedPanels.reduce((sum, f) => sum + f.loadVA, 0) / 1000).toFixed(1)} kVA
                    </td>
                    <td colSpan={3}></td>
                    <td className="p-2 text-center text-xs font-mono font-bold text-purple-900">
                      {(lugFedPanels.reduce((sum, f) => sum + f.loadVA, 0) / 1000).toFixed(1)} kVA
                    </td>
                    <td colSpan={6}></td>
                  </tr>
                </>
              )}

              {/* Phase Totals Row */}
              <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                <td colSpan={3} className="p-2 text-right text-xs">PHASE TOTALS (KVA):</td>
                <td className="p-2 text-center text-xs font-mono">
                  {demandResult?.phaseLoads.find(p => p.phase === 'A')?.connectedLoad_kVA.toFixed(1) || '0.0'}
                </td>
                <td className="p-2 text-center text-xs font-mono">
                  {demandResult?.phaseLoads.find(p => p.phase === 'B')?.connectedLoad_kVA.toFixed(1) || '0.0'}
                </td>
                <td className="p-2 text-center text-xs font-mono">
                  {selectedPanel.phase === 3 ? (demandResult?.phaseLoads.find(p => p.phase === 'C')?.connectedLoad_kVA.toFixed(1) || '0.0') : ''}
                </td>
                <td colSpan={5}></td>
                <td className="p-2 text-center text-xs font-mono">
                  {selectedPanel.phase === 3 ? (demandResult?.phaseLoads.find(p => p.phase === 'C')?.connectedLoad_kVA.toFixed(1) || '0.0') : ''}
                </td>
                <td className="p-2 text-center text-xs font-mono">
                  {demandResult?.phaseLoads.find(p => p.phase === 'B')?.connectedLoad_kVA.toFixed(1) || '0.0'}
                </td>
                <td className="p-2 text-center text-xs font-mono">
                  {demandResult?.phaseLoads.find(p => p.phase === 'A')?.connectedLoad_kVA.toFixed(1) || '0.0'}
                </td>
                <td colSpan={3}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Demand Factor Summary */}
      {demandResult && showDemandDetails && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Demand Factors by Type */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-800 text-white px-4 py-2 flex items-center justify-between">
              <span className="font-semibold text-sm">DEMAND FACTOR CALCULATION (NEC ARTICLE 220)</span>
              <Calculator className="w-4 h-4" />
            </div>
            <table className="w-full text-xs">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">LOAD TYPE</th>
                  <th className="p-2 text-center">CONN. LOAD (KVA)</th>
                  <th className="p-2 text-center">ADJUST. FACTOR</th>
                  <th className="p-2 text-center">DEMAND FACTOR</th>
                  <th className="p-2 text-center">DEMAND LOAD (KVA)</th>
                </tr>
              </thead>
              <tbody>
                {(demandResult.loadsByType || []).map(lt => (
                  <tr key={lt.type} className="border-t border-gray-100">
                    <td className="p-2">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${getLoadTypeColor(lt.type)} border mr-2`}>
                        {lt.type}
                      </span>
                      {lt.label}
                    </td>
                    <td className="p-2 text-center font-mono">{lt.connectedLoad_kVA.toFixed(2)}</td>
                    <td className="p-2 text-center font-mono">{lt.adjustmentFactor.toFixed(2)}</td>
                    <td className="p-2 text-center font-mono">{lt.demandFactor.toFixed(2)}</td>
                    <td className="p-2 text-center font-mono font-semibold">{lt.demandLoad_kVA.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold">
                <tr className="border-t-2 border-gray-300">
                  <td className="p-2">TOTALS</td>
                  <td className="p-2 text-center font-mono">{demandResult.totalConnectedLoad_kVA.toFixed(2)}</td>
                  <td className="p-2 text-center">—</td>
                  <td className="p-2 text-center">—</td>
                  <td className="p-2 text-center font-mono text-electric-600">{demandResult.totalDemandLoad_kVA.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Summary Stats */}
          <div className="space-y-4">
            {/* Load Summary */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
                <Settings className="w-4 h-4" /> PANEL SUMMARY
              </h4>
              <div className="grid grid-cols-2 gap-4">
                {/* Direct Circuits */}
                <div className="bg-gray-50 rounded p-3">
                  <span className="text-[10px] uppercase text-gray-500 block">Direct Circuits Load</span>
                  <span className="text-xl font-bold text-gray-900">{demandResult.totalConnectedLoad_kVA.toFixed(1)} KVA</span>
                </div>
                <div className="bg-electric-50 rounded p-3">
                  <span className="text-[10px] uppercase text-gray-500 block">Direct Demand Load</span>
                  <span className="text-xl font-bold text-electric-600">{demandResult.totalDemandLoad_kVA.toFixed(1)} KVA</span>
                </div>
                
                {/* Feeder Circuits (if any) */}
                {feederCircuits.length > 0 && (
                  <>
                    <div className="bg-purple-50 rounded p-3">
                      <span className="text-[10px] uppercase text-purple-600 block">Feeder Circuits ({feederCircuits.length})</span>
                      <span className="text-xl font-bold text-purple-800">
                        {((demandResult as any).feederTotalVA / 1000).toFixed(1)} KVA
                      </span>
                    </div>
                    <div className="bg-purple-100 rounded p-3 border border-purple-300">
                      <span className="text-[10px] uppercase text-purple-700 block font-semibold">TOTAL WITH FEEDERS</span>
                      <span className="text-xl font-bold text-purple-900">
                        {((demandResult as any).totalWithFeeders_kVA || demandResult.totalDemandLoad_kVA).toFixed(1)} KVA
                      </span>
                    </div>
                  </>
                )}
                
                <div className="bg-blue-50 rounded p-3">
                  <span className="text-[10px] uppercase text-gray-500 block">Demand Amps</span>
                  <span className="text-xl font-bold text-blue-600">{demandResult.demandAmps.toFixed(1)} A</span>
                </div>
                <div className={`rounded p-3 ${demandResult.percentImbalance > 10 ? 'bg-red-50' : 'bg-green-50'}`}>
                  <span className="text-[10px] uppercase text-gray-500 block">Phase Imbalance</span>
                  <span className={`text-xl font-bold ${demandResult.percentImbalance > 10 ? 'text-red-600' : 'text-green-600'}`}>
                    {demandResult.percentImbalance.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Upstream Load Aggregation (when panel has downstream loads) */}
            {aggregatedLoad && aggregatedLoad.downstreamPanelCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-sm text-amber-800 mb-3 flex items-center gap-2">
                  <ArrowDown className="w-4 h-4" /> AGGREGATED LOAD (NEC 220.40)
                </h4>
                <p className="text-xs text-amber-700 mb-3">
                  This panel feeds {aggregatedLoad.downstreamPanelCount} downstream panel{aggregatedLoad.downstreamPanelCount > 1 ? 's' : ''}.
                  Demand factors applied to system-wide totals ({aggregatedLoad.occupancyType} occupancy).
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/50 rounded p-2">
                    <span className="text-[10px] uppercase text-amber-600 block">Total Connected</span>
                    <span className="text-base font-bold text-gray-900">{(aggregatedLoad.totalConnectedVA / 1000).toFixed(1)} kVA</span>
                  </div>
                  <div className="bg-amber-100 rounded p-2">
                    <span className="text-[10px] uppercase text-amber-700 block">Total Demand</span>
                    <span className="text-base font-bold text-amber-900">{(aggregatedLoad.totalDemandVA / 1000).toFixed(1)} kVA</span>
                  </div>
                  <div className="bg-white/50 rounded p-2 col-span-2">
                    <span className="text-[10px] uppercase text-amber-600 block">Overall Demand Factor</span>
                    <span className="text-base font-bold text-green-700">{(aggregatedLoad.overallDemandFactor * 100).toFixed(1)}%</span>
                  </div>
                </div>

                {/* Demand Breakdown by Load Type */}
                {aggregatedLoad.demandBreakdown.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-amber-200">
                    <span className="text-[10px] uppercase text-amber-600 block mb-2">Demand by Load Type (NEC Factors Applied)</span>
                    <div className="space-y-1">
                      {aggregatedLoad.demandBreakdown.map((item, i) => (
                        <div key={i} className="flex justify-between items-center text-xs">
                          <span className="text-amber-800 font-medium">{item.loadType}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">{(item.connectedVA / 1000).toFixed(1)} kVA →</span>
                            <span className="font-bold text-amber-900">{(item.demandVA / 1000).toFixed(1)} kVA</span>
                            <span className="text-green-600 text-[10px]">({(item.demandFactor * 100).toFixed(0)}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Source Breakdown */}
                {aggregatedLoad.sourceBreakdown.length > 1 && (
                  <div className="mt-3 pt-3 border-t border-amber-200">
                    <span className="text-[10px] uppercase text-amber-600 block mb-2">Sources (Connected VA)</span>
                    <ul className="text-xs text-amber-800 space-y-1">
                      {aggregatedLoad.sourceBreakdown.map((item, i) => (
                        <li key={i} className="flex justify-between">
                          <span className="flex items-center gap-1">
                            {item.sourceType === 'panel' && <span className="text-amber-500">⬇</span>}
                            {item.sourceType === 'transformer' && <span className="text-purple-500">⚡</span>}
                            {item.sourceType === 'direct' && <span className="text-gray-400">○</span>}
                            {item.sourceName}
                          </span>
                          <span className="font-mono">{(item.connectedVA / 1000).toFixed(1)} kVA</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* NEC References */}
            {(demandResult.necReferences?.length || 0) > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-sm text-blue-800 mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4" /> NEC References Applied
                </h4>
                <ul className="text-xs text-blue-700 space-y-1">
                  {(demandResult.necReferences || []).map((ref, i) => (
                    <li key={i}>• {ref}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Load Type Legend */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-sm text-gray-700 mb-2">LOAD TYPE CODES</h4>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {LOAD_TYPES.map(lt => (
                  <div key={lt.code} className="flex items-center gap-1">
                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${getLoadTypeColor(lt.code)} border`}>
                      {lt.code}
                    </span>
                    <span className="text-gray-600">{lt.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
