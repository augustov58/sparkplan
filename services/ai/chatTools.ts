/**
 * Chat Tools for Agentic NEC Assistant
 *
 * Defines the tools available to the AI chatbot for executing calculations
 * and actions on the user's project.
 *
 * @module services/ai/chatTools
 */

import type { ProjectContext } from './projectContextBuilder';
import type { ToolResult, ToolResultDisplay } from '@/types';
import { analyzeChangeImpact, draftRFI, predictInspection } from '../api/pythonBackend';
import { supabase } from '@/lib/supabase';

// ============================================================================
// TOOL CONTEXT & TYPES
// ============================================================================

export interface ToolContext {
  projectId: string;
  projectContext: ProjectContext;
  userId?: string;
}

export interface ChatTool {
  name: string;
  description: string;
  parameters: ToolParameters;
  execute: (params: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;
  requiresConfirmation?: boolean;
}

export interface ToolParameters {
  type: 'object';
  properties: Record<string, ToolParameter>;
  required?: string[];
}

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  enum?: string[];
  items?: { type: string };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Find a circuit by ID, number, or selector
 */
function findCircuit(
  params: { circuit_id?: string; circuit_number?: number; panel_name?: string; selector?: string },
  context: ProjectContext
): { circuit: typeof context.circuits[0]; panel: typeof context.panels[0] } | null {
  const { circuit_id, circuit_number, panel_name, selector } = params;

  // Find by specific ID
  if (circuit_id) {
    const circuit = context.circuits.find(c => c.id === circuit_id);
    if (circuit) {
      const panel = context.panels.find(p => p.name === circuit.panelName);
      return panel ? { circuit, panel } : null;
    }
  }

  // Find by circuit number and panel name
  if (circuit_number !== undefined && panel_name) {
    const circuit = context.circuits.find(
      c => c.circuitNumber === circuit_number && c.panelName.toLowerCase() === panel_name.toLowerCase()
    );
    if (circuit) {
      const panel = context.panels.find(p => p.name === circuit.panelName);
      return panel ? { circuit, panel } : null;
    }
  }

  // Find by selector (longest, highest_load, worst)
  if (selector) {
    let selectedCircuit: typeof context.circuits[0] | undefined;

    switch (selector) {
      case 'highest_load':
        selectedCircuit = context.circuits.reduce((max, c) =>
          c.loadWatts > (max?.loadWatts || 0) ? c : max, context.circuits[0]);
        break;
      case 'longest':
        // Would need circuit length data - use highest load as fallback
        selectedCircuit = context.circuits.reduce((max, c) =>
          c.loadWatts > (max?.loadWatts || 0) ? c : max, context.circuits[0]);
        break;
      case 'worst':
        // Highest load is a reasonable proxy for "worst" case
        selectedCircuit = context.circuits.reduce((max, c) =>
          c.loadWatts > (max?.loadWatts || 0) ? c : max, context.circuits[0]);
        break;
    }

    if (selectedCircuit) {
      const panel = context.panels.find(p => p.name === selectedCircuit!.panelName);
      return panel ? { circuit: selectedCircuit, panel } : null;
    }
  }

  return null;
}

/**
 * Find a panel by ID or name
 */
function findPanel(
  params: { panel_id?: string; panel_name?: string },
  context: ProjectContext
): typeof context.panels[0] | null {
  const { panel_id, panel_name } = params;

  if (panel_id) {
    return context.panels.find(p => p.id === panel_id) || null;
  }

  if (panel_name) {
    return context.panels.find(p =>
      p.name.toLowerCase() === panel_name.toLowerCase() ||
      p.name.toLowerCase().includes(panel_name.toLowerCase())
    ) || null;
  }

  return null;
}

/**
 * Find a feeder by ID, name, or source/destination panel
 */
function findFeeder(
  params: { feeder_id?: string; feeder_name?: string; source_panel?: string; destination_panel?: string },
  context: ProjectContext
): typeof context.feeders[0] | null {
  const { feeder_id, feeder_name, source_panel, destination_panel } = params;

  if (feeder_id) {
    return context.feeders.find(f => f.id === feeder_id) || null;
  }

  if (feeder_name) {
    return context.feeders.find(f =>
      f.name.toLowerCase() === feeder_name.toLowerCase() ||
      f.name.toLowerCase().includes(feeder_name.toLowerCase())
    ) || null;
  }

  if (source_panel) {
    const feeders = context.feeders.filter(f =>
      f.sourcePanel.toLowerCase().includes(source_panel.toLowerCase())
    );
    if (destination_panel) {
      return feeders.find(f =>
        f.destinationPanel?.toLowerCase().includes(destination_panel.toLowerCase())
      ) || null;
    }
    return feeders[0] || null;
  }

  return null;
}

/**
 * Calculate panel load from circuits
 */
function calculatePanelLoad(panel: typeof CHAT_TOOLS[0] extends ChatTool ? Parameters<ChatTool['execute']>[1]['projectContext']['panels'][0] : never, context: ProjectContext): number {
  const panelCircuits = context.circuits.filter(c => c.panelName === panel.name);
  return panelCircuits.reduce((sum, c) => sum + c.loadWatts, 0);
}

/**
 * Get conductor ampacity from NEC Table 310.16 (simplified)
 */
function getAmpacityFromTable310_16(size: string, material: 'Cu' | 'Al', tempRating: 60 | 75 | 90): number {
  // Simplified Table 310.16 for copper at 75°C
  const ampacityTable: Record<string, number> = {
    '14': 15,
    '12': 20,
    '10': 30,
    '8': 50,
    '6': 65,
    '4': 85,
    '3': 100,
    '2': 115,
    '1': 130,
    '1/0': 150,
    '2/0': 175,
    '3/0': 200,
    '4/0': 230,
    '250': 255,
    '300': 285,
    '350': 310,
    '400': 335,
    '500': 380,
  };

  // Extract AWG/kcmil from size string
  const sizeMatch = size.match(/(\d+\/?\d*)/);
  const sizeNum = sizeMatch?.[1] ?? '12';

  return ampacityTable[sizeNum as keyof typeof ampacityTable] || 20;
}

/**
 * Get minimum conductor size for a given ampacity
 */
function getMinimumConductorSize(amps: number, material: 'Cu' | 'Al', tempRating: 60 | 75 | 90): string {
  const sizes = [
    { size: '14 AWG', amps: 15 },
    { size: '12 AWG', amps: 20 },
    { size: '10 AWG', amps: 30 },
    { size: '8 AWG', amps: 50 },
    { size: '6 AWG', amps: 65 },
    { size: '4 AWG', amps: 85 },
    { size: '3 AWG', amps: 100 },
    { size: '2 AWG', amps: 115 },
    { size: '1 AWG', amps: 130 },
    { size: '1/0 AWG', amps: 150 },
    { size: '2/0 AWG', amps: 175 },
    { size: '3/0 AWG', amps: 200 },
    { size: '4/0 AWG', amps: 230 },
    { size: '250 kcmil', amps: 255 },
    { size: '300 kcmil', amps: 285 },
    { size: '350 kcmil', amps: 310 },
    { size: '400 kcmil', amps: 335 },
    { size: '500 kcmil', amps: 380 },
  ];

  for (const entry of sizes) {
    if (entry.amps >= amps) {
      return entry.size;
    }
  }

  return '500 kcmil';
}

/**
 * Get next standard service size
 */
function getNextServiceSize(amps: number): number {
  const standardSizes = [100, 150, 200, 320, 400, 600, 800, 1000, 1200, 1600, 2000];
  for (const size of standardSizes) {
    if (size >= amps * 1.25) { // 25% margin
      return size;
    }
  }
  return 2000;
}

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export const CHAT_TOOLS: ChatTool[] = [
  // -------------------------------------------------------------------------
  // FEEDER VOLTAGE DROP CALCULATOR
  // -------------------------------------------------------------------------
  {
    name: 'calculate_feeder_voltage_drop',
    description: `Get voltage drop information for a feeder. Can specify by:
- feeder_id: specific feeder UUID
- feeder_name: feeder name (e.g., "F1", "Feeder to Panel A")
- source_panel: source panel name (optionally with destination_panel)
Returns the feeder's voltage drop percentage if already calculated in the project.`,
    parameters: {
      type: 'object',
      properties: {
        feeder_id: { type: 'string', description: 'Specific feeder UUID' },
        feeder_name: { type: 'string', description: 'Feeder name' },
        source_panel: { type: 'string', description: 'Source panel name' },
        destination_panel: { type: 'string', description: 'Destination panel name' },
      },
    },
    execute: async (params, context) => {
      const feeder = findFeeder(params as any, context.projectContext);
      if (!feeder) {
        // If no feeder found, list available feeders
        const availableFeeders = context.projectContext.feeders.map(f =>
          `${f.name}: ${f.sourcePanel} → ${f.destinationPanel || f.destinationTransformer || 'unknown'}`
        );
        return {
          success: false,
          error: `Feeder not found. Available feeders: ${availableFeeders.length > 0 ? availableFeeders.join(', ') : 'None defined in project'}`,
        };
      }

      const hasVoltageDropData = feeder.voltageDropPercent !== undefined;

      return {
        success: true,
        data: {
          feederName: feeder.name,
          sourcePanel: feeder.sourcePanel,
          destinationPanel: feeder.destinationPanel,
          destinationTransformer: feeder.destinationTransformer,
          conductorSize: feeder.phaseConductorSize,
          voltageDropPercent: hasVoltageDropData ? Math.round(feeder.voltageDropPercent! * 100) / 100 : null,
          compliant: hasVoltageDropData ? feeder.voltageDropPercent! <= 3 : null,
          necReference: 'NEC 215.2(A)(3) Informational Note No. 2 - Feeder voltage drop ≤3% recommended',
          note: hasVoltageDropData
            ? (feeder.voltageDropPercent! <= 3
              ? 'Voltage drop is within the recommended 3% limit for feeders.'
              : `Voltage drop exceeds 3% recommendation. Consider increasing conductor size.`)
            : 'Voltage drop has not been calculated for this feeder. Use the Feeder Manager to calculate.',
        },
      };
    },
  },

  // -------------------------------------------------------------------------
  // PANEL CAPACITY CHECK
  // -------------------------------------------------------------------------
  {
    name: 'check_panel_capacity',
    description: 'Check if a panel can accommodate additional load. Returns current utilization and available capacity.',
    parameters: {
      type: 'object',
      properties: {
        panel_id: { type: 'string', description: 'Panel UUID' },
        panel_name: { type: 'string', description: 'Panel name (e.g., "Panel A", "MDP")' },
        additional_load_watts: { type: 'number', description: 'Proposed additional load in watts' },
      },
    },
    execute: async (params, context) => {
      const panel = findPanel(params as any, context.projectContext);
      if (!panel) {
        return { success: false, error: 'Panel not found. Please specify a valid panel name.' };
      }

      const currentLoad = panel.totalLoadVA;
      const panelCapacityVA = panel.busRating * panel.voltage * (panel.phase === 3 ? 1.732 : 1);
      const maxContinuousLoad = panelCapacityVA * 0.8; // 80% rule for continuous loads
      const availableCapacity = maxContinuousLoad - currentLoad;
      const additionalLoad = (params.additional_load_watts as number) || 0;
      const canAccommodate = additionalLoad <= availableCapacity;

      return {
        success: true,
        data: {
          panelName: panel.name,
          busRating: panel.busRating,
          voltage: panel.voltage,
          phase: panel.phase,
          currentLoadVA: currentLoad,
          panelCapacityVA: Math.round(panelCapacityVA),
          maxContinuousLoadVA: Math.round(maxContinuousLoad),
          currentUtilization: Math.round((currentLoad / maxContinuousLoad) * 100),
          availableCapacityVA: Math.round(availableCapacity),
          additionalLoadVA: additionalLoad,
          canAccommodate,
          projectedUtilization: Math.round(((currentLoad + additionalLoad) / maxContinuousLoad) * 100),
          necReference: 'NEC 408.30 - Overcurrent Protection of Panelboards',
          recommendation: !canAccommodate
            ? `Panel cannot accommodate ${additionalLoad}W. Available: ${Math.round(availableCapacity)}W. Consider upgrading panel or redistributing loads.`
            : additionalLoad > 0
            ? `Panel can accommodate the additional ${additionalLoad}W load.`
            : `Panel has ${Math.round(availableCapacity)}W available capacity.`,
        },
      };
    },
  },

  // -------------------------------------------------------------------------
  // CONDUCTOR SIZING CHECK
  // -------------------------------------------------------------------------
  {
    name: 'check_conductor_sizing',
    description: 'Verify if a conductor is properly sized per NEC Table 310.16',
    parameters: {
      type: 'object',
      properties: {
        circuit_id: { type: 'string', description: 'Circuit UUID' },
        circuit_number: { type: 'number', description: 'Circuit number' },
        panel_name: { type: 'string', description: 'Panel name' },
        load_amps: { type: 'number', description: 'Load in amps (if not using circuit data)' },
        conductor_size: { type: 'string', description: 'Conductor size (e.g., "12 AWG")' },
      },
    },
    execute: async (params, context) => {
      let loadAmps = params.load_amps as number | undefined;
      let conductorSize = params.conductor_size as string | undefined;

      // Try to get from circuit if not provided
      if (!loadAmps || !conductorSize) {
        const found = findCircuit(params as any, context.projectContext);
        if (found) {
          const { circuit, panel } = found;
          loadAmps = loadAmps || circuit.loadWatts / (panel.voltage || 120);
          conductorSize = conductorSize || circuit.conductorSize;
        }
      }

      if (!loadAmps || !conductorSize) {
        return { success: false, error: 'Please provide load_amps and conductor_size, or specify a valid circuit.' };
      }

      const ampacity = getAmpacityFromTable310_16(conductorSize, 'Cu', 75);
      const compliant = ampacity >= loadAmps;
      const minimumSize = getMinimumConductorSize(loadAmps, 'Cu', 75);

      return {
        success: true,
        data: {
          conductorSize,
          loadAmps: Math.round(loadAmps * 10) / 10,
          ampacity,
          compliant,
          utilizationPercent: Math.round((loadAmps / ampacity) * 100),
          minimumRequiredSize: minimumSize,
          necReference: 'NEC Table 310.16 - Allowable Ampacities (75°C Cu)',
          recommendation: !compliant
            ? `Conductor undersized. ${conductorSize} has ${ampacity}A capacity but load is ${Math.round(loadAmps)}A. Upgrade to ${minimumSize} minimum.`
            : `Conductor properly sized. ${conductorSize} (${ampacity}A) is adequate for ${Math.round(loadAmps)}A load.`,
        },
      };
    },
  },

  // -------------------------------------------------------------------------
  // SERVICE UPGRADE CHECK
  // -------------------------------------------------------------------------
  {
    name: 'check_service_upgrade',
    description: 'Analyze if service upgrade is needed for current loads or proposed additions',
    parameters: {
      type: 'object',
      properties: {
        proposed_load_watts: { type: 'number', description: 'Total proposed additional load in watts' },
        proposed_load_description: { type: 'string', description: 'Description of proposed load' },
      },
    },
    execute: async (params, context) => {
      const pc = context.projectContext;
      const serviceVoltage = pc.serviceVoltage;
      const servicePhase = pc.servicePhase;

      // Estimate current service amps from main panel
      const mainPanel = pc.panels.find(p => p.isMain);
      const currentServiceAmps = mainPanel?.busRating || 200;

      const currentLoadVA = pc.totalLoad.demandVA;
      const serviceCapacityVA = currentServiceAmps * serviceVoltage * (servicePhase === 3 ? 1.732 : 1);
      const proposedAdditionalVA = (params.proposed_load_watts as number) || 0;
      const totalLoadVA = currentLoadVA + proposedAdditionalVA;

      const currentUtilization = (currentLoadVA / serviceCapacityVA) * 100;
      const projectedUtilization = (totalLoadVA / serviceCapacityVA) * 100;

      const needsUpgrade = projectedUtilization > 80;
      const recommendedSize = needsUpgrade ? getNextServiceSize(totalLoadVA / serviceVoltage) : currentServiceAmps;

      return {
        success: true,
        data: {
          currentServiceAmps,
          serviceVoltage,
          servicePhase,
          currentLoadVA: Math.round(currentLoadVA),
          serviceCapacityVA: Math.round(serviceCapacityVA),
          currentUtilization: Math.round(currentUtilization),
          proposedAdditionalVA,
          totalLoadVA: Math.round(totalLoadVA),
          projectedUtilization: Math.round(projectedUtilization),
          needsUpgrade,
          recommendedServiceAmps: recommendedSize,
          necReference: 'NEC 220.87 - Determining Existing Loads',
          recommendation: needsUpgrade
            ? `Service upgrade recommended. Current ${currentServiceAmps}A service will be at ${Math.round(projectedUtilization)}% utilization. Recommend ${recommendedSize}A service.`
            : proposedAdditionalVA > 0
            ? `Current ${currentServiceAmps}A service can accommodate the additional ${proposedAdditionalVA}W load (${Math.round(projectedUtilization)}% projected utilization).`
            : `Current service is at ${Math.round(currentUtilization)}% utilization with ${Math.round(serviceCapacityVA - currentLoadVA)}VA available.`,
        },
      };
    },
  },

  // -------------------------------------------------------------------------
  // RUN INSPECTION
  // -------------------------------------------------------------------------
  {
    name: 'run_quick_inspection',
    description: 'Run a quick NEC compliance check on the project and identify potential issues',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Category to inspect: "all", "panels", "circuits", "capacity"',
          enum: ['all', 'panels', 'circuits', 'capacity'],
        },
      },
    },
    execute: async (params, context) => {
      const pc = context.projectContext;
      const issues: Array<{ severity: 'critical' | 'warning' | 'info'; description: string; necReference: string }> = [];

      const category = (params.category as string) || 'all';

      // Check panel utilization
      if (category === 'all' || category === 'panels' || category === 'capacity') {
        for (const panel of pc.panels) {
          const capacityVA = panel.busRating * panel.voltage * (panel.phase === 3 ? 1.732 : 1) * 0.8;
          const utilization = (panel.totalLoadVA / capacityVA) * 100;

          if (utilization > 100) {
            issues.push({
              severity: 'critical',
              description: `${panel.name} is overloaded at ${Math.round(utilization)}% capacity`,
              necReference: 'NEC 408.30',
            });
          } else if (utilization > 80) {
            issues.push({
              severity: 'warning',
              description: `${panel.name} is at ${Math.round(utilization)}% capacity (approaching limit)`,
              necReference: 'NEC 408.30',
            });
          }
        }
      }

      // Check circuits
      if (category === 'all' || category === 'circuits') {
        for (const circuit of pc.circuits) {
          const panel = pc.panels.find(p => p.name === circuit.panelName);
          const voltage = panel?.voltage || 120;
          const loadAmps = circuit.loadWatts / voltage;
          const breakerAmps = circuit.breakerAmps;

          // Check if load exceeds breaker rating
          if (loadAmps > breakerAmps * 0.8) {
            issues.push({
              severity: loadAmps > breakerAmps ? 'critical' : 'warning',
              description: `Circuit ${circuit.circuitNumber} (${circuit.description}) load of ${Math.round(loadAmps)}A ${loadAmps > breakerAmps ? 'exceeds' : 'approaches'} ${breakerAmps}A breaker rating`,
              necReference: 'NEC 210.20(A)',
            });
          }

          // Check conductor sizing
          const ampacity = getAmpacityFromTable310_16(circuit.conductorSize, 'Cu', 75);
          if (ampacity < breakerAmps) {
            issues.push({
              severity: 'critical',
              description: `Circuit ${circuit.circuitNumber} conductor ${circuit.conductorSize} (${ampacity}A) undersized for ${breakerAmps}A breaker`,
              necReference: 'NEC 240.4',
            });
          }
        }
      }

      // Sort by severity
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      const criticalCount = issues.filter(i => i.severity === 'critical').length;
      const warningCount = issues.filter(i => i.severity === 'warning').length;

      return {
        success: true,
        data: {
          totalIssues: issues.length,
          critical: criticalCount,
          warnings: warningCount,
          info: issues.filter(i => i.severity === 'info').length,
          issues: issues.slice(0, 10), // Return top 10 issues
          overallStatus: criticalCount > 0 ? 'CRITICAL' : warningCount > 0 ? 'WARNING' : 'PASS',
          recommendation: criticalCount > 0
            ? `Found ${criticalCount} critical issue(s) that must be addressed before inspection.`
            : warningCount > 0
            ? `Found ${warningCount} warning(s) that should be reviewed.`
            : 'No significant issues found. Project appears compliant.',
        },
      };
    },
  },

  // -------------------------------------------------------------------------
  // GET PROJECT SUMMARY
  // -------------------------------------------------------------------------
  {
    name: 'get_project_summary',
    description: 'Get a summary of the current project including panels, total load, and service details',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async (_params, context) => {
      const pc = context.projectContext;
      const mainPanel = pc.panels.find(p => p.isMain);

      return {
        success: true,
        data: {
          projectName: pc.projectName,
          projectType: pc.projectType,
          serviceVoltage: pc.serviceVoltage,
          servicePhase: pc.servicePhase,
          totalPanels: pc.panels.length,
          totalCircuits: pc.circuits.length,
          totalFeeders: pc.feeders.length,
          totalTransformers: pc.transformers.length,
          totalConnectedLoadVA: pc.totalLoad.connectedVA,
          totalDemandLoadVA: pc.totalLoad.demandVA,
          mainPanel: mainPanel ? {
            name: mainPanel.name,
            busRating: mainPanel.busRating,
            mainBreaker: mainPanel.mainBreaker,
            circuits: mainPanel.circuitCount,
            loadVA: mainPanel.totalLoadVA,
          } : null,
          panels: pc.panels.map(p => ({
            name: p.name,
            voltage: p.voltage,
            phase: p.phase,
            busRating: p.busRating,
            circuits: p.circuitCount,
            loadVA: p.totalLoadVA,
            utilization: Math.round((p.totalLoadVA / (p.busRating * p.voltage * (p.phase === 3 ? 1.732 : 1) * 0.8)) * 100),
          })),
        },
      };
    },
  },

  // =========================================================================
  // PYDANTIC AI AGENTS (Python Backend)
  // =========================================================================

  // -------------------------------------------------------------------------
  // CHANGE IMPACT ANALYZER
  // -------------------------------------------------------------------------
  {
    name: 'analyze_change_impact',
    description: `Analyze the impact of adding new electrical loads to the project.
Use this when the user wants to know:
- What happens if they add EV chargers, HVAC, or other loads
- Whether a service upgrade is needed
- Impact on panel capacity and feeders
Returns detailed analysis including cost estimates and recommendations.`,
    parameters: {
      type: 'object',
      properties: {
        change_description: {
          type: 'string',
          description: 'Description of the proposed change (e.g., "Add 3 EV chargers at 50A each")',
        },
        loads: {
          type: 'array',
          description: 'Array of proposed loads with type, amps, and quantity',
          items: { type: 'object' },
        },
      },
      required: ['change_description'],
    },
    execute: async (params, context) => {
      const { change_description, loads } = params as {
        change_description: string;
        loads?: Array<{ type: string; amps: number; quantity: number }>;
      };

      if (!context.projectId) {
        return { success: false, error: 'No project selected. Please open a project first.' };
      }

      try {
        // Parse loads from description if not provided
        const proposedLoads = loads || [];

        const result = await analyzeChangeImpact(
          context.projectId,
          change_description,
          proposedLoads
        );

        return {
          success: true,
          data: {
            title: result.title,
            description: result.description,
            reasoning: result.reasoning,
            impactAnalysis: result.impact_analysis,
            confidenceScore: result.confidence_score,
            necReferences: 'NEC 220.87 (Existing Loads), NEC 230.42 (Service Sizing)',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to analyze change impact: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  // -------------------------------------------------------------------------
  // RFI DRAFTER
  // -------------------------------------------------------------------------
  {
    name: 'draft_rfi',
    description: `Draft a professional Request for Information (RFI) with NEC references.
Use this when the user needs to:
- Ask a formal question to the engineer, architect, or GC
- Document a code compliance concern
- Request clarification on specifications
Returns a formatted RFI with subject, question, NEC references, and priority.`,
    parameters: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'The topic or subject of the RFI (e.g., "Transformer sizing", "Panel clearance")',
        },
        context: {
          type: 'string',
          description: 'Additional context about the situation',
        },
      },
      required: ['topic'],
    },
    execute: async (params, context) => {
      const { topic, context: rfiContext } = params as { topic: string; context?: string };

      if (!context.projectId) {
        return { success: false, error: 'No project selected. Please open a project first.' };
      }

      try {
        const result = await draftRFI(context.projectId, topic, rfiContext);

        return {
          success: true,
          data: {
            title: result.title,
            description: result.description,
            rfiDraft: result.action_data,
            priority: (result.action_data as any)?.priority || 'Medium',
            necArticles: (result.action_data as any)?.related_nec_articles || [],
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to draft RFI: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  // -------------------------------------------------------------------------
  // PREDICTIVE INSPECTOR
  // -------------------------------------------------------------------------
  {
    name: 'predict_inspection',
    description: `Predict potential inspection failures before they happen.
Use this when the user wants to:
- Prepare for an upcoming inspection
- Identify potential code violations
- Get a checklist of items to fix before inspection
Returns predicted issues with likelihood, NEC references, and fix recommendations.`,
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async (_params, context) => {
      if (!context.projectId) {
        return { success: false, error: 'No project selected. Please open a project first.' };
      }

      try {
        const result = await predictInspection(context.projectId);

        const prediction = result.action_data as {
          failure_likelihood?: number;
          risk_level?: string;
          predicted_issues?: Array<{
            category: string;
            description: string;
            nec_reference: string;
            likelihood: number;
            suggested_fix: string;
          }>;
          preparation_checklist?: string[];
        };

        return {
          success: true,
          data: {
            title: result.title,
            failureLikelihood: prediction?.failure_likelihood,
            riskLevel: prediction?.risk_level,
            predictedIssues: prediction?.predicted_issues || [],
            preparationChecklist: prediction?.preparation_checklist || [],
            confidenceScore: result.confidence_score,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to predict inspection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  // =========================================================================
  // ACTION TOOLS (Modify Project Data)
  // =========================================================================

  // -------------------------------------------------------------------------
  // ADD CIRCUIT
  // -------------------------------------------------------------------------
  {
    name: 'add_circuit',
    description: `Add a new circuit to a panel. Use this when the user wants to create a new circuit.
Requires panel name, circuit description, breaker size, and load.`,
    parameters: {
      type: 'object',
      properties: {
        panel_name: { type: 'string', description: 'Name of the panel to add circuit to' },
        description: { type: 'string', description: 'Circuit description (e.g., "Kitchen receptacles", "HVAC unit")' },
        breaker_amps: { type: 'number', description: 'Breaker size in amps (15, 20, 30, 40, 50, etc.)' },
        load_watts: { type: 'number', description: 'Circuit load in watts' },
        poles: { type: 'number', description: 'Number of poles (1, 2, or 3)' },
        wire_size: { type: 'string', description: 'Conductor size (e.g., "12 AWG", "10 AWG")' },
      },
      required: ['panel_name', 'description', 'breaker_amps'],
    },
    requiresConfirmation: true,
    execute: async (params, context) => {
      const {
        panel_name,
        description,
        breaker_amps,
        load_watts,
        poles = 1,
        wire_size,
      } = params as {
        panel_name: string;
        description: string;
        breaker_amps: number;
        load_watts?: number;
        poles?: number;
        wire_size?: string;
      };

      if (!context.projectId) {
        return { success: false, error: 'No project selected.' };
      }

      // Find the panel
      const panel = context.projectContext.panels.find(
        p => p.name.toLowerCase() === panel_name.toLowerCase()
      );
      if (!panel) {
        return {
          success: false,
          error: `Panel "${panel_name}" not found. Available panels: ${context.projectContext.panels.map(p => p.name).join(', ')}`,
        };
      }

      // Get next available circuit number
      const existingCircuits = context.projectContext.circuits.filter(c => c.panelName === panel.name);
      const maxCircuitNum = existingCircuits.reduce((max, c) => Math.max(max, c.circuitNumber), 0);
      const nextCircuitNum = maxCircuitNum + (poles === 1 ? 1 : 2);

      // Default wire size based on breaker
      const defaultWireSize = breaker_amps <= 15 ? '14 AWG' :
                              breaker_amps <= 20 ? '12 AWG' :
                              breaker_amps <= 30 ? '10 AWG' :
                              breaker_amps <= 40 ? '8 AWG' :
                              breaker_amps <= 50 ? '6 AWG' : '4 AWG';

      try {
        // Get panel ID from database
        const { data: dbPanel } = await supabase
          .from('panels')
          .select('id')
          .eq('project_id', context.projectId)
          .eq('name', panel.name)
          .single();

        if (!dbPanel) {
          return { success: false, error: 'Panel not found in database.' };
        }

        const { data: newCircuit, error } = await supabase
          .from('circuits')
          .insert({
            project_id: context.projectId,
            panel_id: dbPanel.id,
            circuit_number: nextCircuitNum,
            description,
            breaker_amps,
            load_watts: load_watts || breaker_amps * 120 * 0.8,
            pole: poles,
            conductor_size: wire_size || defaultWireSize,
            load_type: 'O', // O = Other (default for general circuits)
          } as any)
          .select()
          .single();

        if (error) {
          return { success: false, error: `Failed to add circuit: ${error.message}` };
        }

        return {
          success: true,
          data: {
            message: `Circuit "${description}" added to ${panel.name}`,
            circuitNumber: nextCircuitNum,
            panelName: panel.name,
            breakerAmps: breaker_amps,
            conductorSize: wire_size || defaultWireSize,
            poles,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to add circuit: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  // -------------------------------------------------------------------------
  // ADD PANEL
  // -------------------------------------------------------------------------
  {
    name: 'add_panel',
    description: `Add a new electrical panel to the project.
Use this when the user wants to create a sub-panel or distribution panel.
Can be fed from:
- Another panel (specify fed_from_panel)
- A transformer (specify fed_from_transformer) - voltage auto-set from transformer secondary
- Service entrance (default if neither specified)`,
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Panel name (e.g., "Panel A", "Garage Sub-Panel")' },
        bus_rating: { type: 'number', description: 'Bus rating in amps (100, 125, 200, 225, etc.)' },
        voltage: { type: 'number', description: 'Panel voltage (120, 208, 240, 480) - auto-set if fed from transformer' },
        phase: { type: 'number', description: 'Number of phases (1 or 3)' },
        main_breaker: { type: 'number', description: 'Main breaker size in amps (optional for MLO panels)' },
        fed_from_panel: { type: 'string', description: 'Name of the panel feeding this one' },
        fed_from_transformer: { type: 'string', description: 'Name of the transformer feeding this panel (voltage auto-set from secondary)' },
      },
      required: ['name', 'bus_rating'],
    },
    requiresConfirmation: true,
    execute: async (params, context) => {
      const {
        name,
        bus_rating,
        voltage,
        phase,
        main_breaker,
        fed_from_panel,
        fed_from_transformer,
      } = params as {
        name: string;
        bus_rating: number;
        voltage?: number;
        phase?: number;
        main_breaker?: number;
        fed_from_panel?: string;
        fed_from_transformer?: string;
      };

      if (!context.projectId) {
        return { success: false, error: 'No project selected.' };
      }

      // Check if panel name already exists
      const existingPanel = context.projectContext.panels.find(
        p => p.name.toLowerCase() === name.toLowerCase()
      );
      if (existingPanel) {
        return { success: false, error: `Panel "${name}" already exists.` };
      }

      let fedFromId: string | null = null;
      let fedFromTransformerId: string | null = null;
      let fedFromType: 'service' | 'panel' | 'transformer' = 'service';
      let autoVoltage: number | undefined;
      let fedFromName = 'Service';

      // Find fed_from transformer if specified (takes priority)
      if (fed_from_transformer) {
        const transformer = context.projectContext.transformers.find(
          t => t.name.toLowerCase() === fed_from_transformer.toLowerCase() ||
               t.name.toLowerCase().includes(fed_from_transformer.toLowerCase())
        );

        if (!transformer) {
          const available = context.projectContext.transformers.map(t => t.name).join(', ');
          return {
            success: false,
            error: `Transformer "${fed_from_transformer}" not found. Available transformers: ${available || 'None'}`,
          };
        }

        fedFromTransformerId = transformer.id;
        fedFromType = 'transformer';
        autoVoltage = transformer.secondaryVoltage;
        fedFromName = transformer.name;
      }
      // Find fed_from panel if specified
      else if (fed_from_panel) {
        const { data: sourcePanel } = await supabase
          .from('panels')
          .select('id, voltage')
          .eq('project_id', context.projectId)
          .ilike('name', `%${fed_from_panel}%`)
          .single();

        if (sourcePanel) {
          fedFromId = sourcePanel.id;
          fedFromType = 'panel';
          fedFromName = fed_from_panel;
          // Inherit voltage from parent panel if not specified
          if (!voltage) {
            autoVoltage = sourcePanel.voltage;
          }
        } else {
          const available = context.projectContext.panels.map(p => p.name).join(', ');
          return {
            success: false,
            error: `Panel "${fed_from_panel}" not found. Available panels: ${available || 'None'}`,
          };
        }
      }

      const finalVoltage = voltage || autoVoltage || context.projectContext.serviceVoltage;
      const finalPhase = phase || context.projectContext.servicePhase;

      try {
        const { data: newPanel, error } = await supabase
          .from('panels')
          .insert({
            project_id: context.projectId,
            name,
            bus_rating,
            voltage: finalVoltage,
            phase: finalPhase,
            main_breaker_amps: main_breaker || null,
            is_main: false,
            fed_from: fedFromId,
            fed_from_transformer_id: fedFromTransformerId,
            fed_from_type: fedFromType,
          } as any)
          .select()
          .single();

        if (error) {
          return { success: false, error: `Failed to add panel: ${error.message}` };
        }

        return {
          success: true,
          data: {
            message: `Panel "${name}" created successfully`,
            panelName: name,
            busRating: bus_rating,
            voltage: finalVoltage,
            phase: finalPhase,
            mainBreaker: main_breaker || 'MLO (Main Lug Only)',
            fedFrom: fedFromName,
            fedFromType,
            note: autoVoltage ? `Voltage auto-set to ${autoVoltage}V from ${fedFromType === 'transformer' ? 'transformer secondary' : 'parent panel'}` : undefined,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to add panel: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  // -------------------------------------------------------------------------
  // FILL PANEL WITH TEST LOADS
  // -------------------------------------------------------------------------
  {
    name: 'fill_panel_with_test_loads',
    description: `Fill a panel with test/sample circuits. Use this when the user wants to quickly populate a panel with circuits for testing or demonstration purposes.

If the user says "fill the MDP" or references the main panel, it will find the main panel automatically.
If no panel is specified, defaults to the main panel.

Can specify:
- panel_name: The panel to fill (supports "MDP" for Main Distribution Panel)
- num_circuits: Number of circuits to add
- load_type: lighting, receptacle, motor, hvac, or mixed (default)
- target_utilization: Target % (default 60%)`,
    parameters: {
      type: 'object',
      properties: {
        panel_name: { type: 'string', description: 'Name of the panel to fill with test loads' },
        num_circuits: { type: 'number', description: 'Number of circuits to add (default: fill to 80% capacity)' },
        load_type: {
          type: 'string',
          description: 'Type of loads to add: lighting, receptacle, motor, hvac, mixed (default)',
          enum: ['lighting', 'receptacle', 'motor', 'hvac', 'mixed'],
        },
        target_utilization: { type: 'number', description: 'Target panel utilization percentage (default: 60%)' },
      },
      required: ['panel_name'],
    },
    requiresConfirmation: true,
    execute: async (params, context) => {
      console.log('[fill_panel_with_test_loads] Starting with params:', params);
      console.log('[fill_panel_with_test_loads] Project ID:', context.projectId);
      console.log('[fill_panel_with_test_loads] Available panels:', context.projectContext.panels.map(p => p.name));

      const {
        panel_name,
        num_circuits,
        load_type = 'mixed',
        target_utilization = 60,
      } = params as {
        panel_name: string;
        num_circuits?: number;
        load_type?: 'lighting' | 'receptacle' | 'motor' | 'hvac' | 'mixed';
        target_utilization?: number;
      };

      if (!context.projectId) {
        console.error('[fill_panel_with_test_loads] No project ID');
        return { success: false, error: 'No project selected.' };
      }

      // Find the panel - try various matching strategies
      let panel = null;

      if (panel_name) {
        // Try exact match first
        panel = context.projectContext.panels.find(
          p => p.name.toLowerCase() === panel_name.toLowerCase()
        );

        // Try partial match (includes)
        if (!panel) {
          panel = context.projectContext.panels.find(
            p => p.name.toLowerCase().includes(panel_name.toLowerCase()) ||
                 panel_name.toLowerCase().includes(p.name.toLowerCase())
          );
        }

        // Try common abbreviations: MDP = Main Distribution Panel, etc.
        if (!panel && panel_name.toLowerCase() === 'mdp') {
          panel = context.projectContext.panels.find(p => p.isMain);
        }
      }

      // If still no panel found and no name provided, try the main panel
      if (!panel && !panel_name) {
        panel = context.projectContext.panels.find(p => p.isMain);
        if (panel) {
          console.log('[fill_panel_with_test_loads] No panel specified, using main panel:', panel.name);
        }
      }

      if (!panel) {
        const available = context.projectContext.panels.map(p => p.name).join(', ');
        console.error('[fill_panel_with_test_loads] Panel not found:', panel_name, 'Available:', available);
        return {
          success: false,
          error: panel_name
            ? `Panel "${panel_name}" not found. Available panels: ${available || 'None'}`
            : `Please specify which panel to fill. Available panels: ${available || 'None'}`,
        };
      }

      console.log('[fill_panel_with_test_loads] Found panel:', panel.name, 'ID:', panel.id);

      // Validate panel has required properties
      const busRating = panel.busRating || 100; // Default to 100A if missing
      const voltage = panel.voltage || 120;     // Default to 120V if missing
      const phase = panel.phase || 1;           // Default to single phase
      const totalLoadVA = panel.totalLoadVA || 0;

      if (!panel.busRating || !panel.voltage) {
        console.warn('[fill_panel_with_test_loads] Panel missing busRating or voltage, using defaults:', {
          originalBusRating: panel.busRating,
          originalVoltage: panel.voltage,
          usingBusRating: busRating,
          usingVoltage: voltage,
        });
      }

      // Get panel ID from database
      const { data: dbPanel, error: dbError } = await supabase
        .from('panels')
        .select('id')
        .eq('project_id', context.projectId)
        .eq('name', panel.name)
        .single();

      if (dbError) {
        console.error('[fill_panel_with_test_loads] DB error:', dbError);
        return { success: false, error: `Database error: ${dbError.message}` };
      }

      if (!dbPanel) {
        console.error('[fill_panel_with_test_loads] Panel not in DB');
        return { success: false, error: 'Panel not found in database.' };
      }

      console.log('[fill_panel_with_test_loads] DB panel ID:', dbPanel.id);

      // Calculate panel capacity and current load
      const panelCapacityVA = busRating * voltage * (phase === 3 ? 1.732 : 1);
      const targetLoadVA = panelCapacityVA * (target_utilization / 100);
      const currentLoadVA = totalLoadVA;
      const remainingLoadVA = Math.max(0, targetLoadVA - currentLoadVA);

      console.log('[fill_panel_with_test_loads] Panel capacity calculation:', {
        originalBusRating: panel.busRating,
        originalVoltage: panel.voltage,
        originalPhase: panel.phase,
        originalTotalLoadVA: panel.totalLoadVA,
        usedBusRating: busRating,
        usedVoltage: voltage,
        usedPhase: phase,
        panelCapacityVA,
        targetUtilization: target_utilization,
        targetLoadVA,
        currentLoadVA,
        remainingLoadVA,
      });

      // Sanity check - if panelCapacityVA is too small, something is wrong
      if (panelCapacityVA <= 0 || isNaN(panelCapacityVA)) {
        return {
          success: false,
          error: `Cannot calculate panel capacity. Panel "${panel.name}" has invalid configuration: busRating=${panel.busRating}, voltage=${panel.voltage}, phase=${panel.phase}. Please check panel settings.`,
        };
      }

      // Get existing circuits and calculate occupied slots
      const existingCircuits = context.projectContext.circuits.filter(c => c.panelName === panel.name);

      // Panel slot count: MDP/Main = 30 slots, Branch panels = 42 slots
      const totalSlots = panel.isMain ? 30 : 42;

      // Calculate occupied slots (including multi-pole circuit expansions)
      const occupiedSlots = new Set<number>();
      for (const ckt of existingCircuits) {
        // Add the circuit's base slot
        occupiedSlots.add(ckt.circuitNumber);
        // Add slots occupied by multi-pole circuits
        // 1-pole: occupies 1 slot (e.g., slot 1)
        // 2-pole: occupies 2 slots (e.g., slots 1 and 3)
        // 3-pole: occupies 3 slots (e.g., slots 1, 3, and 5)
        const pole = ckt.pole || 1;
        if (pole > 1) {
          for (let i = 1; i < pole; i++) {
            occupiedSlots.add(ckt.circuitNumber + (i * 2));
          }
        }
      }

      // Helper function to check if a slot can fit a circuit with given pole count
      const canFitCircuit = (slotNum: number, pole: number): boolean => {
        for (let i = 0; i < pole; i++) {
          const slot = slotNum + (i * 2);
          if (occupiedSlots.has(slot) || slot > totalSlots) {
            return false;
          }
        }
        return true;
      };

      // Find available slots for circuits
      const findNextAvailableSlot = (pole: number): number | null => {
        // Try both odd and even slots
        for (let slotNum = 1; slotNum <= totalSlots; slotNum++) {
          if (canFitCircuit(slotNum, pole)) {
            return slotNum;
          }
        }
        return null;
      };

      const availableSlotsCount = totalSlots - occupiedSlots.size;

      console.log('[fill_panel_with_test_loads] Slot analysis:', {
        totalSlots,
        occupiedSlotsCount: occupiedSlots.size,
        availableSlotsCount,
        occupiedSlots: Array.from(occupiedSlots).sort((a, b) => a - b),
        isMain: panel.isMain,
      });

      // Define test load templates based on load type (includes load_type_code for database)
      const loadTemplates = {
        lighting: [
          { description: 'General Lighting', breaker: 15, loadVA: 1200, pole: 1, loadTypeCode: 'L' },
          { description: 'Recessed Lighting', breaker: 15, loadVA: 1000, pole: 1, loadTypeCode: 'L' },
          { description: 'Exterior Lighting', breaker: 15, loadVA: 800, pole: 1, loadTypeCode: 'L' },
        ],
        receptacle: [
          { description: 'General Receptacles', breaker: 20, loadVA: 1800, pole: 1, loadTypeCode: 'R' },
          { description: 'Kitchen Receptacles', breaker: 20, loadVA: 1500, pole: 1, loadTypeCode: 'K' },
          { description: 'Office Receptacles', breaker: 20, loadVA: 1600, pole: 1, loadTypeCode: 'R' },
        ],
        motor: [
          { description: 'HVAC Blower Motor', breaker: 20, loadVA: 2400, pole: 1, loadTypeCode: 'M' },
          { description: 'Exhaust Fan', breaker: 15, loadVA: 800, pole: 1, loadTypeCode: 'M' },
          { description: 'Pump Motor', breaker: 30, loadVA: 4000, pole: 2, loadTypeCode: 'M' },
        ],
        hvac: [
          { description: 'Air Handler', breaker: 30, loadVA: 5000, pole: 2, loadTypeCode: 'H' },
          { description: 'Condensing Unit', breaker: 40, loadVA: 7200, pole: 2, loadTypeCode: 'C' },
          { description: 'RTU #1', breaker: 50, loadVA: 12000, pole: 3, loadTypeCode: 'H' },
        ],
        mixed: [
          { description: 'General Lighting', breaker: 20, loadVA: 1500, pole: 1, loadTypeCode: 'L' },
          { description: 'Receptacles', breaker: 20, loadVA: 1800, pole: 1, loadTypeCode: 'R' },
          { description: 'HVAC Unit', breaker: 30, loadVA: 5000, pole: 2, loadTypeCode: 'H' },
          { description: 'Water Heater', breaker: 30, loadVA: 4500, pole: 2, loadTypeCode: 'W' },
          { description: 'Kitchen Equipment', breaker: 20, loadVA: 2400, pole: 1, loadTypeCode: 'K' },
          { description: 'Exterior Lighting', breaker: 15, loadVA: 1000, pole: 1, loadTypeCode: 'L' },
        ],
      };

      const templates = loadTemplates[load_type];
      const circuitsToAdd: Array<{
        description: string;
        breaker_amps: number;
        load_va: number;
        poles: number;
        circuit_number: number;
        conductor_size: string;
        load_type_code: string;
      }> = [];

      // Calculate how many circuits to add (respecting both load and slot limits)
      let addedLoadVA = 0;
      let templateIndex = 0;
      const maxCircuitsByLoad = num_circuits || Math.ceil(remainingLoadVA / 1500); // Estimate ~1500VA per circuit

      console.log('[fill_panel_with_test_loads] Loop limits:', {
        num_circuits,
        maxCircuitsByLoad,
        availableSlotsCount,
        existingCircuitsCount: existingCircuits.length,
      });

      // Early exit if no slots available
      if (availableSlotsCount === 0) {
        const currentUtilization = Math.round((currentLoadVA / panelCapacityVA) * 100);
        return {
          success: false,
          error: `Panel "${panel.name}" has no available slots (all ${totalSlots} slots are occupied). Current utilization: ${currentUtilization}%.`,
        };
      }

      // Early exit if no load capacity
      if (maxCircuitsByLoad === 0) {
        const currentUtilization = Math.round((currentLoadVA / panelCapacityVA) * 100);
        return {
          success: false,
          error: `Panel "${panel.name}" is already at ${currentUtilization}% utilization (target: ${target_utilization}%). No capacity to add circuits.`,
        };
      }

      // Add circuits until we hit load target, slot limit, or run out of available slots
      while (
        circuitsToAdd.length < maxCircuitsByLoad &&
        addedLoadVA < remainingLoadVA
      ) {
        const template = templates[templateIndex % templates.length];
        if (!template) {
          // Shouldn't happen, but guard against it
          break;
        }

        // Find next available slot for this circuit's pole count
        const slotNum = findNextAvailableSlot(template.pole);

        if (slotNum === null) {
          // No more slots available for this pole count
          console.log('[fill_panel_with_test_loads] No more slots for', template.pole, 'pole circuit');

          // Try a 1-pole circuit if we were trying multi-pole
          if (template.pole > 1) {
            const singlePoleSlot = findNextAvailableSlot(1);
            if (singlePoleSlot !== null) {
              // Skip this template and try the next one
              templateIndex++;
              continue;
            }
          }
          // No slots available at all, stop adding
          break;
        }

        // Determine conductor size based on breaker
        const conductorSize = template.breaker <= 15 ? '14 AWG' :
                              template.breaker <= 20 ? '12 AWG' :
                              template.breaker <= 30 ? '10 AWG' :
                              template.breaker <= 40 ? '8 AWG' :
                              template.breaker <= 50 ? '6 AWG' : '4 AWG';

        circuitsToAdd.push({
          description: `${template.description} #${Math.floor(templateIndex / templates.length) + 1}`,
          breaker_amps: template.breaker,
          load_va: template.loadVA,
          poles: template.pole,
          circuit_number: slotNum,
          conductor_size: conductorSize,
          load_type_code: template.loadTypeCode,
        });

        // Mark the slots as occupied for future iterations
        for (let i = 0; i < template.pole; i++) {
          occupiedSlots.add(slotNum + (i * 2));
        }

        addedLoadVA += template.loadVA;
        templateIndex++;
      }

      console.log('[fill_panel_with_test_loads] After loop:', {
        circuitsToAddCount: circuitsToAdd.length,
        addedLoadVA,
        remainingLoadVA,
        finalOccupiedSlots: occupiedSlots.size,
      });

      if (circuitsToAdd.length === 0) {
        const currentUtilization = Math.round((currentLoadVA / panelCapacityVA) * 100);
        console.log('[fill_panel_with_test_loads] No circuits added after loop:', {
          currentUtilization,
          target_utilization,
          maxCircuitsByLoad,
          remainingLoadVA,
          addedLoadVA,
          availableSlotsCount,
        });

        if (currentUtilization >= target_utilization) {
          return {
            success: false,
            error: `Panel "${panel.name}" is already at ${currentUtilization}% utilization, which meets or exceeds the target of ${target_utilization}%. No circuits needed.`,
          };
        } else if (availableSlotsCount === 0) {
          return {
            success: false,
            error: `Panel "${panel.name}" has no available slots. All ${totalSlots} slots are occupied.`,
          };
        } else {
          return {
            success: false,
            error: `Unable to add circuits to "${panel.name}". ${availableSlotsCount} slots available, but couldn't fit any circuits. Please check panel configuration.`,
          };
        }
      }

      // Insert circuits
      try {
        console.log('[fill_panel_with_test_loads] Inserting', circuitsToAdd.length, 'circuits');

        const circuitData = circuitsToAdd.map(c => ({
          project_id: context.projectId,
          panel_id: dbPanel.id,
          circuit_number: c.circuit_number,
          description: c.description,
          breaker_amps: c.breaker_amps,
          load_watts: c.load_va,
          pole: c.poles,
          conductor_size: c.conductor_size,
          load_type: c.load_type_code, // Single-character code: L, R, M, H, C, W, K, O
        }));

        console.log('[fill_panel_with_test_loads] Circuit data sample:', circuitData[0]);

        const { data: newCircuits, error } = await supabase
          .from('circuits')
          .insert(circuitData as any[])
          .select();

        if (error) {
          console.error('[fill_panel_with_test_loads] Insert error:', error);
          return { success: false, error: `Failed to add circuits: ${error.message}` };
        }

        console.log('[fill_panel_with_test_loads] Success! Added', newCircuits?.length, 'circuits');

        const newTotalLoad = currentLoadVA + addedLoadVA;
        const newUtilization = Math.round((newTotalLoad / panelCapacityVA) * 100);

        const slotsUsedByNewCircuits = circuitsToAdd.reduce((sum, c) => sum + c.poles, 0);
        const finalSlotsRemaining = totalSlots - occupiedSlots.size;

        return {
          success: true,
          data: {
            message: `Added ${circuitsToAdd.length} test circuits to ${panel.name}`,
            panelName: panel.name,
            circuitsAdded: circuitsToAdd.length,
            loadAdded: `${Math.round(addedLoadVA / 1000)} kVA`,
            previousUtilization: `${Math.round((currentLoadVA / panelCapacityVA) * 100)}%`,
            newUtilization: `${newUtilization}%`,
            totalSlots,
            slotsUsed: occupiedSlots.size,
            slotsRemaining: finalSlotsRemaining,
            circuits: circuitsToAdd.map(c => ({
              slot: c.circuit_number,
              description: c.description,
              breaker: `${c.breaker_amps}A/${c.poles}P`,
              load: `${c.load_va}VA`,
            })),
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to add circuits: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  // -------------------------------------------------------------------------
  // EMPTY PANEL (Clear all circuits)
  // -------------------------------------------------------------------------
  {
    name: 'empty_panel',
    description: `Remove circuits from a panel. By default, preserves feeder circuits that feed sub-panels.
Use preserve_feeders=false to delete everything including feeder breakers.
Examples: "empty panel H7", "clear the MDP", "delete all circuits from Panel A"`,
    parameters: {
      type: 'object',
      properties: {
        panel_name: { type: 'string', description: 'Name of the panel to empty (e.g., "Panel H7", "MDP", "Panel A")' },
        preserve_feeders: { type: 'boolean', description: 'Keep feeder circuits that feed sub-panels (default: true)' },
      },
      required: ['panel_name'],
    },
    requiresConfirmation: true,
    execute: async (params, context) => {
      const { panel_name, preserve_feeders = true } = params as { panel_name: string; preserve_feeders?: boolean };

      if (!context.projectId) {
        return { success: false, error: 'No project selected.' };
      }

      // Find the panel
      let panel = context.projectContext.panels.find(
        p => p.name.toLowerCase() === panel_name.toLowerCase()
      );
      if (!panel) {
        panel = context.projectContext.panels.find(
          p => p.name.toLowerCase().includes(panel_name.toLowerCase()) ||
               panel_name.toLowerCase().includes(p.name.toLowerCase())
        );
      }
      // Handle MDP abbreviation
      if (!panel && panel_name.toLowerCase() === 'mdp') {
        panel = context.projectContext.panels.find(p => p.isMain);
      }

      if (!panel) {
        const available = context.projectContext.panels.map(p => p.name).join(', ');
        return {
          success: false,
          error: `Panel "${panel_name}" not found. Available panels: ${available || 'None'}`,
        };
      }

      // Get panel ID from database
      const { data: dbPanel } = await supabase
        .from('panels')
        .select('id')
        .eq('project_id', context.projectId)
        .eq('name', panel.name)
        .single();

      if (!dbPanel) {
        return { success: false, error: 'Panel not found in database.' };
      }

      // Find downstream panels fed from this panel (to identify feeder circuits)
      const { data: downstreamPanels } = await supabase
        .from('panels')
        .select('id, name, fed_from_circuit_number, phase')
        .eq('project_id', context.projectId)
        .eq('fed_from', dbPanel.id)
        .not('fed_from_circuit_number', 'is', null);

      // Build set of protected circuit numbers (feeder slots)
      const feederCircuitNumbers = new Set<number>();
      const feederDetails: Array<{ name: string; circuitNumber: number }> = [];

      if (preserve_feeders && downstreamPanels && downstreamPanels.length > 0) {
        for (const dp of downstreamPanels) {
          if (dp.fed_from_circuit_number) {
            // Add the base slot
            feederCircuitNumbers.add(dp.fed_from_circuit_number);
            feederDetails.push({ name: dp.name, circuitNumber: dp.fed_from_circuit_number });

            // Add additional slots for multi-pole feeders (typically 2P or 3P)
            const feederPoles = dp.phase === 3 ? 3 : 2;
            for (let i = 1; i < feederPoles; i++) {
              feederCircuitNumbers.add(dp.fed_from_circuit_number + (i * 2));
            }
          }
        }
      }

      // Get existing circuits
      const existingCircuits = context.projectContext.circuits.filter(c => c.panelName === panel!.name);
      const circuitCount = existingCircuits.length;

      if (circuitCount === 0) {
        return {
          success: true,
          data: {
            message: `Panel "${panel.name}" is already empty.`,
            panelName: panel.name,
            circuitsDeleted: 0,
          },
        };
      }

      // Determine which circuits to delete
      const circuitsToDelete = preserve_feeders
        ? existingCircuits.filter(c => !feederCircuitNumbers.has(c.circuitNumber))
        : existingCircuits;

      const circuitsPreserved = existingCircuits.length - circuitsToDelete.length;

      if (circuitsToDelete.length === 0) {
        return {
          success: true,
          data: {
            message: `No circuits deleted. All ${circuitCount} circuits in "${panel.name}" are feeder breakers for sub-panels.`,
            panelName: panel.name,
            circuitsDeleted: 0,
            feedersPreserved: feederDetails,
            hint: 'Use preserve_feeders=false to delete feeder circuits too.',
          },
        };
      }

      try {
        // Delete circuits (excluding feeders if preserve_feeders is true)
        const circuitIdsToDelete = circuitsToDelete.map(c => c.id);

        const { error } = await supabase
          .from('circuits')
          .delete()
          .in('id', circuitIdsToDelete);

        if (error) {
          return { success: false, error: `Failed to delete circuits: ${error.message}` };
        }

        const response: any = {
          message: `Removed ${circuitsToDelete.length} circuits from ${panel.name}`,
          panelName: panel.name,
          circuitsDeleted: circuitsToDelete.length,
        };

        if (circuitsPreserved > 0) {
          response.feedersPreserved = feederDetails;
          response.note = `${circuitsPreserved} feeder circuit(s) preserved for sub-panels: ${feederDetails.map(f => f.name).join(', ')}`;
        }

        return {
          success: true,
          data: response,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to empty panel: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  // -------------------------------------------------------------------------
  // FILL WITH SPARES
  // -------------------------------------------------------------------------
  {
    name: 'fill_with_spares',
    description: `Fill remaining empty slots in a panel with SPARE circuits (no load, placeholder breakers).
Use this when the user wants to complete a panel schedule with spare positions.
Examples: "fill the rest with spares", "add spare circuits to panel H7", "fill remaining slots with spares"`,
    parameters: {
      type: 'object',
      properties: {
        panel_name: { type: 'string', description: 'Name of the panel to fill with spares' },
        breaker_amps: { type: 'number', description: 'Breaker size for spares (default: 20A)' },
      },
      required: ['panel_name'],
    },
    requiresConfirmation: true,
    execute: async (params, context) => {
      const { panel_name, breaker_amps = 20 } = params as { panel_name: string; breaker_amps?: number };

      if (!context.projectId) {
        return { success: false, error: 'No project selected.' };
      }

      // Find the panel
      let panel = context.projectContext.panels.find(
        p => p.name.toLowerCase() === panel_name.toLowerCase()
      );
      if (!panel) {
        panel = context.projectContext.panels.find(
          p => p.name.toLowerCase().includes(panel_name.toLowerCase()) ||
               panel_name.toLowerCase().includes(p.name.toLowerCase())
        );
      }
      if (!panel && panel_name.toLowerCase() === 'mdp') {
        panel = context.projectContext.panels.find(p => p.isMain);
      }

      if (!panel) {
        const available = context.projectContext.panels.map(p => p.name).join(', ');
        return {
          success: false,
          error: `Panel "${panel_name}" not found. Available panels: ${available || 'None'}`,
        };
      }

      // Get panel ID from database
      const { data: dbPanel } = await supabase
        .from('panels')
        .select('id')
        .eq('project_id', context.projectId)
        .eq('name', panel.name)
        .single();

      if (!dbPanel) {
        return { success: false, error: 'Panel not found in database.' };
      }

      // Panel slot count: MDP/Main = 30 slots, Branch panels = 42 slots
      const totalSlots = panel.isMain ? 30 : 42;

      // Calculate occupied slots
      const existingCircuits = context.projectContext.circuits.filter(c => c.panelName === panel!.name);
      const occupiedSlots = new Set<number>();
      for (const ckt of existingCircuits) {
        occupiedSlots.add(ckt.circuitNumber);
        const pole = ckt.pole || 1;
        if (pole > 1) {
          for (let i = 1; i < pole; i++) {
            occupiedSlots.add(ckt.circuitNumber + (i * 2));
          }
        }
      }

      // Find all empty slots
      const emptySlots: number[] = [];
      for (let slot = 1; slot <= totalSlots; slot++) {
        if (!occupiedSlots.has(slot)) {
          emptySlots.push(slot);
        }
      }

      if (emptySlots.length === 0) {
        return {
          success: true,
          data: {
            message: `Panel "${panel.name}" is already full. All ${totalSlots} slots are occupied.`,
            panelName: panel.name,
            sparesAdded: 0,
          },
        };
      }

      // Default conductor size for spares
      const conductorSize = breaker_amps <= 15 ? '14 AWG' :
                            breaker_amps <= 20 ? '12 AWG' :
                            breaker_amps <= 30 ? '10 AWG' : '8 AWG';

      // Create spare circuits for each empty slot
      const spareCircuits = emptySlots.map(slot => ({
        project_id: context.projectId,
        panel_id: dbPanel.id,
        circuit_number: slot,
        description: 'SPARE',
        breaker_amps: breaker_amps,
        load_watts: 0,
        pole: 1,
        conductor_size: conductorSize,
        load_type: 'O', // Other
      }));

      try {
        const { data: newCircuits, error } = await supabase
          .from('circuits')
          .insert(spareCircuits as any[])
          .select();

        if (error) {
          return { success: false, error: `Failed to add spare circuits: ${error.message}` };
        }

        return {
          success: true,
          data: {
            message: `Added ${emptySlots.length} SPARE circuits to ${panel.name}`,
            panelName: panel.name,
            sparesAdded: emptySlots.length,
            breakerSize: `${breaker_amps}A`,
            totalSlots,
            slotsNowOccupied: totalSlots,
            spareSlots: emptySlots,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to add spares: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },
];

/**
 * Get tool definitions in Gemini function calling format
 */
export function getToolDefinitionsForGemini(): Array<{
  name: string;
  description: string;
  parameters: ToolParameters;
}> {
  return CHAT_TOOLS.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

/**
 * Get a tool by name
 */
export function getTool(name: string): ChatTool | undefined {
  return CHAT_TOOLS.find(t => t.name === name);
}

/**
 * Execute a tool by name
 */
export async function executeTool(
  name: string,
  params: Record<string, unknown>,
  context: ToolContext
): Promise<ToolResult> {
  const tool = getTool(name);
  if (!tool) {
    return { success: false, error: `Unknown tool: ${name}` };
  }

  try {
    return await tool.execute(params, context);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Tool execution failed',
    };
  }
}
