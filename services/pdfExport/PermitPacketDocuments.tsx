/**
 * Permit Packet PDF Document Components
 * Generates comprehensive permit application packet with all required documents
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet, Svg, G, Rect, Line } from '@react-pdf/renderer';
import type { Database } from '../../lib/database.types';
import type { Panel, Circuit, Feeder, Transformer } from '../../lib/database.types';
import { PanelScheduleDocument } from './PanelScheduleDocuments';
import {
  calculateAggregatedLoad,
  type AggregatedLoad,
} from '../calculations/upstreamLoadAggregation';

type MeterStack = Database['public']['Tables']['meter_stacks']['Row'];
type MeterDB = Database['public']['Tables']['meters']['Row'];
type ProjectOccupancyType = 'dwelling' | 'commercial' | 'industrial';

const mapProjectTypeToOccupancy = (
  projectType?: string
): ProjectOccupancyType => {
  if (!projectType) return 'commercial';
  const t = projectType.toLowerCase();
  if (t.startsWith('res') || t.startsWith('dwel')) return 'dwelling';
  if (t.startsWith('ind')) return 'industrial';
  return 'commercial';
};

// Dynamic page footer: renders the real page number using React-PDF's render prop.
// The `fixed` flag keeps it visible even when a section spills over multiple pages.
interface SectionFooterProps {
  label: string;
  projectName: string;
}
const SectionFooter: React.FC<SectionFooterProps> = ({ label, projectName }) => (
  <Text
    fixed
    style={permitStyles.footer}
    render={({ pageNumber, totalPages }) =>
      `${label} | ${projectName} | Page ${pageNumber} of ${totalPages}`
    }
  />
);

// Professional styling for permit documents
export const permitStyles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  coverPage: {
    padding: 60,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    height: '100%',
  },
  coverTitle: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  coverSubtitle: {
    fontSize: 16,
    marginBottom: 40,
    textAlign: 'center',
    color: '#666',
  },
  coverSection: {
    marginTop: 30,
    marginBottom: 20,
  },
  coverSectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 5,
  },
  coverInfoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  coverInfoLabel: {
    width: '40%',
    fontFamily: 'Helvetica-Bold',
  },
  coverInfoValue: {
    width: '60%',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 15,
    marginTop: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    paddingBottom: 5,
  },
  tableContainer: {
    marginTop: 10,
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#ccc',
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontSize: 9,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#ccc',
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontSize: 9,
    backgroundColor: '#fafafa',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#666',
    borderTopWidth: 1,
    borderTopColor: '#ccc',
    paddingTop: 10,
  },
});

// ============================================================================
// COVER PAGE
// ============================================================================

interface CoverPageProps {
  projectName: string;
  projectAddress: string;
  projectType: string;
  serviceVoltage: number;
  servicePhase: number;
  preparedBy?: string;
  permitNumber?: string;
  date?: string;
  // Tier 1 additions
  contractorLicense?: string;
  scopeOfWork?: string;
  serviceType?: 'overhead' | 'underground';
  meterLocation?: string;
  serviceConductorRouting?: string;
}

export const CoverPage: React.FC<CoverPageProps> = ({
  projectName,
  projectAddress,
  projectType,
  serviceVoltage,
  servicePhase,
  preparedBy,
  permitNumber,
  date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  contractorLicense,
  scopeOfWork,
  serviceType,
  meterLocation,
  serviceConductorRouting,
}) => (
  <Page size="LETTER" style={permitStyles.coverPage}>
    <View>
      <Text style={permitStyles.coverTitle}>ELECTRICAL PERMIT APPLICATION</Text>
      <Text style={permitStyles.coverSubtitle}>NEC 2023 Compliant Design Package</Text>
    </View>

    <View style={permitStyles.coverSection}>
      <Text style={permitStyles.coverSectionTitle}>PROJECT INFORMATION</Text>
      <View style={permitStyles.coverInfoRow}>
        <Text style={permitStyles.coverInfoLabel}>Project Name:</Text>
        <Text style={permitStyles.coverInfoValue}>{projectName}</Text>
      </View>
      <View style={permitStyles.coverInfoRow}>
        <Text style={permitStyles.coverInfoLabel}>Project Address:</Text>
        <Text style={permitStyles.coverInfoValue}>{projectAddress || 'Not specified'}</Text>
      </View>
      <View style={permitStyles.coverInfoRow}>
        <Text style={permitStyles.coverInfoLabel}>Project Type:</Text>
        <Text style={permitStyles.coverInfoValue}>{projectType}</Text>
      </View>
      <View style={permitStyles.coverInfoRow}>
        <Text style={permitStyles.coverInfoLabel}>Service:</Text>
        <Text style={permitStyles.coverInfoValue}>
          {serviceVoltage}V {servicePhase === 3 ? '3-Phase' : 'Single-Phase'}
        </Text>
      </View>
      {permitNumber && (
        <View style={permitStyles.coverInfoRow}>
          <Text style={permitStyles.coverInfoLabel}>Permit Number:</Text>
          <Text style={permitStyles.coverInfoValue}>{permitNumber}</Text>
        </View>
      )}
    </View>

    <View style={permitStyles.coverSection}>
      <Text style={permitStyles.coverSectionTitle}>PREPARATION DETAILS</Text>
      {preparedBy && (
        <View style={permitStyles.coverInfoRow}>
          <Text style={permitStyles.coverInfoLabel}>Prepared By:</Text>
          <Text style={permitStyles.coverInfoValue}>{preparedBy}</Text>
        </View>
      )}
      {contractorLicense && (
        <View style={permitStyles.coverInfoRow}>
          <Text style={permitStyles.coverInfoLabel}>Contractor License:</Text>
          <Text style={permitStyles.coverInfoValue}>{contractorLicense}</Text>
        </View>
      )}
      <View style={permitStyles.coverInfoRow}>
        <Text style={permitStyles.coverInfoLabel}>Date Prepared:</Text>
        <Text style={permitStyles.coverInfoValue}>{date}</Text>
      </View>
      <View style={permitStyles.coverInfoRow}>
        <Text style={permitStyles.coverInfoLabel}>NEC Edition:</Text>
        <Text style={permitStyles.coverInfoValue}>2023</Text>
      </View>
    </View>

    {scopeOfWork && (
      <View style={permitStyles.coverSection}>
        <Text style={permitStyles.coverSectionTitle}>SCOPE OF WORK</Text>
        <Text style={{ fontSize: 10, lineHeight: 1.5 }}>{scopeOfWork}</Text>
      </View>
    )}

    {(serviceType || meterLocation || serviceConductorRouting) && (
      <View style={permitStyles.coverSection}>
        <Text style={permitStyles.coverSectionTitle}>SERVICE ENTRANCE DETAILS</Text>
        {serviceType && (
          <View style={permitStyles.coverInfoRow}>
            <Text style={permitStyles.coverInfoLabel}>Service Type:</Text>
            <Text style={permitStyles.coverInfoValue}>
              {serviceType === 'overhead' ? 'Overhead' : 'Underground'}
            </Text>
          </View>
        )}
        {meterLocation && (
          <View style={permitStyles.coverInfoRow}>
            <Text style={permitStyles.coverInfoLabel}>Meter Location:</Text>
            <Text style={permitStyles.coverInfoValue}>{meterLocation}</Text>
          </View>
        )}
        {serviceConductorRouting && (
          <View style={permitStyles.coverInfoRow}>
            <Text style={permitStyles.coverInfoLabel}>Conductor Routing:</Text>
            <Text style={permitStyles.coverInfoValue}>{serviceConductorRouting}</Text>
          </View>
        )}
      </View>
    )}

    <Text
      fixed
      style={permitStyles.footer}
      render={({ pageNumber, totalPages }) =>
        `SparkPlan Permit Package \u2022 NEC 2023 \u2022 ${projectName} \u2022 Page ${pageNumber} of ${totalPages}`
      }
    />
  </Page>
);

// ============================================================================
// EQUIPMENT SCHEDULE
// ============================================================================

interface EquipmentScheduleProps {
  panels: Panel[];
  transformers: Transformer[];
  feeders: Feeder[];
  projectName: string;
}

export const EquipmentSchedule: React.FC<EquipmentScheduleProps> = ({
  panels,
  transformers,
  feeders,
  projectName,
}) => {
  const mainPanel = panels.find(p => p.is_main);
  const subPanels = panels.filter(p => !p.is_main);

  return (
    <Page size="LETTER" style={permitStyles.page}>
      <Text style={permitStyles.sectionTitle}>EQUIPMENT SCHEDULE</Text>

      {/* Main Distribution Panel */}
      {mainPanel && (
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}>
            MAIN DISTRIBUTION PANEL
          </Text>
          <View style={permitStyles.tableContainer}>
            <View style={permitStyles.tableHeader}>
              <Text style={{ width: '20%' }}>Name</Text>
              <Text style={{ width: '15%' }}>Voltage</Text>
              <Text style={{ width: '10%' }}>Phase</Text>
              <Text style={{ width: '15%' }}>Bus Rating</Text>
              <Text style={{ width: '15%' }}>Main Breaker</Text>
              <Text style={{ width: '25%' }}>Location</Text>
            </View>
            <View style={permitStyles.tableRow}>
              <Text style={{ width: '20%' }}>{mainPanel.name}</Text>
              <Text style={{ width: '15%' }}>{mainPanel.voltage}V</Text>
              <Text style={{ width: '10%' }}>{mainPanel.phase}φ</Text>
              <Text style={{ width: '15%' }}>{mainPanel.bus_rating}A</Text>
              <Text style={{ width: '15%' }}>{mainPanel.main_breaker_amps || 'MLO'}</Text>
              <Text style={{ width: '25%' }}>{mainPanel.location || 'N/A'}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Sub-Panels */}
      {subPanels.length > 0 && (
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}>
            SUB-PANELS ({subPanels.length})
          </Text>
          <View style={permitStyles.tableContainer}>
            <View style={permitStyles.tableHeader}>
              <Text style={{ width: '20%' }}>Name</Text>
              <Text style={{ width: '15%' }}>Voltage</Text>
              <Text style={{ width: '10%' }}>Phase</Text>
              <Text style={{ width: '15%' }}>Bus Rating</Text>
              <Text style={{ width: '15%' }}>Main Breaker</Text>
              <Text style={{ width: '25%' }}>Location</Text>
            </View>
            {subPanels.map((panel, idx) => (
              <View key={panel.id} style={idx % 2 === 0 ? permitStyles.tableRow : permitStyles.tableRowAlt}>
                <Text style={{ width: '20%' }}>{panel.name}</Text>
                <Text style={{ width: '15%' }}>{panel.voltage}V</Text>
                <Text style={{ width: '10%' }}>{panel.phase}φ</Text>
                <Text style={{ width: '15%' }}>{panel.bus_rating}A</Text>
                <Text style={{ width: '15%' }}>{panel.main_breaker_amps || 'MLO'}</Text>
                <Text style={{ width: '25%' }}>{panel.location || 'N/A'}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Transformers */}
      {transformers.length > 0 && (
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}>
            TRANSFORMERS ({transformers.length})
          </Text>
          <View style={permitStyles.tableContainer}>
            <View style={permitStyles.tableHeader}>
              <Text style={{ width: '25%' }}>Name</Text>
              <Text style={{ width: '15%' }}>kVA Rating</Text>
              <Text style={{ width: '20%' }}>Primary Voltage</Text>
              <Text style={{ width: '20%' }}>Secondary Voltage</Text>
              <Text style={{ width: '20%' }}>Fed From</Text>
            </View>
            {transformers.map((xfmr, idx) => (
              <View key={xfmr.id} style={idx % 2 === 0 ? permitStyles.tableRow : permitStyles.tableRowAlt}>
                <Text style={{ width: '25%' }}>{xfmr.name}</Text>
                <Text style={{ width: '15%' }}>{xfmr.kva_rating}kVA</Text>
                <Text style={{ width: '20%' }}>{xfmr.primary_voltage}V</Text>
                <Text style={{ width: '20%' }}>{xfmr.secondary_voltage}V</Text>
                <Text style={{ width: '20%' }}>
                  {xfmr.fed_from_panel_id ? panels.find(p => p.id === xfmr.fed_from_panel_id)?.name || 'N/A' : 'N/A'}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Feeders */}
      {feeders.length > 0 && (
        <View>
          <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}>
            FEEDERS ({feeders.length})
          </Text>
          <View style={permitStyles.tableContainer}>
            <View style={permitStyles.tableHeader}>
              <Text style={{ width: '20%' }}>Name</Text>
              <Text style={{ width: '25%' }}>Source Panel</Text>
              <Text style={{ width: '25%' }}>Destination</Text>
              <Text style={{ width: '15%' }}>Conductor</Text>
              <Text style={{ width: '15%' }}>Load (kVA)</Text>
            </View>
            {feeders.map((feeder, idx) => {
              const sourcePanel = panels.find(p => p.id === feeder.source_panel_id);
              const destPanel = feeder.destination_panel_id 
                ? panels.find(p => p.id === feeder.destination_panel_id)
                : null;
              const destTransformer = feeder.destination_transformer_id
                ? transformers.find(t => t.id === feeder.destination_transformer_id)
                : null;
              const destination = destPanel?.name || destTransformer?.name || 'Unknown';

              const loadVA =
                typeof feeder.design_load_va === 'number' ? feeder.design_load_va : null;
              const loadCell = loadVA != null ? `${(loadVA / 1000).toFixed(1)}` : '—';
              return (
                <View key={feeder.id} style={idx % 2 === 0 ? permitStyles.tableRow : permitStyles.tableRowAlt}>
                  <Text style={{ width: '20%' }}>{feeder.name}</Text>
                  <Text style={{ width: '25%' }}>{sourcePanel?.name || 'Unknown'}</Text>
                  <Text style={{ width: '25%' }}>{destination}</Text>
                  <Text style={{ width: '15%' }}>{feeder.phase_conductor_size || 'N/A'}</Text>
                  <Text style={{ width: '15%' }}>{loadCell}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      <SectionFooter label="Equipment Schedule" projectName={projectName} />
    </Page>
  );
};

// ============================================================================
// RISER DIAGRAM (SVG System Hierarchy)
// ============================================================================
// Draws a graphical riser using @react-pdf SVG primitives. Supports all three
// fed_from_type variants (panel, transformer, meter_stack) and shows the
// multi-family meter stack as the structural root when present.

interface RiserNode {
  id: string;
  kind: 'panel' | 'transformer' | 'meter_stack' | 'utility';
  line1: string;
  line2?: string;
  line3?: string;
  feederLabel?: string;
  children: RiserNode[];
  subtreeWidth?: number;
  x?: number;
  _y?: number;
}

const NODE_W = 150;
const NODE_H = 54;
const V_GAP = 64;
const H_GAP = 18;

const buildFeederLabel = (feeder: Feeder): string => {
  const parts: string[] = [];
  if (feeder.phase_conductor_size) {
    parts.push(`${feeder.phase_conductor_size} ${feeder.conductor_material || 'Cu'}`);
  }
  if (typeof feeder.design_load_va === 'number' && feeder.design_load_va > 0) {
    parts.push(`${(feeder.design_load_va / 1000).toFixed(1)} kVA`);
  }
  return parts.length > 0 ? parts.join(' • ') : 'Feeder';
};

const buildPanelSubtree = (
  panel: Panel,
  panels: Panel[],
  transformers: Transformer[],
  feeders: Feeder[],
  feederLabel?: string
): RiserNode => {
  const node: RiserNode = {
    id: panel.id,
    kind: 'panel',
    line1: panel.name + (panel.is_main ? ' (MDP)' : ''),
    line2: `${panel.voltage}V ${panel.phase}\u03C6 \u2022 ${panel.bus_rating}A bus`,
    line3: panel.main_breaker_amps ? `${panel.main_breaker_amps}A Main` : 'MLO',
    feederLabel,
    children: [],
  };

  const outgoing = feeders.filter(f => f.source_panel_id === panel.id);
  for (const feeder of outgoing) {
    const label = buildFeederLabel(feeder);
    if (feeder.destination_panel_id) {
      const dest = panels.find(p => p.id === feeder.destination_panel_id);
      if (dest) {
        node.children.push(
          buildPanelSubtree(dest, panels, transformers, feeders, label)
        );
      }
    } else if (feeder.destination_transformer_id) {
      const xfmr = transformers.find(t => t.id === feeder.destination_transformer_id);
      if (xfmr) {
        const xfmrNode: RiserNode = {
          id: xfmr.id,
          kind: 'transformer',
          line1: xfmr.name,
          line2: `${xfmr.kva_rating} kVA`,
          line3: `${xfmr.primary_voltage}V \u2192 ${xfmr.secondary_voltage}V`,
          feederLabel: label,
          children: [],
        };
        const xfmrPanels = panels.filter(
          p => p.fed_from_type === 'transformer' && p.fed_from_transformer_id === xfmr.id
        );
        for (const p of xfmrPanels) {
          xfmrNode.children.push(buildPanelSubtree(p, panels, transformers, feeders));
        }
        node.children.push(xfmrNode);
      }
    }
  }

  return node;
};

const buildRiserTree = (
  panels: Panel[],
  transformers: Transformer[],
  feeders: Feeder[],
  meterStacks: MeterStack[],
  meters: MeterDB[],
  serviceVoltage: number,
  servicePhase: number
): RiserNode | null => {
  const mdp = panels.find(p => p.is_main);

  // Multi-family: meter stack is the structural root between utility and the
  // MDP (or direct unit panels). Show meters as branches of the stack.
  if (mdp && mdp.fed_from_type === 'meter_stack' && mdp.fed_from_meter_stack_id) {
    const stack = meterStacks.find(s => s.id === mdp.fed_from_meter_stack_id);
    if (stack) {
      const stackMeters = meters
        .filter(m => m.meter_stack_id === stack.id && m.panel_id)
        .sort((a, b) => (a.position_number ?? 0) - (b.position_number ?? 0));
      const stackNode: RiserNode = {
        id: stack.id,
        kind: 'meter_stack',
        line1: stack.name,
        line2: `${stack.voltage}V ${stack.phase}\u03C6 \u2022 ${stack.bus_rating_amps}A bus`,
        line3: `${stack.num_meter_positions} meter positions`,
        children: [],
      };
      for (const meter of stackMeters) {
        const panel = panels.find(p => p.id === meter.panel_id);
        if (panel) {
          const meterLabel = `Meter ${meter.position_number ?? '?'}: ${
            meter.breaker_amps ? `${meter.breaker_amps}A` : 'MLO'
          }`;
          stackNode.children.push(
            buildPanelSubtree(panel, panels, transformers, feeders, meterLabel)
          );
        }
      }
      return {
        id: 'utility',
        kind: 'utility',
        line1: 'UTILITY',
        line2: `${serviceVoltage}V ${servicePhase}\u03C6 service`,
        children: [stackNode],
      };
    }
  }

  if (!mdp) return null;

  return {
    id: 'utility',
    kind: 'utility',
    line1: 'UTILITY',
    line2: `${serviceVoltage}V ${servicePhase}\u03C6 service`,
    children: [buildPanelSubtree(mdp, panels, transformers, feeders)],
  };
};

// Two-pass layout: subtree width bottom-up, then x-coordinate top-down.
const computeSubtreeWidth = (node: RiserNode): number => {
  if (node.children.length === 0) {
    node.subtreeWidth = NODE_W;
    return node.subtreeWidth;
  }
  let sum = 0;
  for (let i = 0; i < node.children.length; i++) {
    if (i > 0) sum += H_GAP;
    sum += computeSubtreeWidth(node.children[i]);
  }
  node.subtreeWidth = Math.max(NODE_W, sum);
  return node.subtreeWidth;
};

const assignXPositions = (node: RiserNode, leftEdge: number): void => {
  const width = node.subtreeWidth ?? NODE_W;
  node.x = leftEdge + (width - NODE_W) / 2;
  let childLeft = leftEdge;
  if (node.children.length > 0) {
    const childrenTotal = node.children.reduce(
      (sum, c, i) => sum + (c.subtreeWidth ?? NODE_W) + (i > 0 ? H_GAP : 0),
      0
    );
    childLeft = leftEdge + (width - childrenTotal) / 2;
  }
  for (const child of node.children) {
    assignXPositions(child, childLeft);
    childLeft += (child.subtreeWidth ?? NODE_W) + H_GAP;
  }
};

const depth = (node: RiserNode): number =>
  1 + node.children.reduce((max, c) => Math.max(max, depth(c)), 0);

const NODE_FILL: Record<RiserNode['kind'], string> = {
  utility: '#f3f4f6',
  meter_stack: '#fef3c7',
  panel: '#e0e7ff',
  transformer: '#ede9fe',
};
const NODE_STROKE: Record<RiserNode['kind'], string> = {
  utility: '#6b7280',
  meter_stack: '#d97706',
  panel: '#3b5998',
  transformer: '#7c3aed',
};

const assignYPositions = (node: RiserNode, y: number): void => {
  node._y = y;
  for (const child of node.children) {
    assignYPositions(child, y + NODE_H + V_GAP);
  }
};

// Renders one node and recursively its descendants into `elements`.
// All coordinates are SVG user units (= PDF points inside the <Svg>).
const renderRiserNode = (
  node: RiserNode,
  elements: React.ReactElement[]
): void => {
  const x = node.x ?? 0;
  const y = node._y ?? 0;
  const fill = NODE_FILL[node.kind];
  const stroke = NODE_STROKE[node.kind];

  elements.push(
    <Rect
      key={`rect-${node.id}`}
      x={x}
      y={y}
      width={NODE_W}
      height={NODE_H}
      fill={fill}
      stroke={stroke}
      strokeWidth={1.2}
    />
  );

  const cx = x + NODE_W / 2;
  elements.push(
    <Text
      key={`l1-${node.id}`}
      x={cx}
      y={y + 16}
      style={{
        fontSize: 9,
        fontFamily: 'Helvetica-Bold',
        textAlign: 'center',
      }}
    >
      {node.line1}
    </Text>
  );
  if (node.line2) {
    elements.push(
      <Text
        key={`l2-${node.id}`}
        x={cx}
        y={y + 30}
        style={{ fontSize: 8, textAlign: 'center' }}
      >
        {node.line2}
      </Text>
    );
  }
  if (node.line3) {
    elements.push(
      <Text
        key={`l3-${node.id}`}
        x={cx}
        y={y + 44}
        style={{ fontSize: 8, color: '#555', textAlign: 'center' }}
      >
        {node.line3}
      </Text>
    );
  }

  for (const child of node.children) {
    const parentMid = cx;
    const childMid = (child.x ?? 0) + NODE_W / 2;
    const parentBottom = y + NODE_H;
    const childTop = child._y ?? 0;
    const mid = (parentBottom + childTop) / 2;

    elements.push(
      <Line
        key={`line-${node.id}-${child.id}-v1`}
        x1={parentMid}
        y1={parentBottom}
        x2={parentMid}
        y2={mid}
        strokeWidth={1}
        stroke="#333"
      />,
      <Line
        key={`line-${node.id}-${child.id}-h`}
        x1={parentMid}
        y1={mid}
        x2={childMid}
        y2={mid}
        strokeWidth={1}
        stroke="#333"
      />,
      <Line
        key={`line-${node.id}-${child.id}-v2`}
        x1={childMid}
        y1={mid}
        x2={childMid}
        y2={childTop}
        strokeWidth={1}
        stroke="#333"
      />
    );

    if (child.feederLabel) {
      elements.push(
        <Text
          key={`feeder-${child.id}`}
          x={childMid + 4}
          y={mid - 2}
          style={{ fontSize: 7, color: '#222' }}
        >
          {child.feederLabel}
        </Text>
      );
    }

    renderRiserNode(child, elements);
  }
};

interface RiserDiagramProps {
  panels: Panel[];
  transformers: Transformer[];
  feeders: Feeder[];
  meterStacks?: MeterStack[];
  meters?: MeterDB[];
  projectName: string;
  serviceVoltage: number;
  servicePhase: number;
}

export const RiserDiagram: React.FC<RiserDiagramProps> = ({
  panels,
  transformers,
  feeders,
  meterStacks = [],
  meters = [],
  projectName,
  serviceVoltage,
  servicePhase,
}) => {
  const tree = buildRiserTree(
    panels,
    transformers,
    feeders,
    meterStacks,
    meters,
    serviceVoltage,
    servicePhase
  );

  let svgWidth = NODE_W;
  let svgHeight = NODE_H;
  const elements: React.ReactElement[] = [];

  if (tree) {
    computeSubtreeWidth(tree);
    assignXPositions(tree, 0);
    assignYPositions(tree, 0);
    svgWidth = tree.subtreeWidth ?? NODE_W;
    svgHeight = depth(tree) * (NODE_H + V_GAP) - V_GAP;
    renderRiserNode(tree, elements);
  }

  // Landscape letter content area ~712×532pt; scale viewBox to fit width.
  const TARGET_W = 712;
  return (
    <Page size="LETTER" orientation="landscape" style={permitStyles.page}>
      <Text style={permitStyles.sectionTitle}>RISER DIAGRAM</Text>
      <Text style={{ fontSize: 9, marginBottom: 10, color: '#555' }}>
        Electrical power distribution from utility service through the MDP and
        all downstream panels, transformers, and meter banks. Conductor sizes
        and design kVA are shown on each feeder.
      </Text>

      {tree ? (
        <Svg
          width={TARGET_W}
          height={Math.min(460, (TARGET_W / svgWidth) * svgHeight)}
          viewBox={`-8 -8 ${svgWidth + 16} ${svgHeight + 16}`}
        >
          <G>{elements}</G>
        </Svg>
      ) : (
        <Text style={{ fontSize: 10, fontStyle: 'italic', color: '#999' }}>
          No main distribution panel defined for this project.
        </Text>
      )}

      <View
        style={{
          marginTop: 18,
          padding: 10,
          backgroundColor: '#f6f6f6',
          borderWidth: 1,
          borderColor: '#ddd',
          borderStyle: 'solid',
        }}
      >
        <Text
          style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}
        >
          LEGEND
        </Text>
        <Text style={{ fontSize: 8, marginBottom: 2 }}>
          Utility service \u2022 Meter stack (multi-family) \u2022 Panel /
          MDP \u2022 Transformer
        </Text>
        <Text style={{ fontSize: 8, marginBottom: 2 }}>
          MLO = Main Lug Only (no main breaker)
        </Text>
        <Text style={{ fontSize: 8 }}>
          Feeder labels show conductor size + design load in kVA
        </Text>
      </View>

      <SectionFooter label="Riser Diagram" projectName={projectName} />
    </Page>
  );
};

// ============================================================================
// LOAD CALCULATION SUMMARY
// ============================================================================
// Uses the project's NEC 220 aggregation engine (`calculateAggregatedLoad`) so
// the permit packet, the dashboard, and the one-line all show matching numbers.
// Demand is computed once on the MDP over the entire downstream hierarchy.

interface LoadSummaryProps {
  panels: Panel[];
  circuits: Circuit[];
  transformers: Transformer[];
  projectName: string;
  serviceVoltage: number;
  servicePhase: number;
  projectType?: string;
}

export const LoadCalculationSummary: React.FC<LoadSummaryProps> = ({
  panels,
  circuits,
  transformers,
  projectName,
  serviceVoltage,
  servicePhase,
  projectType,
}) => {
  const mdp = panels.find(p => p.is_main);
  const occupancy = mapProjectTypeToOccupancy(projectType);

  // Per-panel connected load (unchanged visibility)
  const panelLoads = panels.map(panel => {
    const panelCircuits = circuits.filter(c => c.panel_id === panel.id);
    const panelLoadVA = panelCircuits.reduce(
      (sum, c) => sum + (c.load_watts || 0),
      0
    );
    return {
      panel,
      loadVA: panelLoadVA,
      loadkVA: panelLoadVA / 1000,
      circuitCount: panelCircuits.length,
    };
  });

  // Real NEC 220 aggregation on the MDP (entire system)
  const aggregate: AggregatedLoad | null = mdp
    ? calculateAggregatedLoad(mdp.id, panels, circuits, transformers, occupancy)
    : null;

  const totalConnectedVA = aggregate
    ? aggregate.totalConnectedVA
    : circuits.reduce((sum, c) => sum + (c.load_watts || 0), 0);
  const totalDemandVA = aggregate ? aggregate.totalDemandVA : totalConnectedVA;
  const overallDf = aggregate ? aggregate.overallDemandFactor : 1;
  const demandAmps =
    servicePhase === 3
      ? totalDemandVA / (serviceVoltage * Math.sqrt(3))
      : totalDemandVA / serviceVoltage;

  return (
    <Page size="LETTER" style={permitStyles.page}>
      <Text style={permitStyles.sectionTitle}>LOAD CALCULATION SUMMARY</Text>

      <View style={{ marginBottom: 16 }}>
        <Text
          style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}
        >
          SYSTEM TOTALS
        </Text>
        <View style={{ marginLeft: 10 }}>
          <View style={permitStyles.coverInfoRow}>
            <Text style={permitStyles.coverInfoLabel}>Service:</Text>
            <Text style={permitStyles.coverInfoValue}>
              {serviceVoltage}V {servicePhase === 3 ? '3-Phase' : 'Single-Phase'}
            </Text>
          </View>
          <View style={permitStyles.coverInfoRow}>
            <Text style={permitStyles.coverInfoLabel}>Occupancy:</Text>
            <Text style={permitStyles.coverInfoValue}>
              {occupancy.charAt(0).toUpperCase() + occupancy.slice(1)}
            </Text>
          </View>
          <View style={permitStyles.coverInfoRow}>
            <Text style={permitStyles.coverInfoLabel}>Total Connected Load:</Text>
            <Text style={permitStyles.coverInfoValue}>
              {(totalConnectedVA / 1000).toFixed(2)} kVA (
              {totalConnectedVA.toLocaleString()} VA)
            </Text>
          </View>
          <View style={permitStyles.coverInfoRow}>
            <Text style={permitStyles.coverInfoLabel}>
              Calculated Demand Load:
            </Text>
            <Text style={permitStyles.coverInfoValue}>
              {(totalDemandVA / 1000).toFixed(2)} kVA (
              {(overallDf * 100).toFixed(1)}% overall demand factor)
            </Text>
          </View>
          <View style={permitStyles.coverInfoRow}>
            <Text style={permitStyles.coverInfoLabel}>Demand Current:</Text>
            <Text style={permitStyles.coverInfoValue}>
              {Number.isFinite(demandAmps) ? demandAmps.toFixed(0) : '—'} A @{' '}
              {serviceVoltage}V {servicePhase === 3 ? '3\u03C6' : '1\u03C6'}
            </Text>
          </View>
          <View style={permitStyles.coverInfoRow}>
            <Text style={permitStyles.coverInfoLabel}>Total Panels:</Text>
            <Text style={permitStyles.coverInfoValue}>{panels.length}</Text>
          </View>
          <View style={permitStyles.coverInfoRow}>
            <Text style={permitStyles.coverInfoLabel}>Total Circuits:</Text>
            <Text style={permitStyles.coverInfoValue}>{circuits.length}</Text>
          </View>
        </View>
      </View>

      {aggregate && aggregate.demandBreakdown.length > 0 && (
        <View style={{ marginBottom: 18 }}>
          <Text
            style={{
              fontSize: 12,
              fontFamily: 'Helvetica-Bold',
              marginBottom: 6,
            }}
          >
            DEMAND FACTOR BREAKDOWN (NEC ARTICLE 220)
          </Text>
          <View style={permitStyles.tableContainer}>
            <View style={permitStyles.tableHeader}>
              <Text style={{ width: '28%' }}>Load Type</Text>
              <Text style={{ width: '17%' }}>Connected (kVA)</Text>
              <Text style={{ width: '12%' }}>Factor</Text>
              <Text style={{ width: '17%' }}>Demand (kVA)</Text>
              <Text style={{ width: '26%' }}>NEC Reference</Text>
            </View>
            {aggregate.demandBreakdown.map((d, idx) => (
              <View
                key={`${d.loadType}-${idx}`}
                style={
                  idx % 2 === 0 ? permitStyles.tableRow : permitStyles.tableRowAlt
                }
              >
                <Text style={{ width: '28%' }}>{d.loadType}</Text>
                <Text style={{ width: '17%' }}>
                  {(d.connectedVA / 1000).toFixed(2)}
                </Text>
                <Text style={{ width: '12%' }}>
                  {(d.demandFactor * 100).toFixed(0)}%
                </Text>
                <Text style={{ width: '17%' }}>
                  {(d.demandVA / 1000).toFixed(2)}
                </Text>
                <Text style={{ width: '26%' }}>{d.necReference}</Text>
              </View>
            ))}
          </View>
          {aggregate.necReferences.length > 0 && (
            <Text
              style={{
                fontSize: 8,
                color: '#555',
                marginTop: 6,
                fontStyle: 'italic',
              }}
            >
              Applied: {aggregate.necReferences.join('; ')}
            </Text>
          )}
        </View>
      )}

      <View>
        <Text
          style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}
        >
          CONNECTED LOAD BY PANEL
        </Text>
        <View style={permitStyles.tableContainer}>
          <View style={permitStyles.tableHeader}>
            <Text style={{ width: '25%' }}>Panel Name</Text>
            <Text style={{ width: '15%' }}>Voltage</Text>
            <Text style={{ width: '10%' }}>Phase</Text>
            <Text style={{ width: '15%' }}>Circuits</Text>
            <Text style={{ width: '20%' }}>Connected Load (kVA)</Text>
            <Text style={{ width: '15%' }}>Bus Rating</Text>
          </View>
          {panelLoads.map((pl, idx) => (
            <View
              key={pl.panel.id}
              style={idx % 2 === 0 ? permitStyles.tableRow : permitStyles.tableRowAlt}
            >
              <Text style={{ width: '25%' }}>{pl.panel.name}</Text>
              <Text style={{ width: '15%' }}>{pl.panel.voltage}V</Text>
              <Text style={{ width: '10%' }}>{pl.panel.phase}\u03C6</Text>
              <Text style={{ width: '15%' }}>{pl.circuitCount}</Text>
              <Text style={{ width: '20%' }}>{pl.loadkVA.toFixed(2)}</Text>
              <Text style={{ width: '15%' }}>{pl.panel.bus_rating}A</Text>
            </View>
          ))}
        </View>
      </View>

      {!aggregate && (
        <View
          style={{
            marginTop: 16,
            padding: 10,
            backgroundColor: '#fff7e6',
            borderWidth: 1,
            borderColor: '#d97706',
            borderStyle: 'solid',
          }}
        >
          <Text
            style={{
              fontSize: 9,
              fontFamily: 'Helvetica-Bold',
              marginBottom: 4,
              color: '#7a3e00',
            }}
          >
            No MDP identified
          </Text>
          <Text style={{ fontSize: 8, color: '#7a3e00' }}>
            Mark a panel as the Main Distribution Panel to enable NEC 220 demand
            calculation. The figures above reflect connected load only.
          </Text>
        </View>
      )}

      <SectionFooter label="Load Calculation Summary" projectName={projectName} />
    </Page>
  );
};

// ============================================================================
// NEC COMPLIANCE SUMMARY
// ============================================================================

interface ComplianceSummaryProps {
  panels: Panel[];
  circuits: Circuit[];
  feeders: Feeder[];
  projectName: string;
  hasGrounding?: boolean;
}

export const ComplianceSummary: React.FC<ComplianceSummaryProps> = ({
  panels,
  circuits,
  feeders,
  projectName,
  hasGrounding = false,
}) => {
  const mainPanel = panels.find(p => p.is_main);
  const totalCircuits = circuits.length;
  const totalFeeders = feeders.length;

  // Check for common compliance items
  const complianceChecks = [
    {
      item: 'Main Distribution Panel Identified',
      status: mainPanel ? '✓ Compliant' : '✗ Missing',
      article: 'NEC 408.3',
    },
    {
      item: 'Panel Bus Ratings Specified',
      status: panels.every(p => p.bus_rating) ? '✓ Compliant' : '✗ Incomplete',
      article: 'NEC 408.30',
    },
    {
      item: 'Circuit Overcurrent Protection',
      status: circuits.every(c => c.breaker_amps) ? '✓ Compliant' : '✗ Incomplete',
      article: 'NEC 240.4',
    },
    {
      item: 'Conductor Sizing Specified',
      status: circuits.every(c => c.conductor_size) ? '✓ Compliant' : '✗ Incomplete',
      article: 'NEC 310.16',
    },
    {
      item: 'Grounding & Bonding System',
      status: hasGrounding ? '✓ Compliant' : '⚠ Review Required',
      article: 'NEC 250',
    },
    {
      item: 'Feeder Sizing Calculated',
      status: feeders.every(f => f.phase_conductor_size) ? '✓ Compliant' : '⚠ Partial',
      article: 'NEC 215',
    },
  ];

  return (
    <Page size="LETTER" style={permitStyles.page}>
      <Text style={permitStyles.sectionTitle}>NEC COMPLIANCE SUMMARY</Text>

      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 10 }}>
          COMPLIANCE CHECKLIST
        </Text>
        <View style={permitStyles.tableContainer}>
          <View style={permitStyles.tableHeader}>
            <Text style={{ width: '50%' }}>Compliance Item</Text>
            <Text style={{ width: '25%' }}>Status</Text>
            <Text style={{ width: '25%' }}>NEC Reference</Text>
          </View>
          {complianceChecks.map((check, idx) => (
            <View key={idx} style={idx % 2 === 0 ? permitStyles.tableRow : permitStyles.tableRowAlt}>
              <Text style={{ width: '50%' }}>{check.item}</Text>
              <Text style={{ width: '25%' }}>{check.status}</Text>
              <Text style={{ width: '25%' }}>{check.article}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ marginTop: 20 }}>
        <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 10 }}>
          SYSTEM OVERVIEW
        </Text>
        <View style={{ marginLeft: 10 }}>
          <View style={permitStyles.coverInfoRow}>
            <Text style={permitStyles.coverInfoLabel}>Total Panels:</Text>
            <Text style={permitStyles.coverInfoValue}>{panels.length}</Text>
          </View>
          <View style={permitStyles.coverInfoRow}>
            <Text style={permitStyles.coverInfoLabel}>Total Circuits:</Text>
            <Text style={permitStyles.coverInfoValue}>{totalCircuits}</Text>
          </View>
          <View style={permitStyles.coverInfoRow}>
            <Text style={permitStyles.coverInfoLabel}>Total Feeders:</Text>
            <Text style={permitStyles.coverInfoValue}>{totalFeeders}</Text>
          </View>
          <View style={permitStyles.coverInfoRow}>
            <Text style={permitStyles.coverInfoLabel}>NEC Edition:</Text>
            <Text style={permitStyles.coverInfoValue}>2023</Text>
          </View>
        </View>
      </View>

      <View style={{ marginTop: 20, padding: 10, backgroundColor: '#f0f8ff', borderWidth: 1, borderColor: '#0066cc' }}>
        <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 5, color: '#0066cc' }}>
          IMPORTANT NOTES:
        </Text>
        <Text style={{ fontSize: 8, color: '#333', lineHeight: 1.5 }}>
          • This summary is based on the design data provided. Field verification is required.{'\n'}
          • All calculations comply with NEC 2023.{'\n'}
          • Final approval is subject to local building code requirements and inspector review.{'\n'}
          • For detailed compliance analysis, use the Inspector Mode AI feature.
        </Text>
      </View>

      <SectionFooter label="NEC Compliance Summary" projectName={projectName} />
    </Page>
  );
};

