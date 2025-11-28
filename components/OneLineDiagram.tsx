import React, { useState } from 'react';
import { Project, PanelCircuit } from '../types';
import { generateOneLineDescription } from '../services/geminiService';
import { RefreshCcw, Download, Zap, Plus, Trash2 } from 'lucide-react';

interface OneLineDiagramProps {
  project: Project;
  updateProject?: (p: Project) => void;
}

export const OneLineDiagram: React.FC<OneLineDiagramProps> = ({ project, updateProject }) => {
  const [description, setDescription] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Circuit Editor State
  const [newCircuit, setNewCircuit] = useState<Partial<PanelCircuit>>({
    circuitNumber: project.circuits.length + 1,
    description: '',
    breakerAmps: 20,
    pole: 1,
    conductorSize: '12 AWG'
  });

  const handleGenerate = async () => {
    setLoading(true);
    const desc = await generateOneLineDescription(project);
    setDescription(desc || "Failed to generate.");
    setLoading(false);
  };

  const addCircuit = () => {
    if (!updateProject || !newCircuit.description) return;
    const circuit: PanelCircuit = {
      id: Math.random().toString(36).substr(2, 9),
      circuitNumber: newCircuit.circuitNumber || project.circuits.length + 1,
      description: newCircuit.description,
      breakerAmps: newCircuit.breakerAmps || 20,
      pole: newCircuit.pole || 1,
      loadWatts: 0, // In a real app, you'd map loads to this circuit
      conductorSize: newCircuit.conductorSize || '12 AWG'
    };
    updateProject({ ...project, circuits: [...project.circuits, circuit] });
    setNewCircuit({ ...newCircuit, circuitNumber: (newCircuit.circuitNumber || 0) + 1, description: '' });
  };

  const removeCircuit = (id: string) => {
    if (!updateProject) return;
    updateProject({ ...project, circuits: project.circuits.filter(c => c.id !== id) });
  };

  const serviceX = 400;
  const serviceY = 50;

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
        
        {/* Left Col: Circuit Editor */}
        <div className="space-y-6">
           <div className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm">
             <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
               <Plus className="w-4 h-4 text-electric-500" /> New Circuit
             </h3>
             <div className="space-y-3">
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
               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="text-xs font-semibold text-gray-500 uppercase">Breaker (A)</label>
                   <select 
                      value={newCircuit.breakerAmps}
                      onChange={e => setNewCircuit({...newCircuit, breakerAmps: Number(e.target.value)})}
                      className="w-full border-gray-200 rounded text-sm py-2"
                   >
                     <option value="15">15 A</option>
                     <option value="20">20 A</option>
                     <option value="30">30 A</option>
                     <option value="40">40 A</option>
                     <option value="50">50 A</option>
                     <option value="60">60 A</option>
                   </select>
                 </div>
                 <div>
                   <label className="text-xs font-semibold text-gray-500 uppercase">Poles</label>
                   <select 
                      value={newCircuit.pole}
                      onChange={e => setNewCircuit({...newCircuit, pole: Number(e.target.value) as 1|2|3})}
                      className="w-full border-gray-200 rounded text-sm py-2"
                   >
                     <option value="1">1 Pole</option>
                     <option value="2">2 Pole</option>
                     <option value="3">3 Pole</option>
                   </select>
                 </div>
               </div>
               <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Wire Size (AWG)</label>
                  <input 
                    type="text" 
                    value={newCircuit.conductorSize}
                    onChange={e => setNewCircuit({...newCircuit, conductorSize: e.target.value})}
                    className="w-full border-gray-200 rounded text-sm py-2"
                 />
               </div>
               <button 
                  onClick={addCircuit}
                  className="w-full bg-gray-900 text-white text-sm font-medium py-2 rounded hover:bg-black transition-colors"
               >
                 Add Circuit
               </button>
             </div>
           </div>

           <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
             <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase">
               Active Branch Circuits
             </div>
             <div className="divide-y divide-gray-50 max-h-[300px] overflow-y-auto">
               {project.circuits.map(c => (
                 <div key={c.id} className="p-3 flex justify-between items-center hover:bg-gray-50 group">
                   <div>
                     <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-electric-100 text-electric-700 flex items-center justify-center text-[10px] font-bold">
                          {c.circuitNumber}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{c.description}</span>
                     </div>
                     <div className="text-xs text-gray-500 ml-7">
                       {c.breakerAmps}A / {c.pole}P • {c.conductorSize}
                     </div>
                   </div>
                   <button onClick={() => removeCircuit(c.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100">
                     <Trash2 className="w-4 h-4" />
                   </button>
                 </div>
               ))}
               {project.circuits.length === 0 && (
                 <div className="p-4 text-center text-xs text-gray-400">No circuits added.</div>
               )}
             </div>
           </div>
        </div>

        {/* Right Col: Diagram */}
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-lg h-[600px] overflow-hidden relative shadow-inner flex flex-col">
            <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur px-3 py-1 text-xs font-mono border border-gray-200 rounded">
               {project.serviceVoltage}V {project.servicePhase}Φ Service
            </div>
            
            <svg className="w-full h-full bg-white flex-1" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid meet">
                <defs>
                    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                        <path d="M0,0 L0,6 L9,3 z" fill="#9CA3AF" />
                    </marker>
                </defs>
                
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#F3F4F6" strokeWidth="1"/>
                </pattern>
                <rect width="100%" height="100%" fill="url(#grid)" />

                {/* Main Service Drop */}
                <path d={`M ${serviceX} 20 L ${serviceX} 150`} stroke="#111827" strokeWidth="2" />
                <circle cx={serviceX} cy={50} r="20" stroke="#111827" strokeWidth="2" fill="white" />
                <text x={serviceX} y={55} textAnchor="middle" className="text-xs font-bold font-mono">UTIL</text>

                {/* Meter */}
                <rect x={serviceX - 20} y={90} width="40" height="40" stroke="#111827" strokeWidth="2" fill="white" />
                <text x={serviceX} y={115} textAnchor="middle" className="text-xs font-bold">M</text>

                {/* Main Panel Box */}
                <rect x={150} y={150} width="500" height="300" rx="4" stroke="#D1D5DB" strokeWidth="1" fill="none" strokeDasharray="4" />
                <text x={160} y={170} className="text-[10px] text-gray-400 font-mono">MAIN DISTRIBUTION PANEL</text>

                {/* Main Disconnect */}
                <rect x={serviceX - 30} y={180} width="60" height="40" stroke="#111827" strokeWidth="2" fill="#FFFAE5" />
                <text x={serviceX} y={205} textAnchor="middle" className="text-[10px] font-bold">MAIN</text>

                {/* Bus Bars */}
                <line x1={serviceX} y1={220} x2={serviceX} y2={280} stroke="#111827" strokeWidth="3" />
                <line x1={200} y1={280} x2={600} y2={280} stroke="#111827" strokeWidth="4" />
                
                {/* Dynamic Circuits */}
                {project.circuits.map((circuit, index) => {
                    // Simple layout logic for visualization
                    const spacing = 40;
                    const startX = 220;
                    const xPos = startX + (index * spacing);
                    const isEven = index % 2 === 0;
                    const yEnd = isEven ? 350 : 380; // Stagger lengths
                    
                    if (xPos > 580) return null; // Prevent overflow in this simple view

                    return (
                        <g key={circuit.id} className="hover:opacity-80 cursor-pointer">
                            <line x1={xPos} y1={282} x2={xPos} y2={yEnd} stroke="#4B5563" strokeWidth="1" />
                            <circle cx={xPos} cy={290} r="3" fill="#FFCC00" />
                            <rect x={xPos - 5} y={yEnd} width="10" height="10" fill={isEven ? '#E5E7EB' : '#F3F4F6'} stroke="#9CA3AF" />
                            <text x={xPos} y={yEnd + 20} textAnchor="middle" className="text-[8px] font-mono fill-gray-500">C{circuit.circuitNumber}</text>
                            <text x={xPos} y={yEnd + 30} textAnchor="middle" className="text-[7px] font-mono fill-gray-400">{circuit.breakerAmps}A</text>
                        </g>
                    );
                })}
            </svg>

            {description && (
                <div className="p-4 bg-gray-50 border-t border-gray-100 text-xs text-gray-600 max-h-32 overflow-y-auto">
                    <h4 className="font-bold text-gray-900 mb-1">AI Analysis</h4>
                    {description}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
