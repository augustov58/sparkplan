import React, { useState } from 'react';
import { Project, PanelCircuit } from '../types';
import { LayoutGrid, Download, Edit2, Save, X, Trash2 } from 'lucide-react';
import { usePanels } from '../hooks/usePanels';
import { useCircuits } from '../hooks/useCircuits';
import { exportPanelSchedulePDF, exportAllPanelsPDF } from '../services/pdfExport/panelSchedulePDF';

interface PanelScheduleProps {
  project: Project;
}

export const PanelSchedule: React.FC<PanelScheduleProps> = ({ project }) => {
  const { panels, updatePanel } = usePanels(project.id);
  const { circuits, updateCircuit, deleteCircuit } = useCircuits(project.id);

  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [editingCircuit, setEditingCircuit] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PanelCircuit>>({});

  // Select first panel by default
  React.useEffect(() => {
    if (panels.length > 0 && !selectedPanelId) {
      setSelectedPanelId(panels[0].id);
    }
  }, [panels, selectedPanelId]);

  const selectedPanel = panels.find(p => p.id === selectedPanelId);
  const panelCircuits = circuits.filter(c => c.panel_id === selectedPanelId);

  // Generate slots based on panel bus rating
  const totalSlots = selectedPanel ? Math.min(42, Math.ceil(selectedPanel.bus_rating / 10)) : 42;

  // Helper to find circuit at specific slot number
  const getCircuit = (num: number) => panelCircuits.find(c => c.circuit_number === num);

  const startEdit = (circuit: any) => {
    setEditingCircuit(circuit.id);
    setEditForm({
      description: circuit.description,
      breakerAmps: circuit.breaker_amps,
      conductorSize: circuit.conductor_size,
      loadWatts: circuit.load_watts
    });
  };

  const saveEdit = async () => {
    if (!editingCircuit) return;
    await updateCircuit(editingCircuit, {
      description: editForm.description,
      breaker_amps: editForm.breakerAmps,
      conductor_size: editForm.conductorSize,
      load_watts: editForm.loadWatts
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
    if (!selectedPanel) {
      alert('No panel selected');
      return;
    }

    try {
      console.log('Exporting panel:', selectedPanel);
      console.log('Circuits:', panelCircuits);

      await exportPanelSchedulePDF(
        selectedPanel,
        panelCircuits,
        project.name,
        project.address
      );

      console.log('PDF export completed successfully');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to export PDF: ${errorMessage}\n\nCheck browser console for details.`);
    }
  };

  const handleExportAllPanels = async () => {
    if (panels.length === 0) {
      alert('No panels to export');
      return;
    }

    try {
      console.log('Exporting all panels:', panels.length);

      // Create a map of circuits by panel ID
      const circuitsByPanel = new Map<string, PanelCircuit[]>();
      panels.forEach(panel => {
        const panelCircuits = circuits.filter(c => c.panel_id === panel.id);
        circuitsByPanel.set(panel.id, panelCircuits);
      });

      await exportAllPanelsPDF(
        panels,
        circuitsByPanel,
        project.name,
        project.address
      );

      console.log('Multi-panel PDF export completed successfully');
    } catch (error) {
      console.error('Error exporting all panels PDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to export PDF: ${errorMessage}\n\nCheck browser console for details.`);
    }
  };

  // Helper to check if a circuit is the start of a multi-pole breaker
  const isMultiPoleStart = (circuit: any, slotNumber: number) => {
    if (!circuit || circuit.pole === 1) return false;
    return circuit.circuit_number === slotNumber;
  };

  // Helper to check if a slot is occupied by a multi-pole circuit above it
  const getMultiPoleCircuitAbove = (slotNumber: number) => {
    // Check if any circuit with pole > 1 occupies this slot
    // ✅ FIXED: Check ALL circuit numbers (both odd and even), not just odd
    for (let i = 1; i < slotNumber; i++) {
      const ckt = getCircuit(i);
      if (ckt && ckt.pole > 1) {
        const spanSlots = ckt.pole; // 2-pole spans 2 slots, 3-pole spans 3 slots
        const occupiedSlots = [];
        for (let j = 0; j < spanSlots; j++) {
          // ✅ FIXED: Use ckt.circuit_number instead of i (the actual starting slot)
          occupiedSlots.push(ckt.circuit_number + (j * 2));
        }
        if (occupiedSlots.includes(slotNumber)) {
          return ckt;
        }
      }
    }
    return null;
  };

  const renderRow = (rowNum: number) => {
    const leftNum = (rowNum * 2) - 1;
    const rightNum = rowNum * 2;

    const leftCkt = getCircuit(leftNum);
    const rightCkt = getCircuit(rightNum);

    // Check if left slot is occupied by multi-pole circuit above
    const leftMultiPoleAbove = getMultiPoleCircuitAbove(leftNum);
    const rightMultiPoleAbove = getMultiPoleCircuitAbove(rightNum);

    const renderCircuitCell = (ckt: any, position: 'left' | 'right', slotNumber: number, multiPoleAbove: any) => {
      // CONFLICT: Circuit exists at slot occupied by multi-pole circuit above
      if (multiPoleAbove && ckt) {
        return position === 'left' ? (
          <>
            <td className="p-2 border-r border-gray-100 bg-red-50" colSpan={3}>
              <div className="text-center text-xs text-red-600 font-semibold">
                ⚠️ CONFLICT: Slot occupied by {multiPoleAbove.pole}P circuit above
                <div className="text-xs text-red-500 mt-1">
                  Circuit {ckt.circuit_number} ({ckt.description}) cannot occupy this slot
                </div>
              </div>
            </td>
          </>
        ) : (
          <>
            <td className="p-2 border-l border-gray-100 bg-red-50" colSpan={3}>
              <div className="text-center text-xs text-red-600 font-semibold">
                ⚠️ CONFLICT: Slot occupied by {multiPoleAbove.pole}P circuit above
                <div className="text-xs text-red-500 mt-1">
                  Circuit {ckt.circuit_number} ({ckt.description}) cannot occupy this slot
                </div>
              </div>
            </td>
          </>
        );
      }

      // If slot occupied by multi-pole circuit above, show indicator
      if (multiPoleAbove && !ckt) {
        return position === 'left' ? (
          <>
            <td className="p-2 border-r border-gray-100 bg-gray-100" colSpan={3}>
              <div className="text-center text-xs text-gray-500 italic">
                ↑ {multiPoleAbove.pole}P - {multiPoleAbove.description}
              </div>
            </td>
          </>
        ) : (
          <>
            <td className="p-2 border-l border-gray-100 bg-gray-100" colSpan={3}>
              <div className="text-center text-xs text-gray-500 italic">
                ↑ {multiPoleAbove.pole}P - {multiPoleAbove.description}
              </div>
            </td>
          </>
        );
      }

      // Empty slot
      if (!ckt) return position === 'left' ? (
        <>
          <td className="p-2 border-r border-gray-100">-</td>
          <td className="p-2 border-r border-gray-100 text-center font-mono"></td>
          <td className="p-2 border-r border-gray-100 text-center w-12"></td>
        </>
      ) : (
        <>
          <td className="p-2 border-l border-gray-100 text-center w-12"></td>
          <td className="p-2 border-l border-gray-100 text-center font-mono"></td>
          <td className="p-2 border-l border-gray-100 text-right">-</td>
        </>
      );

      const isEditing = editingCircuit === ckt.id;

      if (position === 'left') {
        return (
          <>
            <td className="p-2 border-r border-gray-100">
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.description || ''}
                  onChange={e => setEditForm({...editForm, description: e.target.value})}
                  className="w-full text-xs border border-electric-300 rounded px-1 py-0.5"
                />
              ) : (
                <div className="flex items-center justify-between group">
                  <div className="flex items-center gap-1">
                    {ckt.pole > 1 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-electric-100 text-electric-800 border border-electric-300">
                        {ckt.pole}P
                      </span>
                    )}
                    <span>{ckt.description}</span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => startEdit(ckt)}
                      className="hover:text-electric-500"
                      title="Edit circuit"
                    >
                      <Edit2 className="w-3 h-3 text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleDeleteCircuit(ckt)}
                      className="hover:text-red-500"
                      title="Delete circuit"
                    >
                      <Trash2 className="w-3 h-3 text-gray-400" />
                    </button>
                  </div>
                </div>
              )}
            </td>
            <td className="p-2 border-r border-gray-100 text-center font-mono">
              {isEditing ? (
                <input
                  type="number"
                  value={editForm.breakerAmps || ''}
                  onChange={e => setEditForm({...editForm, breakerAmps: Number(e.target.value)})}
                  className="w-12 text-xs border border-electric-300 rounded px-1 py-0.5 text-center"
                />
              ) : ckt.breaker_amps}
            </td>
            <td className="p-2 border-r border-gray-100 text-center w-12">
              {isEditing ? (
                <input
                  type="number"
                  value={editForm.loadWatts || ''}
                  onChange={e => setEditForm({...editForm, loadWatts: Number(e.target.value)})}
                  className="w-full text-xs border border-electric-300 rounded px-1 py-0.5 text-center"
                  placeholder="VA"
                />
              ) : (ckt.load_watts || '')}
            </td>
          </>
        );
      } else {
        return (
          <>
            <td className="p-2 border-l border-gray-100 text-center w-12">
              {isEditing ? (
                <input
                  type="number"
                  value={editForm.loadWatts || ''}
                  onChange={e => setEditForm({...editForm, loadWatts: Number(e.target.value)})}
                  className="w-full text-xs border border-electric-300 rounded px-1 py-0.5 text-center"
                  placeholder="VA"
                />
              ) : (ckt.load_watts || '')}
            </td>
            <td className="p-2 border-l border-gray-100 text-center font-mono">
              {isEditing ? (
                <input
                  type="number"
                  value={editForm.breakerAmps || ''}
                  onChange={e => setEditForm({...editForm, breakerAmps: Number(e.target.value)})}
                  className="w-12 text-xs border border-electric-300 rounded px-1 py-0.5 text-center"
                />
              ) : ckt.breaker_amps}
            </td>
            <td className="p-2 border-l border-gray-100 text-right">
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.description || ''}
                  onChange={e => setEditForm({...editForm, description: e.target.value})}
                  className="w-full text-xs border border-electric-300 rounded px-1 py-0.5"
                />
              ) : (
                <div className="flex items-center justify-between group">
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => startEdit(ckt)}
                      className="hover:text-electric-500"
                      title="Edit circuit"
                    >
                      <Edit2 className="w-3 h-3 text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleDeleteCircuit(ckt)}
                      className="hover:text-red-500"
                      title="Delete circuit"
                    >
                      <Trash2 className="w-3 h-3 text-gray-400" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>{ckt.description}</span>
                    {ckt.pole > 1 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-electric-100 text-electric-800 border border-electric-300">
                        {ckt.pole}P
                      </span>
                    )}
                  </div>
                </div>
              )}
            </td>
          </>
        );
      }
    };

    return (
      <tr key={rowNum} className="border-b border-gray-100 hover:bg-gray-50 text-xs">
        <td className="p-2 border-r border-gray-100 text-center w-8 bg-gray-50 font-mono text-gray-500">{leftNum}</td>
        {renderCircuitCell(leftCkt, 'left', leftNum, leftMultiPoleAbove)}
        <td className="p-2 text-center w-10 font-bold bg-electric-50 text-gray-400">
           {selectedPanel?.phase === 3 ? ['A', 'B', 'C'][(rowNum - 1) % 3] : ['A', 'B'][(rowNum - 1) % 2]}
        </td>
        {renderCircuitCell(rightCkt, 'right', rightNum, rightMultiPoleAbove)}
        <td className="p-2 border-l border-gray-100 text-center w-8 bg-gray-50 font-mono text-gray-500">{rightNum}</td>
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

  const totalLoad = panelCircuits.reduce((sum, c) => sum + (c.load_watts || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
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

      {/* Header */}
      <div className="flex justify-between items-center">
         <div>
           <h2 className="text-lg font-medium text-gray-900">{selectedPanel.name}</h2>
           <p className="text-sm text-gray-500">
             {selectedPanel.voltage}V {selectedPanel.phase}Φ • {selectedPanel.bus_rating}A Bus • {selectedPanel.main_breaker_amps}A Main
           </p>
         </div>
         <div className="flex gap-2">
           {editingCircuit && (
             <div className="flex gap-1">
               <button
                 onClick={saveEdit}
                 className="flex items-center gap-1 px-3 py-2 bg-electric-400 text-black rounded-md text-sm font-medium hover:bg-electric-500"
               >
                 <Save className="w-4 h-4" /> Save
               </button>
               <button
                 onClick={cancelEdit}
                 className="flex items-center gap-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-300"
               >
                 <X className="w-4 h-4" /> Cancel
               </button>
             </div>
           )}
           <button
             onClick={handleExportPDF}
             className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium hover:bg-gray-50 text-gray-700"
           >
              <Download className="w-4 h-4" /> Export This Panel
           </button>
           {panels.length > 1 && (
             <button
               onClick={handleExportAllPanels}
               className="flex items-center gap-2 px-4 py-2 bg-electric-400 text-black rounded-md text-sm font-medium hover:bg-electric-500"
             >
                <Download className="w-4 h-4" /> Export All Panels
             </button>
           )}
         </div>
      </div>

      {/* Panel Schedule Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full">
          <thead className="bg-gray-900 text-white text-xs uppercase tracking-wider">
            <tr>
              <th className="p-3 w-8">#</th>
              <th className="p-3 text-left">Description</th>
              <th className="p-3 w-16">Brkr</th>
              <th className="p-3 w-16">VA</th>
              <th className="p-3 w-10 bg-gray-800">Φ</th>
              <th className="p-3 w-16">VA</th>
              <th className="p-3 w-16">Brkr</th>
              <th className="p-3 text-right">Description</th>
              <th className="p-3 w-8">#</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: totalSlots / 2 }).map((_, i) => renderRow(i + 1))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 text-center">
         <div className="p-4 bg-gray-50 rounded border border-gray-100">
           <span className="text-xs text-gray-500 uppercase block">Total Circuits</span>
           <span className="text-2xl font-bold text-gray-900">{panelCircuits.length}</span>
         </div>
         <div className="p-4 bg-gray-50 rounded border border-gray-100">
           <span className="text-xs text-gray-500 uppercase block">Total Load</span>
           <span className="text-2xl font-bold text-gray-900">{(totalLoad / 1000).toFixed(2)} kVA</span>
         </div>
      </div>
    </div>
  );
};
