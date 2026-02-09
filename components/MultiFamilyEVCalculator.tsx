/**
 * Multi-Family EV Readiness Calculator Component
 * NEC 220.84 + NEC 220.57 + NEC 625.42
 *
 * Automates the $2-10K engineering calculation for multi-family EV charging.
 * Forum-validated feature addressing the complexity contractors are turning away.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Building2,
  Car,
  Zap,
  AlertTriangle,
  CheckCircle,
  Info,
  TrendingUp,
  Settings,
  Battery,
  FileDown,
  Loader,
  Plus,
  Trash2
} from 'lucide-react';
import {
  calculateMultiFamilyEV,
  quickMultiFamilyEVCheck,
  type MultiFamilyEVInput,
  type MultiFamilyEVResult,
  type CommonAreaLoadItem,
  type CommonAreaCategory
} from '../services/calculations/multiFamilyEV';
import { exportMultiFamilyEVAnalysis } from '../services/pdfExport/multiFamilyEVPDF';
import {
  generateEVInfrastructure,
  type ScenarioKey
} from '../services/autogeneration/multiFamilyProjectGenerator';
import {
  addEVInfrastructure,
  projectHasPanels,
  type PopulationProgress
} from '../services/autogeneration/projectPopulationOrchestrator';

interface MultiFamilyEVCalculatorProps {
  projectId?: string;
  project?: { settings: any; [key: string]: any };
  updateProject?: (p: any) => void;
}

// Building type presets for smart defaults
type BuildingPresetType = 'custom' | 'studio_apts' | 'one_br_apts' | 'two_br_apts' | 'condos' | 'townhomes' | 'senior_living';

interface BuildingPreset {
  label: string;
  description: string;
  avgSqFt: number;
  hasElectricCooking: boolean;
  hasElectricHeat: boolean;
  commonAreaVA: number;
  typicalServiceAmps: number;
}

const BUILDING_PRESETS: Record<BuildingPresetType, BuildingPreset> = {
  custom: {
    label: 'Custom / I Know the Details',
    description: 'Enter exact values for your building',
    avgSqFt: 900,
    hasElectricCooking: true,
    hasElectricHeat: false,
    commonAreaVA: 15000,
    typicalServiceAmps: 800,
  },
  studio_apts: {
    label: 'Studio Apartments',
    description: '~500 sq ft avg, basic amenities',
    avgSqFt: 500,
    hasElectricCooking: true,
    hasElectricHeat: false,
    commonAreaVA: 10000,
    typicalServiceAmps: 600,
  },
  one_br_apts: {
    label: '1-Bedroom Apartments',
    description: '~750 sq ft avg, standard amenities',
    avgSqFt: 750,
    hasElectricCooking: true,
    hasElectricHeat: false,
    commonAreaVA: 15000,
    typicalServiceAmps: 800,
  },
  two_br_apts: {
    label: '2-Bedroom Apartments',
    description: '~1,000 sq ft avg, full amenities',
    avgSqFt: 1000,
    hasElectricCooking: true,
    hasElectricHeat: false,
    commonAreaVA: 20000,
    typicalServiceAmps: 1000,
  },
  condos: {
    label: 'Condominiums',
    description: '~1,200 sq ft avg, upscale amenities',
    avgSqFt: 1200,
    hasElectricCooking: true,
    hasElectricHeat: false,
    commonAreaVA: 25000,
    typicalServiceAmps: 1200,
  },
  townhomes: {
    label: 'Townhomes / HOA',
    description: '~1,500 sq ft avg, minimal common areas',
    avgSqFt: 1500,
    hasElectricCooking: true,
    hasElectricHeat: false,
    commonAreaVA: 8000,
    typicalServiceAmps: 1000,
  },
  senior_living: {
    label: 'Senior Living / Assisted',
    description: '~700 sq ft avg, extensive common areas',
    avgSqFt: 700,
    hasElectricCooking: true,
    hasElectricHeat: true,
    commonAreaVA: 50000,
    typicalServiceAmps: 1200,
  },
};

export const MultiFamilyEVCalculator: React.FC<MultiFamilyEVCalculatorProps> = ({ projectId, project, updateProject }) => {
  // Read pre-calculated building load from DwellingLoadCalculator (stored in project settings)
  const storedMFLoad = project?.settings?.residential?.multiFamilyLoadResult as {
    totalDemandVA: number;
    totalConnectedVA: number;
    demandFactor: number;
    serviceAmps: number;
    recommendedServiceSize: number;
    breakdown: { category: string; description: string; connectedVA: number; demandVA: number; demandFactor: number; necReference: string }[];
    dwellingUnits: number;
    avgUnitSqFt: number;
    commonAreaLoadVA: number;
    hasElectricCooking: boolean;
    hasElectricHeat: boolean;
  } | undefined;

  // Restore persisted MF EV inputs (if any)
  const storedEvInputs = (project?.settings?.residential as any)?.mfEvInputs as {
    evChargerCount?: number;
    evChargerLevel?: 'Level1' | 'Level2';
    evAmpsPerCharger?: number;
    useEVEMS?: boolean;
    existingServiceAmps?: number;
    selectedScenario?: ScenarioKey;
    voltage?: number;
    phase?: number;
  } | undefined;

  // Building preset type
  const [buildingPreset, setBuildingPreset] = useState<BuildingPresetType>('custom');

  // Building profile state
  const [buildingName, setBuildingName] = useState('');
  const [dwellingUnits, setDwellingUnits] = useState(20);
  const [avgUnitSqFt, setAvgUnitSqFt] = useState(900);
  const [voltage, setVoltage] = useState<120 | 208 | 240 | 277 | 480>(storedEvInputs?.voltage as any || 240);
  const [phase, setPhase] = useState<1 | 3>(storedEvInputs?.phase as any || 1);
  const [existingServiceAmps, setExistingServiceAmps] = useState(storedEvInputs?.existingServiceAmps || 800);

  // Apply building preset when selected
  const applyBuildingPreset = (preset: BuildingPresetType) => {
    setBuildingPreset(preset);
    if (preset !== 'custom') {
      const p = BUILDING_PRESETS[preset];
      setAvgUnitSqFt(p.avgSqFt);
      setHasElectricCooking(p.hasElectricCooking);
      setHasElectricHeat(p.hasElectricHeat);
      setCommonAreaLoadVA(p.commonAreaVA);
      setExistingServiceAmps(p.typicalServiceAmps);
      setUseItemizedCommonArea(false); // Reset to simple entry
    }
  };

  // EV charger configuration
  const [evChargerCount, setEvChargerCount] = useState(storedEvInputs?.evChargerCount || 20);
  const [evChargerLevel, setEvChargerLevel] = useState<'Level1' | 'Level2'>(storedEvInputs?.evChargerLevel || 'Level2');
  const [evAmpsPerCharger, setEvAmpsPerCharger] = useState(storedEvInputs?.evAmpsPerCharger || 48);

  // Building details
  const [hasElectricHeat, setHasElectricHeat] = useState(false);
  const [hasElectricCooking, setHasElectricCooking] = useState(true);
  const [commonAreaLoadVA, setCommonAreaLoadVA] = useState(15000);

  // Itemized common area loads
  const [useItemizedCommonArea, setUseItemizedCommonArea] = useState(false);
  const [commonAreaItems, setCommonAreaItems] = useState<CommonAreaLoadItem[]>([]);

  // Optional transformer info
  const [hasTransformer, setHasTransformer] = useState(false);
  const [transformerKVA, setTransformerKVA] = useState(500);

  // EVEMS toggle
  const [useEVEMS, setUseEVEMS] = useState(storedEvInputs?.useEVEMS || false);

  // NEC 220.87 - Existing Load Determination Method
  const [existingLoadMethod, setExistingLoadMethod] = useState<'calculated' | 'utility_bill' | 'load_study'>('calculated');
  const [measuredPeakDemandKW, setMeasuredPeakDemandKW] = useState(0);
  const [measurementPeriod, setMeasurementPeriod] = useState('');
  const [utilityCompany, setUtilityCompany] = useState('');

  // Derived: do we have DwellingLoadCalc data to use?
  const hasStoredData = existingLoadMethod === 'calculated' && !!storedMFLoad;

  // Auto-populate from stored data when using calculated method
  useEffect(() => {
    if (storedMFLoad) {
      setDwellingUnits(storedMFLoad.dwellingUnits);
      setAvgUnitSqFt(storedMFLoad.avgUnitSqFt);
      setHasElectricCooking(storedMFLoad.hasElectricCooking);
      setHasElectricHeat(storedMFLoad.hasElectricHeat);
      setCommonAreaLoadVA(storedMFLoad.commonAreaLoadVA);
    }
  }, [storedMFLoad]);

  // Persist MF EV inputs to project settings (debounced)
  useEffect(() => {
    if (!project || !updateProject) return;
    const current = { evChargerCount, evChargerLevel, evAmpsPerCharger, useEVEMS, existingServiceAmps, selectedScenario, voltage, phase };
    const stored = (project.settings?.residential as any)?.mfEvInputs;
    if (JSON.stringify(current) === JSON.stringify(stored)) return;

    const timer = setTimeout(() => {
      updateProject({
        ...project,
        settings: {
          ...project.settings,
          residential: {
            ...project.settings?.residential,
            mfEvInputs: current,
          } as any,
        },
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [evChargerCount, evChargerLevel, evAmpsPerCharger, useEVEMS, existingServiceAmps, selectedScenario, voltage, phase]);

  // Quick check mode
  const [mode, setMode] = useState<'quick' | 'detailed'>('detailed');

  // PDF export state
  const [isExporting, setIsExporting] = useState(false);

  // Apply to Project state
  const [isApplying, setIsApplying] = useState(false);
  const [applyProgress, setApplyProgress] = useState<PopulationProgress | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<ScenarioKey>(storedEvInputs?.selectedScenario || 'noEVEMS');

  // Calculate results
  const result = useMemo<MultiFamilyEVResult | null>(() => {
    try {
      // Build pre-calculated load from DwellingLoadCalculator if available and method is 'calculated'
      const preCalculatedBuildingLoad = (existingLoadMethod === 'calculated' && storedMFLoad)
        ? {
            totalDemandVA: storedMFLoad.totalDemandVA,
            totalConnectedVA: storedMFLoad.totalConnectedVA,
            demandFactor: storedMFLoad.demandFactor,
            serviceAmps: storedMFLoad.serviceAmps,
            breakdown: storedMFLoad.breakdown,
          }
        : undefined;

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
        // Use itemized loads if enabled and has items, otherwise use simple VA
        commonAreaLoadVA: useItemizedCommonArea ? 0 : commonAreaLoadVA,
        commonAreaLoads: useItemizedCommonArea && commonAreaItems.length > 0 ? commonAreaItems : undefined,
        transformer: hasTransformer ? { kvaRating: transformerKVA } : undefined,
        useEVEMS,
        // NEC 220.87 - Existing Load Determination Method
        existingLoadMethod,
        measuredPeakDemandKW: existingLoadMethod !== 'calculated' && measuredPeakDemandKW > 0 ? measuredPeakDemandKW : undefined,
        measurementPeriod: existingLoadMethod !== 'calculated' && measurementPeriod ? measurementPeriod : undefined,
        utilityCompany: existingLoadMethod !== 'calculated' && utilityCompany ? utilityCompany : undefined,
        preCalculatedBuildingLoad,
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
    useItemizedCommonArea, commonAreaItems,
    hasTransformer, transformerKVA, useEVEMS,
    existingLoadMethod, measuredPeakDemandKW, storedMFLoad
  ]);

  // Add EV Infrastructure handler (must be after result useMemo)
  const handleAddEVInfrastructure = useCallback(async () => {
    if (!projectId || !result) return;

    setIsApplying(true);
    setApplyError(null);
    setApplySuccess(false);

    try {
      // Check that a project exists (MDP must be present)
      const hasPanels = await projectHasPanels(projectId);
      if (!hasPanels) {
        setApplyError(
          'No project found. Generate the building project from the Dwelling Load Calculator first.'
        );
        setIsApplying(false);
        return;
      }

      // Generate EV-only entities
      const evInfra = generateEVInfrastructure(result, {
        scenario: selectedScenario,
        projectId,
        evAmpsPerCharger,
        evChargerLevel,
      });

      // Add to existing project
      const addResult = await addEVInfrastructure(projectId, evInfra, (progress) => {
        setApplyProgress(progress);
      });

      if (addResult.success) {
        setApplySuccess(true);
      } else {
        setApplyError(addResult.error || 'Unknown error');
      }
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Failed to add EV infrastructure');
    } finally {
      setIsApplying(false);
      setApplyProgress(null);
    }
  }, [projectId, result, selectedScenario, evAmpsPerCharger, evChargerLevel]);

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
          {/* Building Profile — hidden when using calculated method with stored data */}
          {!hasStoredData && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
              <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-electric-500" />
                Building Profile
              </h4>

              {/* Building Type Preset Selector */}
              {existingLoadMethod === 'calculated' && (
                <div className="bg-electric-50 border border-electric-200 rounded-lg p-3">
                  <label className="block text-xs font-semibold text-electric-700 uppercase mb-2">
                    Don&apos;t Know All Details? Select Building Type
                  </label>
                  <select
                    value={buildingPreset}
                    onChange={e => applyBuildingPreset(e.target.value as BuildingPresetType)}
                    className="w-full border-electric-300 rounded text-sm py-2 focus:border-electric-500 focus:ring-electric-500"
                  >
                    {Object.entries(BUILDING_PRESETS).map(([key, preset]) => (
                      <option key={key} value={key}>
                        {preset.label} - {preset.description}
                      </option>
                    ))}
                  </select>
                  {buildingPreset !== 'custom' && (
                    <p className="text-xs text-electric-600 mt-2">
                      Defaults applied: {BUILDING_PRESETS[buildingPreset].avgSqFt} sq ft avg, {(BUILDING_PRESETS[buildingPreset].commonAreaVA / 1000).toFixed(0)} kVA common area
                    </p>
                  )}
                </div>
              )}

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
                    Avg. Unit Sq Ft {buildingPreset !== 'custom' && <span className="text-electric-500">(preset)</span>}
                  </label>
                  <input
                    type="number"
                    value={avgUnitSqFt}
                    onChange={e => {
                      setAvgUnitSqFt(Number(e.target.value));
                      if (buildingPreset !== 'custom') setBuildingPreset('custom');
                    }}
                    min="400"
                    max="3000"
                    step="50"
                    className="w-full border-gray-200 rounded text-sm py-2 px-3 focus:border-electric-500 focus:ring-electric-500"
                  />
                </div>
              </div>
            </div>
          )}

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

          {/* NEC 220.87 - Existing Load Determination Method */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-4">
            <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              Existing Building Load (NEC 220.87)
            </h4>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Determination Method
                </label>
                <select
                  value={existingLoadMethod}
                  onChange={e => setExistingLoadMethod(e.target.value as 'calculated' | 'utility_bill' | 'load_study')}
                  className="w-full border-gray-200 rounded text-sm py-2 focus:border-purple-500 focus:ring-purple-500"
                >
                  <option value="calculated">NEC 220.84 Calculation (Standard)</option>
                  <option value="utility_bill">12-Month Utility Billing (Measured)</option>
                  <option value="load_study">30-Day Load Study (Measured)</option>
                </select>
              </div>

              {/* Info box explaining the method */}
              {existingLoadMethod === 'calculated' && storedMFLoad && (
                <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded p-2.5">
                  <CheckCircle className="w-3 h-3 inline mr-1" />
                  <strong>Imported from Dwelling Load Calculator</strong> — {storedMFLoad.dwellingUnits} units, {(storedMFLoad.totalDemandVA / 1000).toFixed(1)} kVA demand ({(storedMFLoad.demandFactor * 100).toFixed(0)}% DF), {storedMFLoad.serviceAmps}A service.
                  {' '}To change building load, edit appliances in the Dwelling Load Calculator.
                </div>
              )}
              {existingLoadMethod === 'calculated' && !storedMFLoad && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2.5">
                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                  No building load configured. Go to the <strong>Dwelling Load Calculator</strong> (Load Calculation tab) and set up unit types and appliances.
                  The NEC 220.84 calculation will be imported here automatically.
                  <div className="mt-1.5 text-amber-600">
                    Using simplified estimates until then.
                  </div>
                </div>
              )}

              {existingLoadMethod !== 'calculated' && (
                <>
                  <div className="text-xs text-purple-700 bg-purple-100 rounded p-2">
                    <Info className="w-3 h-3 inline mr-1" />
                    {existingLoadMethod === 'utility_bill'
                      ? 'Using actual utility demand data. Often shows MORE available capacity than calculation. Provide 12-month billing records showing peak kW demand.'
                      : 'Using recorded load data. Often shows MORE available capacity than calculation. Requires 30-day continuous recording with meter.'}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                        Measured Peak Demand (kW)
                      </label>
                      <input
                        type="number"
                        value={measuredPeakDemandKW || ''}
                        onChange={e => setMeasuredPeakDemandKW(Number(e.target.value))}
                        placeholder="e.g., 185"
                        min="0"
                        step="1"
                        className="w-full border-gray-200 rounded text-sm py-2 px-3 focus:border-purple-500 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                        Utility Company
                      </label>
                      <input
                        type="text"
                        value={utilityCompany}
                        onChange={e => setUtilityCompany(e.target.value)}
                        placeholder="e.g., PG&E, SCE"
                        className="w-full border-gray-200 rounded text-sm py-2 px-3 focus:border-purple-500 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                      Measurement Period
                    </label>
                    <input
                      type="text"
                      value={measurementPeriod}
                      onChange={e => setMeasurementPeriod(e.target.value)}
                      placeholder="e.g., Jan 2025 - Dec 2025"
                      className="w-full border-gray-200 rounded text-sm py-2 px-3 focus:border-purple-500 focus:ring-purple-500"
                    />
                  </div>
                </>
              )}
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
              {/* Building Load Details — hidden when using calculated method with stored data */}
              {!hasStoredData && (
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

                    {/* Common Area Load Section */}
                    <div className="border-t border-gray-200 pt-4 mt-4">
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-xs font-semibold text-gray-500 uppercase">
                          Common Area Loads
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={useItemizedCommonArea}
                            onChange={e => setUseItemizedCommonArea(e.target.checked)}
                            className="rounded border-gray-300 text-electric-500 focus:ring-electric-500"
                          />
                          <span className="text-xs text-gray-600">Itemize with NEC demand factors</span>
                        </label>
                      </div>

                      {!useItemizedCommonArea ? (
                        // Simple VA input
                        <div>
                          <input
                            type="number"
                            value={commonAreaLoadVA}
                            onChange={e => setCommonAreaLoadVA(Number(e.target.value))}
                            min="0"
                            step="1000"
                            className="w-full border-gray-200 rounded text-sm py-2 px-3 focus:border-electric-500 focus:ring-electric-500"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Quick entry: Total VA for lighting, elevators, pool, gym, etc.
                          </p>
                        </div>
                      ) : (
                        // Itemized common area loads
                        <div className="space-y-3">
                          {commonAreaItems.length === 0 && (
                            <p className="text-xs text-gray-500 italic">
                              No common area loads added. Click "Add Load" to itemize.
                            </p>
                          )}

                          {/* List of items */}
                          {commonAreaItems.map((item, index) => (
                            <div key={index} className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-700">{item.description || `Load ${index + 1}`}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newItems = [...commonAreaItems];
                                    newItems.splice(index, 1);
                                    setCommonAreaItems(newItems);
                                  }}
                                  className="text-red-400 hover:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <select
                                  value={item.category}
                                  onChange={e => {
                                    const newItems = [...commonAreaItems];
                                    newItems[index] = {
                                      ...item,
                                      category: e.target.value as CommonAreaCategory,
                                      inputType: ['lighting_indoor', 'lighting_outdoor'].includes(e.target.value) ? 'sqft' :
                                                 ['elevators', 'pool_spa', 'motors', 'fire_pump'].includes(e.target.value) ? 'hp' :
                                                 e.target.value === 'hvac' ? 'tons' : 'va'
                                    };
                                    setCommonAreaItems(newItems);
                                  }}
                                  className="border-gray-200 rounded text-xs py-1"
                                >
                                  <option value="lighting_indoor">Indoor Lighting</option>
                                  <option value="lighting_outdoor">Outdoor Lighting</option>
                                  <option value="receptacles">Receptacles</option>
                                  <option value="elevators">Elevators</option>
                                  <option value="pool_spa">Pool/Spa</option>
                                  <option value="hvac">HVAC</option>
                                  <option value="fire_pump">Fire Pump</option>
                                  <option value="motors">Motors</option>
                                  <option value="other">Other</option>
                                </select>
                                <input
                                  type="text"
                                  placeholder="Description"
                                  value={item.description}
                                  onChange={e => {
                                    const newItems = [...commonAreaItems];
                                    newItems[index] = { ...item, description: e.target.value };
                                    setCommonAreaItems(newItems);
                                  }}
                                  className="border-gray-200 rounded text-xs py-1 px-2"
                                />
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <label className="block text-[10px] text-gray-500 mb-0.5">
                                    {item.inputType === 'sqft' ? 'Sq Ft' :
                                     item.inputType === 'hp' ? 'HP' :
                                     item.inputType === 'tons' ? 'Tons' : 'VA'}
                                  </label>
                                  <input
                                    type="number"
                                    value={item.value}
                                    onChange={e => {
                                      const newItems = [...commonAreaItems];
                                      newItems[index] = { ...item, value: Number(e.target.value) };
                                      setCommonAreaItems(newItems);
                                    }}
                                    min="0"
                                    className="w-full border-gray-200 rounded text-xs py-1 px-2"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-gray-500 mb-0.5">Qty</label>
                                  <input
                                    type="number"
                                    value={item.quantity || 1}
                                    onChange={e => {
                                      const newItems = [...commonAreaItems];
                                      newItems[index] = { ...item, quantity: Number(e.target.value) || 1 };
                                      setCommonAreaItems(newItems);
                                    }}
                                    min="1"
                                    className="w-full border-gray-200 rounded text-xs py-1 px-2"
                                  />
                                </div>
                                {item.inputType === 'sqft' && (
                                  <div>
                                    <label className="block text-[10px] text-gray-500 mb-0.5">Space Type</label>
                                    <select
                                      value={item.spaceType || 'corridor'}
                                      onChange={e => {
                                        const newItems = [...commonAreaItems];
                                        newItems[index] = { ...item, spaceType: e.target.value as any };
                                        setCommonAreaItems(newItems);
                                      }}
                                      className="w-full border-gray-200 rounded text-[10px] py-1"
                                    >
                                      <option value="corridor">Corridor (0.5)</option>
                                      <option value="lobby">Lobby (2.0)</option>
                                      <option value="stairwell">Stairwell (0.5)</option>
                                      <option value="parking_indoor">Parking Indoor (0.2)</option>
                                      <option value="parking_outdoor">Parking Outdoor (0.1)</option>
                                      <option value="amenity">Amenity (1.5)</option>
                                      <option value="laundry">Laundry (1.5)</option>
                                      <option value="mechanical">Mechanical (0.5)</option>
                                      <option value="office">Office (1.5)</option>
                                      <option value="pool_area">Pool Area (1.0)</option>
                                    </select>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}

                          {/* Add load button */}
                          <button
                            type="button"
                            onClick={() => {
                              setCommonAreaItems([
                                ...commonAreaItems,
                                {
                                  category: 'lighting_indoor',
                                  description: '',
                                  inputType: 'sqft',
                                  value: 0,
                                  quantity: 1,
                                  spaceType: 'corridor'
                                }
                              ]);
                            }}
                            className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-electric-500 hover:text-electric-600 text-xs font-medium flex items-center justify-center gap-1"
                          >
                            <Plus className="w-4 h-4" />
                            Add Common Area Load
                          </button>

                          {/* Quick templates */}
                          <div className="flex flex-wrap gap-1">
                            <span className="text-[10px] text-gray-500">Templates:</span>
                            <button
                              type="button"
                              onClick={() => {
                                setCommonAreaItems([
                                  { category: 'lighting_indoor', description: 'Corridors', inputType: 'sqft', value: 2000, quantity: 1, spaceType: 'corridor' },
                                  { category: 'lighting_indoor', description: 'Lobby', inputType: 'sqft', value: 500, quantity: 1, spaceType: 'lobby' },
                                  { category: 'receptacles', description: 'Common area outlets', inputType: 'va', value: 5000, quantity: 1 },
                                ]);
                              }}
                              className="text-[10px] text-electric-600 hover:text-electric-700 underline"
                            >
                              Low-Rise
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCommonAreaItems([
                                  { category: 'lighting_indoor', description: 'Corridors', inputType: 'sqft', value: 4000, quantity: 1, spaceType: 'corridor' },
                                  { category: 'lighting_indoor', description: 'Lobby', inputType: 'sqft', value: 800, quantity: 1, spaceType: 'lobby' },
                                  { category: 'elevators', description: 'Passenger Elevator', inputType: 'hp', value: 15, quantity: 2 },
                                  { category: 'pool_spa', description: 'Pool Pump', inputType: 'hp', value: 3, quantity: 1 },
                                  { category: 'receptacles', description: 'Common area outlets', inputType: 'va', value: 10000, quantity: 1 },
                                ]);
                              }}
                              className="text-[10px] text-electric-600 hover:text-electric-700 underline"
                            >
                              Mid-Rise
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCommonAreaItems([
                                  { category: 'lighting_indoor', description: 'Corridors', inputType: 'sqft', value: 8000, quantity: 1, spaceType: 'corridor' },
                                  { category: 'lighting_indoor', description: 'Lobby', inputType: 'sqft', value: 1500, quantity: 1, spaceType: 'lobby' },
                                  { category: 'lighting_outdoor', description: 'Parking', inputType: 'sqft', value: 20000, quantity: 1, spaceType: 'parking_outdoor' },
                                  { category: 'elevators', description: 'Passenger Elevator', inputType: 'hp', value: 25, quantity: 4 },
                                  { category: 'hvac', description: 'Common Area HVAC', inputType: 'tons', value: 10, quantity: 1 },
                                  { category: 'pool_spa', description: 'Pool Equipment', inputType: 'hp', value: 5, quantity: 2 },
                                  { category: 'fire_pump', description: 'Fire Pump', inputType: 'hp', value: 50, quantity: 1 },
                                  { category: 'receptacles', description: 'Common area outlets', inputType: 'va', value: 15000, quantity: 1 },
                                ]);
                              }}
                              className="text-[10px] text-electric-600 hover:text-electric-700 underline"
                            >
                              High-Rise
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

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

              {/* Add EV Infrastructure */}
              {projectId && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3 text-sm flex items-center gap-2">
                    <Car className="w-4 h-4 text-indigo-600" />
                    Add EV Infrastructure to Project
                  </h4>

                  {applySuccess ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                        <CheckCircle className="w-4 h-4" />
                        EV infrastructure added successfully!
                      </div>
                      <p className="text-xs text-green-600 mt-1">
                        EV sub-panel, circuits, meter, and feeder have been created.
                        View them in the One-Line Diagram.
                      </p>
                      <button
                        onClick={() => setApplySuccess(false)}
                        className="mt-2 text-xs text-green-700 underline hover:text-green-800"
                      >
                        Add again with different settings
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-gray-600 mb-3">
                        Adds an EV sub-panel, charger circuits, meter, and feeder to the existing project.
                        {' '}Any existing EV panels will be replaced.
                      </p>

                      {/* Scenario Selection */}
                      <div className="space-y-2 mb-3">
                        <label className="text-xs font-medium text-gray-700">Select Scenario:</label>
                        {(['noEVEMS', 'withEVEMS', 'withUpgrade'] as const).map((key) => {
                          const s = result.scenarios[key];
                          return (
                            <label
                              key={key}
                              className={`flex items-center gap-3 p-2 rounded border cursor-pointer transition-colors ${
                                selectedScenario === key
                                  ? 'border-indigo-400 bg-indigo-100'
                                  : 'border-gray-200 bg-white hover:bg-gray-50'
                              }`}
                            >
                              <input
                                type="radio"
                                name="applyScenario"
                                value={key}
                                checked={selectedScenario === key}
                                onChange={() => setSelectedScenario(key)}
                                className="text-indigo-600"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900">{s.name}</div>
                                <div className="text-xs text-gray-500">
                                  {s.maxChargers} chargers
                                  {key === 'withUpgrade' && s.recommendedServiceAmps && ` (${s.recommendedServiceAmps}A service)`}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>

                      {/* Error */}
                      {applyError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                          <div className="text-red-700 text-xs">{applyError}</div>
                        </div>
                      )}

                      {/* Progress */}
                      {isApplying && applyProgress && (
                        <div className="mb-3">
                          <div className="flex items-center gap-2 text-sm text-indigo-700">
                            <Loader className="w-4 h-4 animate-spin" />
                            {applyProgress.step}
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                            <div
                              className="bg-indigo-600 h-1.5 rounded-full transition-all"
                              style={{ width: `${(applyProgress.current / applyProgress.total) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Add EV Button */}
                      <button
                        onClick={handleAddEVInfrastructure}
                        disabled={isApplying}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isApplying ? (
                          <>
                            <Loader className="w-4 h-4 animate-spin" />
                            Adding EV Infrastructure...
                          </>
                        ) : (
                          <>
                            <Car className="w-4 h-4" />
                            Add EV Infrastructure
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              )}

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
