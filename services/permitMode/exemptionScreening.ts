/**
 * FL Contractor Exemption Screening (Sprint 2A PR 5 / H17)
 *
 * Pure function. Given the project scope, occupancy, and service-capacity
 * inputs the user has filled in on Project Setup, decide which permit-packet
 * lane the project belongs to:
 *
 *  - 'exempt'      → contractor signs under FS 471.003(2)(h) "Contractor
 *                    exception" — no PE seal required for the design submittal.
 *  - 'pe-required' → project exceeds at least one statutory threshold (or the
 *                    AHJ has overridden the default lane for this jurisdiction)
 *                    and a Florida-licensed PE must seal the plans before
 *                    submittal.
 *
 * FS 471.003(2)(h) thresholds (Florida statute, 2024 ed.):
 *
 *   Residential: service ≤ 600 A @ 240 V
 *   Commercial:  service ≤ 800 A @ 240 V
 *   Project value: ≤ $125,000 (regardless of occupancy)
 *
 * Per CLAUDE.md "Calculation Service Rules":
 *   - Pure function. No DB calls, no hooks, no side effects.
 *   - Never throws. Returns a result with `warnings[]` instead.
 *   - Result includes `necReferences[]` (here: the Florida statute citation,
 *     reused in the cover-sheet exemption stamp). NEC isn't applicable for
 *     this lane decision — the citation is FL-statutory — but we keep the
 *     field name to match the calc-service contract.
 *
 * Audit-fixture interpretation:
 *   A 12-unit multifamily building with a 1,000 A @ 240 V service IS a
 *   residential occupancy (NEC + FBC classify dwellings as residential),
 *   and 1,000 A > 600 A residential threshold, so the function returns
 *   'pe-required'. This is intentional — Florida draws the contractor-
 *   exemption line at 600 A residential regardless of unit count.
 *
 * AHJ overrides (Sprint 2C):
 *   When `ahjOverride` is supplied (populated by the per-AHJ manifest in
 *   Sprint 2C), we force `pe-required` and surface the AHJ's stated reason
 *   on both the result object and the cover-sheet language. AHJ override
 *   wins regardless of the FS 471.003(2)(h) thresholds — local jurisdictions
 *   can be stricter than the state floor.
 */

export interface ExemptionScreeningInput {
  /** Project value in USD (FS 471.003(2)(h) cap: $125,000). */
  estimatedValueUsd: number;

  /** Occupancy classification — drives the residential vs commercial threshold. */
  occupancyType: 'residential' | 'commercial';

  /**
   * Service ampacity at 240 V (per FS 471.003(2)(h) which is written in
   * 240 V terms). For 480 V services convert ampacity to its 240 V
   * equivalent before passing in (caller's responsibility).
   */
  serviceCapacity_240V_amps: number;

  /** Scope flags from Project Setup — used for context + future Sprint 2C rules. */
  scopeFlags: {
    service_upgrade: boolean;
    ct_cabinet: boolean;
    meter_stack: boolean;
    switchgear: boolean;
    multi_tenant_feeder: boolean;
    evems_used: boolean;
  };

  /**
   * Sprint 2C AHJ override: when present, force `pe-required` regardless
   * of the statutory thresholds. The `reason` string is surfaced verbatim
   * on the cover sheet and on the result.
   */
  ahjOverride?: { reason: string };
}

export interface ExemptionScreeningResult {
  /** Which packet-generation lane the project belongs to. */
  lane: 'exempt' | 'pe-required';

  /** Human-readable explanation suitable for display in the UI / cover sheet. */
  reason: string;

  /** Populated only when an AHJ override flipped the lane. */
  ahjOverride?: string;

  /**
   * Citations used to reach this lane decision. For the FS 471.003(2)(h)
   * thresholds the array contains `'FS 471.003(2)(h)'`; AHJ overrides add
   * the AHJ-supplied citation. Naming kept as `necReferences` to match the
   * calc-service contract from CLAUDE.md.
   */
  necReferences: string[];

  /** Soft warnings (INFO/WARNING/CRITICAL severity, never blocking). */
  warnings: string[];
}

const FS_THRESHOLD_VALUE_USD = 125_000;
const FS_THRESHOLD_RESIDENTIAL_AMPS = 600;
const FS_THRESHOLD_COMMERCIAL_AMPS = 800;
const FS_CITATION = 'FS 471.003(2)(h)';

/**
 * Decide whether the project qualifies for the FL contractor exemption
 * (lane = 'exempt') or requires a PE seal (lane = 'pe-required').
 *
 * Order of evaluation (first match wins):
 *   1. AHJ override present                              → pe-required
 *   2. Project value > $125,000                          → pe-required
 *   3. Residential AND service > 600 A @ 240 V           → pe-required
 *   4. Commercial AND service > 800 A @ 240 V            → pe-required
 *   5. Otherwise                                          → exempt
 */
export function screenContractorExemption(
  input: ExemptionScreeningInput,
): ExemptionScreeningResult {
  const warnings: string[] = [];

  // 1. AHJ override always wins — local jurisdictions can be stricter than
  //    the FS 471.003(2)(h) statutory floor (Sprint 2C plumbs this in).
  if (input.ahjOverride) {
    return {
      lane: 'pe-required',
      reason: `AHJ override: ${input.ahjOverride.reason}`,
      ahjOverride: input.ahjOverride.reason,
      necReferences: [FS_CITATION, 'AHJ override'],
      warnings,
    };
  }

  // 2. Project-value cap (applies to both occupancies).
  if (input.estimatedValueUsd > FS_THRESHOLD_VALUE_USD) {
    return {
      lane: 'pe-required',
      reason: `Project value ($${input.estimatedValueUsd.toLocaleString('en-US')}) exceeds $${FS_THRESHOLD_VALUE_USD.toLocaleString('en-US')} ${FS_CITATION} threshold`,
      necReferences: [FS_CITATION],
      warnings,
    };
  }

  // 3. Residential service-capacity threshold.
  if (
    input.occupancyType === 'residential'
    && input.serviceCapacity_240V_amps > FS_THRESHOLD_RESIDENTIAL_AMPS
  ) {
    return {
      lane: 'pe-required',
      reason: `Residential service capacity (${input.serviceCapacity_240V_amps} A @ 240 V) exceeds ${FS_THRESHOLD_RESIDENTIAL_AMPS} A ${FS_CITATION} residential threshold`,
      necReferences: [FS_CITATION],
      warnings,
    };
  }

  // 4. Commercial service-capacity threshold.
  if (
    input.occupancyType === 'commercial'
    && input.serviceCapacity_240V_amps > FS_THRESHOLD_COMMERCIAL_AMPS
  ) {
    return {
      lane: 'pe-required',
      reason: `Commercial service capacity (${input.serviceCapacity_240V_amps} A @ 240 V) exceeds ${FS_THRESHOLD_COMMERCIAL_AMPS} A ${FS_CITATION} commercial threshold`,
      necReferences: [FS_CITATION],
      warnings,
    };
  }

  // 5. Within all thresholds → contractor exemption applies.
  return {
    lane: 'exempt',
    reason: `Within ${FS_CITATION} contractor-exemption thresholds (≤ $${FS_THRESHOLD_VALUE_USD.toLocaleString('en-US')}, ≤ ${
      input.occupancyType === 'residential'
        ? FS_THRESHOLD_RESIDENTIAL_AMPS
        : FS_THRESHOLD_COMMERCIAL_AMPS
    } A @ 240 V ${input.occupancyType})`,
    necReferences: [FS_CITATION],
    warnings,
  };
}
