/**
 * Zod Validation Schemas for NEC Compliance Forms
 * Centralized validation logic to ensure data integrity
 */

import { z } from 'zod';

// ============================================
// Support Ticket Schemas
// ============================================

export const supportTicketSchema = z.object({
  category: z.enum(['bug', 'question', 'feedback', 'feature_request'], {
    errorMap: () => ({ message: 'Please select a category' }),
  }),

  subject: z.string()
    .min(1, 'Subject is required')
    .max(200, 'Subject must be less than 200 characters'),

  message: z.string()
    .min(10, 'Please provide more detail (at least 10 characters)')
    .max(5000, 'Message must be less than 5,000 characters'),
});

export type SupportTicketFormData = z.infer<typeof supportTicketSchema>;

// ============================================
// Permit-Submittal Metadata Schemas (C3 — advisory)
// ============================================
// These schemas describe what AHJ-acceptable values look like for a permit
// submittal. They are ADVISORY — callers run safeParse and surface friendly
// warnings, but do NOT hard-block. A contractor may legitimately want to print
// a draft packet with "TBD" for a pre-application AHJ meeting.

const PLACEHOLDER_VALUES = ['tbd', 'test', 'n/a', 'na', 'tba', 'todo', 'xxx', 'unknown'];

/**
 * Project address — single free-text field validated for plausibility.
 *
 * The current data model uses one free-text column (`projects.address`); this
 * schema rejects obvious placeholders and requires at least one digit so a
 * street number (or ZIP) is present, without forcing a strict address parser.
 */
export const projectAddressSchema = z.string()
  .min(8, 'Address must include street, city, state, and ZIP')
  .max(200, 'Address must be less than 200 characters')
  .refine(
    (val) => !PLACEHOLDER_VALUES.includes(val.trim().toLowerCase()),
    'Address cannot be a placeholder (e.g., "TBD", "test")'
  )
  .refine(
    (val) => /\d/.test(val),
    'Address must include a street number or ZIP code'
  );

/**
 * Florida Electrical Contractor license — `EC#######` (Certified) or `ER#######`
 * (Registered) per FL DBPR. Case-insensitive accept; AHJ submittals normalize
 * to uppercase.
 */
export const flContractorLicenseSchema = z.string()
  .min(1, 'Contractor license is required')
  .regex(/^E[CR]\d{7}$/i, 'Format: EC####### or ER####### (FL DBPR)')
  .refine(
    (val) => !PLACEHOLDER_VALUES.includes(val.trim().toLowerCase()),
    'License cannot be a placeholder'
  );

/**
 * Permit number — optional (the AHJ assigns it), but if provided must be ≥ 4
 * chars and not a placeholder. Empty / undefined / null all accepted.
 */
export const permitNumberSchema = z.string()
  .optional()
  .nullable()
  .refine(
    (val) => !val || val.trim().length === 0 || val.trim().length >= 4,
    'Permit number must be at least 4 characters if provided'
  )
  .refine(
    (val) => !val || !PLACEHOLDER_VALUES.includes(val.trim().toLowerCase()),
    'Permit number cannot be a placeholder (e.g., "test")'
  );

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

  // Permissive — placeholders ("TBD", drafts) are allowed at form level.
  // For AHJ-acceptability checking, see the advisory `projectAddressSchema`
  // export which callers can opt into for shape validation.
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

  fed_from_type: z.enum(['service', 'panel', 'transformer', 'meter_stack'])
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

// ============================================
// Feeder Schemas
// ============================================

export const feederSchema = z.object({
  name: z.string()
    .min(1, 'Feeder name is required')
    .max(50, 'Feeder name must be less than 50 characters'),

  source_panel_id: z.string()
    .min(1, 'Source panel is required')
    .uuid('Invalid source panel ID'),

  destination_panel_id: z.string()
    .uuid('Invalid destination panel ID')
    .nullable()
    .optional(),

  destination_transformer_id: z.string()
    .uuid('Invalid destination transformer ID')
    .nullable()
    .optional(),

  distance_ft: z.number()
    .positive('Distance must be positive')
    .max(10000, 'Distance must be less than 10,000 feet'),

  conductor_material: z.enum(['Cu', 'Al'], {
    errorMap: () => ({ message: 'Conductor material must be Cu (Copper) or Al (Aluminum)' })
  }),

  conduit_type: z.enum(['EMT', 'PVC', 'IMC', 'RMC'], {
    errorMap: () => ({ message: 'Invalid conduit type' })
  }).optional().default('PVC'),

  ambient_temperature_c: z.number()
    .int('Temperature must be a whole number')
    .min(10, 'Ambient temperature must be at least 10°C')
    .max(80, 'Ambient temperature must be less than 80°C')
    .optional()
    .default(30),

  num_current_carrying: z.number()
    .int('Number of conductors must be a whole number')
    .positive('Number of conductors must be positive')
    .max(50, 'Number of conductors must be less than 50')
    .optional()
    .default(4),
}).refine(
  (data) => data.destination_panel_id || data.destination_transformer_id,
  { message: 'Either destination panel or transformer must be selected' }
);

export type FeederFormData = z.infer<typeof feederSchema>;

// ============================================
// T&M Billing — Phase 1a (advisory; never hard-block drafts)
// ============================================
// Per CLAUDE.md "validation advisory not blocking": these schemas constrain
// form input shape but downstream save logic should treat parse failures as
// warnings, not gates, when the user is saving an explicit draft.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Time entry form schema. Hours capped at 24 (single-day max). Rates non-negative.
 * `cost_rate` left optional — small shops may not track payroll cost in v1.
 */
export const timeEntrySchema = z.object({
  worker_name: z.string()
    .min(1, 'Worker name is required')
    .max(120, 'Worker name must be less than 120 characters'),

  work_date: z.string()
    .regex(ISO_DATE, 'Date must be YYYY-MM-DD'),

  hours: z.number()
    .positive('Hours must be greater than 0')
    .max(24, 'Hours cannot exceed 24 per entry'),

  description: z.string().max(500, 'Description must be under 500 characters').optional().nullable(),

  cost_code: z.string().max(50, 'Cost code must be under 50 characters').optional().nullable(),

  billable_rate: z.number()
    .nonnegative('Billable rate cannot be negative')
    .max(10000, 'Billable rate must be under $10,000/hr'),

  cost_rate: z.number()
    .nonnegative('Cost rate cannot be negative')
    .max(10000, 'Cost rate must be under $10,000/hr')
    .optional()
    .nullable(),
});
export type TimeEntryFormData = z.infer<typeof timeEntrySchema>;

/**
 * Material entry form schema. Markup capped at 200% (sane upper bound; the
 * DB CHECK enforces the same range). Quantities and prices non-negative.
 */
export const materialEntrySchema = z.object({
  installed_date: z.string()
    .regex(ISO_DATE, 'Date must be YYYY-MM-DD'),

  description: z.string()
    .min(1, 'Description is required')
    .max(300, 'Description must be under 300 characters'),

  cost_code: z.string().max(50).optional().nullable(),

  quantity: z.number()
    .positive('Quantity must be greater than 0')
    .max(1_000_000, 'Quantity unrealistically large'),

  unit: z.string().max(20).optional().nullable(),

  invoice_unit_cost: z.number()
    .nonnegative('Invoice unit cost cannot be negative')
    .max(1_000_000, 'Invoice unit cost unrealistically large'),

  markup_pct: z.number()
    .min(0, 'Markup cannot be negative')
    .max(200, 'Markup cannot exceed 200%'),

  taxable: z.boolean(),

  supplier_name: z.string().max(200).optional().nullable(),
  supplier_invoice_number: z.string().max(100).optional().nullable(),
  receipt_url: z.string().max(2000).optional().nullable(),
});
export type MaterialEntryFormData = z.infer<typeof materialEntrySchema>;

/**
 * Project billing settings form schema (singleton per project).
 * All rate / markup / tax fields permissive — saving partial drafts allowed.
 */
export const projectBillingSettingsSchema = z.object({
  default_billable_rate: z.number().nonnegative().max(10000).optional().nullable(),
  default_cost_rate: z.number().nonnegative().max(10000).optional().nullable(),
  default_material_markup_pct: z.number().min(0).max(200),
  tax_pct: z.number().min(0).max(100),
  payment_terms_days: z.number().int().min(0).max(365),
  invoice_prefix: z.string().max(20).optional().nullable(),
  next_invoice_number: z.number().int().positive().max(999_999),
  customer_name: z.string().max(200).optional().nullable(),
  customer_email: z.string().email('Invalid email').max(200).or(z.literal('')).optional().nullable(),
  customer_address: z.string().max(500).optional().nullable(),
  customer_po_number: z.string().max(100).optional().nullable(),
});
export type ProjectBillingSettingsFormData = z.infer<typeof projectBillingSettingsSchema>;

// ============================================
// Permit Schemas (Phase 1 Permits Beta)
// ============================================
// Per the project's "validation is advisory, not blocking" preference,
// these schemas describe the AHJ-acceptable shape of a permit record but
// callers run safeParse and surface friendly warnings instead of hard
// blocking. Drafts with TBD fields must remain saveable.

export const PERMIT_STATUSES = [
  'draft',
  'submitted',
  'in_review',
  'returned',
  'approved',
  'expired',
  'closed',
  'cancelled',
] as const;

export const PERMIT_TYPES = [
  'electrical',
  'evse',
  'low_voltage',
  'service_upgrade',
  'other',
] as const;

export const INSPECTION_TYPES = [
  'rough_in',
  'underground',
  'service',
  'final',
  'temporary',
  'reinspection',
  'other',
] as const;

export const INSPECTION_STATUSES = [
  'scheduled',
  'passed',
  'failed',
  'conditional_pass',
  'cancelled',
  'no_show',
] as const;

export const permitSchema = z.object({
  project_id: z.string().uuid(),
  permit_number: z.string().max(64).optional().nullable(),
  permit_type: z.enum(PERMIT_TYPES),
  description: z.string().max(500).optional().nullable(),
  ahj_jurisdiction: z.string().min(1, 'AHJ jurisdiction is required').max(200),
  ahj_contact_name: z.string().max(200).optional().nullable(),
  ahj_contact_email: z
    .string()
    .email('Must be a valid email address')
    .optional()
    .nullable()
    .or(z.literal('')),
  ahj_contact_phone: z.string().max(40).optional().nullable(),
  status: z.enum(PERMIT_STATUSES),
  submitted_at: z.string().optional().nullable(),
  approved_at: z.string().optional().nullable(),
  expires_at: z.string().optional().nullable(),
  closed_at: z.string().optional().nullable(),
  fee_amount: z
    .number()
    .nonnegative('Fee must be non-negative')
    .max(1_000_000, 'Fee unrealistically large')
    .optional()
    .nullable(),
  fee_paid_at: z.string().optional().nullable(),
  fee_receipt_url: z.string().url().optional().nullable().or(z.literal('')),
  plan_review_id: z.string().max(64).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export type PermitFormData = z.infer<typeof permitSchema>;

export const permitInspectionSchema = z.object({
  permit_id: z.string().uuid(),
  inspection_type: z.enum(INSPECTION_TYPES),
  sequence: z.number().int().min(1).default(1),
  description: z.string().max(500).optional().nullable(),
  scheduled_date: z.string().optional().nullable(), // YYYY-MM-DD
  scheduled_window: z.string().max(40).optional().nullable(),
  inspector_name: z.string().max(200).optional().nullable(),
  status: z.enum(INSPECTION_STATUSES),
  performed_at: z.string().optional().nullable(),
  result_notes: z.string().max(5000).optional().nullable(),
  parent_inspection_id: z.string().uuid().optional().nullable(),
});

export type PermitInspectionFormData = z.infer<typeof permitInspectionSchema>;
