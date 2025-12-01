
export enum ProjectType {
  RESIDENTIAL = 'Residential',
  COMMERCIAL = 'Commercial',
  INDUSTRIAL = 'Industrial',
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

export interface PanelCircuit {
  id: string;
  circuitNumber: number;
  description: string;
  breakerAmps: number;
  pole: 1 | 2 | 3;
  loadWatts: number;
  conductorSize: string; // e.g., "12 AWG"
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
