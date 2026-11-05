/**
 * #158: calculator results saved in `settings.residential` are caches.
 *
 * The Dwelling Load Calculator saves `multiFamilyLoadResult` and the
 * Multi-Family EV Calculator saves `mfEvCalculation`. After a calc rule
 * changes (e.g. #133 dropped the 65% heat factor) the saved copies keep the
 * old numbers until someone reopens the calculator. Readers call the helpers
 * here, which recompute from the saved inputs with the current rules. The
 * saved result is used as-is only when its inputs were never saved (an EV
 * analysis saved before 2026-10-24); `recomputed: false` tells the caller.
 *
 * The calculators build their own results through the same helpers, so a
 * recompute on read gives the number the calculator would show if reopened.
 */
import type { Database } from './database.types';
import type { DwellingUnitTemplate, Project, ResidentialAppliances } from '../types';
import { ExistingLoadDeterminationMethod } from '../types';
import { buildSingleFamilyDwellingContext } from './projectSettings';
import { buildMultiFamilyContext, calculateAggregatedLoad, calculateProposedNewLoadVA } from '../services/calculations/upstreamLoadAggregation';
import {
  calculateDwellingDemandSplit,
  calculateMultiFamilyLoad,
  type PanelDemandCircuit,
  type ResidentialLoadResult,
} from '../services/calculations/residentialLoad';
import {
  calculateMultiFamilyEV,
  type CommonAreaLoadItem,
  type MultiFamilyEVInput,
  type MultiFamilyEVResult,
} from '../services/calculations/multiFamilyEV';
import type { NecEdition } from '../data/nec/evse-load';

export const DEFAULT_APPLIANCES: ResidentialAppliances = {
  range: { enabled: false, kw: 12, type: 'electric' },
  dryer: { enabled: false, kw: 5.5, type: 'electric' },
  waterHeater: { enabled: false, kw: 4.5, type: 'electric' },
  hvac: { enabled: false, type: 'ac_only', coolingKw: 5, heatingKw: 0 },
  dishwasher: { enabled: false, kw: 1.5 },
  disposal: { enabled: false, kw: 0.5 },
  microwave: { enabled: false, kw: 1.5 },
  evCharger: { enabled: false, kw: 7.7, level: 2 },
  poolPump: { enabled: false, hp: 1.5 },
  poolHeater: { enabled: false, kw: 11 },
  hotTub: { enabled: false, kw: 6 },
  wellPump: { enabled: false, hp: 1 },
  otherAppliances: []
};

/** A Dwelling Load Calculator "proposed new load" row. */
export interface ProposedLoad {
  id: string;
  description: string;
  kw: number;
  voltage: 120 | 240;
  continuous: boolean;
  category?: 'EV' | 'HVAC' | 'Appliance' | 'Other';
  necReference?: string;
}

/**
 * Proposed loads enter the demand calc as "other fixed appliances", which
 * already honor voltage and continuous; they keep their proposed identity.
 */
export function appliancesWithProposed(
  appliances: ResidentialAppliances,
  proposedLoads: ProposedLoad[] = [],
): ResidentialAppliances {
  if (proposedLoads.length === 0) return appliances;
  const proposedAsOther = proposedLoads.map(p => ({
    description: p.description,
    kw: p.kw,
    voltage: p.voltage,
    continuous: p.continuous,
    proposed: true,
    category: p.category,
  }));
  return {
    ...appliances,
    otherAppliances: [...(appliances.otherAppliances ?? []), ...proposedAsOther],
  };
}

/**
 * The service panel's circuits plus the proposed loads not yet applied to it
 * (#184). "Generate Schedule" writes each proposed load as an is_proposed
 * circuit with its description; until then it counts as one here, with the
 * load type Generate gives it, so the result moves when a load is added and
 * nothing counts twice after Apply.
 */
export function circuitsWithPendingProposed<C extends PanelDemandCircuit>(
  circuits: C[],
  proposedLoads: ProposedLoad[] = [],
): PanelDemandCircuit[] {
  const applied = new Set(circuits.filter(c => c.is_proposed).map(c => c.description ?? ''));
  const pending = proposedLoads
    .filter(p => !applied.has(p.description))
    .map(p => ({
      description: p.description,
      load_watts: p.kw * 1000,
      load_type: p.category === 'HVAC' ? 'C' : 'O',
      is_proposed: true,
    }));
  return [...circuits, ...pending];
}

type PanelRow = Database['public']['Tables']['panels']['Row'];
type CircuitRow = Database['public']['Tables']['circuits']['Row'];
type TransformerRow = Database['public']['Tables']['transformers']['Row'];

/**
 * The service's existing and proposed demand, as E-102 prints it. The Permit
 * Packet Generator and the Service Upgrade Wizard both read it, so the
 * wizard's existing load is the packet's (#185).
 *
 * Single-family: the dwelling's own method (#121, #178). Everything else: the
 * NEC 220 aggregate of the MDP tree, whose existing demand is the same walk
 * run on the existing circuits only (#127) — commercial, industrial, and
 * multifamily with its 220.84 / two-unit context.
 */
export function projectDemandSplit(
  project: Project,
  panels: PanelRow[],
  circuits: CircuitRow[],
  transformers: TransformerRow[],
  necEdition: NecEdition,
): { existingKVA: number; proposedKVA: number; necReferences: string[] } {
  const mdp = panels.find(p => p.is_main);
  if (!mdp) return { existingKVA: 0, proposedKVA: 0, necReferences: [] };
  const mfCtx = buildMultiFamilyContext(
    mdp,
    panels,
    circuits,
    transformers,
    project.settings,
    necEdition,
  );
  // Single-family dwellings: E-101 runs the NEC 220.82 / 220.83 Optional
  // Method, so E-102 must too — the Part III cascade below gave a different
  // total and could fail a service E-101 showed as adequate (#121).
  const sfCtx = buildSingleFamilyDwellingContext(project, !!mfCtx);
  if (sfCtx) {
    const split = calculateDwellingDemandSplit({
      // Same circuit set as E-101 (LoadCalculationSummary): MDP circuits.
      circuits: circuits
        .filter(c => c.panel_id === mdp.id)
        .map(c => ({
          description: c.description,
          load_watts: c.load_watts,
          load_type: c.load_type,
          breaker_amps: c.breaker_amps,
          is_proposed: c.is_proposed,
        })),
      voltage: mdp.voltage || 240,
      necEdition,
      ...sfCtx,
    });
    return {
      existingKVA: split.existingDemandVA / 1000,
      proposedKVA: split.proposedDemandVA / 1000,
      necReferences: split.necReferences,
    };
  }
  // Match the orchestrator's occupancyType derivation
  // (services/pdfExport/permitPacketGenerator.tsx:1116) so the demand
  // factor cascade picks the same branch.
  const occupancyType: 'dwelling' | 'commercial' | 'industrial' =
    project.type === 'Residential'
      ? 'dwelling'
      : project.type === 'Industrial'
        ? 'industrial'
        : 'commercial';
  const agg = calculateAggregatedLoad(
    mdp.id,
    panels,
    circuits,
    transformers,
    occupancyType,
    mfCtx,
    necEdition,
  );
  return {
    existingKVA: agg.existingDemandVA / 1000,
    proposedKVA: agg.proposedDemandVA / 1000,
    // Union with the per-row references: the top-level list omits some
    // applied sections (e.g. 220.14 "Other", 220.51 water heater).
    necReferences: [...agg.necReferences, ...agg.demandBreakdown.map(r => r.necReference)],
  };
}

/**
 * The Service Upgrade Wizard's existing load from the panel schedule: E-102's
 * existing demand in service amps (√3 on a 3-phase service, as E-102 converts
 * it). Null without an MDP or circuits — the wizard then keeps manual entry.
 */
export function scheduleExistingLoadAmps(
  project: Project,
  panels: PanelRow[],
  circuits: CircuitRow[],
  transformers: TransformerRow[],
  necEdition: NecEdition,
): number | null {
  if (!panels.some(p => p.is_main) || circuits.length === 0) return null;
  const { existingKVA } = projectDemandSplit(project, panels, circuits, transformers, necEdition);
  return serviceAmps(project, existingKVA);
}

/**
 * The Service Upgrade Wizard's new load from the proposed circuits: E-102's
 * new load for the 220.87 method, in service amps (#188). Calculated → the
 * demand increase (`projectDemandSplit.proposedKVA`, PE ruling 2026-11-04);
 * measured / manual → `calculateProposedNewLoadVA` (EVSE at 125%, EVEMS
 * setpoint where set). Null without an MDP or proposed circuits.
 */
export function scheduleNewLoadAmps(
  project: Project,
  panels: PanelRow[],
  circuits: CircuitRow[],
  transformers: TransformerRow[],
  necEdition: NecEdition,
  existingLoadMethod: ExistingLoadDeterminationMethod,
): number | null {
  if (!panels.some(p => p.is_main) || !circuits.some(c => c.is_proposed)) return null;
  const newLoadKVA = existingLoadMethod === ExistingLoadDeterminationMethod.CALCULATED
    ? projectDemandSplit(project, panels, circuits, transformers, necEdition).proposedKVA
    : calculateProposedNewLoadVA(circuits, necEdition) / 1000;
  return serviceAmps(project, newLoadKVA);
}

/** kVA → service amps, as E-102 converts it: ÷ V√3 on a 3-phase service, ÷ V on 1-phase. */
function serviceAmps(project: Project, kVA: number): number {
  const voltage = project.serviceVoltage || 240;
  return Math.round((kVA * 1000) / (project.servicePhase === 3 ? voltage * Math.sqrt(3) : voltage));
}

/** `settings.residential.multiFamilyLoadResult`. */
export interface StoredMultiFamilyLoad {
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
}

export function toStoredMultiFamilyLoad(
  loadResult: ResidentialLoadResult,
  unitTemplates: DwellingUnitTemplate[],
  appliances: ResidentialAppliances,
  housePanelLoad: number,
): StoredMultiFamilyLoad {
  const totalUnits = unitTemplates.reduce((sum, t) => sum + t.unitCount, 0);
  const avgSqFt = totalUnits > 0
    ? Math.round(unitTemplates.reduce((sum, t) => sum + t.squareFootage * t.unitCount, 0) / totalUnits)
    : 1000;
  return {
    totalDemandVA: loadResult.totalDemandVA,
    totalConnectedVA: loadResult.totalConnectedVA,
    demandFactor: loadResult.demandFactor,
    serviceAmps: loadResult.serviceAmps,
    recommendedServiceSize: loadResult.recommendedServiceSize,
    breakdown: loadResult.breakdown,
    dwellingUnits: totalUnits,
    avgUnitSqFt: avgSqFt,
    commonAreaLoadVA: housePanelLoad,
    hasElectricCooking: appliances.range?.enabled === true && appliances.range.type === 'electric',
    hasElectricHeat: appliances.hvac?.enabled === true &&
      (appliances.hvac.type === 'heat_pump' || appliances.hvac.type === 'electric_heat'),
  };
}

/** The multifamily NEC 220.84 load, as the Dwelling Load Calculator computes it. */
export function calculateMultiFamilyLoadForProject(
  unitTemplates: DwellingUnitTemplate[],
  appliances: ResidentialAppliances,
  proposedLoads: ProposedLoad[] | undefined,
  housePanelLoad: number,
  necEdition: NecEdition | undefined,
): ResidentialLoadResult {
  const forCalc = appliancesWithProposed(appliances, proposedLoads);
  return calculateMultiFamilyLoad({
    unitTemplates: unitTemplates.map(t => ({ ...t, appliances: forCalc })),
    housePanelLoad,
    necEdition,
  });
}

interface ResidentialCache {
  dwellingType?: string;
  appliances?: ResidentialAppliances;
  unitTemplates?: DwellingUnitTemplate[];
  proposedLoads?: ProposedLoad[];
  multiFamilyLoadResult?: StoredMultiFamilyLoad;
  mfEvCalculation?: StoredMfEvCalculation;
}

/**
 * `multiFamilyLoadResult` under the current rules. Recomputed from the saved
 * unit templates and appliances whenever a result was saved (the calculator
 * saves both together); null when the calculator never ran.
 */
export function multiFamilyLoadFromSettings(
  residential: unknown,
  necEdition: NecEdition | undefined,
): StoredMultiFamilyLoad | null {
  const r = residential as ResidentialCache | undefined;
  const stored = r?.multiFamilyLoadResult ?? null;
  if (!stored || r?.dwellingType !== 'multi_family' || !r.unitTemplates?.length) return stored;
  try {
    const appliances = r.appliances ?? DEFAULT_APPLIANCES;
    const housePanelLoad = stored.commonAreaLoadVA ?? 0;
    const result = calculateMultiFamilyLoadForProject(r.unitTemplates, appliances, r.proposedLoads, housePanelLoad, necEdition);
    return toStoredMultiFamilyLoad(result, r.unitTemplates, appliances, housePanelLoad);
  } catch {
    return stored;
  }
}

/** Every Multi-Family EV Calculator input, saved with its result. */
export interface MfEvSavedInputs {
  buildingName?: string;
  dwellingUnits: number;
  avgUnitSqFt: number;
  voltage: MultiFamilyEVInput['voltage'];
  phase: MultiFamilyEVInput['phase'];
  existingServiceAmps: number;
  evChargerCount: number;
  evChargerLevel: 'Level1' | 'Level2';
  evAmpsPerCharger: number;
  hasElectricHeat: boolean;
  hasElectricCooking: boolean;
  commonAreaLoadVA: number;
  useItemizedCommonArea: boolean;
  commonAreaItems: CommonAreaLoadItem[];
  hasTransformer: boolean;
  transformerKVA: number;
  useEVEMS: boolean;
  capacityReserveVA: number;
  existingLoadMethod: 'calculated' | 'utility_bill' | 'load_study';
  measuredPeakDemandKW: number;
  measurementPeriod: string;
  utilityCompany: string;
}

/** JSON with sorted keys: Postgres jsonb does not keep key order. */
function stableJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableJson).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).filter(k => (v as Record<string, unknown>)[k] !== undefined).sort()
      .map(k => `${JSON.stringify(k)}:${stableJson((v as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

/** Whether saved inputs match, ignoring key order. */
export function sameMfEvInputs(a: MfEvSavedInputs | undefined, b: MfEvSavedInputs | undefined): boolean {
  return stableJson(a) === stableJson(b);
}

/** `settings.residential.mfEvCalculation`. `inputs` is absent on results saved before #158. */
export interface StoredMfEvCalculation {
  result: MultiFamilyEVResult;
  buildingName?: string;
  computedAt?: string;
  inputs?: MfEvSavedInputs;
}

/**
 * The calculator's input. In the calculated method with a 220.84 load, the
 * building profile comes from that load (the calculator hides those fields);
 * otherwise from what the user entered.
 */
export function buildMfEvInput(
  s: MfEvSavedInputs,
  mfLoad: StoredMultiFamilyLoad | null | undefined,
  necEdition: NecEdition,
): MultiFamilyEVInput {
  const calculated = s.existingLoadMethod === 'calculated';
  const measured = !calculated;
  const profile = calculated && mfLoad ? mfLoad : null;
  return {
    buildingName: s.buildingName || undefined,
    dwellingUnits: profile?.dwellingUnits ?? s.dwellingUnits,
    avgUnitSqFt: profile?.avgUnitSqFt ?? s.avgUnitSqFt,
    voltage: s.voltage,
    phase: s.phase,
    existingServiceAmps: s.existingServiceAmps,
    evChargers: {
      count: s.evChargerCount,
      level: s.evChargerLevel,
      ampsPerCharger: s.evAmpsPerCharger,
    },
    hasElectricHeat: profile?.hasElectricHeat ?? s.hasElectricHeat,
    hasElectricCooking: profile?.hasElectricCooking ?? s.hasElectricCooking,
    // Use itemized loads if enabled and has items, otherwise use simple VA
    commonAreaLoadVA: s.useItemizedCommonArea ? 0 : (profile?.commonAreaLoadVA ?? s.commonAreaLoadVA),
    commonAreaLoads: s.useItemizedCommonArea && s.commonAreaItems.length > 0 ? s.commonAreaItems : undefined,
    transformer: s.hasTransformer ? { kvaRating: s.transformerKVA } : undefined,
    useEVEMS: s.useEVEMS,
    necEdition,
    capacityReserveVA: s.capacityReserveVA > 0 ? s.capacityReserveVA : undefined,
    // NEC 220.87 - Existing Load Determination Method
    existingLoadMethod: s.existingLoadMethod,
    measuredPeakDemandKW: measured && s.measuredPeakDemandKW > 0 ? s.measuredPeakDemandKW : undefined,
    measurementPeriod: measured && s.measurementPeriod ? s.measurementPeriod : undefined,
    utilityCompany: measured && s.utilityCompany ? s.utilityCompany : undefined,
    preCalculatedBuildingLoad: profile
      ? {
          totalDemandVA: profile.totalDemandVA,
          totalConnectedVA: profile.totalConnectedVA,
          demandFactor: profile.demandFactor,
          serviceAmps: profile.serviceAmps,
          breakdown: profile.breakdown,
        }
      : undefined,
  };
}

/**
 * The saved Multi-Family EV analysis under the current rules. `recomputed:
 * false` means the result predates saved inputs and prints as saved; reopening
 * the calculator saves its inputs.
 */
export function mfEvCalculationFromSettings(
  residential: unknown,
  necEdition: NecEdition,
): { result: MultiFamilyEVResult; buildingName?: string; recomputed: boolean } | null {
  const calc = (residential as ResidentialCache | undefined)?.mfEvCalculation;
  if (!calc?.result) return null;
  if (!calc.inputs) return { result: calc.result, buildingName: calc.buildingName, recomputed: false };
  try {
    const mfLoad = multiFamilyLoadFromSettings(residential, necEdition);
    return {
      result: calculateMultiFamilyEV(buildMfEvInput(calc.inputs, mfLoad, necEdition)),
      buildingName: calc.buildingName,
      recomputed: true,
    };
  } catch {
    return { result: calc.result, buildingName: calc.buildingName, recomputed: false };
  }
}
