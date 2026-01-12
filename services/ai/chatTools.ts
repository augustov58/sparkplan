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
  // VOLTAGE DROP CALCULATOR
  // -------------------------------------------------------------------------
  {
    name: 'calculate_voltage_drop',
    description: `Calculate voltage drop for a circuit. Can specify by:
- circuit_id: specific circuit UUID
- circuit_number + panel_name: circuit number in a specific panel
- selector: "highest_load" to find the circuit with highest load`,
    parameters: {
      type: 'object',
      properties: {
        circuit_id: { type: 'string', description: 'Specific circuit UUID' },
        circuit_number: { type: 'number', description: 'Circuit number in the panel' },
        panel_name: { type: 'string', description: 'Name of the panel containing the circuit' },
        selector: {
          type: 'string',
          description: 'Special selector: "highest_load", "longest", or "worst"',
          enum: ['highest_load', 'longest', 'worst'],
        },
      },
    },
    execute: async (params, context) => {
      const found = findCircuit(params as any, context.projectContext);
      if (!found) {
        return { success: false, error: 'Circuit not found. Please specify a valid circuit number and panel name.' };
      }

      const { circuit, panel } = found;
      const voltage = panel.voltage || 120;
      const loadAmps = circuit.loadWatts / voltage;

      // Simplified voltage drop calculation
      // VD% = (2 × K × I × D) / (CM) where K=12.9 for Cu
      // Using simplified formula based on conductor size
      const conductorResistance: Record<string, number> = {
        '14': 3.14,
        '12': 1.98,
        '10': 1.24,
        '8': 0.778,
        '6': 0.491,
        '4': 0.308,
        '2': 0.194,
      };

      const sizeMatch = circuit.conductorSize.match(/(\d+)/);
      const size = sizeMatch?.[1] ?? '12';
      const resistance = conductorResistance[size as keyof typeof conductorResistance] || 1.98;

      // Assume 100ft if no length data
      const length = 100;
      const voltageDropVolts = (2 * loadAmps * length * resistance) / 1000;
      const voltageDropPercent = (voltageDropVolts / voltage) * 100;

      return {
        success: true,
        data: {
          circuitName: circuit.description,
          circuitNumber: circuit.circuitNumber,
          panelName: circuit.panelName,
          voltage,
          loadWatts: circuit.loadWatts,
          loadAmps: Math.round(loadAmps * 10) / 10,
          conductorSize: circuit.conductorSize,
          assumedLength: length,
          voltageDropVolts: Math.round(voltageDropVolts * 100) / 100,
          voltageDropPercent: Math.round(voltageDropPercent * 100) / 100,
          compliant: voltageDropPercent <= 3,
          necReference: 'NEC 210.19(A)(1) Informational Note No. 4',
          recommendation: voltageDropPercent > 3
            ? `Consider increasing conductor size or reducing circuit length. Target: ≤3% for branch circuits.`
            : 'Voltage drop is within acceptable limits.',
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
