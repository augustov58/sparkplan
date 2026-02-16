import React, { useState, useMemo } from 'react';
import { Zap, Check, AlertCircle, Info, Activity, Sparkles, Calculator } from 'lucide-react';
import {
  generateCustomEVPanel,
  type ChargerTypeOption,
  type CustomEVPanelConfig
} from '../data/ev-panel-templates';
import { usePanels } from '../hooks/usePanels';
import { useCircuits } from '../hooks/useCircuits';
import type { Project } from '../types';

interface EVPanelTemplatesProps {
  project: Project;
}

export const EVPanelTemplates: React.FC<EVPanelTemplatesProps> = ({ project }) => {
  const { createPanel } = usePanels(project.id);
  const { createCircuit } = useCircuits(project.id);

  // Configuration state
  const [chargerType, setChargerType] = useState<ChargerTypeOption>('Level 2 (48A)');
  const [numberOfChargers, setNumberOfChargers] = useState<number>(4);
  const [useEVEMS, setUseEVEMS] = useState<boolean>(false);
  const [simultaneousChargers, setSimultaneousChargers] = useState<number>(3);
  const [includeSpare, setIncludeSpare] = useState<boolean>(true);
  const [includeLighting, setIncludeLighting] = useState<boolean>(true);
  const [customPanelName, setCustomPanelName] = useState('');

  // Apply status
  const [applyStatus, setApplyStatus] = useState<'idle' | 'applying' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Calculate panel specifications in real-time
  const panelSpecs = useMemo(() => {
    // Charger specs
    const chargerSpecs = {
      'Level 2 (48A)': { breakerSize: 60, voltage: 240, phase: 1 as 1 | 3, kW: 11.5 },
      'Level 2 (80A)': { breakerSize: 100, voltage: 240, phase: 1 as 1 | 3, kW: 19.2 },
      'DC Fast Charge (150kW)': { breakerSize: 225, voltage: 480, phase: 3 as 1 | 3, kW: 150 }
    };

    const specs = chargerSpecs[chargerType];
    const totalChargerLoad = numberOfChargers * specs.breakerSize;

    // Apply EVEMS if enabled
    const effectiveLoad = useEVEMS
      ? simultaneousChargers * specs.breakerSize
      : totalChargerLoad;

    // Add extras
    const spareLoad = includeSpare ? 20 : 0;
    const lightingLoad = includeLighting ? 20 : 0;
    const totalLoad = effectiveLoad + spareLoad + lightingLoad;

    // Determine panel rating
    const standardSizes = [100, 125, 150, 200, 225, 300, 400, 500, 600, 800, 1000, 1200, 1600, 2000];
    const panelRating = standardSizes.find(size => size >= totalLoad) || 2000;

    // Calculate total circuits
    const totalCircuits = numberOfChargers
      + (useEVEMS ? 1 : 0)
      + (includeSpare ? 1 : 0)
      + (includeLighting ? 1 : 0);

    return {
      voltage: specs.voltage,
      phase: specs.phase,
      panelRating,
      totalLoad,
      effectiveLoad,
      totalCircuits,
      totalPowerKW: numberOfChargers * specs.kW
    };
  }, [chargerType, numberOfChargers, useEVEMS, simultaneousChargers, includeSpare, includeLighting]);

  const handleApplyConfiguration = async () => {
    setApplyStatus('applying');
    setErrorMessage('');

    try {
      const config: CustomEVPanelConfig = {
        chargerType,
        numberOfChargers,
        useEVEMS,
        simultaneousChargers: useEVEMS ? simultaneousChargers : undefined,
        includeSpare,
        includeLighting,
        panelName: customPanelName || undefined
      };

      // Generate panel and circuits
      const { panel, circuits } = generateCustomEVPanel({
        projectId: project.id,
        config
      });

      // Create panel in database
      const newPanel = await createPanel(panel);

      if (!newPanel || !newPanel.id) {
        throw new Error('Failed to create panel');
      }

      // Create all circuits
      for (const circuit of circuits) {
        await createCircuit({
          ...circuit,
          panel_id: newPanel.id,
          project_id: project.id
        });
      }

      setApplyStatus('success');
      setTimeout(() => {
        setApplyStatus('idle');
        // Reset to defaults
        setChargerType('Level 2 (48A)');
        setNumberOfChargers(4);
        setUseEVEMS(false);
        setSimultaneousChargers(3);
        setCustomPanelName('');
      }, 3000);
    } catch (error: any) {
      console.error('Error applying configuration:', error);
      setErrorMessage(error.message || 'Failed to create EV panel');
      setApplyStatus('error');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-2">
          <Zap className="w-7 h-7 text-[#2d3b2d]" />
          <h1 className="text-2xl font-bold text-gray-900">
            Custom EV Panel Builder
          </h1>
        </div>
        <p className="text-sm text-gray-600">
          Configure a custom EV charging panel with any number of chargers, EVEMS load management, and optional circuits
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Configuration Form */}
        <div className="space-y-6">
          {/* Charger Type */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Charger Type
            </label>
            <div className="space-y-2">
              {(['Level 2 (48A)', 'Level 2 (80A)', 'DC Fast Charge (150kW)'] as ChargerTypeOption[]).map(type => (
                <div
                  key={type}
                  onClick={() => setChargerType(type)}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    chargerType === type
                      ? 'border-[#2d3b2d] bg-[#f0f5f0]'
                      : 'border-gray-200 hover:border-[#94b894]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{type}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {type === 'Level 2 (48A)' && '11.5 kW | 60A breaker | 240V'}
                        {type === 'Level 2 (80A)' && '19.2 kW | 100A breaker | 240V'}
                        {type === 'DC Fast Charge (150kW)' && '150 kW | 225A breaker | 480V 3φ'}
                      </div>
                    </div>
                    {chargerType === type && (
                      <Check className="w-5 h-5 text-[#2d3b2d]" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Number of Chargers */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Number of Chargers
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={numberOfChargers}
              onChange={(e) => setNumberOfChargers(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg font-medium focus:ring-2 focus:ring-[#2d3b2d]/20 focus:border-[#2d3b2d]"
            />
            <p className="text-xs text-gray-500 mt-2">
              Enter 1-20 chargers (typical: 4-8 for commercial)
            </p>
          </div>

          {/* EVEMS Load Management */}
          {chargerType !== 'DC Fast Charge (150kW)' && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-start gap-3 mb-4">
                <input
                  type="checkbox"
                  checked={useEVEMS}
                  onChange={(e) => setUseEVEMS(e.target.checked)}
                  className="mt-1 w-5 h-5 text-[#2d3b2d] border-gray-300 rounded focus:ring-[#2d3b2d]/20"
                />
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-gray-900">
                    Use EVEMS Load Management
                  </label>
                  <p className="text-xs text-gray-600 mt-1">
                    Per NEC 625.42 - Reduces panel capacity requirements by controlling simultaneous charging
                  </p>
                </div>
              </div>

              {useEVEMS && (
                <div className="mt-4 pl-8">
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Max Simultaneous Chargers
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={numberOfChargers}
                    value={simultaneousChargers}
                    onChange={(e) => setSimultaneousChargers(Math.max(1, Math.min(numberOfChargers, parseInt(e.target.value) || 1)))}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#2d3b2d]/20 focus:border-[#2d3b2d]"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Typical: 75% of total chargers ({Math.floor(numberOfChargers * 0.75)} for {numberOfChargers} chargers)
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Optional Circuits */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="text-sm font-semibold text-gray-900 mb-3">
              Optional Circuits
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={includeSpare}
                  onChange={(e) => setIncludeSpare(e.target.checked)}
                  className="w-4 h-4 text-[#2d3b2d] border-gray-300 rounded focus:ring-[#2d3b2d]/20"
                />
                <label className="text-sm text-gray-700">
                  Include Spare Circuit (20A)
                </label>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={includeLighting}
                  onChange={(e) => setIncludeLighting(e.target.checked)}
                  className="w-4 h-4 text-[#2d3b2d] border-gray-300 rounded focus:ring-[#2d3b2d]/20"
                />
                <label className="text-sm text-gray-700">
                  Include Lighting Circuit (20A)
                </label>
              </div>
            </div>
          </div>

          {/* Custom Panel Name */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Custom Panel Name (optional)
            </label>
            <input
              type="text"
              value={customPanelName}
              onChange={(e) => setCustomPanelName(e.target.value)}
              placeholder={`${numberOfChargers}× ${chargerType}${useEVEMS ? ' with EVEMS' : ''} Panel`}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2d3b2d]/20 focus:border-[#2d3b2d]"
            />
          </div>
        </div>

        {/* RIGHT: Live Preview */}
        <div className="space-y-6">
          {/* Panel Specifications */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="w-5 h-5 text-[#2d3b2d]" />
              <h3 className="font-bold text-gray-900">Panel Specifications</h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm text-gray-600">Panel Rating:</span>
                <span className="font-bold text-gray-900 text-lg">
                  {panelSpecs.panelRating}A
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm text-gray-600">Voltage/Phase:</span>
                <span className="font-medium text-gray-900">
                  {panelSpecs.voltage}V {panelSpecs.phase === 3 ? '3φ' : '1φ'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm text-gray-600">Total Load:</span>
                <span className="font-medium text-gray-900">
                  {panelSpecs.totalLoad}A {useEVEMS && `(${panelSpecs.effectiveLoad}A with EVEMS)`}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm text-gray-600">Total Power:</span>
                <span className="font-medium text-gray-900">
                  {panelSpecs.totalPowerKW.toFixed(1)} kW
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm text-gray-600">Total Circuits:</span>
                <span className="font-medium text-gray-900">
                  {panelSpecs.totalCircuits}
                </span>
              </div>

              {/* Utilization Bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>Panel Utilization</span>
                  <span>{((panelSpecs.totalLoad / panelSpecs.panelRating) * 100).toFixed(0)}%</span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      (panelSpecs.totalLoad / panelSpecs.panelRating) > 0.8
                        ? 'bg-red-500'
                        : (panelSpecs.totalLoad / panelSpecs.panelRating) > 0.6
                        ? 'bg-[#fff8e6]0'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, (panelSpecs.totalLoad / panelSpecs.panelRating) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* What Will Be Created */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#2d3b2d]" />
              This will create:
            </h3>
            <ul className="text-sm text-gray-700 space-y-2">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>1 Panel:</strong> {panelSpecs.panelRating}A, {panelSpecs.voltage}V, {panelSpecs.phase}-phase
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>{numberOfChargers} EV Circuits:</strong> {chargerType} chargers
                </span>
              </li>
              {useEVEMS && (
                <li className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>1 EVEMS Controller:</strong> Manages {simultaneousChargers} simultaneous chargers
                  </span>
                </li>
              )}
              {includeSpare && (
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>1 Spare Circuit (20A)</span>
                </li>
              )}
              {includeLighting && (
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>1 Lighting Circuit (20A)</span>
                </li>
              )}
            </ul>
          </div>

          {/* Service Upgrade Warning */}
          {panelSpecs.totalLoad > (project.serviceSizeAmps || 200) && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-orange-900 mb-1">Service Upgrade May Be Required</h4>
                  <p className="text-sm text-orange-800">
                    This configuration requires <strong>{panelSpecs.totalLoad}A</strong> of capacity,
                    but your current service is only <strong>{project.serviceSizeAmps || 200}A</strong>.
                    Use the <strong>Service Upgrade Wizard</strong> to determine if an upgrade is needed per NEC 220.87.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Apply Button */}
          <button
            onClick={handleApplyConfiguration}
            disabled={applyStatus === 'applying'}
            className={`w-full py-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
              applyStatus === 'applying'
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : applyStatus === 'success'
                ? 'bg-green-500 text-white'
                : 'bg-[#2d3b2d] text-white hover:bg-[#3d4f3d]'
            }`}
          >
            {applyStatus === 'applying' ? (
              <>
                <Activity className="w-5 h-5 animate-spin" />
                Creating Panel...
              </>
            ) : applyStatus === 'success' ? (
              <>
                <Check className="w-5 h-5" />
                Panel Created Successfully!
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Create EV Panel
              </>
            )}
          </button>

          {/* Error Message */}
          {applyStatus === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-900 mb-1">Error Creating Panel</h4>
                  <p className="text-sm text-red-800">{errorMessage}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* NEC References */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-600">
        <p className="font-medium mb-2">NEC References:</p>
        <ul className="space-y-1">
          <li>• NEC 625.41 - Electric Vehicle Coupler</li>
          <li>• NEC 625.42 - Electric Vehicle Supply Equipment Load Management (EVEMS)</li>
          <li>• NEC 625.44 - Electric Vehicle Supply Equipment Demand Factors</li>
          <li>• NEC 210.19 - Conductors - Minimum Ampacity and Size</li>
          <li>• NEC 310.16 - Allowable Ampacities of Insulated Conductors</li>
        </ul>
      </div>
    </div>
  );
};
