/**
 * Utility Interconnection Form Types
 *
 * Supports auto-generation of interconnection applications for:
 * - PG&E (Pacific Gas & Electric) - Rule 21 Form 79-1174-03
 * - SCE (Southern California Edison) - Rule 21 Fast Track
 * - SDG&E (San Diego Gas & Electric) - Interconnection Request
 */

export type UtilityProvider = 'PG&E' | 'SCE' | 'SDG&E' | 'Other';

export type InterconnectionType =
  | 'net_metering'              // Solar PV with export
  | 'ev_charging_only'          // EV chargers without export
  | 'ev_v2g'                    // Vehicle-to-Grid (bidirectional)
  | 'energy_storage'            // Battery storage
  | 'hybrid';                   // Multiple technologies

export type ServiceType = 'residential' | 'commercial' | 'industrial';

export interface ApplicantInfo {
  // Primary Contact
  companyName?: string;          // For commercial/industrial
  contactName: string;
  title?: string;
  phone: string;
  email: string;

  // Site Information
  siteAddress: string;
  city: string;
  state: string;
  zip: string;
  parcelNumber?: string;         // APN (Assessor's Parcel Number)

  // Utility Account
  utilityAccountNumber?: string;
  meterNumber?: string;

  // Contractor Information (if different from applicant)
  contractorName?: string;
  contractorLicense?: string;
  contractorPhone?: string;
  contractorEmail?: string;
}

export interface SystemSpecifications {
  // System Type
  interconnectionType: InterconnectionType;
  serviceType: ServiceType;

  // Electrical Specifications
  systemSizeKw: number;           // Total system size in kW
  inverterSizeKw?: number;        // For solar/storage systems
  numberOfChargers?: number;      // For EV systems
  chargerPowerKw?: number;        // Per-charger power rating

  // Grid Connection
  voltage: number;                // Service voltage (e.g., 240V, 480V)
  phase: 1 | 3;                   // Single-phase or three-phase
  existingServiceAmps: number;    // Existing service size
  proposedServiceAmps?: number;   // If service upgrade required

  // Export Capability
  willExportPower: boolean;       // Does system export to grid?
  maxExportKw?: number;           // Maximum export power

  // Equipment Details
  equipmentManufacturer?: string;
  equipmentModel?: string;
  inverterManufacturer?: string;
  inverterModel?: string;
}

export interface EngineeringDocuments {
  // Required Documents (checklist)
  singleLineDiagram: boolean;
  threeLineDiagram: boolean;
  sitePhotos: boolean;
  equipmentSpecs: boolean;
  loadCalculation: boolean;
  shortCircuitStudy: boolean;

  // Optional Documents
  utilityBillCopy: boolean;
  propertyDeed: boolean;
  hoaApproval: boolean;

  // File attachments (for future implementation)
  attachedFiles?: File[];
}

export interface UtilityInterconnectionForm {
  id?: string;
  project_id: string;
  created_at?: string;

  // Utility Selection
  utilityProvider: UtilityProvider;
  serviceTerritory?: string;      // e.g., "San Francisco", "Los Angeles"

  // Applicant Information
  applicant: ApplicantInfo;

  // System Specifications
  system: SystemSpecifications;

  // Engineering Documents
  documents: EngineeringDocuments;

  // Application Status
  applicationNumber?: string;     // Assigned by utility after submission
  submittedDate?: string;
  approvalDate?: string;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected';

  // Notes
  notes?: string;
  utilityComments?: string;
}

// Utility-specific form field requirements
export interface UtilityFormRequirements {
  utility: UtilityProvider;

  // Required Fields
  requiresParcelNumber: boolean;
  requiresContractorLicense: boolean;
  requiresUtilityAccountNumber: boolean;

  // Engineering Study Requirements
  requiresShortCircuitStudy: boolean;  // For systems >10kW
  requiresLoadFlowStudy: boolean;      // For systems >500kW
  requiresProtectionStudy: boolean;    // For export systems

  // Fees
  applicationFee: number;
  studyDeposit?: number;

  // Submission Details
  submissionEmail?: string;
  submissionAddress?: string;
  processingTimeDays: number;         // Estimated processing time

  // Helpful Links
  formUrl?: string;
  guideUrl?: string;
  faqUrl?: string;
}

// Utility-specific requirements database
export const UTILITY_REQUIREMENTS: Record<UtilityProvider, UtilityFormRequirements> = {
  'PG&E': {
    utility: 'PG&E',
    requiresParcelNumber: true,
    requiresContractorLicense: true,
    requiresUtilityAccountNumber: true,
    requiresShortCircuitStudy: true,
    requiresLoadFlowStudy: true,
    requiresProtectionStudy: true,
    applicationFee: 800,
    studyDeposit: 1000,
    submissionEmail: 'generatorinterconnection@pge.com',
    submissionAddress: 'PG&E, Generator Interconnection, 245 Market St, San Francisco, CA 94177',
    processingTimeDays: 30,
    formUrl: 'https://www.pge.com/tariffs/assets/pdf/tariffbook/ELEC_FORMS_79-1174-03.pdf',
    guideUrl: 'https://www.pge.com/assets/pge/docs/about/doing-business-with-pge/distribution-interconnection-handbook.pdf',
    faqUrl: 'https://www.cpuc.ca.gov/Rule21/'
  },
  'SCE': {
    utility: 'SCE',
    requiresParcelNumber: true,
    requiresContractorLicense: true,
    requiresUtilityAccountNumber: true,
    requiresShortCircuitStudy: true,
    requiresLoadFlowStudy: true,
    requiresProtectionStudy: true,
    applicationFee: 800,
    studyDeposit: 1000,
    submissionEmail: 'Rule21@sce.com',
    submissionAddress: 'Grid Interconnection & Contract Development, Southern California Edison, 2244 Walnut Grove Ave, Rosemead, CA 91770',
    processingTimeDays: 30,
    formUrl: 'https://www.sce.com/clean-energy-efficiency/solar-generating-your-own-power/solar-power-basics/grid-interconnections',
    guideUrl: 'https://www.sce.com/business/generating-your-own-power/Grid-Interconnections/Interconnecting-Generation-under-Rule-21',
    faqUrl: 'https://www.cpuc.ca.gov/Rule21/'
  },
  'SDG&E': {
    utility: 'SDG&E',
    requiresParcelNumber: true,
    requiresContractorLicense: true,
    requiresUtilityAccountNumber: true,
    requiresShortCircuitStudy: true,
    requiresLoadFlowStudy: true,
    requiresProtectionStudy: true,
    applicationFee: 800,
    studyDeposit: 1000,
    submissionEmail: 'CustomerGeneration@sdge.com',
    submissionAddress: 'Customer Generation, San Diego Gas & Electric Company, 8316 Century Park Ct, CP52F, San Diego, CA 92123',
    processingTimeDays: 30,
    formUrl: 'https://www.sdge.com/more-information/customer-generation/electric-rule-21',
    guideUrl: 'https://www.sdge.com/sites/default/files/documents/DistributionInterconnectionHandbook.pdf',
    faqUrl: 'https://www.cpuc.ca.gov/Rule21/'
  },
  'Other': {
    utility: 'Other',
    requiresParcelNumber: false,
    requiresContractorLicense: false,
    requiresUtilityAccountNumber: false,
    requiresShortCircuitStudy: false,
    requiresLoadFlowStudy: false,
    requiresProtectionStudy: false,
    applicationFee: 0,
    processingTimeDays: 30
  }
};
