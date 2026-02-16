import React, { useState, useEffect } from 'react';
import { AlertCircle, Plus, Trash2, Info, FileText, Cable } from 'lucide-react';
import {
  calculateCommercialLoad,
  OccupancyType,
  HVACLoad,
  MotorLoad,
  KitchenEquipment,
  SpecialLoad,
  CommercialLoadResult,
  OCCUPANCY_LABELS,
  LIGHTING_UNIT_LOAD,
  formatVA_to_kVA,
} from '../services/calculations/commercialLoad';
import { calculateFeederSizing } from '../services/calculations/feederSizing';
import type { FeederCalculationInput, FeederCalculationResult } from '../types';
import { usePersistedState } from '../hooks/usePersistedState';

interface CommercialLoadCalculatorProps {
  projectId?: string;
  onResultCalculated?: (result: CommercialLoadResult) => void;
}

interface FeederInput {
  name: string;
  load_va: number;
  continuous_percent: number; // Percentage of load that is continuous (0-100)
  distance_ft: number;
  voltage: number;
  phase: 1 | 3;
  conductor_material: 'Cu' | 'Al';
}

export const CommercialLoadCalculator: React.FC<CommercialLoadCalculatorProps> = ({
  projectId,
  onResultCalculated,
}) => {
  const pk = `commercial-load-calc-${projectId ?? 'global'}`;

  // Building Information
  const [occupancyType, setOccupancyType] = usePersistedState<OccupancyType>(`${pk}-occupancy`, 'office_buildings');
  const [totalFloorArea, setTotalFloorArea] = usePersistedState<number>(`${pk}-floorArea`, 10000);

  // Receptacles
  const [generalReceptacleCount, setGeneralReceptacleCount] = usePersistedState<number>(`${pk}-receptacles`, 50);
  const [showWindowLighting_linearFeet, setShowWindowLighting_linearFeet] = usePersistedState<number>(`${pk}-windowLighting`, 0);
  const [signOutlets, setSignOutlets] = usePersistedState<number>(`${pk}-signOutlets`, 0);

  // HVAC Loads
  const [hvacLoads, setHvacLoads] = usePersistedState<HVACLoad[]>(`${pk}-hvac`, [
    {
      description: 'Rooftop Unit #1',
      nameplateFLA: 42,
      voltage: 208,
      phase: 3,
      isContinuous: true,
    },
  ]);

  // Motor Loads
  const [motorLoads, setMotorLoads] = usePersistedState<MotorLoad[]>(`${pk}-motors`, []);

  // Kitchen Equipment
  const [kitchenEquipment, setKitchenEquipment] = usePersistedState<KitchenEquipment[]>(`${pk}-kitchen`, []);
  const [showKitchenSection, setShowKitchenSection] = usePersistedState<boolean>(`${pk}-showKitchen`, false);

  // Special Loads
  const [specialLoads, setSpecialLoads] = usePersistedState<SpecialLoad[]>(`${pk}-specialLoads`, []);

  // Feeders
  const [feeders, setFeeders] = usePersistedState<FeederInput[]>(`${pk}-feeders`, []);
  const [feederResults, setFeederResults] = useState<Record<string, FeederCalculationResult>>({});

  // Service Parameters
  const [serviceVoltage, setServiceVoltage] = usePersistedState<120 | 208 | 240 | 277 | 480>(`${pk}-voltage`, 208);
  const [servicePhase, setServicePhase] = usePersistedState<1 | 3>(`${pk}-phase`, 3);

  // Calculation Result (derived, no need to persist)
  const [result, setResult] = useState<CommercialLoadResult | null>(null);

  // Auto-show kitchen section for restaurants
  useEffect(() => {
    if (occupancyType === 'restaurants') {
      setShowKitchenSection(true);
    }
  }, [occupancyType]);

  // Auto-correct load phases when service phase changes to single-phase
  useEffect(() => {
    if (servicePhase === 1) {
      // Convert any 3-phase HVAC loads to 1-phase
      const correctedHvac = hvacLoads.map(load =>
        load.phase === 3 ? { ...load, phase: 1 as 1 | 3 } : load
      );
      if (JSON.stringify(correctedHvac) !== JSON.stringify(hvacLoads)) {
        setHvacLoads(correctedHvac);
      }

      // Convert any 3-phase motor loads to 1-phase
      const correctedMotors = motorLoads.map(load =>
        load.phase === 3 ? { ...load, phase: 1 as 1 | 3 } : load
      );
      if (JSON.stringify(correctedMotors) !== JSON.stringify(motorLoads)) {
        setMotorLoads(correctedMotors);
      }
    }
  }, [servicePhase, hvacLoads, motorLoads]);

  // Calculate on input changes
  useEffect(() => {
    try {
      const calculatedResult = calculateCommercialLoad({
        occupancyType,
        totalFloorArea,
        generalReceptacleCount,
        showWindowLighting_linearFeet: showWindowLighting_linearFeet || undefined,
        signOutlets: signOutlets || undefined,
        hvacLoads,
        motorLoads,
        kitchenEquipment: showKitchenSection && kitchenEquipment.length > 0 ? kitchenEquipment : undefined,
        specialLoads: specialLoads.length > 0 ? specialLoads : undefined,
        serviceVoltage,
        servicePhase,
      });

      setResult(calculatedResult);
      if (onResultCalculated) {
        onResultCalculated(calculatedResult);
      }
    } catch (error) {
      console.error('Error calculating commercial load:', error);
    }
  }, [
    occupancyType,
    totalFloorArea,
    generalReceptacleCount,
    showWindowLighting_linearFeet,
    signOutlets,
    hvacLoads,
    motorLoads,
    kitchenEquipment,
    specialLoads,
    serviceVoltage,
    servicePhase,
    showKitchenSection,
    onResultCalculated,
  ]);

  // ===== HVAC CRUD =====
  const addHVACLoad = () => {
    setHvacLoads([
      ...hvacLoads,
      {
        description: `HVAC Unit #${hvacLoads.length + 1}`,
        nameplateFLA: 30,
        voltage: 208,
        phase: 3,
        isContinuous: true,
      },
    ]);
  };

  const updateHVACLoad = (index: number, updated: Partial<HVACLoad>) => {
    const newLoads = [...hvacLoads];
    if (newLoads[index]) {
      newLoads[index] = { ...newLoads[index], ...updated };
      setHvacLoads(newLoads);
    }
  };

  const removeHVACLoad = (index: number) => {
    setHvacLoads(hvacLoads.filter((_, i) => i !== index));
  };

  // ===== MOTOR CRUD =====
  const addMotorLoad = () => {
    setMotorLoads([
      ...motorLoads,
      {
        description: `Motor #${motorLoads.length + 1}`,
        horsepower: 5,
        voltage: 208,
        phase: 3,
        fullLoadAmps: 16.7, // 5 HP @ 208V 3-phase from NEC Table 430.250
      },
    ]);
  };

  const updateMotorLoad = (index: number, updated: Partial<MotorLoad>) => {
    const newLoads = [...motorLoads];
    if (newLoads[index]) {
      newLoads[index] = { ...newLoads[index], ...updated };
      setMotorLoads(newLoads);
    }
  };

  const removeMotorLoad = (index: number) => {
    setMotorLoads(motorLoads.filter((_, i) => i !== index));
  };

  // ===== KITCHEN CRUD =====
  const addKitchenEquipment = () => {
    setKitchenEquipment([
      ...kitchenEquipment,
      {
        description: `Equipment #${kitchenEquipment.length + 1}`,
        nameplateRating_kW: 8,
      },
    ]);
  };

  const updateKitchenEquipment = (index: number, updated: Partial<KitchenEquipment>) => {
    const newEquipment = [...kitchenEquipment];
    if (newEquipment[index]) {
      newEquipment[index] = { ...newEquipment[index], ...updated };
      setKitchenEquipment(newEquipment);
    }
  };

  const removeKitchenEquipment = (index: number) => {
    setKitchenEquipment(kitchenEquipment.filter((_, i) => i !== index));
  };

  // ===== SPECIAL LOADS CRUD =====
  const addSpecialLoad = () => {
    setSpecialLoads([
      ...specialLoads,
      {
        description: `Special Load #${specialLoads.length + 1}`,
        load_VA: 5000,
        isContinuous: false,
      },
    ]);
  };

  const updateSpecialLoad = (index: number, updated: Partial<SpecialLoad>) => {
    const newLoads = [...specialLoads];
    if (newLoads[index]) {
      newLoads[index] = { ...newLoads[index], ...updated };
      setSpecialLoads(newLoads);
    }
  };

  const removeSpecialLoad = (index: number) => {
    setSpecialLoads(specialLoads.filter((_, i) => i !== index));
  };

  // ===== FEEDER CRUD =====
  const addFeeder = () => {
    setFeeders([
      ...feeders,
      {
        name: `Feeder #${feeders.length + 1}`,
        load_va: 50000,
        continuous_percent: 75,
        distance_ft: 100,
        voltage: serviceVoltage,
        phase: servicePhase,
        conductor_material: 'Cu',
      },
    ]);
  };

  const updateFeeder = (index: number, updated: Partial<FeederInput>) => {
    const newFeeders = [...feeders];
    if (newFeeders[index]) {
      newFeeders[index] = { ...newFeeders[index], ...updated };
      setFeeders(newFeeders);
    }
  };

  const removeFeeder = (index: number) => {
    setFeeders(feeders.filter((_, i) => i !== index));
  };

  // Calculate feeders whenever feeder inputs change
  useEffect(() => {
    const results: Record<string, FeederCalculationResult> = {};

    feeders.forEach((feeder, index) => {
      const continuous_load_va = feeder.load_va * (feeder.continuous_percent / 100);
      const noncontinuous_load_va = feeder.load_va * (1 - feeder.continuous_percent / 100);

      try {
        const result = calculateFeederSizing({
          source_voltage: feeder.voltage,
          source_phase: feeder.phase,
          destination_voltage: feeder.voltage,
          destination_phase: feeder.phase,
          total_load_va: feeder.load_va,
          continuous_load_va,
          noncontinuous_load_va,
          distance_ft: feeder.distance_ft,
          conductor_material: feeder.conductor_material,
          ambient_temperature_c: 30,
          num_current_carrying: 3,
          max_voltage_drop_percent: 3,
          temperature_rating: 75,
        });
        results[`feeder-${index}`] = result;
      } catch (error) {
        console.error(`Error calculating feeder ${index}:`, error);
      }
    });

    setFeederResults(results);
  }, [feeders]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">
              Commercial Load Calculator (NEC 220.40-220.87)
            </h3>
            <p className="text-sm text-blue-700">
              Calculate feeder and service loads for commercial and industrial occupancies using the
              general method per NEC Article 220, Part III & IV.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ===== LEFT COLUMN: INPUTS ===== */}
        <div className="space-y-6">
          {/* Building Information */}
          <div className="bg-white border border-gray-200 rounded-lg card-padding section-spacing">
            <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Building Information
            </h3>

            <div className="space-y-3">
              {/* Occupancy Type & Floor Area - Horizontal on large screens */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Occupancy Type
                  </label>
                  <select
                    value={occupancyType}
                    onChange={(e) => setOccupancyType(e.target.value as OccupancyType)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    {(Object.keys(OCCUPANCY_LABELS) as OccupancyType[]).map((type) => (
                      <option key={type} value={type}>
                        {OCCUPANCY_LABELS[type]} ({LIGHTING_UNIT_LOAD[type]} VA/sf)
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    <span className="nec-reference">NEC Table 220.42(A)</span>
                  </p>
                </div>

                <div className="form-group">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Total Floor Area
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={totalFloorArea}
                      onChange={(e) => setTotalFloorArea(Number(e.target.value))}
                      className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-md text-sm input-value"
                      min="0"
                      step="100"
                      placeholder="10000"
                    />
                    <span className="absolute right-3 top-2 text-sm text-gray-500">sq ft</span>
                  </div>
                </div>
              </div>

              {/* Service Parameters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Phase
                  </label>
                  <select
                    value={servicePhase}
                    onChange={(e) => setServicePhase(Number(e.target.value) as 1 | 3)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value={1}>1Φ</option>
                    <option value={3}>3Φ</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Voltage
                  </label>
                  <select
                    value={serviceVoltage}
                    onChange={(e) => setServiceVoltage(Number(e.target.value) as 120 | 208 | 240 | 277 | 480)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    {servicePhase === 1 ? (
                      <>
                        <option value={120}>120V</option>
                        <option value={240}>240V</option>
                      </>
                    ) : (
                      <>
                        <option value={120}>120V (L-N)</option>
                        <option value={208}>208V (L-L)</option>
                        <option value={277}>277V (L-N)</option>
                        <option value={480}>480V (L-L)</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Receptacle Loads */}
          <div className="bg-white border border-gray-200 rounded-lg card-padding section-spacing">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Receptacle Loads</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  General Receptacles (180 VA each)
                </label>
                <input
                  type="number"
                  value={generalReceptacleCount}
                  onChange={(e) => setGeneralReceptacleCount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Show Window Lighting (linear feet) - 200 VA/ft
                </label>
                <input
                  type="number"
                  value={showWindowLighting_linearFeet}
                  onChange={(e) => setShowWindowLighting_linearFeet(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sign Outlets (1200 VA each)
                </label>
                <input
                  type="number"
                  value={signOutlets}
                  onChange={(e) => setSignOutlets(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* HVAC Loads */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">HVAC Equipment (NEC 220.14(C))</h3>
              <button
                onClick={addHVACLoad}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            <div className="space-y-3">
              {hvacLoads.map((hvac, index) => (
                <div key={index} className="border border-gray-200 rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={hvac.description}
                      onChange={(e) => updateHVACLoad(index, { description: e.target.value })}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                      placeholder="Description"
                    />
                    <button
                      onClick={() => removeHVACLoad(index)}
                      className="ml-2 text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">FLA (Amps)</label>
                      <input
                        type="number"
                        value={hvac.nameplateFLA}
                        onChange={(e) => updateHVACLoad(index, { nameplateFLA: Number(e.target.value) })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        step="0.1"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Voltage</label>
                      <input
                        type="number"
                        value={hvac.voltage}
                        onChange={(e) => updateHVACLoad(index, { voltage: Number(e.target.value) })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Phase</label>
                      <select
                        value={hvac.phase}
                        onChange={(e) => updateHVACLoad(index, { phase: Number(e.target.value) as 1 | 3 })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value={1}>1Φ</option>
                        {servicePhase === 3 && <option value={3}>3Φ</option>}
                      </select>
                    </div>

                    <div className="flex items-center">
                      <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hvac.isContinuous}
                          onChange={(e) => updateHVACLoad(index, { isContinuous: e.target.checked })}
                          className="rounded"
                        />
                        Continuous (125%)
                      </label>
                    </div>
                  </div>
                </div>
              ))}

              {hvacLoads.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No HVAC loads added</p>
              )}
            </div>
          </div>

          {/* Motor Loads */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Motor Loads (NEC 430.24)</h3>
              <button
                onClick={addMotorLoad}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            <div className="space-y-3">
              {motorLoads.map((motor, index) => (
                <div key={index} className="border border-gray-200 rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={motor.description}
                      onChange={(e) => updateMotorLoad(index, { description: e.target.value })}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                      placeholder="Description"
                    />
                    <button
                      onClick={() => removeMotorLoad(index)}
                      className="ml-2 text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">HP</label>
                      <input
                        type="number"
                        value={motor.horsepower}
                        onChange={(e) => updateMotorLoad(index, { horsepower: Number(e.target.value) })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        step="0.5"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">FLA (Amps)</label>
                      <input
                        type="number"
                        value={motor.fullLoadAmps}
                        onChange={(e) => updateMotorLoad(index, { fullLoadAmps: Number(e.target.value) })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        step="0.1"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Voltage</label>
                      <input
                        type="number"
                        value={motor.voltage}
                        onChange={(e) => updateMotorLoad(index, { voltage: Number(e.target.value) })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Phase</label>
                      <select
                        value={motor.phase}
                        onChange={(e) => updateMotorLoad(index, { phase: Number(e.target.value) as 1 | 3 })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value={1}>1Φ</option>
                        {servicePhase === 3 && <option value={3}>3Φ</option>}
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              {motorLoads.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No motor loads added</p>
              )}
            </div>
          </div>

          {/* Kitchen Equipment (Optional) */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">Kitchen Equipment (NEC 220.56)</h3>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showKitchenSection}
                    onChange={(e) => setShowKitchenSection(e.target.checked)}
                    className="rounded"
                  />
                  Enable
                </label>
              </div>
              {showKitchenSection && (
                <button
                  onClick={addKitchenEquipment}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 shadow-sm transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              )}
            </div>

            {showKitchenSection && (
              <div className="space-y-3">
                {kitchenEquipment.map((equipment, index) => (
                  <div key={index} className="border border-gray-200 rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        value={equipment.description}
                        onChange={(e) => updateKitchenEquipment(index, { description: e.target.value })}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="Equipment description"
                      />
                      <button
                        onClick={() => removeKitchenEquipment(index)}
                        className="ml-2 text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Nameplate Rating (kW)</label>
                      <input
                        type="number"
                        value={equipment.nameplateRating_kW}
                        onChange={(e) =>
                          updateKitchenEquipment(index, { nameplateRating_kW: Number(e.target.value) })
                        }
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        step="0.1"
                      />
                    </div>
                  </div>
                ))}

                {kitchenEquipment.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No kitchen equipment added</p>
                )}
              </div>
            )}
          </div>

          {/* Special Loads (Optional) */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Special Loads</h3>
              <button
                onClick={addSpecialLoad}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            <div className="space-y-3">
              {specialLoads.map((load, index) => (
                <div key={index} className="border border-gray-200 rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={load.description}
                      onChange={(e) => updateSpecialLoad(index, { description: e.target.value })}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                      placeholder="Description"
                    />
                    <button
                      onClick={() => removeSpecialLoad(index)}
                      className="ml-2 text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Load (VA)</label>
                      <input
                        type="number"
                        value={load.load_VA}
                        onChange={(e) => updateSpecialLoad(index, { load_VA: Number(e.target.value) })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        step="100"
                      />
                    </div>

                    <div className="flex items-center">
                      <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={load.isContinuous}
                          onChange={(e) => updateSpecialLoad(index, { isContinuous: e.target.checked })}
                          className="rounded"
                        />
                        Continuous (125%)
                      </label>
                    </div>
                  </div>
                </div>
              ))}

              {specialLoads.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No special loads added</p>
              )}
            </div>
          </div>

          {/* Feeders (NEC Article 215) */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Cable className="w-5 h-5 text-gray-700" />
                <h3 className="font-semibold text-gray-900">Feeders (NEC Article 215)</h3>
              </div>
              <button
                onClick={addFeeder}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Feeder
              </button>
            </div>

            <div className="space-y-3">
              {feeders.map((feeder, index) => (
                <div key={index} className="border border-gray-200 rounded-md p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={feeder.name}
                      onChange={(e) => updateFeeder(index, { name: e.target.value })}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm font-medium"
                      placeholder="Feeder Name"
                    />
                    <button
                      onClick={() => removeFeeder(index)}
                      className="ml-2 text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Load (VA)</label>
                      <input
                        type="number"
                        value={feeder.load_va}
                        onChange={(e) => updateFeeder(index, { load_va: Number(e.target.value) })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        step="1000"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Continuous %</label>
                      <input
                        type="number"
                        value={feeder.continuous_percent}
                        onChange={(e) => updateFeeder(index, { continuous_percent: Number(e.target.value) })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        min="0"
                        max="100"
                        step="5"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Distance (ft)</label>
                      <input
                        type="number"
                        value={feeder.distance_ft}
                        onChange={(e) => updateFeeder(index, { distance_ft: Number(e.target.value) })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        step="10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Voltage</label>
                      <input
                        type="number"
                        value={feeder.voltage}
                        onChange={(e) => updateFeeder(index, { voltage: Number(e.target.value) })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Phase</label>
                      <select
                        value={feeder.phase}
                        onChange={(e) => updateFeeder(index, { phase: Number(e.target.value) as 1 | 3 })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value={1}>1Φ</option>
                        <option value={3}>3Φ</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Material</label>
                      <select
                        value={feeder.conductor_material}
                        onChange={(e) => updateFeeder(index, { conductor_material: e.target.value as 'Cu' | 'Al' })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="Cu">Copper</option>
                        <option value="Al">Aluminum</option>
                      </select>
                    </div>
                  </div>

                  {/* Show feeder calculation results inline */}
                  {feederResults[`feeder-${index}`] && (
                    <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div>
                          <div className="text-gray-600">Conductors</div>
                          <div className="font-semibold text-gray-900">
                            {feederResults[`feeder-${index}`].phase_conductor_size} {feeder.conductor_material}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600">EGC</div>
                          <div className="font-semibold text-gray-900">
                            {feederResults[`feeder-${index}`].egc_size}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600">Conduit</div>
                          <div className="font-semibold text-gray-900">
                            {feederResults[`feeder-${index}`].recommended_conduit_size}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600">V.D.</div>
                          <div className={`font-semibold ${
                            feederResults[`feeder-${index}`].meets_voltage_drop ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {feederResults[`feeder-${index}`].voltage_drop_percent.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {feeders.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No feeders added</p>
              )}
            </div>
          </div>
        </div>

        {/* ===== RIGHT COLUMN: RESULTS ===== */}
        <div className="space-y-6">
          {result && (
            <>
              {/* Service Recommendation */}
              {(() => {
                const utilization = (result.calculatedAmps / result.recommendedMainBreakerAmps) * 100;
                const utilizationClass =
                  utilization > 95 ? 'utilization-critical' :
                  utilization > 80 ? 'utilization-warning' :
                  'utilization-good';

                return (
                  <div className={`border-2 rounded-lg card-padding ${utilizationClass} shadow-md`}>
                    <h3 className="text-base font-semibold text-gray-900 mb-3">Recommended Service Sizing</h3>

                    {/* Utilization Circle */}
                    <div className="flex justify-center mb-4">
                      <div className="relative w-32 h-32">
                        <svg className="transform -rotate-90 w-32 h-32">
                          <circle
                            cx="64"
                            cy="64"
                            r="56"
                            stroke="#e5e7eb"
                            strokeWidth="8"
                            fill="none"
                          />
                          <circle
                            cx="64"
                            cy="64"
                            r="56"
                            stroke={utilization > 95 ? '#ef4444' : utilization > 80 ? '#f59e0b' : '#10b981'}
                            strokeWidth="8"
                            fill="none"
                            strokeDasharray={`${(utilization / 100) * 352} 352`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <div className="text-3xl font-bold text-gray-900 tabular-nums">{utilization.toFixed(1)}%</div>
                          <div className="text-xs text-gray-600">Utilized</div>
                        </div>
                      </div>
                    </div>

                    {/* Main Breaker (OCPD) */}
                    <div className="bg-white/80 rounded-lg p-3 mb-2">
                      <div className="text-center">
                        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Main Breaker (OCPD)</div>
                        <div className="text-3xl font-bold text-blue-600 mb-1 tabular-nums">
                          {result.recommendedMainBreakerAmps}A
                        </div>
                        <div className="text-xs text-gray-600">
                          <span className="nec-reference">NEC 240.6(A)</span>
                        </div>
                      </div>
                    </div>

                    {/* Service Equipment Bus Rating */}
                    <div className="bg-white/80 rounded-lg p-3 mb-3">
                      <div className="text-center">
                        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Service Bus Rating</div>
                        <div className="text-3xl font-bold text-green-600 mb-1 tabular-nums">
                          {result.recommendedServiceBusRating}A
                        </div>
                        <div className="text-xs text-gray-600">
                          Commercial Bus Size
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-gray-300/50 pt-2 mb-3">
                      <div className="text-xs text-gray-700 text-center font-medium">
                        {servicePhase === 3 ? '3Φ' : '1Φ'} • {serviceVoltage}V
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-gray-600 text-xs">Calculated Load</div>
                        <div className="font-semibold text-gray-900 tabular-nums calculated-value">
                          {result.calculatedAmps.toFixed(1)} A
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-600 text-xs">Total Demand</div>
                        <div className="font-semibold text-gray-900 tabular-nums calculated-value">
                          {formatVA_to_kVA(result.totalDemandLoad_VA)} kVA
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-600 text-xs">Connected Load</div>
                        <div className="font-semibold text-gray-900 tabular-nums calculated-value">
                          {formatVA_to_kVA(result.totalConnectedLoad_VA)} kVA
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-600 text-xs">Available</div>
                        <div className="font-semibold text-gray-900 tabular-nums">
                          {(result.recommendedMainBreakerAmps - result.calculatedAmps).toFixed(1)} A
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Load Breakdown */}
              <div className="bg-white border border-gray-200 rounded-lg card-padding section-spacing">
                <h3 className="text-base font-semibold text-gray-900 mb-3">Load Breakdown</h3>

                <div className="space-y-2">
                  {result.loadBreakdown.map((item, index) => {
                    // Determine color coding based on load type
                    const isHVAC = item.category.toLowerCase().includes('hvac');
                    const borderClass = isHVAC ? 'load-hvac' :
                                       item.isContinuous ? 'load-continuous' :
                                       'load-noncontinuous';

                    return (
                      <div
                        key={index}
                        className={`${borderClass} pl-3 py-2 bg-gray-50/50 rounded-r`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold text-gray-900">{item.category}</div>
                            {item.isContinuous && (
                              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                Continuous
                              </span>
                            )}
                          </div>
                          <div className="text-xs">
                            <span className="nec-reference">{item.necReference}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          <div>
                            <div className="text-gray-600 mb-0.5">Connected</div>
                            <div className="font-semibold text-gray-900 tabular-nums calculated-value">
                              {formatVA_to_kVA(item.connectedLoad_VA)} kVA
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600 mb-0.5">Demand</div>
                            <div className="font-semibold text-gray-900 tabular-nums calculated-value">
                              {formatVA_to_kVA(item.demandLoad_VA)} kVA
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600 mb-0.5">Factor</div>
                            <div className="font-semibold text-gray-900 tabular-nums">{item.demandFactor.toFixed(0)}%</div>
                          </div>
                          <div>
                            <div className="text-gray-600 mb-0.5">Service</div>
                            <div className="font-semibold text-gray-900 tabular-nums calculated-value">
                              {formatVA_to_kVA(item.serviceSizingLoad_VA)} kVA
                              {item.isContinuous && item.demandLoad_VA > 0 && (
                                <span className="ml-1 text-xs text-blue-600 font-normal">
                                  ×1.25
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className="bg-[#fff8e6] border border-[#c9a227]/40 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-[#c9a227] mt-0.5 flex-shrink-0" />
                    <div className="space-y-2">
                      {result.warnings.map((warning, index) => (
                        <p key={index} className="text-sm text-[#7a6200]">
                          {warning}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {result.notes.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2 text-sm">Calculation Notes</h4>
                  <ul className="space-y-1">
                    {result.notes.map((note, index) => (
                      <li key={index} className="text-xs text-blue-700">
                        • {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
