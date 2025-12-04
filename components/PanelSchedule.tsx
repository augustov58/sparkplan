/**
 * Panel Schedule Component - NEC Article 220 Compliant
 * Professional electrical panel schedule with load type classification
 * and demand factor calculations per NEC 2023
 */

import React, { useState, useMemo } from 'react';
import { Project } from '../types';
import { LayoutGrid, Download, Edit2, Save, X, Trash2, Settings, Calculator, Info } from 'lucide-react';
import { usePanels } from '../hooks/usePanels';
import { useCircuits } from '../hooks/useCircuits';
import { exportPanelSchedulePDF, exportAllPanelsPDF } from '../services/pdfExport/panelSchedulePDF';
import { 
  calculatePanelDemand, 
  getCircuitPhase, 
  getLoadTypeColor,
  type CircuitLoad 
} from '../services/calculations/demandFactor';
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
  const { panels } = usePanels(project.id);
  const { circuits, updateCircuit, deleteCircuit } = useCircuits(project.id);

  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [editingCircuit, setEditingCircuit] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    description?: string;
    breakerAmps?: number;
    loadWatts?: number;
    loadType?: LoadTypeCode;
  }>({});
  const [showDemandDetails, setShowDemandDetails] = useState(true);

  // Select first panel by default
  React.useEffect(() => {
    if (panels.length > 0 && !selectedPanelId) {
      setSelectedPanelId(panels[0].id);
    }
  }, [panels, selectedPanelId]);

  const selectedPanel = panels.find(p => p.id === selectedPanelId);
  const panelCircuits = circuits.filter(c => c.panel_id === selectedPanelId);

  // Calculate demand factors
  const demandResult = useMemo(() => {
    if (!selectedPanel || panelCircuits.length === 0) return null;

    const circuitLoads: CircuitLoad[] = panelCircuits.map(c => ({
      id: c.id,
      description: c.description,
      loadWatts: c.load_watts || 0,
      loadType: (c.load_type as LoadTypeCode) || 'O',
      pole: c.pole,
      circuitNumber: c.circuit_number,
      phase: getCircuitPhase(c.circuit_number, selectedPanel.phase),
    }));

    return calculatePanelDemand(circuitLoads, selectedPanel.voltage, selectedPanel.phase);
  }, [selectedPanel, panelCircuits]);

  // Generate slots based on panel bus rating
  const totalSlots = selectedPanel ? Math.min(42, Math.ceil(selectedPanel.bus_rating / 10)) : 42;

  // Helper to find circuit at specific slot number
  const getCircuit = (num: number) => panelCircuits.find(c => c.circuit_number === num);

  // Get phase letter for a row
  const getPhaseForRow = (rowNum: number) => {
    if (!selectedPanel) return 'A';
    if (selectedPanel.phase === 3) {
      return ['A', 'B', 'C'][(rowNum - 1) % 3];
    }
    return ['A', 'B'][(rowNum - 1) % 2];
  };

  const startEdit = (circuit: any) => {
    setEditingCircuit(circuit.id);
    setEditForm({
      description: circuit.description,
      breakerAmps: circuit.breaker_amps,
      loadWatts: circuit.load_watts,
      loadType: circuit.load_type || 'O',
    });
  };

  const saveEdit = async () => {
    if (!editingCircuit) return;
    await updateCircuit(editingCircuit, {
      description: editForm.description,
      breaker_amps: editForm.breakerAmps,
      load_watts: editForm.loadWatts,
      load_type: editForm.loadType,
    });
    setEditingCircuit(null);
    setEditForm({});
  };

  const cancelEdit = () => {
    setEditingCircuit(null);
    setEditForm({});
  };

  const handleDeleteCircuit = async (circuit: any) => {
    if (confirm(`Delete circuit ${circuit.circuit_number} - "${circuit.description}"?`)) {
      await deleteCircuit(circuit.id);
    }
  };

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
    const leftMultiPoleAbove = getMultiPoleCircuitAbove(leftNum);
    const rightMultiPoleAbove = getMultiPoleCircuitAbove(rightNum);
    const phase = getPhaseForRow(rowNum);
    const isEditing = (ckt: any) => ckt && editingCircuit === ckt.id;

    // Left side circuit cell
    const renderLeftCircuit = () => {
      if (leftMultiPoleAbove) {
        return (
          <>
            <td colSpan={5} className="p-1 bg-gray-50 text-center text-xs text-gray-400 italic border-r border-gray-200">
              ↑ {leftMultiPoleAbove.pole}P
            </td>
          </>
        );
      }
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
      if (rightMultiPoleAbove) {
        return (
          <>
            <td colSpan={5} className="p-1 bg-gray-50 text-center text-xs text-gray-400 italic border-l border-gray-200">
              ↑ {rightMultiPoleAbove.pole}P
            </td>
          </>
        );
      }
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
        <td className="p-1 w-8 text-center text-xs font-mono text-gray-500 bg-gray-50 border-r border-gray-200">{leftNum}</td>
        
        {/* Left Circuit Data */}
        {renderLeftCircuit()}
        
        {/* Breaker columns */}
        <td className="p-1 w-10 text-center text-xs font-mono border-r border-gray-100 bg-white">
          {leftCkt?.breaker_amps || ''}
        </td>
        <td className="p-1 w-10 text-center text-xs font-mono border-r border-gray-100 bg-white">
          {leftCkt?.pole || ''}
        </td>
        
        {/* Center Phase indicator */}
        <td className="p-1 w-8 text-center text-xs font-bold bg-electric-50 text-electric-700 border-x border-gray-300">
          {phase}
        </td>
        
        {/* Right breaker columns */}
        <td className="p-1 w-10 text-center text-xs font-mono border-l border-gray-100 bg-white">
          {rightCkt?.pole || ''}
        </td>
        <td className="p-1 w-10 text-center text-xs font-mono border-l border-gray-100 bg-white">
          {rightCkt?.breaker_amps || ''}
        </td>
        
        {/* Right Circuit Data */}
        {renderRightCircuit()}
        
        {/* Right Circuit Number */}
        <td className="p-1 w-8 text-center text-xs font-mono text-gray-500 bg-gray-50 border-l border-gray-200">{rightNum}</td>
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
                {demandResult.loadsByType.map(lt => (
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
                <div className="bg-gray-50 rounded p-3">
                  <span className="text-[10px] uppercase text-gray-500 block">Total Connected Load</span>
                  <span className="text-xl font-bold text-gray-900">{demandResult.totalConnectedLoad_kVA.toFixed(1)} KVA</span>
                </div>
                <div className="bg-electric-50 rounded p-3">
                  <span className="text-[10px] uppercase text-gray-500 block">Total Demand Load</span>
                  <span className="text-xl font-bold text-electric-600">{demandResult.totalDemandLoad_kVA.toFixed(1)} KVA</span>
                </div>
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

            {/* NEC References */}
            {demandResult.necReferences.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-sm text-blue-800 mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4" /> NEC References Applied
                </h4>
                <ul className="text-xs text-blue-700 space-y-1">
                  {demandResult.necReferences.map((ref, i) => (
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
