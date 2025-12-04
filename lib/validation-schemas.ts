/**
 * Zod Validation Schemas for NEC Compliance Forms
 * Centralized validation logic to ensure data integrity
 */

import { z } from 'zod';

// ============================================
// Project Schemas
// ============================================

export const projectSchema = z.object({
  name: z.string()
    .min(1, 'Project name is required')
    .max(100, 'Project name must be less than 100 characters'),

  type: z.enum(['Residential', 'Commercial', 'Industrial'], {
    errorMap: () => ({ message: 'Please select a valid project type' })
  }),

  address: z.string()
    .min(1, 'Project address is required')
    .max(200, 'Address must be less than 200 characters'),

  serviceVoltage: z.number()
    .int('Voltage must be a whole number')
    .positive('Voltage must be positive')
    .refine(
      (val) => [120, 208, 240, 277, 480, 600].includes(val),
      'Voltage must be a standard NEC value (120, 208, 240, 277, 480, 600)'
    ),

  servicePhase: z.number()
    .int('Phase must be a whole number')
    .refine(
      (val) => val === 1 || val === 3,
      'Phase must be 1 (single-phase) or 3 (three-phase)'
    ),
});

export type ProjectFormData = z.infer<typeof projectSchema>;

// ============================================
// Panel Schemas
// ============================================

export const panelSchema = z.object({
  name: z.string()
    .min(1, 'Panel name is required')
    .max(50, 'Panel name must be less than 50 characters')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Panel name can only contain letters, numbers, spaces, hyphens, and underscores'),

  voltage: z.number()
    .int('Voltage must be a whole number')
    .positive('Voltage must be positive')
    .refine(
      (val) => [120, 208, 240, 277, 480, 600].includes(val),
      'Voltage must be a standard NEC value (120, 208, 240, 277, 480, 600)'
    ),

  phase: z.number()
    .int('Phase must be a whole number')
    .refine(
      (val) => val === 1 || val === 3,
      'Phase must be 1 (single-phase) or 3 (three-phase)'
    ),

  bus_rating: z.number()
    .int('Bus rating must be a whole number')
    .positive('Bus rating must be positive')
    .min(100, 'Bus rating must be at least 100A')
    .max(5000, 'Bus rating must be less than 5000A')
    .refine(
      (val) => [100, 125, 150, 200, 225, 400, 600, 800, 1000, 1200, 1600, 2000, 2500, 3000, 4000, 5000].includes(val),
      'Bus rating must be a standard size (100A, 125A, 150A, 200A, 225A, 400A, 600A, 800A, 1000A, 1200A, 1600A, 2000A, 2500A, 3000A, 4000A, 5000A)'
    ),

  main_breaker_amps: z.number()
    .int('Main breaker must be a whole number')
    .positive('Main breaker must be positive')
    .max(5000, 'Main breaker must be less than 5000A')
    .nullable()
    .optional()
    .refine(
      (val) => val === null || val === undefined ||
        [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400, 450, 500, 600, 700, 800, 1000, 1200, 1600, 2000, 2500, 3000, 4000, 5000].includes(val),
      'Main breaker must be a standard NEC size (NEC 240.6(A))'
    ),

  location: z.string()
    .max(100, 'Location must be less than 100 characters')
    .optional()
    .nullable(),

  fed_from_type: z.enum(['service', 'panel', 'transformer'])
    .optional()
    .nullable(),

  is_main: z.boolean()
    .optional()
    .default(false),
});

export type PanelFormData = z.infer<typeof panelSchema>;

// ============================================
// Circuit Schemas
// ============================================

export const circuitSchema = z.object({
  circuit_number: z.number()
    .int('Circuit number must be a whole number')
    .positive('Circuit number must be positive')
    .min(1, 'Circuit number must be at least 1')
    .max(84, 'Circuit number must be less than 84 (max 42 spaces)'),

  description: z.string()
    .min(1, 'Description is required')
    .max(100, 'Description must be less than 100 characters'),

  breaker_amps: z.number()
    .int('Breaker size must be a whole number')
    .positive('Breaker size must be positive')
    .refine(
      (val) => [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400, 450, 500, 600, 700, 800, 1000, 1200].includes(val),
      'Breaker size must be a standard NEC size (NEC 240.6(A))'
    ),

  pole: z.number()
    .int('Pole must be a whole number')
    .refine(
      (val) => val === 1 || val === 2 || val === 3,
      'Pole must be 1, 2, or 3'
    ),

  load_watts: z.number()
    .nonnegative('Load must be non-negative')
    .max(1000000, 'Load must be less than 1,000,000 VA')
    .optional()
    .default(0),

  conductor_size: z.string()
    .regex(/^(\d+|#\d+|\d+\/\d+)\s*(AWG|MCM|KCMIL)?$/i, 'Invalid conductor size format (e.g., "12 AWG", "250 KCMIL")')
    .optional()
    .nullable(),

  egc_size: z.string()
    .regex(/^(\d+|#\d+|\d+\/\d+)\s*(AWG|MCM|KCMIL)?$/i, 'Invalid EGC size format (e.g., "12 AWG")')
    .optional()
    .nullable(),
});

export type CircuitFormData = z.infer<typeof circuitSchema>;

// ============================================
// Transformer Schemas
// ============================================

export const transformerSchema = z.object({
  name: z.string()
    .min(1, 'Transformer name is required')
    .max(50, 'Transformer name must be less than 50 characters'),

  kva_rating: z.number()
    .positive('kVA rating must be positive')
    .refine(
      (val) => [15, 25, 37.5, 45, 50, 75, 100, 112.5, 150, 225, 300, 500, 750, 1000, 1500, 2000, 2500, 3000].includes(val),
      'kVA rating must be a standard size (15, 25, 37.5, 45, 50, 75, 100, 112.5, 150, 225, 300, 500, 750, 1000, 1500, 2000, 2500, 3000)'
    ),

  primary_voltage: z.number()
    .int('Primary voltage must be a whole number')
    .positive('Primary voltage must be positive')
    .refine(
      (val) => [120, 208, 240, 277, 480, 600].includes(val),
      'Primary voltage must be a standard NEC value'
    ),

  secondary_voltage: z.number()
    .int('Secondary voltage must be a whole number')
    .positive('Secondary voltage must be positive')
    .refine(
      (val) => [120, 208, 240, 277, 480, 600].includes(val),
      'Secondary voltage must be a standard NEC value'
    ),

  primary_phase: z.number()
    .int('Primary phase must be a whole number')
    .refine(
      (val) => val === 1 || val === 3,
      'Primary phase must be 1 or 3'
    ),

  secondary_phase: z.number()
    .int('Secondary phase must be a whole number')
    .refine(
      (val) => val === 1 || val === 3,
      'Secondary phase must be 1 or 3'
    ),

  connection_type: z.enum(['delta-wye', 'wye-wye', 'delta-delta'])
    .optional()
    .nullable(),

  impedance_percent: z.number()
    .positive('Impedance must be positive')
    .max(10, 'Impedance must be less than 10%')
    .optional()
    .nullable(),
});

export type TransformerFormData = z.infer<typeof transformerSchema>;

// ============================================
// Load Entry Schemas
// ============================================

export const loadEntrySchema = z.object({
  description: z.string()
    .min(1, 'Load description is required')
    .max(100, 'Description must be less than 100 characters'),

  load_va: z.number()
    .positive('Load must be positive')
    .max(10000000, 'Load must be less than 10,000,000 VA'),

  continuous: z.boolean()
    .optional()
    .default(false),

  occupancy_type: z.enum([
    'dwelling',
    'hotel',
    'warehouse',
    'office',
    'retail'
  ]).optional().nullable(),

  quantity: z.number()
    .int('Quantity must be a whole number')
    .positive('Quantity must be positive')
    .optional()
    .default(1),
});

export type LoadEntryFormData = z.infer<typeof loadEntrySchema>;

// ============================================
// Conductor Sizing Schemas
// ============================================

export const conductorSizingSchema = z.object({
  loadAmps: z.number()
    .positive('Load current must be positive')
    .max(10000, 'Load current must be less than 10,000A'),

  continuous: z.boolean()
    .optional()
    .default(false),

  conductorMaterial: z.enum(['copper', 'aluminum']),

  insulationTemp: z.enum(['60', '75', '90'])
    .transform((val) => Number(val)),

  ambientTemp: z.number()
    .int('Ambient temperature must be a whole number')
    .min(10, 'Ambient temperature must be at least 10°C')
    .max(80, 'Ambient temperature must be less than 80°C')
    .optional()
    .default(30),

  numConductors: z.number()
    .int('Number of conductors must be a whole number')
    .positive('Number of conductors must be positive')
    .max(50, 'Number of conductors must be less than 50')
    .optional()
    .default(3),

  voltage: z.number()
    .positive('Voltage must be positive')
    .refine(
      (val) => [120, 208, 240, 277, 480, 600].includes(val),
      'Voltage must be a standard NEC value'
    )
    .optional(),

  distance: z.number()
    .positive('Distance must be positive')
    .max(10000, 'Distance must be less than 10,000 feet')
    .optional(),

  maxVoltageDrop: z.number()
    .positive('Voltage drop must be positive')
    .max(10, 'Voltage drop must be less than 10%')
    .optional()
    .default(3),
});

export type ConductorSizingFormData = z.infer<typeof conductorSizingSchema>;
