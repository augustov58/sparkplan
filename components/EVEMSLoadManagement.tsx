/**
 * EVEMS Load Management Calculator Component
 * NEC 625.42 - Electric Vehicle Energy Management System
 */

import React, { useState } from 'react';
import { Zap, Plus, Trash2, AlertTriangle, CheckCircle, Info, TrendingUp } from 'lucide-react';
import { calculateEVEMSLoadManagement, type EVEMSInput, type EVEMSResult } from '../services/calculations/evemsLoadManagement';
import { EV_CHARGER_SPECS, type EVChargerLevel } from '../services/calculations/evCharging';
import { EVEMSDiagram } from './EVEMSDiagram';

export const EVEMSLoadManagement: React.FC = () => {
  const [serviceAmps, setServiceAmps] = useState(200);
  const [serviceVoltage, setServiceVoltage] = useState(240);
  const [servicePhase, setServicePhase] = useState<1 | 3>(1);
  const [existingLoad_kVA, setExistingLoad_kVA] = useState(30);
  const [existingDemand_kVA, setExistingDemand_kVA] = useState(24);
  const [useEVEMS, setUseEVEMS] = useState(false);
  const [evemsMode, setEvemsMode] = useState<'first_come_first_served' | 'priority_based' | 'round_robin'>('first_come_first_served');
  
  const [chargers, setChargers] = useState<Array<{
    id: string;
    level: EVChargerLevel;
    voltage: number;
    phase: 1 | 3;
    chargerAmps: number;
    quantity: number;
  }>>([
    { id: '1', level: 'Level2', voltage: 240, phase: 1, chargerAmps: 32, quantity: 1 }
  ]);

  // Calculate results
  let result: EVEMSResult | null = null;
  let error: string | null = null;

  try {
    result = calculateEVEMSLoadManagement({
      serviceAmps,
      serviceVoltage,
      servicePhase,
      existingLoad_kVA,
      existingDemand_kVA,
      evChargers: chargers.map(c => ({
        level: c.level,
        voltage: c.voltage,
        phase: c.phase,
        chargerAmps: c.chargerAmps,
        quantity: c.quantity,
      })),
      useEVEMS,
      evemsMode,
    });
  } catch (err) {
    error = err instanceof Error ? err.message : 'Calculation error';
  }

  const addCharger = () => {
    const newCharger = {
      id: Date.now().toString(),
      level: 'Level2' as EVChargerLevel,
      voltage: 240,
      phase: 1 as 1 | 3,
      chargerAmps: 32,
      quantity: 1,
    };
    setChargers([...chargers, newCharger]);
  };

  const removeCharger = (id: string) => {
    setChargers(chargers.filter(c => c.id !== id));
  };

  const updateCharger = (id: string, updates: Partial<typeof chargers[0]>) => {
    setChargers(chargers.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  // Calculate total number of chargers for diagram
  const totalChargers = chargers.reduce((sum, c) => sum + c.quantity, 0);
  const existingLoadPercent = result 
    ? Math.round((result.existingDemand_kVA / result.serviceCapacity_kVA) * 100)
    : 60;

  return (
    <div className="space-y-6">
      {/* System Diagram */}
      <EVEMSDiagram
        serviceAmps={serviceAmps}
        serviceVoltage={serviceVoltage}
        numChargers={totalChargers}
        evemsEnabled={useEVEMS}
        existingLoadPercent={existingLoadPercent}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="space-y-6">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#2d3b2d]" /> System Information
          </h3>

          {/* Service Information */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
            <h4 className="font-semibold text-gray-900 text-sm">Service Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Service Size (A)
                </label>
                <input
                  type="number"
                  value={serviceAmps}
                  onChange={e => setServiceAmps(Number(e.target.value))}
                  min="100"
                  max="2000"
                  step="25"
                  className="w-full border-gray-200 rounded text-sm py-2 px-3 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Voltage (V)
                </label>
                <select
                  value={serviceVoltage}
                  onChange={e => setServiceVoltage(Number(e.target.value))}
                  className="w-full border-gray-200 rounded text-sm py-2 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
                >
                  <option value="120">120V</option>
                  <option value="208">208V</option>
                  <option value="240">240V</option>
                  <option value="277">277V</option>
                  <option value="480">480V</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Phase
                </label>
                <select
                  value={servicePhase}
                  onChange={e => setServicePhase(Number(e.target.value) as 1 | 3)}
                  className="w-full border-gray-200 rounded text-sm py-2 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
                >
                  <option value="1">Single-Phase</option>
                  <option value="3">Three-Phase</option>
                </select>
              </div>
            </div>
          </div>

          {/* Existing Load */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
            <h4 className="font-semibold text-gray-900 text-sm">Existing Load</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Connected Load (kVA)
                </label>
                <input
                  type="number"
                  value={existingLoad_kVA}
                  onChange={e => setExistingLoad_kVA(Number(e.target.value))}
                  min="0"
                  step="0.1"
                  className="w-full border-gray-200 rounded text-sm py-2 px-3 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Demand Load (kVA)
                </label>
                <input
                  type="number"
                  value={existingDemand_kVA}
                  onChange={e => setExistingDemand_kVA(Number(e.target.value))}
                  min="0"
                  step="0.1"
                  className="w-full border-gray-200 rounded text-sm py-2 px-3 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
                />
                <p className="text-xs text-gray-400 mt-1">After demand factors</p>
              </div>
            </div>
          </div>

          {/* EV Chargers */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-900 text-sm">EV Chargers</h4>
              <button
                onClick={addCharger}
                className="text-xs bg-[#2d3b2d] text-black px-3 py-1.5 rounded font-medium hover:bg-[#3d4f3d] transition-colors flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Charger
              </button>
            </div>

            {chargers.map((charger, idx) => (
              <div key={charger.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">Charger {idx + 1}</span>
                  {chargers.length > 1 && (
                    <button
                      onClick={() => removeCharger(charger.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                      Level
                    </label>
                    <select
                      value={charger.level}
                      onChange={e => {
                        const level = e.target.value as EVChargerLevel;
                        const specs = EV_CHARGER_SPECS[level][0];
                        if (!specs) return;
                        updateCharger(charger.id, {
                          level,
                          voltage: specs.voltage,
                          phase: specs.phase,
                          chargerAmps: specs.maxAmps,
                        });
                      }}
                      className="w-full border-gray-200 rounded text-sm py-2 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
                    >
                      <option value="Level1">Level 1</option>
                      <option value="Level2">Level 2</option>
                      <option value="Level3_DCFC">Level 3 (DC Fast)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                      Charger Amps
                    </label>
                    <select
                      value={charger.chargerAmps}
                      onChange={e => updateCharger(charger.id, { chargerAmps: Number(e.target.value) })}
                      className="w-full border-gray-200 rounded text-sm py-2 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
                    >
                      {EV_CHARGER_SPECS[charger.level].map(spec => (
                        <option key={spec.maxAmps} value={spec.maxAmps}>
                          {spec.maxAmps}A ({spec.power_kw} kW)
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                      Voltage
                    </label>
                    <input
                      type="number"
                      value={charger.voltage}
                      onChange={e => updateCharger(charger.id, { voltage: Number(e.target.value) })}
                      className="w-full border-gray-200 rounded text-sm py-2 px-3 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                      Quantity
                    </label>
                    <input
                      type="number"
                      value={charger.quantity}
                      onChange={e => updateCharger(charger.id, { quantity: Number(e.target.value) })}
                      min="1"
                      max="100"
                      className="w-full border-gray-200 rounded text-sm py-2 px-3 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* EVEMS Options */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="useEVEMS"
                checked={useEVEMS}
                onChange={e => setUseEVEMS(e.target.checked)}
                className="rounded border-gray-300 text-[#2d3b2d] focus:ring-[#2d3b2d]/20"
              />
              <label htmlFor="useEVEMS" className="font-semibold text-gray-900 text-sm">
                Use EVEMS (EV Energy Management System)
              </label>
            </div>
            
            {useEVEMS && (
              <div className="ml-6 space-y-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Scheduling Mode
                </label>
                <select
                  value={evemsMode}
                  onChange={e => setEvemsMode(e.target.value as typeof evemsMode)}
                  className="w-full border-gray-200 rounded text-sm py-2 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
                >
                  <option value="first_come_first_served">First-Come-First-Served</option>
                  <option value="priority_based">Priority-Based</option>
                  <option value="round_robin">Round-Robin</option>
                </select>
                <p className="text-xs text-gray-600">
                  EVEMS monitors total load and adjusts EV charging to prevent service overload per NEC 625.42
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Results Section */}
        <div className="space-y-4">
          <h3 className="font-bold text-gray-900">Load Management Analysis</h3>

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
              {/* Service Capacity Summary */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Service Capacity:</span>
                    <div className="text-2xl font-bold text-blue-700 mt-1">
                      {result.serviceCapacity_kVA.toFixed(2)} kVA
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {serviceAmps}A {serviceVoltage}V {servicePhase}φ
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Available Capacity:</span>
                    <div className="text-2xl font-bold text-green-700 mt-1">
                      {result.availableCapacity_kVA.toFixed(2)} kVA
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      After existing load
                    </div>
                  </div>
                </div>
              </div>

              {/* Utilization Gauge */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">Service Utilization</span>
                  <span className={`text-2xl font-bold ${
                    result.serviceUtilizationPercent > 90 ? 'text-red-700' :
                    result.serviceUtilizationPercent > 80 ? 'text-orange-700' :
                    'text-green-700'
                  }`}>
                    {result.serviceUtilizationPercent.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      result.serviceUtilizationPercent > 90 ? 'bg-red-600' :
                      result.serviceUtilizationPercent > 80 ? 'bg-orange-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(result.serviceUtilizationPercent, 100)}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 text-xs text-gray-600">
                  <div>Existing: {result.existingDemand_kVA.toFixed(1)} kVA</div>
                  <div>EV Load: {result.evDemandLoad_kVA.toFixed(1)} kVA</div>
                  <div>Total: {result.totalSystemDemand_kVA.toFixed(1)} kVA</div>
                </div>
              </div>

              {/* EVEMS Recommendations */}
              {result.evemsRecommendations.evemsRequired && (
                <div className="bg-[#fff8e6] border border-[#c9a227]/40 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-[#9a7b00]" />
                    <span className="font-semibold text-[#5a4500]">EVEMS Recommended</span>
                  </div>
                  <p className="text-sm text-[#7a6200] mb-2">
                    Service capacity exceeded. EVEMS can reduce required capacity by up to{' '}
                    {result.evemsRecommendations.evemsBenefit_kVA.toFixed(1)} kVA.
                  </p>
                  {result.evemsRecommendations.schedulingStrategy && (
                    <p className="text-xs text-[#9a7b00] mt-2">
                      <strong>Strategy:</strong> {result.evemsRecommendations.schedulingStrategy}
                    </p>
                  )}
                </div>
              )}

              {/* Max Chargers Comparison */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3 text-sm">Maximum Chargers</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Without EVEMS</div>
                    <div className="text-xl font-bold text-gray-900">
                      {result.maxChargersWithoutEVEMS}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">With EVEMS</div>
                    <div className="text-xl font-bold text-green-700">
                      {result.maxChargersWithEVEMS}
                    </div>
                  </div>
                </div>
                {result.maxChargersWithEVEMS > result.maxChargersWithoutEVEMS && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-green-700">
                    <TrendingUp className="w-4 h-4" />
                    <span>EVEMS allows {result.maxChargersWithEVEMS - result.maxChargersWithoutEVEMS} additional chargers</span>
                  </div>
                )}
              </div>

              {/* Service Upgrade Recommendation */}
              {result.serviceUpgradeNeeded && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-red-700" />
                    <span className="font-semibold text-red-900">Service Upgrade Required</span>
                  </div>
                  <p className="text-sm text-red-800 mb-2">
                    Current service insufficient. Recommended service size:
                  </p>
                  {result.recommendedServiceAmps && (
                    <div className="text-2xl font-bold text-red-700">
                      {result.recommendedServiceAmps}A
                    </div>
                  )}
                </div>
              )}

              {/* Load Schedule */}
              {result.loadSchedule && result.loadSchedule.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3 text-sm flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Load Schedule (with EVEMS)
                  </h4>
                  <div className="space-y-3">
                    {result.loadSchedule.map((schedule, idx) => (
                      <div key={idx} className="border border-gray-200 rounded p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-gray-700">{schedule.timeSlot}</span>
                          <span className={`text-sm font-bold ${
                            schedule.utilizationPercent > 90 ? 'text-red-700' :
                            schedule.utilizationPercent > 80 ? 'text-orange-700' :
                            'text-green-700'
                          }`}>
                            {schedule.utilizationPercent.toFixed(1)}% utilized
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-gray-600">
                          <div>EV: {schedule.evCharging_kVA.toFixed(1)} kVA</div>
                          <div>Other: {schedule.otherLoads_kVA.toFixed(1)} kVA</div>
                          <div>Available: {schedule.availableCapacity_kVA.toFixed(1)} kVA</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Compliance */}
              <div className={`border rounded-lg p-4 ${
                result.compliance.compliant ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {result.compliance.compliant ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  )}
                  <span className="font-semibold text-sm text-gray-900">
                    {result.compliance.compliant ? 'Compliant' : 'Action Required'}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-2">{result.compliance.message}</p>
                <div className="text-xs text-gray-600">
                  <strong>NEC:</strong> {result.compliance.necArticle}
                </div>
                {result.compliance.warnings.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {result.compliance.warnings.map((warning, i) => (
                      <div key={i} className="text-xs text-red-700 flex items-start gap-2">
                        <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span>{warning}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              {result.evemsRecommendations.notes.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2 text-sm">Notes</h4>
                  <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                    {result.evemsRecommendations.notes.map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Educational Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Info className="w-4 h-4" />
          Understanding EVEMS (NEC 625.42)
        </h4>
        <div className="text-sm text-gray-700 space-y-3">
          <p>
            <strong>NEC 625.42:</strong> Electric Vehicle Energy Management Systems (EVEMS) allow intelligent load management
            that can reduce the required service capacity for EV charging installations.
          </p>
          <p>
            <strong>How EVEMS Works:</strong>
          </p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Monitors total electrical load in real-time</li>
            <li>Adjusts EV charging rates based on available capacity</li>
            <li>Prevents service overload by reducing or pausing EV charging when needed</li>
            <li>Allows more chargers to be installed without service upgrade</li>
          </ul>
          <p>
            <strong>Benefits:</strong>
          </p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Install more chargers without service upgrade</li>
            <li>Reduce peak demand charges</li>
            <li>Optimize charging during off-peak hours</li>
            <li>Comply with NEC 625.42 requirements</li>
          </ul>
          <p>
            <strong>Important:</strong> Individual EV branch circuits must still be sized at 125% per NEC 625.40.
            EVEMS only affects the feeder/service capacity calculation.
          </p>
        </div>
      </div>
    </div>
  );
};

