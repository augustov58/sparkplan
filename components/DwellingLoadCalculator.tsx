/**
 * Dwelling Load Calculator Component
 * NEC 220.82 (Single-Family) and 220.84 (Multi-Family) Calculations
 * 
 * This component replaces LoadCalculator for residential projects
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Home,
  Zap,
  Flame,
  Droplets,
  Wind,
  Car,
  Waves,
  Plus,
  Trash2,
  Calculator,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertTriangle,
  CheckCircle,
  Download,
  RefreshCw,
  Users,
  Cable
} from 'lucide-react';
import { 
  Project, 
  ProjectType, 
  DwellingType, 
  ResidentialAppliances,
  DwellingUnitTemplate,
  PanelCircuit
} from '../types';
import { 
  calculateSingleFamilyLoad, 
  calculateMultiFamilyLoad,
  generateResidentialPanelSchedule,
  ResidentialLoadResult,
  LoadBreakdown,
  GeneratedCircuit
} from '../services/calculations/residentialLoad';
import { usePanels } from '../hooks/usePanels';
import { useCircuits } from '../hooks/useCircuits';

interface DwellingLoadCalculatorProps {
  project: Project;
  updateProject: (p: Project) => void;
}

// Default appliances for a new project
const DEFAULT_APPLIANCES: ResidentialAppliances = {
  range: { enabled: false, kw: 12, type: 'electric' },
  dryer: { enabled: false, kw: 5.5, type: 'electric' },
  waterHeater: { enabled: false, kw: 4.5, type: 'electric' },
  hvac: { enabled: false, type: 'ac_only', coolingKw: 5, heatingKw: 0 },
  dishwasher: { enabled: false, kw: 1.5 },
  disposal: { enabled: false, kw: 0.5 },
  microwave: { enabled: false, kw: 1.5 },
  evCharger: { enabled: false, kw: 7.7, level: 2 },
  poolPump: { enabled: false, hp: 1.5 },
  poolHeater: { enabled: false, kw: 11 },
  hotTub: { enabled: false, kw: 6 },
  wellPump: { enabled: false, hp: 1 },
  otherAppliances: []
};

// Default unit template for multi-family
const DEFAULT_UNIT_TEMPLATE: DwellingUnitTemplate = {
  id: '',
  name: 'Standard Unit',
  squareFootage: 1000,
  unitCount: 1,
  appliances: { ...DEFAULT_APPLIANCES }
};

export const DwellingLoadCalculator: React.FC<DwellingLoadCalculatorProps> = ({ 
  project, 
  updateProject 
}) => {
  // Hooks
  const { panels, createPanel, updatePanel } = usePanels(project.id);
  const mainPanel = panels.find(p => p.is_main);
  const { circuits, createCircuit, deleteCircuitsByPanel } = useCircuits(project.id);

  // Get existing circuits for the main panel
  const mainPanelCircuits = mainPanel ? circuits.filter(c => c.panel_id === mainPanel.id) : [];

  // Local state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['appliances', 'results']));
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCircuits, setGeneratedCircuits] = useState<GeneratedCircuit[]>([]);
  const [showGenerated, setShowGenerated] = useState(false);

  // Get residential settings
  const residentialSettings = project.settings.residential;
  const dwellingType = residentialSettings?.dwellingType || DwellingType.SINGLE_FAMILY;
  const isSingleFamily = dwellingType === DwellingType.SINGLE_FAMILY;

  // Initialize appliances from project or use defaults
  const [appliances, setAppliances] = useState<ResidentialAppliances>(
    residentialSettings?.appliances || DEFAULT_APPLIANCES
  );

  // Multi-family state
  const [unitTemplates, setUnitTemplates] = useState<DwellingUnitTemplate[]>(
    residentialSettings?.unitTemplates || [{ ...DEFAULT_UNIT_TEMPLATE, id: crypto.randomUUID() }]
  );
  const [housePanelLoad, setHousePanelLoad] = useState(0);

  // Sync appliances to project when they change
  useEffect(() => {
    const timer = setTimeout(() => {
      updateProject({
        ...project,
        settings: {
          ...project.settings,
          residential: {
            ...project.settings.residential,
            appliances,
            unitTemplates: !isSingleFamily ? unitTemplates : undefined,
          } as any
        }
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [appliances, unitTemplates]);

  // Calculate load
  const loadResult: ResidentialLoadResult | null = useMemo(() => {
    try {
      if (isSingleFamily) {
        return calculateSingleFamilyLoad({
          squareFootage: residentialSettings?.squareFootage || 2000,
          smallApplianceCircuits: residentialSettings?.smallApplianceCircuits || 2,
          laundryCircuit: residentialSettings?.laundryCircuit ?? true,
          appliances
        });
      } else {
        return calculateMultiFamilyLoad({
          unitTemplates,
          housePanelLoad
        });
      }
    } catch (error) {
      console.error('Load calculation error:', error);
      return null;
    }
  }, [isSingleFamily, residentialSettings, appliances, unitTemplates, housePanelLoad]);

  // Toggle section
  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  // Update an appliance
  const updateAppliance = <K extends keyof ResidentialAppliances>(
    key: K, 
    value: ResidentialAppliances[K]
  ) => {
    setAppliances(prev => ({ ...prev, [key]: value }));
  };

  // Toggle appliance enabled
  const toggleAppliance = (key: keyof ResidentialAppliances) => {
    setAppliances(prev => {
      const current = prev[key] as any;
      if (current && typeof current === 'object' && 'enabled' in current) {
        return { ...prev, [key]: { ...current, enabled: !current.enabled } };
      }
      return prev;
    });
  };

  // Add custom appliance
  const addOtherAppliance = () => {
    setAppliances(prev => ({
      ...prev,
      otherAppliances: [
        ...(prev.otherAppliances || []),
        { description: 'New Appliance', kw: 1 }
      ]
    }));
  };

  // Remove custom appliance
  const removeOtherAppliance = (index: number) => {
    setAppliances(prev => ({
      ...prev,
      otherAppliances: prev.otherAppliances?.filter((_, i) => i !== index)
    }));
  };

  // Update custom appliance
  const updateOtherAppliance = (index: number, field: 'description' | 'kw', value: any) => {
    setAppliances(prev => ({
      ...prev,
      otherAppliances: prev.otherAppliances?.map((a, i) => 
        i === index ? { ...a, [field]: value } : a
      )
    }));
  };

  // Add unit template (multi-family)
  const addUnitTemplate = () => {
    setUnitTemplates(prev => [
      ...prev,
      { ...DEFAULT_UNIT_TEMPLATE, id: crypto.randomUUID(), name: `Unit Type ${prev.length + 1}` }
    ]);
  };

  // Update unit template
  const updateUnitTemplate = (id: string, updates: Partial<DwellingUnitTemplate>) => {
    setUnitTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  // Remove unit template
  const removeUnitTemplate = (id: string) => {
    if (unitTemplates.length > 1) {
      setUnitTemplates(prev => prev.filter(t => t.id !== id));
    }
  };

  // Generate panel schedule
  const handleGeneratePanelSchedule = async () => {
    if (!loadResult) {
      alert('Please configure appliances first to calculate the load.');
      return;
    }

    // Check for main panel
    if (!mainPanel) {
      alert(
        '❌ No Main Panel Found\n\n' +
        'You need to create a Main Distribution Panel (MDP) first.\n\n' +
        'Go to "Circuit Design" tab and create an MDP before generating a panel schedule.'
      );
      return;
    }

    // Multi-family: different workflow
    if (!isSingleFamily) {
      alert(
        '📋 Multi-Family Service Calculation\n\n' +
        'For multi-family projects, the calculator provides SERVICE SIZING only (shown on the right).\n\n' +
        'Multi-family buildings typically have:\n' +
        '• Meter stack/CT cabinet (not a traditional panel schedule)\n' +
        '• Individual dwelling unit panels (managed separately per unit)\n' +
        '• House panel for common areas\n\n' +
        'Use the Load Breakdown and Service Calculation results for your service entrance design.\n\n' +
        'Recommended Service: ' + loadResult.recommendedServiceSize + 'A'
      );
      return;
    }
    
    setIsGenerating(true);
    try {
      // Generate circuits (single-family only)
      const generated = generateResidentialPanelSchedule({
        squareFootage: residentialSettings?.squareFootage || 2000,
        smallApplianceCircuits: residentialSettings?.smallApplianceCircuits || 2,
        laundryCircuit: residentialSettings?.laundryCircuit ?? true,
        appliances
      });
      
      setGeneratedCircuits(generated);
      setShowGenerated(true);
    } finally {
      setIsGenerating(false);
    }
  };

  // Apply generated circuits to panel (clears existing circuits first)
  const handleApplyToPanelSchedule = async () => {
    if (!mainPanel) {
      alert('No main panel found. Please create an MDP first.');
      return;
    }
    if (generatedCircuits.length === 0) {
      alert('No circuits to apply. Please generate the panel schedule first.');
      return;
    }

    // Confirm if circuits already exist
    if (mainPanelCircuits.length > 0) {
      const confirmed = confirm(
        `⚠️ The panel schedule already has ${mainPanelCircuits.length} circuit(s).\n\n` +
        `Applying this generated schedule will DELETE all existing circuits and replace them with ${generatedCircuits.length} new circuits.\n\n` +
        `Do you want to proceed?`
      );
      if (!confirmed) return;
    }

    try {
      // ISSUE FIX: Clear existing circuits before creating new ones
      if (mainPanelCircuits.length > 0) {
        await deleteCircuitsByPanel(mainPanel.id);
      }

      // Create new circuits
      for (let i = 0; i < generatedCircuits.length; i++) {
        const circuit = generatedCircuits[i];
        if (!circuit) continue; // Skip if undefined

        // Calculate conductor size based on breaker amps (NEC Table 310.16)
        const getConductorSize = (amps: number): string => {
          if (amps <= 15) return '14 AWG';
          if (amps <= 20) return '12 AWG';
          if (amps <= 30) return '10 AWG';
          if (amps <= 40) return '8 AWG';
          if (amps <= 50) return '6 AWG';
          if (amps <= 60) return '6 AWG';
          if (amps <= 100) return '3 AWG';
          return '1 AWG';
        };

        await createCircuit({
          project_id: project.id,
          panel_id: mainPanel.id,
          circuit_number: i + 1,
          description: circuit.description,
          breaker_amps: circuit.breakerAmps,
          pole: circuit.pole,
          load_watts: circuit.loadWatts,
          conductor_size: getConductorSize(circuit.breakerAmps),  // Required field!
          load_type: circuit.loadType
        });
      }
      
      // Update recommended service in project
      if (loadResult) {
        updateProject({
          ...project,
          settings: {
            ...project.settings,
            residential: {
              ...project.settings.residential,
              recommendedServiceAmps: loadResult.serviceAmps
            } as any
          }
        });
      }

      setShowGenerated(false);
      alert(`Successfully created ${generatedCircuits.length} circuits in the panel schedule!`);
    } catch (error) {
      console.error('Error creating circuits:', error);
      alert('Error creating circuits. Check console for details.');
    }
  };

  // Clear all circuits from main panel
  const handleClearPanelSchedule = async () => {
    if (!mainPanel || mainPanelCircuits.length === 0) return;

    const confirmed = confirm(
      `⚠️ Delete all ${mainPanelCircuits.length} circuit(s) from the panel schedule?\n\n` +
      `This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await deleteCircuitsByPanel(mainPanel.id);
      alert('Panel schedule cleared successfully!');
    } catch (error) {
      console.error('Error clearing panel schedule:', error);
      alert('Error clearing panel schedule. Check console for details.');
    }
  };

  // Render appliance toggle card
  const renderApplianceCard = (
    key: keyof ResidentialAppliances,
    icon: React.ReactNode,
    title: string,
    children: React.ReactNode
  ) => {
    const appliance = appliances[key] as any;
    const isEnabled = appliance?.enabled;

    return (
      <div className={`border rounded-lg p-4 transition-all ${
        isEnabled ? 'border-electric-500 bg-electric-50/50' : 'border-slate-700 bg-slate-800'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-medium text-white">{title}</span>
          </div>
          <button
            onClick={() => toggleAppliance(key)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isEnabled ? 'bg-electric-500' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-slate-800 transition-transform ${
                isEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        {isEnabled && (
          <div className="pt-3 border-t border-gray-100 space-y-2">
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-light text-white flex items-center gap-2">
            <Home className="w-6 h-6 text-amber-600" />
            Dwelling Load Calculator
          </h2>
          <p className="text-slate-500 mt-1">
            {isSingleFamily 
              ? 'NEC 220.82 - Standard Method for Single-Family Dwellings'
              : 'NEC 220.84 - Optional Calculation for Multi-Family Dwellings'
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Show current panel status */}
          {mainPanel && (
            <div className="text-right">
              <p className="text-sm text-slate-400">
                Panel: <span className="font-medium">{mainPanel.name}</span>
              </p>
              <p className="text-xs text-slate-500">
                {mainPanelCircuits.length === 0 
                  ? 'No circuits created yet' 
                  : `${mainPanelCircuits.length} circuit${mainPanelCircuits.length !== 1 ? 's' : ''} in schedule`
                }
              </p>
            </div>
          )}
          
          {/* Clear Panel Schedule Button - only show if circuits exist */}
          {mainPanelCircuits.length > 0 && (
            <button
              onClick={handleClearPanelSchedule}
              className="px-3 py-2 border border-red-200 text-red-600 rounded-md hover:bg-red-50 transition-colors flex items-center gap-2 text-sm"
              title="Delete all circuits from panel"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          )}
          
          {/* Generate Panel Schedule Button */}
          <button
            onClick={handleGeneratePanelSchedule}
            disabled={isGenerating || !loadResult}
            className="px-4 py-2 bg-electric-500 text-white rounded-md hover:bg-electric-600 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Calculator className="w-4 h-4" />
            {mainPanelCircuits.length > 0 ? 'Regenerate Schedule' : 'Generate Panel Schedule'}
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Appliances */}
        <div className="lg:col-span-2 space-y-6">
          {/* Single Family: Square Footage Info */}
          {isSingleFamily && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800">
                    General Lighting Load: {((residentialSettings?.squareFootage || 2000) * 3).toLocaleString()} VA
                  </p>
                  <p className="text-xs text-amber-600">
                    {residentialSettings?.squareFootage?.toLocaleString() || '2,000'} sq ft × 3 VA/sq ft (NEC Table 220.12)
                  </p>
                </div>
                <p className="text-xs text-amber-700">
                  Edit square footage in Project Setup
                </p>
              </div>
            </div>
          )}

          {/* Multi-Family: Instructions & Unit Templates */}
          {!isSingleFamily && (
            <div className="space-y-4">
              {/* Instructions Card */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h3 className="font-medium text-purple-900 flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5" />
                  Multi-Family Calculation (NEC 220.84)
                </h3>
                <div className="text-sm text-purple-800 space-y-2">
                  <p><strong>How it works:</strong></p>
                  <ol className="list-decimal list-inside space-y-1 text-purple-700">
                    <li>Define unit types below (e.g., "Studio", "1BR", "2BR")</li>
                    <li>Set square footage and count for each type</li>
                    <li>Configure appliances using the section below (applies to ALL units)</li>
                    <li>Add house panel load for common areas (hallways, parking, laundry)</li>
                    <li>The calculator applies NEC Table 220.84 demand factors automatically</li>
                  </ol>
                </div>
              </div>

              {/* Unit Templates */}
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-medium text-white">Dwelling Unit Types</h3>
                  <button
                    onClick={addUnitTemplate}
                    className="text-sm text-electric-600 hover:text-electric-700 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Add Unit Type
                  </button>
                </div>
                <div className="space-y-3">
                  {unitTemplates.map((template, idx) => (
                    <div key={template.id} className="p-3 bg-slate-700/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          value={template.name}
                          onChange={e => updateUnitTemplate(template.id, { name: e.target.value })}
                          className="flex-1 border-slate-700 rounded text-sm font-medium"
                          placeholder="e.g., Type A - Studio"
                        />
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-slate-500">Sq Ft:</label>
                          <input
                            type="number"
                            value={template.squareFootage}
                            onChange={e => updateUnitTemplate(template.id, { squareFootage: Number(e.target.value) })}
                            className="w-20 border-slate-700 rounded text-sm"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-slate-500">Units:</label>
                          <input
                            type="number"
                            value={template.unitCount}
                            onChange={e => updateUnitTemplate(template.id, { unitCount: Number(e.target.value) })}
                            className="w-16 border-slate-700 rounded text-sm"
                            min={1}
                          />
                        </div>
                        <button
                          onClick={() => removeUnitTemplate(template.id)}
                          className="p-1 text-gray-400 hover:text-red-500"
                          disabled={unitTemplates.length === 1}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {/* Unit load preview */}
                      <div className="mt-2 text-xs text-slate-500 ml-1">
                        Lighting: {(template.squareFootage * 3).toLocaleString()} VA × {template.unitCount} units = {(template.squareFootage * 3 * template.unitCount).toLocaleString()} VA
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Summary */}
                <div className="mt-4 pt-4 border-t border-slate-700 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Total Dwelling Units:</span>
                    <span className="font-medium">{unitTemplates.reduce((sum, t) => sum + t.unitCount, 0)}</span>
                  </div>
                  
                  {/* House Panel Load */}
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-slate-300">House Panel Load:</label>
                    <input
                      type="number"
                      value={housePanelLoad}
                      onChange={e => setHousePanelLoad(Number(e.target.value))}
                      className="w-28 border-slate-700 rounded text-sm"
                      placeholder="0"
                    />
                    <span className="text-xs text-slate-500">VA (common areas: parking, hallways, laundry room)</span>
                  </div>
                </div>
              </div>
              
              {/* Note about appliances */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800">
                  <strong>💡 Appliances below apply to ALL unit types.</strong> Configure typical unit appliances (range, A/C, water heater) in the Appliances section below. The calculator assumes each dwelling unit has the same equipment.
                </p>
              </div>
            </div>
          )}

          {/* Appliances Section */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('appliances')}
              className="w-full px-4 py-3 flex items-center justify-between bg-slate-700 hover:bg-slate-600 transition-colors"
            >
              <h3 className="font-medium text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                Appliances & Equipment
              </h3>
              {expandedSections.has('appliances') ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </button>
            
            {expandedSections.has('appliances') && (
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Range */}
                  {renderApplianceCard('range', <Flame className="w-5 h-5 text-orange-500" />, 'Electric Range', (
                    <>
                      <select
                        value={appliances.range?.type || 'electric'}
                        onChange={e => updateAppliance('range', { ...appliances.range!, type: e.target.value as any })}
                        className="w-full text-sm border-slate-700 rounded"
                      >
                        <option value="electric">Electric</option>
                        <option value="gas">Gas (no load)</option>
                      </select>
                      {appliances.range?.type === 'electric' && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-slate-500">kW:</label>
                          <input
                            type="number"
                            value={appliances.range?.kw || 12}
                            onChange={e => updateAppliance('range', { ...appliances.range!, kw: Number(e.target.value) })}
                            className="flex-1 text-sm border-slate-700 rounded"
                            step={0.5}
                            min={0}
                          />
                        </div>
                      )}
                    </>
                  ))}

                  {/* Dryer */}
                  {renderApplianceCard('dryer', <Wind className="w-5 h-5 text-blue-500" />, 'Clothes Dryer', (
                    <>
                      <select
                        value={appliances.dryer?.type || 'electric'}
                        onChange={e => updateAppliance('dryer', { ...appliances.dryer!, type: e.target.value as any })}
                        className="w-full text-sm border-slate-700 rounded"
                      >
                        <option value="electric">Electric</option>
                        <option value="gas">Gas (no load)</option>
                      </select>
                      {appliances.dryer?.type === 'electric' && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-slate-500">kW:</label>
                          <input
                            type="number"
                            value={appliances.dryer?.kw || 5.5}
                            onChange={e => updateAppliance('dryer', { ...appliances.dryer!, kw: Number(e.target.value) })}
                            className="flex-1 text-sm border-slate-700 rounded"
                            step={0.5}
                            min={5}
                          />
                          <span className="text-xs text-gray-400">min 5 kW</span>
                        </div>
                      )}
                    </>
                  ))}

                  {/* Water Heater */}
                  {renderApplianceCard('waterHeater', <Droplets className="w-5 h-5 text-cyan-500" />, 'Water Heater', (
                    <>
                      <select
                        value={appliances.waterHeater?.type || 'electric'}
                        onChange={e => updateAppliance('waterHeater', { ...appliances.waterHeater!, type: e.target.value as any })}
                        className="w-full text-sm border-slate-700 rounded"
                      >
                        <option value="electric">Electric Tank</option>
                        <option value="tankless">Electric Tankless</option>
                        <option value="gas">Gas (no load)</option>
                      </select>
                      {appliances.waterHeater?.type !== 'gas' && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-slate-500">kW:</label>
                          <input
                            type="number"
                            value={appliances.waterHeater?.kw || 4.5}
                            onChange={e => updateAppliance('waterHeater', { ...appliances.waterHeater!, kw: Number(e.target.value) })}
                            className="flex-1 text-sm border-slate-700 rounded"
                            step={0.5}
                            min={0}
                          />
                        </div>
                      )}
                    </>
                  ))}

                  {/* HVAC */}
                  {renderApplianceCard('hvac', <Wind className="w-5 h-5 text-teal-500" />, 'HVAC System', (
                    <>
                      <select
                        value={appliances.hvac?.type || 'ac_only'}
                        onChange={e => updateAppliance('hvac', { ...appliances.hvac!, type: e.target.value as any })}
                        className="w-full text-sm border-slate-700 rounded mb-2"
                      >
                        <option value="ac_only">A/C Only</option>
                        <option value="heat_pump">Heat Pump</option>
                        <option value="electric_heat">Electric Furnace</option>
                        <option value="gas_heat">Gas Heat + A/C</option>
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-1">
                          <label className="text-xs text-slate-500">A/C kW:</label>
                          <input
                            type="number"
                            value={appliances.hvac?.coolingKw || 5}
                            onChange={e => updateAppliance('hvac', { ...appliances.hvac!, coolingKw: Number(e.target.value) })}
                            className="flex-1 text-sm border-slate-700 rounded"
                            step={0.5}
                            min={0}
                          />
                        </div>
                        {(appliances.hvac?.type === 'electric_heat' || appliances.hvac?.type === 'heat_pump') && (
                          <div className="flex items-center gap-1">
                            <label className="text-xs text-slate-500">Heat kW:</label>
                            <input
                              type="number"
                              value={appliances.hvac?.heatingKw || 10}
                              onChange={e => updateAppliance('hvac', { ...appliances.hvac!, heatingKw: Number(e.target.value) })}
                              className="flex-1 text-sm border-slate-700 rounded"
                              step={0.5}
                              min={0}
                            />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        NEC 220.60: Use larger of heat or A/C (non-coincident)
                      </p>
                    </>
                  ))}

                  {/* Dishwasher */}
                  {renderApplianceCard('dishwasher', <Droplets className="w-5 h-5 text-blue-400" />, 'Dishwasher', (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-500">kW:</label>
                      <input
                        type="number"
                        value={appliances.dishwasher?.kw || 1.5}
                        onChange={e => updateAppliance('dishwasher', { ...appliances.dishwasher!, kw: Number(e.target.value) })}
                        className="flex-1 text-sm border-slate-700 rounded"
                        step={0.1}
                        min={0}
                      />
                    </div>
                  ))}

                  {/* Garbage Disposal */}
                  {renderApplianceCard('disposal', <RefreshCw className="w-5 h-5 text-slate-500" />, 'Garbage Disposal', (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-500">kW:</label>
                      <input
                        type="number"
                        value={appliances.disposal?.kw || 0.5}
                        onChange={e => updateAppliance('disposal', { ...appliances.disposal!, kw: Number(e.target.value) })}
                        className="flex-1 text-sm border-slate-700 rounded"
                        step={0.1}
                        min={0}
                      />
                    </div>
                  ))}

                  {/* EV Charger */}
                  {renderApplianceCard('evCharger', <Car className="w-5 h-5 text-green-500" />, 'EV Charger', (
                    <>
                      <select
                        value={appliances.evCharger?.level || 2}
                        onChange={e => updateAppliance('evCharger', { ...appliances.evCharger!, level: Number(e.target.value) as 1 | 2 })}
                        className="w-full text-sm border-slate-700 rounded"
                      >
                        <option value={1}>Level 1 (120V)</option>
                        <option value={2}>Level 2 (240V)</option>
                      </select>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500">kW:</label>
                        <input
                          type="number"
                          value={appliances.evCharger?.kw || 7.7}
                          onChange={e => updateAppliance('evCharger', { ...appliances.evCharger!, kw: Number(e.target.value) })}
                          className="flex-1 text-sm border-slate-700 rounded"
                          step={0.1}
                          min={0}
                        />
                      </div>
                    </>
                  ))}

                  {/* Pool Pump */}
                  {renderApplianceCard('poolPump', <Waves className="w-5 h-5 text-blue-500" />, 'Pool Pump', (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-500">HP:</label>
                      <input
                        type="number"
                        value={appliances.poolPump?.hp || 1.5}
                        onChange={e => updateAppliance('poolPump', { ...appliances.poolPump!, hp: Number(e.target.value) })}
                        className="flex-1 text-sm border-slate-700 rounded"
                        step={0.5}
                        min={0}
                      />
                    </div>
                  ))}

                  {/* Pool Heater */}
                  {renderApplianceCard('poolHeater', <Flame className="w-5 h-5 text-red-400" />, 'Pool Heater', (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-500">kW:</label>
                      <input
                        type="number"
                        value={appliances.poolHeater?.kw || 11}
                        onChange={e => updateAppliance('poolHeater', { ...appliances.poolHeater!, kw: Number(e.target.value) })}
                        className="flex-1 text-sm border-slate-700 rounded"
                        step={1}
                        min={0}
                      />
                    </div>
                  ))}

                  {/* Hot Tub */}
                  {renderApplianceCard('hotTub', <Waves className="w-5 h-5 text-purple-500" />, 'Hot Tub / Spa', (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-500">kW:</label>
                      <input
                        type="number"
                        value={appliances.hotTub?.kw || 6}
                        onChange={e => updateAppliance('hotTub', { ...appliances.hotTub!, kw: Number(e.target.value) })}
                        className="flex-1 text-sm border-slate-700 rounded"
                        step={0.5}
                        min={0}
                      />
                    </div>
                  ))}

                  {/* Well Pump */}
                  {renderApplianceCard('wellPump', <Droplets className="w-5 h-5 text-slate-400" />, 'Well Pump', (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-500">HP:</label>
                      <input
                        type="number"
                        value={appliances.wellPump?.hp || 1}
                        onChange={e => updateAppliance('wellPump', { ...appliances.wellPump!, hp: Number(e.target.value) })}
                        className="flex-1 text-sm border-slate-700 rounded"
                        step={0.5}
                        min={0}
                      />
                    </div>
                  ))}
                </div>

                {/* Other Appliances */}
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-medium text-slate-300">Other Fixed Appliances</h4>
                    <button
                      onClick={addOtherAppliance}
                      className="text-sm text-electric-600 hover:text-electric-700 flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Add Appliance
                    </button>
                  </div>
                  {(appliances.otherAppliances || []).map((other, idx) => (
                    <div key={idx} className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={other.description}
                        onChange={e => updateOtherAppliance(idx, 'description', e.target.value)}
                        className="flex-1 text-sm border-slate-700 rounded"
                        placeholder="Description"
                      />
                      <input
                        type="number"
                        value={other.kw}
                        onChange={e => updateOtherAppliance(idx, 'kw', Number(e.target.value))}
                        className="w-20 text-sm border-slate-700 rounded"
                        step={0.1}
                        min={0}
                      />
                      <span className="text-xs text-slate-500">kW</span>
                      <button
                        onClick={() => removeOtherAppliance(idx)}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Results */}
        <div className="space-y-6">
          {/* Service Summary */}
          {loadResult && (
            <div className="bg-gradient-to-br from-electric-500 to-electric-600 text-white rounded-lg p-6 shadow-lg">
              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Service Calculation
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-electric-100">Connected Load</span>
                  <span className="text-xl font-bold">{(loadResult.totalConnectedVA / 1000).toFixed(1)} kVA</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-electric-100">Demand Load</span>
                  <span className="text-xl font-bold">{(loadResult.totalDemandVA / 1000).toFixed(1)} kVA</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-electric-100">Demand Factor</span>
                  <span className="text-lg">{(loadResult.demandFactor * 100).toFixed(1)}%</span>
                </div>
                <div className="pt-3 mt-3 border-t border-electric-400">
                  <div className="flex justify-between items-center">
                    <span className="text-electric-100">Service Current</span>
                    <span className="text-xl font-bold">{loadResult.serviceAmps}A</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-electric-100">Recommended Service</span>
                    <span className="text-2xl font-bold">{loadResult.recommendedServiceSize}A</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Conductor Sizing */}
          {loadResult && (
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-lg p-6 shadow-lg">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Cable className="w-5 h-5" />
                Recommended Conductor Sizes
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-500/20 rounded-lg p-4 border border-blue-400/30">
                  <div className="text-xs text-blue-100 mb-1">Service Conductors</div>
                  <div className="text-2xl font-bold">{loadResult.serviceConductorSize} Cu</div>
                  <div className="text-xs text-blue-200 mt-2">Ungrounded (hot)</div>
                  <div className="text-xs text-blue-200">Per NEC Table 310.12</div>
                </div>
                <div className="bg-blue-500/20 rounded-lg p-4 border border-blue-400/30">
                  <div className="text-xs text-blue-100 mb-1">Neutral Conductor</div>
                  <div className="text-2xl font-bold">{loadResult.neutralConductorSize} Cu</div>
                  <div className="text-xs text-blue-200 mt-2">{loadResult.neutralAmps}A demand</div>
                  <div className="text-xs text-blue-200">
                    {loadResult.neutralReduction > 0
                      ? `(${loadResult.neutralReduction}% reduction applied)`
                      : 'No reduction'}
                  </div>
                </div>
                <div className="bg-blue-500/20 rounded-lg p-4 border border-blue-400/30">
                  <div className="text-xs text-blue-100 mb-1">Grounding Electrode</div>
                  <div className="text-2xl font-bold">{loadResult.gecSize} Cu</div>
                  <div className="text-xs text-blue-200 mt-2">GEC to electrode</div>
                  <div className="text-xs text-blue-200">Per NEC 250.66</div>
                </div>
              </div>
              <div className="mt-4 text-xs text-blue-100 bg-blue-900/20 rounded-md p-3">
                <p className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Conductor sizes assume copper (Cu), 75°C terminations, and standard installation conditions.
                  For aluminum, underground, or special conditions, use the Conductor Sizing Tool for detailed calculations.</span>
                </p>
              </div>
            </div>
          )}

          {/* Warnings */}
          {loadResult?.warnings && loadResult.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-medium text-yellow-800 flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4" />
                Warnings
              </h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                {loadResult.warnings.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Load Breakdown */}
          {loadResult && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('results')}
                className="w-full px-4 py-3 flex items-center justify-between bg-slate-700 hover:bg-slate-600 transition-colors"
              >
                <h3 className="font-medium text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-slate-500" />
                  Load Breakdown
                </h3>
                {expandedSections.has('results') ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>
              
              {expandedSections.has('results') && (
                <div className="p-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-500 uppercase">
                        <th className="text-left pb-2">Category</th>
                        <th className="text-right pb-2">Connected</th>
                        <th className="text-right pb-2">Demand</th>
                        <th className="text-right pb-2">Factor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {loadResult.breakdown.map((item, idx) => (
                        <tr key={idx} className={item.category.includes('Subtotal') ? 'bg-slate-700/50 font-medium' : ''}>
                          <td className="py-2">
                            <div className="font-medium text-white">{item.category}</div>
                            <div className="text-xs text-slate-500">{item.description}</div>
                          </td>
                          <td className="py-2 text-right text-slate-400">
                            {(item.connectedVA / 1000).toFixed(2)} kVA
                          </td>
                          <td className="py-2 text-right text-white">
                            {item.demandVA > 0 ? `${(item.demandVA / 1000).toFixed(2)} kVA` : '-'}
                          </td>
                          <td className="py-2 text-right text-slate-500">
                            {item.demandFactor > 0 ? `${(item.demandFactor * 100).toFixed(0)}%` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 font-bold">
                        <td className="pt-3">TOTAL</td>
                        <td className="pt-3 text-right">{(loadResult.totalConnectedVA / 1000).toFixed(2)} kVA</td>
                        <td className="pt-3 text-right text-electric-600">{(loadResult.totalDemandVA / 1000).toFixed(2)} kVA</td>
                        <td className="pt-3 text-right">{(loadResult.demandFactor * 100).toFixed(1)}%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* NEC References */}
          {loadResult && (
            <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4">
              <h4 className="font-medium text-slate-300 mb-2">NEC References</h4>
              <ul className="text-xs text-slate-400 space-y-1">
                {loadResult.necReferences.map((ref, i) => (
                  <li key={i} className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    {ref}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Generated Panel Schedule Modal */}
      {showGenerated && generatedCircuits.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
              <h3 className="text-lg font-medium">Generated Panel Schedule</h3>
              <button
                onClick={() => setShowGenerated(false)}
                className="text-gray-400 hover:text-slate-400"
              >
                ×
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-700/50 text-xs text-slate-500 uppercase">
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-center">Breaker</th>
                    <th className="px-3 py-2 text-center">Poles</th>
                    <th className="px-3 py-2 text-right">Load (VA)</th>
                    <th className="px-3 py-2 text-center">Type</th>
                    <th className="px-3 py-2 text-left">NEC Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {generatedCircuits.map((circuit, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium">{circuit.description}</td>
                      <td className="px-3 py-2 text-center">{circuit.breakerAmps}A</td>
                      <td className="px-3 py-2 text-center">{circuit.pole}P</td>
                      <td className="px-3 py-2 text-right">{circuit.loadWatts.toLocaleString()}</td>
                      <td className="px-3 py-2 text-center">
                        <span className="px-2 py-0.5 bg-slate-600 rounded text-xs text-slate-300">{circuit.loadType}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">{circuit.necReference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-slate-700 flex justify-between items-center bg-slate-700/50">
              <p className="text-sm text-slate-400">
                {generatedCircuits.length} circuits • 
                Total Load: {(generatedCircuits.reduce((sum, c) => sum + c.loadWatts, 0) / 1000).toFixed(1)} kVA
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowGenerated(false)}
                  className="px-4 py-2 border border-slate-600 rounded-md hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyToPanelSchedule}
                  className="px-4 py-2 bg-electric-500 text-white rounded-md hover:bg-electric-600 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Apply to Panel Schedule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DwellingLoadCalculator;

