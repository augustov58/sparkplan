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
  NEC_2023_220_57_MINIMUM_VA,
} from '../data/nec/evse-load';
import { ALL_MANIFESTS, getManifestById } from '../data/ahj/registry';
import {
  applyCodeCycle,
  floridaNecEdition,
  projectNecEdition,
  resolveNecEdition,
} from '../data/ahj/codeCycle';

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

describe('resolveNecEdition (Florida code cycle)', () => {
  const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);

  it('Automatic: NEC 2020 through 2026-12-30, NEC 2023 from 2026-12-31', () => {
    expect(floridaNecEdition(day(2026, 10, 21))).toBe('2020');
    expect(floridaNecEdition(day(2026, 12, 30))).toBe('2020');
    expect(floridaNecEdition(day(2026, 12, 31))).toBe('2023');
    expect(floridaNecEdition(day(2027, 6, 1))).toBe('2023');
  });

  it('an explicit pick wins over the date', () => {
    expect(resolveNecEdition('2023', null, day(2026, 10, 21))).toBe('2023');
    expect(resolveNecEdition('2020', null, day(2027, 6, 1))).toBe('2020');
    expect(resolveNecEdition(undefined, null, day(2027, 6, 1))).toBe('2023');
  });

  it('Automatic ignores a Florida row\'s nec_edition and uses the cycle', () => {
    expect(resolveNecEdition(undefined, { state: 'FL', nec_edition: '2023' }, day(2026, 10, 21))).toBe('2020');
  });

  it('Automatic uses the row\'s edition outside Florida; an explicit pick still wins', () => {
    expect(resolveNecEdition(undefined, { state: 'TX', nec_edition: '2023' }, day(2026, 10, 21))).toBe('2023');
    expect(resolveNecEdition('2020', { state: 'TX', nec_edition: '2023' }, day(2026, 10, 21))).toBe('2020');
  });

  it('projectNecEdition reads settings.nec_edition_override; the legacy column is ignored', () => {
    expect(projectNecEdition({ settings: {} }, null, day(2026, 10, 21))).toBe('2020');
    expect(projectNecEdition({ settings: { nec_edition_override: '2023' } }, null, day(2026, 10, 21))).toBe('2023');
    expect(projectNecEdition(null, null, day(2026, 10, 21))).toBe('2020');
  });
});

describe('applyCodeCycle', () => {
  it('is a no-op under NEC 2020', () => {
    const s = 'All electrical work shall comply with NFPA-70 (2020 NEC) and the Florida Building Code 8th edition (2023).';
    expect(applyCodeCycle(s, '2020')).toBe(s);
  });

  it('moves NEC 2020 / FBC 8th text to NEC 2023 / FBC 9th (2026)', () => {
    expect(applyCodeCycle('NFPA-70 (2020 NEC) and the Florida Building Code 8th edition (2023), as adopted', '2023'))
      .toBe('NFPA-70 (2023 NEC) and the Florida Building Code 9th edition (2026), as adopted');
    expect(applyCodeCycle('Florida Building Code, 8th edition (2023)', '2023')).toBe('Florida Building Code, 9th edition (2026)');
    expect(applyCodeCycle('Cover-sheet code basis block (NEC 2020 + FBC 8th ed + Pompano)', '2023'))
      .toBe('Cover-sheet code basis block (NEC 2023 + FBC 9th ed + Pompano)');
    expect(applyCodeCycle('per FBC 8th ed (2023). Outdoor', '2023')).toBe('per FBC 9th ed (2026). Outdoor');
    expect(applyCodeCycle('NFPA-70 (NEC) 2020', '2023')).toBe('NFPA-70 (NEC) 2023');
  });

  it('leaves other codes alone', () => {
    const s = 'Florida Fire Prevention Code, 8th edition (NFPA 1, 2021)';
    expect(applyCodeCycle(s, '2023')).toBe(s);
    expect(applyCodeCycle('NFPA-70E (2024)', '2023')).toBe('NFPA-70E (2024)');
  });

  it('no manifest text still cites NEC 2020 or FBC 8th under NEC 2023', () => {
    for (const m of ALL_MANIFESTS) {
      const texts = [
        ...(m.generalNotesByEdition?.['2023'] ?? m.generalNotes),
        ...(m.codeReferencesByEdition?.['2023'] ?? m.codeReferences),
        ...m.requirements.map((r) => r.name),
      ].map((t) => applyCodeCycle(t, '2023'));
      for (const t of texts) {
        expect(t, `${m.id}: ${t}`).not.toMatch(/NEC 20(14|20)|20(14|20) NEC|8th ed(ition)? \(2023\)|FBC 8th/i);
      }
    }
  });

  it('Miami-Dade drops its NEC 2014 single-family lane under NEC 2023', () => {
    const md = getManifestById('miami-dade');
    const refs = md?.codeReferencesByEdition?.['2023'] ?? [];
    expect(refs.join('\n')).not.toContain('2014');
    expect(refs.join('\n')).not.toContain('single-family residential scope');
    expect(refs).toContain('NFPA-70 (2023 NEC)');
  });
});

describe('isEvseDescription', () => {
  it('matches EV charger circuit descriptions', async () => {
    const { isEvseDescription } = await import('../data/nec/evse-load');
    for (const d of ['EV Charger 48A', 'Level 2 EV Charger (48A)', 'EVSE - Garage', 'Electric Vehicle Charger', 'Tesla Wall Charger']) {
      expect(isEvseDescription(d)).toBe(true);
    }
  });
  it('does not match ordinary loads', async () => {
    const { isEvseDescription } = await import('../data/nec/evse-load');
    for (const d of ['Electric Range', 'Water Heater', 'Pool Pump', 'Dishwasher', 'Bevel saw', '', null]) {
      expect(isEvseDescription(d)).toBe(false);
    }
  });
  it('#164: a bare "EV" naming another load is not a charger; "EV 50A" still is', async () => {
    const { isEvseDescription } = await import('../data/nec/evse-load');
    for (const d of ['EV Area Lighting', 'EV Panel Receptacle', 'EV Sub-Panel Feeder', 'EVEMS Load Management System', 'Lighting Circuit']) {
      expect(isEvseDescription(d)).toBe(false);
    }
    for (const d of ['EV 50A', 'EV - Garage', 'EV Charger #1 - Level 2 (48A continuous)', 'DC Fast Charger #1 - 150kW']) {
      expect(isEvseDescription(d)).toBe(true);
    }
  });
});
