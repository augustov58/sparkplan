/**
 * Form Validation Schemas
 * Zod schemas for all forms in the application
 */

import { z } from 'zod';
import { ProjectType, ProjectStatus } from '../types';

/**
 * Project Setup Validation
 */
export const projectSetupSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Name too long'),
  address: z.string().min(1, 'Address is required').max(200, 'Address too long'),
  type: z.nativeEnum(ProjectType),
  necEdition: z.enum(['2023', '2020']),
  settings: z.object({
    serviceVoltage: z.number().int().positive('Voltage must be positive'),
    servicePhase: z.union([z.literal(1), z.literal(3)]),
    conductorMaterial: z.enum(['Cu', 'Al']),
    temperatureRating: z.union([z.literal(60), z.literal(75), z.literal(90)]),
    permitNumber: z.string().max(50, 'Permit number too long').optional(),
    utilityProvider: z.string().max(100, 'Utility provider name too long').optional(),
  }),
});

export type ProjectSetupFormData = z.infer<typeof projectSetupSchema>;

/**
 * Load Item Validation
 */
export const loadItemSchema = z.object({
  description: z.string().min(1, 'Description is required').max(100, 'Description too long'),
  watts: z.number()
    .min(0, 'Watts cannot be negative')
    .max(1000000, 'Watts value too large')
    .refine((val) => val > 0, 'Watts must be greater than zero'),
  quantity: z.number()
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1')
    .max(10000, 'Quantity too large'),
  continuous: z.boolean(),
  loadType: z.enum([
    'Lighting',
    'Receptacle',
    'Appliance',
    'HVAC',
    'Motor',
    'Range',
    'Dryer',
    'WaterHeater',
    'EV',
    'Other'
  ]).optional(),
  phase: z.union([z.literal(1), z.literal(3)]).optional(),
});

export type LoadItemFormData = z.infer<typeof loadItemSchema>;

/**
 * Circuit Validation
 */
export const circuitSchema = z.object({
  name: z.string().min(1, 'Circuit name is required').max(50, 'Name too long'),
  breaker: z.number()
    .int('Breaker size must be a whole number')
    .min(15, 'Minimum breaker size is 15A')
    .max(1200, 'Breaker size too large'),
  conductor: z.string().min(1, 'Conductor size is required'),
  conduit: z.string().min(1, 'Conduit type is required'),
  distance: z.number()
    .min(0, 'Distance cannot be negative')
    .max(10000, 'Distance too large (max 10,000 ft)'),
  load: z.number()
    .min(0, 'Load cannot be negative')
    .max(1000000, 'Load too large'),
  voltage: z.number()
    .int('Voltage must be a whole number')
    .positive('Voltage must be positive'),
  phase: z.union([z.literal(1), z.literal(3)]),
});

export type CircuitFormData = z.infer<typeof circuitSchema>;

/**
 * Voltage Drop Calculator Validation
 */
export const voltageDropSchema = z.object({
  voltage: z.number()
    .int('Voltage must be a whole number')
    .positive('Voltage must be positive')
    .refine((val) => [120, 208, 240, 277, 480].includes(val),
      'Voltage must be a standard value (120, 208, 240, 277, or 480V)'),
  phase: z.union([z.literal(1), z.literal(3)]),
  current: z.number()
    .min(0.1, 'Current must be at least 0.1A')
    .max(10000, 'Current too large'),
  distance: z.number()
    .min(1, 'Distance must be at least 1 foot')
    .max(10000, 'Distance too large (max 10,000 ft)'),
  conductorSize: z.string().min(1, 'Conductor size is required'),
  material: z.enum(['Cu', 'Al']),
});

export type VoltageDropFormData = z.infer<typeof voltageDropSchema>;

/**
 * Conduit Fill Calculator Validation
 */
export const conduitFillSchema = z.object({
  conduitType: z.enum(['EMT', 'PVC Schedule 40', 'PVC Schedule 80', 'RMC']),
  conduitSize: z.enum(['1/2', '3/4', '1', '1-1/4', '1-1/2', '2', '2-1/2', '3', '3-1/2', '4']),
  wireSize: z.string().min(1, 'Wire size is required'),
  wireCount: z.number()
    .int('Wire count must be a whole number')
    .min(1, 'Must have at least 1 wire')
    .max(100, 'Wire count too large (max 100)'),
});

export type ConduitFillFormData = z.infer<typeof conduitFillSchema>;

/**
 * Grounding Electrode Conductor Validation
 */
export const groundingSchema = z.object({
  electrodeType: z.string().min(1, 'Electrode type is required').max(50),
  gecSize: z.string().min(1, 'GEC size is required'),
  notes: z.string().max(500, 'Notes too long').optional(),
});

export type GroundingFormData = z.infer<typeof groundingSchema>;

/**
 * Authentication Validation
 */
export const loginSchema = z.object({
  email: z.string()
    .min(1, 'Email is required')
    .email('Invalid email address')
    .max(255, 'Email too long'),
  password: z.string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password too long'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  email: z.string()
    .min(1, 'Email is required')
    .email('Invalid email address')
    .max(255, 'Email too long'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export type SignupFormData = z.infer<typeof signupSchema>;

/**
 * Inspection Item Validation
 */
export const inspectionItemSchema = z.object({
  category: z.string().min(1, 'Category is required').max(50),
  item: z.string().min(1, 'Item is required').max(200),
  reference: z.string().max(50, 'Reference too long').optional(),
  checked: z.boolean(),
  notes: z.string().max(500, 'Notes too long').optional(),
});

export type InspectionItemFormData = z.infer<typeof inspectionItemSchema>;

/**
 * NEC Issue Validation
 */
export const necIssueSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
  description: z.string().min(1, 'Description is required').max(500, 'Description too long'),
  reference: z.string().max(50, 'Reference too long').optional(),
  severity: z.enum(['Critical', 'Warning', 'Info']),
  status: z.enum(['Open', 'In Progress', 'Resolved']),
  resolution: z.string().max(500, 'Resolution too long').optional(),
});

export type NecIssueFormData = z.infer<typeof necIssueSchema>;
