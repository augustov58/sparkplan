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
  fedFrom?: string; // Name of panel/transformer/service that feeds this panel
  fedFromType?: 'service' | 'panel' | 'transformer';
  downstreamPanels?: string[]; // Names of panels fed from this panel
  downstreamTransformers?: string[]; // Names of transformers fed from this panel
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
  // Build panel summaries with hierarchy information
  const panelSummaries: PanelSummary[] = panels.map(panel => {
    const panelCircuits = circuits.filter(c => c.panel_id === panel.id);
    const totalLoadVA = panelCircuits.reduce((sum, c) => sum + (c.load_watts || 0), 0);
    
    // Find what feeds this panel
    let fedFrom: string | undefined;
    if (panel.fed_from_type === 'service') {
      fedFrom = 'Service Entrance';
    } else if (panel.fed_from_type === 'panel' && panel.fed_from) {
      const parentPanel = panels.find(p => p.id === panel.fed_from);
      fedFrom = parentPanel?.name;
    } else if (panel.fed_from_type === 'transformer' && panel.fed_from_transformer_id) {
      const parentTransformer = transformers.find(t => t.id === panel.fed_from_transformer_id);
      fedFrom = parentTransformer?.name;
    }
    
    // Find what this panel feeds (downstream panels and transformers)
    const downstreamPanels = panels
      .filter(p => p.fed_from_type === 'panel' && p.fed_from === panel.id)
      .map(p => p.name);
    
    const downstreamTransformers = transformers
      .filter(t => t.fed_from_panel_id === panel.id)
      .map(t => t.name);
    
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
      fedFrom,
      fedFromType: panel.fed_from_type || undefined,
      downstreamPanels: downstreamPanels.length > 0 ? downstreamPanels : undefined,
      downstreamTransformers: downstreamTransformers.length > 0 ? downstreamTransformers : undefined,
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
      // totalLoadVA removed - field doesn't exist in database schema
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

  // Helper to get panel load
  const getPanelLoad = (panelId: string) => {
    const panelCircuits = circuits.filter(c => c.panel_id === panelId);
    return panelCircuits.reduce((sum, c) => sum + (c.load_watts || 0), 0);
  };

  // Build summary text with hierarchy
  const mainPanel = panels.find(p => p.is_main);
  
  // Build hierarchy tree text
  let hierarchyText = '';
  if (mainPanel) {
    hierarchyText = `\n\nHIERARCHY (Power Flow):\n`;
    hierarchyText += `Service (${serviceVoltage}V ${servicePhase === 3 ? '3-phase' : 'single-phase'})\n`;
    hierarchyText += `  └─ ${mainPanel.name} (MDP - ${mainPanel.bus_rating}A bus, ${mainPanel.main_breaker_amps || 'MLO'}A main)\n`;
    
    // Find panels fed from MDP
    const mdpPanels = panels.filter(p => p.fed_from_type === 'panel' && p.fed_from === mainPanel.id);
    const mdpTransformers = transformers.filter(t => t.fed_from_panel_id === mainPanel.id);
    
    mdpPanels.forEach((panel, idx) => {
      const isLast = idx === mdpPanels.length - 1 && mdpTransformers.length === 0;
      const panelLoad = getPanelLoad(panel.id);
      hierarchyText += `     ${isLast ? '└' : '├'}─ ${panel.name} (${panel.voltage}V ${panel.phase}φ, ${panel.bus_rating}A bus, ${panel.main_breaker_amps || 'MLO'}A main, ${Math.round(panelLoad / 1000)}kVA load)\n`;
      
      // Find downstream from this panel
      const downstreamPanels = panels.filter(p => p.fed_from_type === 'panel' && p.fed_from === panel.id);
      const downstreamTransformers = transformers.filter(t => t.fed_from_panel_id === panel.id);
      
      downstreamPanels.forEach((subPanel, subIdx) => {
        const isLastSub = subIdx === downstreamPanels.length - 1 && downstreamTransformers.length === 0;
        const subPanelLoad = getPanelLoad(subPanel.id);
        hierarchyText += `     ${isLast ? ' ' : '│'}    ${isLastSub ? '└' : '├'}─ ${subPanel.name} (${subPanel.voltage}V ${subPanel.phase}φ, ${subPanel.bus_rating}A bus, ${subPanel.main_breaker_amps || 'MLO'}A main, ${Math.round(subPanelLoad / 1000)}kVA load)\n`;
      });
      
      downstreamTransformers.forEach((xfmr, xfmrIdx) => {
        const isLastXfmr = xfmrIdx === downstreamTransformers.length - 1;
        hierarchyText += `     ${isLast ? ' ' : '│'}    ${isLastXfmr ? '└' : '├'}─ ${xfmr.name} (${xfmr.kva_rating}kVA, ${xfmr.primary_voltage}V→${xfmr.secondary_voltage}V)\n`;
        
        // Find panels fed from this transformer
        const xfmrPanels = panels.filter(p => p.fed_from_type === 'transformer' && p.fed_from_transformer_id === xfmr.id);
        xfmrPanels.forEach((xfmrPanel, xfmrPanelIdx) => {
          const isLastXfmrPanel = xfmrPanelIdx === xfmrPanels.length - 1;
          const xfmrPanelLoad = getPanelLoad(xfmrPanel.id);
          hierarchyText += `     ${isLast ? ' ' : '│'}    ${isLastXfmr ? ' ' : '│'}    ${isLastXfmrPanel ? '└' : '├'}─ ${xfmrPanel.name} (${xfmrPanel.voltage}V ${xfmrPanel.phase}φ, ${xfmrPanel.bus_rating}A bus, ${xfmrPanel.main_breaker_amps || 'MLO'}A main, ${Math.round(xfmrPanelLoad / 1000)}kVA load)\n`;
        });
      });
    });
    
    mdpTransformers.forEach((xfmr, idx) => {
      const isLast = idx === mdpTransformers.length - 1;
      hierarchyText += `     ${isLast ? '└' : '├'}─ ${xfmr.name} (${xfmr.kva_rating}kVA, ${xfmr.primary_voltage}V→${xfmr.secondary_voltage}V)\n`;
      
      const xfmrPanels = panels.filter(p => p.fed_from_type === 'transformer' && p.fed_from_transformer_id === xfmr.id);
      xfmrPanels.forEach((xfmrPanel, xfmrPanelIdx) => {
        const isLastXfmrPanel = xfmrPanelIdx === xfmrPanels.length - 1;
        const xfmrPanelLoad = getPanelLoad(xfmrPanel.id);
        hierarchyText += `     ${isLast ? ' ' : '│'}    ${isLastXfmrPanel ? '└' : '├'}─ ${xfmrPanel.name} (${xfmrPanel.voltage}V ${xfmrPanel.phase}φ, ${xfmrPanel.bus_rating}A bus, ${xfmrPanel.main_breaker_amps || 'MLO'}A main, ${Math.round(xfmrPanelLoad / 1000)}kVA load)\n`;
      });
    });
  }
  
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
${transformers.length > 0 ? `Transformers: ${transformers.length}` : ''}${hierarchyText}
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

  // Add panel details with hierarchy (most important)
  if (context.panels.length > 0) {
    prompt += `PANELS (with hierarchy - which panel feeds which):\n`;
    
    // Sort: MDP first, then by hierarchy level
    const sortedPanels = [...context.panels].sort((a, b) => {
      if (a.isMain) return -1;
      if (b.isMain) return 1;
      return 0;
    });
    
    sortedPanels.forEach(panel => {
      prompt += `- ${panel.name}${panel.isMain ? ' (MDP - Main Distribution Panel)' : ''}: ${panel.voltage}V ${panel.phase}φ, ${panel.busRating}A bus`;
      if (panel.mainBreaker) prompt += `, ${panel.mainBreaker}A main`;
      prompt += `, ${panel.circuitCount} circuits, ${Math.round(panel.totalLoadVA / 1000)}kVA load`;
      
      // Show what feeds this panel
      if (panel.fedFrom) {
        prompt += `\n  └─ Fed from: ${panel.fedFrom}`;
      }
      
      // Show what this panel feeds
      if (panel.downstreamPanels && panel.downstreamPanels.length > 0) {
        prompt += `\n  └─ Feeds panels: ${panel.downstreamPanels.join(', ')}`;
      }
      if (panel.downstreamTransformers && panel.downstreamTransformers.length > 0) {
        prompt += `\n  └─ Feeds transformers: ${panel.downstreamTransformers.join(', ')}`;
      }
      
      if (panel.location) prompt += `, Location: ${panel.location}`;
      prompt += `\n`;
    });
    prompt += `\n`;
  }

  // Add circuits (show all up to 50, which is already the limit from buildProjectContext)
  if (context.circuits.length > 0) {
    prompt += `CIRCUITS (${context.circuits.length} total):\n`;
    context.circuits.forEach(circuit => {
      prompt += `- ${circuit.panelName} Ckt ${circuit.circuitNumber}: ${circuit.description}, ${circuit.breakerAmps}A/${circuit.pole}P, ${circuit.loadWatts}W, ${circuit.conductorSize}\n`;
    });
    prompt += `\n`;
  }

  // Add feeders if any
  if (context.feeders.length > 0) {
    prompt += `FEEDERS:\n`;
    context.feeders.forEach(feeder => {
      prompt += `- ${feeder.name}: ${feeder.sourcePanel} → ${feeder.destinationPanel || feeder.destinationTransformer || 'Unknown'}, ${feeder.phaseConductorSize}`;
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

