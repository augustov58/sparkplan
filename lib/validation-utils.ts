/**
 * Validation Utilities
 * Helper functions for form validation without full react-hook-form integration
 * Provides incremental validation for existing forms
 */

import { z } from 'zod';
import * as schemas from './validation-schemas';

export type ValidationResult = {
  success: boolean;
  errors: Record<string, string>;
};

/**
 * Validate data against a Zod schema and return user-friendly error messages
 */
export function validateForm<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): ValidationResult {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, errors: {} };
  }

  const errors: Record<string, string> = {};
  result.error.errors.forEach((err) => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });

  return { success: false, errors };
}

/**
 * Validate a single field value
 */
export function validateField(
  schemaType: 'panel' | 'circuit' | 'transformer' | 'project' | 'loadEntry' | 'conductorSizing',
  fieldName: string,
  value: unknown
): string | null {
  const schemaMap = {
    panel: schemas.panelSchema,
    circuit: schemas.circuitSchema,
    transformer: schemas.transformerSchema,
    project: schemas.projectSchema,
    loadEntry: schemas.loadEntrySchema,
    conductorSizing: schemas.conductorSizingSchema,
  };

  const schema = schemaMap[schemaType];
  if (!schema) return null;

  // Extract the field schema
  const fieldSchema = (schema as z.ZodObject<any>).shape[fieldName];
  if (!fieldSchema) return null;

  const result = fieldSchema.safeParse(value);
  if (result.success) return null;

  return result.error.errors[0]?.message || 'Invalid value';
}

/**
 * Validate panel form data
 */
export function validatePanelForm(data: {
  name: string;
  voltage: number;
  phase: number;
  bus_rating: number;
  main_breaker_amps?: number | null;
  location?: string | null;
}): ValidationResult {
  return validateForm(schemas.panelSchema, data);
}

/**
 * Validate circuit form data
 */
export function validateCircuitForm(data: {
  circuit_number: number;
  description: string;
  breaker_amps: number;
  pole: number;
  load_watts?: number;
  conductor_size?: string | null;
  egc_size?: string | null;
}): ValidationResult {
  return validateForm(schemas.circuitSchema, data);
}

/**
 * Validate transformer form data
 */
export function validateTransformerForm(data: {
  name: string;
  kva_rating: number;
  primary_voltage: number;
  secondary_voltage: number;
  primary_phase: number;
  secondary_phase: number;
  connection_type?: string | null;
  impedance_percent?: number | null;
}): ValidationResult {
  return validateForm(schemas.transformerSchema, data);
}

/**
 * Validate project form data
 */
export function validateProjectForm(data: {
  name: string;
  type: string;
  address: string;
  serviceVoltage: number;
  servicePhase: number;
}): ValidationResult {
  return validateForm(schemas.projectSchema, data);
}

/**
 * Validate feeder form data
 */
export function validateFeederForm(data: {
  name: string;
  source_panel_id: string | null;
  destination_panel_id?: string | null;
  destination_transformer_id?: string | null;
  distance_ft: number;
  conductor_material: string;
  conduit_type?: string;
  ambient_temperature_c?: number;
  num_current_carrying?: number;
}): ValidationResult {
  return validateForm(schemas.feederSchema, data);
}

/**
 * Display validation errors in a user-friendly alert
 */
export function showValidationErrors(errors: Record<string, string>): void {
  const errorMessages = Object.entries(errors)
    .map(([field, message]) => `• ${formatFieldName(field)}: ${message}`)
    .join('\n');

  alert(`Please fix the following errors:\n\n${errorMessages}`);
}

/**
 * Format field names for display
 */
function formatFieldName(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Check if a value is a standard NEC voltage
 */
export function isStandardVoltage(voltage: number): boolean {
  return [120, 208, 240, 277, 480, 600].includes(voltage);
}

/**
 * Check if a value is a standard breaker size (NEC 240.6(A))
 */
export function isStandardBreakerSize(amps: number): boolean {
  return [
    15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175,
    200, 225, 250, 300, 350, 400, 450, 500, 600, 700, 800, 1000, 1200, 1600,
    2000, 2500, 3000, 4000, 5000
  ].includes(amps);
}

/**
 * Get closest standard breaker size (rounds up)
 */
export function getStandardBreakerSize(amps: number): number {
  const standardSizes = [
    15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175,
    200, 225, 250, 300, 350, 400, 450, 500, 600, 700, 800, 1000, 1200, 1600,
    2000, 2500, 3000, 4000, 5000
  ];

  for (const size of standardSizes) {
    if (size >= amps) return size;
  }

  return standardSizes[standardSizes.length - 1];
}

/**
 * Get standard bus ratings for panels
 */
export function getStandardBusRatings(): number[] {
  return [100, 125, 150, 200, 225, 400, 600, 800, 1000, 1200, 1600, 2000, 2500, 3000, 4000, 5000];
}

/**
 * Get standard transformer kVA ratings
 */
export function getStandardTransformerSizes(): number[] {
  return [15, 25, 37.5, 45, 50, 75, 100, 112.5, 150, 225, 300, 500, 750, 1000, 1500, 2000, 2500, 3000];
}
