
import React, { useState } from 'react';
import { Calculator, ArrowRight, CheckCircle, XCircle, AlertTriangle, Zap } from 'lucide-react';
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

export const Calculators: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'voltage-drop' | 'conduit-fill' | 'conductor-sizing' | 'short-circuit'>('voltage-drop');

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
      </div>

      <div className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm min-h-[400px]">
        {activeTab === 'voltage-drop' && <VoltageDropCalculator />}
        {activeTab === 'conductor-sizing' && <ConductorSizingTool projectSettings={defaultSettings} />}
        {activeTab === 'conduit-fill' && <ConduitFillCalculator />}
        {activeTab === 'short-circuit' && <ShortCircuitCalculator />}
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
