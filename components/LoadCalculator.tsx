import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, Cpu, Zap, Activity, TrendingUp, Download, AlertCircle } from 'lucide-react';
import { Project, LoadItem } from '../types';
import { validateLoadCalculation } from '../services/geminiService';
import { calculateLoad, getContinuousLoadDefault } from '../services/calculations';
import { CalculationBreakdown } from './CalculationBreakdown';
import { exportLoadCalculationPDF } from '../services/pdfExport';
import { loadItemSchema, type LoadItemFormData } from '../lib/validation';
import { useLoads } from '../hooks/useLoads';

interface LoadCalculatorProps {
  project: Project;
  updateProject: (p: Project) => void;
}

export const LoadCalculator: React.FC<LoadCalculatorProps> = ({ project, updateProject }) => {
  // Use loads from database instead of project prop
  const { loads, createLoad, deleteLoad, error: loadsError } = useLoads(project.id);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm<LoadItemFormData>({
    resolver: zodResolver(loadItemSchema),
    defaultValues: {
      description: '',
      watts: 0,
      quantity: 1,
      continuous: false,
      loadType: 'Lighting',
      phase: 1
    }
  });

  const [validationResult, setValidationResult] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const watchLoadType = watch('loadType');

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      await exportLoadCalculationPDF(project);
    } catch (error) {
      alert('Export failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

  const onSubmit = async (data: LoadItemFormData) => {
    const loadData = {
      project_id: project.id,
      description: data.description,
      watts: data.watts * data.quantity,
      type: data.loadType?.toLowerCase() || 'lighting',
      continuous: data.continuous,
      phase: data.phase === 1 ? 'A' : 'B'
    };

    await createLoad(loadData);
    reset();
  };

  const removeLoad = async (id: string) => {
    await deleteLoad(id);
  };

  const runAiValidation = async () => {
    setIsValidating(true);
    setValidationResult(null);
    const result = await validateLoadCalculation(loads, project.serviceVoltage, project.servicePhase);
    setValidationResult(result || "No response received.");
    setIsValidating(false);
  };

  // Calculate loads with NEC 125% continuous load factor (NEC 210.19(A)(1), 220.50)
  const continuousWatts = loads
    .filter(load => load.continuous)
    .reduce((acc, curr) => acc + curr.watts, 0);

  const nonContinuousWatts = loads
    .filter(load => !load.continuous)
    .reduce((acc, curr) => acc + curr.watts, 0);

  // Total connected load (before demand factors)
  const totalConnectedWatts = continuousWatts + nonContinuousWatts;

  // Apply 125% factor to continuous loads (NEC requirement)
  const continuousWattsAdjusted = continuousWatts * 1.25;

  // Total demand load (with continuous factor applied)
  const totalDemandWatts = continuousWattsAdjusted + nonContinuousWatts;

  // Calculate current based on service type
  let totalAmps: number;
  if (project.servicePhase === 1) {
    // Single-phase: I = VA / V
    totalAmps = totalDemandWatts / project.serviceVoltage;
  } else {
    // Three-phase: I = VA / (√3 × V)
    totalAmps = totalDemandWatts / (Math.sqrt(3) * project.serviceVoltage);
  }
  totalAmps = Math.round(totalAmps * 100) / 100;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Input Form */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSubmit(onSubmit)} className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#2d3b2d]" />
              Add Electrical Load
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                  Description *
                </label>
                <input
                  type="text"
                  {...register('description')}
                  className={`w-full border rounded-md focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20 text-sm py-2 ${
                    errors.description ? 'border-red-300' : 'border-gray-200'
                  }`}
                  placeholder="e.g. Living Room Lights"
                />
                {errors.description && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.description.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                  Watts (VA) *
                </label>
                <input
                  type="number"
                  {...register('watts', { valueAsNumber: true })}
                  className={`w-full border rounded-md focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20 text-sm py-2 ${
                    errors.watts ? 'border-red-300' : 'border-gray-200'
                  }`}
                  placeholder="e.g. 1500"
                />
                {errors.watts && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.watts.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                  Quantity *
                </label>
                <input
                  type="number"
                  {...register('quantity', { valueAsNumber: true })}
                  className={`w-full border rounded-md focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20 text-sm py-2 ${
                    errors.quantity ? 'border-red-300' : 'border-gray-200'
                  }`}
                  placeholder="1"
                  min="1"
                />
                {errors.quantity && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.quantity.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                  Load Type *
                </label>
                <select
                  {...register('loadType', {
                    onChange: (e) => {
                      const type = e.target.value.toLowerCase();
                      setValue('continuous', getContinuousLoadDefault(type));
                    }
                  })}
                  className={`w-full border rounded-md focus:border-[#2d3b2d] focus:ring-[#2d3b2d]/20 text-sm py-2 ${
                    errors.loadType ? 'border-red-300' : 'border-gray-200'
                  }`}
                >
                  <option value="Lighting">Lighting</option>
                  <option value="Receptacle">Receptacle</option>
                  <option value="Motor">Motor</option>
                  <option value="HVAC">HVAC</option>
                  <option value="Appliance">Appliance</option>
                  <option value="Range">Range/Oven</option>
                  <option value="Dryer">Dryer</option>
                  <option value="WaterHeater">Water Heater</option>
                </select>
                {errors.loadType && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.loadType.message}
                  </p>
                )}
              </div>
              <div className="flex items-end">
                 <label className="flex items-center gap-2 cursor-pointer pb-2">
                   <input
                    type="checkbox"
                    {...register('continuous')}
                    className="rounded border-gray-300 text-[#2d3b2d] focus:ring-[#2d3b2d]/20"
                   />
                   <span className="text-sm text-gray-600">Continuous Load (125%)</span>
                 </label>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#2d3b2d] text-white hover:bg-[#3d4f3d] transition-colors py-2.5 rounded-md text-sm font-medium"
            >
              Add Load Entry
            </button>
          </form>

          <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 flex justify-between items-center">
              <h3 className="font-medium text-gray-900">Load Schedule</h3>
              <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-500">{loads.length} items</span>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 font-medium">
                <tr>
                  <th className="px-6 py-3 font-normal">Description</th>
                  <th className="px-6 py-3 font-normal">Type</th>
                  <th className="px-6 py-3 font-normal text-right">Load (VA)</th>
                  <th className="px-6 py-3 font-normal text-right">Phase</th>
                  <th className="px-6 py-3 font-normal w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loads.map(load => (
                  <tr key={load.id} className="hover:bg-gray-50/50 group">
                    <td className="px-6 py-3 text-gray-900">{load.description} {load.continuous && <span className="text-[#2d3b2d] text-xs ml-2">●</span>}</td>
                    <td className="px-6 py-3 text-gray-500 capitalize">{load.type}</td>
                    <td className="px-6 py-3 text-right font-mono text-gray-700">{load.watts.toLocaleString()}</td>
                    <td className="px-6 py-3 text-right text-gray-500">{load.phase}</td>
                    <td className="px-6 py-3 text-right">
                      <button onClick={() => removeLoad(load.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {loads.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-light">
                      No loads added yet. Start by adding loads above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Calculations & AI */}
        <div className="space-y-6">
          <div className="bg-[#f0f5f0] border border-[#e8f5e8] rounded-lg p-6">
            <h3 className="text-sm font-bold text-[#2d3b2d] uppercase tracking-wider mb-4">Service Calculation</h3>
            <div className="space-y-4">
              {/* Connected Load */}
              <div className="flex justify-between items-center">
                <span className="text-gray-600 text-sm">Total Connected Load</span>
                <span className="font-mono text-xl font-bold text-gray-900">{(totalConnectedWatts / 1000).toFixed(2)} kVA</span>
              </div>

              {/* Continuous Load Breakdown */}
              {continuousWatts > 0 && (
                <div className="bg-[#fff8e6] border border-[#c9a227]/40 rounded p-3 text-xs space-y-1">
                  <div className="flex justify-between text-[#7a6200]">
                    <span>Continuous Load:</span>
                    <span className="font-mono">{continuousWatts.toLocaleString()} VA</span>
                  </div>
                  <div className="flex justify-between text-[#5a4500] font-semibold">
                    <span>× 125% (NEC 210.19):</span>
                    <span className="font-mono">{continuousWattsAdjusted.toLocaleString()} VA</span>
                  </div>
                  <div className="flex justify-between text-[#7a6200]">
                    <span>Non-Continuous:</span>
                    <span className="font-mono">{nonContinuousWatts.toLocaleString()} VA</span>
                  </div>
                </div>
              )}

              {/* Total Demand Load */}
              <div className="flex justify-between items-center border-t border-[#2d3b2d]/30 pt-3">
                <span className="text-gray-700 text-sm font-semibold">Total Demand Load</span>
                <span className="font-mono text-xl font-bold text-gray-900">{(totalDemandWatts / 1000).toFixed(2)} kVA</span>
              </div>

              {/* Calculated Current */}
              <div className="flex justify-between items-center">
                <span className="text-gray-600 text-sm">Calculated Current</span>
                <span className="font-mono text-xl font-bold text-gray-900">{totalAmps} A</span>
              </div>
              <div className="text-xs text-gray-500">
                @ {project.serviceVoltage}V {project.servicePhase === 1 ? 'Single' : 'Three'}-Phase
              </div>

              {/* Recommended Service Size */}
              <div className="pt-4 border-t border-[#2d3b2d]/30/50">
                <span className="text-xs text-[#2d3b2d] block mb-1">Recommended Service Size</span>
                <span className="text-2xl font-bold text-gray-900">{totalAmps > 200 ? '400A' : totalAmps > 100 ? '200A' : '100A'}</span>
              </div>

              {/* Export PDF Button */}
              {project.settings?.occupancyType && loads.length > 0 && (
                <div className="pt-4 border-t border-[#2d3b2d]/30/50">
                  <button
                    onClick={handleExportPDF}
                    disabled={isExporting}
                    className="w-full bg-[#2d3b2d] hover:bg-[#3d4f3d] text-white px-4 py-2.5 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="w-4 h-4" />
                    {isExporting ? 'Exporting...' : 'Export Report (TXT)'}
                  </button>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Download detailed NEC calculation report
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#2d3b2d]" />
                AI Validation (NEC 220)
              </h3>
            </div>
            
            {!validationResult ? (
               <div className="text-center py-8">
                 <p className="text-gray-400 text-sm mb-4">Run AI to check demand factors and compliance.</p>
                 <button 
                  onClick={runAiValidation}
                  disabled={isValidating || loads.length === 0}
                  className="bg-[#2d3b2d] hover:bg-[#2d3b2d] text-white px-4 py-2 rounded text-sm font-medium w-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   {isValidating ? 'Analyzing...' : 'Validate Compliance'}
                 </button>
               </div>
            ) : (
              <div className="prose prose-sm max-w-none text-gray-600 bg-gray-50 p-4 rounded-md border border-gray-100 text-xs">
                <div className="whitespace-pre-wrap font-mono">{validationResult}</div>
                <button 
                  onClick={() => setValidationResult(null)}
                  className="mt-4 text-xs text-[#2d3b2d] hover:text-[#2d3b2d] underline"
                >
                  Clear Analysis
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced NEC Calculation with Demand Factors */}
      {project.settings?.occupancyType && loads.length > 0 && (
        <div className="mt-8">
          {(() => {
            try {
              const result = calculateLoad(loads, project.settings);

              return (
                <CalculationBreakdown
                  title="Detailed NEC Load Calculation"
                  summary={[
                    {
                      label: 'Connected Load',
                      value: (result.totalConnectedVA / 1000).toFixed(2),
                      unit: 'kVA'
                    },
                    {
                      label: 'Demand Load',
                      value: (result.totalDemandVA / 1000).toFixed(2),
                      unit: 'kVA',
                      highlight: true
                    },
                    {
                      label: 'Service Current',
                      value: result.totalAmps.toFixed(2),
                      unit: 'A',
                      highlight: true
                    },
                    {
                      label: 'Recommended Service',
                      value: result.recommendedServiceSize,
                      unit: 'A',
                      highlight: true
                    }
                  ]}
                  breakdown={[
                    {
                      category: 'Lighting Loads (NEC Table 220.42)',
                      items: [
                        {
                          label: 'Connected Load',
                          value: result.breakdown.lighting.connectedVA,
                          unit: 'VA'
                        },
                        {
                          label: 'Demand Factor',
                          value: (result.breakdown.lighting.demandFactor * 100).toFixed(0),
                          unit: '%'
                        },
                        {
                          label: 'Demand Load',
                          value: result.breakdown.lighting.demandVA.toFixed(0),
                          unit: 'VA'
                        }
                      ]
                    },
                    {
                      category: 'Appliances (Ranges, Dryers, Water Heaters)',
                      items: [
                        {
                          label: 'Connected Load',
                          value: result.breakdown.appliances.connectedVA,
                          unit: 'VA'
                        },
                        {
                          label: 'Demand Factor',
                          value: (result.breakdown.appliances.demandFactor * 100).toFixed(0),
                          unit: '%'
                        },
                        {
                          label: 'Demand Load',
                          value: result.breakdown.appliances.demandVA.toFixed(0),
                          unit: 'VA'
                        }
                      ]
                    },
                    ...(result.breakdown.motors.connectedVA > 0 ? [{
                      category: 'Motor Loads (Article 430)',
                      items: [
                        {
                          label: 'Total Motors',
                          value: result.breakdown.motors.connectedVA,
                          unit: 'VA'
                        },
                        {
                          label: 'Largest Motor',
                          value: result.breakdown.motors.largestMotorVA,
                          unit: 'VA',
                          subtext: '125% per NEC 430.24'
                        },
                        {
                          label: 'Demand Load',
                          value: result.breakdown.motors.demandVA.toFixed(0),
                          unit: 'VA'
                        }
                      ]
                    }] : []),
                    ...(result.breakdown.other.connectedVA > 0 ? [{
                      category: 'Other Loads (HVAC, etc.)',
                      items: [
                        {
                          label: 'Connected Load',
                          value: result.breakdown.other.connectedVA,
                          unit: 'VA'
                        },
                        {
                          label: 'Demand Load',
                          value: result.breakdown.other.demandVA.toFixed(0),
                          unit: 'VA'
                        }
                      ]
                    }] : []),
                    {
                      category: 'Phase Balance Analysis',
                      items: [
                        {
                          label: 'Phase A',
                          value: result.phaseBalance.phaseA.toFixed(0),
                          unit: 'VA'
                        },
                        {
                          label: 'Phase B',
                          value: result.phaseBalance.phaseB.toFixed(0),
                          unit: 'VA'
                        },
                        {
                          label: 'Phase C',
                          value: result.phaseBalance.phaseC.toFixed(0),
                          unit: 'VA'
                        },
                        {
                          label: 'Imbalance',
                          value: result.phaseBalance.imbalancePercent.toFixed(1),
                          unit: '%',
                          subtext: result.phaseBalance.imbalancePercent > 10 ? 'Consider redistributing loads' : 'Acceptable'
                        }
                      ]
                    }
                  ]}
                  necReferences={result.necReferences}
                  warnings={[...result.phaseBalance.warnings]}
                  notes={result.notes}
                  isCompliant={result.phaseBalance.imbalancePercent <= 20}
                  complianceMessage={result.method}
                />
              );
            } catch (error) {
              return (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-800">
                  <p className="font-semibold mb-2">Calculation Error</p>
                  <p className="text-sm">{error instanceof Error ? error.message : 'Unknown error occurred'}</p>
                </div>
              );
            }
          })()}
        </div>
      )}
    </div>
  );
};
