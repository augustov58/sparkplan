import React, { useState } from 'react';
import { Project, GroundingDetail } from '../types';
import { validateGrounding } from '../services/geminiService';
import { ShieldCheck, CheckSquare, Zap } from 'lucide-react';

interface GroundingProps {
  project: Project;
  updateProject: (p: Project) => void;
}

const ELECTRODE_TYPES = [
  "Metal Underground Water Pipe",
  "Metal Frame of Building",
  "Concrete-Encased Electrode (Ufer)",
  "Ground Ring",
  "Rod and Pipe Electrodes",
  "Plate Electrodes"
];

const BONDING_TARGETS = [
  "Interior Water Piping",
  "Gas Piping",
  "Structural Metal",
  "Communication Systems (Intersystem Bonding)"
];

export const GroundingBonding: React.FC<GroundingProps> = ({ project, updateProject }) => {
  // Initialize if missing
  const grounding = project.grounding || { electrodes: [], gecSize: '6 AWG', bonding: [], notes: '' };

  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleElectrode = (e: string) => {
    const current = grounding.electrodes.includes(e);
    const newElectrodes = current 
      ? grounding.electrodes.filter(x => x !== e)
      : [...grounding.electrodes, e];
    update( { ...grounding, electrodes: newElectrodes });
  };

  const toggleBonding = (b: string) => {
    const current = grounding.bonding.includes(b);
    const newBonding = current 
      ? grounding.bonding.filter(x => x !== b)
      : [...grounding.bonding, b];
    update({ ...grounding, bonding: newBonding });
  };

  const update = (g: GroundingDetail) => {
    updateProject({ ...project, grounding: g });
  };

  const handleValidate = async () => {
    setLoading(true);
    // Estimate service amps from circuits if not explicit (simple logic)
    const serviceAmps = 200; 
    const result = await validateGrounding(grounding, serviceAmps);
    setAiAnalysis(result || "Validation failed.");
    setLoading(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
           <h2 className="text-2xl font-light text-gray-900">Grounding & Bonding (NEC 250)</h2>
           <p className="text-gray-500 mt-1">Configure grounding electrode system and bonding jumpers.</p>
        </div>
        <button 
           onClick={handleValidate}
           className="bg-electric-400 hover:bg-electric-500 text-black px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
        >
           <ShieldCheck className={`w-4 h-4 ${loading ? 'animate-pulse' : ''}`} />
           Verify NEC 250 Compliance
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Electrodes Column */}
        <div className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-electric-600" />
            Grounding Electrode System (250.50)
          </h3>
          <p className="text-xs text-gray-400 mb-4">Select all electrodes present at the building.</p>
          
          <div className="space-y-3">
            {ELECTRODE_TYPES.map(type => (
              <label key={type} className="flex items-center gap-3 p-3 border border-gray-100 rounded-md hover:bg-gray-50 cursor-pointer transition-colors">
                <input 
                  type="checkbox" 
                  checked={grounding.electrodes.includes(type)}
                  onChange={() => toggleElectrode(type)}
                  className="rounded border-gray-300 text-electric-600 focus:ring-electric-500"
                />
                <span className="text-sm text-gray-700">{type}</span>
              </label>
            ))}
          </div>

          <div className="mt-6">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">GEC Size (Copper)</label>
            <select 
              value={grounding.gecSize}
              onChange={(e) => update({ ...grounding, gecSize: e.target.value })}
              className="w-full border-gray-200 rounded-md text-sm focus:border-electric-500 focus:ring-electric-500"
            >
              <option value="8 AWG">8 AWG</option>
              <option value="6 AWG">6 AWG</option>
              <option value="4 AWG">4 AWG</option>
              <option value="1/0 AWG">1/0 AWG</option>
              <option value="2/0 AWG">2/0 AWG</option>
              <option value="3/0 AWG">3/0 AWG</option>
            </select>
            <p className="text-[10px] text-gray-400 mt-1">Reference Table 250.66 based on Service Conductors</p>
          </div>
        </div>

        {/* Bonding Column */}
        <div className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-electric-600" />
            Bonding Requirements (250.104)
          </h3>
          <p className="text-xs text-gray-400 mb-4">Confirm bonding of metal systems.</p>

          <div className="space-y-3">
            {BONDING_TARGETS.map(target => (
              <label key={target} className="flex items-center gap-3 p-3 border border-gray-100 rounded-md hover:bg-gray-50 cursor-pointer transition-colors">
                <input 
                  type="checkbox" 
                  checked={grounding.bonding.includes(target)}
                  onChange={() => toggleBonding(target)}
                  className="rounded border-gray-300 text-electric-600 focus:ring-electric-500"
                />
                <span className="text-sm text-gray-700">{target}</span>
              </label>
            ))}
          </div>

           <div className="mt-6">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Grounding Notes</label>
            <textarea 
              rows={3}
              value={grounding.notes}
              onChange={(e) => update({...grounding, notes: e.target.value})}
              className="w-full border-gray-200 rounded-md text-sm p-3 focus:border-electric-500 focus:ring-electric-500"
              placeholder="E.g., Two ground rods spaced 6ft apart..."
            />
          </div>
        </div>
      </div>

      {aiAnalysis && (
        <div className="bg-electric-50 border border-electric-100 rounded-lg p-6 animate-in slide-in-from-bottom-2">
          <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> AI Compliance Analysis
          </h4>
          <div className="prose prose-sm prose-gray max-w-none text-gray-700 whitespace-pre-wrap">
            {aiAnalysis}
          </div>
        </div>
      )}
    </div>
  );
};
