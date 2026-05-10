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
import { calculateAllCumulativeVoltageDrops } from '../calculations/cumulativeVoltageDrop';
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
  // Sprint 2A H3: per-sheet ID (cover is conventionally '001')
  sheetId?: string;
  // Sprint 2A PR 5 / H17: permit-packet lane (FL contractor exemption vs PE seal).
  // When omitted, no exemption / PE-required line is rendered (legacy callers).
  permitMode?: {
    lane: 'exempt' | 'pe-required';
    /** AHJ display name; "AHJ" placeholder used when not yet bound (Sprint 2C). */
    ahjName?: string;
  };
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
  sheetId,
  permitMode,
}) => (
  <Page size="LETTER" style={themeStyles.page}>
    <BrandBar pageLabel="PERMIT APPLICATION" sheetId={sheetId} />

    <View style={themeStyles.titleBlock}>
      <Text style={themeStyles.docTitle}>Electrical Permit Application</Text>
      <Text style={themeStyles.docSubtitle}>
        {`NEC ${necEdition} Compliant Design Package`}
      </Text>
      {permitMode && (
        // Sprint 2A PR 5 / H17: lane-specific stamp under the title block.
        // 'exempt' → FS 471.003(2)(h) contractor-exemption attestation.
        // 'pe-required' → directs the AHJ to look for the PE seal on the
        // following sheets. AHJ name fills in from Sprint 2C manifest.
        <Text style={themeStyles.docSubtitle}>
          {permitMode.lane === 'exempt'
            ? 'Designed under FS 471.003(2)(h) contractor exemption'
            : `PE-sealed plans required per ${permitMode.ahjName ?? 'AHJ'}`}
        </Text>
      )}
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
      sheetId={sheetId}
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
  sheetId?: string;
}

export const GeneralNotesPage: React.FC<GeneralNotesPageProps> = ({
  projectName,
  generalNotes = DEFAULT_GENERAL_NOTES,
  contractorName,
  contractorLicense,
  sheetId,
}) => (
  <Page size="LETTER" style={themeStyles.page}>
    <BrandBar pageLabel="GENERAL NOTES" sheetId={sheetId} />

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
      sheetId={sheetId}
    />
  </Page>
);

// ============================================================================
// TABLE OF CONTENTS (Sprint 2A H1)
// ============================================================================
// Renders right after the cover page. Lists every sheet that follows, with
// its sheet ID and title. Driven entirely from `entries`, which the generator
// builds AFTER assigning sheet IDs to the filtered page list.

export interface TocEntry {
  sheetId: string;
  title: string;
  /** Optional band label for grouping (e.g., "Calculations"). */
  band?: string;
}

interface TableOfContentsPageProps {
  projectName: string;
  entries: TocEntry[];
  contractorName?: string;
  contractorLicense?: string;
  sheetId?: string;
}

export const TableOfContentsPage: React.FC<TableOfContentsPageProps> = ({
  projectName,
  entries,
  contractorName,
  contractorLicense,
  sheetId,
}) => (
  <Page size="LETTER" style={themeStyles.page}>
    <BrandBar pageLabel="TABLE OF CONTENTS" sheetId={sheetId} />

    <View style={themeStyles.titleBlock}>
      <Text style={themeStyles.docTitle}>Table of Contents</Text>
      <Text style={themeStyles.docSubtitle}>{projectName}</Text>
    </View>

    <View style={themeStyles.table}>
      <View style={themeStyles.tableHeaderRow}>
        <Text style={[themeStyles.th, { width: '15%' }]}>Sheet</Text>
        <Text style={[themeStyles.th, { width: '85%' }]}>Title</Text>
      </View>
      {entries.map((entry, idx) => (
        <View
          key={`${entry.sheetId}-${idx}`}
          style={idx % 2 === 0 ? themeStyles.tableRow : themeStyles.tableRowAlt}
          wrap={false}
        >
          <Text style={[themeStyles.td, { width: '15%', fontFamily: 'Helvetica-Bold' }]}>
            {entry.sheetId}
          </Text>
          <Text style={[themeStyles.td, { width: '85%' }]}>{entry.title}</Text>
        </View>
      ))}
    </View>

    <View style={[themeStyles.noteBox, { marginTop: 8 }]}>
      <Text style={themeStyles.noteText}>
        Sheet IDs are stable across revisions. AHJ comments referencing a
        specific sheet ID continue to identify the same content even when
        page numbers shift.
      </Text>
    </View>

    <BrandFooter
      projectName={projectName}
      contractorName={contractorName}
      contractorLicense={contractorLicense}
      sheetId={sheetId}
    />
  </Page>
);

// ============================================================================
// REVISION LOG (Sprint 2A H2)
// ============================================================================
// AHJ-required audit trail of plan revisions. First submittal auto-populates
// "Rev 0" with today's date and the contractor name. Subsequent revisions
// append rows. Sheet ID stability across revisions is a Sprint 3 concern
// (PE seal workflow will lock the sections config at submittal).

export interface RevisionEntry {
  rev: string;        // 'Rev 0', 'Rev 1', etc.
  date: string;       // ISO yyyy-mm-dd or human-readable
  description: string;
  by?: string;        // contractor / engineer who issued the revision
}

interface RevisionLogPageProps {
  projectName: string;
  revisions?: RevisionEntry[];
  contractorName?: string;
  contractorLicense?: string;
  sheetId?: string;
}

const todayIso = (): string => new Date().toISOString().split('T')[0];

export const RevisionLogPage: React.FC<RevisionLogPageProps> = ({
  projectName,
  revisions,
  contractorName,
  contractorLicense,
  sheetId,
}) => {
  // Auto-populate Rev 0 if no revisions supplied. Default first row keeps the
  // page from looking accidentally blank on a fresh submittal — the AHJ still
  // sees a valid revision history with today's date and the contractor name.
  const effectiveRevisions: RevisionEntry[] =
    revisions && revisions.length > 0
      ? revisions
      : [
          {
            rev: 'Rev 0',
            date: todayIso(),
            description: 'Initial submittal',
            by: contractorName || 'Contractor',
          },
        ];

  return (
    <Page size="LETTER" style={themeStyles.page}>
      <BrandBar pageLabel="REVISION LOG" sheetId={sheetId} />

      <View style={themeStyles.titleBlock}>
        <Text style={themeStyles.docTitle}>Revision Log</Text>
        <Text style={themeStyles.docSubtitle}>{projectName}</Text>
      </View>

      <View style={themeStyles.table}>
        <View style={themeStyles.tableHeaderRow}>
          <Text style={[themeStyles.th, { width: '12%' }]}>Rev</Text>
          <Text style={[themeStyles.th, { width: '18%' }]}>Date</Text>
          <Text style={[themeStyles.th, { width: '50%' }]}>Description</Text>
          <Text style={[themeStyles.th, { width: '20%' }]}>By</Text>
        </View>
        {effectiveRevisions.map((entry, idx) => (
          <View
            key={`${entry.rev}-${idx}`}
            style={idx % 2 === 0 ? themeStyles.tableRow : themeStyles.tableRowAlt}
            wrap={false}
          >
            <Text style={[themeStyles.td, { width: '12%', fontFamily: 'Helvetica-Bold' }]}>
              {entry.rev}
            </Text>
            <Text style={[themeStyles.td, { width: '18%' }]}>{entry.date}</Text>
            <Text style={[themeStyles.td, { width: '50%' }]}>{entry.description}</Text>
            <Text style={[themeStyles.td, { width: '20%' }]}>{entry.by ?? ''}</Text>
          </View>
        ))}
      </View>

      <View style={[themeStyles.noteBox, { marginTop: 8 }]}>
        <Text style={themeStyles.noteText}>
          Revisions are appended to this log on every resubmittal. The
          contractor and design engineer of record certify that all changes
          listed here have been documented and reflected throughout the
          packet.
        </Text>
      </View>

      <BrandFooter
        projectName={projectName}
        contractorName={contractorName}
        contractorLicense={contractorLicense}
        sheetId={sheetId}
      />
    </Page>
  );
};

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
  // Sprint 2A H3: per-sheet ID
  sheetId?: string;
}

export const EquipmentSchedule: React.FC<EquipmentScheduleProps> = ({
  panels,
  transformers,
  feeders,
  projectName,
  contractorName,
  contractorLicense,
  sheetId,
}) => {
  const mainPanel = panels.find(p => p.is_main);
  const subPanels = panels.filter(p => !p.is_main);

  const thCol = (w: string) => [themeStyles.th, { width: w }];
  const tdCol = (w: string) => [themeStyles.td, { width: w }];

  return (
    <Page size="LETTER" style={themeStyles.page}>
      <BrandBar pageLabel="EQUIPMENT SCHEDULE" sheetId={sheetId} />

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
        sheetId={sheetId}
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
    const sets = (feeder.sets_in_parallel ?? 1) > 1 ? `${feeder.sets_in_parallel}× ` : '';
    parts.push(`${sets}${feeder.phase_conductor_size} ${feeder.conductor_material || 'Cu'}`);
  }
  if (feeder.distance_ft) {
    parts.push(`${feeder.distance_ft} ft`);
  }
  if (typeof feeder.voltage_drop_percent === 'number') {
    parts.push(`VD ${feeder.voltage_drop_percent.toFixed(2)}%`);
  } else if (typeof feeder.design_load_va === 'number' && feeder.design_load_va > 0) {
    parts.push(`${(feeder.design_load_va / 1000).toFixed(1)} kVA`);
  }
  return parts.length > 0 ? parts.join(' • ') : 'Feeder';
};

const buildPanelSubtree = (
  panel: Panel,
  panels: Panel[],
  transformers: Transformer[],
  feeders: Feeder[],
  feederLabel?: string,
  cumulativeVd?: Map<string, number>
): RiserNode => {
  const baseLine3 = panel.main_breaker_amps ? `${panel.main_breaker_amps}A Main` : 'MLO';
  const cum = cumulativeVd?.get(panel.id);
  const line3 = typeof cum === 'number' && cum > 0
    ? `${baseLine3} \u2022 VD+ ${cum.toFixed(2)}%`  // VD+ = cumulative voltage drop from voltage source (resets at transformers)
    : baseLine3;

  const node: RiserNode = {
    id: panel.id,
    kind: 'panel',
    line1: panel.name + (panel.is_main ? ' (MDP)' : ''),
    line2: `${panel.voltage}V ${phaseLabel(panel.phase)} \u2022 ${panel.bus_rating}A bus`,
    line3,
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
          buildPanelSubtree(dest, panels, transformers, feeders, label, cumulativeVd)
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
          xfmrNode.children.push(buildPanelSubtree(p, panels, transformers, feeders, undefined, cumulativeVd));
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
  servicePhase: number,
  cumulativeVd?: Map<string, number>
): RiserNode | null => {
  const serviceEntranceFeeder = feeders.find(f => f.is_service_entrance) ?? null;
  const seLabel = serviceEntranceFeeder ? buildFeederLabel(serviceEntranceFeeder) : undefined;
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
            buildPanelSubtree(panel, panels, transformers, feeders, meterLabel, cumulativeVd)
          );
        }
      }
      return {
        id: 'utility',
        kind: 'utility',
        line1: 'UTILITY',
        line2: `${serviceVoltage}V ${phaseLabel(servicePhase)} service`,
        // Service-entrance label hangs on the edge from UTIL to the meter stack.
        children: [{ ...stackNode, feederLabel: seLabel ?? stackNode.feederLabel }],
      };
    }
  }

  if (!mdp) return null;

  const mdpSubtree = buildPanelSubtree(mdp, panels, transformers, feeders, seLabel, cumulativeVd);

  return {
    id: 'utility',
    kind: 'utility',
    line1: 'UTILITY',
    line2: `${serviceVoltage}V ${servicePhase}\u03C6 service`,
    children: [mdpSubtree],
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
  // Sprint 2A H3: per-sheet ID
  sheetId?: string;
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
  sheetId,
}) => {
  // Cumulative VD per panel (resets at transformer secondary, see service spec).
  const cumulativeAll = calculateAllCumulativeVoltageDrops(panels, feeders, transformers);
  const cumulativeVd = new Map<string, number>();
  cumulativeAll.forEach((r, panelId) => cumulativeVd.set(panelId, r.cumulativePercent));

  const tree = buildRiserTree(
    panels,
    transformers,
    feeders,
    meterStacks,
    meters,
    serviceVoltage,
    servicePhase,
    cumulativeVd
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
      <BrandBar pageLabel="RISER DIAGRAM" sheetId={sheetId} />

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
        sheetId={sheetId}
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
  // Sprint 2A H3: per-sheet ID
  sheetId?: string;
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
  sheetId,
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
      <BrandBar pageLabel="LOAD CALCULATION" sheetId={sheetId} />

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
        sheetId={sheetId}
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
  // Sprint 2A H3: per-sheet ID
  sheetId?: string;
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
  sheetId,
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
      <BrandBar pageLabel="COMPLIANCE SUMMARY" sheetId={sheetId} />

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
        sheetId={sheetId}
      />
    </Page>
  );
};

// ============================================================================
// NEC 220.87 EXISTING-SERVICE NARRATIVE (Sprint 2A H14)
// ============================================================================
// Required by Orlando's "EV Charging Station Permit Checklist" existing-service
// path. Renders the structured 3-condition checklist mandated by NEC 220.87 so
// AHJ intake reviewers can confirm: (1) maximum demand data is available for a
// 1-year period, (2) max demand x 125% + new load <= ampacity, (3) OCPD per
// NEC 240.4 + service overload protection per NEC 230.90. Contractor signs off
// on the conditions; the page itself is the audit trail the AHJ reviews.
//
// Driven by an opt-in `nec22087Narrative` data block on PermitPacketData. The
// section toggle auto-disables in the UI when no data block is provided.

/**
 * Method by which the existing maximum demand was determined. Mirrors
 * `ExistingLoadDeterminationMethod` from `types.ts` but kept narrow to the
 * three NEC 220.87-recognized methods that produce a citation; "manual" is
 * accepted but flagged in the page as informational only (AHJs typically
 * require billing data or a load study, not a hand-entered value).
 */
export type NEC22087Method = 'utility_bill' | 'load_study' | 'calculated' | 'manual';

export interface NEC22087NarrativeData {
  /** How the existing maximum demand was determined (drives Condition 1 wording). */
  method: NEC22087Method;
  /** Free-text citation: "FPL utility billing, account #12345-67, Sept 2024 - Aug 2025". */
  dataSourceCitation: string;
  /** ISO yyyy-mm-dd; start of the 12-month observation window. */
  dateRangeFrom: string;
  /** ISO yyyy-mm-dd; end of the 12-month observation window. */
  dateRangeTo: string;
  /** Maximum demand observed during the window, in kVA (per NEC 220.87 input). */
  maxDemandKVA: number;
  /** Sum of proposed new loads being added (e.g., new EVSE bank), in kVA. */
  proposedNewLoadKVA: number;
  /** Existing service ampacity rating (the number stamped on the meter / main). */
  serviceCapacityAmps: number;
  /** Service voltage in volts (typically 120/240 single-phase or 208/480 3-phase). */
  serviceVoltage: number;
  /** Service phase: 1-phase or 3-phase. */
  servicePhase: 1 | 3;
  /** Free-text confirmation of NEC 240.4 OCPD compliance (e.g., "Existing 200A main breaker"). */
  ocpdNotes?: string;
  /** Free-text confirmation of NEC 230.90 service overload protection. */
  serviceOverloadNotes?: string;
}

interface NEC22087NarrativePageProps {
  projectName: string;
  data: NEC22087NarrativeData;
  contractorName?: string;
  contractorLicense?: string;
  sheetId?: string;
}

const METHOD_LABEL: Record<NEC22087Method, string> = {
  utility_bill: 'Utility billing data \u2014 12-month peak demand',
  load_study: 'Recording load study \u2014 30-day at 15-minute intervals',
  calculated: 'Calculated from existing panel schedule \u2014 NEC 220.82/220.84 demand factors',
  manual: 'Manual entry (informational only \u2014 AHJ may require source documentation)',
};

const METHOD_NEC_REF: Record<NEC22087Method, string> = {
  utility_bill: 'NEC 220.87 Method 1 \u2014 actual maximum demand',
  load_study: 'NEC 220.87 Method 1 \u2014 actual maximum demand (load study)',
  calculated: 'NEC 220.87 Method 2 \u2014 calculated using NEC 220.82/220.84',
  manual: 'NEC 220.87 \u2014 method unspecified',
};

const serviceCapacityKVA = (amps: number, volts: number, phase: 1 | 3): number => {
  if (phase === 3) return (amps * volts * 1.732) / 1000;
  return (amps * volts) / 1000;
};

export const NEC22087NarrativePage: React.FC<NEC22087NarrativePageProps> = ({
  projectName,
  data,
  contractorName,
  contractorLicense,
  sheetId,
}) => {
  const capacityKVA = serviceCapacityKVA(
    data.serviceCapacityAmps,
    data.serviceVoltage,
    data.servicePhase,
  );
  // NEC 220.87: measured methods (utility bill / load study) use the value
  // directly; calculated/manual methods apply the 125% safety multiplier.
  const isMeasured = data.method === 'utility_bill' || data.method === 'load_study';
  const adjustedExisting = isMeasured ? data.maxDemandKVA : data.maxDemandKVA * 1.25;
  const totalFutureDemand = adjustedExisting + data.proposedNewLoadKVA;
  const utilizationPct = capacityKVA > 0 ? (totalFutureDemand / capacityKVA) * 100 : 0;
  const isCompliant = totalFutureDemand <= capacityKVA;

  return (
    <Page size="LETTER" style={themeStyles.page}>
      <BrandBar pageLabel="NEC 220.87 NARRATIVE" sheetId={sheetId} />

      <View style={themeStyles.titleBlock}>
        <Text style={themeStyles.docTitle}>Existing Service Capacity Verification</Text>
        <Text style={themeStyles.docSubtitle}>
          {`${projectName} \u2022 NEC 220.87 \u2014 Determining Existing Loads`}
        </Text>
      </View>

      <View style={themeStyles.summaryRow}>
        <View style={themeStyles.summaryCard}>
          <Text style={themeStyles.summaryLabel}>Service Capacity</Text>
          <Text style={themeStyles.summaryValue}>
            {data.serviceCapacityAmps}
            <Text style={themeStyles.summaryUnit}>A</Text>
          </Text>
          <Text style={themeStyles.summarySub}>
            {`${data.serviceVoltage}V ${phaseLabel(data.servicePhase)} \u2022 ${capacityKVA.toFixed(1)} kVA`}
          </Text>
        </View>
        <View style={themeStyles.summaryCard}>
          <Text style={themeStyles.summaryLabel}>Existing Max Demand</Text>
          <Text style={themeStyles.summaryValue}>
            {data.maxDemandKVA.toFixed(1)}
            <Text style={themeStyles.summaryUnit}>kVA</Text>
          </Text>
          <Text style={themeStyles.summarySub}>
            {isMeasured ? 'measured (no 125% mult.)' : 'calculated x 1.25'}
          </Text>
        </View>
        <View style={themeStyles.summaryCard}>
          <Text style={themeStyles.summaryLabel}>Proposed New Load</Text>
          <Text style={themeStyles.summaryValue}>
            {data.proposedNewLoadKVA.toFixed(1)}
            <Text style={themeStyles.summaryUnit}>kVA</Text>
          </Text>
          <Text style={themeStyles.summarySub}>added to existing</Text>
        </View>
        <View style={isCompliant ? themeStyles.summaryCardHighlight : themeStyles.summaryCard}>
          <Text style={themeStyles.summaryLabel}>Total Future Demand</Text>
          <Text style={themeStyles.summaryValue}>
            {totalFutureDemand.toFixed(1)}
            <Text style={themeStyles.summaryUnit}>kVA</Text>
          </Text>
          <Text style={themeStyles.summarySub}>{`${utilizationPct.toFixed(1)}% utilization`}</Text>
        </View>
      </View>

      <View wrap={false}>
        <Text style={themeStyles.sectionTitle}>CONDITIONS PER NEC 220.87</Text>

        <View style={{ flexDirection: 'row', marginTop: 4, marginBottom: 6 }}>
          <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', width: 18, color: '#1f2937' }}>1.</Text>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 9,
                fontFamily: 'Helvetica-Bold',
                color: '#111827',
                marginBottom: 1,
              }}
            >
              Maximum demand data is available for a 1-year period (NEC 220.87(1))
            </Text>
            <Text style={{ fontSize: 8.5, color: '#374151', lineHeight: 1.4 }}>
              {`Method: ${METHOD_LABEL[data.method]}. ${METHOD_NEC_REF[data.method]}.`}
            </Text>
            <Text
              style={{ fontSize: 8.5, color: '#374151', lineHeight: 1.4, marginTop: 1 }}
            >
              {`Observation window: ${data.dateRangeFrom} to ${data.dateRangeTo}.`}
            </Text>
            <Text
              style={{
                fontSize: 8.5,
                color: '#1e3a8a',
                lineHeight: 1.4,
                marginTop: 1,
                fontFamily: 'Helvetica-Bold',
              }}
            >
              {`Source: ${data.dataSourceCitation || '\u2014 NOT PROVIDED \u2014'}`}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', marginBottom: 6 }}>
          <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', width: 18, color: '#1f2937' }}>2.</Text>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 9,
                fontFamily: 'Helvetica-Bold',
                color: '#111827',
                marginBottom: 1,
              }}
            >
              Maximum demand at 125% plus the new load does not exceed the ampacity (NEC 220.87(2))
            </Text>
            <Text style={{ fontSize: 8.5, color: '#374151', lineHeight: 1.4 }}>
              {isMeasured
                ? `${data.maxDemandKVA.toFixed(2)} kVA (measured \u2014 no 125% multiplier per NEC 220.87) + ${data.proposedNewLoadKVA.toFixed(2)} kVA (new) = ${totalFutureDemand.toFixed(2)} kVA`
                : `${data.maxDemandKVA.toFixed(2)} kVA x 1.25 = ${adjustedExisting.toFixed(2)} kVA (adjusted) + ${data.proposedNewLoadKVA.toFixed(2)} kVA (new) = ${totalFutureDemand.toFixed(2)} kVA`}
            </Text>
            <Text style={{ fontSize: 8.5, color: '#374151', lineHeight: 1.4, marginTop: 1 }}>
              {`Service ampacity: ${data.serviceCapacityAmps}A x ${data.serviceVoltage}V${data.servicePhase === 3 ? ' x sqrt(3)' : ''} = ${capacityKVA.toFixed(2)} kVA`}
            </Text>
            <Text
              style={{
                fontSize: 8.5,
                color: isCompliant ? '#15803d' : '#b91c1c',
                lineHeight: 1.4,
                marginTop: 1,
                fontFamily: 'Helvetica-Bold',
              }}
            >
              {isCompliant
                ? `[OK] ${totalFutureDemand.toFixed(2)} kVA <= ${capacityKVA.toFixed(2)} kVA  (${utilizationPct.toFixed(1)}% utilization)`
                : `[FAIL] ${totalFutureDemand.toFixed(2)} kVA EXCEEDS ${capacityKVA.toFixed(2)} kVA  (${utilizationPct.toFixed(1)}% utilization \u2014 SERVICE UPGRADE REQUIRED)`}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', marginBottom: 4 }}>
          <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', width: 18, color: '#1f2937' }}>3.</Text>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 9,
                fontFamily: 'Helvetica-Bold',
                color: '#111827',
                marginBottom: 1,
              }}
            >
              Feeder OCPD per NEC 240.4 and service overload per NEC 230.90 (NEC 220.87(3))
            </Text>
            <Text style={{ fontSize: 8.5, color: '#374151', lineHeight: 1.4 }}>
              {`OCPD (NEC 240.4): ${data.ocpdNotes || 'Existing service main breaker confirmed; sized per NEC 240.4(B) for the conductors it protects.'}`}
            </Text>
            <Text style={{ fontSize: 8.5, color: '#374151', lineHeight: 1.4, marginTop: 1 }}>
              {`Overload (NEC 230.90): ${data.serviceOverloadNotes || 'Existing service overload protection in place; rating not exceeded by the new load.'}`}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={isCompliant ? themeStyles.noteBox : themeStyles.warningBox}
        wrap={false}
      >
        <Text
          style={{
            fontSize: 9,
            fontFamily: 'Helvetica-Bold',
            marginBottom: 2,
            color: isCompliant ? '#1e3a8a' : '#78350f',
          }}
        >
          {isCompliant
            ? 'EXISTING SERVICE ADEQUATE PER NEC 220.87'
            : 'EXISTING SERVICE INADEQUATE \u2014 UPGRADE REQUIRED'}
        </Text>
        <Text style={isCompliant ? themeStyles.noteText : themeStyles.warningText}>
          {isCompliant
            ? `Per NEC 220.87, the existing ${data.serviceCapacityAmps}A service has sufficient capacity for the proposed new load. Contractor's signature on this sheet attests that the three conditions above are verified.`
            : `The proposed new load combined with the existing maximum demand exceeds the ${data.serviceCapacityAmps}A service ampacity. NEC 220.87 cannot be claimed; a service upgrade or load management (NEC 750 / NEC 625.42) is required.`}
        </Text>
      </View>

      <BrandFooter
        projectName={projectName}
        contractorName={contractorName}
        contractorLicense={contractorLicense}
        sheetId={sheetId}
      />
    </Page>
  );
};

// ============================================================================
// AVAILABLE FAULT CURRENT CALCULATION (Sprint 2A H9)
// ============================================================================
// Required by Orlando's "EV Charging Station Permit Checklist" item #5
// (new-service path): "arc fault current calculation, showing the available
// fault current at the service main breaker(s)." Drives the AIC sizing per
// NEC 110.9 + NEC 110.10 — equipment AIC must meet or exceed the available
// fault current at every point in the system.
//
// Pulls values from a service-level entry in `data.shortCircuitCalculations`
// (calculation_type === 'service'). When no service-level calc exists the
// section toggle auto-disables in the UI; the page is never rendered with
// missing values.
//
// Distinct from the existing per-panel ShortCircuitPages — this page is the
// service-main summary AHJs cite. The per-panel sheets remain for downstream
// equipment AIC verification.

interface ShortCircuitResultsBlock {
  faultCurrent?: number;
  requiredAIC?: number;
  details?: {
    sourceFaultCurrent?: number;
    conductorImpedance?: number;
    totalImpedance?: number;
    faultCurrentAtPoint?: number;
    safetyFactor?: number;
  };
  compliance?: {
    compliant?: boolean;
    necArticle?: string;
    message?: string;
  };
}

export interface AvailableFaultCurrentInput {
  /** Service ampacity rating (A). */
  serviceAmps: number | null;
  /** Service voltage (V) — typically 240 (1Φ) or 208/480 (3Φ). */
  serviceVoltage: number | null;
  /** Service phase: 1 or 3. */
  servicePhase: number | null;
  /** Source utility-side fault current (A) — from utility coordination data. */
  sourceFaultCurrent: number | null;
  /** Utility transformer rating (kVA) used as the source assumption. */
  transformerKVA: number | null;
  /** Transformer impedance (% Z). */
  transformerImpedance: number | null;
  /** Service conductor size (e.g., "500 kcmil"). */
  serviceConductorSize: string | null;
  /** Service conductor material ('Cu' or 'Al'). */
  serviceConductorMaterial: string | null;
  /** Service conductor length (ft). */
  serviceConductorLength: number | null;
  /** Calculated short-circuit result block from `services/calculations/shortCircuit.ts`. */
  results: ShortCircuitResultsBlock | null;
  /** Free-text notes from the calc (utility data source, assumptions). */
  notes?: string | null;
}

interface AvailableFaultCurrentPageProps {
  projectName: string;
  projectAddress?: string;
  input: AvailableFaultCurrentInput;
  contractorName?: string;
  contractorLicense?: string;
  sheetId?: string;
}

const fmtAmps = (a: number | undefined | null): string => {
  if (a === undefined || a === null || !Number.isFinite(a)) return '—';
  if (a >= 1000) return `${(a / 1000).toFixed(2)} kA`;
  return `${Math.round(a).toLocaleString()} A`;
};

export const AvailableFaultCurrentPage: React.FC<AvailableFaultCurrentPageProps> = ({
  projectName,
  projectAddress,
  input,
  contractorName,
  contractorLicense,
  sheetId,
}) => {
  const r = input.results ?? {};
  const calculatedFaultA = r.faultCurrent ?? r.details?.faultCurrentAtPoint ?? null;
  const requiredAIC = r.requiredAIC ?? null;
  const sourceFaultA = input.sourceFaultCurrent ?? r.details?.sourceFaultCurrent ?? null;
  const compliant = r.compliance?.compliant ?? null;

  return (
    <Page size="LETTER" style={themeStyles.page}>
      <BrandBar pageLabel="AVAILABLE FAULT CURRENT" sheetId={sheetId} />

      <View style={themeStyles.titleBlock}>
        <Text style={themeStyles.docTitle}>Available Fault Current Calculation</Text>
        <Text style={themeStyles.docSubtitle}>
          {`${projectName}${projectAddress ? ` • ${projectAddress}` : ''} • Service Main • IEEE 141 / NEC 110.9, 110.10`}
        </Text>
      </View>

      {/* Headline cards: input, output, AIC */}
      <View style={themeStyles.summaryRow}>
        <View style={themeStyles.summaryCard}>
          <Text style={themeStyles.summaryLabel}>Service Rating</Text>
          <Text style={themeStyles.summaryValue}>
            {input.serviceAmps ?? '—'}
            <Text style={themeStyles.summaryUnit}>A</Text>
          </Text>
          <Text style={themeStyles.summarySub}>
            {`${input.serviceVoltage ?? '—'}V ${input.servicePhase ? phaseLabel(input.servicePhase) : ''}`}
          </Text>
        </View>
        <View style={themeStyles.summaryCard}>
          <Text style={themeStyles.summaryLabel}>Source Fault Current</Text>
          <Text style={themeStyles.summaryValue}>{fmtAmps(sourceFaultA)}</Text>
          <Text style={themeStyles.summarySub}>at utility transformer secondary</Text>
        </View>
        <View style={themeStyles.summaryCardHighlight}>
          <Text style={themeStyles.summaryLabel}>Available at Service Main</Text>
          <Text style={themeStyles.summaryValue}>{fmtAmps(calculatedFaultA)}</Text>
          <Text style={themeStyles.summarySub}>after service-conductor impedance</Text>
        </View>
        <View style={themeStyles.summaryCard}>
          <Text style={themeStyles.summaryLabel}>Min Required AIC</Text>
          <Text style={themeStyles.summaryValue}>
            {requiredAIC ?? '—'}
            <Text style={themeStyles.summaryUnit}>kA</Text>
          </Text>
          <Text style={themeStyles.summarySub}>NEC 110.9 / 110.10</Text>
        </View>
      </View>

      {/* Source / utility-side assumptions */}
      <View wrap={false}>
        <Text style={themeStyles.sectionTitle}>SOURCE ASSUMPTIONS</Text>
        <View style={themeStyles.projectGrid}>
          <View style={themeStyles.projectCell}>
            <Text style={themeStyles.projectLabel}>Utility Transformer</Text>
            <Text style={themeStyles.projectValue}>
              {input.transformerKVA ? `${input.transformerKVA} kVA` : '— estimated —'}
            </Text>
          </View>
          <View style={themeStyles.projectCell}>
            <Text style={themeStyles.projectLabel}>Transformer Impedance</Text>
            <Text style={themeStyles.projectValue}>
              {input.transformerImpedance ? `${input.transformerImpedance}% Z` : '—'}
            </Text>
          </View>
          <View style={themeStyles.projectCell}>
            <Text style={themeStyles.projectLabel}>Service Conductor</Text>
            <Text style={themeStyles.projectValue}>
              {input.serviceConductorSize
                ? `${input.serviceConductorSize}${input.serviceConductorMaterial ? ` ${input.serviceConductorMaterial}` : ''}`
                : '—'}
            </Text>
          </View>
          <View style={themeStyles.projectCell}>
            <Text style={themeStyles.projectLabel}>Conductor Length</Text>
            <Text style={themeStyles.projectValue}>
              {input.serviceConductorLength ? `${input.serviceConductorLength} ft` : '—'}
            </Text>
          </View>
        </View>
      </View>

      {/* Calculation derivation */}
      <View wrap={false}>
        <Text style={themeStyles.sectionTitle}>CALCULATION DERIVATION (IEEE 141)</Text>
        <View style={themeStyles.table}>
          <View style={themeStyles.tableHeaderRow}>
            <Text style={[themeStyles.th, { width: '50%' }]}>Component</Text>
            <Text style={[themeStyles.th, { width: '50%' }]}>Value</Text>
          </View>
          <View style={themeStyles.tableRow}>
            <Text style={[themeStyles.td, { width: '50%' }]}>Source fault current (utility transformer secondary)</Text>
            <Text style={[themeStyles.td, { width: '50%' }]}>{fmtAmps(sourceFaultA)}</Text>
          </View>
          {r.details?.conductorImpedance !== undefined && r.details.conductorImpedance !== null && (
            <View style={themeStyles.tableRowAlt}>
              <Text style={[themeStyles.td, { width: '50%' }]}>Service-conductor impedance to main</Text>
              <Text style={[themeStyles.td, { width: '50%' }]}>{r.details.conductorImpedance.toFixed(4)} ohms</Text>
            </View>
          )}
          {r.details?.totalImpedance !== undefined && r.details.totalImpedance !== null && (
            <View style={themeStyles.tableRow}>
              <Text style={[themeStyles.td, { width: '50%' }]}>Total impedance to fault point</Text>
              <Text style={[themeStyles.td, { width: '50%' }]}>{r.details.totalImpedance.toFixed(4)} ohms</Text>
            </View>
          )}
          <View style={themeStyles.tableRowAlt}>
            <Text style={[themeStyles.td, { width: '50%', fontFamily: 'Helvetica-Bold' }]}>Available fault current at service main</Text>
            <Text style={[themeStyles.td, { width: '50%', fontFamily: 'Helvetica-Bold' }]}>{fmtAmps(calculatedFaultA)}</Text>
          </View>
          {r.details?.safetyFactor !== undefined && r.details.safetyFactor !== null && (
            <View style={themeStyles.tableRow}>
              <Text style={[themeStyles.td, { width: '50%' }]}>Safety factor applied</Text>
              <Text style={[themeStyles.td, { width: '50%' }]}>{r.details.safetyFactor}x</Text>
            </View>
          )}
          <View style={themeStyles.tableRowAlt}>
            <Text style={[themeStyles.td, { width: '50%', fontFamily: 'Helvetica-Bold' }]}>Minimum required AIC rating</Text>
            <Text style={[themeStyles.td, { width: '50%', fontFamily: 'Helvetica-Bold' }]}>
              {requiredAIC !== null && requiredAIC !== undefined ? `${requiredAIC} kA` : '—'}
            </Text>
          </View>
        </View>
      </View>

      {/* Verdict */}
      <View
        style={compliant === false ? themeStyles.warningBox : themeStyles.noteBox}
        wrap={false}
      >
        <Text
          style={{
            fontSize: 9,
            fontFamily: 'Helvetica-Bold',
            marginBottom: 2,
            color: compliant === false ? '#78350f' : '#1e3a8a',
          }}
        >
          NEC 110.9 + 110.10 — INTERRUPTING RATING
        </Text>
        <Text style={compliant === false ? themeStyles.warningText : themeStyles.noteText}>
          {compliant === false
            ? `Equipment AIC ratings on the Equipment Specs sheet must equal or exceed the available fault current at every connection point. One or more devices in this packet do NOT meet that threshold and must be upsized or series-rated per NEC 240.86.`
            : `All equipment installed under this permit shall have an interrupting rating equal to or greater than the available fault current at its line-side terminals (NEC 110.9). Equipment AIC ratings shown on the Equipment Specs sheet are confirmed against the value above.`}
        </Text>
      </View>

      {input.notes && (
        <View style={themeStyles.noteBox}>
          <Text style={{ fontSize: 8.5, color: '#1e3a8a' }}>{`Notes: ${input.notes}`}</Text>
        </View>
      )}

      <BrandFooter
        projectName={projectName}
        contractorName={contractorName}
        contractorLicense={contractorLicense}
        sheetId={sheetId}
      />
    </Page>
  );
};

// ============================================================================
// EVEMS OPERATIONAL NARRATIVE (Sprint 2A H10)
// ============================================================================
// Required by every FL AHJ that reviews NEC 625.42 designs. The narrative
// explains how the Energy Management System (EVMS / EMS) clamps the EV bank's
// aggregate demand to the declared setpoint so reviewers can trust the
// service-level demand reduction credit. Without this page, AHJs see a
// reduced feeder calc with no explanation of how the load is actually
// controlled — and reject the design defensively.
//
// Renders one detail block per EVEMS-managed panel, sourcing the setpoint
// from the explicit "EVEMS Aggregate Setpoint (NEC 625.42)" marker circuit
// (preferred) or falling back to `panel.main_breaker_amps × voltage` for
// legacy projects.

export interface EVEMSNarrativePanelEntry {
  panelId: string;
  panelName: string;
  /** EVEMS setpoint VA from the explicit marker circuit (preferred). */
  setpointVA: number | null;
  /** True when setpointVA came from the marker; false for legacy proxy. */
  hasExplicitMarker: boolean;
  /** Panel main breaker rating (informational; bounds the proxy fallback). */
  mainBreakerAmps: number | null;
  /** Panel voltage (V). */
  voltage: number;
  /** Panel phase (1 or 3). */
  phase: 1 | 3;
  /** Optional contractor-supplied EVEMS device manufacturer + model. */
  deviceManufacturerModel?: string;
}

interface EVEMSNarrativePageProps {
  projectName: string;
  panels: EVEMSNarrativePanelEntry[];
  contractorName?: string;
  contractorLicense?: string;
  sheetId?: string;
}

const fmtKVA = (va: number | null): string => {
  if (va === null || !Number.isFinite(va)) return '—';
  return `${(va / 1000).toFixed(2)} kVA`;
};

const fmtAmpsFromVA = (va: number | null, voltage: number, phase: 1 | 3): string => {
  if (va === null || !Number.isFinite(va) || voltage <= 0) return '—';
  const denom = phase === 3 ? voltage * 1.732 : voltage;
  return `${(va / denom).toFixed(0)} A`;
};

export const EVEMSNarrativePage: React.FC<EVEMSNarrativePageProps> = ({
  projectName,
  panels,
  contractorName,
  contractorLicense,
  sheetId,
}) => (
  <Page size="LETTER" style={themeStyles.page}>
    <BrandBar pageLabel="EVEMS NARRATIVE" sheetId={sheetId} />

    <View style={themeStyles.titleBlock}>
      <Text style={themeStyles.docTitle}>EVEMS Operational Narrative</Text>
      <Text style={themeStyles.docSubtitle}>
        {`${projectName} • NEC 625.42 — Energy Management System for EV Charging`}
      </Text>
    </View>

    {/* Top-level summary table — one row per EVEMS-managed panel */}
    <View style={themeStyles.table} wrap={false}>
      <View style={themeStyles.tableHeaderRow}>
        <Text style={[themeStyles.th, { width: '30%' }]}>Panel</Text>
        <Text style={[themeStyles.th, { width: '20%' }]}>Setpoint (kVA)</Text>
        <Text style={[themeStyles.th, { width: '20%' }]}>Setpoint (A)</Text>
        <Text style={[themeStyles.th, { width: '15%' }]}>Service</Text>
        <Text style={[themeStyles.th, { width: '15%' }]}>Source</Text>
      </View>
      {panels.map((p, idx) => (
        <View
          key={p.panelId}
          style={idx % 2 === 0 ? themeStyles.tableRow : themeStyles.tableRowAlt}
          wrap={false}
        >
          <Text style={[themeStyles.td, { width: '30%', fontFamily: 'Helvetica-Bold' }]}>{p.panelName}</Text>
          <Text style={[themeStyles.td, { width: '20%' }]}>{fmtKVA(p.setpointVA)}</Text>
          <Text style={[themeStyles.td, { width: '20%' }]}>{fmtAmpsFromVA(p.setpointVA, p.voltage, p.phase)}</Text>
          <Text style={[themeStyles.td, { width: '15%' }]}>{`${p.voltage}V ${phaseLabel(p.phase)}`}</Text>
          <Text style={[themeStyles.td, { width: '15%', fontSize: 7 }]}>
            {p.hasExplicitMarker ? 'declared' : 'estimated'}
          </Text>
        </View>
      ))}
    </View>

    {/* Per-panel detail blocks — six required narrative elements per AHJ */}
    {panels.map((p) => (
      <View key={`detail-${p.panelId}`} wrap={false} style={{ marginTop: 8 }}>
        <Text style={themeStyles.sectionTitle}>{`${p.panelName.toUpperCase()} — EVEMS DETAILS`}</Text>

        <View style={{ marginBottom: 4 }}>
          <Text style={themeStyles.subSectionTitle}>1. Device</Text>
          <Text style={{ fontSize: 8.5, color: '#374151', lineHeight: 1.4 }}>
            {p.deviceManufacturerModel
              ? `${p.deviceManufacturerModel}. UL 916 listed Energy Management System (or NRTL equivalent).`
              : 'Manufacturer/model to be specified on contractor-supplied EVEMS cut sheet. Device shall be listed to UL 916 (Energy Management Equipment) or equivalent NRTL standard.'}
          </Text>
        </View>

        <View style={{ marginBottom: 4 }}>
          <Text style={themeStyles.subSectionTitle}>2. Maximum Aggregate Setpoint (NEC 625.42)</Text>
          <Text style={{ fontSize: 8.5, color: '#374151', lineHeight: 1.4 }}>
            {p.setpointVA !== null
              ? `Setpoint = ${fmtKVA(p.setpointVA)} (${fmtAmpsFromVA(p.setpointVA, p.voltage, p.phase)} at ${p.voltage}V ${phaseLabel(p.phase)}). ${p.hasExplicitMarker ? 'Declared via the project autogeneration EVEMS marker circuit; verified against contractor-supplied EVEMS configuration.' : `Estimated from panel main-breaker rating (${p.mainBreakerAmps ?? '?'}A) — actual setpoint shall be field-verified and documented before energization.`}`
              : 'Setpoint not yet recorded for this panel. Required before AHJ submittal.'}
          </Text>
        </View>

        <View style={{ marginBottom: 4 }}>
          <Text style={themeStyles.subSectionTitle}>3. Service Main / Sub-Feed Monitoring Points</Text>
          <Text style={{ fontSize: 8.5, color: '#374151', lineHeight: 1.4 }}>
            EVEMS shall monitor the upstream feeder serving this EV panel via current transformers (CTs)
            installed at the feeder's source. Where multiple downstream EV panels share a single upstream
            point, the EVEMS shall aggregate readings and clamp combined demand to the declared setpoint.
          </Text>
        </View>

        <View style={{ marginBottom: 4 }}>
          <Text style={themeStyles.subSectionTitle}>4. Failure Mode (Signal Loss / Power Loss)</Text>
          <Text style={{ fontSize: 8.5, color: '#374151', lineHeight: 1.4 }}>
            On loss of monitoring signal or EVEMS controller power, the system shall fail to its lowest
            permitted setpoint — typically by curtailing or disconnecting controlled charging branches.
            EV chargers shall not exceed branch-circuit nameplate ratings under any failure condition
            (NEC 625.42 + 625.40). Reset requires manual contractor action or controller power cycle.
          </Text>
        </View>

        <View style={{ marginBottom: 4 }}>
          <Text style={themeStyles.subSectionTitle}>5. Tamper Protection (NEC 750)</Text>
          <Text style={{ fontSize: 8.5, color: '#374151', lineHeight: 1.4 }}>
            EVEMS controller and CT enclosures shall be physically secured (locking enclosures, sealed
            wireways) and configuration shall be password-protected at the device level. Setpoint
            changes shall be logged. Field setpoint adjustments outside of the declared maximum require
            an updated permit submittal per NEC 625.42.
          </Text>
        </View>

        <View style={{ marginBottom: 4 }}>
          <Text style={themeStyles.subSectionTitle}>6. NEC 625.42 Compliance Statement</Text>
          <Text style={{ fontSize: 8.5, color: '#374151', lineHeight: 1.4 }}>
            Branch conductors and overcurrent protection are sized to full continuous nameplate × 125%
            per NEC 625.40 / 210.19. The feeder and service-side conductors are sized to the declared
            EVEMS setpoint per NEC 625.42, allowing service capacity reuse for new EV loads without a
            full service upgrade. Field commissioning shall verify the setpoint against this narrative
            before energization.
          </Text>
        </View>
      </View>
    ))}

    <View style={themeStyles.noteBox} wrap={false}>
      <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 2, color: '#1e3a8a' }}>
        SCOPE OF THIS NARRATIVE
      </Text>
      <Text style={themeStyles.noteText}>
        This page documents the EVEMS design intent for AHJ review. The contractor shall supply
        manufacturer cut sheets for the EVEMS controller, CTs, and any associated hardware as part of
        equipment specifications. Field commissioning records (setpoint configuration, CT secondary
        polarity, failure-mode test) shall be provided to the AHJ on inspection per NEC 625.42.
      </Text>
    </View>

    <BrandFooter
      projectName={projectName}
      contractorName={contractorName}
      contractorLicense={contractorLicense}
      sheetId={sheetId}
    />
  </Page>
);

// ============================================================================
// EVSE LABELING (Sprint 2A H11 — NEC 625.43, NEC 110.21, NEC 110.22)
// ============================================================================
// Required by every FL AHJ. NEC 625.43 mandates disconnect labels at every
// EVSE installation; NEC 110.21 requires the equipment to be identified by
// manufacturer; NEC 110.22 requires each disconnect to be marked with its
// purpose. This page is the contractor's reference for what labels must be
// applied in the field — the actual label application happens on inspection,
// but the AHJ wants the contractor to have signed off that they understand
// the requirements before energization.
//
// Renders one row per detected EV-bank panel with the required label text.
// Adds an emergency-shutoff section that's flagged as commercial-only (Davie
// + commercial scopes). Bottom signature line for contractor attestation.

export interface EVSELabelingPanelEntry {
  panelId: string;
  panelName: string;
  /** Number of EV charging branch circuits on this panel (informational). */
  chargerCircuitCount: number;
  /** Optional EVSE location text — "Parking garage level B-2", etc. */
  location?: string;
}

interface EVSELabelingPageProps {
  projectName: string;
  panels: EVSELabelingPanelEntry[];
  /** When true, also renders the commercial emergency-shutoff section. */
  isCommercial: boolean;
  contractorName?: string;
  contractorLicense?: string;
  sheetId?: string;
}

export const EVSELabelingPage: React.FC<EVSELabelingPageProps> = ({
  projectName,
  panels,
  isCommercial,
  contractorName,
  contractorLicense,
  sheetId,
}) => (
  <Page size="LETTER" style={themeStyles.page}>
    <BrandBar pageLabel="EVSE LABELING" sheetId={sheetId} />

    <View style={themeStyles.titleBlock}>
      <Text style={themeStyles.docTitle}>EVSE Labeling &amp; Disconnect Requirements</Text>
      <Text style={themeStyles.docSubtitle}>
        {`${projectName} • NEC 625.43, 110.21, 110.22 — Field labeling reference`}
      </Text>
    </View>

    <View style={themeStyles.noteBox}>
      <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 2, color: '#1e3a8a' }}>
        SCOPE OF THIS SHEET
      </Text>
      <Text style={themeStyles.noteText}>
        Contractor shall apply the labels documented below to all EVSE branch
        circuits, disconnects, and panel directories prior to energization.
        Field-applied labels shall be permanent (engraved phenolic, embossed,
        or weatherproof printed adhesive — not handwritten). AHJ inspector
        will verify labels are applied per this reference at final inspection.
      </Text>
    </View>

    <View wrap={false}>
      <Text style={themeStyles.sectionTitle}>EVSE PANEL DISCONNECT LABELS (NEC 625.43)</Text>
      <View style={themeStyles.table}>
        <View style={themeStyles.tableHeaderRow}>
          <Text style={[themeStyles.th, { width: '25%' }]}>Panel</Text>
          <Text style={[themeStyles.th, { width: '15%' }]}>Branches</Text>
          <Text style={[themeStyles.th, { width: '60%' }]}>Required Label Text</Text>
        </View>
        {panels.map((p, idx) => (
          <View
            key={p.panelId}
            style={idx % 2 === 0 ? themeStyles.tableRow : themeStyles.tableRowAlt}
            wrap={false}
          >
            <Text style={[themeStyles.td, { width: '25%', fontFamily: 'Helvetica-Bold' }]}>
              {p.panelName}
            </Text>
            <Text style={[themeStyles.td, { width: '15%' }]}>{p.chargerCircuitCount}</Text>
            <Text style={[themeStyles.td, { width: '60%', fontSize: 7 }]}>
              {`"EV CHARGING — ${p.panelName.toUpperCase()}${p.location ? `, ${p.location.toUpperCase()}` : ''} — DO NOT OPERATE WHILE LOADED" — applied to panel deadfront and to each EVSE disconnect cover.`}
            </Text>
          </View>
        ))}
      </View>
    </View>

    <View wrap={false}>
      <Text style={themeStyles.sectionTitle}>REQUIRED LABEL CONTENT — APPLIES TO EACH EVSE</Text>
      {[
        'Manufacturer name and EVSE model number (NEC 110.21).',
        'Circuit source and OCPD identifier (e.g., "Fed from EV Sub-Panel, breaker #5") (NEC 408.4 + 110.22).',
        'Voltage and ampacity ratings on the disconnect cover (NEC 110.22).',
        'Disconnect within sight of the EVSE OR a lockable disconnect within sight, lockable in the OFF position only (NEC 625.43 + 110.25).',
        'Required arc-flash hazard / shock hazard warning per NEC 110.16 — applied to panels rated 1200A+ or where calculations indicate Cat 2+ exposure.',
        'Available fault current marking (kA) at the service-side equipment (NEC 110.24) — coordinate with the Available Fault Current sheet.',
      ].map((line, idx) => (
        <View key={idx} style={{ flexDirection: 'row', marginBottom: 3 }}>
          <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', width: 18, color: '#1f2937' }}>
            {`${idx + 1}.`}
          </Text>
          <Text style={{ fontSize: 8.5, color: '#374151', lineHeight: 1.4, flex: 1 }}>
            {line}
          </Text>
        </View>
      ))}
    </View>

    <View wrap={false}>
      <Text style={themeStyles.sectionTitle}>BREAKER / DISCONNECT LOCKING</Text>
      <Text style={themeStyles.proseBlock}>
        Each EV branch circuit breaker shall be capable of being locked in the OFF position. Locking
        means shall remain in place whether or not the lock is installed (per NEC 110.25 / 625.43).
        Where the breaker itself is not lockable, a UL-listed lockoff accessory shall be installed.
      </Text>
    </View>

    {isCommercial && (
      <View wrap={false}>
        <Text style={themeStyles.sectionTitle}>EMERGENCY SHUTOFF — COMMERCIAL EVSE INSTALLATIONS</Text>
        <Text style={themeStyles.proseBlock}>
          Commercial EVSE installations (Davie commercial scope, Knox-box-required jurisdictions)
          shall include an emergency-shutoff means accessible to first responders. Mount in a
          location pre-coordinated with the local fire marshal — typically near the main entrance
          of the parking facility or at the building service entrance. Label clearly: "EV CHARGING
          — EMERGENCY SHUTOFF". The shutoff shall be a single-action device that disconnects all
          EVSE-feeding circuits.
        </Text>
      </View>
    )}

    <View style={themeStyles.warningBox} wrap={false}>
      <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 2, color: '#78350f' }}>
        CONTRACTOR ATTESTATION
      </Text>
      <Text style={themeStyles.warningText}>
        By signing this sheet, the contractor confirms that all field-applied labels per the
        requirements above will be installed before energization, and that the AHJ inspector
        will verify them at final inspection. Failure to install required labels is grounds for
        rejection of the inspection.
      </Text>
    </View>

    <BrandFooter
      projectName={projectName}
      contractorName={contractorName}
      contractorLicense={contractorLicense}
      sheetId={sheetId}
    />
  </Page>
);

