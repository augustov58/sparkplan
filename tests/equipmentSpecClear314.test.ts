/**
 * #314 (owner 2026-11-24): an emptied Equipment Specs field is sent as null,
 * so the PATCH clears the column. `undefined` is dropped by JSON.stringify
 * (the column kept its old value) and '' stored an empty string.
 */
import { describe, it, expect } from 'vitest';
import { panelSpecsUpdate, transformerSpecsUpdate } from '../components/EquipmentSpecForm';

describe('#314 Equipment Specs: an emptied field clears the column', () => {
  it('sends null for every emptied panel field; the PATCH body keeps the keys', () => {
    const update = panelSpecsUpdate({
      manufacturer: '', modelNumber: '', nemaType: '', ulListing: '',
      aicRating: undefined, seriesRating: false, notes: '',
    });
    expect(update).toEqual({
      manufacturer: null, model_number: null, nema_enclosure_type: null, ul_listing: null,
      aic_rating: null, series_rating: false, notes: null,
    });
    // what supabase-js sends: main's body had no aic_rating key at all
    expect(JSON.parse(JSON.stringify(update))).toHaveProperty('aic_rating', null);
  });

  it('keeps entered panel values as they are (AIC in kA, #313)', () => {
    expect(panelSpecsUpdate({
      manufacturer: 'Square D', modelNumber: 'NQ', nemaType: '1', ulListing: 'UL 67 - Panelboards',
      aicRating: 42, seriesRating: true, notes: 'QA 314',
    })).toEqual({
      manufacturer: 'Square D', model_number: 'NQ', nema_enclosure_type: '1', ul_listing: 'UL 67 - Panelboards',
      aic_rating: 42, series_rating: true, notes: 'QA 314',
    });
  });

  it('a value loaded as null from the database stays null', () => {
    expect(panelSpecsUpdate({
      manufacturer: '', modelNumber: '', nemaType: '', ulListing: '',
      aicRating: null, seriesRating: false, notes: '',
    }).aic_rating).toBeNull();
  });

  it('sends null for every emptied transformer field', () => {
    expect(transformerSpecsUpdate({
      manufacturer: '', modelNumber: '', windingType: '', impedancePercent: undefined,
      coolingType: '', ulListing: '', temperatureRise: undefined, notes: '',
    })).toEqual({
      manufacturer: null, model_number: null, winding_type: null, impedance_percent: null,
      cooling_type: null, ul_listing: null, temperature_rise: null, notes: null,
    });
  });
});
