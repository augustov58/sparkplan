/**
 * Project Context Builder for AI Assistant
 * 
 * Builds a concise, structured summary of project data for AI context.
 * This allows the NEC Assistant to answer questions about the specific project.
 * 
 * @module services/ai/projectContextBuilder
 */

import type { Database } from '@/lib/database.types';

type Panel = Database['public']['Tables']['panels']['Row'];
type Circuit = Database['public']['Tables']['circuits']['Row'];
type Feeder = Database['public']['Tables']['feeders']['Row'];
type Transformer = Database['public']['Tables']['transformers']['Row'];

export interface ProjectContext {
  projectId: string;
  projectName: string;
  projectType: 'Residential' | 'Commercial' | 'Industrial';
  serviceVoltage: number;
  servicePhase: 1 | 3;
  summary: string;
  panels: PanelSummary[];
  circuits: CircuitSummary[];
  feeders: FeederSummary[];
  transformers: TransformerSummary[];
  totalLoad: {
    connectedVA: number;
    demandVA: number;
  };
}

interface PanelSummary {
  id: string;
  name: string;
  isMain: boolean;
  voltage: number;
  phase: 1 | 3;
  busRating: number;
  mainBreaker?: number;
  circuitCount: number;
  totalLoadVA: number;
  location?: string;
}

interface CircuitSummary {
  id: string;
  panelName: string;
  circuitNumber: number;
  description: string;
  breakerAmps: number;
  pole: 1 | 2 | 3;
  loadWatts: number;
  loadType?: string;
  conductorSize: string;
}

interface FeederSummary {
  id: string;
  name: string;
  sourcePanel: string;
  destinationPanel?: string;
  destinationTransformer?: string;
  phaseConductorSize: string;
  totalLoadVA: number;
  voltageDropPercent?: number;
}

interface TransformerSummary {
  id: string;
  name: string;
  kvaRating: number;
  primaryVoltage: number;
  secondaryVoltage: number;
  fedFromPanel?: string;
}

/**
 * Builds a comprehensive project context for AI assistant
 */
export function buildProjectContext(
  projectId: string,
  projectName: string,
  projectType: 'Residential' | 'Commercial' | 'Industrial',
  serviceVoltage: number,
  servicePhase: 1 | 3,
  panels: Panel[],
  circuits: Circuit[],
  feeders: Feeder[],
  transformers: Transformer[]
): ProjectContext {
  // Build panel summaries
  const panelSummaries: PanelSummary[] = panels.map(panel => {
    const panelCircuits = circuits.filter(c => c.panel_id === panel.id);
    const totalLoadVA = panelCircuits.reduce((sum, c) => sum + (c.load_watts || 0), 0);
    
    return {
      id: panel.id,
      name: panel.name,
      isMain: panel.is_main,
      voltage: panel.voltage,
      phase: panel.phase,
      busRating: panel.bus_rating,
      mainBreaker: panel.main_breaker_amps || undefined,
      circuitCount: panelCircuits.length,
      totalLoadVA,
      location: panel.location || undefined,
    };
  });

  // Build circuit summaries (limit to most important ones)
  const circuitSummaries: CircuitSummary[] = circuits
    .slice(0, 50) // Limit to first 50 to avoid token limits
    .map(circuit => {
      const panel = panels.find(p => p.id === circuit.panel_id);
      return {
        id: circuit.id,
        panelName: panel?.name || 'Unknown',
        circuitNumber: circuit.circuit_number,
        description: circuit.description,
        breakerAmps: circuit.breaker_amps,
        pole: circuit.pole,
        loadWatts: circuit.load_watts || 0,
        loadType: circuit.load_type || undefined,
        conductorSize: circuit.conductor_size,
      };
    });

  // Build feeder summaries
  const feederSummaries: FeederSummary[] = feeders.map(feeder => {
    const sourcePanel = panels.find(p => p.id === feeder.source_panel_id);
    const destPanel = feeder.destination_panel_id
      ? panels.find(p => p.id === feeder.destination_panel_id)
      : undefined;
    const destTransformer = feeder.destination_transformer_id
      ? transformers.find(t => t.id === feeder.destination_transformer_id)
      : undefined;
    
    return {
      id: feeder.id,
      name: feeder.name,
      sourcePanel: sourcePanel?.name || 'Unknown',
      destinationPanel: destPanel?.name,
      destinationTransformer: destTransformer?.name,
      phaseConductorSize: feeder.phase_conductor_size || 'Not calculated',
      totalLoadVA: feeder.total_load_va || 0,
      voltageDropPercent: feeder.voltage_drop_percent || undefined,
    };
  });

  // Build transformer summaries
  const transformerSummaries: TransformerSummary[] = transformers.map(xfmr => {
    const fedFromPanel = xfmr.fed_from_panel_id
      ? panels.find(p => p.id === xfmr.fed_from_panel_id)
      : undefined;
    
    return {
      id: xfmr.id,
      name: xfmr.name,
      kvaRating: xfmr.kva_rating,
      primaryVoltage: xfmr.primary_voltage,
      secondaryVoltage: xfmr.secondary_voltage,
      fedFromPanel: fedFromPanel?.name,
    };
  });

  // Calculate total load
  const totalConnectedVA = circuits.reduce((sum, c) => sum + (c.load_watts || 0), 0);
  // Estimate demand load (simplified - actual calculation is more complex)
  const totalDemandVA = totalConnectedVA * 0.8; // Rough 80% demand factor estimate

  // Build summary text
  const mainPanel = panels.find(p => p.is_main);
  const summary = `
PROJECT: ${projectName}
Type: ${projectType}
Service: ${serviceVoltage}V ${servicePhase === 3 ? '3-phase' : 'single-phase'}
${mainPanel ? `Main Panel: ${mainPanel.name} (${mainPanel.bus_rating}A bus, ${mainPanel.main_breaker_amps || 'MLO'}A main)` : 'No main panel configured'}
Total Panels: ${panels.length}
Total Circuits: ${circuits.length}
Total Connected Load: ${Math.round(totalConnectedVA / 1000)} kVA
Estimated Demand Load: ${Math.round(totalDemandVA / 1000)} kVA
${feeders.length > 0 ? `Feeders: ${feeders.length}` : ''}
${transformers.length > 0 ? `Transformers: ${transformers.length}` : ''}
  `.trim();

  return {
    projectId,
    projectName,
    projectType,
    serviceVoltage,
    servicePhase,
    summary,
    panels: panelSummaries,
    circuits: circuitSummaries,
    feeders: feederSummaries,
    transformers: transformerSummaries,
    totalLoad: {
      connectedVA: totalConnectedVA,
      demandVA: totalDemandVA,
    },
  };
}

/**
 * Formats project context into a concise text prompt for AI
 */
export function formatContextForAI(context: ProjectContext): string {
  let prompt = `\n\n=== PROJECT CONTEXT ===\n${context.summary}\n\n`;

  // Add panel details (most important)
  if (context.panels.length > 0) {
    prompt += `PANELS:\n`;
    context.panels.forEach(panel => {
      prompt += `- ${panel.name}${panel.isMain ? ' (MDP)' : ''}: ${panel.voltage}V ${panel.phase}φ, ${panel.busRating}A bus`;
      if (panel.mainBreaker) prompt += `, ${panel.mainBreaker}A main`;
      prompt += `, ${panel.circuitCount} circuits, ${Math.round(panel.totalLoadVA / 1000)}kVA load`;
      if (panel.location) prompt += `, Location: ${panel.location}`;
      prompt += `\n`;
    });
    prompt += `\n`;
  }

  // Add key circuits (if user asks about specific circuits)
  if (context.circuits.length > 0 && context.circuits.length <= 20) {
    prompt += `KEY CIRCUITS:\n`;
    context.circuits.slice(0, 10).forEach(circuit => {
      prompt += `- ${circuit.panelName} Ckt ${circuit.circuitNumber}: ${circuit.description}, ${circuit.breakerAmps}A/${circuit.pole}P, ${circuit.loadWatts}W, ${circuit.conductorSize}\n`;
    });
    if (context.circuits.length > 10) {
      prompt += `... and ${context.circuits.length - 10} more circuits\n`;
    }
    prompt += `\n`;
  }

  // Add feeders if any
  if (context.feeders.length > 0) {
    prompt += `FEEDERS:\n`;
    context.feeders.forEach(feeder => {
      prompt += `- ${feeder.name}: ${feeder.sourcePanel} → ${feeder.destinationPanel || feeder.destinationTransformer || 'Unknown'}, ${feeder.phaseConductorSize}, ${Math.round(feeder.totalLoadVA / 1000)}kVA`;
      if (feeder.voltageDropPercent) {
        prompt += `, ${feeder.voltageDropPercent.toFixed(1)}% VD`;
      }
      prompt += `\n`;
    });
    prompt += `\n`;
  }

  // Add transformers if any
  if (context.transformers.length > 0) {
    prompt += `TRANSFORMERS:\n`;
    context.transformers.forEach(xfmr => {
      prompt += `- ${xfmr.name}: ${xfmr.kvaRating}kVA, ${xfmr.primaryVoltage}V → ${xfmr.secondaryVoltage}V`;
      if (xfmr.fedFromPanel) prompt += `, fed from ${xfmr.fedFromPanel}`;
      prompt += `\n`;
    });
    prompt += `\n`;
  }

  prompt += `=== END PROJECT CONTEXT ===\n`;

  return prompt;
}

/**
 * Builds a minimal context (just project basics) for when full data isn't needed
 */
export function buildMinimalContext(
  projectName: string,
  projectType: 'Residential' | 'Commercial' | 'Industrial',
  serviceVoltage: number,
  servicePhase: 1 | 3
): string {
  return `
PROJECT: ${projectName}
Type: ${projectType}
Service: ${serviceVoltage}V ${servicePhase === 3 ? '3-phase' : 'single-phase'}
  `.trim();
}

