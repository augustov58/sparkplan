import React, { useState } from 'react';
import { Project, PanelCircuit } from '../types';
import { LayoutGrid, Download, Edit2, Save, X } from 'lucide-react';
import { usePanels } from '../hooks/usePanels';
import { useCircuits } from '../hooks/useCircuits';

interface PanelScheduleProps {
  project: Project;
}

export const PanelSchedule: React.FC<PanelScheduleProps> = ({ project }) => {
  const { panels, updatePanel } = usePanels(project.id);
  const { circuits, updateCircuit } = useCircuits(project.id);

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
      conductorSize: circuit.conductor_size
    });
  };

  const saveEdit = async () => {
    if (!editingCircuit) return;
    await updateCircuit(editingCircuit, {
      description: editForm.description,
      breaker_amps: editForm.breakerAmps,
      conductor_size: editForm.conductorSize
    });
    setEditingCircuit(null);
    setEditForm({});
  };

  const cancelEdit = () => {
    setEditingCircuit(null);
    setEditForm({});
  };

  const renderRow = (rowNum: number) => {
    const leftNum = (rowNum * 2) - 1;
    const rightNum = rowNum * 2;

    const leftCkt = getCircuit(leftNum);
    const rightCkt = getCircuit(rightNum);

    const renderCircuitCell = (ckt: any, position: 'left' | 'right') => {
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
                  <span>{ckt.description}</span>
                  <button onClick={() => startEdit(ckt)} className="opacity-0 group-hover:opacity-100">
                    <Edit2 className="w-3 h-3 text-gray-400 hover:text-electric-500" />
                  </button>
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
            <td className="p-2 border-r border-gray-100 text-center w-12">{ckt.load_watts || ''}</td>
          </>
        );
      } else {
        return (
          <>
            <td className="p-2 border-l border-gray-100 text-center w-12">{ckt.load_watts || ''}</td>
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
                  <button onClick={() => startEdit(ckt)} className="opacity-0 group-hover:opacity-100">
                    <Edit2 className="w-3 h-3 text-gray-400 hover:text-electric-500" />
                  </button>
                  <span>{ckt.description}</span>
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
        {renderCircuitCell(leftCkt, 'left')}
        <td className="p-2 text-center w-10 font-bold bg-electric-50 text-gray-400">
           {selectedPanel?.phase === 3 ? ['A', 'B', 'C'][(rowNum - 1) % 3] : ['A', 'B'][(rowNum - 1) % 2]}
        </td>
        {renderCircuitCell(rightCkt, 'right')}
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
           <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium hover:bg-gray-50 text-gray-700">
              <Download className="w-4 h-4" /> Export PDF
           </button>
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
