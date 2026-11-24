/**
 * Equipment Specification Form Component
 *
 * Reusable form for entering equipment specifications for panels and transformers.
 * Integrates with manufacturer templates to reduce manual data entry.
 *
 * @module components/EquipmentSpecForm
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  PANEL_MANUFACTURERS,
  NEMA_ENCLOSURE_TYPES,
  UL_LISTINGS,
  STANDARD_AIC_RATINGS,
  TRANSFORMER_COOLING_TYPES,
  TRANSFORMER_TEMPERATURE_RISE,
  getPanelModels,
  getPanelModel,
  type PanelModel
} from '@/data/manufacturerTemplates';
import type { PanelEquipmentSpecs, TransformerEquipmentSpecs } from '@/types';

/** A spec update the form emits; `null` clears a saved value (#314). */
export type SpecUpdate<T> = { [K in keyof T]?: T[K] | null };

/**
 * #314: an emptied field is sent as null so the PATCH clears the column.
 * `undefined` is dropped from the request body (the column kept its old
 * value) and '' stored an empty string.
 */
function orNull<T>(value: T | '' | null | undefined): T | null {
  return value === '' || value === undefined || value === null ? null : value;
}

/** The panel columns the form saves, from its field state. */
export function panelSpecsUpdate(f: {
  manufacturer: string; modelNumber: string; nemaType: string; ulListing: string;
  aicRating: number | null | undefined; seriesRating: boolean; notes: string;
}): SpecUpdate<PanelEquipmentSpecs> {
  return {
    manufacturer: orNull(f.manufacturer),
    model_number: orNull(f.modelNumber),
    nema_enclosure_type: orNull(f.nemaType),
    ul_listing: orNull(f.ulListing),
    aic_rating: orNull(f.aicRating),
    series_rating: f.seriesRating,
    notes: orNull(f.notes),
  };
}

/** The transformer columns the form saves, from its field state. */
export function transformerSpecsUpdate(f: {
  manufacturer: string; modelNumber: string; windingType: string; impedancePercent: number | null | undefined;
  coolingType: string; ulListing: string; temperatureRise: number | null | undefined; notes: string;
}): SpecUpdate<TransformerEquipmentSpecs> & { manufacturer?: string | null; model_number?: string | null } {
  return {
    manufacturer: orNull(f.manufacturer),
    model_number: orNull(f.modelNumber),
    winding_type: orNull(f.windingType),
    impedance_percent: orNull(f.impedancePercent),
    cooling_type: orNull(f.coolingType),
    ul_listing: orNull(f.ulListing),
    temperature_rise: orNull(f.temperatureRise),
    notes: orNull(f.notes),
  };
}

interface EquipmentSpecFormProps {
  /** Equipment type */
  type: 'panel' | 'transformer';

  /** Current equipment data */
  currentData: Partial<PanelEquipmentSpecs | TransformerEquipmentSpecs>;

  /** Voltage of the equipment (used for template filtering) */
  voltage?: number;

  /** Phase of the equipment (used for template filtering) */
  phase?: 1 | 3;

  /** Bus rating in amps (used for template filtering) */
  busRating?: number;

  /** Callback when form data changes; an emptied field is null (#314) */
  onChange: (updates: SpecUpdate<PanelEquipmentSpecs> | SpecUpdate<TransformerEquipmentSpecs>) => void;

  /** Show calculated fault current for AIC validation (panels only) */
  faultCurrentKA?: number;
}

/**
 * Equipment Specification Form
 *
 * Features:
 * - Manufacturer templates auto-populate fields
 * - Model autocomplete based on voltage/phase
 * - NEMA type selector
 * - UL listing dropdown
 * - AIC rating with standard values
 * - Visual validation feedback
 */
export function EquipmentSpecForm({
  type,
  currentData,
  voltage,
  phase,
  busRating,
  onChange,
  faultCurrentKA
}: EquipmentSpecFormProps) {
  // Form state. `manufacturer` and `model_number` only exist on the Panel
  // variant of the union; narrow via cast to read them safely when the union
  // resolves to the Transformer side (they'll be undefined and fall back to '').
  const [manufacturer, setManufacturer] = useState(
    (currentData as Partial<PanelEquipmentSpecs>).manufacturer || ''
  );
  const [modelNumber, setModelNumber] = useState(
    (currentData as Partial<PanelEquipmentSpecs>).model_number || ''
  );
  const [availableModels, setAvailableModels] = useState<PanelModel[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PanelModel | null>(null);

  // Panel-specific state
  const [nemaType, setNemaType] = useState<string>(
    (currentData as PanelEquipmentSpecs).nema_enclosure_type || ''
  );
  const [aicRating, setAicRating] = useState<number | null | undefined>(
    (currentData as PanelEquipmentSpecs).aic_rating
  );
  const [seriesRating, setSeriesRating] = useState<boolean>(
    (currentData as PanelEquipmentSpecs).series_rating || false
  );

  // Transformer-specific state
  const [windingType, setWindingType] = useState<string>(
    (currentData as TransformerEquipmentSpecs).winding_type || ''
  );
  const [impedancePercent, setImpedancePercent] = useState<number | undefined>(
    (currentData as TransformerEquipmentSpecs).impedance_percent
  );
  const [coolingType, setCoolingType] = useState<string>(
    (currentData as TransformerEquipmentSpecs).cooling_type || ''
  );
  const [temperatureRise, setTemperatureRise] = useState<number | undefined>(
    (currentData as TransformerEquipmentSpecs).temperature_rise
  );

  // Common state
  const [ulListing, setUlListing] = useState(currentData.ul_listing || '');
  const [notes, setNotes] = useState(currentData.notes || '');

  // Update available models when manufacturer changes
  useEffect(() => {
    if (manufacturer && type === 'panel') {
      const models = getPanelModels(manufacturer);

      // Filter models by voltage and phase if provided
      const filtered = models.filter(model => {
        if (voltage && model.voltage !== voltage) return false;
        if (phase && model.phase !== phase) return false;
        return true;
      });

      setAvailableModels(filtered);
    } else {
      setAvailableModels([]);
    }
  }, [manufacturer, voltage, phase, type]);

  // Auto-populate from template when model is selected
  const handleModelChange = (newModel: string) => {
    setModelNumber(newModel);

    if (type === 'panel' && manufacturer) {
      const template = getPanelModel(manufacturer, newModel);
      if (template) {
        setSelectedTemplate(template);

        // Auto-populate fields from template
        const firstNema = template.nema_types[0];
        if (!nemaType && firstNema) {
          setNemaType(firstNema);
        }
        if (!aicRating) {
          setAicRating(template.aic);
        }
        if (!ulListing) {
          setUlListing(template.ul_listing || 'UL 67 - Panelboards');
        }
      }
    }
  };

  // The parent passes a new onChange on every render. Read it from a ref so
  // the emit effect runs only when a field changes; with onChange in its
  // dependencies it re-ran after every render and set new state each time
  // ("Maximum update depth exceeded", #314).
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Emit changes to parent
  useEffect(() => {
    onChangeRef.current(type === 'panel'
      ? panelSpecsUpdate({ manufacturer, modelNumber, nemaType, ulListing, aicRating, seriesRating, notes })
      : transformerSpecsUpdate({
          manufacturer, modelNumber, windingType, impedancePercent, coolingType, ulListing, temperatureRise, notes,
        }));
  }, [
    manufacturer, modelNumber, nemaType, ulListing, aicRating, seriesRating,
    windingType, impedancePercent, coolingType, temperatureRise, notes, type
  ]);

  // AIC validation status
  const aicStatus = faultCurrentKA && aicRating
    ? aicRating >= faultCurrentKA
      ? 'adequate'
      : 'insufficient'
    : 'unknown';

  return (
    <div className="space-y-4">
      {/* Manufacturer */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Manufacturer
        </label>
        <select
          value={manufacturer}
          onChange={(e) => {
            setManufacturer(e.target.value);
            setModelNumber(''); // Reset model when manufacturer changes
            setSelectedTemplate(null);
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select manufacturer...</option>
          {type === 'panel' && PANEL_MANUFACTURERS.map(m => (
            <option key={m.name} value={m.name}>{m.name}</option>
          ))}
          {type === 'transformer' && (
            <>
              <option value="ABB">ABB</option>
              <option value="Eaton">Eaton</option>
              <option value="General Electric">General Electric</option>
              <option value="Hammond Power Solutions">Hammond Power Solutions</option>
              <option value="Schneider Electric">Schneider Electric</option>
              <option value="Siemens">Siemens</option>
            </>
          )}
        </select>
      </div>

      {/* Model Number */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Model / Catalog Number
        </label>
        {availableModels.length > 0 ? (
          <select
            value={modelNumber}
            onChange={(e) => handleModelChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select model...</option>
            {availableModels.map(model => (
              <option key={model.model} value={model.model}>
                {model.model} - {model.description}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={modelNumber}
            onChange={(e) => setModelNumber(e.target.value)}
            placeholder="Enter model number"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />
        )}
        {selectedTemplate && (
          <p className="mt-1 text-xs text-gray-500">
            ✓ Template applied: {selectedTemplate.description}
          </p>
        )}
      </div>

      {/* Panel-Specific Fields */}
      {type === 'panel' && (
        <>
          {/* NEMA Enclosure Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              NEMA Enclosure Type <span className="text-xs text-gray-500">(NEC 408.20)</span>
            </label>
            <select
              value={nemaType}
              onChange={(e) => setNemaType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select NEMA type...</option>
              {NEMA_ENCLOSURE_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label} - {type.description}
                </option>
              ))}
            </select>
          </div>

          {/* AIC Rating */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              AIC Rating (kA) <span className="text-xs text-gray-500">(NEC 110.9)</span>
            </label>
            <select
              value={aicRating || ''}
              onChange={(e) => setAicRating(e.target.value ? Number(e.target.value) : undefined)}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                aicStatus === 'insufficient' ? 'border-red-500 bg-red-50' :
                aicStatus === 'adequate' ? 'border-green-500 bg-green-50' :
                'border-gray-300'
              }`}
            >
              <option value="">Select AIC rating...</option>
              {STANDARD_AIC_RATINGS.map(rating => (
                <option key={rating} value={rating}>{rating} kA</option>
              ))}
            </select>

            {/* AIC Validation Feedback */}
            {faultCurrentKA && aicRating && (
              <div className={`mt-2 p-2 rounded text-sm ${
                aicStatus === 'adequate'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {aicStatus === 'adequate' ? (
                  <>
                    ✓ <strong>AIC rating adequate</strong>: {aicRating} kA ≥ {faultCurrentKA.toFixed(1)} kA fault current
                  </>
                ) : (
                  <>
                    ⚠ <strong>AIC rating insufficient</strong>: {aicRating} kA &lt; {faultCurrentKA.toFixed(1)} kA fault current.
                    NEC 110.9 requires upgrade to {STANDARD_AIC_RATINGS.find(r => r >= faultCurrentKA) || 200} kA minimum.
                  </>
                )}
              </div>
            )}
          </div>

          {/* Series Rating */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="series-rating"
              checked={seriesRating}
              onChange={(e) => setSeriesRating(e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <label htmlFor="series-rating" className="ml-2 text-sm text-gray-700">
              Series-Rated System <span className="text-xs text-gray-500">(NEC 240.86)</span>
            </label>
          </div>
        </>
      )}

      {/* Transformer-Specific Fields */}
      {type === 'transformer' && (
        <>
          {/* Winding Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Winding Type
            </label>
            <select
              value={windingType}
              onChange={(e) => setWindingType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select winding type...</option>
              <option value="Dry-type">Dry-type</option>
              <option value="Liquid-filled">Liquid-filled (Oil-immersed)</option>
            </select>
          </div>

          {/* Impedance Percent */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Impedance (%)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="20"
              value={impedancePercent || ''}
              onChange={(e) => setImpedancePercent(e.target.value ? Number(e.target.value) : undefined)}
              placeholder="e.g., 5.75"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Typical values: 2-6% (small), 5-8% (medium), 6-10% (large)
            </p>
          </div>

          {/* Cooling Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cooling Type
            </label>
            <select
              value={coolingType}
              onChange={(e) => setCoolingType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select cooling type...</option>
              {TRANSFORMER_COOLING_TYPES.map(type => (
                <option key={type.code} value={type.code}>
                  {type.code} - {type.description}
                </option>
              ))}
            </select>
          </div>

          {/* Temperature Rise */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Temperature Rise (°C)
            </label>
            <select
              value={temperatureRise || ''}
              onChange={(e) => setTemperatureRise(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select temperature rise...</option>
              {TRANSFORMER_TEMPERATURE_RISE.map(temp => (
                <option key={temp} value={temp}>{temp}°C</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Typical: 80°C (ventilated), 115°C (sealed), 150°C (high-temp)
            </p>
          </div>
        </>
      )}

      {/* UL Listing (Common) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          UL Listing <span className="text-xs text-gray-500">(NEC 110.3(B))</span>
        </label>
        <select
          value={ulListing}
          onChange={(e) => setUlListing(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select UL listing...</option>
          {UL_LISTINGS[type].map(listing => (
            <option key={listing} value={listing}>{listing}</option>
          ))}
        </select>
      </div>

      {/* Notes (Common) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Additional equipment specifications or special requirements..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* NEC References */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-gray-700">
        <p className="font-semibold mb-1">NEC Requirements:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li><strong>NEC 110.3(B):</strong> Equipment must be listed (UL, ETL, etc.)</li>
          {type === 'panel' && (
            <>
              <li><strong>NEC 110.9:</strong> AIC rating must meet or exceed fault current</li>
              <li><strong>NEC 408.20:</strong> Enclosure type must be suitable for location</li>
              <li><strong>NEC 240.86:</strong> Series ratings require specific markings</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
