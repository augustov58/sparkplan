/**
 * Multi-Family EV Readiness Calculator Component
 * NEC 220.84 + NEC 220.57 + NEC 625.42
 *
 * Automates the $2-10K engineering calculation for multi-family EV charging.
 * Forum-validated feature addressing the complexity contractors are turning away.
 */

import React, { useState, useMemo } from 'react';
import {
  Building2,
  Car,
  Zap,
  AlertTriangle,
  CheckCircle,
  Info,
  TrendingUp,
  DollarSign,
  Settings,
  Battery,
  FileDown,
  Loader
} from 'lucide-react';
import {
  calculateMultiFamilyEV,
  quickMultiFamilyEVCheck,
  type MultiFamilyEVInput,
  type MultiFamilyEVResult
} from '../services/calculations/multiFamilyEV';
import { exportMultiFamilyEVAnalysis } from '../services/pdfExport/multiFamilyEVPDF';

interface MultiFamilyEVCalculatorProps {
  projectId?: string;
}

export const MultiFamilyEVCalculator: React.FC<MultiFamilyEVCalculatorProps> = ({ projectId }) => {
  // Building profile state
  const [buildingName, setBuildingName] = useState('');
  const [dwellingUnits, setDwellingUnits] = useState(20);
  const [avgUnitSqFt, setAvgUnitSqFt] = useState(900);
  const [voltage, setVoltage] = useState<120 | 208 | 240 | 277 | 480>(208);
  const [phase, setPhase] = useState<1 | 3>(3);
  const [existingServiceAmps, setExistingServiceAmps] = useState(800);

  // EV charger configuration
  const [evChargerCount, setEvChargerCount] = useState(20);
  const [evChargerLevel, setEvChargerLevel] = useState<'Level1' | 'Level2'>('Level2');
  const [evAmpsPerCharger, setEvAmpsPerCharger] = useState(48);

  // Building details
  const [hasElectricHeat, setHasElectricHeat] = useState(false);
  const [hasElectricCooking, setHasElectricCooking] = useState(true);
  const [commonAreaLoadVA, setCommonAreaLoadVA] = useState(15000);

  // Optional transformer info
  const [hasTransformer, setHasTransformer] = useState(false);
  const [transformerKVA, setTransformerKVA] = useState(500);

  // EVEMS toggle
  const [useEVEMS, setUseEVEMS] = useState(false);

  // Quick check mode
  const [mode, setMode] = useState<'quick' | 'detailed'>('detailed');

  // PDF export state
  const [isExporting, setIsExporting] = useState(false);

  // Calculate results
  const result = useMemo<MultiFamilyEVResult | null>(() => {
    try {
      const input: MultiFamilyEVInput = {
        buildingName: buildingName || undefined,
        dwellingUnits,
        avgUnitSqFt,
        voltage,
        phase,
        existingServiceAmps,
        evChargers: {
          count: evChargerCount,
          level: evChargerLevel,
          ampsPerCharger: evAmpsPerCharger,
        },
        hasElectricHeat,
        hasElectricCooking,
        commonAreaLoadVA,
        transformer: hasTransformer ? { kvaRating: transformerKVA } : undefined,
        useEVEMS,
      };

      return calculateMultiFamilyEV(input);
    } catch (err) {
      console.error('Multi-Family EV calculation error:', err);
      return null;
    }
  }, [
    buildingName, dwellingUnits, avgUnitSqFt, voltage, phase, existingServiceAmps,
    evChargerCount, evChargerLevel, evAmpsPerCharger,
    hasElectricHeat, hasElectricCooking, commonAreaLoadVA,
    hasTransformer, transformerKVA, useEVEMS
  ]);

  // Quick check for header summary
  const quickCheck = useMemo(() => {
    return quickMultiFamilyEVCheck(
      dwellingUnits,
      avgUnitSqFt,
      existingServiceAmps,
      evChargerCount,
      evAmpsPerCharger,
      voltage,
      phase
    );
  }, [dwellingUnits, avgUnitSqFt, existingServiceAmps, evChargerCount, evAmpsPerCharger, voltage, phase]);

  // Handle PDF export
  const handleExportPDF = async () => {
    if (!result) return;

    setIsExporting(true);
    try {
      await exportMultiFamilyEVAnalysis(
        result,
        buildingName || `${dwellingUnits}-Unit Building`,
        undefined, // preparedBy - could add a field for this
        undefined  // preparedFor - could add a field for this
      );
    } catch (error) {
      console.error('Failed to export PDF:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Get status color for utilization
  const getStatusColor = (percent: number) => {
    if (percent > 100) return 'red';
    if (percent > 90) return 'orange';
    if (percent > 80) return 'yellow';
    return 'green';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Building2 className="w-6 h-6 text-electric-500" />
          Multi-Family EV Readiness Calculator
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          NEC 220.84 + NEC 220.57 + NEC 625.42 - Determine EV charging capacity for apartment buildings
        </p>
      </div>

      {/* Quick Summary Banner */}
      {quickCheck && (
        <div className={`border-2 rounded-lg p-4 ${
          quickCheck.canSupport
            ? 'bg-green-50 border-green-300'
            : 'bg-yellow-50 border-yellow-300'
        }`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              {result ? (
                // Use detailed result when available
                result.scenarios.noEVEMS.maxChargers >= evChargerCount ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : result.scenarios.withEVEMS.maxChargers >= evChargerCount ? (
                  <CheckCircle className="w-6 h-6 text-blue-600" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-yellow-600" />
                )
              ) : quickCheck.canSupport ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              )}
              <div>
                <div className="font-semibold text-gray-900">
                  {result ? (
                    result.scenarios.noEVEMS.maxChargers >= evChargerCount
                      ? `✓ Can support all ${evChargerCount} chargers (direct connection)`
                      : result.scenarios.withEVEMS.maxChargers >= evChargerCount
                        ? `✓ Can support all ${evChargerCount} chargers with EVEMS`
                        : `Max ${result.scenarios.noEVEMS.maxChargers} direct, ${result.scenarios.withEVEMS.maxChargers} with EVEMS`
                  ) : quickCheck.canSupport
                    ? `Can support all ${evChargerCount} chargers`
                    : `Max ${quickCheck.maxChargersWithoutUpgrade} chargers without upgrade`}
                </div>
                <div className="text-xs text-gray-600">
                  {result ? (
                    result.scenarios.noEVEMS.maxChargers >= evChargerCount
                      ? 'No load management required - each EVSE at full power'
                      : result.scenarios.withEVEMS.maxChargers >= evChargerCount
                        ? 'EVEMS load sharing required per NEC 625.42'
                        : 'Service upgrade recommended for full capacity'
                  ) : quickCheck.recommendation}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">
                {result ? result.serviceAnalysis.utilizationPercent : quickCheck.utilizationPercent}%
              </div>
              <div className="text-xs text-gray-500">Service Utilization (w/EV)</div>
            </div>
          </div>
        </div>
      )}

      {/* Mode Toggle */}
      <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
        <button
          onClick={() => setMode('detailed')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'detailed'
              ? 'bg-electric-500 text-black'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          Detailed Analysis
        </button>
        <button
          onClick={() => setMode('quick')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'quick'
              ? 'bg-electric-500 text-black'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          Quick Check
        </button>
        <div className="ml-auto text-xs text-gray-500 flex items-center gap-1">
          <Info className="w-4 h-4" />
          Forum-validated feature for contractors
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ===== LEFT COLUMN: INPUTS ===== */}
        <div className="space-y-6">
          {/* Building Profile */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
            <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-electric-500" />
              Building Profile
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Building Name (Optional)
                </label>
                <input
                  type="text"
                  value={buildingName}
                  onChange={e => setBuildingName(e.target.value)}
                  placeholder="e.g., Sunset Apartments"
                  className="w-full border-gray-200 rounded text-sm py-2 px-3 focus:border-electric-500 focus:ring-electric-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Dwelling Units
                </label>
                <input
                  type="number"
                  value={dwellingUnits}
                  onChange={e => setDwellingUnits(Number(e.target.value))}
                  min="3"
                  max="500"
                  className="w-full border-gray-200 rounded text-sm py-2 px-3 focus:border-electric-500 focus:ring-electric-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Avg. Unit Sq Ft
                </label>
                <input
                  type="number"
                  value={avgUnitSqFt}
                  onChange={e => setAvgUnitSqFt(Number(e.target.value))}
                  min="400"
                  max="3000"
                  step="50"
                  className="w-full border-gray-200 rounded text-sm py-2 px-3 focus:border-electric-500 focus:ring-electric-500"
                />
              </div>
            </div>
          </div>

          {/* Service Details */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
            <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-electric-500" />
              Existing Service
            </h4>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Service (A)
                </label>
                <select
                  value={existingServiceAmps}
                  onChange={e => setExistingServiceAmps(Number(e.target.value))}
                  className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
                >
                  <option value="200">200A</option>
                  <option value="400">400A</option>
                  <option value="600">600A</option>
                  <option value="800">800A</option>
                  <option value="1000">1000A</option>
                  <option value="1200">1200A</option>
                  <option value="1600">1600A</option>
                  <option value="2000">2000A</option>
                  <option value="2500">2500A</option>
                  <option value="3000">3000A</option>
                  <option value="4000">4000A</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Voltage (V)
                </label>
                <select
                  value={voltage}
                  onChange={e => setVoltage(Number(e.target.value) as 120 | 208 | 240 | 277 | 480)}
                  className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
                >
                  <option value="208">208V</option>
                  <option value="240">240V</option>
                  <option value="480">480V</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Phase
                </label>
                <select
                  value={phase}
                  onChange={e => setPhase(Number(e.target.value) as 1 | 3)}
                  className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
                >
                  <option value="1">1-Phase</option>
                  <option value="3">3-Phase</option>
                </select>
              </div>
            </div>
          </div>

          {/* EV Chargers */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
            <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <Car className="w-4 h-4 text-blue-600" />
              EV Charger Requirements
            </h4>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  # of Chargers
                </label>
                <input
                  type="number"
                  value={evChargerCount}
                  onChange={e => setEvChargerCount(Number(e.target.value))}
                  min="1"
                  max="500"
                  className="w-full border-gray-200 rounded text-sm py-2 px-3 focus:border-electric-500 focus:ring-electric-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Level
                </label>
                <select
                  value={evChargerLevel}
                  onChange={e => setEvChargerLevel(e.target.value as 'Level1' | 'Level2')}
                  className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
                >
                  <option value="Level1">Level 1 (120V)</option>
                  <option value="Level2">Level 2 (208/240V)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Amps/Charger
                </label>
                <select
                  value={evAmpsPerCharger}
                  onChange={e => setEvAmpsPerCharger(Number(e.target.value))}
                  className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
                >
                  {evChargerLevel === 'Level1' ? (
                    <>
                      <option value="12">12A (1.4 kW)</option>
                      <option value="16">16A (1.9 kW)</option>
                    </>
                  ) : (
                    <>
                      <option value="16">16A (~3.3 kW @ 208V)</option>
                      <option value="24">24A (~5.0 kW @ 208V)</option>
                      <option value="32">32A (~6.7 kW @ 208V)</option>
                      <option value="40">40A (~8.3 kW @ 208V)</option>
                      <option value="48">48A (~10.0 kW @ 208V)</option>
                      <option value="80">80A (~16.6 kW @ 208V)</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* EVEMS Toggle */}
            <div className="pt-3 border-t border-blue-200">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useEVEMS"
                  checked={useEVEMS}
                  onChange={e => setUseEVEMS(e.target.checked)}
                  className="rounded border-gray-300 text-electric-500 focus:ring-electric-500"
                />
                <label htmlFor="useEVEMS" className="font-semibold text-gray-900 text-sm cursor-pointer">
                  Include EVEMS Analysis (NEC 625.42)
                </label>
              </div>
              <p className="text-xs text-blue-700 mt-1 ml-5">
                EVEMS can increase charger capacity by sharing available power
              </p>
            </div>
          </div>

          {mode === 'detailed' && (
            <>
              {/* Building Load Details */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
                <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                  <Settings className="w-4 h-4 text-gray-600" />
                  Building Load Details
                </h4>

                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasElectricHeat}
                      onChange={e => setHasElectricHeat(e.target.checked)}
                      className="rounded border-gray-300 text-electric-500 focus:ring-electric-500"
                    />
                    <span className="text-sm text-gray-700">Electric Heat (65% demand factor)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasElectricCooking}
                      onChange={e => setHasElectricCooking(e.target.checked)}
                      className="rounded border-gray-300 text-electric-500 focus:ring-electric-500"
                    />
                    <span className="text-sm text-gray-700">Electric Cooking (12 kW/unit nameplate)</span>
                  </label>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                      Common Area Load (VA)
                    </label>
                    <input
                      type="number"
                      value={commonAreaLoadVA}
                      onChange={e => setCommonAreaLoadVA(Number(e.target.value))}
                      min="0"
                      step="1000"
                      className="w-full border-gray-200 rounded text-sm py-2 px-3 focus:border-electric-500 focus:ring-electric-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Lighting, elevators, pool, gym, etc.</p>
                  </div>
                </div>
              </div>

              {/* Transformer Info */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hasTransformer"
                    checked={hasTransformer}
                    onChange={e => setHasTransformer(e.target.checked)}
                    className="rounded border-gray-300 text-electric-500 focus:ring-electric-500"
                  />
                  <label htmlFor="hasTransformer" className="font-semibold text-gray-900 text-sm cursor-pointer flex items-center gap-2">
                    <Battery className="w-4 h-4 text-gray-600" />
                    Include Transformer Capacity Check
                  </label>
                </div>

                {hasTransformer && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                      Transformer Rating (kVA)
                    </label>
                    <select
                      value={transformerKVA}
                      onChange={e => setTransformerKVA(Number(e.target.value))}
                      className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
                    >
                      <option value="150">150 kVA</option>
                      <option value="225">225 kVA</option>
                      <option value="300">300 kVA</option>
                      <option value="500">500 kVA</option>
                      <option value="750">750 kVA</option>
                      <option value="1000">1000 kVA</option>
                      <option value="1500">1500 kVA</option>
                      <option value="2000">2000 kVA</option>
                      <option value="2500">2500 kVA</option>
                    </select>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ===== RIGHT COLUMN: RESULTS ===== */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-gray-900">Analysis Results</h4>
            {result && (
              <button
                onClick={handleExportPDF}
                disabled={isExporting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-electric-500 text-black rounded hover:bg-electric-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? (
                  <>
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <FileDown className="w-3.5 h-3.5" />
                    Export PDF
                  </>
                )}
              </button>
            )}
          </div>

          {result ? (
            <>
              {/* Service Capacity Summary */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Building Demand:</span>
                    <div className="text-2xl font-bold text-blue-700 mt-1">
                      {result.buildingLoad.buildingLoadAmps} A
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {(result.buildingLoad.buildingDemandVA / 1000).toFixed(1)} kVA @ {(result.buildingLoad.buildingDemandFactor * 100).toFixed(0)}% DF
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">EV Load (NEC 220.57):</span>
                    <div className="text-2xl font-bold text-green-700 mt-1">
                      {result.evLoad.loadAmps} A
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {(result.evLoad.demandVA / 1000).toFixed(1)} kVA (full connected load)
                    </div>
                  </div>
                </div>
              </div>

              {/* Service Utilization Gauge */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">Service Utilization</span>
                  <span className={`text-2xl font-bold ${
                    result.serviceAnalysis.utilizationPercent > 100 ? 'text-red-700' :
                    result.serviceAnalysis.utilizationPercent > 90 ? 'text-orange-700' :
                    result.serviceAnalysis.utilizationPercent > 80 ? 'text-yellow-700' :
                    'text-green-700'
                  }`}>
                    {result.serviceAnalysis.utilizationPercent}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className={`h-4 rounded-full transition-all ${
                      result.serviceAnalysis.utilizationPercent > 100 ? 'bg-red-600' :
                      result.serviceAnalysis.utilizationPercent > 90 ? 'bg-orange-500' :
                      result.serviceAnalysis.utilizationPercent > 80 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(result.serviceAnalysis.utilizationPercent, 100)}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-xs text-gray-600">
                  <div>Building: {result.buildingLoad.buildingLoadAmps}A</div>
                  <div>EV: {result.evLoad.loadAmps}A</div>
                  <div>Total: {result.serviceAnalysis.totalDemandAmps}A / {result.serviceAnalysis.existingCapacityAmps}A</div>
                </div>
              </div>

              {/* Scenario Comparison */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-4 text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  EV Capacity Scenarios
                </h4>

                <div className="space-y-3">
                  {/* Scenario A: No EVEMS */}
                  <div className={`border rounded-lg p-3 ${
                    result.scenarios.noEVEMS.maxChargers >= evChargerCount
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-200 bg-white'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900 text-sm">{result.scenarios.noEVEMS.name}</div>
                        <div className="text-xs text-gray-500">Direct connection, no load management</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-gray-900">{result.scenarios.noEVEMS.maxChargers}</div>
                        <div className="text-xs text-gray-500">max chargers</div>
                      </div>
                    </div>
                    {result.scenarios.noEVEMS.maxChargers < evChargerCount && (
                      <div className="text-xs text-orange-700 mt-2 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Cannot accommodate all {evChargerCount} requested chargers
                      </div>
                    )}
                  </div>

                  {/* Scenario B: With EVEMS */}
                  <div className={`border rounded-lg p-3 ${
                    result.scenarios.withEVEMS.maxChargers >= evChargerCount
                      ? 'border-green-300 bg-green-50'
                      : 'border-blue-200 bg-blue-50'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900 text-sm">{result.scenarios.withEVEMS.name}</div>
                        <div className="text-xs text-gray-500">
                          {result.scenarios.withEVEMS.powerPerCharger_kW
                            ? `~${result.scenarios.withEVEMS.powerPerCharger_kW.toFixed(1)} kW per charger when sharing`
                            : 'Dynamic power sharing'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-blue-700">{result.scenarios.withEVEMS.maxChargers}</div>
                        <div className="text-xs text-gray-500">max chargers</div>
                      </div>
                    </div>
                    {result.scenarios.withEVEMS.maxChargers > result.scenarios.noEVEMS.maxChargers && (
                      <div className="text-xs text-blue-700 mt-2 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        +{result.scenarios.withEVEMS.maxChargers - result.scenarios.noEVEMS.maxChargers} more chargers vs. direct connection
                      </div>
                    )}
                  </div>

                  {/* Scenario C: With Upgrade */}
                  <div className="border border-gray-200 bg-white rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900 text-sm">{result.scenarios.withUpgrade.name}</div>
                        <div className="text-xs text-gray-500">
                          Upgrade to {result.scenarios.withUpgrade.recommendedServiceAmps}A service
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-gray-900">{result.scenarios.withUpgrade.maxChargers}</div>
                        <div className="text-xs text-gray-500">max chargers</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cost Comparison */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3 text-sm flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Estimated Cost Comparison
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 font-semibold text-gray-700">Scenario</th>
                        <th className="text-center py-2 font-semibold text-gray-700">Chargers</th>
                        <th className="text-right py-2 font-semibold text-gray-700">Est. Cost Range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.costComparison.map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-100">
                          <td className="py-2 text-gray-900">{item.scenario}</td>
                          <td className="py-2 text-center text-gray-700">{item.maxChargers}</td>
                          <td className="py-2 text-right text-gray-700">
                            ${item.estimatedCostLow.toLocaleString()} - ${item.estimatedCostHigh.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-500 mt-2 italic">
                  Estimates include equipment and installation. Actual costs vary by location.
                </p>
              </div>

              {/* Transformer Check */}
              {result.transformerCheck && (
                <div className={`border rounded-lg p-4 ${
                  result.transformerCheck.status === 'red' ? 'bg-red-50 border-red-200' :
                  result.transformerCheck.status === 'yellow' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-green-50 border-green-200'
                }`}>
                  <h4 className="font-semibold text-gray-900 mb-2 text-sm flex items-center gap-2">
                    <Battery className="w-4 h-4" />
                    Transformer Capacity Check
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-gray-600">Transformer Capacity</div>
                      <div className="font-bold">{result.transformerCheck.transformerCapacityAmps}A</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Utilization</div>
                      <div className={`font-bold ${
                        result.transformerCheck.status === 'red' ? 'text-red-700' :
                        result.transformerCheck.status === 'yellow' ? 'text-yellow-700' :
                        'text-green-700'
                      }`}>{result.transformerCheck.utilizationPercent}%</div>
                    </div>
                  </div>
                  <p className={`text-xs mt-2 ${
                    result.transformerCheck.status === 'red' ? 'text-red-700' :
                    result.transformerCheck.status === 'yellow' ? 'text-yellow-700' :
                    'text-green-700'
                  }`}>
                    {result.transformerCheck.recommendation}
                  </p>
                </div>
              )}

              {/* Phase Balance (3-phase only) */}
              {result.phaseBalance && (
                <div className={`border rounded-lg p-4 ${
                  result.phaseBalance.isAcceptable ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
                }`}>
                  <h4 className="font-semibold text-gray-900 mb-2 text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    3-Phase Load Balance
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div>
                      <div className="text-xs text-gray-600">Phase A</div>
                      <div className="font-bold">{result.phaseBalance.phaseLoads.phaseA}A</div>
                      <div className="text-xs text-gray-500">{result.phaseBalance.chargerDistribution.phaseA} chargers</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Phase B</div>
                      <div className="font-bold">{result.phaseBalance.phaseLoads.phaseB}A</div>
                      <div className="text-xs text-gray-500">{result.phaseBalance.chargerDistribution.phaseB} chargers</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Phase C</div>
                      <div className="font-bold">{result.phaseBalance.phaseLoads.phaseC}A</div>
                      <div className="text-xs text-gray-500">{result.phaseBalance.chargerDistribution.phaseC} chargers</div>
                    </div>
                  </div>
                  <div className={`text-xs mt-2 flex items-center gap-1 ${
                    result.phaseBalance.isAcceptable ? 'text-green-700' : 'text-yellow-700'
                  }`}>
                    {result.phaseBalance.isAcceptable ? (
                      <CheckCircle className="w-3 h-3" />
                    ) : (
                      <AlertTriangle className="w-3 h-3" />
                    )}
                    Imbalance: {result.phaseBalance.imbalancePercent}% ({result.phaseBalance.isAcceptable ? 'Acceptable' : 'Exceeds 15% recommendation'})
                  </div>
                </div>
              )}

              {/* Compliance & Warnings */}
              <div className={`border rounded-lg p-4 ${
                result.compliance.isCompliant ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
              }`}>
                <div className="flex items-center gap-2 mb-3">
                  {result.compliance.isCompliant ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  )}
                  <span className="font-semibold text-gray-900 text-sm">
                    {result.compliance.isCompliant ? 'NEC Compliant Design' : 'Action Required'}
                  </span>
                </div>

                {result.compliance.warnings.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs font-semibold text-gray-700 mb-1">Warnings:</div>
                    <ul className="text-xs text-orange-700 space-y-1">
                      {result.compliance.warnings.map((warning, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          {warning}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.compliance.recommendations.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs font-semibold text-gray-700 mb-1">Recommendations:</div>
                    <ul className="text-xs text-blue-700 space-y-1">
                      {result.compliance.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="text-xs text-gray-600 pt-2 border-t border-gray-200">
                  <strong>NEC Articles:</strong> {result.compliance.necArticles.join(', ')}
                </div>
              </div>

              {mode === 'detailed' && (
                /* Load Breakdown */
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3 text-sm">Load Breakdown (NEC 220.84)</h4>
                  <div className="space-y-2 text-xs">
                    {result.buildingLoad.breakdown.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1 border-b border-gray-200 last:border-0">
                        <div>
                          <span className="font-medium text-gray-900">{item.category}</span>
                          <span className="text-gray-500 ml-2">{item.necReference}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-medium text-gray-900">
                            {(item.demandVA / 1000).toFixed(1)} kVA
                          </span>
                          {item.demandFactor < 1 && (
                            <span className="text-gray-500 ml-1">
                              ({(item.demandFactor * 100).toFixed(0)}%)
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-2 border-t-2 border-gray-300 font-bold">
                      <span>Total Building Demand</span>
                      <span className="text-electric-600">
                        {(result.buildingLoad.buildingDemandVA / 1000).toFixed(1)} kVA ({result.buildingLoad.buildingLoadAmps}A)
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p>Enter building details to see analysis results</p>
            </div>
          )}
        </div>
      </div>

      {/* Educational Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Info className="w-4 h-4" />
          Understanding Multi-Family EV Calculations
        </h4>
        <div className="text-sm text-gray-700 space-y-3">
          <p>
            <strong>NEC 220.84 - Multi-Family Demand Factors:</strong> For buildings with 3+ dwelling units,
            NEC allows significant demand factors (23-45%) on unit loads, recognizing that not all loads operate simultaneously.
          </p>
          <p>
            <strong>NEC 220.57 - Per-EVSE Load (2023 NEC):</strong> Specifies that each EVSE load shall be
            calculated as the larger of 7,200 VA or the nameplate rating. This does NOT provide demand factors
            for multiple EVSEs - the full connected load must be used without EVEMS.
          </p>
          <p>
            <strong>NEC 625.42 - EVEMS:</strong> Electric Vehicle Energy Management Systems allow sizing
            the service/feeder to the EVEMS setpoint instead of the full connected load. This is the NEC-compliant
            way to add more chargers than direct connection would allow.
          </p>
          <div className="mt-4 bg-white rounded p-3 border border-blue-200">
            <strong>Why This Matters:</strong> This calculator automates calculations that typically cost
            $2,000-$10,000 for engineering analysis. Contractors report turning down $10K-$50K jobs
            because the complexity was too high - this tool makes those jobs accessible.
          </div>
        </div>
      </div>
    </div>
  );
};
