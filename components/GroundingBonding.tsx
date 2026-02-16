/**
 * Grounding & Bonding Component - NEC Article 250
 * 
 * Provides comprehensive grounding electrode system configuration
 * and bonding requirements with automatic calculations per NEC 2023.
 * 
 * Features:
 * - Grounding electrode selection with NEC 250.50 requirements
 * - Automatic GEC sizing per NEC Table 250.66
 * - EGC sizing reference per NEC Table 250.122
 * - Main bonding jumper sizing per NEC 250.28
 * - AI compliance validation
 */

import React, { useState, useMemo } from 'react';
import { Project } from '../types';
import { validateGrounding } from '../services/geminiService';
import { useGrounding } from '../hooks/useGrounding';
import { usePanels } from '../hooks/usePanels';
import { 
  ShieldCheck, 
  CheckSquare, 
  Zap, 
  AlertTriangle, 
  Info,
  Calculator,
  FileText,
  Loader2
} from 'lucide-react';

interface GroundingProps {
  project: Project;
  updateProject: (p: Project) => void;
}

// NEC 250.50 - Required and Permitted Electrodes
const ELECTRODE_TYPES = [
  { 
    name: "Metal Underground Water Pipe", 
    necRef: "250.52(A)(1)", 
    required: true,
    note: "At least 10 ft in contact with earth, must be supplemented"
  },
  { 
    name: "Metal Frame of Building", 
    necRef: "250.52(A)(2)", 
    required: false,
    note: "If effectively grounded"
  },
  { 
    name: "Concrete-Encased Electrode (Ufer)", 
    necRef: "250.52(A)(3)", 
    required: true,
    note: "20 ft of 4 AWG or larger in concrete foundation"
  },
  { 
    name: "Ground Ring", 
    necRef: "250.52(A)(4)", 
    required: false,
    note: "2 AWG bare copper, 20 ft minimum"
  },
  { 
    name: "Rod and Pipe Electrodes", 
    necRef: "250.52(A)(5)", 
    required: false,
    note: "8 ft minimum length, 5/8 in diameter"
  },
  { 
    name: "Plate Electrodes", 
    necRef: "250.52(A)(7)", 
    required: false,
    note: "2 sq ft minimum surface area"
  }
];

// NEC 250.104 - Bonding Requirements
const BONDING_TARGETS = [
  { 
    name: "Interior Water Piping", 
    necRef: "250.104(A)", 
    required: true,
    note: "Metal water piping within the building"
  },
  { 
    name: "Gas Piping", 
    necRef: "250.104(B)", 
    required: false,
    note: "If CSST or if required by local code"
  },
  { 
    name: "Structural Metal", 
    necRef: "250.104(C)", 
    required: false,
    note: "Exposed structural metal that may become energized"
  },
  { 
    name: "Intersystem Bonding (Communications)", 
    necRef: "250.94", 
    required: true,
    note: "For telephone, CATV, satellite systems"
  }
];

// NEC Table 250.66 - Grounding Electrode Conductor Sizing
const GEC_TABLE: { maxServiceConductor: string; copperGec: string; aluminumGec: string }[] = [
  { maxServiceConductor: '2 AWG or smaller', copperGec: '8 AWG', aluminumGec: '6 AWG' },
  { maxServiceConductor: '1 AWG or 1/0 AWG', copperGec: '6 AWG', aluminumGec: '4 AWG' },
  { maxServiceConductor: '2/0 or 3/0 AWG', copperGec: '4 AWG', aluminumGec: '2 AWG' },
  { maxServiceConductor: '4/0 AWG to 350 kcmil', copperGec: '2 AWG', aluminumGec: '1/0 AWG' },
  { maxServiceConductor: '400-500 kcmil', copperGec: '1/0 AWG', aluminumGec: '3/0 AWG' },
  { maxServiceConductor: '600-1000 kcmil', copperGec: '2/0 AWG', aluminumGec: '4/0 AWG' },
  { maxServiceConductor: 'Over 1000 kcmil', copperGec: '3/0 AWG', aluminumGec: '250 kcmil' },
];

// NEC Table 250.122 - EGC Sizing based on OCPD rating
const EGC_TABLE: { maxOcpd: number; copperEgc: string; aluminumEgc: string }[] = [
  { maxOcpd: 15, copperEgc: '14 AWG', aluminumEgc: '12 AWG' },
  { maxOcpd: 20, copperEgc: '12 AWG', aluminumEgc: '10 AWG' },
  { maxOcpd: 60, copperEgc: '10 AWG', aluminumEgc: '8 AWG' },
  { maxOcpd: 100, copperEgc: '8 AWG', aluminumEgc: '6 AWG' },
  { maxOcpd: 200, copperEgc: '6 AWG', aluminumEgc: '4 AWG' },
  { maxOcpd: 300, copperEgc: '4 AWG', aluminumEgc: '2 AWG' },
  { maxOcpd: 400, copperEgc: '3 AWG', aluminumEgc: '1 AWG' },
  { maxOcpd: 500, copperEgc: '2 AWG', aluminumEgc: '1/0 AWG' },
  { maxOcpd: 600, copperEgc: '1 AWG', aluminumEgc: '2/0 AWG' },
  { maxOcpd: 800, copperEgc: '1/0 AWG', aluminumEgc: '3/0 AWG' },
  { maxOcpd: 1000, copperEgc: '2/0 AWG', aluminumEgc: '4/0 AWG' },
  { maxOcpd: 1200, copperEgc: '3/0 AWG', aluminumEgc: '250 kcmil' },
  { maxOcpd: 1600, copperEgc: '4/0 AWG', aluminumEgc: '350 kcmil' },
  { maxOcpd: 2000, copperEgc: '250 kcmil', aluminumEgc: '400 kcmil' },
  { maxOcpd: 2500, copperEgc: '350 kcmil', aluminumEgc: '600 kcmil' },
  { maxOcpd: 3000, copperEgc: '400 kcmil', aluminumEgc: '600 kcmil' },
  { maxOcpd: 4000, copperEgc: '500 kcmil', aluminumEgc: '750 kcmil' },
  { maxOcpd: 5000, copperEgc: '700 kcmil', aluminumEgc: '1200 kcmil' },
  { maxOcpd: 6000, copperEgc: '800 kcmil', aluminumEgc: '1200 kcmil' },
];

/**
 * Get recommended GEC size based on service amps
 */
function getRecommendedGecSize(serviceAmps: number): string {
  // Map service amps to approximate conductor size
  if (serviceAmps <= 100) return '8 AWG';
  if (serviceAmps <= 150) return '6 AWG';
  if (serviceAmps <= 200) return '4 AWG';
  if (serviceAmps <= 400) return '2 AWG';
  if (serviceAmps <= 600) return '1/0 AWG';
  if (serviceAmps <= 1000) return '2/0 AWG';
  return '3/0 AWG';
}

/**
 * Get EGC size for a given OCPD rating
 */
function getEgcSize(ocpdAmps: number, material: 'copper' | 'aluminum' = 'copper'): string {
  for (const row of EGC_TABLE) {
    if (ocpdAmps <= row.maxOcpd) {
      return material === 'copper' ? row.copperEgc : row.aluminumEgc;
    }
  }
  return material === 'copper' ? '800 kcmil' : '1200 kcmil';
}

export const GroundingBonding: React.FC<GroundingProps> = ({ project }) => {
  // Use the grounding hook for database persistence
  const { 
    grounding, 
    loading, 
    error,
    toggleElectrode, 
    toggleBonding, 
    setGecSize, 
    setNotes 
  } = useGrounding(project.id);

  // Get panels for service info
  const { panels } = usePanels(project.id);
  const mainPanel = panels.find(p => p.is_main);

  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [activeTab, setActiveTab] = useState<'electrodes' | 'bonding' | 'sizing'>('electrodes');

  // Calculate recommended GEC size based on main breaker
  const serviceAmps = mainPanel?.main_breaker_amps || 200;
  const recommendedGec = getRecommendedGecSize(serviceAmps);

  // Get current selections (handle null grounding)
  const selectedElectrodes = grounding?.electrodes || [];
  const selectedBonding = grounding?.bonding || [];
  const currentGecSize = grounding?.gec_size || '6 AWG';
  const currentNotes = grounding?.notes || '';

  // Check compliance status
  const complianceStatus = useMemo(() => {
    const issues: string[] = [];
    
    // Check if water pipe is selected but not supplemented
    const hasWaterPipe = selectedElectrodes.includes("Metal Underground Water Pipe");
    const hasSupplementalElectrode = selectedElectrodes.some(e => 
      e.includes("Rod") || e.includes("Plate") || e.includes("Ground Ring") || e.includes("Concrete")
    );
    
    if (hasWaterPipe && !hasSupplementalElectrode) {
      issues.push("Water pipe electrode must be supplemented per NEC 250.53(D)(2)");
    }
    
    if (selectedElectrodes.length === 0) {
      issues.push("At least one grounding electrode required per NEC 250.50");
    }
    
    // Check bonding
    if (!selectedBonding.includes("Interior Water Piping")) {
      issues.push("Interior water piping bonding required per NEC 250.104(A)");
    }
    
    if (!selectedBonding.includes("Intersystem Bonding (Communications)")) {
      issues.push("Intersystem bonding terminal required per NEC 250.94");
    }

    return {
      isCompliant: issues.length === 0,
      issues
    };
  }, [selectedElectrodes, selectedBonding]);

  const handleValidate = async () => {
    setValidating(true);
    const groundingData = {
      electrodes: selectedElectrodes,
      gecSize: currentGecSize,
      bonding: selectedBonding,
      notes: currentNotes
    };
    const result = await validateGrounding(groundingData, serviceAmps);
    setAiAnalysis(result || "Validation failed.");
    setValidating(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-[#2d3b2d] animate-spin" />
        <span className="ml-2 text-gray-500">Loading grounding data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-light text-gray-900">Grounding & Bonding (NEC 250)</h2>
          <p className="text-gray-500 mt-1">Configure grounding electrode system and bonding jumpers.</p>
          {mainPanel && (
            <p className="text-sm text-[#2d3b2d] mt-1">
              Service: {mainPanel.main_breaker_amps}A {mainPanel.voltage}V {mainPanel.phase}Φ
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleValidate}
            disabled={validating}
            className="bg-[#2d3b2d] hover:bg-[#2d3b2d] disabled:opacity-50 text-black px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <ShieldCheck className={`w-4 h-4 ${validating ? 'animate-pulse' : ''}`} />
            {validating ? 'Validating...' : 'Verify NEC 250'}
          </button>
        </div>
      </div>

      {/* Compliance Status Banner */}
      {!complianceStatus.isCompliant && (
        <div className="bg-[#fff8e6] border border-[#c9a227]/40 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#c9a227] flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-[#7a6200]">Compliance Issues Detected</h4>
              <ul className="mt-1 text-sm text-[#9a7b00] list-disc list-inside">
                {complianceStatus.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('electrodes')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'electrodes' 
              ? 'border-[#2d3b2d] text-gray-900' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Zap className="w-4 h-4 inline mr-2" />
          Electrodes (250.50)
        </button>
        <button
          onClick={() => setActiveTab('bonding')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'bonding' 
              ? 'border-[#2d3b2d] text-gray-900' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <CheckSquare className="w-4 h-4 inline mr-2" />
          Bonding (250.104)
        </button>
        <button
          onClick={() => setActiveTab('sizing')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'sizing' 
              ? 'border-[#2d3b2d] text-gray-900' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Calculator className="w-4 h-4 inline mr-2" />
          Conductor Sizing
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-white border border-gray-100 rounded-lg shadow-sm overflow-hidden">
        {/* Electrodes Tab */}
        {activeTab === 'electrodes' && (
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#2d3b2d]" />
              Grounding Electrode System (NEC 250.50)
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Select all electrodes present at the building. Required electrodes must be used if present.
            </p>
            
            <div className="space-y-3">
              {ELECTRODE_TYPES.map(electrode => {
                const isSelected = selectedElectrodes.includes(electrode.name);
                return (
                  <label 
                    key={electrode.name} 
                    className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                      isSelected 
                        ? 'border-[#2d3b2d] bg-[#f0f5f0]' 
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={() => toggleElectrode(electrode.name)}
                      className="mt-1 rounded border-gray-300 text-[#2d3b2d] focus:ring-[#2d3b2d]/20"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{electrode.name}</span>
                        {electrode.required && (
                          <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-semibold">
                            REQUIRED IF PRESENT
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        <span className="font-mono text-[#2d3b2d]">{electrode.necRef}</span> • {electrode.note}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* GEC Size Selection */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Grounding Electrode Conductor (GEC) Size
              </label>
              <div className="flex items-center gap-4">
                <select 
                  value={currentGecSize}
                  onChange={(e) => setGecSize(e.target.value)}
                  className="flex-1 border-gray-200 rounded-md text-sm focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
                >
                  <option value="8 AWG">8 AWG Copper</option>
                  <option value="6 AWG">6 AWG Copper</option>
                  <option value="4 AWG">4 AWG Copper</option>
                  <option value="2 AWG">2 AWG Copper</option>
                  <option value="1/0 AWG">1/0 AWG Copper</option>
                  <option value="2/0 AWG">2/0 AWG Copper</option>
                  <option value="3/0 AWG">3/0 AWG Copper</option>
                  <option value="4/0 AWG">4/0 AWG Copper</option>
                </select>
                {currentGecSize !== recommendedGec && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <Info className="w-4 h-4" />
                    Recommended: {recommendedGec} for {serviceAmps}A service
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Per NEC Table 250.66 based on service conductor size
              </p>
            </div>
          </div>
        )}

        {/* Bonding Tab */}
        {activeTab === 'bonding' && (
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-[#2d3b2d]" />
              Bonding Requirements (NEC 250.104)
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Confirm bonding of metal systems. Some bonding is required by code.
            </p>

            <div className="space-y-3">
              {BONDING_TARGETS.map(target => {
                const isSelected = selectedBonding.includes(target.name);
                return (
                  <label 
                    key={target.name} 
                    className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                      isSelected 
                        ? 'border-[#2d3b2d] bg-[#f0f5f0]' 
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={() => toggleBonding(target.name)}
                      className="mt-1 rounded border-gray-300 text-[#2d3b2d] focus:ring-[#2d3b2d]/20"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{target.name}</span>
                        {target.required && (
                          <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-semibold">
                            REQUIRED
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        <span className="font-mono text-[#2d3b2d]">{target.necRef}</span> • {target.note}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Notes */}
            <div className="mt-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <FileText className="w-4 h-4 inline mr-1" />
                Grounding Notes
              </label>
              <textarea 
                rows={4}
                value={currentNotes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border-gray-200 rounded-md text-sm p-3 focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20"
                placeholder="E.g., Two ground rods spaced 6ft apart, intersystem bonding terminal at meter base..."
              />
            </div>
          </div>
        )}

        {/* Sizing Tab */}
        {activeTab === 'sizing' && (
          <div className="p-6 space-y-6">
            {/* GEC Table */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-[#2d3b2d]" />
                NEC Table 250.66 - Grounding Electrode Conductor (GEC)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800 text-white">
                    <tr>
                      <th className="p-3 text-left">Service Conductor Size</th>
                      <th className="p-3 text-center">Copper GEC</th>
                      <th className="p-3 text-center">Aluminum GEC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {GEC_TABLE.map((row, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-3">{row.maxServiceConductor}</td>
                        <td className="p-3 text-center font-mono">{row.copperGec}</td>
                        <td className="p-3 text-center font-mono">{row.aluminumGec}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* EGC Table */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-[#2d3b2d]" />
                NEC Table 250.122 - Equipment Grounding Conductor (EGC)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800 text-white">
                    <tr>
                      <th className="p-3 text-left">OCPD Rating (Amps)</th>
                      <th className="p-3 text-center">Copper EGC</th>
                      <th className="p-3 text-center">Aluminum EGC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {EGC_TABLE.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-3">{row.maxOcpd}A</td>
                        <td className="p-3 text-center font-mono">{row.copperEgc}</td>
                        <td className="p-3 text-center font-mono">{row.aluminumEgc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500 mt-2 italic">
                * For larger OCPD ratings, refer to full NEC Table 250.122
              </p>
            </div>

            {/* Quick Calculator */}
            <div className="bg-[#f0f5f0] border border-[#2d3b2d]/30 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3">Quick Reference for This Project</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded p-3">
                  <span className="text-xs text-gray-500 block">Service Size</span>
                  <span className="text-lg font-bold text-gray-900">{serviceAmps}A</span>
                </div>
                <div className="bg-white rounded p-3">
                  <span className="text-xs text-gray-500 block">Recommended GEC</span>
                  <span className="text-lg font-bold text-[#2d3b2d]">{recommendedGec}</span>
                </div>
                <div className="bg-white rounded p-3">
                  <span className="text-xs text-gray-500 block">Main EGC</span>
                  <span className="text-lg font-bold text-[#2d3b2d]">{getEgcSize(serviceAmps)}</span>
                </div>
                <div className="bg-white rounded p-3">
                  <span className="text-xs text-gray-500 block">Selected GEC</span>
                  <span className={`text-lg font-bold ${currentGecSize === recommendedGec ? 'text-green-600' : 'text-[#c9a227]'}`}>
                    {currentGecSize}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Analysis Results */}
      {aiAnalysis && (
        <div className="bg-[#f0f5f0] border border-[#2d3b2d]/30 rounded-lg p-6 animate-in slide-in-from-bottom-2">
          <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#2d3b2d]" /> AI Compliance Analysis
          </h4>
          <div className="prose prose-sm prose-gray max-w-none text-gray-700 whitespace-pre-wrap">
            {aiAnalysis}
          </div>
        </div>
      )}

      {/* Summary Card */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-3">Configuration Summary</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500 block mb-1">Selected Electrodes</span>
            {selectedElectrodes.length > 0 ? (
              <ul className="list-disc list-inside text-gray-700">
                {selectedElectrodes.map(e => <li key={e} className="truncate">{e}</li>)}
              </ul>
            ) : (
              <span className="text-red-500">None selected</span>
            )}
          </div>
          <div>
            <span className="text-gray-500 block mb-1">Bonding Completed</span>
            {selectedBonding.length > 0 ? (
              <ul className="list-disc list-inside text-gray-700">
                {selectedBonding.map(b => <li key={b} className="truncate">{b}</li>)}
              </ul>
            ) : (
              <span className="text-red-500">None selected</span>
            )}
          </div>
          <div>
            <span className="text-gray-500 block mb-1">GEC Size</span>
            <span className="text-lg font-bold text-gray-900">{currentGecSize}</span>
            <span className={`block text-xs ${complianceStatus.isCompliant ? 'text-green-600' : 'text-[#c9a227]'}`}>
              {complianceStatus.isCompliant ? '✓ Compliant' : '⚠ Issues detected'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
