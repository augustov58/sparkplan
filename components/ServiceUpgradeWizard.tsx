import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  TrendingUp,
  Zap,
  AlertTriangle,
  CheckCircle,
  Info,
  Plus,
  Trash2
} from 'lucide-react';
import {
  quickServiceCheck,
  LOAD_TEMPLATES,
  templateToQuickAmps
} from '../services/calculations/serviceUpgrade';
import type { QuickCheckResult } from '../types';
import { ExistingLoadDeterminationMethod } from '../types';
import { useProjects } from '../hooks/useProjects';
import { usePanels } from '../hooks/usePanels';
import { useCircuits } from '../hooks/useCircuits';

export const ServiceUpgradeWizard: React.FC = () => {
  const { projectId } = useParams();
  const { getProjectById } = useProjects();
  const project = projectId ? getProjectById(projectId) : undefined;
  const { panels } = usePanels(projectId);

  // Mode toggle (Quick Check for Phase 1 MVP)
  const [mode, setMode] = useState<'quick' | 'detailed'>('quick');

  // Panel integration toggle
  const [useProjectData, setUseProjectData] = useState(!!projectId);
  const [panelDataSource, setPanelDataSource] = useState<string>('');

  // NEC 220.87 - Existing load determination method
  const [existingLoadMethod, setExistingLoadMethod] = useState<ExistingLoadDeterminationMethod>(
    ExistingLoadDeterminationMethod.CALCULATED
  );

  // Quick Check state
  const [currentServiceAmps, setCurrentServiceAmps] = useState(200);
  const [currentUsageAmps, setCurrentUsageAmps] = useState(140);
  const [proposedLoadAmps, setProposedLoadAmps] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState('');

  // Auto-populate from project panel schedule
  useEffect(() => {
    if (useProjectData && panels && panels.length > 0) {
      // Find main panel
      const mainPanel = panels.find(p => p.is_main);

      if (mainPanel) {
        // Set service size from panel bus rating
        setCurrentServiceAmps(mainPanel.bus_rating);
        setPanelDataSource(mainPanel.name);

        // When using project data, set method to CALCULATED (NEC 220.87 Method 2)
        setExistingLoadMethod(ExistingLoadDeterminationMethod.CALCULATED);

        // Calculate total load from circuits
        // Note: useCircuits hook will be called below
      } else if (panels.length > 0 && panels[0]) {
        // If no main panel, use first panel
        setCurrentServiceAmps(panels[0].bus_rating);
        setPanelDataSource(panels[0].name);
        setExistingLoadMethod(ExistingLoadDeterminationMethod.CALCULATED);
      }
    }
  }, [useProjectData, panels]);

  // Get circuits for main panel and calculate load
  const mainPanel = useProjectData && panels ? panels.find(p => p.is_main) : null;
  const { circuits } = useCircuits(mainPanel?.id);

  useEffect(() => {
    if (useProjectData && circuits && circuits.length > 0) {
      // Calculate total load from circuits
      let totalLoad_kVA = 0;

      for (const circuit of circuits) {
        // Sum up connected load (watts converted to kVA)
        // Note: load_watts is the connected load in watts
        if (circuit.load_watts) {
          totalLoad_kVA += circuit.load_watts / 1000;
        }
      }

      // Convert kVA to amps
      const voltage = project?.serviceVoltage || 240;
      const loadAmps = (totalLoad_kVA * 1000) / voltage;

      setCurrentUsageAmps(Math.round(loadAmps));
    }
  }, [useProjectData, circuits, project]);

  // Calculate result in real-time
  let result: QuickCheckResult | null = null;
  let error: string | null = null;

  try {
    result = quickServiceCheck({
      currentServiceAmps,
      currentUsageAmps,
      proposedLoadAmps,
      existingLoadMethod // NEC 220.87 compliance
    });
  } catch (err) {
    error = err instanceof Error ? err.message : 'Calculation error';
  }

  // Add load from template
  const addLoadFromTemplate = (templateName: string) => {
    const template = LOAD_TEMPLATES.find(t => t.name === templateName);
    if (!template) return;

    const amps = templateToQuickAmps(template);
    setProposedLoadAmps(amps);
    setSelectedTemplate(''); // Reset dropdown
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-electric-500" />
          Service Upgrade Wizard
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Determine if your existing service can handle additional loads (NEC 230.42)
        </p>
      </div>

      {/* Mode Toggle (Phase 2: Add Detailed Analysis) */}
      <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
        <button
          onClick={() => setMode('quick')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'quick'
              ? 'bg-electric-500 text-black'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          Quick Check (Amps)
        </button>
        <button
          onClick={() => setMode('detailed')}
          disabled
          className="px-4 py-2 rounded-md text-sm font-medium bg-gray-100 text-gray-400 cursor-not-allowed"
        >
          Detailed Analysis (Coming Soon)
        </button>

        <div className="ml-auto flex items-center gap-4">
          {projectId && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="useProjectData"
                checked={useProjectData}
                onChange={e => setUseProjectData(e.target.checked)}
                className="rounded border-gray-300 text-electric-500 focus:ring-electric-500"
              />
              <label htmlFor="useProjectData" className="text-xs text-gray-700 cursor-pointer">
                Use project data
              </label>
            </div>
          )}
          <div className="text-xs text-gray-500">
            <Info className="w-4 h-4 inline mr-1" />
            Quick field check
          </div>
        </div>
      </div>

      {/* Project Data Indicator */}
      {useProjectData && panelDataSource && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <span className="font-semibold text-green-900">Using data from panel "{panelDataSource}"</span>
            <p className="text-xs text-green-700 mt-1">
              Service size and current load auto-populated from your project panel schedule.
              {circuits && circuits.length > 0 && (
                <span> Calculated from {circuits.length} circuit{circuits.length > 1 ? 's' : ''}.</span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* ===== LEFT COLUMN: INPUTS ===== */}
        <div className="space-y-6">
          {/* Current Service Section */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
            <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-electric-500" />
              Current Service
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Service Size (A)
                </label>
                <select
                  value={currentServiceAmps}
                  onChange={e => setCurrentServiceAmps(Number(e.target.value))}
                  className="w-full border-gray-200 rounded text-sm py-2 px-3 focus:border-electric-500 focus:ring-electric-500"
                >
                  <option value="100">100A</option>
                  <option value="125">125A</option>
                  <option value="150">150A</option>
                  <option value="200">200A</option>
                  <option value="225">225A</option>
                  <option value="300">300A</option>
                  <option value="400">400A</option>
                  <option value="500">500A</option>
                  <option value="600">600A</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Current Usage (A)
                </label>
                <input
                  type="number"
                  value={currentUsageAmps}
                  onChange={e => setCurrentUsageAmps(Number(e.target.value))}
                  min="0"
                  max={currentServiceAmps}
                  step="1"
                  className="w-full border-gray-200 rounded text-sm py-2 px-3 focus:border-electric-500 focus:ring-electric-500"
                />
              </div>
            </div>

            {/* NEC 220.87 - How was existing load determined? */}
            <div className="border-t border-gray-200 pt-3 mt-3 space-y-3">
              <label className="block text-xs font-semibold text-gray-500 uppercase">
                <Info className="w-3 h-3 inline mr-1" />
                How was existing load determined? (NEC 220.87)
              </label>
              <div className="space-y-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="existingLoadMethod"
                    checked={existingLoadMethod === ExistingLoadDeterminationMethod.UTILITY_BILL}
                    onChange={() => setExistingLoadMethod(ExistingLoadDeterminationMethod.UTILITY_BILL)}
                    className="mt-0.5 text-electric-500 focus:ring-electric-500"
                  />
                  <span className="text-xs">
                    <span className="font-semibold text-gray-900">12-Month Utility Billing</span>
                    <span className="text-gray-600"> (Actual peak demand - NEC 220.87 Method 1)</span>
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="existingLoadMethod"
                    checked={existingLoadMethod === ExistingLoadDeterminationMethod.LOAD_STUDY}
                    onChange={() => setExistingLoadMethod(ExistingLoadDeterminationMethod.LOAD_STUDY)}
                    className="mt-0.5 text-electric-500 focus:ring-electric-500"
                  />
                  <span className="text-xs">
                    <span className="font-semibold text-gray-900">30-Day Load Study</span>
                    <span className="text-gray-600"> (Continuous recording - NEC 220.87 Method 1)</span>
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="existingLoadMethod"
                    checked={existingLoadMethod === ExistingLoadDeterminationMethod.CALCULATED}
                    onChange={() => setExistingLoadMethod(ExistingLoadDeterminationMethod.CALCULATED)}
                    className="mt-0.5 text-electric-500 focus:ring-electric-500"
                  />
                  <span className="text-xs">
                    <span className="font-semibold text-gray-900">Calculated from Panel Schedule</span>
                    <span className="text-gray-600"> (125% multiplier applied - NEC 220.87 Method 2)</span>
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="existingLoadMethod"
                    checked={existingLoadMethod === ExistingLoadDeterminationMethod.MANUAL}
                    onChange={() => setExistingLoadMethod(ExistingLoadDeterminationMethod.MANUAL)}
                    className="mt-0.5 text-electric-500 focus:ring-electric-500"
                  />
                  <span className="text-xs">
                    <span className="font-semibold text-gray-900">Manual Entry</span>
                    <span className="text-gray-600"> (125% multiplier applied)</span>
                  </span>
                </label>
              </div>
            </div>

            {/* Warning for calculated loads */}
            {(existingLoadMethod === ExistingLoadDeterminationMethod.CALCULATED ||
              existingLoadMethod === ExistingLoadDeterminationMethod.MANUAL) && (
              <div className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded p-2">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                <strong>NEC 220.87 RECOMMENDATION:</strong> For most accurate results, use actual maximum
                demand from 12-month utility billing or 30-day load study. Calculated loads apply 125%
                multiplier and may overestimate capacity needs.
              </div>
            )}

            <div className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded p-2">
              <Info className="w-3 h-3 inline mr-1" />
              Check main breaker or use panel schedule data
            </div>
          </div>

          {/* Proposed Load Section */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
            <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <Plus className="w-4 h-4 text-electric-500" />
              Proposed New Load
            </h4>

            {/* Template Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Select from Common Loads
              </label>
              <select
                value={selectedTemplate}
                onChange={e => addLoadFromTemplate(e.target.value)}
                className="w-full border-gray-200 rounded text-sm py-2 px-3 focus:border-electric-500 focus:ring-electric-500"
              >
                <option value="">-- Select Load --</option>
                <optgroup label="EV Chargers">
                  {LOAD_TEMPLATES.filter(t => t.category === 'EV').map(t => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                </optgroup>
                <optgroup label="HVAC">
                  {LOAD_TEMPLATES.filter(t => t.category === 'HVAC').map(t => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Appliances">
                  {LOAD_TEMPLATES.filter(t => t.category === 'Appliance').map(t => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Solar/Storage">
                  {LOAD_TEMPLATES.filter(t => t.category === 'Solar').map(t => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Manual Entry */}
            <div className="border-t border-gray-200 pt-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Or Enter Custom Load (A)
              </label>
              <input
                type="number"
                value={proposedLoadAmps}
                onChange={e => setProposedLoadAmps(Number(e.target.value))}
                min="0"
                step="1"
                className="w-full border-gray-200 rounded text-sm py-2 px-3 focus:border-electric-500 focus:ring-electric-500"
                placeholder="Enter amps"
              />
            </div>

            {proposedLoadAmps > 0 && (
              <div className="bg-white border border-electric-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      Proposed Load
                    </div>
                    <div className="text-xs text-gray-500">
                      {proposedLoadAmps}A continuous load
                    </div>
                  </div>
                  <button
                    onClick={() => setProposedLoadAmps(0)}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                    title="Clear load"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ===== RIGHT COLUMN: RESULTS ===== */}
        <div className="space-y-4">
          <h4 className="font-bold text-gray-900">Analysis Results</h4>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-800">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium">Error</span>
              </div>
              <p className="text-sm text-red-700 mt-2">{error}</p>
            </div>
          )}

          {result && (
            <>
              {/* Current Utilization Gauge */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">
                    Current Utilization
                  </span>
                  <span className={`text-lg font-bold ${
                    (currentUsageAmps / currentServiceAmps * 100) > 90 ? 'text-red-700' :
                    (currentUsageAmps / currentServiceAmps * 100) > 80 ? 'text-orange-700' :
                    'text-green-700'
                  }`}>
                    {Math.round((currentUsageAmps / currentServiceAmps * 100) * 10) / 10}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      (currentUsageAmps / currentServiceAmps * 100) > 90 ? 'bg-red-600' :
                      (currentUsageAmps / currentServiceAmps * 100) > 80 ? 'bg-orange-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min((currentUsageAmps / currentServiceAmps * 100), 100)}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-gray-600">
                  <div>Current: {currentUsageAmps}A</div>
                  <div>Capacity: {currentServiceAmps}A</div>
                </div>
              </div>

              {/* Future Utilization (with proposed load) */}
              {proposedLoadAmps > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-700">
                      Future Utilization
                    </span>
                    <span className={`text-2xl font-bold ${
                      result.utilizationPercent > 100 ? 'text-red-700' :
                      result.utilizationPercent > 80 ? 'text-orange-700' :
                      'text-green-700'
                    }`}>
                      {result.utilizationPercent}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className={`h-4 rounded-full transition-all ${
                        result.utilizationPercent > 100 ? 'bg-red-600' :
                        result.utilizationPercent > 80 ? 'bg-orange-500' :
                        'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(result.utilizationPercent, 100)}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-xs text-gray-600">
                    <div>Current: {currentUsageAmps}A</div>
                    <div>Added: +{proposedLoadAmps}A</div>
                    <div>Total: {result.totalAmps}A</div>
                  </div>
                </div>
              )}

              {/* Recommendation Card */}
              <div className={`border-2 rounded-lg p-6 ${
                result.status === 'CRITICAL'
                  ? 'bg-red-50 border-red-300'
                  : result.status === 'HIGH'
                    ? 'bg-yellow-50 border-yellow-300'
                    : 'bg-green-50 border-green-300'
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  {result.status === 'CRITICAL' ? (
                    <AlertTriangle className="w-6 h-6 text-red-700" />
                  ) : result.status === 'HIGH' ? (
                    <Info className="w-6 h-6 text-yellow-700" />
                  ) : (
                    <CheckCircle className="w-6 h-6 text-green-700" />
                  )}
                  <span className={`font-bold text-lg ${
                    result.status === 'CRITICAL' ? 'text-red-900' :
                    result.status === 'HIGH' ? 'text-yellow-900' :
                    'text-green-900'
                  }`}>
                    {result.status === 'CRITICAL'
                      ? 'Service Upgrade REQUIRED'
                      : result.status === 'HIGH'
                        ? 'Service Upgrade RECOMMENDED'
                        : 'Current Service is Adequate'
                    }
                  </span>
                </div>

                <p className={`text-sm ${
                  result.status === 'CRITICAL' ? 'text-red-800' :
                  result.status === 'HIGH' ? 'text-yellow-800' :
                  'text-green-800'
                }`}>
                  {result.recommendation}
                </p>

                {result.availableAmps > 0 && result.status === 'OK' && (
                  <div className="mt-4 pt-4 border-t border-green-200">
                    <div className="text-sm text-green-900 font-semibold mb-1">
                      Available Capacity
                    </div>
                    <div className="text-2xl font-bold text-green-700">
                      {result.availableAmps}A
                    </div>
                    <div className="text-xs text-green-700 mt-1">
                      Remaining capacity for future loads
                    </div>
                  </div>
                )}

                {result.status === 'CRITICAL' && (
                  <div className="mt-4 pt-4 border-t border-red-200">
                    <div className="text-sm text-red-900 font-semibold mb-2">
                      Next Steps:
                    </div>
                    <ul className="text-xs text-red-800 space-y-1 list-disc list-inside">
                      <li>Consult with licensed electrician for service upgrade quote</li>
                      <li>Consider EVEMS load management system as alternative</li>
                      <li>Coordinate with utility company (2-6 week lead time)</li>
                      <li>Obtain electrical permit for service upgrade</li>
                    </ul>
                  </div>
                )}

                {result.status === 'HIGH' && (
                  <div className="mt-4 pt-4 border-t border-yellow-200">
                    <div className="text-sm text-yellow-900 font-semibold mb-2">
                      Recommendations:
                    </div>
                    <ul className="text-xs text-yellow-800 space-y-1 list-disc list-inside">
                      <li>Service can handle load but has limited future capacity</li>
                      <li>Consider service upgrade now to avoid future issues</li>
                      <li>Monitor total load to stay below {currentServiceAmps}A continuous</li>
                      <li>For 3+ EV chargers, consider EVEMS load management</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* NEC Compliance Note */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2 text-sm">NEC References</h4>
                <div className="text-xs text-gray-700 space-y-1">
                  <div>• NEC 230.42 - Service Conductor Sizing</div>
                  <div>• NEC 210.19 - Continuous Load (80% rule)</div>
                  <div>• NEC 625.41 - EV Charger Continuous Load (125% factor)</div>
                </div>
              </div>

              {/* Calculation Details */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2 text-sm">Calculation Details</h4>
                <div className="text-xs text-blue-800 space-y-1">
                  <div>Service Capacity: {currentServiceAmps}A</div>
                  <div>Current Usage: {currentUsageAmps}A ({Math.round((currentUsageAmps / currentServiceAmps * 100) * 10) / 10}%)</div>
                  {proposedLoadAmps > 0 && (
                    <>
                      <div>Proposed Additional Load: {proposedLoadAmps}A</div>
                      <div>Total Future Load: {result.totalAmps}A ({result.utilizationPercent}%)</div>
                      <div>Available Capacity: {result.availableAmps}A</div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
