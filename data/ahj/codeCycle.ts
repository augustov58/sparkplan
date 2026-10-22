/**
 * Florida code cycles — which NEC edition a project is designed under.
 *
 * Florida adopts the NEC through the Florida Building Code:
 *   - FBC 8th Edition (2023) → NEC 2020, effective 2023-12-31
 *   - FBC 9th Edition (2026) → NEC 2023, effective 2026-12-31
 *     (statewide, including Miami-Dade single-family, whose NEC 2014 plan
 *     review lane ends with the 8th Edition)
 *
 * A project's edition is "Automatic" (this table, by today's date, for a
 * Florida or unknown jurisdiction) unless the project picks 2020 or 2023
 * explicitly (`settings.nec_edition_override`).
 * Pure data + pure functions; no DB, no React.
 */

import type { NecEdition } from '../nec/evse-load';
import type { AHJManifest } from './types';

export interface CodeCycle {
  /** First day (local, YYYY-MM-DD) the cycle applies */
  effective: string;
  nec: NecEdition;
}

export const FLORIDA_CODE_CYCLES: readonly CodeCycle[] = [
  { effective: '2023-12-31', nec: '2020' },
  { effective: '2026-12-31', nec: '2023' },
];

function localIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** NEC edition Florida enforces on `date` (local calendar day). */
export function floridaNecEdition(date: Date = new Date()): NecEdition {
  const day = localIsoDate(date);
  // Latest cycle in effect; before the first one, the first one.
  const inEffect = FLORIDA_CODE_CYCLES.filter((c) => day >= c.effective);
  return (inEffect[inEffect.length - 1] ?? FLORIDA_CODE_CYCLES[0])!.nec;
}

/** The fields of a `jurisdictions` row the edition depends on. */
export interface EditionJurisdiction {
  state?: string | null;
  nec_edition?: string | null;
}

/**
 * Automatic edition: Florida's code cycle on `date` for a Florida (or
 * unknown) jurisdiction; otherwise the jurisdiction row's own edition
 * (e.g. the Texas rows). The Florida rows' `nec_edition` is not used.
 */
export function automaticNecEdition(
  jurisdiction: EditionJurisdiction | null | undefined,
  date: Date = new Date(),
): NecEdition {
  const state = jurisdiction?.state?.trim().toUpperCase();
  const rowEdition = jurisdiction?.nec_edition;
  if (state && state !== 'FL' && (rowEdition === '2020' || rowEdition === '2023')) {
    return rowEdition;
  }
  return floridaNecEdition(date);
}

/**
 * The edition a project is designed under: the explicit pick, else
 * Automatic. Shared by the calculators, the packet, exports and the Copilot
 * so the math and the citations agree.
 */
export function resolveNecEdition(
  override: NecEdition | null | undefined,
  jurisdiction?: EditionJurisdiction | null,
  date: Date = new Date(),
): NecEdition {
  return override ?? automaticNecEdition(jurisdiction, date);
}

/** `resolveNecEdition` for a project object (null-safe). */
export function projectNecEdition(
  project: { settings?: { nec_edition_override?: NecEdition } | null } | null | undefined,
  jurisdiction?: EditionJurisdiction | null,
  date: Date = new Date(),
): NecEdition {
  return resolveNecEdition(project?.settings?.nec_edition_override, jurisdiction, date);
}

/**
 * Rewrite AHJ text written for the NEC 2020 / FBC 8th Edition cycle to the
 * edition in use. Manifest notes, code references and checklist names are
 * authored for the current cycle; under NEC 2023 they must cite NEC 2023 and
 * FBC 9th Edition (2026). NEC 2014 (Miami-Dade's single-family lane) also
 * moves to 2023. Other codes (FFPC, NFPA-70E) are left as written.
 * No-op for '2020'.
 */
export function applyCodeCycle(text: string, edition: NecEdition): string {
  if (edition === '2020') return text;
  return text
    .replace(/\b(2020|2014) NEC\b/g, '2023 NEC')
    .replace(/\bNEC (2020|2014)\b/g, 'NEC 2023')
    .replace(/NFPA-70 \(NEC\) 2020/g, 'NFPA-70 (NEC) 2023')
    .replace(/8th (edition|Edition|ed\.?) \(2023\)/g, '9th $1 (2026)')
    .replace(/\bFBC 8th (ed\.?|Ed\.?|edition|Edition)/g, 'FBC 9th $1');
}

/** `applyCodeCycle` over a list; preserves undefined. */
export function applyCodeCycleList(
  list: string[] | undefined,
  edition: NecEdition,
): string[] | undefined {
  return list?.map((s) => applyCodeCycle(s, edition));
}

/**
 * A manifest's general notes and code references for `edition`: the
 * per-edition replacement when the manifest has one, else the authored text,
 * then `applyCodeCycle`.
 */
export function manifestTextForEdition(
  manifest: Pick<AHJManifest, 'generalNotes' | 'codeReferences' | 'generalNotesByEdition' | 'codeReferencesByEdition'> | null | undefined,
  edition: NecEdition,
): { generalNotes?: string[]; codeReferences?: string[] } {
  if (!manifest) return {};
  return {
    generalNotes: applyCodeCycleList(manifest.generalNotesByEdition?.[edition] ?? manifest.generalNotes, edition),
    codeReferences: applyCodeCycleList(manifest.codeReferencesByEdition?.[edition] ?? manifest.codeReferences, edition),
  };
}
