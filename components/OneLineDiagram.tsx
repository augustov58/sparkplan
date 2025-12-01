import React, { useState, useEffect } from 'react';
import { Project, PanelCircuit } from '../types';
import { generateOneLineDescription } from '../services/geminiService';
import { RefreshCcw, Download, Zap, Plus, Trash2, Grid, Bolt } from 'lucide-react';
import { useCircuits } from '../hooks/useCircuits';
import { usePanels } from '../hooks/usePanels';
import { useTransformers } from '../hooks/useTransformers';

interface OneLineDiagramProps {
  project: Project;
  updateProject?: (p: Project) => void;
}

export const OneLineDiagram: React.FC<OneLineDiagramProps> = ({ project, updateProject }) => {
  // Use panels, circuits, and transformers from database
  const { panels, createPanel, deletePanel, getMainPanel } = usePanels(project.id);
  const { circuits, createCircuit, deleteCircuit } = useCircuits(project.id);
  const { transformers, createTransformer, deleteTransformer } = useTransformers(project.id);

  const [description, setDescription] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Panel Editor State
  const [newPanel, setNewPanel] = useState({
    name: '',
    busRating: 200,
    mainBreakerAmps: 200,
    location: '',
    voltage: project.serviceVoltage,
    phase: project.servicePhase,
    isMain: false,
    fedFromType: 'panel' as 'panel' | 'transformer' | 'service',
    fedFromId: '' // Can be panel ID or transformer ID depending on fedFromType
  });

  // Circuit Editor State
  const [newCircuit, setNewCircuit] = useState<Partial<PanelCircuit> & { panelId?: string }>({
    circuitNumber: 1,
    description: '',
    breakerAmps: 20,
    pole: 1,
    conductorSize: '12 AWG',
    loadWatts: 0,
    panelId: undefined
  });

  // Transformer Editor State
  const [newTransformer, setNewTransformer] = useState({
    name: '',
    location: '',
    kvaRating: 75,
    primaryVoltage: project.serviceVoltage,
    primaryPhase: project.servicePhase,
    primaryBreakerAmps: 100,
    secondaryVoltage: 208,
    secondaryPhase: 3 as 1 | 3,
    fedFromPanelId: ''
  });

  // Note: MDP is now added manually by user
  // This gives more control over when/how the main panel is created

  // Set default panel to main when panels load
  useEffect(() => {
    if (panels.length > 0 && !newCircuit.panelId) {
      const mainPanel = getMainPanel();
      if (mainPanel) {
        setNewCircuit(prev => ({ ...prev, panelId: mainPanel.id }));
      }
    }
  }, [panels, newCircuit.panelId, getMainPanel]);

  const handleGenerate = async () => {
    setLoading(true);
    const desc = await generateOneLineDescription(project);
    setDescription(desc || "Failed to generate.");
    setLoading(false);
  };

  const addPanel = async () => {
    if (!newPanel.name) return;

    // Determine fed_from values based on type
    let fedFrom = null;
    let fedFromTransformerId = null;
    let fedFromType: 'panel' | 'transformer' | 'service' = 'service';

    if (!newPanel.isMain) {
      if (newPanel.fedFromType === 'panel') {
        fedFrom = newPanel.fedFromId || getMainPanel()?.id || null;
        fedFromType = 'panel';
      } else if (newPanel.fedFromType === 'transformer') {
        fedFromTransformerId = newPanel.fedFromId || null;
        fedFromType = 'transformer';
      }
    }

    const panelData = {
      project_id: project.id,
      name: newPanel.name,
      bus_rating: newPanel.busRating,
      voltage: newPanel.voltage,
      phase: newPanel.phase,
      main_breaker_amps: newPanel.mainBreakerAmps,
      location: newPanel.location || '',
      fed_from: fedFrom,
      fed_from_transformer_id: fedFromTransformerId,
      fed_from_type: fedFromType,
      is_main: newPanel.isMain
    };

    await createPanel(panelData);
    setNewPanel({
      name: '',
      busRating: 200,
      mainBreakerAmps: 200,
      location: '',
      voltage: project.serviceVoltage,
      phase: project.servicePhase,
      isMain: false,
      fedFromType: 'panel',
      fedFromId: ''
    });
  };

  const removePanel = async (id: string) => {
    const panel = panels.find(p => p.id === id);

    if (panel?.is_main) {
      const mainPanels = panels.filter(p => p.is_main);

      // If there are multiple main panels (duplicate issue), allow deletion
      if (mainPanels.length > 1) {
        if (!confirm(`Delete "${panel.name}"? You have ${mainPanels.length} main panels - this appears to be a duplicate.`)) {
          return;
        }
      } else {
        // Only one main panel - protect it
        alert('Cannot delete the only main distribution panel. Add another panel first or uncheck "Is Main" on another panel.');
        return;
      }
    }

    await deletePanel(id);
  };

  const addCircuit = async () => {
    if (!newCircuit.description || !newCircuit.panelId) return;

    const panel = panels.find(p => p.id === newCircuit.panelId);
    const panelCircuits = circuits.filter(c => c.panel_id === newCircuit.panelId);

    const circuitData = {
      project_id: project.id,
      panel_id: newCircuit.panelId,
      circuit_number: newCircuit.circuitNumber || panelCircuits.length + 1,
      description: newCircuit.description,
      breaker_amps: newCircuit.breakerAmps || 20,
      pole: newCircuit.pole || 1,
      load_watts: newCircuit.loadWatts || 0,
      conductor_size: newCircuit.conductorSize || '12 AWG'
    };

    await createCircuit(circuitData);
    setNewCircuit({
      ...newCircuit,
      circuitNumber: (newCircuit.circuitNumber || 0) + 1,
      description: '',
      loadWatts: 0
    });
  };

  const removeCircuit = async (id: string) => {
    await deleteCircuit(id);
  };

  const addTransformer = async () => {
    if (!newTransformer.name || !newTransformer.fedFromPanelId) return;

    const transformerData = {
      project_id: project.id,
      name: newTransformer.name,
      location: newTransformer.location || '',
      kva_rating: newTransformer.kvaRating,
      primary_voltage: newTransformer.primaryVoltage,
      primary_phase: newTransformer.primaryPhase,
      primary_breaker_amps: newTransformer.primaryBreakerAmps,
      secondary_voltage: newTransformer.secondaryVoltage,
      secondary_phase: newTransformer.secondaryPhase,
      fed_from_panel_id: newTransformer.fedFromPanelId,
      connection_type: 'delta-wye' as const
    };

    await createTransformer(transformerData);
    setNewTransformer({
      name: '',
      location: '',
      kvaRating: 75,
      primaryVoltage: project.serviceVoltage,
      primaryPhase: project.servicePhase,
      primaryBreakerAmps: 100,
      secondaryVoltage: 208,
      secondaryPhase: 3,
      fedFromPanelId: ''
    });
  };

  const removeTransformer = async (id: string) => {
    // Check if any panels are fed from this transformer
    const dependentPanels = panels.filter(p => p.fed_from_transformer_id === id);
    if (dependentPanels.length > 0) {
      alert(`Cannot delete transformer. ${dependentPanels.length} panel(s) are fed from it: ${dependentPanels.map(p => p.name).join(', ')}`);
      return;
    }
    await deleteTransformer(id);
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

        {/* Left Col: Panel & Circuit Editors */}
        <div className="space-y-6">
           {/* Add Panel */}
           <div className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm">
             <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
               <Grid className="w-4 h-4 text-electric-500" /> Add Panel/Bus
             </h3>
             <div className="space-y-3">
               <div>
                 <label className="text-xs font-semibold text-gray-500 uppercase">Panel Name</label>
                 <input
                    type="text"
                    value={newPanel.name}
                    onChange={e => setNewPanel({...newPanel, name: e.target.value})}
                    placeholder="e.g. LP - Lighting Panel"
                    className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
                 />
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="text-xs font-semibold text-gray-500 uppercase">Voltage (V)</label>
                   <select
                      value={newPanel.voltage}
                      onChange={e => setNewPanel({...newPanel, voltage: Number(e.target.value)})}
                      className="w-full border-gray-200 rounded text-sm py-2"
                   >
                     <option value="120">120V</option>
                     <option value="208">208V</option>
                     <option value="240">240V</option>
                     <option value="277">277V</option>
                     <option value="480">480V</option>
                   </select>
                 </div>
                 <div>
                   <label className="text-xs font-semibold text-gray-500 uppercase">Phase</label>
                   <select
                      value={newPanel.phase}
                      onChange={e => setNewPanel({...newPanel, phase: Number(e.target.value) as 1 | 3})}
                      className="w-full border-gray-200 rounded text-sm py-2"
                   >
                     <option value="1">Single-Phase</option>
                     <option value="3">Three-Phase</option>
                   </select>
                 </div>
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="text-xs font-semibold text-gray-500 uppercase">Bus Rating (A)</label>
                   <input
                      type="number"
                      value={newPanel.busRating}
                      onChange={e => setNewPanel({...newPanel, busRating: Number(e.target.value)})}
                      className="w-full border-gray-200 rounded text-sm py-2"
                   />
                 </div>
                 <div>
                   <label className="text-xs font-semibold text-gray-500 uppercase">Main Breaker (A)</label>
                   <input
                      type="number"
                      value={newPanel.mainBreakerAmps}
                      onChange={e => setNewPanel({...newPanel, mainBreakerAmps: Number(e.target.value)})}
                      className="w-full border-gray-200 rounded text-sm py-2"
                   />
                 </div>
               </div>
               <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Location</label>
                  <input
                    type="text"
                    value={newPanel.location}
                    onChange={e => setNewPanel({...newPanel, location: e.target.value})}
                    placeholder="Optional"
                    className="w-full border-gray-200 rounded text-sm py-2"
                 />
               </div>
               <div className="flex items-center">
                 <input
                   type="checkbox"
                   id="isMainPanel"
                   checked={newPanel.isMain}
                   onChange={e => setNewPanel({...newPanel, isMain: e.target.checked})}
                   className="rounded border-gray-300 text-electric-500 focus:ring-electric-500"
                 />
                 <label htmlFor="isMainPanel" className="ml-2 text-sm text-gray-700 cursor-pointer">
                   This is the Main Distribution Panel (MDP)
                 </label>
               </div>

               {!newPanel.isMain && (
                 <>
                   <div>
                     <label className="text-xs font-semibold text-gray-500 uppercase">Fed From</label>
                     <select
                        value={newPanel.fedFromType}
                        onChange={e => setNewPanel({...newPanel, fedFromType: e.target.value as 'panel' | 'transformer', fedFromId: ''})}
                        className="w-full border-gray-200 rounded text-sm py-2"
                     >
                       <option value="panel">Panel</option>
                       <option value="transformer">Transformer</option>
                     </select>
                   </div>
                   <div>
                     <label className="text-xs font-semibold text-gray-500 uppercase">
                       Select {newPanel.fedFromType === 'panel' ? 'Panel' : 'Transformer'}
                     </label>
                     <select
                        value={newPanel.fedFromId}
                        onChange={e => setNewPanel({...newPanel, fedFromId: e.target.value})}
                        className="w-full border-gray-200 rounded text-sm py-2"
                     >
                       <option value="">Auto-select from MDP</option>
                       {newPanel.fedFromType === 'panel' && panels.map(panel => (
                         <option key={panel.id} value={panel.id}>
                           {panel.name} ({panel.voltage}V {panel.phase}Φ)
                         </option>
                       ))}
                       {newPanel.fedFromType === 'transformer' && transformers.map(xfmr => (
                         <option key={xfmr.id} value={xfmr.id}>
                           {xfmr.name} ({xfmr.secondary_voltage}V {xfmr.secondary_phase}Φ)
                         </option>
                       ))}
                     </select>
                   </div>
                 </>
               )}

               <button
                  onClick={addPanel}
                  className="w-full bg-electric-400 text-black text-sm font-medium py-2 rounded hover:bg-electric-500 transition-colors"
               >
                 Add Panel
               </button>
             </div>
           </div>

           {/* Add Circuit */}
           <div className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm">
             <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
               <Plus className="w-4 h-4 text-electric-500" /> Add Circuit
             </h3>
             <div className="space-y-3">
               <div>
                 <label className="text-xs font-semibold text-gray-500 uppercase">Assign to Panel</label>
                 <select
                    value={newCircuit.panelId || ''}
                    onChange={e => setNewCircuit({...newCircuit, panelId: e.target.value})}
                    className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
                 >
                   {panels.length === 0 && <option value="">No panels available</option>}
                   {panels.map(panel => (
                     <option key={panel.id} value={panel.id}>
                       {panel.name} ({panel.bus_rating}A)
                     </option>
                   ))}
                 </select>
               </div>
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
               <div className="grid grid-cols-4 gap-3">
                 <div>
                   <label className="text-xs font-semibold text-gray-500 uppercase">Load (VA)</label>
                   <input
                      type="number"
                      value={newCircuit.loadWatts || ''}
                      onChange={e => setNewCircuit({...newCircuit, loadWatts: Number(e.target.value)})}
                      placeholder="0"
                      className="w-full border-gray-200 rounded text-sm py-2"
                   />
                 </div>
                 <div>
                   <label className="text-xs font-semibold text-gray-500 uppercase">Breaker (A)</label>
                   <select
                      value={newCircuit.breakerAmps}
                      onChange={e => setNewCircuit({...newCircuit, breakerAmps: Number(e.target.value)})}
                      className="w-full border-gray-200 rounded text-sm py-2"
                   >
                     <option value="15">15A</option>
                     <option value="20">20A</option>
                     <option value="30">30A</option>
                     <option value="40">40A</option>
                     <option value="50">50A</option>
                     <option value="60">60A</option>
                     <option value="100">100A</option>
                   </select>
                 </div>
                 <div>
                   <label className="text-xs font-semibold text-gray-500 uppercase">Poles</label>
                   <select
                      value={newCircuit.pole}
                      onChange={e => setNewCircuit({...newCircuit, pole: Number(e.target.value) as 1|2|3})}
                      className="w-full border-gray-200 rounded text-sm py-2"
                   >
                     <option value="1">1P</option>
                     <option value="2">2P</option>
                     <option value="3">3P</option>
                   </select>
                 </div>
                 <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">Wire</label>
                    <input
                      type="text"
                      value={newCircuit.conductorSize}
                      onChange={e => setNewCircuit({...newCircuit, conductorSize: e.target.value})}
                      placeholder="12 AWG"
                      className="w-full border-gray-200 rounded text-sm py-2"
                   />
                 </div>
               </div>
               <button
                  onClick={addCircuit}
                  disabled={!newCircuit.panelId}
                  className="w-full bg-gray-900 text-white text-sm font-medium py-2 rounded hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 Add Circuit
               </button>
             </div>
           </div>

           {/* Add Transformer */}
           <div className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm">
             <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
               <Bolt className="w-4 h-4 text-orange-500" /> Add Transformer
             </h3>
             <div className="space-y-3">
               <div>
                 <label className="text-xs font-semibold text-gray-500 uppercase">Transformer Name</label>
                 <input
                    type="text"
                    value={newTransformer.name}
                    onChange={e => setNewTransformer({...newTransformer, name: e.target.value})}
                    placeholder="e.g. XFMR-1"
                    className="w-full border-gray-200 rounded text-sm py-2"
                 />
               </div>
               <div>
                 <label className="text-xs font-semibold text-gray-500 uppercase">Fed From Panel</label>
                 <select
                    value={newTransformer.fedFromPanelId}
                    onChange={e => setNewTransformer({...newTransformer, fedFromPanelId: e.target.value})}
                    className="w-full border-gray-200 rounded text-sm py-2"
                 >
                   <option value="">Select panel...</option>
                   {panels.map(panel => (
                     <option key={panel.id} value={panel.id}>
                       {panel.name} ({panel.voltage}V {panel.phase}Φ)
                     </option>
                   ))}
                 </select>
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="text-xs font-semibold text-gray-500 uppercase">kVA Rating</label>
                   <select
                      value={newTransformer.kvaRating}
                      onChange={e => setNewTransformer({...newTransformer, kvaRating: Number(e.target.value)})}
                      className="w-full border-gray-200 rounded text-sm py-2"
                   >
                     <option value="15">15 kVA</option>
                     <option value="30">30 kVA</option>
                     <option value="45">45 kVA</option>
                     <option value="75">75 kVA</option>
                     <option value="112.5">112.5 kVA</option>
                     <option value="150">150 kVA</option>
                     <option value="225">225 kVA</option>
                     <option value="300">300 kVA</option>
                     <option value="500">500 kVA</option>
                   </select>
                 </div>
                 <div>
                   <label className="text-xs font-semibold text-gray-500 uppercase">Primary Breaker</label>
                   <input
                      type="number"
                      value={newTransformer.primaryBreakerAmps}
                      onChange={e => setNewTransformer({...newTransformer, primaryBreakerAmps: Number(e.target.value)})}
                      className="w-full border-gray-200 rounded text-sm py-2"
                   />
                 </div>
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="text-xs font-semibold text-gray-500 uppercase">Secondary Voltage</label>
                   <select
                      value={newTransformer.secondaryVoltage}
                      onChange={e => setNewTransformer({...newTransformer, secondaryVoltage: Number(e.target.value)})}
                      className="w-full border-gray-200 rounded text-sm py-2"
                   >
                     <option value="120">120V</option>
                     <option value="208">208V</option>
                     <option value="240">240V</option>
                     <option value="277">277V</option>
                     <option value="480">480V</option>
                   </select>
                 </div>
                 <div>
                   <label className="text-xs font-semibold text-gray-500 uppercase">Secondary Phase</label>
                   <select
                      value={newTransformer.secondaryPhase}
                      onChange={e => setNewTransformer({...newTransformer, secondaryPhase: Number(e.target.value) as 1 | 3})}
                      className="w-full border-gray-200 rounded text-sm py-2"
                   >
                     <option value="1">Single-Phase</option>
                     <option value="3">Three-Phase</option>
                   </select>
                 </div>
               </div>
               <div>
                 <label className="text-xs font-semibold text-gray-500 uppercase">Location (Optional)</label>
                 <input
                    type="text"
                    value={newTransformer.location}
                    onChange={e => setNewTransformer({...newTransformer, location: e.target.value})}
                    placeholder="e.g. Electrical Room"
                    className="w-full border-gray-200 rounded text-sm py-2"
                 />
               </div>
               <button
                  onClick={addTransformer}
                  disabled={!newTransformer.fedFromPanelId || !newTransformer.name}
                  className="w-full bg-orange-500 text-white text-sm font-medium py-2 rounded hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 Add Transformer
               </button>
             </div>
           </div>

           {/* Transformers List */}
           {transformers.length > 0 && (
             <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
               <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase">
                 Transformers ({transformers.length})
               </div>
               <div className="divide-y divide-gray-50 max-h-[200px] overflow-y-auto">
                 {transformers.map(xfmr => {
                   const sourcePanel = panels.find(p => p.id === xfmr.fed_from_panel_id);
                   return (
                     <div key={xfmr.id} className="p-3 flex justify-between items-center hover:bg-gray-50 group">
                       <div>
                         <div className="flex items-center gap-2">
                            <Bolt className="w-4 h-4 text-orange-500" />
                            <span className="text-sm font-medium text-gray-900">{xfmr.name}</span>
                         </div>
                         <div className="text-xs text-gray-500 ml-6">
                           {xfmr.kva_rating} kVA • {xfmr.primary_voltage}V → {xfmr.secondary_voltage}V
                           {sourcePanel && ` • From ${sourcePanel.name}`}
                         </div>
                       </div>
                       <button onClick={() => removeTransformer(xfmr.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100">
                         <Trash2 className="w-4 h-4" />
                       </button>
                     </div>
                   );
                 })}
               </div>
             </div>
           )}

           {/* Panels List */}
           <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
             <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase">
               Panels ({panels.length})
             </div>
             <div className="divide-y divide-gray-50 max-h-[200px] overflow-y-auto">
               {panels.map(panel => {
                 const mainPanelCount = panels.filter(p => p.is_main).length;
                 const canDelete = !panel.is_main || mainPanelCount > 1;

                 return (
                   <div key={panel.id} className="p-3 flex justify-between items-center hover:bg-gray-50 group">
                     <div>
                       <div className="flex items-center gap-2">
                          <Zap className={`w-4 h-4 ${panel.is_main ? 'text-red-500' : 'text-electric-500'}`} />
                          <span className="text-sm font-medium text-gray-900">{panel.name}</span>
                          {panel.is_main && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">MAIN</span>}
                          {panel.is_main && mainPanelCount > 1 && (
                            <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold">DUPLICATE</span>
                          )}
                       </div>
                       <div className="text-xs text-gray-500 ml-6">
                         {panel.bus_rating}A Bus • {panel.main_breaker_amps}A Main • {circuits.filter(c => c.panel_id === panel.id).length} circuits
                       </div>
                     </div>
                     {canDelete && (
                       <button onClick={() => removePanel(panel.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100">
                         <Trash2 className="w-4 h-4" />
                       </button>
                     )}
                   </div>
                 );
               })}
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

                {/* Utility Service */}
                <circle cx={serviceX} cy={50} r="20" stroke="#111827" strokeWidth="2" fill="white" />
                <text x={serviceX} y={55} textAnchor="middle" className="text-xs font-bold font-mono">UTIL</text>
                <text x={serviceX} y={30} textAnchor="middle" className="text-[9px] fill-gray-500">
                  {project.serviceVoltage}V {project.servicePhase}Φ
                </text>

                {/* Service Drop Line */}
                <line x1={serviceX} y1={70} x2={serviceX} y2={90} stroke="#111827" strokeWidth="3" />

                {/* Meter */}
                <rect x={serviceX - 20} y={90} width="40" height="30" stroke="#111827" strokeWidth="2" fill="white" />
                <text x={serviceX} y={110} textAnchor="middle" className="text-xs font-bold">M</text>

                {/* Service Line to First Panel */}
                <line x1={serviceX} y1={120} x2={serviceX} y2={160} stroke="#111827" strokeWidth="3" />

                {/* Render System Hierarchy */}
                {(() => {
                  const mainPanel = panels.find(p => p.is_main);

                  // Build hierarchy: panels fed from main, transformers, panels fed from transformers
                  const panelsFedFromMain = panels.filter(p => !p.is_main && p.fed_from_type === 'panel' && p.fed_from === mainPanel?.id);
                  const transformersFedFromMain = transformers.filter(t => t.fed_from_panel_id === mainPanel?.id);

                  // Calculate total elements for spacing
                  const totalElements = panelsFedFromMain.length + transformersFedFromMain.length;

                  return (
                    <>
                      {/* Main Distribution Panel (MDP) */}
                      {mainPanel && (
                        <>
                          <rect
                            x={serviceX - 60}
                            y={160}
                            width="120"
                            height="80"
                            rx="4"
                            stroke="#DC2626"
                            strokeWidth="2"
                            fill="#FEF2F2"
                          />
                          <text x={serviceX} y={180} textAnchor="middle" className="text-sm font-bold fill-gray-900">
                            {mainPanel.name}
                          </text>
                          <text x={serviceX} y={195} textAnchor="middle" className="text-[10px] fill-gray-600">
                            {mainPanel.voltage}V {mainPanel.phase}Φ
                          </text>
                          <text x={serviceX} y={208} textAnchor="middle" className="text-[9px] fill-gray-500">
                            {mainPanel.bus_rating}A Bus • {mainPanel.main_breaker_amps}A Main
                          </text>
                          <text x={serviceX} y={220} textAnchor="middle" className="text-[8px] fill-electric-600">
                            ({circuits.filter(c => c.panel_id === mainPanel.id).length} circuits)
                          </text>

                          {/* Bus from MDP */}
                          {totalElements > 0 && (
                            <>
                              <line x1={serviceX} y1={240} x2={serviceX} y2={280} stroke="#111827" strokeWidth="3" />
                              <line
                                x1={Math.max(150, serviceX - (totalElements * 70))}
                                y1={280}
                                x2={Math.min(650, serviceX + (totalElements * 70))}
                                y2={280}
                                stroke="#111827"
                                strokeWidth="4"
                              />
                            </>
                          )}

                          {/* Render panels fed directly from MDP */}
                          {panelsFedFromMain.map((panel, index) => {
                            const spacing = 140;
                            const startX = serviceX - ((totalElements - 1) * spacing / 2);
                            const xPos = startX + (index * spacing);
                            const panelCircuits = circuits.filter(c => c.panel_id === panel.id);

                            return (
                              <g key={`panel-${panel.id}`}>
                                <line x1={xPos} y1={280} x2={xPos} y2={350} stroke="#4B5563" strokeWidth="2" />
                                <rect
                                  x={xPos - 50}
                                  y={350}
                                  width="100"
                                  height="70"
                                  rx="4"
                                  stroke="#3B82F6"
                                  strokeWidth="2"
                                  fill="#EFF6FF"
                                />
                                <text x={xPos} y={368} textAnchor="middle" className="text-sm font-bold fill-gray-900">
                                  {panel.name}
                                </text>
                                <text x={xPos} y={382} textAnchor="middle" className="text-[9px] fill-gray-600">
                                  {panel.voltage}V {panel.phase}Φ
                                </text>
                                <text x={xPos} y={394} textAnchor="middle" className="text-[8px] fill-gray-500">
                                  {panel.bus_rating}A Bus • {panel.main_breaker_amps ? `${panel.main_breaker_amps}A Main` : 'MLO'}
                                </text>
                                <text x={xPos} y={406} textAnchor="middle" className="text-[7px] fill-electric-600">
                                  ({panelCircuits.length} ckt, {(panelCircuits.reduce((sum, c) => sum + (c.load_watts || 0), 0) / 1000).toFixed(1)}kVA)
                                </text>
                                {panel.location && (
                                  <text x={xPos} y={434} textAnchor="middle" className="text-[7px] fill-gray-400 italic">
                                    {panel.location}
                                  </text>
                                )}
                              </g>
                            );
                          })}

                          {/* Render transformers and their downstream panels */}
                          {transformersFedFromMain.map((xfmr, xfmrIndex) => {
                            const spacing = 140;
                            const baseIndex = panelsFedFromMain.length + xfmrIndex;
                            const startX = serviceX - ((totalElements - 1) * spacing / 2);
                            const xPos = startX + (baseIndex * spacing);

                            // Find panels fed from this transformer
                            const downstreamPanels = panels.filter(p => p.fed_from_transformer_id === xfmr.id);

                            return (
                              <g key={`xfmr-${xfmr.id}`}>
                                {/* Line from bus to transformer */}
                                <line x1={xPos} y1={280} x2={xPos} y2={310} stroke="#4B5563" strokeWidth="2" />

                                {/* Transformer Box */}
                                <rect
                                  x={xPos - 40}
                                  y={310}
                                  width="80"
                                  height="50"
                                  rx="4"
                                  stroke="#F59E0B"
                                  strokeWidth="2"
                                  fill="#FEF3C7"
                                />
                                <text x={xPos} y={328} textAnchor="middle" className="text-sm font-bold fill-orange-900">
                                  {xfmr.name}
                                </text>
                                <text x={xPos} y={340} textAnchor="middle" className="text-[8px] fill-orange-700">
                                  {xfmr.kva_rating} kVA
                                </text>
                                <text x={xPos} y={350} textAnchor="middle" className="text-[8px] fill-orange-700">
                                  {xfmr.primary_voltage}V → {xfmr.secondary_voltage}V
                                </text>

                                {/* Downstream panels from transformer */}
                                {downstreamPanels.map((panel, pIndex) => {
                                  const panelCircuits = circuits.filter(c => c.panel_id === panel.id);
                                  const panelX = xPos + (pIndex - (downstreamPanels.length - 1) / 2) * 90;
                                  const panelY = 440;

                                  return (
                                    <g key={`panel-xfmr-${panel.id}`}>
                                      <line x1={xPos} y1={360} x2={panelX} y2={panelY} stroke="#F59E0B" strokeWidth="2" />
                                      <rect
                                        x={panelX - 40}
                                        y={panelY}
                                        width="80"
                                        height="60"
                                        rx="4"
                                        stroke="#3B82F6"
                                        strokeWidth="2"
                                        fill="#EFF6FF"
                                      />
                                      <text x={panelX} y={panelY + 15} textAnchor="middle" className="text-xs font-bold fill-gray-900">
                                        {panel.name}
                                      </text>
                                      <text x={panelX} y={panelY + 27} textAnchor="middle" className="text-[8px] fill-gray-600">
                                        {panel.voltage}V {panel.phase}Φ
                                      </text>
                                      <text x={panelX} y={panelY + 37} textAnchor="middle" className="text-[7px] fill-gray-500">
                                        {panel.bus_rating}A • {panel.main_breaker_amps ? `${panel.main_breaker_amps}A` : 'MLO'}
                                      </text>
                                      <text x={panelX} y={panelY + 47} textAnchor="middle" className="text-[6px] fill-electric-600">
                                        ({panelCircuits.length} ckt, {(panelCircuits.reduce((sum, c) => sum + (c.load_watts || 0), 0) / 1000).toFixed(1)}kVA)
                                      </text>
                                    </g>
                                  );
                                })}
                              </g>
                            );
                          })}
                        </>
                      )}

                      {/* No Panels Message */}
                      {panels.length === 0 && (
                        <text x={400} y={300} textAnchor="middle" className="text-sm fill-gray-400">
                          Add panels using the form on the left to see them here
                        </text>
                      )}
                    </>
                  );
                })()}
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
