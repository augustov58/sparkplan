
import React, { useState } from 'react';
import { Calculator, ArrowRight, CheckCircle, XCircle } from 'lucide-react';

export const Calculators: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'voltage-drop' | 'conduit-fill'>('voltage-drop');

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl">
      <div>
        <h2 className="text-2xl font-light text-gray-900">Engineering Tools</h2>
        <p className="text-gray-500 mt-1">Deterministic calculators for NEC compliance (Not AI).</p>
      </div>

      <div className="flex border-b border-gray-200">
        <button 
          onClick={() => setActiveTab('voltage-drop')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'voltage-drop' ? 'border-electric-500 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Voltage Drop (NEC 210.19)
        </button>
        <button 
          onClick={() => setActiveTab('conduit-fill')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'conduit-fill' ? 'border-electric-500 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Conduit Fill (Chapter 9)
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm min-h-[400px]">
        {activeTab === 'voltage-drop' ? <VoltageDropCalculator /> : <ConduitFillCalculator />}
      </div>
    </div>
  );
};

const VoltageDropCalculator: React.FC = () => {
  const [voltage, setVoltage] = useState(120);
  const [phase, setPhase] = useState<1 | 3>(1);
  const [length, setLength] = useState(100);
  const [current, setCurrent] = useState(20);
  const [size, setSize] = useState(12); // 12 AWG
  const [material, setMaterial] = useState<'Cu' | 'Al'>('Cu');

  // Simple K factor: Cu=12.9, Al=21.2 roughly
  const K = material === 'Cu' ? 12.9 : 21.2;
  
  // Approximate Circular Mils for AWG
  const cmilMap: Record<number, number> = {
    14: 4110, 12: 6530, 10: 10380, 8: 16510, 6: 26240, 4: 41740, 3: 52620, 2: 66360, 1: 83690
  };
  const cmil = cmilMap[size] || 6530;

  // Formula: VD = (2 * K * L * I) / CM for 1ph
  // VD = (1.732 * K * L * I) / CM for 3ph
  const multiplier = phase === 1 ? 2 : 1.732;
  const vDrop = (multiplier * K * length * current) / cmil;
  const percentDrop = (vDrop / voltage) * 100;
  
  const isCompliant = percentDrop <= 3; // 3% for branch circuits rec

  return (
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
             <label className="label-xs">Length (ft)</label>
             <input type="number" value={length} onChange={e => setLength(Number(e.target.value))} className="input-std" />
           </div>
           <div>
             <label className="label-xs">Load Current (A)</label>
             <input type="number" value={current} onChange={e => setCurrent(Number(e.target.value))} className="input-std" />
           </div>
           <div>
             <label className="label-xs">Conductor Size (AWG)</label>
             <select value={size} onChange={e => setSize(Number(e.target.value))} className="input-std">
                <option value={14}>14 AWG</option>
                <option value={12}>12 AWG</option>
                <option value={10}>10 AWG</option>
                <option value={8}>8 AWG</option>
                <option value={6}>6 AWG</option>
                <option value={4}>4 AWG</option>
                <option value={2}>2 AWG</option>
             </select>
           </div>
           <div>
             <label className="label-xs">Material</label>
             <select value={material} onChange={e => setMaterial(e.target.value as any)} className="input-std">
                <option value="Cu">Copper</option>
                <option value="Al">Aluminum</option>
             </select>
           </div>
         </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-8 flex flex-col justify-center items-center text-center">
         <div className="mb-2 text-sm text-gray-500 uppercase tracking-wide">Voltage Drop</div>
         <div className="text-5xl font-light text-gray-900 mb-2">{vDrop.toFixed(2)} V</div>
         <div className={`text-xl font-bold mb-6 ${isCompliant ? 'text-green-600' : 'text-red-600'}`}>
           {percentDrop.toFixed(2)}%
         </div>
         
         <div className="flex items-center gap-2">
            {isCompliant ? (
               <div className="flex items-center gap-2 text-green-700 bg-green-100 px-4 py-2 rounded-full text-sm font-bold">
                  <CheckCircle className="w-4 h-4" /> Compliant (NEC 210.19 FPN)
               </div>
            ) : (
               <div className="flex items-center gap-2 text-red-700 bg-red-100 px-4 py-2 rounded-full text-sm font-bold">
                  <XCircle className="w-4 h-4" /> Exceeds 3%
               </div>
            )}
         </div>
         <p className="text-xs text-gray-400 mt-4 max-w-xs">
           Note: NEC 210.19(A) informational note recommends max 3% drop for branch circuits and 5% total voltage drop for feeder + branch.
         </p>
      </div>
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
