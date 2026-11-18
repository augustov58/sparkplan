import React, { useState, useMemo, useEffect } from 'react';
import { Zap, Check, AlertCircle, Info, Activity, Sparkles, Calculator } from 'lucide-react';
import {
  generateCustomEVPanel,
  templateCircuitRow,
  type ChargerTypeOption,
  type CustomEVPanelConfig
} from '../data/ev-panel-templates';
import { usePanels } from '../hooks/usePanels';
import { useCircuits } from '../hooks/useCircuits';
import { useTransformers } from '../hooks/useTransformers';
import { useProjectNecEdition } from '../hooks/useProjectNecEdition';
import { scheduleServiceCheck, panelDesignAmps } from '../lib/storedCalcs';
import { dwellingAggregateOptions } from '../lib/projectSettings';
import { calculateAggregatedLoad, isEVEMSMarkerCircuit } from '../services/calculations/upstreamLoadAggregation';
import { showToast, toastMessages } from '../lib/toast';
import type { Database } from '../lib/database.types';
import type { Project } from '../types';

type PanelRow = Database['public']['Tables']['panels']['Row'];
type CircuitRow = Database['public']['Tables']['circuits']['Row'];

interface EVPanelTemplatesProps {
  project: Project;
}

/**
 * A whole-number input that keeps what the user types (#243: clamping every
 * keystroke turned "12" into 20). A valid in-range value is reported as it's
 * typed; the field is clamped when it loses focus.
 */
const WholeNumberInput: React.FC<{
  value: number; min: number; max: number; onChange: (n: number) => void; className: string;
}> = ({ value, min, max, onChange, className }) => {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    // The value changed from outside (a reset, or a clamp by another field)
    if (parseInt(text, 10) !== value) setText(String(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps -- re-sync on value only
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseInt(e.target.value, 10);
        if (Number.isInteger(n) && n >= min && n <= max) onChange(n);
      }}
      onBlur={() => {
        const n = parseInt(text, 10);
        const clamped = Number.isInteger(n) ? Math.max(min, Math.min(max, n)) : value;
        setText(String(clamped));
        onChange(clamped);
      }}
      className={className}
    />
  );
};

export const EVPanelTemplates: React.FC<EVPanelTemplatesProps> = ({ project }) => {
  const { panels, loading: panelsLoading, createPanel } = usePanels(project.id);
  const { circuits, createCircuit } = useCircuits(project.id);
  const { transformers } = useTransformers(project.id);
  const necEdition = useProjectNecEdition(project);

  // Configuration state
  const [chargerType, setChargerType] = useState<ChargerTypeOption>('Level 2 (48A)');
  const [numberOfChargers, setNumberOfChargers] = useState<number>(4);
  const [useEVEMS, setUseEVEMS] = useState<boolean>(false);
  const [simultaneousChargerInput, setSimultaneousChargers] = useState<number>(3);
  // #230: never more simultaneous chargers than chargers. The input kept 3
  // when the count dropped to 1, and the setpoint marker stored 3 × 11,520 VA.
  const simultaneousChargers = Math.min(simultaneousChargerInput, numberOfChargers);
  const [includeSpare, setIncludeSpare] = useState<boolean>(true);
  const [includeLighting, setIncludeLighting] = useState<boolean>(true);
  const [customPanelName, setCustomPanelName] = useState('');

  // Apply status
  const [applyStatus, setApplyStatus] = useState<'idle' | 'applying' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');


  // One template for the service-check preview and for Create (#224). With
  // EVEMS, an explicit NEC 625.42 setpoint marker: the simultaneous chargers
  // at full power (the legacy marker clamped to the panel's main breaker).
  const builderTemplate = useMemo(() => {
    const config: CustomEVPanelConfig = {
      chargerType,
      numberOfChargers,
      useEVEMS,
      simultaneousChargers: useEVEMS ? simultaneousChargers : undefined,
      includeSpare,
      includeLighting,
      panelName: customPanelName || undefined,
    };
    const first = generateCustomEVPanel({ projectId: project.id, config });
    if (!useEVEMS) return first;
    const perChargerVA = first.circuits.find(c => c.isEvCharger)?.loadVA ?? 0;
    return generateCustomEVPanel({
      projectId: project.id,
      config: { ...config, evemsSetpointVA: simultaneousChargers * perChargerVA },
    });
  }, [project.id, chargerType, numberOfChargers, useEVEMS, simultaneousChargers, includeSpare, includeLighting, customPanelName]);

  const toCircuitRow = (c: (typeof builderTemplate.circuits)[number], panelId: string) =>
    templateCircuitRow(c, panelId, project.id);

  // #193: the service check once this panel is on the service (under the
  // MDP): the project's Article 220 load + 25% of its continuous loads, the
  // template's chargers included — the check E-102 and the Service Upgrade
  // Wizard make. Was: the template's breaker sizes against the service
  // rating, ignoring the loads already on it.
  // The panel Create would add, under the MDP, as rows (#230: the preview
  // reads this, not a separate breaker sum).
  const preview = useMemo(() => {
    const mdp = panels.find(p => p.is_main);
    // No MDP yet: the panel on its own (its demand doesn't depend on one; the
    // service check below needs the MDP and stays hidden) — was "—" (#241)
    const panel = {
      ...builderTemplate.panel,
      id: 'ev-panel-preview',
      is_main: false,
      fed_from_type: mdp ? 'panel' : 'service',
      fed_from: mdp ? mdp.id : null,
      fed_from_transformer_id: null,
    } as unknown as PanelRow;
    const rows = builderTemplate.circuits.map((c, i) => ({
      ...toCircuitRow(c, panel.id),
      id: `ev-panel-preview-${i}`,
    }) as unknown as CircuitRow);
    return { panel, panels: [...panels, panel], circuits: [...circuits, ...rows], rows };
  }, [panels, circuits, builderTemplate]); // toCircuitRow reads only project.id

  const serviceWithPanel = useMemo(
    () => preview && scheduleServiceCheck(project, preview.panels, preview.circuits, transformers, necEdition),
    [project, preview, transformers, necEdition],
  );

  // The preview card (#230), from the same functions as the created panel's
  // schedule: its NEC 220 demand (EVEMS at the setpoint), its 408.30 design
  // load (demand + 25% of continuous loads, as Inspector Mode checks the bus,
  // #225), and its circuits without the setpoint marker (metadata, #209).
  const panelSpecs = useMemo(() => {
    const p = builderTemplate.panel as unknown as PanelRow;
    const divisor = (p.voltage || 240) * (p.phase === 3 ? Math.sqrt(3) : 1);
    const circuitCount = builderTemplate.circuits.filter(c => !isEVEMSMarkerCircuit(c)).length;
    if (!preview) {
      return { panelRating: p.bus_rating, voltage: p.voltage, phase: p.phase, circuitCount, demandKVA: null, demandAmps: null, designAmps: null };
    }
    const occupancy = project.settings?.occupancyType ?? 'commercial';
    const demandVA = calculateAggregatedLoad(
      preview.panel.id, preview.panels, preview.circuits, transformers, occupancy, undefined, necEdition,
      dwellingAggregateOptions(project),
    ).totalDemandVA;
    const designAmps = panelDesignAmps(project, preview.panels, preview.circuits, transformers, necEdition)[preview.panel.id] ?? null;
    return {
      panelRating: p.bus_rating, voltage: p.voltage, phase: p.phase, circuitCount,
      demandKVA: demandVA / 1000, demandAmps: demandVA / divisor, designAmps,
    };
  }, [builderTemplate, preview, project, transformers, necEdition]);
  // #265: the panel Create adds is fed from the MDP. When its voltage or
  // phase differs from the MDP's (a 480 V 3Φ DC fast panel on a 240 V 1Φ
  // service), it can't be fed directly: say so before Create. Advisory —
  // Create still works (validation is advisory, never blocking).
  const serviceMdp = panels.find(p => p.is_main);
  const supplyMismatch = serviceMdp && (serviceMdp.voltage !== panelSpecs.voltage || serviceMdp.phase !== panelSpecs.phase)
    ? { name: serviceMdp.name, voltage: serviceMdp.voltage, phase: serviceMdp.phase }
    : null;
  const utilizationPct = panelSpecs.designAmps !== null && panelSpecs.panelRating
    ? (panelSpecs.designAmps / panelSpecs.panelRating) * 100
    : null;

  const handleApplyConfiguration = async () => {
    setApplyStatus('applying');
    setErrorMessage('');

    try {
      const { panel, circuits: templateCircuits } = builderTemplate;
      const mdp = panels.find(p => p.is_main);

      // Create panel in database. The template generator returns a Partial<Panel>
      // (Supabase fills the remaining nullable columns at insert time); cast to
      // satisfy createPanel's stricter Omit<PanelInsert, 'id'> shape.
      // EV sub-panels from this template are post-existing-service additions
      // by construction — flag with is_proposed:true so the riser PDF + One-Line
      // diagram render the dashed outline + "NEW" badge on existing projects.
      // Matches the per-circuit flag below at the createCircuit call.
      // #224: fed from the MDP when there is one (the template says 'service').
      const newPanel = await createPanel({
        ...panel,
        ...(mdp ? { fed_from_type: 'panel', fed_from: mdp.id } : {}),
        is_proposed: true,
      } as Parameters<typeof createPanel>[0], { silent: true }); // one summary toast below (#242)

      if (!newPanel || !newPanel.id) {
        throw new Error('Failed to create panel');
      }

      // Create all circuits as circuit rows (#224: the camelCase template shape
      // was inserted as is, so every insert failed and left an empty panel).
      // EV-template circuits are post-existing-service additions by
      // construction — flagged proposed for the "* = Proposed" marker.
      let failed = 0;
      for (const circuit of templateCircuits) {
        const created = await createCircuit(
          toCircuitRow(circuit, newPanel.id) as Parameters<typeof createCircuit>[0],
          { silent: true },
        );
        if (!created) failed++;
      }
      if (failed > 0) {
        throw new Error(`${failed} of ${templateCircuits.length} circuits could not be saved to "${newPanel.name}"`);
      }

      showToast.success(toastMessages.evPanel.created(newPanel.name, templateCircuits.filter(c => !isEVEMSMarkerCircuit(c)).length));
      setApplyStatus('success');
      setTimeout(() => {
        setApplyStatus('idle');
        // Reset to defaults
        setChargerType('Level 2 (48A)');
        setNumberOfChargers(4);
        setUseEVEMS(false);
        setSimultaneousChargers(3);
        setCustomPanelName('');
      }, 3000);
    } catch (error: any) {
      console.error('Error applying configuration:', error);
      setErrorMessage(error.message || 'Failed to create EV panel');
      setApplyStatus('error');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-2">
          <Zap className="w-7 h-7 text-[#2d3b2d]" />
          <h1 className="text-2xl font-bold text-gray-900">
            Custom EV Panel Builder
          </h1>
        </div>
        <p className="text-sm text-gray-600">
          Configure a custom EV charging panel with any number of chargers, EVEMS load management, and optional circuits
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Configuration Form */}
        <div className="space-y-6">
          {/* Charger Type */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Charger Type
            </label>
            <div className="space-y-2">
              {(['Level 2 (48A)', 'Level 2 (80A)', 'DC Fast Charge (150kW)'] as ChargerTypeOption[]).map(type => (
                <div
                  key={type}
                  onClick={() => setChargerType(type)}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    chargerType === type
                      ? 'border-[#2d3b2d] bg-[#f0f5f0]'
                      : 'border-gray-200 hover:border-[#94b894]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{type}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {type === 'Level 2 (48A)' && '11.5 kW | 60A breaker | 240V'}
                        {type === 'Level 2 (80A)' && '19.2 kW | 100A breaker | 240V'}
                        {type === 'DC Fast Charge (150kW)' && '150 kW | 250A breaker | 480V 3φ'}
                      </div>
                    </div>
                    {chargerType === type && (
                      <Check className="w-5 h-5 text-[#2d3b2d]" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Number of Chargers */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Number of Chargers
            </label>
            <WholeNumberInput
              min={1}
              max={20}
              value={numberOfChargers}
              onChange={setNumberOfChargers}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg font-medium focus:ring-2 focus:ring-[#2d3b2d]/20 focus:border-[#2d3b2d]"
            />
            <p className="text-xs text-gray-500 mt-2">
              Enter 1-20 chargers (typical: 4-8 for commercial)
            </p>
          </div>

          {/* EVEMS Load Management */}
          {chargerType !== 'DC Fast Charge (150kW)' && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-start gap-3 mb-4">
                <input
                  id="ev-builder-evems"
                  type="checkbox"
                  checked={useEVEMS}
                  onChange={(e) => setUseEVEMS(e.target.checked)}
                  className="mt-1 w-5 h-5 text-[#2d3b2d] border-gray-300 rounded focus:ring-[#2d3b2d]/20"
                />
                <div className="flex-1">
                  <label htmlFor="ev-builder-evems" className="block text-sm font-semibold text-gray-900 cursor-pointer">
                    Use EVEMS Load Management
                  </label>
                  <p className="text-xs text-gray-600 mt-1">
                    Per NEC 625.42 - Reduces panel capacity requirements by controlling simultaneous charging
                  </p>
                </div>
              </div>

              {useEVEMS && (
                <div className="mt-4 pl-8">
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Max Simultaneous Chargers
                  </label>
                  <WholeNumberInput
                    min={1}
                    max={numberOfChargers}
                    value={simultaneousChargers}
                    onChange={setSimultaneousChargers}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#2d3b2d]/20 focus:border-[#2d3b2d]"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Typical: 75% of total chargers ({Math.max(1, Math.floor(numberOfChargers * 0.75))} for {numberOfChargers} charger{numberOfChargers === 1 ? '' : 's'})
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Optional Circuits */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="text-sm font-semibold text-gray-900 mb-3">
              Optional Circuits
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  id="ev-builder-spare"
                  type="checkbox"
                  checked={includeSpare}
                  onChange={(e) => setIncludeSpare(e.target.checked)}
                  className="w-4 h-4 text-[#2d3b2d] border-gray-300 rounded focus:ring-[#2d3b2d]/20"
                />
                <label htmlFor="ev-builder-spare" className="text-sm text-gray-700 cursor-pointer">
                  Include Spare Circuit (20A)
                </label>
              </div>

              <div className="flex items-center gap-3">
                <input
                  id="ev-builder-lighting"
                  type="checkbox"
                  checked={includeLighting}
                  onChange={(e) => setIncludeLighting(e.target.checked)}
                  className="w-4 h-4 text-[#2d3b2d] border-gray-300 rounded focus:ring-[#2d3b2d]/20"
                />
                <label htmlFor="ev-builder-lighting" className="text-sm text-gray-700 cursor-pointer">
                  Include Lighting Circuit (20A)
                </label>
              </div>
            </div>
          </div>

          {/* Custom Panel Name */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Custom Panel Name (optional)
            </label>
            <input
              type="text"
              value={customPanelName}
              onChange={(e) => setCustomPanelName(e.target.value)}
              placeholder={`${numberOfChargers}× ${chargerType}${useEVEMS ? ' with EVEMS' : ''} Panel`}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2d3b2d]/20 focus:border-[#2d3b2d]"
            />
          </div>
        </div>

        {/* RIGHT: Live Preview */}
        <div className="space-y-6">
          {/* Panel Specifications */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="w-5 h-5 text-[#2d3b2d]" />
              <h3 className="font-bold text-gray-900">Panel Specifications</h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm text-gray-600">Panel Rating:</span>
                <span className="font-bold text-gray-900 text-lg">
                  {panelSpecs.panelRating}A
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm text-gray-600">Voltage/Phase:</span>
                <span className="font-medium text-gray-900">
                  {panelSpecs.voltage}V {panelSpecs.phase === 3 ? '3φ' : '1φ'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm text-gray-600">Demand Load (NEC 220{useEVEMS ? ', EVEMS setpoint' : ''}):</span>
                <span className="font-medium text-gray-900">
                  {panelSpecs.demandAmps !== null && panelSpecs.demandKVA !== null
                    ? `${panelSpecs.demandAmps.toFixed(1)} A (${panelSpecs.demandKVA.toFixed(1)} kVA)`
                    : '—'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm text-gray-600">Bus Design Load (NEC 408.30):</span>
                <span className="font-medium text-gray-900">
                  {panelSpecs.designAmps !== null ? `${panelSpecs.designAmps.toFixed(1)} A` : '—'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm text-gray-600">Total Circuits:</span>
                <span className="font-medium text-gray-900">
                  {panelSpecs.circuitCount}
                </span>
              </div>

              {/* Utilization Bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>Panel Utilization (bus design load ÷ rating)</span>
                  <span>{utilizationPct !== null ? `${utilizationPct.toFixed(0)}%` : '—'}</span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      (utilizationPct ?? 0) > 100
                        ? 'bg-red-500'
                        : (utilizationPct ?? 0) > 80
                        ? 'bg-[#fff8e6]0'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, utilizationPct ?? 0)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* What Will Be Created */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#2d3b2d]" />
              This will create:
            </h3>
            <ul className="text-sm text-gray-700 space-y-2">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>1 Panel:</strong> {panelSpecs.panelRating}A, {panelSpecs.voltage}V, {panelSpecs.phase}-phase
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>{numberOfChargers} EV Circuit{numberOfChargers === 1 ? '' : 's'}:</strong> {chargerType} charger{numberOfChargers === 1 ? '' : 's'}
                </span>
              </li>
              {useEVEMS && (
                <li className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>1 EVEMS Controller:</strong> Manages {simultaneousChargers} simultaneous charger{simultaneousChargers === 1 ? '' : 's'}
                  </span>
                </li>
              )}
              {includeSpare && (
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>1 Spare Circuit (20A)</span>
                </li>
              )}
              {includeLighting && (
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>1 Lighting Circuit (20A)</span>
                </li>
              )}
            </ul>
          </div>

          {/* #265: panel voltage/phase differs from the service */}
          {supplyMismatch && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4" data-testid="ev-builder-supply-mismatch">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-900 mb-1">Needs a transformer or a separate service</h4>
                  <p className="text-sm text-amber-800">
                    This panel is {panelSpecs.voltage}V {panelSpecs.phase}-phase; the service ({supplyMismatch.name}) is{' '}
                    {supplyMismatch.voltage}V {supplyMismatch.phase}-phase. It can't be fed from {supplyMismatch.name} directly:
                    plan a transformer between them, or a separate {panelSpecs.voltage}V service. Create still adds the panel
                    under {supplyMismatch.name}; set its feed in Circuit Design.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Service Upgrade Warning */}
          {serviceWithPanel && !serviceWithPanel.sufficient && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-orange-900 mb-1">Service Upgrade May Be Required</h4>
                  <p className="text-sm text-orange-800">
                    With this panel, the service check is <strong>{Math.round(serviceWithPanel.checkAmps)}A</strong>
                    {' '}on the <strong>{serviceWithPanel.serviceAmps}A</strong> service: the NEC 220 load of
                    {' '}{serviceWithPanel.loadKVA.toFixed(1)} kVA plus {serviceWithPanel.adderKVA.toFixed(1)} kVA
                    {' '}(25% of the continuous loads, NEC 230.42(A)(1)), the loads already on the
                    {' '}service included. Use the <strong>Service Upgrade Wizard</strong> to check the upgrade per NEC 220.87.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Apply Button */}
          <button
            onClick={handleApplyConfiguration}
            // Wait for the panels: the new panel attaches to the MDP (#224)
            disabled={applyStatus === 'applying' || panelsLoading}
            className={`w-full py-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
              applyStatus === 'applying'
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : applyStatus === 'success'
                ? 'bg-green-500 text-white'
                : 'bg-[#2d3b2d] text-white hover:bg-[#3d4f3d]'
            }`}
          >
            {applyStatus === 'applying' ? (
              <>
                <Activity className="w-5 h-5 animate-spin" />
                Creating Panel...
              </>
            ) : applyStatus === 'success' ? (
              <>
                <Check className="w-5 h-5" />
                Panel Created Successfully!
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Create EV Panel
              </>
            )}
          </button>

          {/* Error Message */}
          {applyStatus === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-900 mb-1">Error Creating Panel</h4>
                  <p className="text-sm text-red-800">{errorMessage}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* NEC References */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-600">
        <p className="font-medium mb-2">NEC References:</p>
        <ul className="space-y-1">
          {/* #241: what each section does in this builder (CLAUDE.md, PE rulings
              #192/#194/#198/#225); there is no EVSE demand factor */}
          <li>• {necEdition === '2023'
            ? 'NEC 220.57 - EVSE load: the larger of 7,200 VA or the nameplate rating, at 100%'
            : 'NEC 220.14(A) - EVSE load at the nameplate rating, at 100%'}</li>
          <li>• NEC 625.41 - EV branch circuit overcurrent protection and conductors at 125% of the charger's rating</li>
          <li>• NEC 625.42 - EVEMS: the setpoint limits the load on the feeder and the service</li>
          <li>• NEC 215.2(A)(1) / 230.42(A)(1) - Feeder and service: the load + 25% of the continuous loads (EV charging)</li>
          <li>• NEC 408.30 - Panelboard rating: at least the feeder design load</li>
          <li>• NEC 210.19 - Conductors - Minimum Ampacity and Size</li>
          <li>• NEC 310.16 - Allowable Ampacities of Insulated Conductors</li>
        </ul>
      </div>
    </div>
  );
};
