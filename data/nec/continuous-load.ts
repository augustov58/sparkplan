/**
 * Continuous loads in the service check — NEC 230.42(A)(1)
 *
 * Service-entrance conductors shall have an ampacity not less than "the sum
 * of the noncontinuous loads plus 125 percent of continuous loads", with the
 * loads determined per Article 220. Whether a service is sufficient is a
 * conductor / OCPD question, so the service check is the Article 220 load
 * plus 25% of the continuous loads — under every 220.87 method, dwellings
 * included (PE ruling 2026-11-07, #192). The Article 220 load itself stays
 * at 100% (rulings 2026-09-27 / 10-14 / 10-21).
 *
 * Continuous loads the circuits identify:
 * - EV charging: continuous per 625.42 (and the Article 100 definition, 3 h+)
 * - sign outlets (220.14(F), 600.5) and show-window lighting (220.14(G)),
 *   as in Informative Annex D Example D3
 *
 * General lighting is not counted: the NEC 2020 Table 220.12 unit loads
 * already include the 125% continuous multiplier.
 */

import { EVSE_CONTINUOUS_FACTOR, isEvseDescription } from './evse-load';

/** NEC 230.42(A)(1): continuous loads at 125% in the service check. */
export const CONTINUOUS_LOAD_FACTOR = EVSE_CONTINUOUS_FACTOR;

/** The share of a continuous load the service check adds to its Article 220 load. */
export const CONTINUOUS_LOAD_ADDER = CONTINUOUS_LOAD_FACTOR - 1;

export const CONTINUOUS_LOAD_REFERENCE = 'NEC 230.42(A)(1)';

/** Circuits carry no sign / show-window type, so the description decides. */
const SIGN_OR_SHOW_WINDOW = /\bsigns?\b|\bsignage\b|\bshow[\s-]?windows?\b/i;

export function isSignOrShowWindowDescription(description: string | null | undefined): boolean {
  return SIGN_OR_SHOW_WINDOW.test(description ?? '');
}

/** A circuit whose load is continuous in the service check (EVSE, sign, show window). */
export function isContinuousServiceLoad(description: string | null | undefined): boolean {
  return isEvseDescription(description) || isSignOrShowWindowDescription(description);
}
