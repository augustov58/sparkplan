
import React, { useState } from 'react';
import { Calculator, ArrowRight, CheckCircle, XCircle, AlertTriangle, Zap, Car, Sun, Shield } from 'lucide-react';
import { calculateVoltageDropAC, compareVoltageDropMethods, VoltageDropResult } from '../services/calculations';
import { ConductorSizingTool } from './ConductorSizingTool';
import { ProjectSettings } from '../types';
import {
  analyzeSystemFaultCurrents,
  calculateServiceFaultCurrent,
  calculateDownstreamFaultCurrent,
  estimateUtilityTransformer,
  STANDARD_AIC_RATINGS
} from '../services/calculations/shortCircuit';
import {
  calculateEVCharging,
  EVChargingInput,
  EVChargingResult,
  EV_CHARGER_SPECS,
  EVChargerLevel,
  estimateChargingTime
} from '../services/calculations/evCharging';
import {
  calculateSolarPV,
  SolarPVInput,
  SolarPVResult,
  COMMON_PV_PANELS,
  calculateMaxPanelsPerString
} from '../services/calculations/solarPV';
import {
  calculateArcFlash,
  type ArcFlashInput,
  type ArcFlashResult,
  type EquipmentType,
  type ProtectiveDeviceType
} from '../services/calculations/arcFlash';
import { EVEMSLoadManagement } from './EVEMSLoadManagement';

export const Calculators: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'voltage-drop' | 'conduit-fill' | 'conductor-sizing' | 'short-circuit' | 'ev-charging' | 'solar-pv' | 'arc-flash' | 'evems'>('voltage-drop');

  // Default project settings for calculator mode
  const defaultSettings: ProjectSettings = {
    serviceVoltage: 240,
    servicePhase: 1,
    occupancyType: 'dwelling',
    conductorMaterial: 'Cu',
    temperatureRating: 75
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl">
      <div>
        <h2 className="text-2xl font-light text-gray-900">Engineering Tools</h2>
        <p className="text-gray-500 mt-1">Deterministic calculators for NEC compliance (Not AI).</p>
      </div>

      <div className="flex border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('voltage-drop')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'voltage-drop' ? 'border-electric-500 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Voltage Drop (NEC 210.19)
        </button>
        <button
          onClick={() => setActiveTab('conductor-sizing')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'conductor-sizing' ? 'border-electric-500 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Conductor Sizing (NEC 310 + 250.122)
        </button>
        <button
          onClick={() => setActiveTab('conduit-fill')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'conduit-fill' ? 'border-electric-500 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Conduit Fill (Chapter 9)
        </button>
        <button
          onClick={() => setActiveTab('short-circuit')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'short-circuit' ? 'border-electric-500 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Short Circuit (NEC 110.9)
        </button>
        <button
          onClick={() => setActiveTab('ev-charging')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'ev-charging' ? 'border-electric-500 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-1"><Car className="w-4 h-4" /> EV Charging (NEC 625)</span>
        </button>
        <button
          onClick={() => setActiveTab('solar-pv')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'solar-pv' ? 'border-electric-500 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-1"><Sun className="w-4 h-4" /> Solar PV (NEC 690)</span>
        </button>
        <button
          onClick={() => setActiveTab('arc-flash')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'arc-flash' ? 'border-electric-500 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-1"><Shield className="w-4 h-4" /> Arc Flash (NFPA 70E)</span>
        </button>
        <button
          onClick={() => setActiveTab('evems')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'evems' ? 'border-electric-500 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-1"><Zap className="w-4 h-4" /> EVEMS Load Mgmt (NEC 625.42)</span>
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm min-h-[400px]">
        {activeTab === 'voltage-drop' && <VoltageDropCalculator />}
        {activeTab === 'conductor-sizing' && <ConductorSizingTool projectSettings={defaultSettings} />}
        {activeTab === 'conduit-fill' && <ConduitFillCalculator />}
        {activeTab === 'short-circuit' && <ShortCircuitCalculator />}
        {activeTab === 'ev-charging' && <EVChargingCalculator />}
        {activeTab === 'solar-pv' && <SolarPVCalculator />}
        {activeTab === 'arc-flash' && <ArcFlashCalculator />}
        {activeTab === 'evems' && <EVEMSLoadManagement />}
      </div>
    </div>
  );
};

const VoltageDropCalculator: React.FC = () => {
  const [voltage, setVoltage] = useState(120);
  const [phase, setPhase] = useState<1 | 3>(1);
  const [length, setLength] = useState(100);
  const [current, setCurrent] = useState(20);
  const [conductorSize, setConductorSize] = useState('12 AWG');
  const [material, setMaterial] = useState<'Cu' | 'Al'>('Cu');
  const [conduitType, setConduitType] = useState<'PVC' | 'Aluminum' | 'Steel'>('PVC');
  const [showComparison, setShowComparison] = useState(false);

  // Calculate voltage drop using AC impedance method
  let result: VoltageDropResult | null = null;
  let comparison: ReturnType<typeof compareVoltageDropMethods> | null = null;

  try {
    result = calculateVoltageDropAC(conductorSize, material, conduitType, length, current, voltage, phase);

    if (showComparison) {
      comparison = compareVoltageDropMethods(conductorSize, material, length, current, voltage, phase);
    }
  } catch (error) {
    result = null;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-4">
           <h3 className="font-bold text-gray-900">Input Parameters</h3>
           <div className="grid grid-cols-2 gap-4">
             <div>
               <label className="label-xs">Voltage (V)</label>
               <input type="number" value={voltage} onChange={e => setVoltage(Number(e.target.value))} className="input-std" />
             </div>
             <div>
               <label className="label-xs">Phase</label>
               <select value={phase} onChange={e => setPhase(Number(e.target.value) as 1|3)} className="input-std">
                  <option value={1}>Single Phase</option>
                  <option value={3}>Three Phase</option>
               </select>
             </div>
             <div>
               <label className="label-xs">Length (ft, one-way)</label>
               <input type="number" value={length} onChange={e => setLength(Number(e.target.value))} className="input-std" />
             </div>
             <div>
               <label className="label-xs">Load Current (A)</label>
               <input type="number" value={current} onChange={e => setCurrent(Number(e.target.value))} className="input-std" />
             </div>
             <div>
               <label className="label-xs">Conductor Size</label>
               <select value={conductorSize} onChange={e => setConductorSize(e.target.value)} className="input-std">
                  <option value="14 AWG">14 AWG</option>
                  <option value="12 AWG">12 AWG</option>
                  <option value="10 AWG">10 AWG</option>
                  <option value="8 AWG">8 AWG</option>
                  <option value="6 AWG">6 AWG</option>
                  <option value="4 AWG">4 AWG</option>
                  <option value="3 AWG">3 AWG</option>
                  <option value="2 AWG">2 AWG</option>
                  <option value="1 AWG">1 AWG</option>
                  <option value="1/0 AWG">1/0 AWG</option>
                  <option value="2/0 AWG">2/0 AWG</option>
                  <option value="3/0 AWG">3/0 AWG</option>
                  <option value="4/0 AWG">4/0 AWG</option>
                  <option value="250 kcmil">250 kcmil</option>
                  <option value="300 kcmil">300 kcmil</option>
                  <option value="350 kcmil">350 kcmil</option>
                  <option value="400 kcmil">400 kcmil</option>
                  <option value="500 kcmil">500 kcmil</option>
                  <option value="600 kcmil">600 kcmil</option>
                  <option value="750 kcmil">750 kcmil</option>
                  <option value="1000 kcmil">1000 kcmil</option>
               </select>
             </div>
             <div>
               <label className="label-xs">Material</label>
               <select value={material} onChange={e => setMaterial(e.target.value as 'Cu' | 'Al')} className="input-std">
                  <option value="Cu">Copper</option>
                  <option value="Al">Aluminum</option>
               </select>
             </div>
             <div className="col-span-2">
               <label className="label-xs">Conduit Type</label>
               <select value={conduitType} onChange={e => setConduitType(e.target.value as any)} className="input-std">
                  <option value="PVC">PVC (Non-Metallic)</option>
                  <option value="Aluminum">Aluminum</option>
                  <option value="Steel">Steel</option>
               </select>
             </div>
           </div>

           <div className="pt-4 border-t border-gray-200">
             <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
               <input
                 type="checkbox"
                 checked={showComparison}
                 onChange={e => setShowComparison(e.target.checked)}
                 className="rounded border-gray-300"
               />
               Show comparison with K-factor method
             </label>
           </div>
        </div>

        {result && (
          <div className="bg-gray-50 rounded-lg p-8 flex flex-col justify-center">
             <div className="text-center mb-6">
               <div className="mb-2 text-sm text-gray-500 uppercase tracking-wide">Voltage Drop</div>
               <div className="text-5xl font-light text-gray-900 mb-2">{result.voltageDropVolts.toFixed(2)} V</div>
               <div className={`text-xl font-bold mb-4 ${result.isCompliant ? 'text-green-600' : 'text-red-600'}`}>
                 {result.voltageDropPercent.toFixed(2)}%
               </div>

               <div className="flex justify-center">
                  {result.isCompliant ? (
                     <div className="flex items-center gap-2 text-green-700 bg-green-100 px-4 py-2 rounded-full text-sm font-bold">
                        <CheckCircle className="w-4 h-4" /> Compliant ≤3%
                     </div>
                  ) : (
                     <div className="flex items-center gap-2 text-red-700 bg-red-100 px-4 py-2 rounded-full text-sm font-bold">
                        <XCircle className="w-4 h-4" /> Exceeds 3%
                     </div>
                  )}
               </div>
             </div>

             {/* Warnings */}
             {result.warnings.length > 0 && (
               <div className="space-y-2 mb-4">
                 {result.warnings.map((warning, idx) => (
                   <div key={idx} className="flex items-start gap-2 text-xs text-orange-700 bg-orange-50 p-3 rounded border border-orange-200">
                     <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                     <span>{warning}</span>
                   </div>
                 ))}
               </div>
             )}

             {/* Calculation Details */}
             <div className="text-xs text-gray-600 space-y-1 bg-white p-4 rounded border border-gray-200">
               <div className="font-bold text-gray-700 mb-2">AC Impedance Method (NEC Ch. 9 Table 9)</div>
               <div>Effective Z: {result.effectiveZ} Ω/1000ft @ 0.85 PF</div>
               <div>Distance: {result.distance} ft (one-way)</div>
               <div>Current: {result.current} A</div>
               <div className="text-gray-500 mt-2 pt-2 border-t border-gray-200">
                 AC impedance accounts for skin effect and inductive reactance. 20-30% more accurate than K-factor for large conductors.
               </div>
             </div>
          </div>
        )}
      </div>

      {/* Comparison Table */}
      {showComparison && comparison && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h4 className="font-bold text-gray-900 mb-4">Method Comparison</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-blue-300">
                  <th className="text-left py-2 px-4 font-semibold text-gray-700">Method</th>
                  <th className="text-right py-2 px-4 font-semibold text-gray-700">Voltage Drop</th>
                  <th className="text-right py-2 px-4 font-semibold text-gray-700">Percent</th>
                  <th className="text-left py-2 px-4 font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody className="text-gray-800">
                <tr className="border-b border-blue-200 bg-white">
                  <td className="py-2 px-4 font-medium">AC Impedance (Accurate)</td>
                  <td className="text-right py-2 px-4 font-mono">{comparison.acImpedance.voltageDropVolts.toFixed(2)} V</td>
                  <td className="text-right py-2 px-4 font-mono">{comparison.acImpedance.voltageDropPercent.toFixed(2)}%</td>
                  <td className="py-2 px-4">
                    {comparison.acImpedance.isCompliant ?
                      <span className="text-green-700">✓ Compliant</span> :
                      <span className="text-red-700">✗ Exceeds</span>
                    }
                  </td>
                </tr>
                <tr className="bg-white">
                  <td className="py-2 px-4 font-medium">K-Factor (Simplified)</td>
                  <td className="text-right py-2 px-4 font-mono">{comparison.kFactor.voltageDropVolts.toFixed(2)} V</td>
                  <td className="text-right py-2 px-4 font-mono">{comparison.kFactor.voltageDropPercent.toFixed(2)}%</td>
                  <td className="py-2 px-4">
                    {comparison.kFactor.isCompliant ?
                      <span className="text-green-700">✓ Compliant</span> :
                      <span className="text-red-700">✗ Exceeds</span>
                    }
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-sm text-gray-700">
            <strong>Difference:</strong> {Math.abs(comparison.difference.percentDifference)}%
            ({comparison.difference.volts > 0 ? 'AC impedance shows higher' : 'K-factor shows higher'} voltage drop)
          </div>
        </div>
      )}
    </div>
  );
};

const ConduitFillCalculator: React.FC = () => {
    // Simplified demo for Conduit fill
    const [tradeSize, setTradeSize] = useState("1/2");
    const [conduitType, setConduitType] = useState("EMT");
    const [wireSize, setWireSize] = useState("12");
    const [wireType, setWireType] = useState("THHN");
    const [numWires, setNumWires] = useState(3);

    // Approximate areas (sq in) - simplified
    const conduitAreas: Record<string, Record<string, number>> = {
        "EMT": { "1/2": 0.304, "3/4": 0.533, "1": 0.864 },
        "PVC": { "1/2": 0.286, "3/4": 0.503, "1": 0.817 } // Sch 40
    };
    
    // Wire areas (sq in) for THHN
    const wireAreas: Record<string, number> = {
        "14": 0.0097, "12": 0.0133, "10": 0.0211, "8": 0.0366, "6": 0.0507
    };

    const totalConduitArea = conduitAreas[conduitType]?.[tradeSize] || 0.304;
    const maxFillArea = totalConduitArea * 0.40; // 40% fill rule
    const singleWireArea = wireAreas[wireSize] || 0.0133;
    const totalWireArea = singleWireArea * numWires;
    const fillPercent = (totalWireArea / totalConduitArea) * 100;
    const isCompliant = fillPercent <= 40;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-4">
                <h3 className="font-bold text-gray-900">Raceway Configuration</h3>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="label-xs">Conduit Type</label>
                            <select value={conduitType} onChange={e=>setConduitType(e.target.value)} className="input-std">
                                <option value="EMT">EMT</option>
                                <option value="PVC">PVC Sch 40</option>
                            </select>
                         </div>
                         <div>
                            <label className="label-xs">Trade Size</label>
                            <select value={tradeSize} onChange={e=>setTradeSize(e.target.value)} className="input-std">
                                <option value="1/2">1/2"</option>
                                <option value="3/4">3/4"</option>
                                <option value="1">1"</option>
                            </select>
                         </div>
                    </div>
                    <div className="p-4 border border-gray-100 rounded bg-gray-50">
                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Conductors</h4>
                        <div className="grid grid-cols-3 gap-2">
                             <div>
                                <label className="label-xs">Type</label>
                                <select value={wireType} onChange={e=>setWireType(e.target.value)} className="input-std">
                                    <option value="THHN">THHN/THWN</option>
                                    <option value="XHHW">XHHW</option>
                                </select>
                             </div>
                             <div>
                                <label className="label-xs">Size</label>
                                <select value={wireSize} onChange={e=>setWireSize(e.target.value)} className="input-std">
                                    <option value="14">14 AWG</option>
                                    <option value="12">12 AWG</option>
                                    <option value="10">10 AWG</option>
                                    <option value="8">8 AWG</option>
                                    <option value="6">6 AWG</option>
                                </select>
                             </div>
                             <div>
                                <label className="label-xs">Qty</label>
                                <input type="number" value={numWires} onChange={e=>setNumWires(Number(e.target.value))} className="input-std" />
                             </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-8 flex flex-col justify-center items-center text-center">
                <div className="mb-2 text-sm text-gray-500 uppercase tracking-wide">Fill Percentage</div>
                <div className="text-5xl font-light text-gray-900 mb-2">{fillPercent.toFixed(1)}%</div>
                
                <div className="w-full bg-gray-200 h-3 rounded-full mb-6 overflow-hidden max-w-xs">
                    <div 
                        className={`h-full ${isCompliant ? 'bg-electric-500' : 'bg-red-500'}`} 
                        style={{ width: `${Math.min(fillPercent, 100)}%` }}
                    />
                </div>

                <div className="flex items-center gap-2">
                    {isCompliant ? (
                        <div className="flex items-center gap-2 text-green-700 bg-green-100 px-4 py-2 rounded-full text-sm font-bold">
                            <CheckCircle className="w-4 h-4" /> Compliant (&lt;40%)
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-red-700 bg-red-100 px-4 py-2 rounded-full text-sm font-bold">
                            <XCircle className="w-4 h-4" /> Overfilled
                        </div>
                    )}
                </div>
                <p className="text-xs text-gray-400 mt-4">
                  Based on NEC Chapter 9 Table 1 (40% rule for {'>'}2 conductors)
                </p>
            </div>
        </div>
    );
};

const ShortCircuitCalculator: React.FC = () => {
  const [mode, setMode] = useState<'service' | 'panel'>('service');

  // Service calculation inputs
  const [serviceAmps, setServiceAmps] = useState(200);
  const [serviceVoltage, setServiceVoltage] = useState(240);
  const [servicePhase, setServicePhase] = useState<1 | 3>(1);
  const [transformerKVA, setTransformerKVA] = useState<number | null>(null);
  const [transformerImpedance, setTransformerImpedance] = useState(2.5);

  // Panel/downstream calculation inputs
  const [sourceFaultCurrent, setSourceFaultCurrent] = useState(10000);
  const [feederLength, setFeederLength] = useState(50);
  const [feederSize, setFeederSize] = useState('3/0 AWG');
  const [feederVoltage, setFeederVoltage] = useState(240);
  const [feederPhase, setFeederPhase] = useState<1 | 3>(1);

  // Calculate results
  let serviceResult = null;
  let panelResult = null;

  try {
    if (mode === 'service') {
      // Estimate or use specified transformer
      const transformer = transformerKVA !== null
        ? {
            kva: transformerKVA,
            primaryVoltage: servicePhase === 3 ? 12470 : 7200,
            secondaryVoltage: serviceVoltage,
            impedance: transformerImpedance
          }
        : estimateUtilityTransformer(serviceAmps, serviceVoltage, servicePhase);

      serviceResult = calculateServiceFaultCurrent(transformer, serviceVoltage, servicePhase);
    } else {
      // Downstream panel calculation
      panelResult = calculateDownstreamFaultCurrent(
        {
          length: feederLength,
          conductorSize: feederSize,
          material: 'Cu',
          conduitType: 'Steel',
          voltage: feederVoltage,
          phase: feederPhase
        },
        sourceFaultCurrent
      );
    }
  } catch (error) {
    console.error('Short circuit calculation error:', error);
  }

  const result = mode === 'service' ? serviceResult : panelResult;

  return (
    <div className="space-y-6">
      {/* Mode Selector */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setMode('service')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'service'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Service Entrance
        </button>
        <button
          onClick={() => setMode('panel')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'panel'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Downstream Panel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Input Section */}
        <div className="space-y-4">
          <h3 className="font-bold text-gray-900">
            {mode === 'service' ? 'Service Parameters' : 'Feeder Parameters'}
          </h3>

          {mode === 'service' ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-xs">Service Amps</label>
                  <input
                    type="number"
                    value={serviceAmps}
                    onChange={(e) => setServiceAmps(Number(e.target.value))}
                    className="input-std"
                  />
                </div>
                <div>
                  <label className="label-xs">Service Voltage</label>
                  <select
                    value={serviceVoltage}
                    onChange={(e) => setServiceVoltage(Number(e.target.value))}
                    className="input-std"
                  >
                    <option value={120}>120V</option>
                    <option value={240}>240V</option>
                    <option value={208}>208V</option>
                    <option value={480}>480V</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label-xs">Service Phase</label>
                  <select
                    value={servicePhase}
                    onChange={(e) => setServicePhase(Number(e.target.value) as 1 | 3)}
                    className="input-std"
                  >
                    <option value={1}>Single Phase</option>
                    <option value={3}>Three Phase</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-xs font-bold text-gray-700 mb-3">Utility Transformer (Optional)</h4>
                <p className="text-xs text-gray-500 mb-3">
                  Leave blank to auto-estimate based on service size
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-xs">Transformer kVA</label>
                    <input
                      type="number"
                      value={transformerKVA || ''}
                      onChange={(e) => setTransformerKVA(e.target.value ? Number(e.target.value) : null)}
                      placeholder="Auto"
                      className="input-std"
                    />
                  </div>
                  <div>
                    <label className="label-xs">Impedance (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={transformerImpedance}
                      onChange={(e) => setTransformerImpedance(Number(e.target.value))}
                      className="input-std"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Typical: 2.5% (1φ), 5.75% (3φ)
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-700">
                    <strong>Point-to-Point Method:</strong> Calculate fault current at downstream panel by accounting for conductor impedance from source.
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="label-xs">Source Fault Current (A)</label>
                  <input
                    type="number"
                    value={sourceFaultCurrent}
                    onChange={(e) => setSourceFaultCurrent(Number(e.target.value))}
                    className="input-std"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Available fault current at upstream panel/service
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-xs">Feeder Length (ft)</label>
                    <input
                      type="number"
                      value={feederLength}
                      onChange={(e) => setFeederLength(Number(e.target.value))}
                      className="input-std"
                    />
                  </div>
                  <div>
                    <label className="label-xs">Conductor Size</label>
                    <select
                      value={feederSize}
                      onChange={(e) => setFeederSize(e.target.value)}
                      className="input-std"
                    >
                      <option value="12 AWG">12 AWG</option>
                      <option value="10 AWG">10 AWG</option>
                      <option value="8 AWG">8 AWG</option>
                      <option value="6 AWG">6 AWG</option>
                      <option value="4 AWG">4 AWG</option>
                      <option value="3 AWG">3 AWG</option>
                      <option value="2 AWG">2 AWG</option>
                      <option value="1 AWG">1 AWG</option>
                      <option value="1/0 AWG">1/0 AWG</option>
                      <option value="2/0 AWG">2/0 AWG</option>
                      <option value="3/0 AWG">3/0 AWG</option>
                      <option value="4/0 AWG">4/0 AWG</option>
                      <option value="250 kcmil">250 kcmil</option>
                      <option value="300 kcmil">300 kcmil</option>
                      <option value="350 kcmil">350 kcmil</option>
                      <option value="500 kcmil">500 kcmil</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-xs">Voltage (V)</label>
                    <select
                      value={feederVoltage}
                      onChange={(e) => setFeederVoltage(Number(e.target.value))}
                      className="input-std"
                    >
                      <option value={120}>120V</option>
                      <option value={240}>240V</option>
                      <option value={208}>208V</option>
                      <option value={480}>480V</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-xs">Phase</label>
                    <select
                      value={feederPhase}
                      onChange={(e) => setFeederPhase(Number(e.target.value) as 1 | 3)}
                      className="input-std"
                    >
                      <option value={1}>Single Phase</option>
                      <option value={3}>Three Phase</option>
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Results Section */}
        {result && (
          <div className="bg-gray-50 rounded-lg p-8 flex flex-col justify-center">
            <div className="text-center mb-6">
              <div className="mb-2 text-sm text-gray-500 uppercase tracking-wide">
                {mode === 'service' ? 'Service Fault Current' : 'Panel Fault Current'}
              </div>
              <div className="text-5xl font-light text-gray-900 mb-2">
                {(result.faultCurrent / 1000).toFixed(1)} kA
              </div>
              <div className="text-xl text-gray-600 mb-4">
                {result.faultCurrent.toLocaleString()} A RMS
              </div>

              <div className="flex justify-center mb-4">
                <div className="flex items-center gap-2 text-orange-700 bg-orange-100 px-4 py-2 rounded-full text-sm font-bold">
                  <Zap className="w-4 h-4" />
                  Required AIC: {result.requiredAIC} kA
                </div>
              </div>

              {/* Compliance Status */}
              <div className={`text-sm px-4 py-3 rounded-lg border ${
                result.compliance.compliant
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <div className="font-semibold mb-1">{result.compliance.necArticle}</div>
                <div className="text-xs">{result.compliance.message}</div>
              </div>
            </div>

            {/* Calculation Details */}
            <div className="text-xs text-gray-600 space-y-2 bg-white p-4 rounded border border-gray-200">
              <div className="font-bold text-gray-700 mb-2">Calculation Details</div>
              <div className="grid grid-cols-2 gap-2">
                <span className="text-gray-500">Source If:</span>
                <span className="font-mono text-right">{result.details.sourceFaultCurrent.toLocaleString()} A</span>

                {mode === 'panel' && (
                  <>
                    <span className="text-gray-500">Conductor Z:</span>
                    <span className="font-mono text-right">{result.details.conductorImpedance.toFixed(4)} Ω</span>
                  </>
                )}

                <span className="text-gray-500">Total Z:</span>
                <span className="font-mono text-right">{result.details.totalImpedance.toFixed(4)} Ω</span>

                <span className="text-gray-500">Safety Factor:</span>
                <span className="font-mono text-right">{result.details.safetyFactor}×</span>
              </div>

              <div className="text-gray-500 mt-3 pt-3 border-t border-gray-200 text-xs">
                <strong>Standard AIC Ratings:</strong> {STANDARD_AIC_RATINGS.join(', ')} kA
              </div>
            </div>

            {/* Important Notes */}
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-700 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-yellow-800">
                  <strong>Important:</strong> Verify actual utility fault current with local utility company. This calculator provides estimates for preliminary design only.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Educational Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Calculator className="w-4 h-4" />
          Understanding Short Circuit Calculations
        </h4>
        <div className="text-sm text-gray-700 space-y-3">
          <p>
            <strong>NEC 110.9 Interrupting Rating:</strong> Equipment must have adequate interrupting capacity (AIC) to safely interrupt fault currents. Undersized equipment can fail catastrophically during fault conditions.
          </p>
          <p>
            <strong>Service Entrance:</strong> Fault current is highest at the service entrance, limited only by utility transformer impedance. Typical residential services: 10-22 kA. Commercial/industrial: 22-65 kA.
          </p>
          <p>
            <strong>Downstream Panels:</strong> Fault current decreases with distance due to conductor impedance. Longer feeders and smaller conductors reduce available fault current.
          </p>
          <p>
            <strong>Standard Breaker AIC Ratings:</strong>
          </p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><strong>10 kA:</strong> Residential panels (standard)</li>
            <li><strong>14 kA:</strong> Residential panels (enhanced)</li>
            <li><strong>22 kA:</strong> Commercial panels (standard)</li>
            <li><strong>42-65 kA:</strong> Industrial/high fault current applications</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// ============================================
// EV CHARGING CALCULATOR - NEC Article 625
// ============================================
const EVChargingCalculator: React.FC = () => {
  const [chargerLevel, setChargerLevel] = useState<EVChargerLevel>('Level2');
  const [chargerAmps, setChargerAmps] = useState(32);
  const [voltage, setVoltage] = useState(240);
  const [phase, setPhase] = useState<1 | 3>(1);
  const [numChargers, setNumChargers] = useState(1);
  const [simultaneousUse, setSimultaneousUse] = useState(100);
  const [circuitLength, setCircuitLength] = useState(50);
  const [material, setMaterial] = useState<'Cu' | 'Al'>('Cu');
  
  // Battery estimation
  const [batteryCapacity, setBatteryCapacity] = useState(75);
  const [currentSOC, setCurrentSOC] = useState(20);
  const [targetSOC, setTargetSOC] = useState(80);
  
  const chargerOptions = EV_CHARGER_SPECS[chargerLevel];
  
  let result: EVChargingResult | null = null;
  try {
    result = calculateEVCharging({
      chargerLevel,
      chargerAmps,
      voltage,
      phase,
      numChargers,
      simultaneousUse,
      circuitLength_ft: circuitLength,
      conductorMaterial: material
    });
  } catch (error) {
    result = null;
  }

  const chargingTime = estimateChargingTime(
    (voltage * chargerAmps) / 1000,
    batteryCapacity,
    currentSOC,
    targetSOC
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="space-y-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Car className="w-5 h-5 text-electric-500" /> Charger Configuration
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Charger Level</label>
              <select
                value={chargerLevel}
                onChange={e => {
                  const level = e.target.value as EVChargerLevel;
                  setChargerLevel(level);
                  // Set defaults based on level
                  if (level === 'Level1') { setVoltage(120); setChargerAmps(16); setPhase(1); }
                  if (level === 'Level2') { setVoltage(240); setChargerAmps(32); setPhase(1); }
                  if (level === 'Level3_DCFC') { setVoltage(480); setChargerAmps(100); setPhase(3); }
                }}
                className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
              >
                <option value="Level1">Level 1 (120V)</option>
                <option value="Level2">Level 2 (240V)</option>
                <option value="Level3_DCFC">Level 3 DC Fast Charger</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Charger Amps</label>
              <select
                value={chargerAmps}
                onChange={e => setChargerAmps(Number(e.target.value))}
                className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
              >
                {chargerOptions.map(opt => (
                  <option key={opt.maxAmps} value={opt.maxAmps}>
                    {opt.maxAmps}A ({opt.power_kw} kW)
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Voltage</label>
              <select
                value={voltage}
                onChange={e => setVoltage(Number(e.target.value))}
                className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
              >
                <option value="120">120V</option>
                <option value="208">208V</option>
                <option value="240">240V</option>
                <option value="480">480V</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Phase</label>
              <select
                value={phase}
                onChange={e => setPhase(Number(e.target.value) as 1 | 3)}
                className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
              >
                <option value={1}>Single Phase</option>
                <option value={3}>Three Phase</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Number of Chargers</label>
              <input
                type="number"
                min={1}
                max={50}
                value={numChargers}
                onChange={e => setNumChargers(Number(e.target.value))}
                className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Simultaneous Use %</label>
              <input
                type="number"
                min={10}
                max={100}
                value={simultaneousUse}
                onChange={e => setSimultaneousUse(Number(e.target.value))}
                className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Circuit Length (ft)</label>
              <input
                type="number"
                min={1}
                value={circuitLength}
                onChange={e => setCircuitLength(Number(e.target.value))}
                className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Conductor Material</label>
              <select
                value={material}
                onChange={e => setMaterial(e.target.value as 'Cu' | 'Al')}
                className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
              >
                <option value="Cu">Copper</option>
                <option value="Al">Aluminum</option>
              </select>
            </div>
          </div>

          {/* Charging Time Estimator */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
            <h4 className="font-medium text-gray-800 mb-3">Charging Time Estimator</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Battery (kWh)</label>
                <input
                  type="number"
                  value={batteryCapacity}
                  onChange={e => setBatteryCapacity(Number(e.target.value))}
                  className="w-full border-gray-200 rounded text-sm py-1 focus:border-electric-500 focus:ring-electric-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Start SOC %</label>
                <input
                  type="number"
                  value={currentSOC}
                  onChange={e => setCurrentSOC(Number(e.target.value))}
                  className="w-full border-gray-200 rounded text-sm py-1 focus:border-electric-500 focus:ring-electric-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Target SOC %</label>
                <input
                  type="number"
                  value={targetSOC}
                  onChange={e => setTargetSOC(Number(e.target.value))}
                  className="w-full border-gray-200 rounded text-sm py-1 focus:border-electric-500 focus:ring-electric-500"
                />
              </div>
            </div>
            <div className="mt-3 text-center">
              <span className="text-2xl font-bold text-electric-600">
                {chargingTime.hours}h {chargingTime.minutes}m
              </span>
              <span className="text-gray-500 text-sm ml-2">estimated</span>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="space-y-4">
          <h3 className="font-bold text-gray-900">Sizing Results (NEC 625)</h3>
          
          {result && (
            <div className="space-y-4">
              {/* Circuit Sizing */}
              <div className="bg-electric-50 border border-electric-200 rounded-lg p-4">
                <h4 className="font-medium text-electric-800 mb-2">Per-Circuit Requirements</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span className="text-gray-600">Circuit Breaker:</span>
                  <span className="font-bold">{result.circuitBreakerAmps}A</span>
                  <span className="text-gray-600">Conductor Size:</span>
                  <span className="font-bold">{result.conductorSize}</span>
                  <span className="text-gray-600">EGC Size:</span>
                  <span className="font-bold">{result.egcSize}</span>
                </div>
              </div>

              {/* System Load */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">System Load (per NEC 625.44)</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span className="text-gray-600">Total Connected Load:</span>
                  <span className="font-bold">{result.totalConnectedLoad_kVA} kVA</span>
                  <span className="text-gray-600">Demand Factor:</span>
                  <span className="font-bold">{(result.demandFactor * 100).toFixed(0)}%</span>
                  <span className="text-gray-600">Demand Load:</span>
                  <span className="font-bold">{result.demandLoad_kVA} kVA</span>
                </div>
              </div>

              {/* Voltage Drop */}
              <div className={`rounded-lg p-4 ${result.meetsVoltageDrop ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'} border`}>
                <div className="flex items-center gap-2 mb-2">
                  {result.meetsVoltageDrop ? <CheckCircle className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-yellow-600" />}
                  <h4 className={`font-medium ${result.meetsVoltageDrop ? 'text-green-800' : 'text-yellow-800'}`}>Voltage Drop</h4>
                </div>
                <span className="text-xl font-bold">{result.voltageDropPercent}%</span>
                <span className="text-gray-500 text-sm ml-2">(≤3% recommended)</span>
              </div>

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-medium text-red-800 mb-2">Warnings</h4>
                  <ul className="text-sm text-red-700 space-y-1">
                    {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              {/* NEC References */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-2">NEC References</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  {result.necReferences.map((ref, i) => <li key={i}>• {ref}</li>)}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// SOLAR PV CALCULATOR - NEC Article 690
// ============================================
const SolarPVCalculator: React.FC = () => {
  // Panel selection
  const [selectedPanel, setSelectedPanel] = useState(COMMON_PV_PANELS[2]); // 400W default
  const [numPanels, setNumPanels] = useState(20);
  const [panelsPerString, setPanelsPerString] = useState(10);
  
  // Inverter
  const [inverterType, setInverterType] = useState<'string' | 'microinverter' | 'dc_optimized'>('string');
  const [inverterPower, setInverterPower] = useState(7.6);
  const [inverterMaxVdc, setInverterMaxVdc] = useState(500);
  
  // AC Connection
  const [acVoltage, setAcVoltage] = useState(240);
  const [acPhase, setAcPhase] = useState<1 | 3>(1);
  
  // Installation
  const [roofType, setRoofType] = useState<'flush_mount' | 'rack_mount' | 'ground_mount'>('flush_mount');
  const [material, setMaterial] = useState<'Cu' | 'Al'>('Cu');
  const [dcLength, setDcLength] = useState(50);
  const [acLength, setAcLength] = useState(30);

  const systemSize = (selectedPanel.watts * numPanels) / 1000;
  const numStrings = Math.ceil(numPanels / panelsPerString);
  const maxPanelsPerString = calculateMaxPanelsPerString(selectedPanel.voc, inverterMaxVdc);

  let result: SolarPVResult | null = null;
  try {
    result = calculateSolarPV({
      systemSize_kW: systemSize,
      numPanels,
      panelWatts: selectedPanel.watts,
      panelVoc: selectedPanel.voc,
      panelIsc: selectedPanel.isc,
      panelsPerString,
      numStrings,
      inverterType,
      inverterPower_kW: inverterPower,
      inverterMaxVdc,
      inverterMaxIdc: 15,
      acVoltage,
      acPhase,
      roofType,
      conductorMaterial: material,
      dcCircuitLength_ft: dcLength,
      acCircuitLength_ft: acLength
    });
  } catch (error) {
    result = null;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="space-y-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Sun className="w-5 h-5 text-yellow-500" /> System Configuration
          </h3>
          
          {/* Panel Selection */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-3">PV Panel Selection</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Panel Type</label>
                <select
                  value={selectedPanel.watts}
                  onChange={e => setSelectedPanel(COMMON_PV_PANELS.find(p => p.watts === Number(e.target.value)) || COMMON_PV_PANELS[2])}
                  className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
                >
                  {COMMON_PV_PANELS.map(panel => (
                    <option key={panel.watts} value={panel.watts}>
                      {panel.name} - Voc: {panel.voc}V, Isc: {panel.isc}A
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Number of Panels</label>
                <input
                  type="number"
                  min={1}
                  value={numPanels}
                  onChange={e => setNumPanels(Number(e.target.value))}
                  className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Panels per String</label>
                <input
                  type="number"
                  min={1}
                  max={maxPanelsPerString}
                  value={panelsPerString}
                  onChange={e => setPanelsPerString(Number(e.target.value))}
                  className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
                />
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-600">
              System Size: <strong>{systemSize.toFixed(1)} kW DC</strong> • 
              Strings: <strong>{numStrings}</strong> •
              Max panels/string: <strong>{maxPanelsPerString}</strong>
            </div>
          </div>

          {/* Inverter Configuration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Inverter Type</label>
              <select
                value={inverterType}
                onChange={e => setInverterType(e.target.value as any)}
                className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
              >
                <option value="string">String Inverter</option>
                <option value="microinverter">Microinverters</option>
                <option value="dc_optimized">DC Optimizers</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Inverter Power (kW)</label>
              <input
                type="number"
                step={0.1}
                value={inverterPower}
                onChange={e => setInverterPower(Number(e.target.value))}
                className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Max DC Voltage (V)</label>
              <input
                type="number"
                value={inverterMaxVdc}
                onChange={e => setInverterMaxVdc(Number(e.target.value))}
                className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">AC Voltage</label>
              <select
                value={acVoltage}
                onChange={e => setAcVoltage(Number(e.target.value))}
                className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
              >
                <option value="208">208V</option>
                <option value="240">240V</option>
                <option value="480">480V</option>
              </select>
            </div>
          </div>

          {/* Installation */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Mount Type</label>
              <select
                value={roofType}
                onChange={e => setRoofType(e.target.value as any)}
                className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
              >
                <option value="flush_mount">Flush Mount (Roof)</option>
                <option value="rack_mount">Rack Mount</option>
                <option value="ground_mount">Ground Mount</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Conductor Material</label>
              <select
                value={material}
                onChange={e => setMaterial(e.target.value as 'Cu' | 'Al')}
                className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
              >
                <option value="Cu">Copper</option>
                <option value="Al">Aluminum</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">DC Run Length (ft)</label>
              <input
                type="number"
                value={dcLength}
                onChange={e => setDcLength(Number(e.target.value))}
                className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">AC Run Length (ft)</label>
              <input
                type="number"
                value={acLength}
                onChange={e => setAcLength(Number(e.target.value))}
                className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
              />
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="space-y-4">
          <h3 className="font-bold text-gray-900">Sizing Results (NEC 690)</h3>
          
          {result && (
            <div className="space-y-4">
              {/* DC Side */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">DC Side (String)</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span className="text-gray-600">String Voc:</span>
                  <span className="font-bold">{result.stringVoc}V</span>
                  <span className="text-gray-600">Corrected Voc:</span>
                  <span className="font-bold">{result.stringVocCorrected}V</span>
                  <span className="text-gray-600">String Isc:</span>
                  <span className="font-bold">{result.stringIsc}A</span>
                  <span className="text-gray-600">DC OCPD:</span>
                  <span className="font-bold">{result.dcOcpdRating}A</span>
                  <span className="text-gray-600">DC Conductor:</span>
                  <span className="font-bold">{result.dcConductorSize}</span>
                  <span className="text-gray-600">DC Voltage Drop:</span>
                  <span className="font-bold">{result.dcVoltageDrop}%</span>
                </div>
              </div>

              {/* AC Side */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-800 mb-2">AC Side (Inverter Output)</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span className="text-gray-600">AC Current:</span>
                  <span className="font-bold">{result.acCurrent}A</span>
                  <span className="text-gray-600">AC Breaker:</span>
                  <span className="font-bold">{result.acOcpdRating}A</span>
                  <span className="text-gray-600">AC Conductor:</span>
                  <span className="font-bold">{result.acConductorSize}</span>
                  <span className="text-gray-600">AC Voltage Drop:</span>
                  <span className="font-bold">{result.acVoltageDrop}%</span>
                </div>
              </div>

              {/* 120% Rule Check */}
              <div className={`rounded-lg p-4 ${result.meetsNec120Rule ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'} border`}>
                <div className="flex items-center gap-2 mb-2">
                  {result.meetsNec120Rule ? <CheckCircle className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-yellow-600" />}
                  <h4 className={`font-medium ${result.meetsNec120Rule ? 'text-green-800' : 'text-yellow-800'}`}>NEC 705.12 (120% Rule)</h4>
                </div>
                <p className="text-sm text-gray-600">
                  Max backfeed for 200A panel: <strong>{result.maxBackfeedAmps}A</strong>
                </p>
                {!result.meetsNec120Rule && (
                  <p className="text-sm text-yellow-700 mt-1">
                    Consider supply-side connection per NEC 705.12(A)
                  </p>
                )}
              </div>

              {/* Production Estimate */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-yellow-800 mb-2">Production Estimate</h4>
                <div className="text-center">
                  <span className="text-3xl font-bold text-yellow-600">
                    {(result.estimatedAnnualProduction_kWh / 1000).toFixed(1)} MWh
                  </span>
                  <span className="text-gray-500 text-sm ml-2">/year</span>
                </div>
                <div className="text-center mt-1">
                  <span className="text-lg font-medium text-gray-700">
                    {result.estimatedMonthlyProduction_kWh.toLocaleString()} kWh
                  </span>
                  <span className="text-gray-500 text-sm ml-2">/month avg</span>
                </div>
              </div>

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-medium text-red-800 mb-2">Warnings</h4>
                  <ul className="text-sm text-red-700 space-y-1">
                    {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              {/* NEC References */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-2">NEC References</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  {result.necReferences.map((ref, i) => <li key={i}>• {ref}</li>)}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// ARC FLASH CALCULATOR - IEEE 1584 / NFPA 70E
// ============================================
const ArcFlashCalculator: React.FC = () => {
  const [shortCircuitCurrent, setShortCircuitCurrent] = useState(22); // kA
  const [voltage, setVoltage] = useState(480);
  const [phase, setPhase] = useState<1 | 3>(3);
  const [equipmentType, setEquipmentType] = useState<EquipmentType>('panelboard');
  const [protectiveDevice, setProtectiveDevice] = useState<ProtectiveDeviceType>('circuit_breaker');
  const [deviceRating, setDeviceRating] = useState(100); // Amps
  const [workingDistance, setWorkingDistance] = useState<number | undefined>(undefined);
  const [arcGap, setArcGap] = useState<number | undefined>(undefined);
  const [grounded, setGrounded] = useState(true);

  let result: ArcFlashResult | null = null;
  let error: string | null = null;

  try {
    result = calculateArcFlash({
      shortCircuitCurrent,
      voltage,
      phase,
      equipmentType,
      protectiveDevice,
      deviceRating,
      workingDistance,
      arcGap,
      grounded,
    });
  } catch (err) {
    error = err instanceof Error ? err.message : 'Calculation error';
  }

  const standardWorkingDistance = workingDistance || (equipmentType === 'switchgear' ? 36 : equipmentType === 'panelboard' ? 24 : equipmentType === 'mcc' ? 24 : equipmentType === 'motor_control' ? 18 : 18);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-electric-500" /> System Parameters
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Short Circuit Current (kA)</label>
              <input type="number" value={shortCircuitCurrent} onChange={e => setShortCircuitCurrent(Number(e.target.value))} min="0.1" max="200" step="0.1" className="w-full border-gray-200 rounded text-sm py-2 px-3 focus:border-electric-500 focus:ring-electric-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Voltage (V)</label>
              <select value={voltage} onChange={e => setVoltage(Number(e.target.value))} className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500">
                <option value="120">120V</option>
                <option value="208">208V</option>
                <option value="240">240V</option>
                <option value="277">277V</option>
                <option value="480">480V</option>
                <option value="600">600V</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Phase</label>
              <select value={phase} onChange={e => setPhase(Number(e.target.value) as 1 | 3)} className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500">
                <option value="1">Single-Phase</option>
                <option value="3">Three-Phase</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Equipment Type</label>
              <select value={equipmentType} onChange={e => { setEquipmentType(e.target.value as EquipmentType); setWorkingDistance(undefined); }} className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500">
                <option value="switchgear">Switchgear (36")</option>
                <option value="panelboard">Panelboard (24")</option>
                <option value="mcc">MCC (24")</option>
                <option value="motor_control">Motor Control (18")</option>
                <option value="cable">Cable (18")</option>
                <option value="open_air">Open Air (36")</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Protective Device</label>
              <select value={protectiveDevice} onChange={e => setProtectiveDevice(e.target.value as ProtectiveDeviceType)} className="w-full border-gray-200 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500">
                <option value="circuit_breaker">Circuit Breaker</option>
                <option value="current_limiting_breaker">Current Limiting Breaker</option>
                <option value="fuse">Fuse</option>
                <option value="current_limiting_fuse">Current Limiting Fuse</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Device Rating (A)</label>
              <input type="number" value={deviceRating} onChange={e => setDeviceRating(Number(e.target.value))} min="1" max="5000" step="1" className="w-full border-gray-200 rounded text-sm py-2 px-3 focus:border-electric-500 focus:ring-electric-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Working Distance (inches)</label>
              <input type="number" value={workingDistance || ''} onChange={e => setWorkingDistance(e.target.value ? Number(e.target.value) : undefined)} placeholder={`Default: ${standardWorkingDistance}"`} min="12" max="60" step="1" className="w-full border-gray-200 rounded text-sm py-2 px-3 focus:border-electric-500 focus:ring-electric-500" />
              <p className="text-xs text-gray-400 mt-1">Leave blank for standard distance</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Arc Gap (inches)</label>
              <input type="number" value={arcGap || ''} onChange={e => setArcGap(e.target.value ? Number(e.target.value) : undefined)} placeholder="Auto" min="0.1" max="2" step="0.1" className="w-full border-gray-200 rounded text-sm py-2 px-3 focus:border-electric-500 focus:ring-electric-500" />
              <p className="text-xs text-gray-400 mt-1">Leave blank for standard gap</p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <input type="checkbox" id="grounded" checked={grounded} onChange={e => setGrounded(e.target.checked)} className="rounded border-gray-300 text-electric-500 focus:ring-electric-500" />
            <label htmlFor="grounded" className="text-sm text-gray-700">Grounded System (most common)</label>
          </div>
        </div>
        <div className="space-y-4">
          <h3 className="font-bold text-gray-900">Arc Flash Analysis Results</h3>
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
              <div className="bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">Incident Energy</span>
                  <span className="text-3xl font-bold text-red-700">{result.incidentEnergy.toFixed(2)} cal/cm²</span>
                </div>
                <div className="text-xs text-gray-600">At working distance of {result.details.workingDistance}"</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">Arc Flash Boundary</span>
                  <span className="text-2xl font-bold text-blue-700">{result.arcFlashBoundary.toFixed(1)}"</span>
                </div>
                <div className="text-xs text-gray-600 mt-1">Distance where incident energy = 1.2 cal/cm²</div>
              </div>
              <div className={`border-2 rounded-lg p-4 ${result.ppeCategory === 0 ? 'bg-green-50 border-green-200' : result.ppeCategory === 1 ? 'bg-yellow-50 border-yellow-200' : result.ppeCategory === 2 ? 'bg-orange-50 border-orange-200' : result.ppeCategory === 3 ? 'bg-red-50 border-red-200' : result.ppeCategory === 4 ? 'bg-red-100 border-red-300' : 'bg-red-200 border-red-400'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">PPE Category</span>
                  <span className={`text-2xl font-bold ${result.ppeCategory === 0 ? 'text-green-700' : result.ppeCategory === 1 ? 'text-yellow-700' : result.ppeCategory === 2 ? 'text-orange-700' : result.ppeCategory === 3 ? 'text-red-700' : result.ppeCategory === 4 ? 'text-red-800' : 'text-red-900'}`}>
                    {result.ppeCategory === 'N/A' ? 'N/A' : `Category ${result.ppeCategory}`}
                  </span>
                </div>
                <div className="text-xs text-gray-700 mt-1">{result.requiredPPE}</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3 text-sm">Calculation Details</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <span className="text-gray-500">Short Circuit Current:</span>
                  <span className="font-mono text-right">{result.details.shortCircuitCurrent} kA</span>
                  <span className="text-gray-500">Arcing Current:</span>
                  <span className="font-mono text-right">{result.details.arcingCurrent} kA</span>
                  <span className="text-gray-500">Clearing Time:</span>
                  <span className="font-mono text-right">{(result.details.clearingTime * 1000).toFixed(1)} ms</span>
                  <span className="text-gray-500">Working Distance:</span>
                  <span className="font-mono text-right">{result.details.workingDistance}"</span>
                  <span className="text-gray-500">Arc Gap:</span>
                  <span className="font-mono text-right">{result.details.arcGap}"</span>
                  <span className="text-gray-500">Voltage:</span>
                  <span className="font-mono text-right">{result.details.voltage}V {result.details.phase}φ</span>
                </div>
              </div>
              <div className={`border rounded-lg p-4 ${result.compliance.compliant ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {result.compliance.compliant ? <CheckCircle className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
                  <span className="font-semibold text-sm text-gray-900">{result.compliance.compliant ? 'Compliant' : 'Requires Action'}</span>
                </div>
                <p className="text-sm text-gray-700 mb-2">{result.compliance.message}</p>
                <div className="text-xs text-gray-600">
                  <div><strong>NEC:</strong> {result.compliance.necArticle}</div>
                  <div><strong>NFPA 70E:</strong> {result.compliance.nfpaArticle}</div>
                </div>
              </div>
              {result.compliance.recommendations.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-900 mb-2 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Recommendations
                  </h4>
                  <ul className="text-xs text-yellow-800 space-y-1 list-disc list-inside">
                    {result.compliance.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Understanding Arc Flash Calculations
        </h4>
        <div className="text-sm text-gray-700 space-y-3">
          <p><strong>IEEE 1584 Standard:</strong> This calculator uses IEEE 1584-2018 equations to estimate incident energy and arc flash boundary. Results are estimates for preliminary analysis only.</p>
          <p><strong>NFPA 70E PPE Categories:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><strong>Category 0:</strong> {'<'} 1.2 cal/cm² - Standard work clothing</li>
            <li><strong>Category 1:</strong> 1.2 - 4 cal/cm² - Arc-rated clothing (4 cal/cm² minimum)</li>
            <li><strong>Category 2:</strong> 4 - 8 cal/cm² - Arc-rated clothing (8 cal/cm² minimum)</li>
            <li><strong>Category 3:</strong> 8 - 25 cal/cm² - Arc-rated clothing (25 cal/cm² minimum)</li>
            <li><strong>Category 4:</strong> 25 - 40 cal/cm² - Arc-rated clothing (40 cal/cm² minimum)</li>
            <li><strong>Above Category 4:</strong> {'>'} 40 cal/cm² - De-energization required or engineering analysis</li>
          </ul>
          <p><strong>Important:</strong> For final design and energized work, perform detailed arc flash study using actual protective device time-current curves. Field verification required before performing energized work.</p>
        </div>
      </div>
    </div>
  );
};
