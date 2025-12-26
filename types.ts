
export enum ProjectType {
  RESIDENTIAL = 'Residential',
  COMMERCIAL = 'Commercial',
  INDUSTRIAL = 'Industrial',
}

/**
 * Dwelling Type for Residential Projects
 * Determines which NEC calculation method to use
 */
export enum DwellingType {
  SINGLE_FAMILY = 'single_family',      // NEC 220.82 - Optional Calculation
  MULTI_FAMILY = 'multi_family',        // NEC 220.84 - Multi-family Dwelling
}

/**
 * Residential Appliances for Dwelling Unit Load Calculation
 * Each appliance can be enabled/disabled with its kW rating
 */
export interface ResidentialAppliances {
  // Major appliances
  range?: { enabled: boolean; kw: number; type: 'electric' | 'gas' };
  dryer?: { enabled: boolean; kw: number; type: 'electric' | 'gas' };
  waterHeater?: { enabled: boolean; kw: number; type: 'electric' | 'gas' | 'tankless' };
  
  // HVAC - NEC 220.60 (non-coincident loads - use larger)
  hvac?: {
    enabled: boolean;
    type: 'ac_only' | 'heat_pump' | 'electric_heat' | 'gas_heat';
    coolingKw?: number;      // A/C load
    heatingKw?: number;      // Electric heat load (if applicable)
  };
  
  // Kitchen appliances
  dishwasher?: { enabled: boolean; kw: number };
  disposal?: { enabled: boolean; kw: number };
  microwave?: { enabled: boolean; kw: number };
  
  // Other fixed appliances
  evCharger?: { enabled: boolean; kw: number; level: 1 | 2 };
  poolPump?: { enabled: boolean; hp: number };
  poolHeater?: { enabled: boolean; kw: number };
  hotTub?: { enabled: boolean; kw: number };
  sauna?: { enabled: boolean; kw: number };
  wellPump?: { enabled: boolean; hp: number };
  
  // Custom/other appliances
  otherAppliances?: Array<{ description: string; kw: number }>;
}

/**
 * Dwelling Unit Template for Multi-Family Projects
 * Represents a "type" of unit (e.g., Studio, 1BR, 2BR)
 */
export interface DwellingUnitTemplate {
  id: string;
  name: string;                         // e.g., "Type A - Studio"
  squareFootage: number;
  unitCount: number;                    // How many of this type in the building
  appliances: ResidentialAppliances;
  
  // Calculated values
  calculatedLoadVA?: number;            // Per-unit demand load
  panelSize?: number;                   // Recommended panel size (30A, 60A, etc.)
  
  // Optional: template panel schedule for this unit type
  panelScheduleTemplate?: PanelCircuit[];
}

/**
 * Residential-specific project settings
 * Extends base ProjectSettings for dwelling unit calculations
 */
export interface ResidentialSettings {
  dwellingType: DwellingType;
  
  // Single-family specific
  squareFootage?: number;               // Heated area in sq ft
  numBedrooms?: number;
  numBathrooms?: number;
  appliances?: ResidentialAppliances;
  
  // Multi-family specific
  totalUnits?: number;                  // Total dwelling units in building
  unitTemplates?: DwellingUnitTemplate[];
  meteringType?: 'master' | 'individual' | 'submeter';
  
  // Standard circuit counts
  smallApplianceCircuits: number;       // Minimum 2 required (NEC 210.11(C)(1))
  laundryCircuit: boolean;              // Required (NEC 210.11(C)(2))
  bathroomCircuits: number;             // NEC 210.11(C)(3)
  garageCircuit: boolean;
  outdoorCircuit: boolean;
  
  // Service
  recommendedServiceAmps?: number;      // Calculated recommendation
  selectedServiceAmps?: 100 | 150 | 200 | 400;
}

export enum ProjectStatus {
  PLANNING = 'Planning',
  IN_PROGRESS = 'In Progress',
  REVIEW = 'Under Review',
  COMPLIANT = 'Compliant',
}

export interface LoadItem {
  id: string;
  description: string;
  watts: number;
  type: 'lighting' | 'receptacle' | 'motor' | 'hvac' | 'appliance' | 'range' | 'dryer' | 'water_heater';
  continuous: boolean;
  phase: 'A' | 'B' | 'C' | '3-Phase';
}

/**
 * Load Type Classification for NEC Article 220 Demand Factors
 * L = Lighting, M = Motor, R = Receptacles, O = Other
 * H = Heating, C = Cooling, W = Water Heater, D = Dryer, K = Kitchen
 */
export type LoadTypeCode = 'L' | 'M' | 'R' | 'O' | 'H' | 'C' | 'W' | 'D' | 'K';

export const LOAD_TYPE_LABELS: Record<LoadTypeCode, string> = {
  'L': 'Lighting',
  'M': 'Motor',
  'R': 'Receptacles',
  'O': 'Other',
  'H': 'Heating',
  'C': 'Cooling',
  'W': 'Water Heater',
  'D': 'Dryer',
  'K': 'Kitchen',
};

export interface PanelCircuit {
  id: string;
  circuitNumber: number;
  description: string;
  breakerAmps: number;
  pole: 1 | 2 | 3;
  loadWatts: number;
  conductorSize: string; // e.g., "12 AWG"
  loadType?: LoadTypeCode; // NEC 220 load classification
}

export interface NecIssue {
  id: string;
  article: string; // e.g., "210.8(A)"
  description: string;
  status: 'Open' | 'Resolved';
  severity: 'Critical' | 'Warning' | 'Info';
  location?: string;
  photoUrl?: string;
  assignedTo: string;
  createdAt: number;
}

export interface InspectionItem {
  id: string;
  category: string;
  requirement: string; // NEC reference text
  status: 'Pending' | 'Pass' | 'Fail' | 'N/A';
  notes?: string;
}

export interface GroundingDetail {
  electrodes: string[]; // e.g. ["Rod", "Concrete-Encased"]
  gecSize: string; // Grounding Electrode Conductor
  bonding: string[]; // e.g. ["Water", "Gas"]
  notes: string;
}

export interface ProjectSettings {
  serviceVoltage: number;
  servicePhase: 1 | 3;
  occupancyType: 'dwelling' | 'commercial' | 'industrial'; // Drives demand factor selection per NEC Article 220
  conductorMaterial: 'Cu' | 'Al';
  temperatureRating: 60 | 75 | 90;
  utilityProvider?: string;
  permitNumber?: string;
  
  // Residential-specific settings (only used when occupancyType === 'dwelling')
  residential?: ResidentialSettings;
}

export interface Project {
  id: string;
  name: string;
  address: string;
  type: ProjectType;
  necEdition: '2020' | '2023';
  status: ProjectStatus;
  progress: number;
  settings: ProjectSettings; // Consolidated technical settings
  loads: LoadItem[];
  circuits: PanelCircuit[];
  issues: NecIssue[];
  inspectionList: InspectionItem[];
  grounding: GroundingDetail;
  // Deprecated top-level properties kept for backward compatibility if needed,
  // but we prefer using settings object
  serviceVoltage: number;
  servicePhase: 1 | 3;
}

// ============================================================================
// FEEDER TYPES (NEC Article 215)
// ============================================================================

export interface Feeder {
  id: string;
  project_id: string;
  name: string;
  source_panel_id: string | null;
  destination_panel_id: string | null;
  destination_transformer_id: string | null;
  distance_ft: number;
  conductor_material: 'Cu' | 'Al';
  conduit_type?: string;
  ambient_temperature_c: number;
  num_current_carrying: number;

  // Calculated results (cached for display)
  total_load_va?: number;
  continuous_load_va?: number;
  noncontinuous_load_va?: number;
  design_load_va?: number;
  phase_conductor_size?: string;
  neutral_conductor_size?: string;
  egc_size?: string;
  conduit_size?: string;
  voltage_drop_percent?: number;

  created_at?: string;
  updated_at?: string;
}

export interface FeederCalculationInput {
  source_voltage: number;
  source_phase: number;
  destination_voltage: number;
  destination_phase: number;
  total_load_va: number;
  continuous_load_va: number;
  noncontinuous_load_va: number;
  distance_ft: number;
  conductor_material: 'Cu' | 'Al';
  ambient_temperature_c: number;
  num_current_carrying: number;
  max_voltage_drop_percent?: number;
  temperature_rating?: 60 | 75 | 90; // Conductor insulation temperature rating
  // Transformer-specific parameters (for feeders feeding transformers)
  transformer_kva?: number; // If feeding a transformer, use this for sizing per NEC 450.3(B)
  transformer_primary_voltage?: number;
  transformer_primary_phase?: 1 | 3;
}

export interface FeederCalculationResult {
  design_load_va: number;
  design_current_amps: number;
  phase_conductor_size: string;
  phase_conductor_ampacity: number;
  neutral_conductor_size: string;
  egc_size: string;
  recommended_conduit_size: string;
  voltage_drop_percent: number;
  voltage_drop_volts: number;
  meets_voltage_drop: boolean;
  warnings: string[];
  necReferences: string[];
}

// ============================================================================
// SERVICE UPGRADE WIZARD TYPES (NEC 230.42, 220.87)
// ============================================================================

/**
 * NEC 220.87 - Methods for Determining Existing Loads
 *
 * Per NEC 220.87, existing loads shall be determined by one of:
 * 1. Actual maximum demand (utility billing or load study)
 * 2. Calculated load using NEC 220.82/220.84 demand factors
 */
export enum ExistingLoadDeterminationMethod {
  /** 12-month utility billing data showing peak demand (NEC 220.87 Method 1) */
  UTILITY_BILL = 'utility_bill',

  /** 30-day continuous load study at 15-minute intervals (NEC 220.87 Method 1) */
  LOAD_STUDY = 'load_study',

  /** Calculated from panel schedule using NEC 220.82/84 demand factors (NEC 220.87 Method 2) */
  CALCULATED = 'calculated',

  /** Manual entry (user-provided value, method unspecified) */
  MANUAL = 'manual'
}

/**
 * Quick Check Mode - Amp-based service capacity check
 * For quick field decisions: "Can my 200A service handle a 50A EV charger?"
 */
export interface QuickCheckInput {
  currentServiceAmps: number;   // Current service size (100, 150, 200, 400, etc.)
  currentUsageAmps: number;     // Current usage in amps (estimated or measured)
  proposedLoadAmps: number;     // New load to be added in amps

  /** How existing load was determined (NEC 220.87) */
  existingLoadMethod?: ExistingLoadDeterminationMethod;
}

export interface QuickCheckResult {
  totalAmps: number;               // currentUsage + proposedLoad
  utilizationPercent: number;      // (total / service) × 100
  availableAmps: number;           // Remaining capacity
  canHandle: boolean;              // utilization ≤ 100%
  upgradeRecommended: boolean;     // utilization > 80%
  status: 'OK' | 'HIGH' | 'CRITICAL';
  recommendation: string;
}

/**
 * Detailed Analysis Mode - kVA-based with NEC demand factors
 * For design phase: full NEC 220.82/220.84 load calculation
 */
export interface ServiceUpgradeInput {
  // Current Service
  currentServiceAmps: number;
  serviceVoltage: number;
  servicePhase: 1 | 3;

  // Existing Load (from project or manual entry)
  existingDemandLoad_kVA: number;

  /** How existing load was determined - REQUIRED per NEC 220.87 */
  existingLoadMethod: ExistingLoadDeterminationMethod;

  // Proposed Additional Loads
  proposedLoads: Array<{
    id?: string;
    description: string;
    kw: number;
    continuous: boolean;        // Apply 125% factor per NEC 210.19
    category?: 'EV' | 'HVAC' | 'Appliance' | 'Solar' | 'Other';
  }>;

  // Optional: Panel/service details for upgrade type analysis
  panelBusRating?: number;
  serviceConductorSize?: string;
  serviceConductorLength_ft?: number;

  // Safety margin for future growth (default 25%)
  futureGrowthMargin?: number;
}

export interface ServiceUpgradeResult {
  // Current service analysis
  currentServiceCapacity_kVA: number;
  existingDemand_kVA: number;
  existingUtilization_percent: number;
  availableCapacity_kVA: number;

  // With proposed loads
  proposedAdditionalLoad_kVA: number;
  totalFutureDemand_kVA: number;
  futureUtilization_percent: number;
  futureAvailableCapacity_kVA: number;

  // Verdict
  canHandle: boolean;
  upgradeRecommended: boolean;
  upgradeRequired: boolean;

  // Recommended service size
  recommendedServiceAmps?: number;
  upgradePath?: {
    from: number;
    to: number;
    margin_kVA: number;
    marginPercent: number;
  };

  // Panel vs. Service upgrade analysis
  upgradeAnalysis?: UpgradeAnalysis;

  // EVEMS alternative recommendation
  evemsRecommendation?: EVEMSRecommendation;

  // Load breakdown
  breakdown: Array<{
    category: string;
    description: string;
    load_kVA: number;
    continuous: boolean;
  }>;

  // NEC compliance
  necReferences: string[];
  warnings: string[];
  notes: string[];
}

/**
 * Panel vs. Service Upgrade Analysis
 * Critical distinction: $2-4K (panel only) vs. $8-15K (full service)
 */
export interface UpgradeAnalysis {
  upgradeType: 'none' | 'panel_only' | 'full_service';
  reason: string;
  costEstimate: {
    low: number;
    high: number;
  };
  timeline: string;

  // Component adequacy breakdown
  serviceConductorsAdequate: boolean;
  meterEnclosureAdequate: boolean;
  panelBusBarAdequate: boolean;

  // Detailed recommendations
  recommendations: string[];
}

/**
 * EVEMS Load Management Alternative Recommendation
 * For 3+ EV chargers, may be cheaper/faster than service upgrade
 */
export interface EVEMSRecommendation {
  shouldConsider: boolean;
  numberOfChargers: number;
  costComparison: {
    serviceUpgradeCost: number;
    evemsCost: number;
    savings: number;
  };
  tradeoffs: string[];
  recommendation: string;
}

/**
 * Load Templates for Quick Addition
 * Pre-defined common loads (EV chargers, HVAC, appliances)
 */
export interface LoadTemplate {
  name: string;
  kw: number;
  continuous: boolean;
  category: 'EV' | 'HVAC' | 'Appliance' | 'Solar' | 'Other';
  description?: string;
}

// ==========================
// Phase 0: Basic PM Features
// ==========================

/**
 * RFI (Request for Information) Status
 */
export type RFIStatus = 'Pending' | 'Answered' | 'Closed';

/**
 * Priority levels for RFIs, Calendar Events
 */
export type Priority = 'Low' | 'Medium' | 'High' | 'Urgent';

/**
 * RFI (Request for Information)
 * Track design clarifications and engineering questions
 */
export interface RFI {
  id: string;
  project_id: string;
  user_id: string;

  // RFI identification
  rfi_number: string; // e.g., "RFI-001"
  subject: string;
  question: string;
  answer?: string;

  // Status tracking
  status: RFIStatus;
  priority: Priority;

  // Assignment
  assigned_to?: string;
  requested_by?: string;
  responded_by?: string;

  // Dates
  due_date?: string;
  response_date?: string;
  closed_date?: string;

  // Metadata
  notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Site Visit Status
 */
export type SiteVisitStatus = 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';

/**
 * Site Visit
 * Log field observations and inspection visits
 */
export interface SiteVisit {
  id: string;
  project_id: string;
  user_id: string;

  // Visit details
  visit_date: string;
  visit_type: string; // "Site Inspection", "Pre-Inspection", "Final Walkthrough"
  title: string;
  description: string;
  weather_conditions?: string;

  // People present
  attendees?: string[];
  inspector_name?: string;

  // Follow-up
  issues_found?: string[];
  action_items?: string[];
  next_visit_date?: string;

  // Photos
  photos?: string[]; // Array of Supabase Storage URLs

  // Status
  status: SiteVisitStatus;
  duration_hours?: number;

  // Metadata
  notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Calendar Event Type
 */
export type CalendarEventType = 'Deadline' | 'Inspection' | 'Meeting' | 'Milestone' | 'Site Visit';

/**
 * Calendar Event Status
 */
export type CalendarEventStatus = 'Upcoming' | 'Completed' | 'Cancelled';

/**
 * Calendar Event
 * Track important dates and deadlines
 */
export interface CalendarEvent {
  id: string;
  project_id: string;
  user_id: string;

  // Event details
  title: string;
  description?: string;
  event_type: CalendarEventType;
  event_date: string;
  location?: string;

  // Related items (optional links)
  related_rfi_id?: string;
  related_site_visit_id?: string;

  // Status
  completed: boolean;
  completed_at?: string;

  created_at: string;
  updated_at: string;
}

/**
 * Open Item (unified view for dashboard)
 * Combines RFIs, Issues, Site Visits, Calendar Events
 */
export interface OpenItem {
  id: string;
  type: 'rfi' | 'issue' | 'site_visit' | 'calendar_event';
  project_id: string;
  project_name: string;

  // Display
  title: string;
  description: string;
  status: string;
  priority: Priority | 'Critical' | 'Warning' | 'Info'; // Include issue severities
  due_date?: string;

  // For navigation
  url: string; // e.g., "/project/123/rfis" or "/project/123/issues"

  created_at: string;
}

// ============================================================================
// PHASE 1: AGENTIC AI INFRASTRUCTURE TYPES
// ============================================================================

/**
 * Agent Action Type
 * Defines the type of action the AI agent is suggesting
 */
export type AgentActionType =
  | 'draft_rfi'
  | 'suggest_change'
  | 'predict_failure'
  | 'flag_violation'
  | 'recommend_upgrade'
  | 'generate_notes';

/**
 * Agent Name
 * Identifies which AI agent generated the action
 */
export type AgentName =
  | 'rfi_drafter'
  | 'change_impact'
  | 'photo_analyzer'
  | 'predictive_inspector'
  | 'content_generator';

/**
 * Agent Action Status
 * Workflow status for agent-suggested actions
 */
export type AgentActionStatus = 'pending' | 'approved' | 'rejected' | 'expired';

/**
 * Agent Action
 * AI-suggested action awaiting user approval
 */
export interface AgentAction {
  id: string;
  project_id: string;
  user_id: string;
  action_type: AgentActionType;
  agent_name: AgentName;
  priority: number; // 0-100
  status: AgentActionStatus;
  title: string;
  description: string;
  reasoning?: string;
  confidence_score?: number; // 0.00 - 1.00
  action_data: Record<string, any>;
  impact_analysis?: ImpactAnalysis;
  user_notes?: string;
  rejection_reason?: string;
  created_at: string;
  reviewed_at?: string;
  expires_at?: string;
  updated_at: string;
}

/**
 * Impact Analysis
 * Detailed analysis of proposed changes
 */
export interface ImpactAnalysis {
  can_accommodate: boolean;
  impact_summary: string;
  service_impact?: ServiceImpact;
  feeder_impacts?: FeederImpact[];
  panel_impacts?: PanelImpact[];
  voltage_drop_issues?: VoltageDropIssue[];
  cost_estimate?: CostEstimate;
  timeline_impact?: TimelineImpact;
  recommendations?: string[];
  change_order_draft?: string;
}

/**
 * Service Impact
 * Impact on main service entrance
 */
export interface ServiceImpact {
  upgrade_needed: boolean;
  current_size: number; // Amps
  required_size?: number; // Amps
  utilization_before: number; // Percentage
  utilization_after: number; // Percentage
  reason?: string;
}

/**
 * Feeder Impact
 * Impact on specific feeder
 */
export interface FeederImpact {
  feeder_name: string;
  current_size: string; // e.g., "#2 Cu"
  required_size: string; // e.g., "#1/0 Cu"
  reason: string;
  voltage_drop_before: number;
  voltage_drop_after: number;
}

/**
 * Panel Impact
 * Impact on specific panel
 */
export interface PanelImpact {
  panel_name: string;
  capacity_before: number; // Percentage
  capacity_after: number; // Percentage
  overloaded: boolean;
  poles_before: number;
  poles_after: number;
}

/**
 * Voltage Drop Issue
 * Voltage drop violation
 */
export interface VoltageDropIssue {
  feeder_or_circuit: string;
  voltage_drop: number; // Percentage
  exceeds_limit: boolean;
  limit: number; // NEC limit (typically 3%)
}

/**
 * Cost Estimate
 * Estimated cost range for changes
 */
export interface CostEstimate {
  low: number;
  high: number;
  breakdown: Array<{ item: string; cost: number }>;
}

/**
 * Timeline Impact
 * Estimated impact on project timeline
 */
export interface TimelineImpact {
  delay_days: number;
  confidence: number;
  factors: string[];
}

/**
 * Analysis Cache
 * Cached AI analysis results
 */
export interface AnalysisCache {
  id: string;
  project_id: string;
  user_id: string;
  analysis_type: string;
  context_hash: string;
  results: Record<string, any>;
  model_version: string;
  tokens_used?: number;
  processing_time_ms?: number;
  created_at: string;
  expires_at: string;
}

/**
 * Agent Activity Log
 * Audit trail for agent actions
 */
export interface AgentActivityLog {
  id: string;
  project_id: string;
  user_id: string;
  agent_action_id?: string;
  event_type: string;
  agent_name: AgentName;
  details?: Record<string, any>;
  created_at: string;
}

/**
 * Project Photo
 * Photo storage with Vision AI analysis
 */
export interface ProjectPhoto {
  id: string;
  project_id: string;
  user_id: string;
  storage_path: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
  location?: string;
  description?: string;
  tags?: string[];
  analyzed: boolean;
  analysis_results?: VisionAnalysisResult;
  detected_violations?: NecViolation[];
  created_at: string;
  updated_at: string;
}

/**
 * Vision Analysis Result
 * Results from Vision AI photo analysis
 */
export interface VisionAnalysisResult {
  equipment_detected: string[];
  violations: NecViolation[];
  safety_concerns: string[];
  scene_description: string;
}

/**
 * NEC Violation
 * Detected NEC code violation
 */
export interface NecViolation {
  nec_article: string;
  severity: 'critical' | 'warning' | 'info';
  confidence: number; // 0.00 - 1.00
  description: string;
  recommendation: string;
}
