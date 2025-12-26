/**
 * Utility Interconnection Form Auto-Population Service
 *
 * Automatically populates interconnection application forms from project data:
 * - Service entrance details (voltage, amperage, phase)
 * - Circuit information (EV chargers, solar inverters)
 * - Load calculations
 * - Short circuit calculations
 */

import type { Project, Panel, Circuit, Transformer } from '@/types';
import type { ShortCircuitCalculation } from '@/types';
import type {
  UtilityInterconnectionForm,
  SystemSpecifications,
  InterconnectionType,
  ServiceType,
  UtilityProvider
} from '@/types/utilityInterconnection';

interface ProjectData {
  project: Project;
  panels: Panel[];
  circuits: Circuit[];
  transformers: Transformer[];
  shortCircuitCalc?: ShortCircuitCalculation;
}

/**
 * Automatically populate utility interconnection form from project data
 */
export function autoPopulateInterconnectionForm(
  projectData: ProjectData,
  utilityProvider: UtilityProvider
): Partial<UtilityInterconnectionForm> {
  const { project, panels, circuits, shortCircuitCalc } = projectData;

  // Determine service type
  const serviceType: ServiceType =
    project.type === 'residential' ? 'residential' :
    project.type === 'commercial' ? 'commercial' :
    'industrial';

  // Determine interconnection type based on circuits
  const interconnectionType = determineInterconnectionType(circuits);

  // Calculate system size from circuits
  const systemSize = calculateSystemSize(circuits);

  // Get service entrance parameters
  const serviceVoltage = project.serviceVoltage || 240;
  const servicePhase = project.servicePhase || 1;
  const serviceAmps = project.serviceSizeAmps || 200;

  // Pre-populate form
  const form: Partial<UtilityInterconnectionForm> = {
    project_id: project.id,
    utilityProvider,

    applicant: {
      contactName: '', // User must fill
      phone: '',
      email: '',
      siteAddress: project.address || '',
      city: project.city || '',
      state: project.state || 'CA',
      zip: project.zip || '',
      parcelNumber: project.parcelNumber || undefined,
      utilityAccountNumber: project.utilityAccountNumber || undefined
    },

    system: {
      interconnectionType,
      serviceType,
      systemSizeKw: systemSize.totalKw,
      numberOfChargers: systemSize.evChargers,
      chargerPowerKw: systemSize.maxChargerKw,
      inverterSizeKw: systemSize.inverterKw,
      voltage: serviceVoltage,
      phase: servicePhase,
      existingServiceAmps: serviceAmps,
      willExportPower: interconnectionType !== 'ev_charging_only',
      maxExportKw: systemSize.totalKw,
      equipmentManufacturer: undefined, // User must fill
      equipmentModel: undefined
    },

    documents: {
      singleLineDiagram: false,
      threeLineDiagram: false,
      sitePhotos: false,
      equipmentSpecs: false,
      loadCalculation: !!project.totalLoadVA, // True if load calc exists
      shortCircuitStudy: !!shortCircuitCalc, // True if SCC exists
      utilityBillCopy: false,
      propertyDeed: false,
      hoaApproval: false
    },

    status: 'draft' as const
  };

  return form;
}

/**
 * Determine interconnection type based on circuits
 */
function determineInterconnectionType(circuits: Circuit[]): InterconnectionType {
  const hasEVChargers = circuits.some(c =>
    c.description?.toLowerCase().includes('ev') ||
    c.description?.toLowerCase().includes('charger')
  );

  const hasSolar = circuits.some(c =>
    c.description?.toLowerCase().includes('solar') ||
    c.description?.toLowerCase().includes('pv')
  );

  const hasStorage = circuits.some(c =>
    c.description?.toLowerCase().includes('battery') ||
    c.description?.toLowerCase().includes('storage')
  );

  const hasV2G = circuits.some(c =>
    c.description?.toLowerCase().includes('v2g') ||
    c.description?.toLowerCase().includes('vehicle-to-grid')
  );

  // Determine type
  if (hasV2G) return 'ev_v2g';
  if (hasSolar && hasStorage) return 'hybrid';
  if (hasStorage) return 'energy_storage';
  if (hasSolar) return 'net_metering';
  if (hasEVChargers) return 'ev_charging_only';

  return 'net_metering'; // Default
}

/**
 * Calculate total system size from circuits
 */
function calculateSystemSize(circuits: Circuit[]): {
  totalKw: number;
  evChargers: number;
  maxChargerKw: number;
  inverterKw: number;
} {
  let totalKw = 0;
  let evChargers = 0;
  let maxChargerKw = 0;
  let inverterKw = 0;

  circuits.forEach(circuit => {
    const description = (circuit.description || '').toLowerCase();
    const loadKw = (circuit.loadVA || 0) / 1000; // Convert VA to kW (rough estimate)

    // EV Chargers
    if (description.includes('ev') || description.includes('charger')) {
      evChargers++;
      maxChargerKw = Math.max(maxChargerKw, loadKw);
      totalKw += loadKw;
    }

    // Solar Inverters
    if (description.includes('solar') || description.includes('inverter') || description.includes('pv')) {
      inverterKw += loadKw;
      totalKw += loadKw;
    }

    // Battery Storage
    if (description.includes('battery') || description.includes('storage')) {
      totalKw += loadKw;
    }
  });

  return {
    totalKw: Math.round(totalKw * 10) / 10, // Round to 1 decimal
    evChargers,
    maxChargerKw: Math.round(maxChargerKw * 10) / 10,
    inverterKw: Math.round(inverterKw * 10) / 10
  };
}

/**
 * Validate interconnection form completeness
 */
export function validateInterconnectionForm(
  form: Partial<UtilityInterconnectionForm>
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required applicant fields
  if (!form.applicant?.contactName) errors.push('Contact name is required');
  if (!form.applicant?.phone) errors.push('Phone number is required');
  if (!form.applicant?.email) errors.push('Email is required');
  if (!form.applicant?.siteAddress) errors.push('Site address is required');
  if (!form.applicant?.city) errors.push('City is required');
  if (!form.applicant?.zip) errors.push('ZIP code is required');

  // Required system fields
  if (!form.system?.systemSizeKw || form.system.systemSizeKw <= 0) {
    errors.push('System size must be greater than 0 kW');
  }
  if (!form.system?.voltage) errors.push('System voltage is required');
  if (!form.system?.phase) errors.push('System phase is required');
  if (!form.system?.existingServiceAmps) errors.push('Existing service size is required');

  // Utility-specific requirements
  if (form.utilityProvider && form.utilityProvider !== 'Other') {
    if (!form.applicant?.parcelNumber) {
      errors.push(`Parcel number (APN) is required for ${form.utilityProvider}`);
    }
    if (!form.applicant?.utilityAccountNumber) {
      errors.push(`Utility account number is required for ${form.utilityProvider}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Calculate estimated application fees
 */
export function calculateApplicationFees(
  form: Partial<UtilityInterconnectionForm>
): { applicationFee: number; studyFee: number; totalFee: number } {
  const systemSizeKw = form.system?.systemSizeKw || 0;
  let applicationFee = 800; // Standard Rule 21 fee
  let studyFee = 0;

  // Small systems (<10kW) may have lower fees
  if (systemSizeKw < 10 && form.system?.interconnectionType === 'ev_charging_only') {
    applicationFee = 0; // EV charging-only may be exempt
  }

  // Larger systems require engineering studies
  if (systemSizeKw > 10 && systemSizeKw <= 100) {
    studyFee = 1000; // Initial study deposit
  } else if (systemSizeKw > 100) {
    studyFee = 2500; // Detailed study required
  }

  return {
    applicationFee,
    studyFee,
    totalFee: applicationFee + studyFee
  };
}
