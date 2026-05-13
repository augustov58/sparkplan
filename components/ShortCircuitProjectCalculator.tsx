/**
 * Project-aware Short Circuit calculator embedded in the Short Circuit Analysis tab.
 *
 * Unlike the generic calculator in Tools & Calculators, this version pulls inputs
 * directly from the project / feeders / saved-service-calc, so the user never has to
 * juggle tabs to copy numbers. Reuses the same pure calc functions, so engine
 * behavior is identical — only the data plumbing changes.
 *
 * Two modes:
 * - Service Entrance: auto-fills service amps/V/phase + utility transformer from
 *   the project row. Conductor params are user input (transformer-to-MDP run).
 * - Downstream Panel: panel dropdown filtered to panels not yet calculated. On
 *   panel select, auto-fills source-If from the saved service calc result and
 *   feeder geometry from the feeders table (destination_panel_id === panel.id).
 */

import React, { useState, useMemo } from 'react';
import { Plus, X, Save, Zap } from 'lucide-react';
import {
  calculateServiceFaultCurrent,
  calculateDownstreamFaultCurrent,
  estimateUtilityTransformer,
} from '../services/calculations/shortCircuit';
import { useFeeders } from '../hooks/useFeeders';
import type { Database, ShortCircuitCalculationInsert } from '../lib/database.types';

type Project = Database['public']['Tables']['projects']['Row'];
type Panel = Database['public']['Tables']['panels']['Row'];
type Feeder = Database['public']['Tables']['feeders']['Row'];
type ShortCircuitCalculation = Database['public']['Tables']['short_circuit_calculations']['Row'];

export type CreateCalculationFn = (
  calc: Omit<ShortCircuitCalculationInsert, 'id' | 'user_id'>,
) => Promise<ShortCircuitCalculation | null>;

export interface PanelFormState {
  feederLength: number;
  feederSize: string;
  feederMaterial: 'Cu' | 'Al';
  feederConduit: 'Steel' | 'PVC' | 'Aluminum';
  feederSets: number;
  feederVoltage: number;
  feederPhase: 1 | 3;
}

// Pure derivation: given a panel + its supplying feeder + the project, produce
// the initial panel-mode form values. Extracted so it's unit-testable without
// rendering the React tree.
export function derivePanelFormState(
  panel: Panel,
  project: Pick<Project, 'service_voltage' | 'service_phase'>,
  feeder: Feeder | undefined,
): PanelFormState {
  return {
    feederLength: feeder?.distance_ft ?? 50,
    feederSize: feeder?.phase_conductor_size ?? '3/0 AWG',
    feederMaterial: normalizeMaterial(feeder?.conductor_material),
    feederConduit: normalizeConduit(feeder?.conduit_type),
    feederSets: feeder?.sets_in_parallel ?? 1,
    feederVoltage: panel.voltage || project.service_voltage || 240,
    feederPhase: (project.service_phase ?? 1) === 3 ? 3 : 1,
  };
}

// Source If used as input for downstream calcs: prefer the saved service-calc
// result, then the project's recorded utility AFC, then a 10 kA default.
export function deriveSourceFaultCurrent(
  serviceCalculation: ShortCircuitCalculation | undefined,
  project: Pick<Project, 'utility_available_fault_current_a'>,
): number {
  const fromService = (serviceCalculation?.results as any)?.faultCurrent;
  if (typeof fromService === 'number' && fromService > 0) return fromService;
  if (project.utility_available_fault_current_a && project.utility_available_fault_current_a > 0) {
    return project.utility_available_fault_current_a;
  }
  return 10000;
}

interface Props {
  project: Project;
  panels: Panel[];
  existingCalculations: ShortCircuitCalculation[];
  // Hoisted from the parent's useShortCircuitCalculations instance so saves
  // update the parent's calc list immediately (single source of truth) instead
  // of relying on the realtime channel to round-trip.
  createCalculation: CreateCalculationFn;
}

const CONDUCTOR_SIZES = [
  '14 AWG', '12 AWG', '10 AWG', '8 AWG', '6 AWG', '4 AWG', '3 AWG', '2 AWG', '1 AWG',
  '1/0 AWG', '2/0 AWG', '3/0 AWG', '4/0 AWG',
  '250 kcmil', '300 kcmil', '350 kcmil', '400 kcmil', '500 kcmil',
];

// Maps the free-form DB string into the strict union the calc engine expects.
// Anything we don't recognize falls back to 'Steel' (the most common conduit).
function normalizeConduit(raw: string | null | undefined): 'Steel' | 'PVC' | 'Aluminum' {
  const s = (raw ?? '').toLowerCase();
  if (s.includes('pvc')) return 'PVC';
  if (s.includes('alum')) return 'Aluminum';
  return 'Steel';
}

function normalizeMaterial(raw: string | null | undefined): 'Cu' | 'Al' {
  const s = (raw ?? '').toLowerCase();
  return s.startsWith('al') ? 'Al' : 'Cu';
}

export const ShortCircuitProjectCalculator: React.FC<Props> = ({
  project,
  panels,
  existingCalculations,
  createCalculation,
}) => {
  const { getSupplyingFeeder } = useFeeders(project.id);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'service' | 'panel'>('service');
  const [saving, setSaving] = useState(false);

  const serviceCalculation = useMemo(
    () => existingCalculations.find((c) => c.calculation_type === 'service' && !c.panel_id),
    [existingCalculations],
  );
  const calculatedPanelIds = useMemo(
    () => new Set(existingCalculations.map((c) => c.panel_id).filter((id): id is string => !!id)),
    [existingCalculations],
  );
  // Exclude (a) panels already calculated, and (b) the MDP — the MDP is
  // covered by the service-entrance calc (calc_type='service', panel_id=null),
  // not by a panel-level row, so it would never appear in calculatedPanelIds.
  // Filtering by is_main prevents the user from accidentally double-calculating
  // it as a downstream panel.
  const availablePanels = useMemo(
    () => panels.filter((p) => !calculatedPanelIds.has(p.id) && !p.is_main),
    [panels, calculatedPanelIds],
  );

  // -- Service mode state, seeded from the project row ----------------------
  const [serviceAmps, setServiceAmps] = useState(project.service_amps ?? 200);
  const [serviceVoltage, setServiceVoltage] = useState(project.service_voltage ?? 240);
  const [servicePhase, setServicePhase] = useState<1 | 3>(
    (project.service_phase ?? 1) === 3 ? 3 : 1,
  );
  const [transformerKVA, setTransformerKVA] = useState<number | null>(
    project.utility_transformer_kva ?? null,
  );
  const [transformerImpedance, setTransformerImpedance] = useState(
    project.utility_transformer_impedance_pct ?? (servicePhase === 3 ? 5.75 : 2.5),
  );
  const [svcLength, setSvcLength] = useState(50);
  const [svcSize, setSvcSize] = useState('3/0 AWG');
  const [svcMaterial, setSvcMaterial] = useState<'Cu' | 'Al'>('Cu');
  const [svcConduit, setSvcConduit] = useState<'Steel' | 'PVC' | 'Aluminum'>('Steel');
  const [svcSets, setSvcSets] = useState(1);

  // -- Panel mode state ----------------------------------------------------
  const [selectedPanelId, setSelectedPanelId] = useState<string>('');
  const [feederLength, setFeederLength] = useState(50);
  const [feederSize, setFeederSize] = useState('3/0 AWG');
  const [feederMaterial, setFeederMaterial] = useState<'Cu' | 'Al'>('Cu');
  const [feederConduit, setFeederConduit] = useState<'Steel' | 'PVC' | 'Aluminum'>('Steel');
  const [feederSets, setFeederSets] = useState(1);
  const [feederVoltage, setFeederVoltage] = useState(240);
  const [feederPhase, setFeederPhase] = useState<1 | 3>(1);
  const [notes, setNotes] = useState('');

  // When the user picks a panel, hydrate the feeder fields from the matching
  // feeder row + source-If from the saved service calc. The user can still edit
  // every field afterward (override path).
  const handlePanelSelect = (panelId: string) => {
    setSelectedPanelId(panelId);
    const panel = panels.find((p) => p.id === panelId);
    if (!panel) return;
    const next = derivePanelFormState(panel, project, getSupplyingFeeder(panelId));
    setFeederLength(next.feederLength);
    setFeederSize(next.feederSize);
    setFeederMaterial(next.feederMaterial);
    setFeederConduit(next.feederConduit);
    setFeederSets(next.feederSets);
    setFeederVoltage(next.feederVoltage);
    setFeederPhase(next.feederPhase);
  };

  const sourceFaultCurrent = useMemo(
    () => deriveSourceFaultCurrent(serviceCalculation, project),
    [serviceCalculation, project],
  );

  // -- Live calc preview ---------------------------------------------------
  const result = useMemo(() => {
    try {
      if (mode === 'service') {
        const transformer = transformerKVA !== null
          ? {
              kva: transformerKVA,
              primaryVoltage: servicePhase === 3 ? 12470 : 7200,
              secondaryVoltage: serviceVoltage,
              impedance: transformerImpedance,
            }
          : estimateUtilityTransformer(serviceAmps, serviceVoltage, servicePhase, transformerImpedance);
        return calculateServiceFaultCurrent(transformer, serviceVoltage, servicePhase, {
          length: svcLength,
          conductorSize: svcSize,
          material: svcMaterial,
          conduitType: svcConduit,
          setsInParallel: svcSets,
        });
      }
      if (!selectedPanelId) return null;
      return calculateDownstreamFaultCurrent(
        {
          length: feederLength,
          conductorSize: feederSize,
          material: feederMaterial,
          conduitType: feederConduit,
          voltage: feederVoltage,
          phase: feederPhase,
        },
        sourceFaultCurrent,
      );
    } catch (err) {
      console.error('SC preview error:', err);
      return null;
    }
  }, [
    mode, serviceAmps, serviceVoltage, servicePhase, transformerKVA, transformerImpedance,
    svcLength, svcSize, svcMaterial, svcConduit, svcSets,
    selectedPanelId, feederLength, feederSize, feederMaterial, feederConduit, feederSets,
    feederVoltage, feederPhase, sourceFaultCurrent,
  ]);

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const selectedPanel = panels.find((p) => p.id === selectedPanelId);
      await createCalculation({
        project_id: project.id,
        panel_id: mode === 'panel' ? selectedPanelId || null : null,
        location_name:
          mode === 'service'
            ? 'Service Entrance'
            : selectedPanel?.name ?? 'Unknown Panel',
        calculation_type: mode,
        service_amps: mode === 'service' ? serviceAmps : null,
        service_voltage: mode === 'service' ? serviceVoltage : null,
        service_phase: mode === 'service' ? servicePhase : null,
        transformer_kva: mode === 'service' && transformerKVA !== null ? transformerKVA : null,
        transformer_impedance: mode === 'service' ? transformerImpedance : null,
        service_conductor_length: mode === 'service' ? svcLength : null,
        service_conductor_size: mode === 'service' ? svcSize : null,
        service_conductor_material: mode === 'service' ? svcMaterial : null,
        service_conduit_type: mode === 'service' ? svcConduit : null,
        source_fault_current: mode === 'panel' ? sourceFaultCurrent : null,
        feeder_length: mode === 'panel' ? feederLength : null,
        feeder_conductor_size: mode === 'panel' ? feederSize : null,
        feeder_material: mode === 'panel' ? feederMaterial : null,
        feeder_conduit_type: mode === 'panel' ? feederConduit : null,
        feeder_voltage: mode === 'panel' ? feederVoltage : null,
        feeder_phase: mode === 'panel' ? feederPhase : null,
        results: result as any,
        notes: notes || null,
      });
      setOpen(false);
      setSelectedPanelId('');
      setNotes('');
    } catch (err) {
      console.error('SC save error:', err);
      alert('Failed to save calculation. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => {
          // Default mode reflects what's missing: no service calc yet → service,
          // otherwise → panel (the common follow-up action).
          setMode(serviceCalculation ? 'panel' : 'service');
          setOpen(true);
        }}
        className="w-full bg-white border border-dashed border-gray-300 hover:border-gray-900 hover:bg-gray-50 rounded-lg px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium text-gray-700 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Short Circuit Calculation
      </button>
    );
  }

  const inputClass = 'w-full border border-gray-200 rounded text-sm py-1.5 px-2 focus:border-gray-900 focus:outline-none';
  const labelClass = 'block text-xs font-medium text-gray-600 mb-1';

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-gray-700" />
          <span className="font-medium text-gray-900 text-sm">New Calculation</span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-gray-400 hover:text-gray-700 p-1"
          aria-label="Close calculator"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mode toggle */}
      <div className="px-4 pt-3">
        <div className="inline-flex gap-1 bg-gray-100 p-1 rounded-md">
          <button
            onClick={() => setMode('service')}
            disabled={!!serviceCalculation && mode !== 'service'}
            title={serviceCalculation ? 'Service entrance already calculated — delete the existing card to recalculate' : ''}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              mode === 'service' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Service Entrance
          </button>
          <button
            onClick={() => setMode('panel')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              mode === 'panel' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Downstream Panel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr,260px] gap-4 p-4">
        {/* Inputs */}
        <div className="space-y-3">
          {mode === 'service' ? (
            <ServiceForm
              serviceAmps={serviceAmps} setServiceAmps={setServiceAmps}
              serviceVoltage={serviceVoltage} setServiceVoltage={setServiceVoltage}
              servicePhase={servicePhase} setServicePhase={setServicePhase}
              transformerKVA={transformerKVA} setTransformerKVA={setTransformerKVA}
              transformerImpedance={transformerImpedance} setTransformerImpedance={setTransformerImpedance}
              svcLength={svcLength} setSvcLength={setSvcLength}
              svcSize={svcSize} setSvcSize={setSvcSize}
              svcMaterial={svcMaterial} setSvcMaterial={setSvcMaterial}
              svcConduit={svcConduit} setSvcConduit={setSvcConduit}
              svcSets={svcSets} setSvcSets={setSvcSets}
              inputClass={inputClass} labelClass={labelClass}
            />
          ) : (
            <PanelForm
              availablePanels={availablePanels}
              selectedPanelId={selectedPanelId}
              onPanelSelect={handlePanelSelect}
              sourceFaultCurrent={sourceFaultCurrent}
              feederLength={feederLength} setFeederLength={setFeederLength}
              feederSize={feederSize} setFeederSize={setFeederSize}
              feederMaterial={feederMaterial} setFeederMaterial={setFeederMaterial}
              feederConduit={feederConduit} setFeederConduit={setFeederConduit}
              feederSets={feederSets} setFeederSets={setFeederSets}
              feederVoltage={feederVoltage} setFeederVoltage={setFeederVoltage}
              feederPhase={feederPhase} setFeederPhase={setFeederPhase}
              hasServiceCalc={!!serviceCalculation}
              inputClass={inputClass} labelClass={labelClass}
            />
          )}

          <div>
            <label className={labelClass}>Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={inputClass}
              placeholder="e.g., utility-confirmed transformer kVA"
            />
          </div>
        </div>

        {/* Live preview */}
        <ResultPreview result={result} mode={mode} canSave={mode === 'service' || !!selectedPanelId} saving={saving} onSave={handleSave} />
      </div>
    </div>
  );
};

// --- Sub-components -------------------------------------------------------

interface ServiceFormProps {
  serviceAmps: number; setServiceAmps: (n: number) => void;
  serviceVoltage: number; setServiceVoltage: (n: number) => void;
  servicePhase: 1 | 3; setServicePhase: (n: 1 | 3) => void;
  transformerKVA: number | null; setTransformerKVA: (n: number | null) => void;
  transformerImpedance: number; setTransformerImpedance: (n: number) => void;
  svcLength: number; setSvcLength: (n: number) => void;
  svcSize: string; setSvcSize: (s: string) => void;
  svcMaterial: 'Cu' | 'Al'; setSvcMaterial: (m: 'Cu' | 'Al') => void;
  svcConduit: 'Steel' | 'PVC' | 'Aluminum'; setSvcConduit: (c: 'Steel' | 'PVC' | 'Aluminum') => void;
  svcSets: number; setSvcSets: (n: number) => void;
  inputClass: string; labelClass: string;
}

const ServiceForm: React.FC<ServiceFormProps> = (p) => (
  <>
    <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-900">
      Service params pre-filled from the project. Override below if needed.
    </div>
    <div className="grid grid-cols-3 gap-2">
      <div>
        <label className={p.labelClass}>Service Amps</label>
        <input type="number" value={p.serviceAmps} onChange={(e) => p.setServiceAmps(Number(e.target.value))} className={p.inputClass} />
      </div>
      <div>
        <label className={p.labelClass}>Voltage</label>
        <select value={p.serviceVoltage} onChange={(e) => p.setServiceVoltage(Number(e.target.value))} className={p.inputClass}>
          <option value={120}>120V</option>
          <option value={208}>208V</option>
          <option value={240}>240V</option>
          <option value={277}>277V</option>
          <option value={480}>480V</option>
        </select>
      </div>
      <div>
        <label className={p.labelClass}>Phase</label>
        <select value={p.servicePhase} onChange={(e) => p.setServicePhase(Number(e.target.value) as 1 | 3)} className={p.inputClass}>
          <option value={1}>1φ</option>
          <option value={3}>3φ</option>
        </select>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className={p.labelClass}>Transformer kVA (blank = auto)</label>
        <input
          type="number"
          value={p.transformerKVA ?? ''}
          onChange={(e) => p.setTransformerKVA(e.target.value === '' ? null : Number(e.target.value))}
          className={p.inputClass}
          placeholder="Auto"
        />
      </div>
      <div>
        <label className={p.labelClass}>Impedance (%)</label>
        <input type="number" step="0.01" value={p.transformerImpedance} onChange={(e) => p.setTransformerImpedance(Number(e.target.value))} className={p.inputClass} />
      </div>
    </div>

    <div className="border-t border-gray-100 pt-3 space-y-2">
      <div className="text-xs font-medium text-gray-700">Service Conductors (transformer → MDP)</div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className={p.labelClass}>Length (ft)</label>
          <input type="number" value={p.svcLength} onChange={(e) => p.setSvcLength(Number(e.target.value))} className={p.inputClass} />
        </div>
        <div>
          <label className={p.labelClass}>Size</label>
          <select value={p.svcSize} onChange={(e) => p.setSvcSize(e.target.value)} className={p.inputClass}>
            {CONDUCTOR_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={p.labelClass}>Sets</label>
          <input type="number" min={1} max={10} value={p.svcSets} onChange={(e) => p.setSvcSets(Number(e.target.value))} className={p.inputClass} />
        </div>
        <div>
          <label className={p.labelClass}>Material</label>
          <select value={p.svcMaterial} onChange={(e) => p.setSvcMaterial(e.target.value as 'Cu' | 'Al')} className={p.inputClass}>
            <option value="Cu">Copper</option>
            <option value="Al">Aluminum</option>
          </select>
        </div>
        <div>
          <label className={p.labelClass}>Conduit</label>
          <select value={p.svcConduit} onChange={(e) => p.setSvcConduit(e.target.value as 'Steel' | 'PVC' | 'Aluminum')} className={p.inputClass}>
            <option value="Steel">Steel</option>
            <option value="PVC">PVC</option>
            <option value="Aluminum">Aluminum</option>
          </select>
        </div>
      </div>
    </div>
  </>
);

interface PanelFormProps {
  availablePanels: Panel[];
  selectedPanelId: string;
  onPanelSelect: (id: string) => void;
  sourceFaultCurrent: number;
  feederLength: number; setFeederLength: (n: number) => void;
  feederSize: string; setFeederSize: (s: string) => void;
  feederMaterial: 'Cu' | 'Al'; setFeederMaterial: (m: 'Cu' | 'Al') => void;
  feederConduit: 'Steel' | 'PVC' | 'Aluminum'; setFeederConduit: (c: 'Steel' | 'PVC' | 'Aluminum') => void;
  feederSets: number; setFeederSets: (n: number) => void;
  feederVoltage: number; setFeederVoltage: (n: number) => void;
  feederPhase: 1 | 3; setFeederPhase: (n: 1 | 3) => void;
  hasServiceCalc: boolean;
  inputClass: string; labelClass: string;
}

const PanelForm: React.FC<PanelFormProps> = (p) => (
  <>
    {!p.hasServiceCalc && (
      <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-900">
        No service-entrance calc saved — using project's recorded utility AFC (or 10 kA default) as source. Save the service-entrance calc first for the most accurate downstream chain.
      </div>
    )}
    <div>
      <label className={p.labelClass}>Panel</label>
      <select value={p.selectedPanelId} onChange={(e) => p.onPanelSelect(e.target.value)} className={p.inputClass}>
        <option value="">— Select a panel —</option>
        {p.availablePanels.length === 0 && (
          <option disabled>(all panels already calculated)</option>
        )}
        {p.availablePanels.map((panel) => (
          <option key={panel.id} value={panel.id}>
            {panel.name} ({panel.bus_rating}A, {panel.voltage}V)
          </option>
        ))}
      </select>
    </div>

    {p.selectedPanelId && (
      <div className="bg-green-50 border border-green-200 rounded p-2 text-xs text-green-900">
        Feeder geometry auto-filled from feeder record. Source If: <strong>{(p.sourceFaultCurrent / 1000).toFixed(1)} kA</strong>. Override below if needed.
      </div>
    )}

    <div className="grid grid-cols-3 gap-2">
      <div>
        <label className={p.labelClass}>Length (ft)</label>
        <input type="number" value={p.feederLength} onChange={(e) => p.setFeederLength(Number(e.target.value))} className={p.inputClass} />
      </div>
      <div>
        <label className={p.labelClass}>Size</label>
        <select value={p.feederSize} onChange={(e) => p.setFeederSize(e.target.value)} className={p.inputClass}>
          {CONDUCTOR_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className={p.labelClass}>Sets</label>
        <input type="number" min={1} max={10} value={p.feederSets} onChange={(e) => p.setFeederSets(Number(e.target.value))} className={p.inputClass} />
      </div>
      <div>
        <label className={p.labelClass}>Material</label>
        <select value={p.feederMaterial} onChange={(e) => p.setFeederMaterial(e.target.value as 'Cu' | 'Al')} className={p.inputClass}>
          <option value="Cu">Copper</option>
          <option value="Al">Aluminum</option>
        </select>
      </div>
      <div>
        <label className={p.labelClass}>Conduit</label>
        <select value={p.feederConduit} onChange={(e) => p.setFeederConduit(e.target.value as 'Steel' | 'PVC' | 'Aluminum')} className={p.inputClass}>
          <option value="Steel">Steel</option>
          <option value="PVC">PVC</option>
          <option value="Aluminum">Aluminum</option>
        </select>
      </div>
      <div>
        <label className={p.labelClass}>V / Phase</label>
        <div className="flex gap-1">
          <select value={p.feederVoltage} onChange={(e) => p.setFeederVoltage(Number(e.target.value))} className={p.inputClass}>
            <option value={120}>120V</option>
            <option value={208}>208V</option>
            <option value={240}>240V</option>
            <option value={277}>277V</option>
            <option value={480}>480V</option>
          </select>
          <select value={p.feederPhase} onChange={(e) => p.setFeederPhase(Number(e.target.value) as 1 | 3)} className={p.inputClass}>
            <option value={1}>1φ</option>
            <option value={3}>3φ</option>
          </select>
        </div>
      </div>
    </div>
  </>
);

interface ResultPreviewProps {
  result: ReturnType<typeof calculateServiceFaultCurrent> | null;
  mode: 'service' | 'panel';
  canSave: boolean;
  saving: boolean;
  onSave: () => void;
}

const ResultPreview: React.FC<ResultPreviewProps> = ({ result, mode, canSave, saving, onSave }) => (
  <div className="bg-gray-50 border border-gray-200 rounded p-3 space-y-3 text-sm h-fit">
    <div className="text-xs uppercase tracking-wider text-gray-500">
      {mode === 'service' ? 'Service Fault Current' : 'Panel Fault Current'}
    </div>
    <div>
      <div className="text-3xl font-light text-gray-900">
        {result ? `${(result.faultCurrent / 1000).toFixed(1)} kA` : '—'}
      </div>
      {result && (
        <div className="text-xs text-gray-500">
          {result.faultCurrent.toLocaleString(undefined, { maximumFractionDigits: 0 })} A RMS
        </div>
      )}
    </div>
    {result && (
      <>
        <div className="bg-orange-100 text-orange-900 text-xs px-2 py-1 rounded inline-block font-medium">
          Required AIC: {result.requiredAIC} kA
        </div>
        <div className={`text-xs px-2 py-1 rounded ${result.compliance.compliant ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'}`}>
          {result.compliance.compliant ? 'Compliant' : 'Review'} — {result.compliance.necArticle}
        </div>
      </>
    )}
    <button
      onClick={onSave}
      disabled={!canSave || !result || saving}
      className="w-full bg-gray-900 hover:bg-black text-white px-3 py-2 rounded text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <Save className="w-3.5 h-3.5" />
      {saving ? 'Saving…' : 'Save to Project'}
    </button>
  </div>
);
