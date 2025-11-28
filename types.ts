
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
  type: 'lighting' | 'receptacle' | 'motor' | 'hvac' | 'appliance';
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
