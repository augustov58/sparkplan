/**
 * Manufacturer Equipment Templates
 *
 * Reference data for common electrical equipment manufacturers to reduce manual
 * data entry when creating equipment specification sheets for permit applications.
 *
 * @module data/manufacturerTemplates
 *
 * ## Purpose
 * - Pre-populate equipment specifications (80% reduction in data entry)
 * - Ensure accurate manufacturer model numbers and ratings
 * - Provide NEC-compliant default values
 *
 * ## Usage
 * ```typescript
 * import { PANEL_MANUFACTURERS, NEMA_ENCLOSURE_TYPES } from '@/data/manufacturerTemplates';
 *
 * // Find Square D QO model template
 * const squareD = PANEL_MANUFACTURERS.find(m => m.name === 'Square D');
 * const qoModel = squareD?.models.find(m => m.model === 'QO');
 * ```
 */

// ============================================================================
// PANEL MANUFACTURERS
// ============================================================================

export interface PanelModel {
  /** Model designation (e.g., 'QO', 'NF', 'BR') */
  model: string;

  /** Service/panel voltage (120/240, 208, 480, 600) */
  voltage: number;

  /** Number of phases (1 or 3) */
  phase: 1 | 3;

  /** Available bus ratings in amps */
  ratings: number[];

  /** Standard AIC rating for this model in kA */
  aic: number;

  /** Common NEMA enclosure types for this model */
  nema_types: string[];

  /** Optional: UL listing (defaults to 'UL 67 - Panelboards' if not specified) */
  ul_listing?: string;

  /** Optional: Description */
  description?: string;
}

export interface PanelManufacturer {
  name: string;
  models: PanelModel[];
}

/**
 * Common panel manufacturers and their model lines
 *
 * @remarks
 * Data based on 2024-2025 manufacturer catalogs. AIC ratings are typical;
 * verify actual ratings from equipment cut sheets.
 */
export const PANEL_MANUFACTURERS: PanelManufacturer[] = [
  // ========== SQUARE D (Schneider Electric) ==========
  {
    name: 'Square D',
    models: [
      {
        model: 'QO',
        voltage: 240,
        phase: 1,
        ratings: [100, 125, 150, 200, 225],
        aic: 10,
        nema_types: ['1', '3R'],
        description: 'QO Residential Load Centers - 10 kAIC, plug-on neutral'
      },
      {
        model: 'Homeline',
        voltage: 240,
        phase: 1,
        ratings: [100, 125, 150, 200],
        aic: 10,
        nema_types: ['1', '3R'],
        description: 'Homeline Value Load Centers - 10 kAIC'
      },
      {
        model: 'NF',
        voltage: 480,
        phase: 3,
        ratings: [225, 400, 600, 800, 1000, 1200],
        aic: 65,
        nema_types: ['1', '3R', '12'],
        description: 'NF Panelboards - 65 kAIC, commercial/industrial'
      },
      {
        model: 'NQOD',
        voltage: 208,
        phase: 3,
        ratings: [100, 225, 400, 600],
        aic: 65,
        nema_types: ['1', '3R', '4X'],
        description: 'NQOD Panelboards - 65 kAIC, 208Y/120V'
      },
      {
        model: 'I-Line',
        voltage: 480,
        phase: 3,
        ratings: [400, 600, 800, 1000, 1200, 1600, 2000, 2500, 3000],
        aic: 100,
        nema_types: ['1', '3R', '12'],
        ul_listing: 'UL 891 - Switchboards',
        description: 'I-Line Switchboards - 100 kAIC, large commercial'
      }
    ]
  },

  // ========== EATON ==========
  {
    name: 'Eaton',
    models: [
      {
        model: 'BR',
        voltage: 240,
        phase: 1,
        ratings: [100, 125, 150, 200],
        aic: 10,
        nema_types: ['1', '3R'],
        description: 'BR Residential Load Centers - 10 kAIC'
      },
      {
        model: 'CH',
        voltage: 240,
        phase: 1,
        ratings: [125, 150, 200, 225],
        aic: 22,
        nema_types: ['1', '3R'],
        description: 'CH Residential Load Centers - 22 kAIC'
      },
      {
        model: 'PRL1a',
        voltage: 208,
        phase: 3,
        ratings: [225, 400, 600],
        aic: 65,
        nema_types: ['1', '3R', '4X'],
        description: 'PRL1a Panelboards - 65 kAIC, 208Y/120V'
      },
      {
        model: 'PRL2a',
        voltage: 480,
        phase: 3,
        ratings: [225, 400, 600, 800, 1000],
        aic: 65,
        nema_types: ['1', '3R', '12'],
        description: 'PRL2a Panelboards - 65 kAIC, 480Y/277V'
      },
      {
        model: 'PRL3a',
        voltage: 480,
        phase: 3,
        ratings: [400, 600, 800, 1000, 1200, 1600],
        aic: 100,
        nema_types: ['1', '3R', '12'],
        description: 'PRL3a Panelboards - 100 kAIC, high fault current'
      },
      {
        model: 'Pow-R-Line',
        voltage: 480,
        phase: 3,
        ratings: [800, 1000, 1200, 1600, 2000, 2500, 3000],
        aic: 200,
        nema_types: ['1', '3R'],
        ul_listing: 'UL 891 - Switchboards',
        description: 'Pow-R-Line Switchboards - 200 kAIC, heavy industrial'
      }
    ]
  },

  // ========== SIEMENS ==========
  {
    name: 'Siemens',
    models: [
      {
        model: 'P1',
        voltage: 240,
        phase: 1,
        ratings: [100, 125, 150, 200],
        aic: 10,
        nema_types: ['1', '3R'],
        description: 'P1 Residential Load Centers - 10 kAIC'
      },
      {
        model: 'P3',
        voltage: 240,
        phase: 1,
        ratings: [100, 125, 150, 200, 225],
        aic: 22,
        nema_types: ['1', '3R'],
        description: 'P3 Residential Load Centers - 22 kAIC'
      },
      {
        model: 'P1A',
        voltage: 208,
        phase: 3,
        ratings: [225, 400, 600],
        aic: 42,
        nema_types: ['1', '3R', '4X'],
        description: 'P1A Panelboards - 42 kAIC, 208Y/120V commercial'
      },
      {
        model: 'P4',
        voltage: 480,
        phase: 3,
        ratings: [225, 400, 600, 800, 1000],
        aic: 65,
        nema_types: ['1', '3R', '12'],
        description: 'P4 Panelboards - 65 kAIC, 480Y/277V commercial'
      },
      {
        model: 'SENTRON',
        voltage: 480,
        phase: 3,
        ratings: [800, 1000, 1200, 1600, 2000, 2500, 3000, 4000],
        aic: 200,
        nema_types: ['1', '3R'],
        ul_listing: 'UL 891 - Switchboards',
        description: 'SENTRON Switchboards - 200 kAIC, large industrial'
      }
    ]
  },

  // ========== GENERAL ELECTRIC (GE) ==========
  {
    name: 'General Electric',
    models: [
      {
        model: 'TL',
        voltage: 240,
        phase: 1,
        ratings: [100, 125, 150, 200],
        aic: 10,
        nema_types: ['1', '3R'],
        description: 'TL Series Residential Load Centers - 10 kAIC'
      },
      {
        model: 'PowerMark Gold',
        voltage: 240,
        phase: 1,
        ratings: [150, 200, 225],
        aic: 22,
        nema_types: ['1', '3R'],
        description: 'PowerMark Gold Load Centers - 22 kAIC'
      },
      {
        model: 'AQU',
        voltage: 208,
        phase: 3,
        ratings: [225, 400, 600],
        aic: 65,
        nema_types: ['1', '3R'],
        description: 'AQU Panelboards - 65 kAIC, 208Y/120V'
      },
      {
        model: 'AE',
        voltage: 480,
        phase: 3,
        ratings: [225, 400, 600, 800, 1000],
        aic: 65,
        nema_types: ['1', '3R', '12'],
        description: 'AE Panelboards - 65 kAIC, 480Y/277V'
      }
    ]
  }
];

// ============================================================================
// NEMA ENCLOSURE TYPES
// ============================================================================

export interface NemaEnclosureType {
  value: string;
  label: string;
  description: string;
}

/**
 * NEMA Enclosure Types per NEC 408.20
 *
 * @see NEMA 250 - Enclosures for Electrical Equipment (1000 Volts Maximum)
 */
export const NEMA_ENCLOSURE_TYPES: NemaEnclosureType[] = [
  {
    value: '1',
    label: 'Type 1',
    description: 'Indoor, general purpose, protects against falling dirt'
  },
  {
    value: '3R',
    label: 'Type 3R',
    description: 'Outdoor, rainproof and sleet-resistant (no dust protection)'
  },
  {
    value: '3',
    label: 'Type 3',
    description: 'Outdoor, dust-tight, rain-tight, and sleet-resistant'
  },
  {
    value: '4',
    label: 'Type 4',
    description: 'Indoor/outdoor, watertight and dust-tight, protects against hose-directed water'
  },
  {
    value: '4X',
    label: 'Type 4X',
    description: 'Type 4 + corrosion resistant (stainless steel), coastal/industrial'
  },
  {
    value: '12',
    label: 'Type 12',
    description: 'Indoor, dust-tight and drip-tight, industrial use'
  },
  {
    value: '12K',
    label: 'Type 12K',
    description: 'Type 12 with knockouts'
  },
  {
    value: '6',
    label: 'Type 6',
    description: 'Indoor/outdoor, submersible (6 ft for 30 min), watertight'
  },
  {
    value: '6P',
    label: 'Type 6P',
    description: 'Prolonged submersion at specified depth'
  }
];

// ============================================================================
// UL LISTINGS
// ============================================================================

/**
 * Common UL Listings per NEC 110.3(B)
 *
 * @remarks
 * NEC 110.3(B) requires all equipment to be listed and installed per listing instructions
 */
export const UL_LISTINGS = {
  panel: [
    'UL 67 - Panelboards',
    'UL 891 - Switchboards',
    'UL 508A - Industrial Control Panels'
  ],
  transformer: [
    'UL 1561 - Dry-Type General Purpose and Power Transformers',
    'UL 1562 - Transformers, Distribution, Dry-Type (Over 600V)',
    'UL 1585 - Class 2 and Class 3 Transformers',
    'UL 506 - Specialty Transformers'
  ]
};

// ============================================================================
// STANDARD AIC RATINGS
// ============================================================================

/**
 * Standard Available Interrupting Current (AIC) Ratings in kA
 *
 * @remarks
 * Per NEC 110.9, equipment must have adequate interrupting rating for
 * the maximum available fault current at its line terminals.
 *
 * These are industry-standard AIC ratings. Actual equipment ratings vary.
 */
export const STANDARD_AIC_RATINGS = [10, 14, 22, 25, 42, 65, 100, 200]; // kA

// ============================================================================
// TRANSFORMER COOLING TYPES
// ============================================================================

export interface CoolingType {
  code: string;
  description: string;
}

/**
 * Transformer Cooling Types (ANSI/IEEE C57.12.00)
 */
export const TRANSFORMER_COOLING_TYPES: CoolingType[] = [
  { code: 'AA', description: 'Dry-Type Self-Cooled' },
  { code: 'AFA', description: 'Dry-Type Forced-Air Cooled' },
  { code: 'AA/FA', description: 'Dry-Type Self-Cooled/Forced-Air Cooled' },
  { code: 'OA', description: 'Liquid-Immersed Self-Cooled' },
  { code: 'FA', description: 'Liquid-Immersed Forced-Air Cooled' },
  { code: 'FOA', description: 'Liquid-Immersed Forced-Oil and Forced-Air Cooled' }
];

// ============================================================================
// TRANSFORMER TEMPERATURE RISE RATINGS
// ============================================================================

/**
 * Standard Transformer Temperature Rise Ratings (°C)
 *
 * @remarks
 * Per ANSI/IEEE C57.12.01 for dry-type transformers
 */
export const TRANSFORMER_TEMPERATURE_RISE = [80, 115, 150]; // °C

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Find panel models by manufacturer name
 *
 * @param manufacturerName - Manufacturer name (case-insensitive)
 * @returns Array of panel models or empty array if not found
 */
export function getPanelModels(manufacturerName: string): PanelModel[] {
  const manufacturer = PANEL_MANUFACTURERS.find(
    m => m.name.toLowerCase() === manufacturerName.toLowerCase()
  );
  return manufacturer?.models || [];
}

/**
 * Find specific panel model
 *
 * @param manufacturerName - Manufacturer name (case-insensitive)
 * @param modelName - Model designation (case-insensitive)
 * @returns Panel model or undefined if not found
 */
export function getPanelModel(
  manufacturerName: string,
  modelName: string
): PanelModel | undefined {
  const models = getPanelModels(manufacturerName);
  return models.find(m => m.model.toLowerCase() === modelName.toLowerCase());
}

/**
 * Get next standard AIC rating above required fault current
 *
 * @param faultCurrentKA - Calculated fault current in kA
 * @returns Next standard AIC rating, or 200 kA if exceeds max
 *
 * @example
 * getNextStandardAIC(38.5) // Returns 42
 * getNextStandardAIC(15.2) // Returns 22
 */
export function getNextStandardAIC(faultCurrentKA: number): number {
  const nextRating = STANDARD_AIC_RATINGS.find(rating => rating >= faultCurrentKA);
  return nextRating || 200; // If exceeds 200 kA, special equipment required
}

/**
 * Check if AIC rating is adequate for fault current
 *
 * @param aicRatingKA - Equipment AIC rating in kA
 * @param faultCurrentKA - Calculated fault current in kA
 * @returns True if AIC rating is adequate per NEC 110.9
 */
export function isAICAdequate(aicRatingKA: number, faultCurrentKA: number): boolean {
  return aicRatingKA >= faultCurrentKA;
}
