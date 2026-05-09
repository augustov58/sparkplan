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
  type MultiFamilyContext,
} from '../calculations/upstreamLoadAggregation';
import {
  BrandBar,
  Footer as BrandFooter,
  PHASE,
  phaseLabel,
  themeStyles,
} from './permitPacketTheme';

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
  // Sprint 2A C7 / H4: applicable codes
  necEdition?: '2020' | '2023';
  codeReferences?: string[];
}

// FL pilot AHJs adopt NFPA-70 2020 via FBC 8th ed. NEC 220.84 demand-factor
// table values match across both editions (see services/calculations/multiFamilyEV.ts:25).
const DEFAULT_NEC_EDITION: '2020' | '2023' = '2020';
const DEFAULT_CODE_REFERENCES = [
  'NFPA-70 (NEC) 2020',
  'Florida Building Code 8th Edition (2023)',
];

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
  necEdition = DEFAULT_NEC_EDITION,
  codeReferences = DEFAULT_CODE_REFERENCES,
}) => (
  <Page size="LETTER" style={themeStyles.page}>
    <BrandBar pageLabel="PERMIT APPLICATION" />

    <View style={themeStyles.titleBlock}>
      <Text style={themeStyles.docTitle}>Electrical Permit Application</Text>
      <Text style={themeStyles.docSubtitle}>
        {`NEC ${necEdition} Compliant Design Package`}
      </Text>
    </View>

    <Text style={themeStyles.sectionTitle}>PROJECT INFORMATION</Text>
    <View style={themeStyles.projectGrid}>
      <View style={themeStyles.projectCell}>
        <Text style={themeStyles.projectLabel}>Project Name</Text>
        <Text style={themeStyles.projectValue}>{projectName}</Text>
      </View>
      <View style={themeStyles.projectCellWide}>
        <Text style={themeStyles.projectLabel}>Project Address</Text>
        <Text style={themeStyles.projectValue}>
          {projectAddress || 'Not specified'}
        </Text>
      </View>
      <View style={themeStyles.projectCell}>
        <Text style={themeStyles.projectLabel}>Project Type</Text>
        <Text style={themeStyles.projectValue}>{projectType}</Text>
      </View>
      <View style={themeStyles.projectCell}>
        <Text style={themeStyles.projectLabel}>Service</Text>
        <Text style={themeStyles.projectValue}>
          {`${serviceVoltage}V ${servicePhase === 3 ? '3' : '1'}-Phase`}
        </Text>
      </View>
      {permitNumber && (
        <View style={themeStyles.projectCell}>
          <Text style={themeStyles.projectLabel}>Permit Number</Text>
          <Text style={themeStyles.projectValue}>{permitNumber}</Text>
        </View>
      )}
    </View>

    <Text style={themeStyles.sectionTitle}>PREPARATION DETAILS</Text>
    <View style={themeStyles.projectGrid}>
      {preparedBy && (
        <View style={themeStyles.projectCell}>
          <Text style={themeStyles.projectLabel}>Prepared By</Text>
          <Text style={themeStyles.projectValue}>{preparedBy}</Text>
        </View>
      )}
      {contractorLicense && (
        <View style={themeStyles.projectCell}>
          <Text style={themeStyles.projectLabel}>Contractor License</Text>
          <Text style={themeStyles.projectValue}>{contractorLicense}</Text>
        </View>
      )}
      <View style={themeStyles.projectCell}>
        <Text style={themeStyles.projectLabel}>Date Prepared</Text>
        <Text style={themeStyles.projectValue}>{date}</Text>
      </View>
      <View style={themeStyles.projectCell}>
        <Text style={themeStyles.projectLabel}>NEC Edition</Text>
        <Text style={themeStyles.projectValue}>{`NEC ${necEdition}`}</Text>
      </View>
    </View>

    <Text style={themeStyles.sectionTitle}>APPLICABLE CODES</Text>
    <View style={themeStyles.projectGrid}>
      {codeReferences.map((code, idx) => (
        <View key={idx} style={themeStyles.projectCellWide}>
          <Text style={themeStyles.projectLabel}>{`Code ${idx + 1}`}</Text>
          <Text style={themeStyles.projectValue}>{code}</Text>
        </View>
      ))}
    </View>

    {scopeOfWork && (
      <>
        <Text style={themeStyles.sectionTitle}>SCOPE OF WORK</Text>
        <Text style={themeStyles.proseBlock}>{scopeOfWork}</Text>
      </>
    )}

    {(serviceType || meterLocation || serviceConductorRouting) && (
      <>
        <Text style={themeStyles.sectionTitle}>SERVICE ENTRANCE DETAILS</Text>
        <View style={themeStyles.projectGrid}>
          {serviceType && (
            <View style={themeStyles.projectCell}>
              <Text style={themeStyles.projectLabel}>Service Type</Text>
              <Text style={themeStyles.projectValue}>
                {serviceType === 'overhead' ? 'Overhead' : 'Underground'}
              </Text>
            </View>
          )}
          {meterLocation && (
            <View style={themeStyles.projectCell}>
              <Text style={themeStyles.projectLabel}>Meter Location</Text>
              <Text style={themeStyles.projectValue}>{meterLocation}</Text>
            </View>
          )}
          {serviceConductorRouting && (
            <View style={themeStyles.projectCellWide}>
              <Text style={themeStyles.projectLabel}>Conductor Routing</Text>
              <Text style={themeStyles.projectValue}>{serviceConductorRouting}</Text>
            </View>
          )}
        </View>
      </>
    )}

    <BrandFooter
      projectName={projectName}
      contractorName={preparedBy}
      contractorLicense={contractorLicense}
    />
  </Page>
);

// ============================================================================
// GENERAL NOTES (Sprint 2A H12 + H13)
// ============================================================================
// Numbered general-notes page driven from an optional `generalNotes` array on
// the packet data. Defaults to the FL pilot stack (NEC 2020 compliance + the
// 3% / 3% / 5% voltage-drop convention required by Orlando + most FL AHJs).
// Sprint 2C will replace the defaults with per-AHJ manifest content.

const DEFAULT_GENERAL_NOTES: string[] = [
  'All electrical work shall comply with NFPA-70 (NEC) 2020, Florida Building Code 8th Edition (2023), local AHJ amendments, and all applicable utility provider requirements.',
  'Voltage drop shall not exceed 3% on branch circuits and 3% on feeders, with combined drop not exceeding 5% per NEC 210.19(A) Informational Note 4 and NEC 215.2(A)(1) Informational Note 2.',
  'All conductor sizing, ampacity, and protection shall be per NEC Article 310, Article 215 (feeders), Article 240 (overcurrent protection), and Chapter 9 Tables 8 and 9 (impedance method).',
  'Grounding electrode conductor and equipment grounding conductor sizing per NEC Article 250, Tables 250.66 and 250.122. Bonding per NEC 250.92 / 250.94 as applicable.',
  'Equipment shall be listed and labeled by an OSHA-recognized NRTL (UL or equivalent). Field-installed listed-by-NRTL equipment shall comply with manufacturer instructions per NEC 110.3(B).',
  'All EVSE installations shall comply with NEC Article 625, including 625.42 load management for energy-management-system-controlled installations and 625.43 disconnect / labeling requirements.',
  'Working space and dedicated electrical space shall be maintained per NEC 110.26 and 110.27. Access shall not be obstructed by storage, equipment, or finishes.',
  'Where existing service is reused, available short-circuit current shall be verified at every panel and overcurrent protective device per NEC 110.10. All new equipment AIC ratings shall meet or exceed available fault current.',
];

interface GeneralNotesPageProps {
  projectName: string;
  generalNotes?: string[];
  contractorName?: string;
  contractorLicense?: string;
}

export const GeneralNotesPage: React.FC<GeneralNotesPageProps> = ({
  projectName,
  generalNotes = DEFAULT_GENERAL_NOTES,
  contractorName,
  contractorLicense,
}) => (
  <Page size="LETTER" style={themeStyles.page}>
    <BrandBar pageLabel="GENERAL NOTES" />

    <View style={themeStyles.titleBlock}>
      <Text style={themeStyles.docTitle}>General Notes</Text>
      <Text style={themeStyles.docSubtitle}>{projectName}</Text>
    </View>

    <Text style={themeStyles.sectionTitle}>NOTES APPLICABLE TO ALL ELECTRICAL SHEETS</Text>

    <View style={{ marginTop: 4 }}>
      {generalNotes.map((note, idx) => (
        <View
          key={idx}
          style={{ flexDirection: 'row', marginBottom: 5 }}
          wrap={false}
        >
          <Text
            style={{
              fontSize: 8.5,
              fontFamily: 'Helvetica-Bold',
              width: 18,
              color: '#1f2937',
            }}
          >
            {idx + 1}.
          </Text>
          <Text style={{ fontSize: 8.5, lineHeight: 1.4, flex: 1, color: '#111827' }}>
            {note}
          </Text>
        </View>
      ))}
    </View>

    <View style={[themeStyles.noteBox, { marginTop: 10 }]}>
      <Text
        style={{
          fontSize: 9,
          fontFamily: 'Helvetica-Bold',
          marginBottom: 3,
          color: '#1e3a8a',
        }}
      >
        AHJ-SPECIFIC NOTES
      </Text>
      <Text style={themeStyles.noteText}>
        Additional jurisdiction-specific notes from the AHJ manifest will appear
        here when this packet is bound to a specific AHJ. Contact the local
        building department for current submittal requirements.
      </Text>
    </View>

    <BrandFooter
      projectName={projectName}
      contractorName={contractorName}
      contractorLicense={contractorLicense}
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
  // Sprint 2A C8: per-sheet contractor signature block
  contractorName?: string;
  contractorLicense?: string;
}

export const EquipmentSchedule: React.FC<EquipmentScheduleProps> = ({
  panels,
  transformers,
  feeders,
  projectName,
  contractorName,
  contractorLicense,
}) => {
  const mainPanel = panels.find(p => p.is_main);
  const subPanels = panels.filter(p => !p.is_main);

  const thCol = (w: string) => [themeStyles.th, { width: w }];
  const tdCol = (w: string) => [themeStyles.td, { width: w }];

  return (
    <Page size="LETTER" style={themeStyles.page}>
      <BrandBar pageLabel="EQUIPMENT SCHEDULE" />

      <View style={themeStyles.titleBlock}>
        <Text style={themeStyles.docTitle}>Equipment Schedule</Text>
        <Text style={themeStyles.docSubtitle}>
          Panels, transformers, and feeders for the service
        </Text>
      </View>

      {/* Main Distribution Panel */}
      {mainPanel && (
        <>
          <Text style={themeStyles.sectionTitle}>MAIN DISTRIBUTION PANEL</Text>
          <View style={themeStyles.table}>
            <View style={themeStyles.tableHeaderRow}>
              <Text style={thCol('20%')}>Name</Text>
              <Text style={thCol('15%')}>Voltage</Text>
              <Text style={thCol('10%')}>Phase</Text>
              <Text style={thCol('15%')}>Bus Rating</Text>
              <Text style={thCol('15%')}>Main Breaker</Text>
              <Text style={thCol('25%')}>Location</Text>
            </View>
            <View style={themeStyles.tableRow} wrap={false}>
              <Text style={tdCol('20%')}>{mainPanel.name}</Text>
              <Text style={tdCol('15%')}>{mainPanel.voltage}V</Text>
              <Text style={tdCol('10%')}>{phaseLabel(mainPanel.phase)}</Text>
              <Text style={tdCol('15%')}>{mainPanel.bus_rating}A</Text>
              <Text style={tdCol('15%')}>{mainPanel.main_breaker_amps || 'MLO'}</Text>
              <Text style={tdCol('25%')}>{mainPanel.location || 'N/A'}</Text>
            </View>
          </View>
        </>
      )}

      {/* Sub-Panels */}
      {subPanels.length > 0 && (
        <>
          <Text style={themeStyles.sectionTitle}>
            SUB-PANELS ({subPanels.length})
          </Text>
          <View style={themeStyles.table}>
            <View style={themeStyles.tableHeaderRow}>
              <Text style={thCol('20%')}>Name</Text>
              <Text style={thCol('15%')}>Voltage</Text>
              <Text style={thCol('10%')}>Phase</Text>
              <Text style={thCol('15%')}>Bus Rating</Text>
              <Text style={thCol('15%')}>Main Breaker</Text>
              <Text style={thCol('25%')}>Location</Text>
            </View>
            {subPanels.map((panel, idx) => (
              <View
                key={panel.id}
                style={idx % 2 === 0 ? themeStyles.tableRow : themeStyles.tableRowAlt}
                wrap={false}
              >
                <Text style={tdCol('20%')}>{panel.name}</Text>
                <Text style={tdCol('15%')}>{panel.voltage}V</Text>
                <Text style={tdCol('10%')}>{phaseLabel(panel.phase)}</Text>
                <Text style={tdCol('15%')}>{panel.bus_rating}A</Text>
                <Text style={tdCol('15%')}>{panel.main_breaker_amps || 'MLO'}</Text>
                <Text style={tdCol('25%')}>{panel.location || 'N/A'}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Transformers */}
      {transformers.length > 0 && (
        <>
          <Text style={themeStyles.sectionTitle}>
            TRANSFORMERS ({transformers.length})
          </Text>
          <View style={themeStyles.table}>
            <View style={themeStyles.tableHeaderRow}>
              <Text style={thCol('25%')}>Name</Text>
              <Text style={thCol('15%')}>kVA Rating</Text>
              <Text style={thCol('20%')}>Primary Voltage</Text>
              <Text style={thCol('20%')}>Secondary Voltage</Text>
              <Text style={thCol('20%')}>Fed From</Text>
            </View>
            {transformers.map((xfmr, idx) => (
              <View
                key={xfmr.id}
                style={idx % 2 === 0 ? themeStyles.tableRow : themeStyles.tableRowAlt}
                wrap={false}
              >
                <Text style={tdCol('25%')}>{xfmr.name}</Text>
                <Text style={tdCol('15%')}>{xfmr.kva_rating}kVA</Text>
                <Text style={tdCol('20%')}>{xfmr.primary_voltage}V</Text>
                <Text style={tdCol('20%')}>{xfmr.secondary_voltage}V</Text>
                <Text style={tdCol('20%')}>
                  {xfmr.fed_from_panel_id
                    ? panels.find(p => p.id === xfmr.fed_from_panel_id)?.name || 'N/A'
                    : 'N/A'}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Feeders */}
      {feeders.length > 0 && (
        <>
          <Text style={themeStyles.sectionTitle}>
            FEEDERS ({feeders.length})
          </Text>
          <View style={themeStyles.table}>
            <View style={themeStyles.tableHeaderRow}>
              <Text style={thCol('20%')}>Name</Text>
              <Text style={thCol('25%')}>Source Panel</Text>
              <Text style={thCol('25%')}>Destination</Text>
              <Text style={thCol('15%')}>Conductor</Text>
              <Text style={thCol('15%')}>Load (kVA)</Text>
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
                <View
                  key={feeder.id}
                  style={idx % 2 === 0 ? themeStyles.tableRow : themeStyles.tableRowAlt}
                  wrap={false}
                >
                  <Text style={tdCol('20%')}>{feeder.name}</Text>
                  <Text style={tdCol('25%')}>{sourcePanel?.name || 'Unknown'}</Text>
                  <Text style={tdCol('25%')}>{destination}</Text>
                  <Text style={tdCol('15%')}>{feeder.phase_conductor_size || 'N/A'}</Text>
                  <Text style={tdCol('15%')}>{loadCell}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      <BrandFooter
        projectName={projectName}
        contractorName={contractorName}
        contractorLicense={contractorLicense}
      />
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
    line2: `${panel.voltage}V ${phaseLabel(panel.phase)} \u2022 ${panel.bus_rating}A bus`,
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
          line3: `${xfmr.primary_voltage}V -> ${xfmr.secondary_voltage}V`,
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
        line2: `${stack.voltage}V ${phaseLabel(stack.phase)} \u2022 ${stack.bus_rating_amps}A bus`,
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
        line2: `${serviceVoltage}V ${phaseLabel(servicePhase)} service`,
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

// A text label rendered OUTSIDE the <Svg> via absolute-positioned View+Text.
// @react-pdf v4's SVG <Text> expects <Tspan> children, not raw strings, and
// doesn't support `textAlign`/`color`. Using flow-layout Text on top of the
// SVG geometry avoids every SVG-text edge case and keeps the code simple.
interface RiserLabel {
  key: string;
  x: number;         // left edge, in SVG user units
  y: number;         // top edge, in SVG user units
  width: number;     // width of the label area
  content: string;
  fontSize: number;
  bold?: boolean;
  color?: string;
  align?: 'left' | 'center' | 'right';
}

interface RiserDraw {
  geometry: React.ReactElement[];  // Rect + Line only
  labels: RiserLabel[];
}

const buildRiserDraw = (node: RiserNode, draw: RiserDraw): void => {
  const x = node.x ?? 0;
  const y = node._y ?? 0;
  const fill = NODE_FILL[node.kind];
  const stroke = NODE_STROKE[node.kind];

  draw.geometry.push(
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

  draw.labels.push({
    key: `l1-${node.id}`,
    x,
    y: y + 6,
    width: NODE_W,
    content: node.line1,
    fontSize: 9,
    bold: true,
    align: 'center',
  });
  if (node.line2) {
    draw.labels.push({
      key: `l2-${node.id}`,
      x,
      y: y + 21,
      width: NODE_W,
      content: node.line2,
      fontSize: 8,
      align: 'center',
    });
  }
  if (node.line3) {
    draw.labels.push({
      key: `l3-${node.id}`,
      x,
      y: y + 35,
      width: NODE_W,
      content: node.line3,
      fontSize: 8,
      color: '#555',
      align: 'center',
    });
  }

  const cx = x + NODE_W / 2;
  for (const child of node.children) {
    const childMid = (child.x ?? 0) + NODE_W / 2;
    const parentBottom = y + NODE_H;
    const childTop = child._y ?? 0;
    const mid = (parentBottom + childTop) / 2;

    draw.geometry.push(
      <Line
        key={`line-${node.id}-${child.id}-v1`}
        x1={cx}
        y1={parentBottom}
        x2={cx}
        y2={mid}
        strokeWidth={1}
        stroke="#333"
      />,
      <Line
        key={`line-${node.id}-${child.id}-h`}
        x1={cx}
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
      draw.labels.push({
        key: `feeder-${child.id}`,
        x: childMid + 4,
        y: mid - 8,
        width: Math.max(NODE_W - 8, 80),
        content: child.feederLabel,
        fontSize: 7,
        color: '#222',
        align: 'left',
      });
    }

    buildRiserDraw(child, draw);
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
  // Sprint 2A C8: per-sheet contractor signature block
  contractorName?: string;
  contractorLicense?: string;
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
  contractorName,
  contractorLicense,
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
  const draw: RiserDraw = { geometry: [], labels: [] };

  if (tree) {
    computeSubtreeWidth(tree);
    assignXPositions(tree, 0);
    assignYPositions(tree, 0);
    svgWidth = tree.subtreeWidth ?? NODE_W;
    svgHeight = depth(tree) * (NODE_H + V_GAP) - V_GAP;
    buildRiserDraw(tree, draw);
  }

  // Landscape letter content area is ~720×540pt. Leave room for the BrandBar
  // (≈30pt), title block (≈40pt), description (≈24pt), legend (≈72pt), and
  // the fixed footer (≈44pt). That leaves ~330pt of vertical space; cap the
  // diagram at 330 to prevent it spilling onto a blank page with the legend
  // stranded underneath.
  const TARGET_W = 720;
  const TARGET_H_MAX = 330;
  const widthScale = svgWidth > 0 ? TARGET_W / svgWidth : 1;
  const heightScale = svgHeight > 0 ? TARGET_H_MAX / svgHeight : 1;
  const scale = Math.min(1, widthScale, heightScale);
  const renderedW = svgWidth * scale;
  const renderedH = svgHeight * scale;

  return (
    <Page size="LETTER" orientation="landscape" style={themeStyles.page}>
      <BrandBar pageLabel="RISER DIAGRAM" />

      <View style={themeStyles.titleBlock}>
        <Text style={themeStyles.docTitle}>Riser Diagram</Text>
        <Text style={themeStyles.docSubtitle}>
          Electrical power distribution from utility service through the MDP
          and all downstream panels, transformers, and meter banks.
        </Text>
      </View>

      {tree ? (
        <View
          style={{
            position: 'relative',
            width: renderedW,
            height: renderedH,
            alignSelf: 'center',
            marginBottom: 8,
          }}
        >
          <Svg
            width={renderedW}
            height={renderedH}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          >
            <G>{draw.geometry}</G>
          </Svg>
          {draw.labels.map(label => (
            <View
              key={label.key}
              style={{
                position: 'absolute',
                left: label.x * scale,
                top: label.y * scale,
                width: label.width * scale,
              }}
            >
              <Text
                style={{
                  fontSize: Math.max(6, label.fontSize * scale),
                  fontFamily: label.bold ? 'Helvetica-Bold' : 'Helvetica',
                  color: label.color || '#000',
                  textAlign: label.align || 'left',
                }}
              >
                {label.content}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={{ fontSize: 10, fontStyle: 'italic', color: '#999' }}>
          No main distribution panel defined for this project.
        </Text>
      )}

      <Text style={themeStyles.sectionTitle}>LEGEND</Text>
      <Text style={{ fontSize: 8, marginBottom: 2 }}>
        {`Utility service \u2022 Meter stack (multi-family) \u2022 Panel / MDP \u2022 Transformer`}
      </Text>
      <Text style={{ fontSize: 8, marginBottom: 2 }}>
        MLO = Main Lug Only (no main breaker)
      </Text>
      <Text style={{ fontSize: 8 }}>
        Feeder labels show conductor size + design load in kVA
      </Text>

      <BrandFooter
        projectName={projectName}
        contractorName={contractorName}
        contractorLicense={contractorLicense}
      />
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
  /**
   * NEC 220.84 multifamily context. When supplied, `calculateAggregatedLoad`
   * applies the Optional Method blanket demand factor at the MDP instead of
   * the standard NEC 220 per-load-type cascade. Caller is responsible for
   * gating (via `buildMultiFamilyContext`) — pass `undefined` for any project
   * that is not a multi-family dwelling with 3+ units.
   */
  multiFamilyContext?: MultiFamilyContext;
  // Sprint 2A C8: per-sheet contractor signature block
  contractorName?: string;
  contractorLicense?: string;
}

export const LoadCalculationSummary: React.FC<LoadSummaryProps> = ({
  panels,
  circuits,
  transformers,
  projectName,
  serviceVoltage,
  servicePhase,
  projectType,
  multiFamilyContext,
  contractorName,
  contractorLicense,
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

  // Real NEC 220 aggregation on the MDP (entire system).
  // multiFamilyContext flips this to the NEC 220.84 Optional Method when applicable.
  const aggregate: AggregatedLoad | null = mdp
    ? calculateAggregatedLoad(mdp.id, panels, circuits, transformers, occupancy, multiFamilyContext)
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

  const thCol = (w: string) => [themeStyles.th, { width: w }];
  const tdCol = (w: string) => [themeStyles.td, { width: w }];
  const tdNumCol = (w: string) => [themeStyles.tdNum, { width: w }];

  return (
    <Page size="LETTER" style={themeStyles.page}>
      <BrandBar pageLabel="LOAD CALCULATION" />

      <View style={themeStyles.titleBlock}>
        <Text style={themeStyles.docTitle}>Load Calculation Summary</Text>
        <Text style={themeStyles.docSubtitle}>
          NEC Article 220 demand calculation applied to the full hierarchy
        </Text>
      </View>

      <Text style={themeStyles.sectionTitle}>SYSTEM TOTALS</Text>
      <View style={themeStyles.projectGrid}>
        <View style={themeStyles.projectCell}>
          <Text style={themeStyles.projectLabel}>Service</Text>
          <Text style={themeStyles.projectValue}>
            {serviceVoltage}V {servicePhase === 3 ? '3-Phase' : 'Single-Phase'}
          </Text>
        </View>
        <View style={themeStyles.projectCell}>
          <Text style={themeStyles.projectLabel}>Occupancy</Text>
          <Text style={themeStyles.projectValue}>
            {occupancy.charAt(0).toUpperCase() + occupancy.slice(1)}
          </Text>
        </View>
        <View style={themeStyles.projectCell}>
          <Text style={themeStyles.projectLabel}>Total Panels</Text>
          <Text style={themeStyles.projectValue}>{panels.length}</Text>
        </View>
        <View style={themeStyles.projectCell}>
          <Text style={themeStyles.projectLabel}>Total Circuits</Text>
          <Text style={themeStyles.projectValue}>{circuits.length}</Text>
        </View>
      </View>

      <View style={themeStyles.summaryRow}>
        <View style={themeStyles.summaryCard}>
          <Text style={themeStyles.summaryLabel}>Connected Load</Text>
          <Text style={themeStyles.summaryValue}>
            {(totalConnectedVA / 1000).toFixed(2)}
            <Text style={themeStyles.summaryUnit}> kVA</Text>
          </Text>
          <Text style={themeStyles.summarySub}>
            {totalConnectedVA.toLocaleString()} VA
          </Text>
        </View>
        <View style={themeStyles.summaryCardHighlight}>
          <Text style={themeStyles.summaryLabel}>Calculated Demand</Text>
          <Text style={themeStyles.summaryValue}>
            {(totalDemandVA / 1000).toFixed(2)}
            <Text style={themeStyles.summaryUnit}> kVA</Text>
          </Text>
          <Text style={themeStyles.summarySub}>
            {(overallDf * 100).toFixed(1)}% overall DF
          </Text>
        </View>
        <View style={themeStyles.summaryCard}>
          <Text style={themeStyles.summaryLabel}>Demand Current</Text>
          <Text style={themeStyles.summaryValue}>
            {Number.isFinite(demandAmps) ? demandAmps.toFixed(0) : '—'}
            <Text style={themeStyles.summaryUnit}> A</Text>
          </Text>
          <Text style={themeStyles.summarySub}>
            @ {serviceVoltage}V {phaseLabel(servicePhase)}
          </Text>
        </View>
      </View>

      {aggregate && aggregate.demandBreakdown.length > 0 && (
        <>
          <Text style={themeStyles.sectionTitle}>
            DEMAND FACTOR BREAKDOWN (NEC ARTICLE 220)
          </Text>
          <View style={themeStyles.table}>
            <View style={themeStyles.tableHeaderRow}>
              <Text style={thCol('28%')}>Load Type</Text>
              <Text style={[themeStyles.th, { width: '17%', textAlign: 'right' }]}>
                Connected (kVA)
              </Text>
              <Text style={[themeStyles.th, { width: '12%', textAlign: 'right' }]}>
                Factor
              </Text>
              <Text style={[themeStyles.th, { width: '17%', textAlign: 'right' }]}>
                Demand (kVA)
              </Text>
              <Text style={thCol('26%')}>NEC Reference</Text>
            </View>
            {aggregate.demandBreakdown.map((d, idx) => (
              <View
                key={`${d.loadType}-${idx}`}
                style={idx % 2 === 0 ? themeStyles.tableRow : themeStyles.tableRowAlt}
                wrap={false}
              >
                <Text style={tdCol('28%')}>{d.loadType}</Text>
                <Text style={tdNumCol('17%')}>
                  {(d.connectedVA / 1000).toFixed(2)}
                </Text>
                <Text style={tdNumCol('12%')}>
                  {(d.demandFactor * 100).toFixed(0)}%
                </Text>
                <Text style={tdNumCol('17%')}>
                  {(d.demandVA / 1000).toFixed(2)}
                </Text>
                <Text style={tdCol('26%')}>{d.necReference}</Text>
              </View>
            ))}
            <View style={themeStyles.tableTotalRow} wrap={false}>
              <Text style={[themeStyles.tdBold, { width: '28%' }]}>TOTAL</Text>
              <Text style={[themeStyles.tdBoldNum, { width: '17%' }]}>
                {(totalConnectedVA / 1000).toFixed(2)}
              </Text>
              <Text style={[themeStyles.tdBoldNum, { width: '12%' }]}>
                {(overallDf * 100).toFixed(1)}%
              </Text>
              <Text style={[themeStyles.tdBoldNum, { width: '17%' }]}>
                {(totalDemandVA / 1000).toFixed(2)}
              </Text>
              <Text style={[themeStyles.tdBold, { width: '26%' }]}> </Text>
            </View>
          </View>
          {aggregate.necReferences.length > 0 && (
            <Text
              style={{
                fontSize: 8,
                color: '#555',
                marginTop: 2,
                marginBottom: 4,
                fontStyle: 'italic',
              }}
            >
              Applied: {aggregate.necReferences.join('; ')}
            </Text>
          )}
        </>
      )}

      <Text style={themeStyles.sectionTitle}>CONNECTED LOAD BY PANEL</Text>
      <View style={themeStyles.table}>
        <View style={themeStyles.tableHeaderRow}>
          <Text style={thCol('25%')}>Panel Name</Text>
          <Text style={thCol('15%')}>Voltage</Text>
          <Text style={thCol('10%')}>Phase</Text>
          <Text style={[themeStyles.th, { width: '15%', textAlign: 'right' }]}>
            Circuits
          </Text>
          <Text style={[themeStyles.th, { width: '20%', textAlign: 'right' }]}>
            Connected (kVA)
          </Text>
          <Text style={thCol('15%')}>Bus Rating</Text>
        </View>
        {panelLoads.map((pl, idx) => (
          <View
            key={pl.panel.id}
            style={idx % 2 === 0 ? themeStyles.tableRow : themeStyles.tableRowAlt}
            wrap={false}
          >
            <Text style={tdCol('25%')}>{pl.panel.name}</Text>
            <Text style={tdCol('15%')}>{pl.panel.voltage}V</Text>
            <Text style={tdCol('10%')}>{phaseLabel(pl.panel.phase)}</Text>
            <Text style={tdNumCol('15%')}>{pl.circuitCount}</Text>
            <Text style={tdNumCol('20%')}>{pl.loadkVA.toFixed(2)}</Text>
            <Text style={tdCol('15%')}>{pl.panel.bus_rating}A</Text>
          </View>
        ))}
      </View>

      {!aggregate && (
        <View style={themeStyles.warningBox}>
          <Text
            style={{
              fontSize: 9,
              fontFamily: 'Helvetica-Bold',
              marginBottom: 2,
              color: '#7a3e00',
            }}
          >
            No MDP identified
          </Text>
          <Text style={themeStyles.warningText}>
            Mark a panel as the Main Distribution Panel to enable NEC 220
            demand calculation. The figures above reflect connected load only.
          </Text>
        </View>
      )}

      <BrandFooter
        projectName={projectName}
        contractorName={contractorName}
        contractorLicense={contractorLicense}
      />
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
  necEdition?: '2020' | '2023';
  // Sprint 2A C8: per-sheet contractor signature block
  contractorName?: string;
  contractorLicense?: string;
}

export const ComplianceSummary: React.FC<ComplianceSummaryProps> = ({
  panels,
  circuits,
  feeders,
  projectName,
  hasGrounding = false,
  necEdition = DEFAULT_NEC_EDITION,
  contractorName,
  contractorLicense,
}) => {
  const mainPanel = panels.find(p => p.is_main);
  const totalCircuits = circuits.length;
  const totalFeeders = feeders.length;

  // Status values are ASCII-only; Helvetica StandardEncoding can't render
  // checkmark / x-mark / warning glyphs reliably across viewers.
  const complianceChecks: Array<{
    item: string;
    status: string;
    ok: 'pass' | 'fail' | 'warn';
    article: string;
  }> = [
    {
      item: 'Main Distribution Panel Identified',
      status: mainPanel ? 'Compliant' : 'Missing',
      ok: mainPanel ? 'pass' : 'fail',
      article: 'NEC 408.3',
    },
    {
      item: 'Panel Bus Ratings Specified',
      status: panels.every(p => p.bus_rating) ? 'Compliant' : 'Incomplete',
      ok: panels.every(p => p.bus_rating) ? 'pass' : 'fail',
      article: 'NEC 408.30',
    },
    {
      item: 'Circuit Overcurrent Protection',
      status: circuits.every(c => c.breaker_amps) ? 'Compliant' : 'Incomplete',
      ok: circuits.every(c => c.breaker_amps) ? 'pass' : 'fail',
      article: 'NEC 240.4',
    },
    {
      item: 'Conductor Sizing Specified',
      status: circuits.every(c => c.conductor_size) ? 'Compliant' : 'Incomplete',
      ok: circuits.every(c => c.conductor_size) ? 'pass' : 'fail',
      article: 'NEC 310.16',
    },
    {
      item: 'Grounding & Bonding System',
      status: hasGrounding ? 'Compliant' : 'Review Required',
      ok: hasGrounding ? 'pass' : 'warn',
      article: 'NEC 250',
    },
    {
      item: 'Feeder Sizing Calculated',
      status: feeders.every(f => f.phase_conductor_size) ? 'Compliant' : 'Partial',
      ok: feeders.every(f => f.phase_conductor_size) ? 'pass' : 'warn',
      article: 'NEC 215',
    },
  ];

  const statusColor = (ok: 'pass' | 'fail' | 'warn') =>
    ok === 'pass' ? '#166534' : ok === 'fail' ? '#991b1b' : '#92400e';

  const thCol = (w: string) => [themeStyles.th, { width: w }];
  const tdCol = (w: string) => [themeStyles.td, { width: w }];

  return (
    <Page size="LETTER" style={themeStyles.page}>
      <BrandBar pageLabel="COMPLIANCE SUMMARY" />

      <View style={themeStyles.titleBlock}>
        <Text style={themeStyles.docTitle}>NEC Compliance Summary</Text>
        <Text style={themeStyles.docSubtitle}>
          {`NEC ${necEdition} design review checklist`}
        </Text>
      </View>

      <Text style={themeStyles.sectionTitle}>SYSTEM OVERVIEW</Text>
      <View style={themeStyles.projectGrid}>
        <View style={themeStyles.projectCell}>
          <Text style={themeStyles.projectLabel}>Total Panels</Text>
          <Text style={themeStyles.projectValue}>{panels.length}</Text>
        </View>
        <View style={themeStyles.projectCell}>
          <Text style={themeStyles.projectLabel}>Total Circuits</Text>
          <Text style={themeStyles.projectValue}>{totalCircuits}</Text>
        </View>
        <View style={themeStyles.projectCell}>
          <Text style={themeStyles.projectLabel}>Total Feeders</Text>
          <Text style={themeStyles.projectValue}>{totalFeeders}</Text>
        </View>
        <View style={themeStyles.projectCell}>
          <Text style={themeStyles.projectLabel}>NEC Edition</Text>
          <Text style={themeStyles.projectValue}>{necEdition}</Text>
        </View>
      </View>

      <Text style={themeStyles.sectionTitle}>COMPLIANCE CHECKLIST</Text>
      <View style={themeStyles.table}>
        <View style={themeStyles.tableHeaderRow}>
          <Text style={thCol('55%')}>Compliance Item</Text>
          <Text style={thCol('25%')}>Status</Text>
          <Text style={thCol('20%')}>NEC Reference</Text>
        </View>
        {complianceChecks.map((check, idx) => (
          <View
            key={idx}
            style={idx % 2 === 0 ? themeStyles.tableRow : themeStyles.tableRowAlt}
            wrap={false}
          >
            <Text style={tdCol('55%')}>{check.item}</Text>
            <Text
              style={[
                themeStyles.td,
                {
                  width: '25%',
                  color: statusColor(check.ok),
                  fontFamily: 'Helvetica-Bold',
                },
              ]}
            >
              {check.status}
            </Text>
            <Text style={tdCol('20%')}>{check.article}</Text>
          </View>
        ))}
      </View>

      <View style={themeStyles.noteBox}>
        <Text
          style={{
            fontSize: 9,
            fontFamily: 'Helvetica-Bold',
            marginBottom: 3,
            color: '#1e3a8a',
          }}
        >
          IMPORTANT NOTES
        </Text>
        <Text style={themeStyles.noteText}>
          {`\u2022 This summary is based on the design data provided. Field verification is required.\n\u2022 All calculations comply with NEC ${necEdition}.\n\u2022 Final approval is subject to local building code requirements and inspector review.\n\u2022 For detailed compliance analysis, use the Inspector Mode AI feature.`}
        </Text>
      </View>

      <BrandFooter
        projectName={projectName}
        contractorName={contractorName}
        contractorLicense={contractorLicense}
      />
    </Page>
  );
};

