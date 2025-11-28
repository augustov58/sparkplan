
import React from 'react';
import { Project, ProjectType, ProjectStatus } from '../types';
import { Save, AlertTriangle, Building, Zap } from 'lucide-react';

interface ProjectSetupProps {
  project: Project;
  updateProject: (p: Project) => void;
}

export const ProjectSetup: React.FC<ProjectSetupProps> = ({ project, updateProject }) => {
  
  const handleSettingChange = (field: keyof typeof project.settings, value: any) => {
    updateProject({
      ...project,
      settings: {
        ...project.settings,
        [field]: value
      },
      // specific sync for top level props to maintain compatibility
      serviceVoltage: field === 'serviceVoltage' ? value : project.serviceVoltage,
      servicePhase: field === 'servicePhase' ? value : project.servicePhase
    });
  };

  const handleMetaChange = (field: keyof Project, value: any) => {
    updateProject({ ...project, [field]: value });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-light text-gray-900">Project Configuration</h2>
          <p className="text-gray-500 mt-1">Define site parameters and electrical characteristics.</p>
        </div>
        <button className="bg-electric-400 hover:bg-electric-500 text-black px-6 py-2 rounded-md font-medium flex items-center gap-2 transition-colors">
          <Save className="w-4 h-4" /> Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* General Info */}
        <div className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center gap-2">
            <Building className="w-5 h-5 text-gray-400" /> General Information
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Project Name</label>
              <input 
                type="text" 
                value={project.name} 
                onChange={e => handleMetaChange('name', e.target.value)}
                className="w-full border-gray-200 rounded-md text-sm focus:border-electric-500 focus:ring-electric-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Address</label>
              <input 
                type="text" 
                value={project.address} 
                onChange={e => handleMetaChange('address', e.target.value)}
                className="w-full border-gray-200 rounded-md text-sm focus:border-electric-500 focus:ring-electric-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Building Type</label>
                <select 
                  value={project.type}
                  onChange={e => handleMetaChange('type', e.target.value)}
                  className="w-full border-gray-200 rounded-md text-sm"
                >
                  <option value={ProjectType.RESIDENTIAL}>Residential</option>
                  <option value={ProjectType.COMMERCIAL}>Commercial</option>
                  <option value={ProjectType.INDUSTRIAL}>Industrial</option>
                </select>
               </div>
               <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">NEC Edition</label>
                <select 
                  value={project.necEdition}
                  onChange={e => handleMetaChange('necEdition', e.target.value)}
                  className="w-full border-gray-200 rounded-md text-sm"
                >
                  <option value="2023">2023 Edition</option>
                  <option value="2020">2020 Edition</option>
                </select>
               </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Permit Number</label>
                  <input 
                    type="text" 
                    value={project.settings.permitNumber || ''} 
                    onChange={e => handleSettingChange('permitNumber', e.target.value)}
                    className="w-full border-gray-200 rounded-md text-sm"
                    placeholder="Optional"
                  />
               </div>
               <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Utility Provider</label>
                  <input 
                    type="text" 
                    value={project.settings.utilityProvider || ''} 
                    onChange={e => handleSettingChange('utilityProvider', e.target.value)}
                    className="w-full border-gray-200 rounded-md text-sm"
                    placeholder="e.g. PG&E"
                  />
               </div>
            </div>
          </div>
        </div>

        {/* Electrical Characteristics */}
        <div className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center gap-2">
            <Zap className="w-5 h-5 text-electric-500" /> System Characteristics
          </h3>
          
          <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-md mb-6 flex gap-3">
             <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
             <p className="text-xs text-yellow-800 leading-relaxed">
               Changing system voltage or phase will affect all load calculations and panel schedules. Ensure downstream equipment is rated for the selected voltage.
             </p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Service Voltage</label>
                <select 
                  value={project.settings.serviceVoltage}
                  onChange={e => handleSettingChange('serviceVoltage', Number(e.target.value))}
                  className="w-full border-gray-200 rounded-md text-sm font-mono"
                >
                  <option value={120}>120V</option>
                  <option value={208}>208V</option>
                  <option value={240}>240V</option>
                  <option value={277}>277V</option>
                  <option value={480}>480V</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Phase</label>
                <select 
                  value={project.settings.servicePhase}
                  onChange={e => handleSettingChange('servicePhase', Number(e.target.value))}
                  className="w-full border-gray-200 rounded-md text-sm font-mono"
                >
                  <option value={1}>Single-Phase (1Φ)</option>
                  <option value={3}>Three-Phase (3Φ)</option>
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-50">
               <h4 className="text-sm font-medium text-gray-900 mb-3">Conductor Defaults</h4>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Material</label>
                    <select 
                      value={project.settings.conductorMaterial}
                      onChange={e => handleSettingChange('conductorMaterial', e.target.value)}
                      className="w-full border-gray-200 rounded-md text-sm"
                    >
                      <option value="Cu">Copper (Cu)</option>
                      <option value="Al">Aluminum (Al)</option>
                    </select>
                 </div>
                 <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Temp Rating</label>
                    <select 
                      value={project.settings.temperatureRating}
                      onChange={e => handleSettingChange('temperatureRating', Number(e.target.value))}
                      className="w-full border-gray-200 rounded-md text-sm"
                    >
                      <option value={60}>60°C</option>
                      <option value={75}>75°C (Standard)</option>
                      <option value={90}>90°C</option>
                    </select>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
