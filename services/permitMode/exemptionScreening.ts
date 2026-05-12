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
 * The statute is written in 240 V terms. For 480 V / 208 V / 277 V services
 * the caller passes the nameplate ampacity + the actual service voltage; this
 * function normalizes internally before comparing to the 240 V thresholds.
 * Per CLAUDE.md "No implicit unit conversions" — the caller must supply
 * voltage so the function can convert explicitly.
 *
 * Per CLAUDE.md "Calculation Service Rules":
 *   - Pure function. No DB calls, no hooks, no side effects.
 *   - Never throws. Returns a result with `warnings[]` instead.
 *   - Result includes `necReferences[]` (here: the Florida statute citation,
 *     reused in the cover-sheet exemption stamp). NEC isn't applicable for
 *     this lane decision — the citation is FL-statutory — but we keep the
 *     field name to match the calc-service contract.
 *   - Fail-safe defaults: malformed inputs (NaN, negative, non-finite)
 *     resolve to `pe-required` with a WARNING, never silently to `exempt`.
 *     A compliance flag must lean toward over-requiring engineering review,
 *     not under-requiring it.
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
   * Service nameplate ampacity at the actual service voltage. The function
   * normalizes this to 240 V terms (per FS 471.003(2)(h)) before applying
   * thresholds. For a 480 V/800 A commercial service this is `800`, voltage
   * is `480`, normalized = 1600 A @ 240 V — exceeds the 800 A commercial
   * threshold → `pe-required`.
   */
  serviceCapacityAmps: number;

  /**
   * Service voltage in volts (e.g. 240 for typical residential, 208 for
   * 208Y/120 commercial, 480 for 480Y/277 commercial, 600 for 600Y/347
   * industrial). Used to normalize `serviceCapacityAmps` to FS 471.003(2)(h)'s
   * 240 V thresholds.
   */
  serviceVoltageV: number;

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
 * Coerce a numeric input to a fail-safe value. Returns the input if it's a
 * finite non-negative number; otherwise returns the sentinel passed in.
 * Used at the top of `screenContractorExemption` so that NaN / Infinity /
 * negative values produced by malformed user input flow to `pe-required`
 * (the safe direction for a compliance flag) instead of silently passing
 * through to `exempt`.
 */
function coerceNonNegativeFinite(value: number, sentinel: number): number {
  return Number.isFinite(value) && value >= 0 ? value : sentinel;
}

/**
 * Decide whether the project qualifies for the FL contractor exemption
 * (lane = 'exempt') or requires a PE seal (lane = 'pe-required').
 *
 * Order of evaluation (first match wins):
 *   1. AHJ override present                                  → pe-required
 *   2. Project value > $125,000                              → pe-required
 *   3. Residential AND service > 600 A @ 240 V (normalized)  → pe-required
 *   4. Commercial AND service > 800 A @ 240 V (normalized)   → pe-required
 *   5. Otherwise                                              → exempt
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

  // Defensive coercion: malformed inputs (NaN, negative, Infinity) fail-safe
  // to a sentinel that trips the threshold checks, producing `pe-required`
  // with a WARNING. A regulatory-compliance flag should lean toward over-
  // requiring engineering review, not under-requiring it.
  const rawValue = input.estimatedValueUsd;
  const safeValue = coerceNonNegativeFinite(rawValue, Number.POSITIVE_INFINITY);
  if (safeValue !== rawValue) {
    warnings.push(
      `WARNING: estimated project value is missing or invalid (received ${rawValue}); fail-safe to pe-required`,
    );
  }

  const rawAmps = input.serviceCapacityAmps;
  const rawVolts = input.serviceVoltageV;
  const safeAmps = coerceNonNegativeFinite(rawAmps, Number.POSITIVE_INFINITY);
  // Voltage must be strictly positive — a 0 V "service" is meaningless and
  // would produce a 0-amp normalized value (silently exempt). Use 240 as the
  // sentinel so malformed voltage still allows a sane normalization, but emit
  // a warning so the UI can prompt the user to set service voltage.
  const safeVolts =
    Number.isFinite(rawVolts) && rawVolts > 0 ? rawVolts : 240;
  if (safeAmps !== rawAmps) {
    warnings.push(
      `WARNING: service capacity is missing or invalid (received ${rawAmps} A); fail-safe to pe-required`,
    );
  }
  if (safeVolts !== rawVolts) {
    warnings.push(
      `WARNING: service voltage is missing or invalid (received ${rawVolts} V); defaulting to 240 V for threshold normalization`,
    );
  }

  // Normalize to FS 471.003(2)(h)'s 240 V terms. For a 240 V service this
  // is a no-op; for 480 V/800 A it yields 1600 A which trips the commercial
  // 800 A threshold (the bug H2 from the Sprint 2A PR 5 code review fixed).
  const serviceCapacity240VAmps = safeAmps * (safeVolts / 240);

  // 2. Project-value cap (applies to both occupancies).
  if (safeValue > FS_THRESHOLD_VALUE_USD) {
    const valueText = Number.isFinite(safeValue)
      ? `$${safeValue.toLocaleString('en-US')}`
      : '(unknown)';
    return {
      lane: 'pe-required',
      reason: `Project value (${valueText}) exceeds $${FS_THRESHOLD_VALUE_USD.toLocaleString('en-US')} ${FS_CITATION} threshold`,
      necReferences: [FS_CITATION],
      warnings,
    };
  }

  // 3. Residential service-capacity threshold.
  if (
    input.occupancyType === 'residential'
    && serviceCapacity240VAmps > FS_THRESHOLD_RESIDENTIAL_AMPS
  ) {
    const ampsText = Number.isFinite(serviceCapacity240VAmps)
      ? `${Math.round(serviceCapacity240VAmps)} A`
      : '(unknown)';
    return {
      lane: 'pe-required',
      reason: `Residential service capacity (${ampsText} @ 240 V equivalent, from ${safeAmps} A @ ${safeVolts} V) exceeds ${FS_THRESHOLD_RESIDENTIAL_AMPS} A ${FS_CITATION} residential threshold`,
      necReferences: [FS_CITATION],
      warnings,
    };
  }

  // 4. Commercial service-capacity threshold.
  if (
    input.occupancyType === 'commercial'
    && serviceCapacity240VAmps > FS_THRESHOLD_COMMERCIAL_AMPS
  ) {
    const ampsText = Number.isFinite(serviceCapacity240VAmps)
      ? `${Math.round(serviceCapacity240VAmps)} A`
      : '(unknown)';
    return {
      lane: 'pe-required',
      reason: `Commercial service capacity (${ampsText} @ 240 V equivalent, from ${safeAmps} A @ ${safeVolts} V) exceeds ${FS_THRESHOLD_COMMERCIAL_AMPS} A ${FS_CITATION} commercial threshold`,
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
