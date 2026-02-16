
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePersistedState } from '../hooks/usePersistedState';
import { Calculator, ArrowRight, CheckCircle, XCircle, AlertTriangle, Zap, Car, Sun, Shield, Save, X, Plus, Trash2, TrendingUp, Sparkles, Info, Menu, Building2, Lock } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import { FeatureGate } from './FeatureGate';
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
import { ServiceUpgradeWizard } from './ServiceUpgradeWizard';
import { CircuitSharingCalculator } from './CircuitSharingCalculator';
import { useShortCircuitCalculations } from '../hooks/useShortCircuitCalculations';
import { usePanels } from '../hooks/usePanels';
import { useProjects } from '../hooks/useProjects';
import { getConduitDimensions } from '../data/nec/chapter9-conduit-dimensions';
import { getConductorDimensions, STANDARD_WIRE_SIZES } from '../data/nec/chapter9-conductor-dimensions';
import { analyzeChangeImpact } from '../services/api/pythonBackend';
import { EVPanelTemplates } from './EVPanelTemplates';
import { MultiFamilyEVCalculator } from './MultiFamilyEVCalculator';

interface CalculatorsProps {
  projectId?: string;
}

type TabKey = 'voltage-drop' | 'conduit-fill' | 'conductor-sizing' | 'short-circuit' | 'ev-charging' | 'solar-pv' | 'arc-flash' | 'evems' | 'service-upgrade' | 'circuit-sharing' | 'change-impact' | 'ev-panel-builder' | 'multi-family-ev';

const VALID_TABS = new Set<string>([
  'voltage-drop', 'conduit-fill', 'conductor-sizing', 'short-circuit',
  'ev-charging', 'solar-pv', 'arc-flash', 'evems', 'service-upgrade',
  'circuit-sharing', 'change-impact', 'ev-panel-builder', 'multi-family-ev'
]);

export const Calculators: React.FC<CalculatorsProps> = ({ projectId }) => {
  const { getProjectById, updateProject } = useProjects();
  const project = projectId ? getProjectById(projectId) : undefined;
  const [searchParams] = useSearchParams();

  const [persistedTab, setPersistedTab] = usePersistedState<TabKey>(`calc-activeTab-${projectId ?? 'global'}`, 'voltage-drop');
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const tab = searchParams.get('tab');
    return tab && VALID_TABS.has(tab) ? tab as TabKey : persistedTab;
  });

  // Sync active tab to persisted state
  useEffect(() => {
    setPersistedTab(activeTab);
  }, [activeTab]);

  // Respond to query param changes (e.g. navigation from DwellingLoadCalculator)
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && VALID_TABS.has(tab)) {
      setActiveTab(tab as TabKey);
    }
  }, [searchParams]);

  // Default project settings for calculator mode
  const defaultSettings: ProjectSettings = {
    serviceVoltage: 240,
    servicePhase: 1,
    occupancyType: 'dwelling',
    conductorMaterial: 'Cu',
    temperatureRating: 75
  };

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const { hasFeature } = useSubscription();

  // Calculator options for mobile dropdown - grouped
  // feature?: string maps to FEATURE_ACCESS keys; omitted = free/ungated
  const calculatorOptions: { value: string; label: string; group: string; feature?: string }[] = [
    // General Calculators
    { value: 'voltage-drop', label: 'Voltage Drop (NEC 210.19)', group: 'general' },
    { value: 'conductor-sizing', label: 'Conductor Sizing (NEC 310 + 250.122)', group: 'general' },
    { value: 'conduit-fill', label: 'Conduit Fill (Chapter 9)', group: 'general' },
    { value: 'short-circuit', label: 'Short Circuit (NEC 110.9)', group: 'general', feature: 'short-circuit-basic' },
    { value: 'arc-flash', label: 'Arc Flash (NFPA 70E)', group: 'general', feature: 'arc-flash' },
    { value: 'solar-pv', label: 'Solar PV (NEC 690)', group: 'general' },
    { value: 'service-upgrade', label: 'Service Upgrade (NEC 230.42)', group: 'general', feature: 'service-upgrade-wizard' },
    // EV Calculators
    { value: 'multi-family-ev', label: 'Multi-Family EV (NEC 220.84)', group: 'ev', feature: 'multi-family-ev' },
    { value: 'ev-charging', label: 'EV Charging (NEC 625)', group: 'ev', feature: 'ev-charging-calc' },
    { value: 'evems', label: 'EVEMS Load Mgmt (NEC 625.42)', group: 'ev', feature: 'evems-calculator' },
    { value: 'ev-panel-builder', label: 'EV Panel Builder', group: 'ev', feature: 'ev-panel-templates' },
    { value: 'circuit-sharing', label: 'Circuit Sharing (NEC 625)', group: 'ev', feature: 'circuit-sharing-calc' },
    // AI
    { value: 'change-impact', label: 'Change Impact Analyzer (AI)', group: 'ai', feature: 'change-impact' },
  ];

  const handleMobileCalculatorChange = (value: string) => {
    setActiveTab(value as any);
    setIsMobileSidebarOpen(false);
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-6xl">
      <div className="section-spacing">
        <h2 className="text-xl font-semibold text-[#1a1a1a]">Engineering Tools</h2>
        <p className="text-[#888] mt-0.5 text-sm">Deterministic calculators for NEC compliance (Not AI).</p>
      </div>

      {/* Mobile Calculator Selector */}
      <div className="md:hidden mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Calculator</label>
        <select
          value={activeTab}
          onChange={(e) => handleMobileCalculatorChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#2d3b2d]/20 focus:border-[#2d3b2d]"
        >
          {calculatorOptions.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.feature && !hasFeature(opt.feature) ? `🔒 ${opt.label}` : opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
        {/* Vertical Sidebar Navigation - Hidden on mobile */}
        <div className="hidden md:block space-y-0.5 pr-4 border-r border-[#e8e6e3]">
          {/* General Calculators Section */}
          <p className="px-3 text-xs font-bold text-[#888] uppercase tracking-wider mb-2">General Calculators</p>
          <button
            onClick={() => setActiveTab('voltage-drop')}
            className={`w-full text-left px-3 py-2.5 text-sm font-medium border-l-4 transition-colors ${activeTab === 'voltage-drop' ? 'border-[#2d3b2d] bg-[#f0f5f0] text-[#1a1a1a]' : 'border-transparent text-[#888] hover:bg-gray-50 hover:text-gray-700'}`}
          >
            Voltage Drop (NEC 210.19)
          </button>
          <button
            onClick={() => setActiveTab('conductor-sizing')}
            className={`w-full text-left px-3 py-2.5 text-sm font-medium border-l-4 transition-colors ${activeTab === 'conductor-sizing' ? 'border-[#2d3b2d] bg-[#f0f5f0] text-[#1a1a1a]' : 'border-transparent text-[#888] hover:bg-gray-50 hover:text-gray-700'}`}
          >
            Conductor Sizing (NEC 310 + 250.122)
          </button>
          <button
            onClick={() => setActiveTab('conduit-fill')}
            className={`w-full text-left px-3 py-2.5 text-sm font-medium border-l-4 transition-colors ${activeTab === 'conduit-fill' ? 'border-[#2d3b2d] bg-[#f0f5f0] text-[#1a1a1a]' : 'border-transparent text-[#888] hover:bg-gray-50 hover:text-gray-700'}`}
          >
            Conduit Fill (Chapter 9)
          </button>
          <button
            onClick={() => setActiveTab('short-circuit')}
            className={`w-full text-left px-3 py-2.5 text-sm font-medium border-l-4 transition-colors ${activeTab === 'short-circuit' ? 'border-[#2d3b2d] bg-[#f0f5f0] text-[#1a1a1a]' : 'border-transparent text-[#888] hover:bg-gray-50 hover:text-gray-700'}`}
          >
            <span className="flex items-center justify-between">
              Short Circuit (NEC 110.9)
              {!hasFeature('short-circuit-basic') && <Lock className="w-3.5 h-3.5 text-[#888] flex-shrink-0" />}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('arc-flash')}
            className={`w-full text-left px-3 py-2.5 text-sm font-medium border-l-4 transition-colors ${activeTab === 'arc-flash' ? 'border-[#2d3b2d] bg-[#f0f5f0] text-[#1a1a1a]' : 'border-transparent text-[#888] hover:bg-gray-50 hover:text-gray-700'}`}
          >
            <span className="flex items-center justify-between">
              <span className="flex items-center gap-2"><Shield className="w-4 h-4" /> Arc Flash (NFPA 70E)</span>
              {!hasFeature('arc-flash') && <Lock className="w-3.5 h-3.5 text-[#888] flex-shrink-0" />}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('solar-pv')}
            className={`w-full text-left px-3 py-2.5 text-sm font-medium border-l-4 transition-colors ${activeTab === 'solar-pv' ? 'border-[#2d3b2d] bg-[#f0f5f0] text-[#1a1a1a]' : 'border-transparent text-[#888] hover:bg-gray-50 hover:text-gray-700'}`}
          >
            <span className="flex items-center gap-2"><Sun className="w-4 h-4" /> Solar PV (NEC 690)</span>
          </button>
          <button
            onClick={() => setActiveTab('service-upgrade')}
            className={`w-full text-left px-3 py-2.5 text-sm font-medium border-l-4 transition-colors ${activeTab === 'service-upgrade' ? 'border-[#2d3b2d] bg-[#f0f5f0] text-[#1a1a1a]' : 'border-transparent text-[#888] hover:bg-gray-50 hover:text-gray-700'}`}
          >
            <span className="flex items-center justify-between">
              <span className="flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Service Upgrade (NEC 230.42)</span>
              {!hasFeature('service-upgrade-wizard') && <Lock className="w-3.5 h-3.5 text-[#888] flex-shrink-0" />}
            </span>
          </button>

          {/* EV Calculators Section */}
          <div className="pt-4 mt-4 border-t border-[#e8e6e3]">
            <p className="px-3 text-xs font-bold text-green-600 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Car className="w-3 h-3" /> EV Calculators
            </p>
            <button
              onClick={() => setActiveTab('multi-family-ev')}
              className={`w-full text-left px-3 py-2.5 text-sm font-medium border-l-4 transition-colors ${activeTab === 'multi-family-ev' ? 'border-green-500 bg-green-50 text-[#1a1a1a]' : 'border-transparent text-[#888] hover:bg-gray-50 hover:text-gray-700'}`}
            >
              <span className="flex items-center justify-between">
                <span className="flex items-center gap-2"><Building2 className="w-4 h-4" /> Multi-Family EV (NEC 220.84)</span>
                {!hasFeature('multi-family-ev') && <Lock className="w-3.5 h-3.5 text-[#888] flex-shrink-0" />}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('ev-charging')}
              className={`w-full text-left px-3 py-2.5 text-sm font-medium border-l-4 transition-colors ${activeTab === 'ev-charging' ? 'border-green-500 bg-green-50 text-[#1a1a1a]' : 'border-transparent text-[#888] hover:bg-gray-50 hover:text-gray-700'}`}
            >
              <span className="flex items-center justify-between">
                <span className="flex items-center gap-2"><Car className="w-4 h-4" /> EV Charging (NEC 625)</span>
                {!hasFeature('ev-charging-calc') && <Lock className="w-3.5 h-3.5 text-[#888] flex-shrink-0" />}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('evems')}
              className={`w-full text-left px-3 py-2.5 text-sm font-medium border-l-4 transition-colors ${activeTab === 'evems' ? 'border-green-500 bg-green-50 text-[#1a1a1a]' : 'border-transparent text-[#888] hover:bg-gray-50 hover:text-gray-700'}`}
            >
              <span className="flex items-center justify-between">
                <span className="flex items-center gap-2"><Zap className="w-4 h-4" /> EVEMS Load Mgmt (NEC 625.42)</span>
                {!hasFeature('evems-calculator') && <Lock className="w-3.5 h-3.5 text-[#888] flex-shrink-0" />}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('ev-panel-builder')}
              className={`w-full text-left px-3 py-2.5 text-sm font-medium border-l-4 transition-colors ${activeTab === 'ev-panel-builder' ? 'border-green-500 bg-green-50 text-[#1a1a1a]' : 'border-transparent text-[#888] hover:bg-gray-50 hover:text-gray-700'}`}
            >
              <span className="flex items-center justify-between">
                <span className="flex items-center gap-2"><Zap className="w-4 h-4" /> EV Panel Builder</span>
                {!hasFeature('ev-panel-templates') && <Lock className="w-3.5 h-3.5 text-[#888] flex-shrink-0" />}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('circuit-sharing')}
              className={`w-full text-left px-3 py-2.5 text-sm font-medium border-l-4 transition-colors ${activeTab === 'circuit-sharing' ? 'border-green-500 bg-green-50 text-[#1a1a1a]' : 'border-transparent text-[#888] hover:bg-gray-50 hover:text-gray-700'}`}
            >
              <span className="flex items-center justify-between">
                <span className="flex items-center gap-2"><Zap className="w-4 h-4" /> Circuit Sharing (NEC 625)</span>
                {!hasFeature('circuit-sharing-calc') && <Lock className="w-3.5 h-3.5 text-[#888] flex-shrink-0" />}
              </span>
            </button>
          </div>

          {/* AI-Powered Tools Section */}
          <div className="pt-4 mt-4 border-t border-[#e8e6e3]">
            <p className="px-3 text-xs font-bold text-purple-600 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> AI-Powered Analysis
            </p>
            <button
              onClick={() => setActiveTab('change-impact')}
              className={`w-full text-left px-3 py-2.5 text-sm font-medium border-l-4 transition-colors ${activeTab === 'change-impact' ? 'border-purple-500 bg-purple-50 text-[#1a1a1a]' : 'border-transparent text-[#888] hover:bg-gray-50 hover:text-gray-700'}`}
            >
              <span className="flex items-center justify-between">
                <span className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> Change Impact Analyzer</span>
                {!hasFeature('change-impact') && <Lock className="w-3.5 h-3.5 text-[#888] flex-shrink-0" />}
              </span>
            </button>
          </div>
        </div>

        {/* Calculator Content Area */}
        <div className="bg-white border border-[#e8e6e3] rounded-lg card-padding shadow-sm min-h-0 md:min-h-[600px]">
          {/* Free-tier calculators — no gate */}
          {activeTab === 'voltage-drop' && <VoltageDropCalculator />}
          {activeTab === 'conductor-sizing' && <ConductorSizingTool projectSettings={defaultSettings} />}
          {activeTab === 'conduit-fill' && <ConduitFillCalculator />}
          {activeTab === 'solar-pv' && <SolarPVCalculator />}

          {/* Starter-tier */}
          {activeTab === 'short-circuit' && (
            <FeatureGate feature="short-circuit-basic">
              <ShortCircuitCalculator projectId={projectId} />
            </FeatureGate>
          )}

          {/* Pro-tier */}
          {activeTab === 'ev-charging' && (
            <FeatureGate feature="ev-charging-calc">
              <EVChargingCalculator />
            </FeatureGate>
          )}
          {activeTab === 'evems' && (
            <FeatureGate feature="evems-calculator">
              <EVEMSLoadManagement />
            </FeatureGate>
          )}
          {activeTab === 'service-upgrade' && (
            <FeatureGate feature="service-upgrade-wizard">
              <ServiceUpgradeWizard projectId={projectId} />
            </FeatureGate>
          )}
          {activeTab === 'circuit-sharing' && (
            <FeatureGate feature="circuit-sharing-calc">
              <CircuitSharingCalculator />
            </FeatureGate>
          )}
          <div style={{ display: activeTab === 'multi-family-ev' ? 'block' : 'none' }}>
            <FeatureGate feature="multi-family-ev">
              <MultiFamilyEVCalculator projectId={projectId} project={project} updateProject={updateProject} />
            </FeatureGate>
          </div>
          {activeTab === 'ev-panel-builder' && (
            <FeatureGate feature="ev-panel-templates">
              {project ? (
                <EVPanelTemplates project={project} />
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <AlertTriangle className="w-12 h-12 text-[#c9a227] mb-4" />
                  <h3 className="text-lg font-semibold text-[#1a1a1a] mb-2">Project Required</h3>
                  <p className="text-sm text-[#666]">
                    EV Panel Builder requires an active project. Please navigate to a project to use this tool.
                  </p>
                </div>
              )}
            </FeatureGate>
          )}

          {/* Business-tier */}
          {activeTab === 'arc-flash' && (
            <FeatureGate feature="arc-flash">
              <ArcFlashCalculator />
            </FeatureGate>
          )}
          {activeTab === 'change-impact' && (
            <FeatureGate feature="change-impact">
              <ChangeImpactAnalyzer projectId={projectId} />
            </FeatureGate>
          )}
        </div>
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
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="space-y-3">
           <h3 className="font-semibold text-[#1a1a1a] text-base">Input Parameters</h3>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

           <div className="pt-4 border-t border-[#e8e6e3]">
             <label className="flex items-center gap-2 text-sm text-[#666] cursor-pointer">
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
          <div className="bg-gray-50 rounded-lg p-6 flex flex-col justify-center">
             <div className="text-center mb-4">
               <div className="mb-1 text-xs text-[#888] uppercase tracking-wide">Voltage Drop</div>
               <div className="text-4xl font-light text-[#1a1a1a] mb-1 tabular-nums">{result.voltageDropVolts.toFixed(2)} V</div>
               <div className={`text-lg font-bold mb-3 tabular-nums ${result.isCompliant ? 'text-green-600' : 'text-red-600'}`}>
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
               <div className="space-y-1.5 mb-3">
                 {result.warnings.map((warning, idx) => (
                   <div key={idx} className="flex items-start gap-2 text-xs text-orange-700 bg-orange-50 p-2 rounded border border-orange-200">
                     <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                     <span>{warning}</span>
                   </div>
                 ))}
               </div>
             )}

             {/* Calculation Details */}
             <div className="text-xs text-[#666] space-y-0.5 bg-white p-3 rounded border border-[#e8e6e3]">
               <div className="font-semibold text-gray-700 mb-1 text-sm">AC Impedance Method (NEC Ch. 9 Table 9)</div>
               <div>Effective Z: <span className="tabular-nums">{result.effectiveZ} Ω/1000ft</span> @ 0.85 PF</div>
               <div>Distance: <span className="tabular-nums">{result.distance} ft</span> (one-way)</div>
               <div>Current: <span className="tabular-nums">{result.current} A</span></div>
               <div className="text-[#888] mt-1.5 pt-1.5 border-t border-[#e8e6e3] text-xs">
                 AC impedance accounts for skin effect and inductive reactance. 20-30% more accurate than K-factor for large conductors.
               </div>
             </div>
          </div>
        )}
      </div>

      {/* Comparison Table */}
      {showComparison && comparison && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-[#1a1a1a] mb-3 text-base">Method Comparison</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-blue-300">
                  <th className="text-left py-1.5 px-3 font-semibold text-gray-700 text-xs">Method</th>
                  <th className="text-right py-1.5 px-3 font-semibold text-gray-700 text-xs">Voltage Drop</th>
                  <th className="text-right py-1.5 px-3 font-semibold text-gray-700 text-xs">Percent</th>
                  <th className="text-left py-1.5 px-3 font-semibold text-gray-700 text-xs">Status</th>
                </tr>
              </thead>
              <tbody className="text-gray-800">
                <tr className="border-b border-blue-200 bg-white">
                  <td className="py-1.5 px-3 font-medium text-sm">AC Impedance (Accurate)</td>
                  <td className="text-right py-1.5 px-3 tabular-nums text-sm">{comparison.acImpedance.voltageDropVolts.toFixed(2)} V</td>
                  <td className="text-right py-1.5 px-3 tabular-nums text-sm">{comparison.acImpedance.voltageDropPercent.toFixed(2)}%</td>
                  <td className="py-1.5 px-3 text-sm">
                    {comparison.acImpedance.isCompliant ?
                      <span className="text-green-700">✓ Compliant</span> :
                      <span className="text-red-700">✗ Exceeds</span>
                    }
                  </td>
                </tr>
                <tr className="bg-white">
                  <td className="py-1.5 px-3 font-medium text-sm">K-Factor (Simplified)</td>
                  <td className="text-right py-1.5 px-3 tabular-nums text-sm">{comparison.kFactor.voltageDropVolts.toFixed(2)} V</td>
                  <td className="text-right py-1.5 px-3 tabular-nums text-sm">{comparison.kFactor.voltageDropPercent.toFixed(2)}%</td>
                  <td className="py-1.5 px-3 text-sm">
                    {comparison.kFactor.isCompliant ?
                      <span className="text-green-700">✓ Compliant</span> :
                      <span className="text-red-700">✗ Exceeds</span>
                    }
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-xs text-gray-700">
            <strong>Difference:</strong> <span className="tabular-nums">{Math.abs(comparison.difference.percentDifference)}%</span>
            ({comparison.difference.volts > 0 ? 'AC impedance shows higher' : 'K-factor shows higher'} voltage drop)
          </div>
        </div>
      )}
    </div>
  );
};

const ConduitFillCalculator: React.FC = () => {
  const [tradeSize, setTradeSize] = useState("1");
  const [conduitType, setConduitType] = useState<'EMT' | 'PVC-40' | 'RMC'>('EMT');
  const [wireType, setWireType] = useState<'THHN' | 'THW' | 'XHHW'>('THHN');

  // Support for multiple wire groups (combinations)
  interface WireGroup {
    id: string;
    size: string;
    quantity: number;
  }

  const [wireGroups, setWireGroups] = useState<WireGroup[]>([
    { id: '1', size: '12 AWG', quantity: 3 }
  ]);

  const addWireGroup = () => {
    setWireGroups([...wireGroups, {
      id: Date.now().toString(),
      size: '12 AWG',
      quantity: 1
    }]);
  };

  const removeWireGroup = (id: string) => {
    if (wireGroups.length > 1) {
      setWireGroups(wireGroups.filter(g => g.id !== id));
    }
  };

  const updateWireGroup = (id: string, field: 'size' | 'quantity', value: string | number) => {
    setWireGroups(wireGroups.map(g =>
      g.id === id ? { ...g, [field]: value } : g
    ));
  };

  // Get conduit dimensions
  const conduitDimensions = getConduitDimensions(tradeSize, conduitType);

  // Calculate total wire area
  let totalWireArea = 0;
  let totalWireCount = 0;
  const wireDetails: Array<{size: string; quantity: number; area: number; totalArea: number}> = [];

  wireGroups.forEach(group => {
    const conductorDim = getConductorDimensions(group.size, wireType);
    if (conductorDim) {
      const groupArea = conductorDim.area * group.quantity;
      totalWireArea += groupArea;
      totalWireCount += group.quantity;
      wireDetails.push({
        size: group.size,
        quantity: group.quantity,
        area: conductorDim.area,
        totalArea: groupArea
      });
    }
  });

  // Determine maximum fill percentage based on number of conductors (NEC Chapter 9, Table 1)
  let maxFillPercent = 40; // Default for 3+ conductors
  let maxFillArea = conduitDimensions?.area40 || 0;

  if (totalWireCount === 1) {
    maxFillPercent = 53;
    maxFillArea = conduitDimensions?.area53 || 0;
  } else if (totalWireCount === 2) {
    maxFillPercent = 31;
    maxFillArea = conduitDimensions?.area31 || 0;
  }

  const fillPercent = conduitDimensions ? (totalWireArea / conduitDimensions.totalArea) * 100 : 0;
  const isCompliant = fillPercent <= maxFillPercent;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
      {/* Left Column - Configuration */}
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold text-[#1a1a1a] mb-3 text-base">Raceway Configuration</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="label-xs">Conduit Type</label>
              <select
                value={conduitType}
                onChange={e => setConduitType(e.target.value as 'EMT' | 'PVC-40' | 'RMC')}
                className="input-std"
              >
                <option value="EMT">EMT</option>
                <option value="PVC-40">PVC Schedule 40</option>
                <option value="RMC">RMC (Rigid Metal)</option>
              </select>
            </div>
            <div>
              <label className="label-xs">Trade Size</label>
              <select
                value={tradeSize}
                onChange={e => setTradeSize(e.target.value)}
                className="input-std"
              >
                <option value="1/2">1/2"</option>
                <option value="3/4">3/4"</option>
                <option value="1">1"</option>
                <option value="1-1/4">1-1/4"</option>
                <option value="1-1/2">1-1/2"</option>
                <option value="2">2"</option>
                <option value="2-1/2">2-1/2"</option>
                <option value="3">3"</option>
                <option value="3-1/2">3-1/2"</option>
                <option value="4">4"</option>
              </select>
            </div>
          </div>

          <div className="mb-3">
            <label className="label-xs">Conductor Insulation Type</label>
            <select
              value={wireType}
              onChange={e => setWireType(e.target.value as 'THHN' | 'THW' | 'XHHW')}
              className="input-std"
            >
              <option value="THHN">THHN/THWN-2 (90°C Dry)</option>
              <option value="THW">THW/THW-2 (75°C Wet)</option>
              <option value="XHHW">XHHW-2/RHW-2 (90°C)</option>
            </select>
          </div>
        </div>

        {/* Wire Groups */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-[#1a1a1a] text-base">Conductors</h3>
            <button
              onClick={addWireGroup}
              className="flex items-center gap-1.5 text-xs bg-[#2d3b2d] text-black px-3 py-2 rounded font-semibold hover:bg-[#3d4f3d] transition-all shadow-sm hover:shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Group
            </button>
          </div>

          <div className="space-y-2">
            {wireGroups.map((group, index) => (
              <div key={group.id} className="p-3 border border-[#e8e6e3] rounded bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-[#888]">GROUP {index + 1}</span>
                  {wireGroups.length > 1 && (
                    <button
                      onClick={() => removeWireGroup(group.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label-xs">Wire Size</label>
                    <select
                      value={group.size}
                      onChange={e => updateWireGroup(group.id, 'size', e.target.value)}
                      className="input-std text-sm"
                    >
                      {STANDARD_WIRE_SIZES.map(size => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label-xs">Quantity</label>
                    <input
                      type="number"
                      value={group.quantity}
                      onChange={e => updateWireGroup(group.id, 'quantity', Number(e.target.value))}
                      min="1"
                      max="100"
                      className="input-std"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column - Results */}
      <div className="space-y-4">
        {/* Fill Percentage Display */}
        <div className="bg-gray-50 rounded-lg p-6 flex flex-col justify-center items-center text-center">
          <div className="mb-1 text-xs text-[#888] uppercase tracking-wide">Fill Percentage</div>
          <div className="text-4xl font-light text-[#1a1a1a] mb-1 tabular-nums">{fillPercent.toFixed(1)}%</div>
          <div className="text-xs text-[#888] mb-3">
            <span className="tabular-nums">{totalWireCount}</span> conductor{totalWireCount !== 1 ? 's' : ''} • Max <span className="tabular-nums">{maxFillPercent}%</span>
          </div>

          <div className="w-full bg-gray-200 h-4 rounded-full mb-6 overflow-hidden max-w-xs">
            <div
              className={`h-full transition-all ${isCompliant ? 'bg-[#2d3b2d]' : 'bg-red-500'}`}
              style={{ width: `${Math.min(fillPercent, 100)}%` }}
            />
          </div>

          <div className="flex items-center gap-2">
            {isCompliant ? (
              <div className="flex items-center gap-2 text-green-700 bg-green-100 px-4 py-2 rounded-full text-sm font-bold">
                <CheckCircle className="w-4 h-4" /> NEC Compliant
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-700 bg-red-100 px-4 py-2 rounded-full text-sm font-bold">
                <XCircle className="w-4 h-4" /> Overfilled
              </div>
            )}
          </div>
        </div>

        {/* Calculation Breakdown */}
        <div className="bg-white border border-[#e8e6e3] rounded-lg p-4">
          <h4 className="text-sm font-bold text-[#1a1a1a] mb-3">Calculation Breakdown</h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-2 border-b border-[#e8e6e3]">
              <span className="text-[#666]">Conduit Area (100%)</span>
              <span className="font-mono font-semibold">{conduitDimensions?.totalArea.toFixed(4)} in²</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#e8e6e3]">
              <span className="text-[#666]">Max Fill Area ({maxFillPercent}%)</span>
              <span className="font-mono font-semibold">{maxFillArea.toFixed(4)} in²</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#e8e6e3]">
              <span className="text-[#666]">Total Wire Area</span>
              <span className="font-mono font-semibold">{totalWireArea.toFixed(4)} in²</span>
            </div>
            {wireDetails.map((detail, idx) => (
              <div key={idx} className="flex justify-between py-1 pl-4 text-[#888]">
                <span>({detail.quantity}) {detail.size}</span>
                <span className="font-mono">{detail.totalArea.toFixed(4)} in²</span>
              </div>
            ))}
          </div>
        </div>

        {/* NEC Reference */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-xs font-bold text-blue-900 mb-2">NEC References</div>
          <ul className="space-y-1 text-xs text-blue-800">
            <li>• NEC Chapter 9, Table 1 - Percent of Cross Section</li>
            <li>• NEC Chapter 9, Table 4 - Conduit Dimensions</li>
            <li>• NEC Chapter 9, Table 5 - Conductor Dimensions ({wireType})</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

interface ShortCircuitCalculatorProps {
  projectId?: string;
}

const ShortCircuitCalculator: React.FC<ShortCircuitCalculatorProps> = ({ projectId }) => {
  // Project ID now passed as prop instead of using useParams

  // Hooks for save functionality
  const { createCalculation } = useShortCircuitCalculations(projectId);
  const { panels } = usePanels(projectId);

  // Save modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [selectedPanelId, setSelectedPanelId] = useState<string>('');
  const [saveNotes, setSaveNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [mode, setMode] = useState<'service' | 'panel'>('service');

  // Service calculation inputs
  const [serviceAmps, setServiceAmps] = useState(200);
  const [serviceVoltage, setServiceVoltage] = useState(240);
  const [servicePhase, setServicePhase] = useState<1 | 3>(1);
  const [transformerKVA, setTransformerKVA] = useState<number | null>(null);
  const [transformerImpedance, setTransformerImpedance] = useState(2.5);

  // Update transformer impedance default when phase changes (if transformer kVA is not manually set)
  React.useEffect(() => {
    if (transformerKVA === null) {
      // Only auto-update if using auto-estimate (no manual kVA)
      setTransformerImpedance(servicePhase === 3 ? 5.75 : 2.5);
    }
  }, [servicePhase, transformerKVA]);

  // Service conductor parameters (transformer to service panel)
  const [serviceConductorLength, setServiceConductorLength] = useState(50);
  const [serviceConductorSize, setServiceConductorSize] = useState('3/0 AWG');
  const [serviceConductorMaterial, setServiceConductorMaterial] = useState<'Cu' | 'Al'>('Cu');
  const [serviceConduitType, setServiceConduitType] = useState<'Steel' | 'PVC' | 'Aluminum'>('Steel');
  const [serviceSetsInParallel, setServiceSetsInParallel] = useState(1);

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
        : estimateUtilityTransformer(serviceAmps, serviceVoltage, servicePhase, transformerImpedance);

      // Service conductor parameters (transformer to service panel)
      const serviceConductor = {
        length: serviceConductorLength,
        conductorSize: serviceConductorSize,
        material: serviceConductorMaterial,
        conduitType: serviceConduitType,
        setsInParallel: serviceSetsInParallel
      };

      serviceResult = calculateServiceFaultCurrent(transformer, serviceVoltage, servicePhase, serviceConductor);
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

  // Save calculation handler
  const handleSave = async () => {
    if (!projectId || !result) return;

    setSaving(true);
    try {
      // Service mode always saves to "Service Entrance" with no panel association
      const locationName = mode === 'service'
        ? "Service Entrance"
        : (selectedPanelId
            ? panels.find(p => p.id === selectedPanelId)?.name || "Unknown Panel"
            : "Service Entrance");

      await createCalculation({
        project_id: projectId,
        panel_id: mode === 'service' ? null : (selectedPanelId || null),
        location_name: locationName,
        calculation_type: mode,
        // Service inputs
        service_amps: mode === 'service' ? serviceAmps : null,
        service_voltage: mode === 'service' ? serviceVoltage : null,
        service_phase: mode === 'service' ? servicePhase : null,
        transformer_kva: mode === 'service' && transformerKVA !== null ? transformerKVA : null,
        transformer_impedance: mode === 'service' ? transformerImpedance : null,
        // Service conductor parameters
        service_conductor_length: mode === 'service' ? serviceConductorLength : null,
        service_conductor_size: mode === 'service' ? serviceConductorSize : null,
        service_conductor_material: mode === 'service' ? serviceConductorMaterial : null,
        service_conduit_type: mode === 'service' ? serviceConduitType : null,
        // Panel inputs
        source_fault_current: mode === 'panel' ? sourceFaultCurrent : null,
        feeder_length: mode === 'panel' ? feederLength : null,
        feeder_conductor_size: mode === 'panel' ? feederSize : null,
        feeder_material: mode === 'panel' ? 'Cu' : null,
        feeder_conduit_type: mode === 'panel' ? 'Steel' : null,
        feeder_voltage: mode === 'panel' ? feederVoltage : null,
        feeder_phase: mode === 'panel' ? feederPhase : null,
        // Results
        results: result as any,
        notes: saveNotes || null,
      });

      // Reset modal
      setShowSaveModal(false);
      setSelectedPanelId('');
      setSaveNotes('');
      alert('Calculation saved successfully!');
    } catch (error) {
      console.error('Failed to save calculation:', error);
      alert('Failed to save calculation. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Mode Selector */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setMode('service')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mode === 'service'
              ? 'bg-white text-[#1a1a1a] shadow-sm'
              : 'text-[#666] hover:text-[#1a1a1a]'
          }`}
        >
          Service Entrance
        </button>
        <button
          onClick={() => setMode('panel')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mode === 'panel'
              ? 'bg-white text-[#1a1a1a] shadow-sm'
              : 'text-[#666] hover:text-[#1a1a1a]'
          }`}
        >
          Downstream Panel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Input Section */}
        <div className="space-y-3">
          <h3 className="font-semibold text-[#1a1a1a] text-base">
            {mode === 'service' ? 'Service Parameters' : 'Feeder Parameters'}
          </h3>

          {mode === 'service' ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

              <div className="pt-3 border-t border-[#e8e6e3]">
                <h4 className="text-xs font-semibold text-gray-700 mb-2">Utility Transformer (Optional)</h4>
                <p className="text-xs text-[#888] mb-2">
                  <strong>Auto mode:</strong> Leave kVA blank to estimate based on service size<br/>
                  <strong>Manual mode:</strong> Enter kVA when transformer is known from utility specs
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <p className="text-xs text-[#888] mt-2">
                  Typical impedance: 2.5% (1φ), 5.75% (3φ) • For final design, obtain actual kVA and %Z from utility
                </p>
              </div>

              <div className="pt-4 border-t border-[#e8e6e3]">
                <h4 className="text-xs font-bold text-gray-700 mb-3">Service Conductors</h4>
                <p className="text-xs text-[#888] mb-3">
                  Parameters from utility transformer to service panel
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label-xs">Conductor Length (ft)</label>
                    <input
                      type="number"
                      value={serviceConductorLength}
                      onChange={(e) => setServiceConductorLength(Number(e.target.value))}
                      className="input-std"
                    />
                  </div>
                  <div>
                    <label className="label-xs">Conductor Size</label>
                    <select
                      value={serviceConductorSize}
                      onChange={(e) => setServiceConductorSize(e.target.value)}
                      className="input-std"
                    >
                      <option value="1/0 AWG">1/0 AWG</option>
                      <option value="2/0 AWG">2/0 AWG</option>
                      <option value="3/0 AWG">3/0 AWG</option>
                      <option value="4/0 AWG">4/0 AWG</option>
                      <option value="250 kcmil">250 kcmil</option>
                      <option value="300 kcmil">300 kcmil</option>
                      <option value="350 kcmil">350 kcmil</option>
                      <option value="400 kcmil">400 kcmil</option>
                      <option value="500 kcmil">500 kcmil</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-xs">Material</label>
                    <select
                      value={serviceConductorMaterial}
                      onChange={(e) => setServiceConductorMaterial(e.target.value as 'Cu' | 'Al')}
                      className="input-std"
                    >
                      <option value="Cu">Copper</option>
                      <option value="Al">Aluminum</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-xs">Conduit Type</label>
                    <select
                      value={serviceConduitType}
                      onChange={(e) => setServiceConduitType(e.target.value as 'Steel' | 'PVC' | 'Aluminum')}
                      className="input-std"
                    >
                      <option value="Steel">Steel (EMT/RMC)</option>
                      <option value="PVC">PVC</option>
                      <option value="Aluminum">Aluminum</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-xs">Sets in Parallel</label>
                    <select
                      value={serviceSetsInParallel}
                      onChange={(e) => setServiceSetsInParallel(Number(e.target.value))}
                      className="input-std"
                    >
                      <option value={1}>1 (Single Set)</option>
                      <option value={2}>2 Parallel Sets</option>
                      <option value={3}>3 Parallel Sets</option>
                      <option value={4}>4 Parallel Sets</option>
                    </select>
                  </div>
                </div>
                <p className="text-xs text-[#888] mt-2">
                  Typical overhead: 50-150 ft • Underground: 25-100 ft<br/>
                  Parallel sets: Common for 400A+ services (reduces impedance, increases fault current)
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
                  <p className="text-xs text-[#888] mt-1">
                    Available fault current at upstream panel/service
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div className="mb-2 text-sm text-[#888] uppercase tracking-wide">
                {mode === 'service' ? 'Service Fault Current' : 'Panel Fault Current'}
              </div>
              <div className="text-5xl font-light text-[#1a1a1a] mb-2">
                {(result.faultCurrent / 1000).toFixed(1)} kA
              </div>
              <div className="text-xl text-[#666] mb-4">
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
            <div className="text-xs text-[#666] space-y-2 bg-white p-4 rounded border border-[#e8e6e3]">
              <div className="font-bold text-gray-700 mb-2">Calculation Details</div>
              <div className="grid grid-cols-2 gap-2">
                <span className="text-[#888]">Source If:</span>
                <span className="font-mono text-right">{result.details.sourceFaultCurrent.toLocaleString()} A</span>

                {mode === 'panel' && (
                  <>
                    <span className="text-[#888]">Conductor Z:</span>
                    <span className="font-mono text-right">{result.details.conductorImpedance.toFixed(4)} Ω</span>
                  </>
                )}

                <span className="text-[#888]">Total Z:</span>
                <span className="font-mono text-right">{result.details.totalImpedance.toFixed(4)} Ω</span>

                <span className="text-[#888]">Safety Factor:</span>
                <span className="font-mono text-right">{result.details.safetyFactor}×</span>
              </div>

              <div className="text-[#888] mt-3 pt-3 border-t border-[#e8e6e3] text-xs">
                <strong>Standard AIC Ratings:</strong> {STANDARD_AIC_RATINGS.join(', ')} kA
              </div>
            </div>

            {/* Important Notes */}
            <div className="mt-4 bg-[#c9a227]50 border border-[#c9a227]/40 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-[#9a7b00] flex-shrink-0 mt-0.5" />
                <div className="text-xs text-[#7a6200]">
                  <strong>Important:</strong> Verify actual utility fault current with local utility company. This calculator provides estimates for preliminary design only.
                </div>
              </div>
            </div>

            {/* Save to Project Button */}
            {projectId && (
              <div className="mt-4">
                <button
                  onClick={() => setShowSaveModal(true)}
                  className="w-full bg-gray-900 hover:bg-black text-white px-4 py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save to Project
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-[#1a1a1a]">Save Calculation</h3>
              <button
                onClick={() => setShowSaveModal(false)}
                className="text-[#888] hover:text-[#666]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Associate with Panel
                </label>
                {mode === 'service' ? (
                  <>
                    <div className="input-std w-full bg-gray-50 text-[#1a1a1a] font-medium cursor-not-allowed">
                      Service Entrance (MDP)
                    </div>
                    <p className="text-xs text-[#888] mt-1">
                      Service mode calculates fault current at the main service entrance
                    </p>
                  </>
                ) : (
                  <>
                    <select
                      value={selectedPanelId}
                      onChange={(e) => setSelectedPanelId(e.target.value)}
                      className="input-std w-full"
                    >
                      <option value="">Service Entrance</option>
                      {panels.map(panel => (
                        <option key={panel.id} value={panel.id}>
                          {panel.name} ({panel.bus_rating}A, {panel.voltage}V)
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-[#888] mt-1">
                      Select the downstream panel for this calculation
                    </p>
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={saveNotes}
                  onChange={(e) => setSaveNotes(e.target.value)}
                  placeholder="Add any notes about this calculation..."
                  className="input-std w-full h-24 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Calculation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Educational Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h4 className="font-bold text-[#1a1a1a] mb-3 flex items-center gap-2">
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
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Input Section */}
        <div className="space-y-3">
          <h3 className="font-semibold text-[#1a1a1a] flex items-center gap-2 text-base">
            <Car className="w-4 h-4 text-[#2d3b2d]" /> Charger Configuration
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase mb-1">Charger Level</label>
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
                className="w-full border-[#e8e6e3] rounded text-sm py-2 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
              >
                <option value="Level1">Level 1 (120V)</option>
                <option value="Level2">Level 2 (240V)</option>
                <option value="Level3_DCFC">Level 3 DC Fast Charger</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase mb-1">Charger Amps</label>
              <select
                value={chargerAmps}
                onChange={e => setChargerAmps(Number(e.target.value))}
                className="w-full border-[#e8e6e3] rounded text-sm py-2 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
              >
                {chargerOptions.map(opt => (
                  <option key={opt.maxAmps} value={opt.maxAmps}>
                    {opt.maxAmps}A ({opt.power_kw} kW)
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase mb-1">Voltage</label>
              <select
                value={voltage}
                onChange={e => setVoltage(Number(e.target.value))}
                className="w-full border-[#e8e6e3] rounded text-sm py-2 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
              >
                <option value="120">120V</option>
                <option value="208">208V</option>
                <option value="240">240V</option>
                <option value="480">480V</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase mb-1">Phase</label>
              <select
                value={phase}
                onChange={e => setPhase(Number(e.target.value) as 1 | 3)}
                className="w-full border-[#e8e6e3] rounded text-sm py-2 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
              >
                <option value={1}>Single Phase</option>
                <option value={3}>Three Phase</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase mb-1">Number of Chargers</label>
              <input
                type="number"
                min={1}
                max={50}
                value={numChargers}
                onChange={e => setNumChargers(Number(e.target.value))}
                className="w-full border-[#e8e6e3] rounded text-sm py-2 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase mb-1">Simultaneous Use %</label>
              <input
                type="number"
                min={10}
                max={100}
                value={simultaneousUse}
                onChange={e => setSimultaneousUse(Number(e.target.value))}
                className="w-full border-[#e8e6e3] rounded text-sm py-2 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase mb-1">Circuit Length (ft)</label>
              <input
                type="number"
                min={1}
                value={circuitLength}
                onChange={e => setCircuitLength(Number(e.target.value))}
                className="w-full border-[#e8e6e3] rounded text-sm py-2 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase mb-1">Conductor Material</label>
              <select
                value={material}
                onChange={e => setMaterial(e.target.value as 'Cu' | 'Al')}
                className="w-full border-[#e8e6e3] rounded text-sm py-2 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
              >
                <option value="Cu">Copper</option>
                <option value="Al">Aluminum</option>
              </select>
            </div>
          </div>

          {/* Charging Time Estimator */}
          <div className="bg-gray-50 border border-[#e8e6e3] rounded-lg p-4 mt-4">
            <h4 className="font-medium text-gray-800 mb-3">Charging Time Estimator</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-[#888] mb-1">Battery (kWh)</label>
                <input
                  type="number"
                  value={batteryCapacity}
                  onChange={e => setBatteryCapacity(Number(e.target.value))}
                  className="w-full border-[#e8e6e3] rounded text-sm py-1 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
                />
              </div>
              <div>
                <label className="block text-xs text-[#888] mb-1">Start SOC %</label>
                <input
                  type="number"
                  value={currentSOC}
                  onChange={e => setCurrentSOC(Number(e.target.value))}
                  className="w-full border-[#e8e6e3] rounded text-sm py-1 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
                />
              </div>
              <div>
                <label className="block text-xs text-[#888] mb-1">Target SOC %</label>
                <input
                  type="number"
                  value={targetSOC}
                  onChange={e => setTargetSOC(Number(e.target.value))}
                  className="w-full border-[#e8e6e3] rounded text-sm py-1 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
                />
              </div>
            </div>
            <div className="mt-3 text-center">
              <span className="text-2xl font-bold text-[#2d3b2d]">
                {chargingTime.hours}h {chargingTime.minutes}m
              </span>
              <span className="text-[#888] text-sm ml-2">estimated</span>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="space-y-4">
          <h3 className="font-bold text-[#1a1a1a]">Sizing Results (NEC 625)</h3>
          
          {result && (
            <div className="space-y-4">
              {/* Circuit Sizing */}
              <div className="bg-[#f0f5f0] border border-[#2d3b2d]/30 rounded-lg p-4">
                <h4 className="font-medium text-[#1a231a] mb-2">Per-Circuit Requirements</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span className="text-[#666]">Circuit Breaker:</span>
                  <span className="font-bold">{result.circuitBreakerAmps}A</span>
                  <span className="text-[#666]">Conductor Size:</span>
                  <span className="font-bold">{result.conductorSize}</span>
                  <span className="text-[#666]">EGC Size:</span>
                  <span className="font-bold">{result.egcSize}</span>
                </div>
              </div>

              {/* System Load */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">System Load (per NEC 625.44)</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span className="text-[#666]">Total Connected Load:</span>
                  <span className="font-bold">{result.totalConnectedLoad_kVA} kVA</span>
                  <span className="text-[#666]">Demand Factor:</span>
                  <span className="font-bold">{(result.demandFactor * 100).toFixed(0)}%</span>
                  <span className="text-[#666]">Demand Load:</span>
                  <span className="font-bold">{result.demandLoad_kVA} kVA</span>
                </div>
              </div>

              {/* Voltage Drop */}
              <div className={`rounded-lg p-4 ${result.meetsVoltageDrop ? 'bg-green-50 border-green-200' : 'bg-[#c9a227]50 border-[#c9a227]/40'} border`}>
                <div className="flex items-center gap-2 mb-2">
                  {result.meetsVoltageDrop ? <CheckCircle className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-[#c9a227]" />}
                  <h4 className={`font-medium ${result.meetsVoltageDrop ? 'text-green-800' : 'text-[#7a6200]'}`}>Voltage Drop</h4>
                </div>
                <span className="text-xl font-bold">{result.voltageDropPercent}%</span>
                <span className="text-[#888] text-sm ml-2">(≤3% recommended)</span>
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
              <div className="bg-gray-50 border border-[#e8e6e3] rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-2">NEC References</h4>
                <ul className="text-xs text-[#666] space-y-1">
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
  const [selectedPanel, setSelectedPanel] = useState(COMMON_PV_PANELS[2] || COMMON_PV_PANELS[0]!); // 400W default
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
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Input Section */}
        <div className="space-y-3">
          <h3 className="font-semibold text-[#1a1a1a] flex items-center gap-2 text-base">
            <Sun className="w-4 h-4 text-[#c9a227]" /> System Configuration
          </h3>

          {/* Panel Selection */}
          <div className="bg-[#c9a227]50 border border-[#c9a227]/40 rounded-lg p-3">
            <h4 className="font-semibold text-[#7a6200] mb-2 text-sm">PV Panel Selection</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="col-span-2">
                <label className="block text-xs text-[#888] mb-1">Panel Type</label>
                <select
                  value={selectedPanel.watts}
                  onChange={e => setSelectedPanel(COMMON_PV_PANELS.find(p => p.watts === Number(e.target.value)) || COMMON_PV_PANELS[2] || COMMON_PV_PANELS[0]!)}
                  className="w-full border-[#e8e6e3] rounded text-sm py-2 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
                >
                  {COMMON_PV_PANELS.map(panel => (
                    <option key={panel.watts} value={panel.watts}>
                      {panel.name} - Voc: {panel.voc}V, Isc: {panel.isc}A
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#888] mb-1">Number of Panels</label>
                <input
                  type="number"
                  min={1}
                  value={numPanels}
                  onChange={e => setNumPanels(Number(e.target.value))}
                  className="w-full border-[#e8e6e3] rounded text-sm py-2 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
                />
              </div>
              <div>
                <label className="block text-xs text-[#888] mb-1">Panels per String</label>
                <input
                  type="number"
                  min={1}
                  max={maxPanelsPerString}
                  value={panelsPerString}
                  onChange={e => setPanelsPerString(Number(e.target.value))}
                  className="w-full border-[#e8e6e3] rounded text-sm py-2 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
                />
              </div>
            </div>
            <div className="mt-2 text-xs text-[#666]">
              System Size: <strong>{systemSize.toFixed(1)} kW DC</strong> • 
              Strings: <strong>{numStrings}</strong> •
              Max panels/string: <strong>{maxPanelsPerString}</strong>
            </div>
          </div>

          {/* Inverter Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase mb-1">Inverter Type</label>
              <select
                value={inverterType}
                onChange={e => setInverterType(e.target.value as any)}
                className="w-full border-[#e8e6e3] rounded text-sm py-2 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
              >
                <option value="string">String Inverter</option>
                <option value="microinverter">Microinverters</option>
                <option value="dc_optimized">DC Optimizers</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase mb-1">Inverter Power (kW)</label>
              <input
                type="number"
                step={0.1}
                value={inverterPower}
                onChange={e => setInverterPower(Number(e.target.value))}
                className="w-full border-[#e8e6e3] rounded text-sm py-2 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase mb-1">Max DC Voltage (V)</label>
              <input
                type="number"
                value={inverterMaxVdc}
                onChange={e => setInverterMaxVdc(Number(e.target.value))}
                className="w-full border-[#e8e6e3] rounded text-sm py-2 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase mb-1">AC Voltage</label>
              <select
                value={acVoltage}
                onChange={e => setAcVoltage(Number(e.target.value))}
                className="w-full border-[#e8e6e3] rounded text-sm py-2 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
              >
                <option value="208">208V</option>
                <option value="240">240V</option>
                <option value="480">480V</option>
              </select>
            </div>
          </div>

          {/* Installation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase mb-1">Mount Type</label>
              <select
                value={roofType}
                onChange={e => setRoofType(e.target.value as any)}
                className="w-full border-[#e8e6e3] rounded text-sm py-2 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
              >
                <option value="flush_mount">Flush Mount (Roof)</option>
                <option value="rack_mount">Rack Mount</option>
                <option value="ground_mount">Ground Mount</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase mb-1">Conductor Material</label>
              <select
                value={material}
                onChange={e => setMaterial(e.target.value as 'Cu' | 'Al')}
                className="w-full border-[#e8e6e3] rounded text-sm py-2 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
              >
                <option value="Cu">Copper</option>
                <option value="Al">Aluminum</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase mb-1">DC Run Length (ft)</label>
              <input
                type="number"
                value={dcLength}
                onChange={e => setDcLength(Number(e.target.value))}
                className="w-full border-[#e8e6e3] rounded text-sm py-2 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase mb-1">AC Run Length (ft)</label>
              <input
                type="number"
                value={acLength}
                onChange={e => setAcLength(Number(e.target.value))}
                className="w-full border-[#e8e6e3] rounded text-sm py-2 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
              />
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="space-y-4">
          <h3 className="font-bold text-[#1a1a1a]">Sizing Results (NEC 690)</h3>
          
          {result && (
            <div className="space-y-4">
              {/* DC Side */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">DC Side (String)</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span className="text-[#666]">String Voc:</span>
                  <span className="font-bold">{result.stringVoc}V</span>
                  <span className="text-[#666]">Corrected Voc:</span>
                  <span className="font-bold">{result.stringVocCorrected}V</span>
                  <span className="text-[#666]">String Isc:</span>
                  <span className="font-bold">{result.stringIsc}A</span>
                  <span className="text-[#666]">DC OCPD:</span>
                  <span className="font-bold">{result.dcOcpdRating}A</span>
                  <span className="text-[#666]">DC Conductor:</span>
                  <span className="font-bold">{result.dcConductorSize}</span>
                  <span className="text-[#666]">DC Voltage Drop:</span>
                  <span className="font-bold">{result.dcVoltageDrop}%</span>
                </div>
              </div>

              {/* AC Side */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-800 mb-2">AC Side (Inverter Output)</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span className="text-[#666]">AC Current:</span>
                  <span className="font-bold">{result.acCurrent}A</span>
                  <span className="text-[#666]">AC Breaker:</span>
                  <span className="font-bold">{result.acOcpdRating}A</span>
                  <span className="text-[#666]">AC Conductor:</span>
                  <span className="font-bold">{result.acConductorSize}</span>
                  <span className="text-[#666]">AC Voltage Drop:</span>
                  <span className="font-bold">{result.acVoltageDrop}%</span>
                </div>
              </div>

              {/* 120% Rule Check */}
              <div className={`rounded-lg p-4 ${result.meetsNec120Rule ? 'bg-green-50 border-green-200' : 'bg-[#c9a227]50 border-[#c9a227]/40'} border`}>
                <div className="flex items-center gap-2 mb-2">
                  {result.meetsNec120Rule ? <CheckCircle className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-[#c9a227]" />}
                  <h4 className={`font-medium ${result.meetsNec120Rule ? 'text-green-800' : 'text-[#7a6200]'}`}>NEC 705.12 (120% Rule)</h4>
                </div>
                <p className="text-sm text-[#666]">
                  Max backfeed for 200A panel: <strong>{result.maxBackfeedAmps}A</strong>
                </p>
                {!result.meetsNec120Rule && (
                  <p className="text-sm text-[#9a7b00] mt-1">
                    Consider supply-side connection per NEC 705.12(A)
                  </p>
                )}
              </div>

              {/* Production Estimate */}
              <div className="bg-[#c9a227]50 border border-[#c9a227]/40 rounded-lg p-4">
                <h4 className="font-medium text-[#7a6200] mb-2">Production Estimate</h4>
                <div className="text-center">
                  <span className="text-3xl font-bold text-[#c9a227]">
                    {(result.estimatedAnnualProduction_kWh / 1000).toFixed(1)} MWh
                  </span>
                  <span className="text-[#888] text-sm ml-2">/year</span>
                </div>
                <div className="text-center mt-1">
                  <span className="text-lg font-medium text-gray-700">
                    {result.estimatedMonthlyProduction_kWh.toLocaleString()} kWh
                  </span>
                  <span className="text-[#888] text-sm ml-2">/month avg</span>
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
              <div className="bg-gray-50 border border-[#e8e6e3] rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-2">NEC References</h4>
                <ul className="text-xs text-[#666] space-y-1">
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
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="space-y-3">
          <h3 className="font-semibold text-[#1a1a1a] flex items-center gap-2 text-base">
            <Shield className="w-4 h-4 text-[#2d3b2d]" /> System Parameters
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase mb-1">Short Circuit Current (kA)</label>
              <input type="number" value={shortCircuitCurrent} onChange={e => setShortCircuitCurrent(Number(e.target.value))} min="0.1" max="200" step="0.1" className="w-full border-[#e8e6e3] rounded text-sm py-2 px-3 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase mb-1">Voltage (V)</label>
              <select value={voltage} onChange={e => setVoltage(Number(e.target.value))} className="w-full border-[#e8e6e3] rounded text-sm py-2 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20">
                <option value="120">120V</option>
                <option value="208">208V</option>
                <option value="240">240V</option>
                <option value="277">277V</option>
                <option value="480">480V</option>
                <option value="600">600V</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase mb-1">Phase</label>
              <select value={phase} onChange={e => setPhase(Number(e.target.value) as 1 | 3)} className="w-full border-[#e8e6e3] rounded text-sm py-2 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20">
                <option value="1">Single-Phase</option>
                <option value="3">Three-Phase</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase mb-1">Equipment Type</label>
              <select value={equipmentType} onChange={e => { setEquipmentType(e.target.value as EquipmentType); setWorkingDistance(undefined); }} className="w-full border-[#e8e6e3] rounded text-sm py-2 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20">
                <option value="switchgear">Switchgear (36")</option>
                <option value="panelboard">Panelboard (24")</option>
                <option value="mcc">MCC (24")</option>
                <option value="motor_control">Motor Control (18")</option>
                <option value="cable">Cable (18")</option>
                <option value="open_air">Open Air (36")</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase mb-1">Protective Device</label>
              <select value={protectiveDevice} onChange={e => setProtectiveDevice(e.target.value as ProtectiveDeviceType)} className="w-full border-[#e8e6e3] rounded text-sm py-2 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20">
                <option value="circuit_breaker">Circuit Breaker</option>
                <option value="current_limiting_breaker">Current Limiting Breaker</option>
                <option value="fuse">Fuse</option>
                <option value="current_limiting_fuse">Current Limiting Fuse</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase mb-1">Device Rating (A)</label>
              <input type="number" value={deviceRating} onChange={e => setDeviceRating(Number(e.target.value))} min="1" max="5000" step="1" className="w-full border-[#e8e6e3] rounded text-sm py-2 px-3 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase mb-1">Working Distance (inches)</label>
              <input type="number" value={workingDistance || ''} onChange={e => setWorkingDistance(e.target.value ? Number(e.target.value) : undefined)} placeholder={`Default: ${standardWorkingDistance}"`} min="12" max="60" step="1" className="w-full border-[#e8e6e3] rounded text-sm py-2 px-3 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20" />
              <p className="text-xs text-[#888] mt-1">Leave blank for standard distance</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#888] uppercase mb-1">Arc Gap (inches)</label>
              <input type="number" value={arcGap || ''} onChange={e => setArcGap(e.target.value ? Number(e.target.value) : undefined)} placeholder="Auto" min="0.1" max="2" step="0.1" className="w-full border-[#e8e6e3] rounded text-sm py-2 px-3 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20" />
              <p className="text-xs text-[#888] mt-1">Leave blank for standard gap</p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <input type="checkbox" id="grounded" checked={grounded} onChange={e => setGrounded(e.target.checked)} className="rounded border-gray-300 text-[#2d3b2d] focus:ring-[#2d3b2d]/20" />
            <label htmlFor="grounded" className="text-sm text-gray-700">Grounded System (most common)</label>
          </div>
        </div>
        <div className="space-y-4">
          <h3 className="font-bold text-[#1a1a1a]">Arc Flash Analysis Results</h3>
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
              <div className="bg-gradient-to-br from-red-50 to-[#e8f5e8] border-2 border-red-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">Incident Energy</span>
                  <span className="text-3xl font-bold text-red-700">{result.incidentEnergy.toFixed(2)} cal/cm²</span>
                </div>
                <div className="text-xs text-[#666]">At working distance of {result.details.workingDistance}"</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">Arc Flash Boundary</span>
                  <span className="text-2xl font-bold text-blue-700">{result.arcFlashBoundary.toFixed(1)}"</span>
                </div>
                <div className="text-xs text-[#666] mt-1">Distance where incident energy = 1.2 cal/cm²</div>
              </div>
              <div className={`border-2 rounded-lg p-4 ${result.ppeCategory === 0 ? 'bg-green-50 border-green-200' : result.ppeCategory === 1 ? 'bg-[#c9a227]50 border-[#c9a227]/40' : result.ppeCategory === 2 ? 'bg-orange-50 border-orange-200' : result.ppeCategory === 3 ? 'bg-red-50 border-red-200' : result.ppeCategory === 4 ? 'bg-red-100 border-red-300' : 'bg-red-200 border-red-400'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">PPE Category</span>
                  <span className={`text-2xl font-bold ${result.ppeCategory === 0 ? 'text-green-700' : result.ppeCategory === 1 ? 'text-[#9a7b00]' : result.ppeCategory === 2 ? 'text-orange-700' : result.ppeCategory === 3 ? 'text-red-700' : result.ppeCategory === 4 ? 'text-red-800' : 'text-red-900'}`}>
                    {result.ppeCategory === 'N/A' ? 'N/A' : `Category ${result.ppeCategory}`}
                  </span>
                </div>
                <div className="text-xs text-gray-700 mt-1">{result.requiredPPE}</div>
              </div>
              <div className="bg-gray-50 border border-[#e8e6e3] rounded-lg p-4">
                <h4 className="font-semibold text-[#1a1a1a] mb-3 text-sm">Calculation Details</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <span className="text-[#888]">Short Circuit Current:</span>
                  <span className="font-mono text-right">{result.details.shortCircuitCurrent} kA</span>
                  <span className="text-[#888]">Arcing Current:</span>
                  <span className="font-mono text-right">{result.details.arcingCurrent} kA</span>
                  <span className="text-[#888]">Clearing Time:</span>
                  <span className="font-mono text-right">{(result.details.clearingTime * 1000).toFixed(1)} ms</span>
                  <span className="text-[#888]">Working Distance:</span>
                  <span className="font-mono text-right">{result.details.workingDistance}"</span>
                  <span className="text-[#888]">Arc Gap:</span>
                  <span className="font-mono text-right">{result.details.arcGap}"</span>
                  <span className="text-[#888]">Voltage:</span>
                  <span className="font-mono text-right">{result.details.voltage}V {result.details.phase}φ</span>
                </div>
              </div>
              <div className={`border rounded-lg p-4 ${result.compliance.compliant ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {result.compliance.compliant ? <CheckCircle className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
                  <span className="font-semibold text-sm text-[#1a1a1a]">{result.compliance.compliant ? 'Compliant' : 'Requires Action'}</span>
                </div>
                <p className="text-sm text-gray-700 mb-2">{result.compliance.message}</p>
                <div className="text-xs text-[#666]">
                  <div><strong>NEC:</strong> {result.compliance.necArticle}</div>
                  <div><strong>NFPA 70E:</strong> {result.compliance.nfpaArticle}</div>
                </div>
              </div>
              {result.compliance.recommendations.length > 0 && (
                <div className="bg-[#c9a227]50 border border-[#c9a227]/40 rounded-lg p-4">
                  <h4 className="font-semibold text-[#5a4500] mb-2 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Recommendations
                  </h4>
                  <ul className="text-xs text-[#7a6200] space-y-1 list-disc list-inside">
                    {result.compliance.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h4 className="font-bold text-[#1a1a1a] mb-3 flex items-center gap-2">
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

// ============================================================================
// Change Impact Analyzer (AI-Powered)
// ============================================================================

interface ChangeImpactAnalyzerProps {
  projectId?: string;
}

const ChangeImpactAnalyzer: React.FC<ChangeImpactAnalyzerProps> = ({ projectId }) => {
  const [changeDescription, setChangeDescription] = useState('');
  const [proposedLoads, setProposedLoads] = useState<Array<{ type: string; amps: number; quantity: number }>>([
    { type: 'EV Charger', amps: 50, quantity: 1 }
  ]);
  const [analyzing, setAnalyzing] = useState(false);
  const [success, setSuccess] = useState(false);

  const addLoad = () => {
    setProposedLoads([...proposedLoads, { type: '', amps: 0, quantity: 1 }]);
  };

  const removeLoad = (index: number) => {
    setProposedLoads(proposedLoads.filter((_, i) => i !== index));
  };

  const updateLoad = (index: number, field: 'type' | 'amps' | 'quantity', value: string | number) => {
    const updated = [...proposedLoads];
    updated[index] = { ...updated[index], [field]: value };
    setProposedLoads(updated);
  };

  const handleAnalyze = async () => {
    if (!projectId) {
      alert('Project ID not found');
      return;
    }

    if (!changeDescription.trim()) {
      alert('Please enter a change description');
      return;
    }

    if (proposedLoads.length === 0 || proposedLoads.some(l => !l.type || l.amps <= 0)) {
      alert('Please add at least one load with valid type and amperage');
      return;
    }

    setAnalyzing(true);
    setSuccess(false);

    try {
      await analyzeChangeImpact(projectId, changeDescription, proposedLoads);
      setSuccess(true);

      // Reset form after 3 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 5000);
    } catch (error: any) {
      console.error('Change impact analysis error:', error);
      alert(`Failed to analyze change impact: ${error.message || 'Unknown error'}\n\nMake sure the Python backend is running at http://localhost:8000`);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-[#e8e6e3] pb-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-semibold text-[#1a1a1a]">AI Change Impact Analyzer</h3>
        </div>
        <p className="text-sm text-[#666]">
          Describe a proposed change to your electrical system and AI will analyze the cascading impacts:
          service upgrades, feeder sizing, voltage drop, cost estimates, and timeline delays.
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-900">Analysis started!</p>
              <p className="text-sm text-green-700 mt-1">
                Check the <strong>AI Copilot sidebar</strong> (right side) for detailed results including service impact, cost estimates, and recommendations.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Change Description */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Change Description <span className="text-red-500">*</span>
        </label>
        <textarea
          value={changeDescription}
          onChange={(e) => setChangeDescription(e.target.value)}
          placeholder="e.g., Add 3x Level 2 EV chargers to parking garage"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2d3b2d]/20 focus:border-[#2d3b2d] text-sm"
          rows={3}
        />
        <p className="text-xs text-[#888]">Describe what you're planning to add or change</p>
      </div>

      {/* Proposed Loads */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">
            Proposed Loads <span className="text-red-500">*</span>
          </label>
          <button
            onClick={addLoad}
            className="flex items-center gap-1 text-sm text-[#2d3b2d] hover:text-[#2d3b2d] font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Load
          </button>
        </div>

        <div className="space-y-2">
          {proposedLoads.map((load, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={load.type}
                onChange={(e) => updateLoad(index, 'type', e.target.value)}
                placeholder="Equipment type (e.g., EV Charger, Heat Pump)"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2d3b2d]/20 focus:border-[#2d3b2d] text-sm"
              />
              <input
                type="number"
                value={load.amps || ''}
                onChange={(e) => updateLoad(index, 'amps', parseFloat(e.target.value) || 0)}
                placeholder="Amps"
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2d3b2d]/20 focus:border-[#2d3b2d] text-sm"
              />
              <input
                type="number"
                value={load.quantity || ''}
                onChange={(e) => updateLoad(index, 'quantity', parseInt(e.target.value) || 1)}
                placeholder="Qty"
                className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2d3b2d]/20 focus:border-[#2d3b2d] text-sm"
              />
              {proposedLoads.length > 1 && (
                <button
                  onClick={() => removeLoad(index)}
                  className="p-2 text-[#888] hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-[#888]">Enter each piece of equipment you're planning to add</p>
      </div>

      {/* Analyze Button */}
      <button
        onClick={handleAnalyze}
        disabled={analyzing || !changeDescription.trim() || proposedLoads.some(l => !l.type || l.amps <= 0)}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#2d3b2d] hover:bg-[#3d4f3d] text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {analyzing ? (
          <>
            <Sparkles className="w-5 h-5 animate-pulse" />
            AI Analyzing Impact...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            Analyze Change Impact
          </>
        )}
      </button>

      {/* Example Section */}
      <div className="bg-gray-50 border border-[#e8e6e3] rounded-lg p-4">
        <h4 className="text-sm font-medium text-[#1a1a1a] mb-2">Example Use Cases:</h4>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>• "Add 5x Level 2 EV chargers in parking lot" → Determines if service upgrade needed</li>
          <li>• "Install 15-ton rooftop HVAC unit" → Analyzes feeder sizing and voltage drop</li>
          <li>• "Add commercial kitchen equipment" → Calculates panel capacity and circuit requirements</li>
          <li>• "Install solar array + battery storage" → Evaluates bidirectional power flow impacts</li>
        </ul>
      </div>

      {/* How It Works */}
      <div className="bg-gray-50 border border-[#e8e6e3] rounded-lg p-4">
        <h4 className="text-sm font-medium text-[#1a1a1a] mb-2 flex items-center gap-2">
          <Info className="w-4 h-4 text-[#888]" />
          How It Works
        </h4>
        <p className="text-sm text-gray-700">
          The AI agent analyzes your current electrical system (panels, circuits, feeders, service) and predicts:
        </p>
        <ul className="text-sm text-gray-700 mt-2 space-y-1 ml-4">
          <li>✓ Whether existing service can accommodate the new load</li>
          <li>✓ Required service upgrade size (if needed)</li>
          <li>✓ Feeder sizing changes required</li>
          <li>✓ Voltage drop impact</li>
          <li>✓ Cost estimate for material + labor</li>
          <li>✓ Timeline impact (delay days)</li>
          <li>✓ Step-by-step recommendations with NEC references</li>
        </ul>
        <p className="text-xs text-[#888] mt-3">
          Results appear in the AI Copilot sidebar. You can approve or reject the analysis.
        </p>
      </div>
    </div>
  );
};
