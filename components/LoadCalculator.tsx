import React, { useState } from 'react';
import { Plus, Trash2, Cpu, Zap, Activity } from 'lucide-react';
import { Project, LoadItem } from '../types';
import { validateLoadCalculation } from '../services/geminiService';

interface LoadCalculatorProps {
  project: Project;
  updateProject: (p: Project) => void;
}

export const LoadCalculator: React.FC<LoadCalculatorProps> = ({ project, updateProject }) => {
  const [newLoad, setNewLoad] = useState<Partial<LoadItem>>({
    description: '',
    watts: 0,
    type: 'lighting',
    continuous: false,
    phase: 'A'
  });
  const [validationResult, setValidationResult] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const handleAddLoad = () => {
    if (!newLoad.description || !newLoad.watts) return;
    
    const item: LoadItem = {
      id: Math.random().toString(36).substr(2, 9),
      description: newLoad.description,
      watts: Number(newLoad.watts),
      type: newLoad.type as any,
      continuous: newLoad.continuous || false,
      phase: newLoad.phase as any
    };

    updateProject({
      ...project,
      loads: [...project.loads, item]
    });

    setNewLoad({ description: '', watts: 0, type: 'lighting', continuous: false, phase: 'A' });
  };

  const removeLoad = (id: string) => {
    updateProject({
      ...project,
      loads: project.loads.filter(l => l.id !== id)
    });
  };

  const runAiValidation = async () => {
    setIsValidating(true);
    setValidationResult(null);
    const result = await validateLoadCalculation(project.loads, project.serviceVoltage, project.servicePhase);
    setValidationResult(result || "No response received.");
    setIsValidating(false);
  };

  const totalWatts = project.loads.reduce((acc, curr) => acc + curr.watts, 0);
  const totalAmps = Math.round((totalWatts / project.serviceVoltage) * 100) / 100; // Simplified single phase logic for demo

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Input Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-electric-500" />
              Add Electrical Load
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Description</label>
                <input 
                  type="text" 
                  value={newLoad.description}
                  onChange={e => setNewLoad({...newLoad, description: e.target.value})}
                  className="w-full border-gray-200 rounded-md focus:border-electric-500 focus:ring-electric-500 text-sm py-2"
                  placeholder="e.g. Living Room Lights"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Watts (VA)</label>
                <input 
                  type="number" 
                  value={newLoad.watts || ''}
                  onChange={e => setNewLoad({...newLoad, watts: parseInt(e.target.value)})}
                  className="w-full border-gray-200 rounded-md focus:border-electric-500 focus:ring-electric-500 text-sm py-2"
                  placeholder="e.g. 1500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Load Type</label>
                <select 
                  value={newLoad.type}
                  onChange={e => setNewLoad({...newLoad, type: e.target.value as any})}
                  className="w-full border-gray-200 rounded-md focus:border-electric-500 focus:ring-electric-500 text-sm py-2"
                >
                  <option value="lighting">Lighting</option>
                  <option value="receptacle">Receptacle</option>
                  <option value="motor">Motor</option>
                  <option value="hvac">HVAC</option>
                  <option value="appliance">Appliance</option>
                </select>
              </div>
              <div className="flex items-end">
                 <label className="flex items-center gap-2 cursor-pointer pb-2">
                   <input 
                    type="checkbox"
                    checked={newLoad.continuous}
                    onChange={e => setNewLoad({...newLoad, continuous: e.target.checked})}
                    className="rounded border-gray-300 text-electric-500 focus:ring-electric-500" 
                   />
                   <span className="text-sm text-gray-600">Continuous Load (125%)</span>
                 </label>
              </div>
            </div>

            <button 
              onClick={handleAddLoad}
              className="w-full bg-gray-900 text-white hover:bg-black transition-colors py-2.5 rounded-md text-sm font-medium"
            >
              Add Load Entry
            </button>
          </div>

          <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 flex justify-between items-center">
              <h3 className="font-medium text-gray-900">Load Schedule</h3>
              <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-500">{project.loads.length} items</span>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 font-medium">
                <tr>
                  <th className="px-6 py-3 font-normal">Description</th>
                  <th className="px-6 py-3 font-normal">Type</th>
                  <th className="px-6 py-3 font-normal text-right">Load (VA)</th>
                  <th className="px-6 py-3 font-normal text-right">Phase</th>
                  <th className="px-6 py-3 font-normal w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {project.loads.map(load => (
                  <tr key={load.id} className="hover:bg-gray-50/50 group">
                    <td className="px-6 py-3 text-gray-900">{load.description} {load.continuous && <span className="text-electric-500 text-xs ml-2">●</span>}</td>
                    <td className="px-6 py-3 text-gray-500 capitalize">{load.type}</td>
                    <td className="px-6 py-3 text-right font-mono text-gray-700">{load.watts.toLocaleString()}</td>
                    <td className="px-6 py-3 text-right text-gray-500">{load.phase}</td>
                    <td className="px-6 py-3 text-right">
                      <button onClick={() => removeLoad(load.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {project.loads.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-light">
                      No loads added yet. Start by adding loads above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Calculations & AI */}
        <div className="space-y-6">
          <div className="bg-electric-50 border border-electric-100 rounded-lg p-6">
            <h3 className="text-sm font-bold text-electric-700 uppercase tracking-wider mb-4">Service Calculation</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 text-sm">Total Connected Load</span>
                <span className="font-mono text-xl font-bold text-gray-900">{(totalWatts / 1000).toFixed(2)} kVA</span>
              </div>
               <div className="flex justify-between items-center">
                <span className="text-gray-600 text-sm">Est. Current (@{project.serviceVoltage}V)</span>
                <span className="font-mono text-xl font-bold text-gray-900">{totalAmps} A</span>
              </div>
              <div className="pt-4 border-t border-electric-200/50">
                <span className="text-xs text-electric-700 block mb-1">Recommended Service Size</span>
                <span className="text-2xl font-bold text-gray-900">{totalAmps > 200 ? '400A' : totalAmps > 100 ? '200A' : '100A'}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-electric-500" />
                AI Validation (NEC 220)
              </h3>
            </div>
            
            {!validationResult ? (
               <div className="text-center py-8">
                 <p className="text-gray-400 text-sm mb-4">Run AI to check demand factors and compliance.</p>
                 <button 
                  onClick={runAiValidation}
                  disabled={isValidating || project.loads.length === 0}
                  className="bg-electric-400 hover:bg-electric-500 text-black px-4 py-2 rounded text-sm font-medium w-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   {isValidating ? 'Analyzing...' : 'Validate Compliance'}
                 </button>
               </div>
            ) : (
              <div className="prose prose-sm max-w-none text-gray-600 bg-gray-50 p-4 rounded-md border border-gray-100 text-xs">
                <div className="whitespace-pre-wrap font-mono">{validationResult}</div>
                <button 
                  onClick={() => setValidationResult(null)}
                  className="mt-4 text-xs text-electric-600 hover:text-electric-700 underline"
                >
                  Clear Analysis
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
