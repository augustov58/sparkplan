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
import { buildSingleFamilyDwellingContext, dwellingAggregateOptions } from './projectSettings';
import { feederDesignLoadVA } from '../services/feeder/feederLoadSync';
import { buildMultiFamilyContext, calculateAggregatedLoad, calculateProposedNewLoadVA, circuitsUnderPanel, continuousServiceAdderVA } from '../services/calculations/upstreamLoadAggregation';
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
import {
  calculateDownstreamFaultCurrent,
  calculateServiceFaultCurrent,
  estimateUtilityTransformer,
  type ShortCircuitResult,
} from '../services/calculations/shortCircuit';

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
 *
 * `existingAdderKVA` / `proposedAdderKVA`: 25% of the continuous loads (EVSE,
 * signs, show windows) that the calculated-method service check adds to the
 * Article 220 load per 230.42(A)(1) (PE ruling 2026-11-07, #192). Kept apart
 * so E-101 keeps printing the load at 100%.
 */
export interface ProjectDemandSplit {
  existingKVA: number;
  proposedKVA: number;
  existingAdderKVA: number;
  proposedAdderKVA: number;
  necReferences: string[];
}

export const EMPTY_DEMAND_SPLIT: ProjectDemandSplit = {
  existingKVA: 0, proposedKVA: 0, existingAdderKVA: 0, proposedAdderKVA: 0, necReferences: [],
};

export function projectDemandSplit(
  project: Project,
  panels: PanelRow[],
  circuits: CircuitRow[],
  transformers: TransformerRow[],
  necEdition: NecEdition,
): ProjectDemandSplit {
  const mdp = panels.find(p => p.is_main);
  if (!mdp) return EMPTY_DEMAND_SPLIT;
  const adder = continuousServiceAdderVA(mdp.id, panels, circuits, transformers, necEdition);
  const existingAdderKVA = adder.existingVA / 1000;
  const proposedAdderKVA = adder.proposedVA / 1000;
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
      // Same circuit set as E-101 (LoadCalculationSummary): every circuit
      // under the MDP — a subpanel's loads are the dwelling's (#216).
      circuits: circuitsUnderPanel(mdp.id, panels, circuits, transformers)
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
      existingAdderKVA,
      proposedAdderKVA,
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
    existingAdderKVA,
    proposedAdderKVA,
    // Union with the per-row references: the top-level list omits some
    // applied sections (e.g. 220.14 "Other", 220.51 water heater).
    necReferences: [...agg.necReferences, ...agg.demandBreakdown.map(r => r.necReference)],
  };
}

/**
 * The Service Upgrade Wizard's existing load from the panel schedule: E-102's
 * existing demand plus 25% of the existing continuous loads (230.42(A)(1),
 * #192), in service amps (√3 on a 3-phase service, as E-102 converts it).
 * Null without an MDP or circuits — the wizard then keeps manual entry.
 */
export function scheduleExistingLoadAmps(
  project: Project,
  panels: PanelRow[],
  circuits: CircuitRow[],
  transformers: TransformerRow[],
  necEdition: NecEdition,
): number | null {
  if (!panels.some(p => p.is_main) || circuits.length === 0) return null;
  const { existingKVA, existingAdderKVA } = projectDemandSplit(project, panels, circuits, transformers, necEdition);
  return serviceAmps(project, existingKVA + existingAdderKVA);
}

/**
 * The Service Upgrade Wizard's new load from the proposed circuits: E-102's
 * new load for the 220.87 method, in service amps (#188). Calculated → the
 * demand increase (`projectDemandSplit.proposedKVA`, PE ruling 2026-11-04)
 * plus 25% of the new continuous loads (230.42(A)(1), #192); measured /
 * manual → `calculateProposedNewLoadVA` (continuous loads at 125%, EVEMS
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
  const split = existingLoadMethod === ExistingLoadDeterminationMethod.CALCULATED
    ? projectDemandSplit(project, panels, circuits, transformers, necEdition)
    : null;
  const newLoadKVA = split
    ? split.proposedKVA + split.proposedAdderKVA
    : calculateProposedNewLoadVA(circuits, necEdition) / 1000;
  return serviceAmps(project, newLoadKVA);
}

/** kVA → service amps, as E-102 converts it: ÷ V√3 on a 3-phase service, ÷ V on 1-phase. */
function serviceAmps(project: Project, kVA: number): number {
  const voltage = project.serviceVoltage || 240;
  return Math.round((kVA * 1000) / (project.servicePhase === 3 ? voltage * Math.sqrt(3) : voltage));
}

/**
 * "Is the service sufficient?" from the panel schedule (#193): the Article
 * 220 load (`projectDemandSplit`, E-101) plus 25% of the continuous loads
 * (230.42(A)(1), PE ruling 2026-11-07, #192), in service amps, against the
 * service rating — the check E-102 makes on the calculated method and the
 * Service Upgrade Wizard prints. Inspector Mode, the Copilot and the EV Panel
 * Builder read it rather than a rule of their own.
 */
export interface ScheduleServiceCheck {
  /** Article 220 load, kVA (existing + proposed). */
  loadKVA: number;
  /** 25% of the continuous loads, kVA. */
  adderKVA: number;
  /** (load + adder) in service amps, unrounded (÷ V√3 on a 3-phase service). */
  checkAmps: number;
  /** The rating compared against: `project.serviceAmps`, else the MDP main breaker (as the packet). */
  serviceAmps: number;
  utilizationPct: number;
  sufficient: boolean;
}

/** Null without an MDP or circuits. */
export function scheduleServiceCheck(
  project: Project,
  panels: PanelRow[],
  circuits: CircuitRow[],
  transformers: TransformerRow[],
  necEdition: NecEdition,
): ScheduleServiceCheck | null {
  const mdp = panels.find(p => p.is_main);
  if (!mdp || circuits.length === 0) return null;
  const split = projectDemandSplit(project, panels, circuits, transformers, necEdition);
  const loadKVA = split.existingKVA + split.proposedKVA;
  const adderKVA = split.existingAdderKVA + split.proposedAdderKVA;
  const voltage = project.serviceVoltage || mdp.voltage || 240;
  const threePhase = (project.servicePhase ?? mdp.phase) === 3;
  const checkAmps = ((loadKVA + adderKVA) * 1000) / (threePhase ? voltage * Math.sqrt(3) : voltage);
  const rating = project.serviceAmps || mdp.main_breaker_amps || mdp.bus_rating || 0;
  return {
    loadKVA,
    adderKVA,
    checkAmps,
    serviceAmps: rating,
    utilizationPct: rating > 0 ? (checkAmps / rating) * 100 : 0,
    sufficient: rating > 0 && checkAmps <= rating,
  };
}

/**
 * Each panel's design load in amps, for the NEC 408.30 bus check (#225): a
 * panelboard is rated not less than the minimum feeder capacity for its
 * Article 220 load — the Feeder Manager's design load (demand + 25% of the
 * continuous loads, `feederDesignLoadVA`, #190) in the panel's own phase.
 * The MDP's is the service check (#193). Inspector Mode and the Copilot read it.
 */
export function panelDesignAmps(
  project: Project,
  panels: PanelRow[],
  circuits: CircuitRow[],
  transformers: TransformerRow[],
  necEdition: NecEdition,
): Record<string, number> {
  const design = {
    transformers,
    occupancy: project.settings?.occupancyType ?? 'commercial',
    necEdition,
    dwelling: dwellingAggregateOptions(project),
  };
  const service = scheduleServiceCheck(project, panels, circuits, transformers, necEdition);
  const amps: Record<string, number> = {};
  for (const panel of panels) {
    if (panel.is_main) {
      if (service) amps[panel.id] = service.checkAmps;
      continue;
    }
    const divisor = (panel.voltage || 240) * (panel.phase === 3 ? Math.sqrt(3) : 1);
    amps[panel.id] = feederDesignLoadVA(panel.id, panels, circuits, design) / divisor;
  }
  return amps;
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
export function stableJson(v: unknown): string {
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

// ---------------------------------------------------------------------------
// #278: saved short-circuit results
// ---------------------------------------------------------------------------
//
// A saved short-circuit row keeps its `results` from the formula of the day it
// was saved (#258, #276 and #279 changed it since). Readers recompute it from
// the row's saved inputs through the calculator's own functions (owner ruling
// 2026-11-21). A row that can't be recomputed exactly — a service conductor
// saved before the number of sets in parallel was recorded — keeps its stored
// values and is flagged `outdated`; it is never recomputed with a guessed 1 set.
// `useShortCircuitCalculations` applies this to every row it returns, so the
// packet, the Short Circuit page, the Copilot and Pre-Inspection all read it.

type ShortCircuitRow = Database['public']['Tables']['short_circuit_calculations']['Row'];

/** What `results` holds after `recomputeShortCircuitRow`. */
export interface StoredShortCircuitResults extends Partial<ShortCircuitResult> {
  /** Conductor sets in parallel the calculation was saved with (recorded since #278). */
  setsInParallel?: number;
  /** Why the row couldn't be recomputed; its stored values are shown, flagged. */
  outdated?: string;
}

export const SHORT_CIRCUIT_OUTDATED = 'Outdated, re-run';

const CONDUIT_TYPES = ['Steel', 'PVC', 'Aluminum'] as const;
const MATERIALS = ['Cu', 'Al'] as const;

/** The saved results of a row, with `outdated` set when it couldn't be recomputed. */
export function shortCircuitResultsOf(row: Pick<ShortCircuitRow, 'results'>): StoredShortCircuitResults {
  return ((row.results ?? {}) as unknown) as StoredShortCircuitResults;
}

/**
 * A saved row's conductor as printed everywhere ("2 × 500 kcmil Cu"), with its
 * sets in parallel when more than one (#289): the sets change the result, so a
 * reviewer needs them to reproduce it. Null when the row has no conductor.
 */
export function shortCircuitConductorText(
  row: Pick<ShortCircuitRow, 'calculation_type' | 'service_conductor_size' | 'service_conductor_material' | 'feeder_conductor_size' | 'feeder_material' | 'results'>,
): string | null {
  const service = row.calculation_type === 'service';
  const size = service ? row.service_conductor_size : row.feeder_conductor_size;
  if (!size) return null;
  const material = (service ? row.service_conductor_material : row.feeder_material) ?? '';
  const sets = shortCircuitResultsOf(row).setsInParallel ?? 1;
  return `${sets > 1 ? `${sets} × ` : ''}${size} ${material}`.trim();
}

/** "Stale, re-run": a panel row whose saved source differs from the current upstream (#289). */
export const SHORT_CIRCUIT_STALE = 'Stale, re-run';

/** A project's service-entrance row (the service itself, not a panel's transformer secondary). */
const isServiceEntranceRow = (row: Pick<ShortCircuitRow, 'calculation_type' | 'panel_id'>) =>
  row.calculation_type === 'service' && !row.panel_id;

/**
 * #285 (owner ruling 2026-11-22, a): one service short-circuit calculation per
 * project. The rows every reader sees: all panel rows and only the newest
 * service-entrance row, so the Short Circuit page, E-102 and the packet's
 * short-circuit table show the same set. Older service rows (saved before a
 * save replaced them) stay in the table but are no longer read.
 */
export function currentShortCircuitRows<T extends Pick<ShortCircuitRow, 'calculation_type' | 'panel_id' | 'created_at'>>(rows: T[]): T[] {
  const newestService = rows
    .filter(isServiceEntranceRow)
    .reduce<T | undefined>((newest, r) => (!newest || r.created_at > newest.created_at ? r : newest), undefined);
  return rows.filter(r => !isServiceEntranceRow(r) || r === newestService);
}

export function recomputeShortCircuitRow(row: ShortCircuitRow): ShortCircuitRow {
  const stored = shortCircuitResultsOf(row);
  const sets = Number.isInteger(stored.setsInParallel) && (stored.setsInParallel ?? 0) >= 1
    ? stored.setsInParallel
    : undefined;
  const outdated = (reason: string): ShortCircuitRow =>
    ({ ...row, results: { ...stored, outdated: reason } as unknown as ShortCircuitRow['results'] });
  const recomputed = (r: ShortCircuitResult): ShortCircuitRow =>
    ({ ...row, results: { ...r, ...(sets ? { setsInParallel: sets } : {}) } as unknown as ShortCircuitRow['results'] });

  if (row.calculation_type === 'service') {
    const voltage = row.service_voltage;
    const phase = row.service_phase;
    const impedance = row.transformer_impedance;
    if (!voltage || (phase !== 1 && phase !== 3) || !impedance || (!row.transformer_kva && !row.service_amps)) {
      return outdated('Saved without its service inputs');
    }
    const transformer = row.transformer_kva
      ? { kva: row.transformer_kva, primaryVoltage: phase === 3 ? 12470 : 7200, secondaryVoltage: voltage, impedance }
      : estimateUtilityTransformer(row.service_amps as number, voltage, phase, impedance);
    if (row.service_conductor_length == null) {
      return recomputed(calculateServiceFaultCurrent(transformer, voltage, phase));
    }
    const material = MATERIALS.find((m) => m === row.service_conductor_material);
    const conduitType = CONDUIT_TYPES.find((c) => c === row.service_conduit_type);
    if (!row.service_conductor_size || !material || !conduitType) {
      return outdated('Saved without its service conductor');
    }
    if (!sets) {
      return outdated('Saved before the number of conductor sets in parallel was recorded');
    }
    return recomputed(calculateServiceFaultCurrent(transformer, voltage, phase, {
      length: row.service_conductor_length,
      conductorSize: row.service_conductor_size,
      material,
      conduitType,
      setsInParallel: sets,
    }));
  }

  if (row.calculation_type === 'panel') {
    const material = MATERIALS.find((m) => m === row.feeder_material);
    const conduitType = CONDUIT_TYPES.find((c) => c === row.feeder_conduit_type);
    const phase = row.feeder_phase;
    if (
      !row.source_fault_current || row.feeder_length == null || !row.feeder_conductor_size ||
      !material || !conduitType || !row.feeder_voltage || (phase !== 1 && phase !== 3)
    ) {
      return outdated('Saved without its feeder inputs');
    }
    // Since #286 the feeder's sets in parallel change the result; a panel row
    // saved before they were recorded can't be recomputed exactly.
    if (!sets) {
      return outdated('Saved before the number of conductor sets in parallel was recorded');
    }
    return recomputed(calculateDownstreamFaultCurrent(
      {
        length: row.feeder_length,
        conductorSize: row.feeder_conductor_size,
        material,
        conduitType,
        voltage: row.feeder_voltage,
        phase,
        setsInParallel: sets,
      },
      row.source_fault_current,
    ));
  }

  return outdated(`Unknown calculation type "${row.calculation_type}"`);
}
