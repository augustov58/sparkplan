
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Project, ProjectType, ProjectStatus } from '../types';
import { Save, AlertTriangle, Building, Zap, Trash2 } from 'lucide-react';
import { usePanels } from '../hooks/usePanels';

interface ProjectSetupProps {
  project: Project;
  updateProject: (p: Project) => void;
  deleteProject?: (id: string) => void;
}

export const ProjectSetup: React.FC<ProjectSetupProps> = ({ project, updateProject, deleteProject }) => {
  const navigate = useNavigate();
  const { panels, updatePanel } = usePanels(project.id);

  // Local state for immediate UI updates
  const [localProject, setLocalProject] = useState<Project>(project);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync local state when project prop changes from database
  useEffect(() => {
    setLocalProject(project);
  }, [project.id]); // Only update when project ID changes, not on every prop update

  // Debounced update to database (saves after 500ms of no typing)
  const debouncedUpdate = (updatedProject: Project) => {
    // Update local state immediately for responsive UI
    setLocalProject(updatedProject);

    // Clear existing timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Set new timeout to save to database
    updateTimeoutRef.current = setTimeout(() => {
      updateProject(updatedProject);
    }, 500);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  const handleDelete = () => {
    if (deleteProject && confirm('Are you sure you want to delete this project? All data will be permanently removed.')) {
      deleteProject(localProject.id);
      navigate('/');
    }
  };

  const handleSettingChange = (field: keyof typeof localProject.settings, value: any) => {
    const updated = {
      ...localProject,
      settings: {
        ...localProject.settings,
        [field]: value
      },
      // specific sync for top level props to maintain compatibility
      serviceVoltage: field === 'serviceVoltage' ? value : localProject.serviceVoltage,
      servicePhase: field === 'servicePhase' ? value : localProject.servicePhase
    };
    debouncedUpdate(updated);
  };

  // Handle system type selection (voltage + phase together)
  const handleSystemTypeChange = async (systemType: string) => {
    const systemConfigs: Record<string, { voltage: number; phase: 1 | 3 }> = {
      '120/240-1': { voltage: 240, phase: 1 },
      '120/208-3': { voltage: 208, phase: 3 },
      '277/480-3': { voltage: 480, phase: 3 }
    };

    const config = systemConfigs[systemType];
    if (!config) return;

    const updated = {
      ...localProject,
      settings: {
        ...localProject.settings,
        serviceVoltage: config.voltage,
        servicePhase: config.phase
      },
      // Sync top-level props
      serviceVoltage: config.voltage,
      servicePhase: config.phase
    };
    debouncedUpdate(updated);

    // Update MDP (Main Distribution Panel) to match new service characteristics
    const mdp = panels.find(panel => panel.is_main === true);
    if (mdp && updatePanel) {
      try {
        await updatePanel(mdp.id, {
          voltage: config.voltage,
          phase: config.phase
        });
      } catch (error) {
        console.error('Error updating MDP voltage:', error);
      }
    }
  };

  const handleMetaChange = (field: keyof Project, value: any) => {
    const updated = { ...localProject, [field]: value };
    debouncedUpdate(updated);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-light text-gray-900">Project Configuration</h2>
          <p className="text-gray-500 mt-1">Define site parameters and electrical characteristics. Changes save automatically.</p>
        </div>
        {deleteProject && (
          <button
            onClick={handleDelete}
            className="border border-red-200 text-red-600 hover:bg-red-50 px-6 py-2 rounded-md font-medium flex items-center gap-2 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Delete Project
          </button>
        )}
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
                value={localProject.name}
                onChange={e => handleMetaChange('name', e.target.value)}
                className="w-full border-gray-200 rounded-md text-sm focus:border-electric-500 focus:ring-electric-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Address</label>
              <input
                type="text"
                value={localProject.address}
                onChange={e => handleMetaChange('address', e.target.value)}
                className="w-full border-gray-200 rounded-md text-sm focus:border-electric-500 focus:ring-electric-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Building Type</label>
                <select
                  value={localProject.type}
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
                  value={localProject.necEdition}
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
                    value={localProject.settings.permitNumber || ''}
                    onChange={e => handleSettingChange('permitNumber', e.target.value)}
                    className="w-full border-gray-200 rounded-md text-sm"
                    placeholder="Optional"
                  />
               </div>
               <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Utility Provider</label>
                  <input
                    type="text"
                    value={localProject.settings.utilityProvider || ''}
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
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Electrical System Type</label>
              <select
                value={(() => {
                  const v = localProject.settings.serviceVoltage;
                  const p = localProject.settings.servicePhase;
                  if (v === 240 && p === 1) return '120/240-1';
                  if (v === 208 && p === 3) return '120/208-3';
                  if (v === 480 && p === 3) return '277/480-3';
                  return '120/240-1'; // Default
                })()}
                onChange={e => handleSystemTypeChange(e.target.value)}
                className="w-full border-gray-200 rounded-md text-sm font-mono"
              >
                <option value="120/240-1">120/240V Single-Phase (Residential)</option>
                <option value="120/208-3">120/208V Three-Phase (Commercial)</option>
                <option value="277/480-3">277/480V Three-Phase (Industrial)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Common electrical system configurations per NEC standards
              </p>
            </div>

            <div className="pt-4 border-t border-gray-50">
               <h4 className="text-sm font-medium text-gray-900 mb-3">Conductor Defaults</h4>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Material</label>
                    <select
                      value={localProject.settings.conductorMaterial}
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
                      value={localProject.settings.temperatureRating}
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
