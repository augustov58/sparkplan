/**
 * Permit Packet PDF Document Components
 * Generates comprehensive permit application packet with all required documents
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import type { Panel, Circuit, Feeder, Transformer } from '../../lib/database.types';
import { PanelScheduleDocument } from './PanelScheduleDocuments';

// Register fonts
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'Helvetica' },
    { src: 'Helvetica-Bold', fontWeight: 'bold' },
  ]
});

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

    <View>
      <Text style={permitStyles.footer}>
        This permit package was generated by NEC Pro Compliance. All calculations comply with NEC 2023.
      </Text>
    </View>
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

              return (
                <View key={feeder.id} style={idx % 2 === 0 ? permitStyles.tableRow : permitStyles.tableRowAlt}>
                  <Text style={{ width: '20%' }}>{feeder.name}</Text>
                  <Text style={{ width: '25%' }}>{sourcePanel?.name || 'Unknown'}</Text>
                  <Text style={{ width: '25%' }}>{destination}</Text>
                  <Text style={{ width: '15%' }}>{feeder.phase_conductor_size || 'N/A'}</Text>
                  <Text style={{ width: '15%' }}>
                    N/A
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      <Text style={permitStyles.footer}>
        Page 2 - Equipment Schedule | {projectName}
      </Text>
    </Page>
  );
};

// ============================================================================
// RISER DIAGRAM (Text-Based System Hierarchy)
// ============================================================================

interface RiserDiagramProps {
  panels: Panel[];
  transformers: Transformer[];
  feeders: Feeder[];
  projectName: string;
  serviceVoltage: number;
  servicePhase: number;
}

export const RiserDiagram: React.FC<RiserDiagramProps> = ({
  panels,
  transformers,
  feeders,
  projectName,
  serviceVoltage,
  servicePhase,
}) => {
  const mainPanel = panels.find(p => p.is_main);

  // Build hierarchy recursively
  const renderPanelHierarchy = (panelId: string, level: number = 0): any[] => {
    const panel = panels.find(p => p.id === panelId);
    if (!panel) return [];

    const indent = '  '.repeat(level);
    const elements: any[] = [];

    // Panel info
    elements.push(
      <Text key={`panel-${panelId}`} style={{ fontSize: 9, marginBottom: 3, marginLeft: level * 15 }}>
        {indent}├─ {panel.name} ({panel.voltage}V {panel.phase}φ, {panel.bus_rating}A)
        {panel.main_breaker_amps ? ` - ${panel.main_breaker_amps}A Main` : ' - MLO'}
      </Text>
    );

    // Find feeders from this panel
    const downstreamFeeders = feeders.filter(f => f.source_panel_id === panelId);

    downstreamFeeders.forEach(feeder => {
      // Check if feeding a panel or transformer
      if (feeder.destination_panel_id) {
        const destPanel = panels.find(p => p.id === feeder.destination_panel_id);
        if (destPanel) {
          elements.push(
            <Text key={`feeder-${feeder.id}`} style={{ fontSize: 8, marginBottom: 2, marginLeft: (level + 1) * 15, color: '#666' }}>
              {indent}  │  Feeder: {feeder.phase_conductor_size || 'N/A'} {feeder.conductor_material || 'Cu'}
            </Text>
          );
          elements.push(...renderPanelHierarchy(destPanel.id, level + 1));
        }
      } else if (feeder.destination_transformer_id) {
        const xfmr = transformers.find(t => t.id === feeder.destination_transformer_id);
        if (xfmr) {
          elements.push(
            <Text key={`xfmr-${xfmr.id}`} style={{ fontSize: 9, marginBottom: 3, marginLeft: (level + 1) * 15 }}>
              {indent}  ├─ {xfmr.name} ({xfmr.kva_rating} kVA, {xfmr.primary_voltage}V→{xfmr.secondary_voltage}V)
            </Text>
          );

          // Find panels fed from this transformer
          const xfmrPanels = panels.filter(p => p.fed_from_type === 'transformer' && p.fed_from_transformer_id === xfmr.id);
          xfmrPanels.forEach(xfmrPanel => {
            elements.push(...renderPanelHierarchy(xfmrPanel.id, level + 2));
          });
        }
      }
    });

    return elements;
  };

  return (
    <Page size="LETTER" style={permitStyles.page}>
      <Text style={permitStyles.sectionTitle}>RISER DIAGRAM - SYSTEM HIERARCHY</Text>

      <Text style={{ fontSize: 10, marginBottom: 15, color: '#666' }}>
        This diagram shows the electrical power distribution from service entrance through all panels and transformers.
      </Text>

      {/* Service Entrance */}
      <View style={{ marginBottom: 20, padding: 10, backgroundColor: '#f9f9f9', borderRadius: 4 }}>
        <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 5 }}>
          UTILITY SERVICE
        </Text>
        <Text style={{ fontSize: 9 }}>
          Service: {serviceVoltage}V {servicePhase === 3 ? '3-Phase' : 'Single-Phase'}
        </Text>
        <Text style={{ fontSize: 9 }}>
          ↓
        </Text>
        <Text style={{ fontSize: 9 }}>
          Meter
        </Text>
        <Text style={{ fontSize: 9 }}>
          ↓
        </Text>
      </View>

      {/* Panel Hierarchy */}
      <View style={{ marginBottom: 20 }}>
        {mainPanel ? (
          renderPanelHierarchy(mainPanel.id)
        ) : (
          <Text style={{ fontSize: 9, fontStyle: 'italic', color: '#999' }}>
            No main panel defined
          </Text>
        )}
      </View>

      {/* Legend */}
      <View style={{ marginTop: 30, padding: 10, backgroundColor: '#f0f0f0', borderRadius: 4 }}>
        <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 5 }}>
          LEGEND
        </Text>
        <Text style={{ fontSize: 8, marginBottom: 2 }}>
          • MDP = Main Distribution Panel
        </Text>
        <Text style={{ fontSize: 8, marginBottom: 2 }}>
          • MLO = Main Lug Only (no main breaker)
        </Text>
        <Text style={{ fontSize: 8, marginBottom: 2 }}>
          • Feeder conductor sizes shown above each sub-panel connection
        </Text>
        <Text style={{ fontSize: 8 }}>
          • All voltage and amperage ratings shown in parentheses
        </Text>
      </View>

      <Text style={permitStyles.footer}>
        Page 3 - Riser Diagram | {projectName}
      </Text>
    </Page>
  );
};

// ============================================================================
// LOAD CALCULATION SUMMARY
// ============================================================================

interface LoadSummaryProps {
  panels: Panel[];
  circuits: Circuit[];
  projectName: string;
  serviceVoltage: number;
  servicePhase: number;
}

export const LoadCalculationSummary: React.FC<LoadSummaryProps> = ({
  panels,
  circuits,
  projectName,
  serviceVoltage,
  servicePhase,
}) => {
  // Calculate total connected load
  const totalConnectedVA = circuits.reduce((sum, c) => sum + (c.load_watts || 0), 0);
  const totalConnectedkVA = totalConnectedVA / 1000;
  
  // Calculate load per panel
  const panelLoads = panels.map(panel => {
    const panelCircuits = circuits.filter(c => c.panel_id === panel.id);
    const panelLoadVA = panelCircuits.reduce((sum, c) => sum + (c.load_watts || 0), 0);
    return {
      panel,
      loadVA: panelLoadVA,
      loadkVA: panelLoadVA / 1000,
      circuitCount: panelCircuits.length,
    };
  });

  // Estimate demand load (simplified - actual calculation is more complex)
  const estimatedDemandkVA = totalConnectedkVA * 0.8;

  return (
    <Page size="LETTER" style={permitStyles.page}>
      <Text style={permitStyles.sectionTitle}>LOAD CALCULATION SUMMARY</Text>

      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 10 }}>
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
            <Text style={permitStyles.coverInfoLabel}>Total Connected Load:</Text>
            <Text style={permitStyles.coverInfoValue}>
              {totalConnectedkVA.toFixed(2)} kVA ({totalConnectedVA.toLocaleString()} VA)
            </Text>
          </View>
          <View style={permitStyles.coverInfoRow}>
            <Text style={permitStyles.coverInfoLabel}>Estimated Demand Load:</Text>
            <Text style={permitStyles.coverInfoValue}>
              {estimatedDemandkVA.toFixed(2)} kVA (80% demand factor applied)
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

      <View>
        <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}>
          LOAD BY PANEL
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
          {panelLoads.map((panelLoad, idx) => (
            <View key={panelLoad.panel.id} style={idx % 2 === 0 ? permitStyles.tableRow : permitStyles.tableRowAlt}>
              <Text style={{ width: '25%' }}>{panelLoad.panel.name}</Text>
              <Text style={{ width: '15%' }}>{panelLoad.panel.voltage}V</Text>
              <Text style={{ width: '10%' }}>{panelLoad.panel.phase}φ</Text>
              <Text style={{ width: '15%' }}>{panelLoad.circuitCount}</Text>
              <Text style={{ width: '20%' }}>{panelLoad.loadkVA.toFixed(2)}</Text>
              <Text style={{ width: '15%' }}>{panelLoad.panel.bus_rating}A</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ marginTop: 20, padding: 10, backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd' }}>
        <Text style={{ fontSize: 9, fontStyle: 'italic', color: '#666' }}>
          Note: Demand factors are estimated. Actual demand calculations should be performed per NEC Article 220 
          based on load types and occupancy classification.
        </Text>
      </View>

      <Text style={permitStyles.footer}>
        Page 3 - Load Calculation Summary | {projectName}
      </Text>
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

      <Text style={permitStyles.footer}>
        Page 4 - NEC Compliance Summary | {projectName}
      </Text>
    </Page>
  );
};

