/**
 * Per-EVSE load by NEC edition (2026-09-27).
 *
 * NEC 220.57 was added in NEC 2023; Florida enforces NEC 2020 (FBC 8th Ed.),
 * where the EVSE is a nameplate load per 220.14(A). PE-confirmed: both
 * editions take the per-EVSE value at 100% in the Article 220 load calc —
 * the 625.41 125% applies to OCPD/conductor sizing, not here.
 */
import { describe, it, expect } from 'vitest';
import {
  getEvseLoadVA,
  evseLoadCitation,
  necEditionFromManifestString,
  NEC_2023_220_57_MINIMUM_VA,
} from '../data/nec/evse-load';
import { ALL_MANIFESTS, getManifestById, resolveNecEdition } from '../data/ahj/registry';

describe('getEvseLoadVA', () => {
  it('NEC 2023 applies the 7,200 VA floor below it', () => {
    expect(getEvseLoadVA(5760, '2023')).toEqual({ loadVA: 7200, necReference: 'NEC 220.57(A)', floorApplied: true });
  });

  it('NEC 2023 at exactly 7,200 VA: floor does not "apply" (nameplate equals it)', () => {
    expect(getEvseLoadVA(7200, '2023')).toEqual({ loadVA: 7200, necReference: 'NEC 220.57(A)', floorApplied: false });
  });

  it('NEC 2023 above the floor uses nameplate', () => {
    expect(getEvseLoadVA(7201, '2023').loadVA).toBe(7201);
    expect(getEvseLoadVA(11520, '2023').loadVA).toBe(11520);
  });

  it('NEC 2020 always uses nameplate — no floor, no 125%', () => {
    expect(getEvseLoadVA(3840, '2020')).toEqual({ loadVA: 3840, necReference: 'NEC 220.14(A)', floorApplied: false });
    expect(getEvseLoadVA(6656, '2020').loadVA).toBe(6656); // 32A @ 208V
    expect(getEvseLoadVA(11520, '2020').loadVA).toBe(11520); // 48A @ 240V
  });

  it('editions agree at and above 7,200 VA', () => {
    for (const va of [NEC_2023_220_57_MINIMUM_VA, 7680, 9984, 11520, 19200]) {
      expect(getEvseLoadVA(va, '2020').loadVA).toBe(getEvseLoadVA(va, '2023').loadVA);
    }
  });

  it('citation never mentions 220.57 for NEC 2020', () => {
    expect(evseLoadCitation('2020')).not.toContain('220.57');
    expect(evseLoadCitation('2023')).toBe('NEC 220.57');
  });
});

describe('necEditionFromManifestString', () => {
  it('maps manifest strings', () => {
    expect(necEditionFromManifestString('NEC 2020')).toBe('2020');
    expect(necEditionFromManifestString('NEC 2023')).toBe('2023');
  });

  it('returns undefined for editions outside the calc union (e.g. NEC 2014) and empty input', () => {
    expect(necEditionFromManifestString('NEC 2014')).toBeUndefined();
    expect(necEditionFromManifestString(undefined)).toBeUndefined();
    expect(necEditionFromManifestString('')).toBeUndefined();
  });
});

describe('resolveNecEdition', () => {
  const pompano = getManifestById('pompano');

  it('manifest edition wins over the project setting', () => {
    expect(pompano).not.toBeNull();
    expect(resolveNecEdition(pompano, 'multi_family', '2023')).toBe('2020');
  });

  it('falls through to the project setting when no manifest', () => {
    expect(resolveNecEdition(null, 'multi_family', '2023')).toBe('2023');
  });

  it('falls through to the project setting when the manifest edition is outside the union', () => {
    const miamiDade = getManifestById('miami-dade');
    expect(miamiDade?.necEdition.single_family_residential).toContain('2014');
    expect(resolveNecEdition(miamiDade, 'single_family_residential', '2023')).toBe('2023');
  });

  it('defaults to 2020 when nothing is set', () => {
    expect(resolveNecEdition(null, 'multi_family', undefined)).toBe('2020');
  });

  it('every registered (Florida) manifest resolves multi-family to NEC 2020', () => {
    expect(ALL_MANIFESTS.length).toBeGreaterThan(0);
    for (const m of ALL_MANIFESTS) {
      expect(resolveNecEdition(m, 'multi_family', '2023'), m.id).toBe('2020');
    }
  });
});
