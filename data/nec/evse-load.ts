/**
 * EVSE Load for Article 220 Load Calculations — NEC-edition aware
 *
 * The per-EVSE load rule differs by edition:
 *
 * - NEC 2023 §220.57(A): "The EVSE load shall be calculated at either
 *   7200 watts (volt-amperes) or the nameplate rating of the equipment,
 *   whichever is larger." A floor, NOT a demand factor.
 *
 * - NEC 2020: §220.57 does not exist (pre-2023 Article 220 Part III ends at
 *   §220.56). The EVSE is a specific appliance load taken at its nameplate
 *   rating per §220.14(A). No 7,200 VA floor.
 *
 * In BOTH editions the load-calc value is 100% of the governing figure. The
 * 125% continuous-duty factor of §625.41 (with §215.2(A)(1) / §230.42(A)(1))
 * applies to OCPD and conductor sizing, not to the Article 220 load total —
 * adding it here would double-count. PE-confirmed 2026-09-27.
 *
 * Florida enforces NEC 2020 via FBC 8th Edition (2023), so every Florida AHJ
 * manifest in data/ahj/ resolves to the 2020 branch.
 */

export type NecEdition = '2020' | '2023';

/** NEC 2023 §220.57(A) minimum per-EVSE load */
export const NEC_2023_220_57_MINIMUM_VA = 7200;

export interface EvseLoadResult {
  /** Per-EVSE load used in the Article 220 calculation (VA) */
  loadVA: number;
  /** Article that governs the per-EVSE load in this edition */
  necReference: string;
  /** True when the 2023 §220.57(A) 7,200 VA floor raised the load above nameplate */
  floorApplied: boolean;
}

/**
 * Per-EVSE load for the given NEC edition.
 */
export function getEvseLoadVA(nameplateVA: number, edition: NecEdition): EvseLoadResult {
  if (edition === '2023') {
    return {
      loadVA: Math.max(NEC_2023_220_57_MINIMUM_VA, nameplateVA),
      necReference: 'NEC 220.57(A)',
      floorApplied: nameplateVA < NEC_2023_220_57_MINIMUM_VA,
    };
  }
  return {
    loadVA: nameplateVA,
    necReference: 'NEC 220.14(A)',
    floorApplied: false,
  };
}

/**
 * Short citation for the per-EVSE load rule, for labels and PDF headings.
 * 2020 cites 625.41 alongside 220.14(A) because 625.41 is where the reviewer
 * will look for EVSE continuous-duty treatment.
 */
export function evseLoadCitation(edition: NecEdition): string {
  return edition === '2023' ? 'NEC 220.57' : 'NEC 220.14(A) + 625.41';
}

/**
 * Map an AHJ manifest edition string ("NEC 2020", "NEC 2023") onto the
 * calc-layer edition. Returns undefined for anything else (e.g. Miami-Dade's
 * residential "NEC 2014") so callers fall through to the project setting.
 */
export function necEditionFromManifestString(value: string | null | undefined): NecEdition | undefined {
  if (!value) return undefined;
  if (value.includes('2023')) return '2023';
  if (value.includes('2020')) return '2020';
  return undefined;
}
