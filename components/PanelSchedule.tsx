import React from 'react';
import { Project, PanelCircuit } from '../types';
import { LayoutGrid, Download } from 'lucide-react';

interface PanelScheduleProps {
  project: Project;
}

export const PanelSchedule: React.FC<PanelScheduleProps> = ({ project }) => {
  // Generate 42 slots for a standard panel
  const totalSlots = 42;
  
  // Helper to find circuit at specific index (1-based odd/even logic)
  const getCircuit = (num: number) => project.circuits.find(c => c.circuitNumber === num);

  const renderRow = (rowNum: number) => {
    // Row 1: Ckt 1 and Ckt 2
    // Row 2: Ckt 3 and Ckt 4
    const leftNum = (rowNum * 2) - 1;
    const rightNum = rowNum * 2;
    
    const leftCkt = getCircuit(leftNum);
    const rightCkt = getCircuit(rightNum);

    return (
      <tr key={rowNum} className="border-b border-gray-100 hover:bg-gray-50 text-xs">
        {/* Left Circuit */}
        <td className="p-2 border-r border-gray-100 text-center w-8 bg-gray-50 font-mono text-gray-500">{leftNum}</td>
        <td className="p-2 border-r border-gray-100">{leftCkt?.description || '-'}</td>
        <td className="p-2 border-r border-gray-100 text-center font-mono">{leftCkt?.breakerAmps || ''}</td>
        <td className="p-2 border-r border-gray-100 text-center w-12">{leftCkt ? (leftCkt.pole * 120 * leftCkt.breakerAmps * 0.8) : ''}</td>
        
        {/* Center Phase Labels */}
        <td className="p-2 text-center w-10 font-bold bg-electric-50 text-gray-400">
           {['A', 'B', 'C'][(rowNum - 1) % 3]}
        </td>

        {/* Right Circuit */}
        <td className="p-2 border-l border-gray-100 text-center w-12">{rightCkt ? (rightCkt.pole * 120 * rightCkt.breakerAmps * 0.8) : ''}</td>
        <td className="p-2 border-l border-gray-100 text-center font-mono">{rightCkt?.breakerAmps || ''}</td>
        <td className="p-2 border-l border-gray-100 text-right">{rightCkt?.description || '-'}</td>
        <td className="p-2 border-l border-gray-100 text-center w-8 bg-gray-50 font-mono text-gray-500">{rightNum}</td>
      </tr>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
         <div>
           <h2 className="text-lg font-medium text-gray-900">Panel Schedule: MDP-1</h2>
           <p className="text-sm text-gray-500">{project.serviceVoltage}V {project.servicePhase}Φ • 225A Bus</p>
         </div>
         <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium hover:bg-gray-50 text-gray-700">
            <Download className="w-4 h-4" /> Export CSV/PDF
         </button>
      </div>

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

      <div className="grid grid-cols-3 gap-4 text-center">
         <div className="p-4 bg-gray-50 rounded border border-gray-100">
           <span className="text-xs text-gray-500 uppercase block">Phase A Load</span>
           <span className="text-xl font-bold text-gray-900">12.5 kVA</span>
         </div>
         <div className="p-4 bg-gray-50 rounded border border-gray-100">
           <span className="text-xs text-gray-500 uppercase block">Phase B Load</span>
           <span className="text-xl font-bold text-gray-900">11.8 kVA</span>
         </div>
         {project.servicePhase === 3 && (
            <div className="p-4 bg-gray-50 rounded border border-gray-100">
                <span className="text-xs text-gray-500 uppercase block">Phase C Load</span>
                <span className="text-xl font-bold text-gray-900">10.2 kVA</span>
            </div>
         )}
      </div>
    </div>
  );
};
