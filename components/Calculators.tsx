
import React, { useState } from 'react';
import { Calculator, ArrowRight, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { calculateVoltageDropAC, compareVoltageDropMethods, VoltageDropResult } from '../services/calculations';
import { ConductorSizingTool } from './ConductorSizingTool';
import { ProjectSettings } from '../types';

export const Calculators: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'voltage-drop' | 'conduit-fill' | 'conductor-sizing'>('voltage-drop');

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
      </div>

      <div className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm min-h-[400px]">
        {activeTab === 'voltage-drop' && <VoltageDropCalculator />}
        {activeTab === 'conductor-sizing' && <ConductorSizingTool projectSettings={defaultSettings} />}
        {activeTab === 'conduit-fill' && <ConduitFillCalculator />}
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
}
