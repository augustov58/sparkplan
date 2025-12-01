/**
 * Conductor Sizing Tool Component
 * Interactive tool for sizing conductors with NEC correction factors
 */

import React, { useState } from 'react';
import { Cable, AlertTriangle, CheckCircle } from 'lucide-react';
import { sizeConductor, quickSizeConductor } from '../services/calculations';
import { ProjectSettings } from '../types';

interface ConductorSizingToolProps {
  projectSettings: ProjectSettings;
}

export const ConductorSizingTool: React.FC<ConductorSizingToolProps> = ({ projectSettings }) => {
  const [loadAmps, setLoadAmps] = useState(40);
  const [ambientTempC, setAmbientTempC] = useState(30);
  const [numConductors, setNumConductors] = useState(3);
  const [isContinuous, setIsContinuous] = useState(true);
  const [useQuickMode, setUseQuickMode] = useState(false);
  const [quickScenario, setQuickScenario] = useState<'indoor_standard' | 'outdoor_hot' | 'attic' | 'underground' | 'high_density_conduit'>('indoor_standard');

  let result;
  let error: string | null = null;

  try {
    if (useQuickMode) {
      result = quickSizeConductor(loadAmps, projectSettings, quickScenario);
    } else {
      result = sizeConductor(loadAmps, projectSettings, ambientTempC, numConductors, isContinuous);
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Unknown error';
    result = null;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-light text-gray-900 flex items-center gap-2">
          <Cable className="w-6 h-6 text-electric-500" />
          Conductor Sizing Tool
        </h2>
        <p className="text-gray-500 mt-1">NEC Article 310 compliant with temperature and bundling corrections</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-4">Parameters</h3>

          {/* Quick Mode Toggle */}
          <div className="mb-6 pb-4 border-b border-gray-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useQuickMode}
                onChange={e => setUseQuickMode(e.target.checked)}
                className="rounded border-gray-300 text-electric-500 focus:ring-electric-500"
              />
              <span className="text-sm text-gray-700 font-medium">Quick Mode (Common Scenarios)</span>
            </label>
          </div>

          {useQuickMode ? (
            /* Quick Mode - Scenario Selection */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                  Installation Scenario
                </label>
                <select
                  value={quickScenario}
                  onChange={e => setQuickScenario(e.target.value as any)}
                  className="w-full border-gray-200 rounded-md focus:border-electric-500 focus:ring-electric-500 text-sm py-2"
                >
                  <option value="indoor_standard">Indoor Standard (30°C, 3 conductors)</option>
                  <option value="outdoor_hot">Outdoor Hot (40°C, 3 conductors)</option>
                  <option value="attic">Attic Space (50°C, 3 conductors)</option>
                  <option value="underground">Underground (20°C, 3 conductors)</option>
                  <option value="high_density_conduit">High Density Conduit (30°C, 12 conductors)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                  Load Current (A)
                </label>
                <input
                  type="number"
                  value={loadAmps}
                  onChange={e => setLoadAmps(Number(e.target.value))}
                  className="w-full border-gray-200 rounded-md focus:border-electric-500 focus:ring-electric-500 text-sm py-2"
                  min="1"
                />
              </div>
            </div>
          ) : (
            /* Advanced Mode - Full Control */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                  Load Current (A)
                </label>
                <input
                  type="number"
                  value={loadAmps}
                  onChange={e => setLoadAmps(Number(e.target.value))}
                  className="w-full border-gray-200 rounded-md focus:border-electric-500 focus:ring-electric-500 text-sm py-2"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                  Ambient Temperature (°C)
                </label>
                <input
                  type="number"
                  value={ambientTempC}
                  onChange={e => setAmbientTempC(Number(e.target.value))}
                  className="w-full border-gray-200 rounded-md focus:border-electric-500 focus:ring-electric-500 text-sm py-2"
                  min="10"
                  max="80"
                />
                <p className="text-xs text-gray-500 mt-1">NEC 310.15(B)(1): 10°C - 80°C</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                  Current-Carrying Conductors
                </label>
                <input
                  type="number"
                  value={numConductors}
                  onChange={e => setNumConductors(Number(e.target.value))}
                  className="w-full border-gray-200 rounded-md focus:border-electric-500 focus:ring-electric-500 text-sm py-2"
                  min="1"
                  max="50"
                />
                <p className="text-xs text-gray-500 mt-1">NEC 310.15(C)(1): Bundle adjustment</p>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isContinuous}
                    onChange={e => setIsContinuous(e.target.checked)}
                    className="rounded border-gray-300 text-electric-500 focus:ring-electric-500"
                  />
                  <span className="text-sm text-gray-700">Continuous Load (≥3 hours)</span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">125% multiplier per NEC 210.19(A)(1)</p>
              </div>
            </div>
          )}

          {/* Project Settings Display */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="text-xs text-gray-500 space-y-1">
              <div><strong>Material:</strong> {projectSettings.conductorMaterial === 'Cu' ? 'Copper' : 'Aluminum'}</div>
              <div><strong>Insulation:</strong> {projectSettings.temperatureRating}°C</div>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="space-y-6">
          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-800">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">Error</p>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            </div>
          ) : result ? (
            <>
              {/* Main Result Card */}
              <div className="bg-electric-50 border border-electric-200 rounded-lg p-8">
                <div className="text-center mb-6">
                  <div className="text-sm text-electric-700 uppercase tracking-wide mb-2">Required Conductor Size</div>
                  <div className="text-5xl font-bold text-gray-900 mb-4">{result.conductorSize}</div>

                  <div className="flex justify-center">
                    <div className="flex items-center gap-2 text-green-700 bg-green-100 px-6 py-2 rounded-full text-sm font-bold">
                      <CheckCircle className="w-5 h-5" />
                      NEC Compliant
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div className="bg-white rounded p-3 border border-electric-100">
                    <div className="text-xs text-gray-500 mb-1">Base Ampacity</div>
                    <div className="text-xl font-bold text-gray-900">{result.baseAmpacity} A</div>
                  </div>
                  <div className="bg-white rounded p-3 border border-electric-100">
                    <div className="text-xs text-gray-500 mb-1">Adjusted Ampacity</div>
                    <div className="text-xl font-bold text-gray-900">{result.adjustedAmpacity} A</div>
                  </div>
                </div>

                {/* EGC Size Display */}
                <div className="bg-green-50 border border-green-200 rounded p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-green-700 font-semibold uppercase tracking-wider mb-1">
                        Equipment Grounding Conductor (EGC)
                      </div>
                      <div className="text-2xl font-bold text-green-900">
                        {result.egcSize} AWG {projectSettings.conductorMaterial}
                      </div>
                      {result.egcUpsized && (
                        <div className="text-xs text-green-600 mt-1">
                          ✓ Proportionally upsized per NEC 250.122(B)
                        </div>
                      )}
                    </div>
                    <div className="text-green-500">
                      <CheckCircle className="w-8 h-8" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className="space-y-2">
                  {result.warnings.map((warning, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 text-sm text-orange-800 bg-orange-50 p-4 rounded-lg border border-orange-200"
                    >
                      <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Calculation Breakdown */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-bold text-gray-900 mb-4">Calculation Breakdown</h4>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Load Current</span>
                    <span className="font-mono font-semibold text-gray-900">{loadAmps} A</span>
                  </div>

                  {result.continuousLoadFactor > 1 && (
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600">Continuous Factor (125%)</span>
                      <span className="font-mono font-semibold text-gray-900">{result.continuousLoadFactor}×</span>
                    </div>
                  )}

                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Required Ampacity</span>
                    <span className="font-mono font-semibold text-gray-900">{result.requiredAmpacity} A</span>
                  </div>

                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Temperature Correction</span>
                    <span className="font-mono font-semibold text-gray-900">{(result.baseTempCorrection * 100).toFixed(0)}%</span>
                  </div>

                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Bundling Adjustment</span>
                    <span className="font-mono font-semibold text-gray-900">{(result.bundlingAdjustment * 100).toFixed(0)}%</span>
                  </div>

                  <div className="flex justify-between py-2 pt-3 border-t-2 border-gray-300">
                    <span className="text-gray-900 font-bold">Selected Conductor</span>
                    <span className="font-mono font-bold text-electric-600 text-lg">{result.conductorSize}</span>
                  </div>

                  <div className="flex justify-between py-2 bg-green-50 -mx-6 px-6 -mb-3">
                    <span className="text-green-900 font-bold">Equipment Grounding Conductor</span>
                    <span className="font-mono font-bold text-green-600 text-lg">
                      {result.egcSize} AWG {result.egcUpsized && '(Upsized)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* NEC References */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm font-bold text-blue-900 mb-2">NEC References</div>
                <ul className="space-y-1 text-xs text-blue-800">
                  {result.necReferences.map((ref, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span>{ref}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
