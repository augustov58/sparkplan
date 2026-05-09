/**
 * Permit Packet Generator Component
 * UI for generating comprehensive permit application packets
 */

import React, { useState, useEffect } from 'react';
import { FileText, Download, Loader2, AlertCircle, CheckCircle, Info, Building2, AlertTriangle, ListChecks } from 'lucide-react';
import { generatePermitPacket, generateLightweightPermitPacket, type PermitPacketData } from '../services/pdfExport/permitPacketGenerator';
import {
  DEFAULT_SECTIONS,
  resolveSections,
  type PacketSections,
} from '../services/pdfExport/packetSections';
import { usePanels } from '../hooks/usePanels';
import { useCircuits } from '../hooks/useCircuits';
import { useFeeders } from '../hooks/useFeeders';
import { useTransformers } from '../hooks/useTransformers';
import { useGrounding } from '../hooks/useGrounding';
import { useProjects } from '../hooks/useProjects';
import { useJurisdictions } from '../hooks/useJurisdictions';
import { useShortCircuitCalculations } from '../hooks/useShortCircuitCalculations';
import { useMeterStacks } from '../hooks/useMeterStacks';
import { useMeters } from '../hooks/useMeters';
import { useProfile } from '../hooks/useProfile';
import { JurisdictionSearchWizard } from './JurisdictionSearchWizard';
import { calculateMultiFamilyEV, type MultiFamilyEVInput } from '../services/calculations/multiFamilyEV';
import { buildMultiFamilyContext } from '../services/calculations/upstreamLoadAggregation';
import {
  projectAddressSchema,
  flContractorLicenseSchema,
  permitNumberSchema,
} from '../lib/validation-schemas';

interface PermitPacketGeneratorProps {
  projectId: string;
}

// ============================================================================
// SECTION TOGGLE PANEL CONFIG
// ============================================================================
// Source of truth for the "Configure Sections" UI grid. Each row maps a
// PacketSections key to its display label, group, optional warning text
// (shown when toggled OFF — for sections most AHJs require), and a function
// that decides whether the toggle should be auto-disabled because the
// underlying data is missing.

interface SectionToggleConfig {
  key: keyof PacketSections;
  label: string;
  description: string;
  group: 'Document Meta' | 'Engineering' | 'Diagrams & Equipment' | 'Multi-Family' | 'Compliance & AHJ' | 'Panels';
  /**
   * Banner shown when the section is toggled OFF. Use for sections that
   * most AHJs reject without (Compliance Summary, Panel Schedules).
   */
  offWarning?: string;
}

const SECTION_TOGGLE_CONFIG: SectionToggleConfig[] = [
  {
    key: 'tableOfContents',
    label: 'Table of Contents',
    description: 'Sheet 002 — index of all sheets in the packet',
    group: 'Document Meta',
  },
  {
    key: 'revisionLog',
    label: 'Revision Log',
    description: 'Audit trail of plan revisions; auto-populates Rev 0 on first submittal',
    group: 'Document Meta',
  },
  {
    key: 'generalNotes',
    label: 'General Notes',
    description: 'Numbered notes covering NEC compliance, voltage drop convention, grounding',
    group: 'Document Meta',
  },
  {
    key: 'loadCalculation',
    label: 'Load Calculation Summary',
    description: 'NEC 220 demand factor breakdown for the MDP',
    group: 'Engineering',
  },
  {
    key: 'voltageDrop',
    label: 'Voltage Drop Analysis',
    description: 'Per-feeder voltage drop per NEC Chapter 9 Table 9',
    group: 'Engineering',
  },
  {
    key: 'shortCircuit',
    label: 'Short Circuit Analysis',
    description: 'Available fault current at each panel (IEEE 141)',
    group: 'Engineering',
  },
  {
    key: 'arcFlash',
    label: 'Arc Flash Analysis',
    description: 'Incident energy + PPE category per NFPA 70E',
    group: 'Engineering',
  },
  {
    key: 'riserDiagram',
    label: 'Riser Diagram',
    description: 'One-line/system hierarchy diagram',
    group: 'Diagrams & Equipment',
  },
  {
    key: 'equipmentSchedule',
    label: 'Equipment Schedule',
    description: 'Tabular list of all panels, transformers, feeders',
    group: 'Diagrams & Equipment',
  },
  {
    key: 'equipmentSpecs',
    label: 'Equipment Specifications',
    description: 'Detailed spec sheets per panel + transformer',
    group: 'Diagrams & Equipment',
  },
  {
    key: 'grounding',
    label: 'Grounding Plan',
    description: 'GEC sizing + bonding details per NEC 250',
    group: 'Diagrams & Equipment',
  },
  {
    key: 'meterStack',
    label: 'Meter Stack Schedule',
    description: 'CT cabinet + meter positions (multi-family)',
    group: 'Multi-Family',
  },
  {
    key: 'multiFamilyEV',
    label: 'Multi-Family EV Analysis',
    description: '3-page NEC 220.84 + 220.57 + 625.42 readiness analysis',
    group: 'Multi-Family',
  },
  {
    key: 'panelSchedules',
    label: 'Panel Schedules',
    description: 'One sheet per panel (NEC 408 requires these for permit submittal)',
    group: 'Panels',
    offWarning: 'NEC 408 requires panel schedules for most permit submittals. Most AHJs will reject the packet without them.',
  },
  {
    key: 'complianceSummary',
    label: 'NEC Compliance Summary',
    description: 'Engineering attestation that the design meets NEC requirements',
    group: 'Compliance & AHJ',
    offWarning: 'Some AHJs reject packets without an engineering compliance summary. Toggle off only if you are providing your own attestation.',
  },
  {
    key: 'jurisdiction',
    label: 'Jurisdiction Requirements',
    description: 'Per-AHJ checklist (requires a jurisdiction selected above)',
    group: 'Compliance & AHJ',
  },
];

export const PermitPacketGenerator: React.FC<PermitPacketGeneratorProps> = ({ projectId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [preparedBy, setPreparedBy] = useState('');
  const [permitNumber, setPermitNumber] = useState('');
  const [packetType, setPacketType] = useState<'full' | 'lightweight'>('full');
  // Tier 1 additions
  const [contractorLicense, setContractorLicense] = useState('');
  const [scopeOfWork, setScopeOfWork] = useState('');
  const [serviceType, setServiceType] = useState<'overhead' | 'underground'>('overhead');
  const [meterLocation, setMeterLocation] = useState('');
  const [serviceConductorRouting, setServiceConductorRouting] = useState('');

  // Multi-Family EV Analysis state
  const [includeMultiFamilyEV, setIncludeMultiFamilyEV] = useState(false);
  const [mfEvDwellingUnits, setMfEvDwellingUnits] = useState(20);
  const [mfEvChargersPerUnit, setMfEvChargersPerUnit] = useState(1);
  const [mfEvChargerLevel, setMfEvChargerLevel] = useState<'level1' | 'level2'>('level2');
  const [mfEvBuildingName, setMfEvBuildingName] = useState('');

  // Sprint 2A H1+H2+H3: per-section toggles for the packet generator. Initialized
  // from `projects.settings.sectionPreferences` (when present); otherwise falls
  // back to all-on. Auto-persists to the project on every toggle change.
  const [sectionPrefs, setSectionPrefs] = useState<Partial<PacketSections>>({});

  // Fetch project data - hooks must be called unconditionally
  const { projects, updateProject } = useProjects();
  const currentProject = projectId ? projects.find(p => p.id === projectId) : undefined;
  const { panels, loading: panelsLoading } = usePanels(projectId || '');
  const { circuits, loading: circuitsLoading } = useCircuits(projectId || '');
  const { feeders, loading: feedersLoading } = useFeeders(projectId || '');
  const { transformers, loading: transformersLoading } = useTransformers(projectId || '');
  const { grounding, loading: groundingLoading } = useGrounding(projectId || '');
  const { getJurisdictionById } = useJurisdictions();
  const { calculations: shortCircuitCalculations } = useShortCircuitCalculations(projectId || '');
  const { meterStacks } = useMeterStacks(projectId || '');
  const { meters } = useMeters(projectId || '');
  const { profile } = useProfile();

  // Auto-fill from profile (only on first load, before user edits)
  useEffect(() => {
    if (profile?.full_name && !preparedBy) {
      setPreparedBy(profile.full_name);
    }
  }, [profile?.full_name]);

  useEffect(() => {
    if (profile?.license_number && !contractorLicense) {
      setContractorLicense(profile.license_number);
    }
  }, [profile?.license_number]);

  // Hydrate section preferences from project settings whenever the project
  // changes. The DB stores a partial — keys absent here fall back to
  // DEFAULT_SECTIONS at packet-generation time.
  useEffect(() => {
    const stored = currentProject?.settings?.sectionPreferences as
      | Partial<PacketSections>
      | undefined;
    setSectionPrefs(stored ?? {});
  }, [currentProject?.id, currentProject?.settings?.sectionPreferences]);

  // Early return if no projectId
  if (!projectId) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-2 text-gray-500">
          <AlertCircle className="w-5 h-5" />
          <p>No project ID provided</p>
        </div>
      </div>
    );
  }

  const dataLoading = panelsLoading || circuitsLoading || feedersLoading || transformersLoading || groundingLoading;

  // C3 (advisory): Surface the AHJ-acceptable shape of these fields as soft
  // warnings — the contractor decides whether to override. Hard-gating placeholder
  // values like "TBD" forces fake data into draft packets used for pre-application
  // walk-ins, which is worse than the AHJ-rejection risk we'd be preventing.
  const licenseParse = flContractorLicenseSchema.safeParse(contractorLicense);
  const addressParse = projectAddressSchema.safeParse(currentProject?.address ?? '');
  const permitParse = permitNumberSchema.safeParse(permitNumber);
  const licenseAdvisory = !licenseParse.success ? licenseParse.error.issues[0]?.message : undefined;
  const addressAdvisory = !addressParse.success ? addressParse.error.issues[0]?.message : undefined;
  const permitAdvisory = !permitParse.success ? permitParse.error.issues[0]?.message : undefined;
  const hasAnyAdvisory = !!(licenseAdvisory || addressAdvisory || permitAdvisory);

  // Hard gates: these prevent runtime crashes (no panels = empty packet, no
  // license input at all = key submittal field literally missing). Format
  // shape is advisory only.
  const hasLicense = contractorLicense.trim().length > 0;
  const hasScope = scopeOfWork.trim().length > 0;
  const canGenerate =
    !!currentProject &&
    panels.length > 0 &&
    hasLicense &&
    hasScope &&
    !dataLoading;

  // Sprint 2A H1+H2+H3: section toggle helpers.
  // Resolves the effective on/off state by merging current preferences with
  // DEFAULT_SECTIONS (all-on). UI controls render from the resolved value.
  const effectiveSections = resolveSections(sectionPrefs);

  // Auto-disable predicate: returns a reason string when the toggle should
  // be greyed out because the underlying data isn't present (or, for
  // multiFamilyEV, the input checkbox above isn't enabled).
  const sectionDisabledReason = (key: keyof PacketSections): string | undefined => {
    switch (key) {
      case 'voltageDrop':
        return feeders.length === 0
          ? 'No feeders defined on this project'
          : undefined;
      case 'shortCircuit':
        return (shortCircuitCalculations?.length ?? 0) === 0
          ? 'No short circuit calculations recorded'
          : undefined;
      case 'arcFlash':
        // Arc flash data is not currently surfaced from a hook; the generator
        // only renders an Arc Flash page when `data.arcFlashData` is set,
        // which the UI doesn't populate yet.
        return 'Arc flash analysis is not yet integrated into the packet flow';
      case 'grounding':
        return !grounding ? 'No grounding system recorded' : undefined;
      case 'meterStack':
        return meterStacks.length === 0
          ? 'No meter stacks defined (multi-family only)'
          : undefined;
      case 'multiFamilyEV':
        return !includeMultiFamilyEV
          ? 'Enable Multi-Family EV inputs above to include this analysis'
          : undefined;
      case 'jurisdiction':
        return !currentProject?.jurisdiction_id
          ? 'No jurisdiction selected for this project'
          : undefined;
      default:
        return undefined;
    }
  };

  // Persist a single toggle change to projects.settings.sectionPreferences.
  // Optimistic update happens locally in setSectionPrefs; the underlying
  // updateProject hook handles its own optimistic update + rollback.
  const handleToggleSection = async (key: keyof PacketSections, next: boolean) => {
    const updated = { ...sectionPrefs, [key]: next };
    setSectionPrefs(updated);
    if (!currentProject) return;
    await updateProject({
      ...currentProject,
      settings: {
        ...currentProject.settings,
        sectionPreferences: updated,
      },
    });
  };

  const handleResetSections = async () => {
    setSectionPrefs({});
    if (!currentProject) return;
    await updateProject({
      ...currentProject,
      settings: {
        ...currentProject.settings,
        sectionPreferences: undefined,
      },
    });
  };

  // Group toggle configs for the rendered grid.
  const toggleGroups = SECTION_TOGGLE_CONFIG.reduce<Record<string, SectionToggleConfig[]>>(
    (acc, cfg) => {
      (acc[cfg.group] ||= []).push(cfg);
      return acc;
    },
    {},
  );

  // Sections that are toggled off AND have an offWarning to show.
  const activeOffWarnings = SECTION_TOGGLE_CONFIG.filter(
    (c) => c.offWarning && effectiveSections[c.key] === false,
  );

  const handleGenerate = async () => {
    if (!canGenerate || !currentProject) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Get jurisdiction data if project has jurisdiction_id
      const jurisdiction = currentProject.jurisdiction_id
        ? getJurisdictionById(currentProject.jurisdiction_id)
        : undefined;

      // NEC 220.84 multifamily context — passes through gate (returns undefined)
      // for any project that is not a multi-family dwelling with 3+ units, leaving
      // the PDF on the standard NEC 220 demand-factor cascade.
      const mdp = panels.find(p => p.is_main);
      const multiFamilyContext = buildMultiFamilyContext(
        mdp,
        panels,
        circuits,
        transformers,
        currentProject.settings,
      );

      const packetData: PermitPacketData = {
        projectId,
        projectName: currentProject.name,
        projectAddress: currentProject.address || '',
        projectType: currentProject.type,
        serviceVoltage: currentProject.serviceVoltage,
        servicePhase: currentProject.servicePhase,
        panels,
        circuits,
        feeders,
        transformers,
        preparedBy: preparedBy.trim() || undefined,
        permitNumber: permitNumber.trim() || undefined,
        hasGrounding: !!grounding,
        // Tier 1 additions
        contractorLicense: contractorLicense.trim() || undefined,
        scopeOfWork: scopeOfWork.trim() || undefined,
        serviceType: serviceType || undefined,
        meterLocation: meterLocation.trim() || undefined,
        serviceConductorRouting: serviceConductorRouting.trim() || undefined,
        // Tier 2: Additional calculations and plans
        shortCircuitCalculations: shortCircuitCalculations || [],
        groundingSystem: grounding || undefined,
        // Note: arcFlashData would come from a dedicated arc flash calculation
        // For now, we'll leave it undefined until user runs arc flash calculator
        arcFlashData: undefined,
        // Multi-Family: Meter Stack Schedule
        meterStacks: meterStacks.length > 0 ? meterStacks : undefined,
        meters: meters.length > 0 ? meters : undefined,
        // Tier 3: Jurisdiction requirements
        jurisdictionId: currentProject.jurisdiction_id,
        jurisdiction: jurisdiction,
        // NEC 220.84 multifamily Optional Method context (undefined for non-MF projects)
        multiFamilyContext,
        // Sprint 2A H1+H2+H3: per-section toggles. Empty object = use defaults.
        sections: sectionPrefs,
      };

      // Add Multi-Family EV Analysis if enabled
      if (includeMultiFamilyEV && mfEvDwellingUnits > 0) {
        const mfEvInput: MultiFamilyEVInput = {
          dwellingUnits: mfEvDwellingUnits,
          evChargersPerUnit: mfEvChargersPerUnit,
          chargerLevel: mfEvChargerLevel,
          chargerAmps: mfEvChargerLevel === 'level2' ? 40 : 12,
          voltage: currentProject.servicePhase === 3 ? 208 : 240,
          phase: currentProject.servicePhase === 3 ? 3 : 1,
          squareFeetPerUnit: 1000, // Default assumption
          includeCommonAreas: true,
          commonAreaSqFt: Math.round(mfEvDwellingUnits * 50), // Estimate common area
        };
        const mfEvResult = calculateMultiFamilyEV(mfEvInput);
        packetData.multiFamilyEVAnalysis = {
          result: mfEvResult,
          buildingName: mfEvBuildingName.trim() || currentProject.name,
        };
      }

      if (packetType === 'full') {
        await generatePermitPacket(packetData);
      } else {
        await generateLightweightPermitPacket(packetData);
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error generating permit packet:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate permit packet');
    } finally {
      setLoading(false);
    }
  };

  if (!currentProject) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-2 text-gray-500">
          <AlertCircle className="w-5 h-5" />
          <p>Project not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-light text-gray-900 flex items-center gap-2">
          <FileText className="w-6 h-6 text-[#2d3b2d]" />
          Permit Packet Generator
        </h2>
        <p className="text-gray-500 mt-1">
          Generate comprehensive permit application package with all required documents
        </p>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">What's Included:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-800">
              <li>Cover page with contractor license & scope of work</li>
              <li>Service entrance details</li>
              <li>Equipment schedule (panels, transformers, feeders)</li>
              <li>Riser diagram (system hierarchy)</li>
              <li>Load calculation summary</li>
              <li>NEC compliance summary</li>
              <li>Equipment specifications (Tier 2)</li>
              <li>Voltage drop report (if feeders exist)</li>
              <li>Short circuit analysis (if calculations exist)</li>
              <li>Arc flash analysis (if data available)</li>
              <li>Grounding plan (NEC Article 250)</li>
              <li>Multi-Family EV analysis (NEC 220.84 + 220.57 + 625.42) if enabled</li>
              <li>Jurisdiction requirements checklist (if jurisdiction selected)</li>
              {packetType === 'full' && <li>Complete panel schedules for all panels</li>}
            </ul>
          </div>
        </div>
      </div>

      {/* Project Summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-bold text-gray-900 mb-4">Project Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Project</p>
            <p className="font-medium">{currentProject.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Service</p>
            <p className="font-medium">
              {currentProject.serviceVoltage}V {currentProject.servicePhase === 3 ? '3φ' : '1φ'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Panels</p>
            <p className="font-medium">{panels.length}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Circuits</p>
            <p className="font-medium">{circuits.length}</p>
          </div>
        </div>
      </div>

      {/* Sprint 2A H1+H2+H3: Section Toggle Panel */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-[#2d3b2d]" />
              Configure Sections
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Choose which sections to include in this packet. Cover sheet is
              always included. Sheet IDs renumber automatically when you toggle
              a section off.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetSections}
            className="text-sm text-[#2d3b2d] hover:text-[#1f291f] underline whitespace-nowrap"
          >
            Reset to defaults
          </button>
        </div>

        {/* Cover sheet is always-on; show as a non-toggleable indicator */}
        <div className="bg-gray-50 border border-gray-200 rounded-md p-3 flex items-center gap-3">
          <CheckCircle className="w-4 h-4 text-[#2d3b2d] flex-shrink-0" />
          <div className="text-sm">
            <span className="font-medium text-gray-900">Cover Sheet</span>
            <span className="text-gray-500 ml-2">
              Always included (sheet 001) — required for AHJ identification
            </span>
          </div>
        </div>

        {/* Off-warning banners (shown above the grid so they're visible) */}
        {activeOffWarnings.length > 0 && (
          <div className="space-y-2">
            {activeOffWarnings.map((c) => (
              <div
                key={c.key}
                className="bg-amber-50 border border-amber-300 rounded-md p-3 flex items-start gap-3"
              >
                <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900">
                  <span className="font-medium">{c.label} is off — </span>
                  {c.offWarning}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Grouped checkbox grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(toggleGroups).map(([groupName, items]) => (
            <div key={groupName} className="border border-gray-200 rounded-md p-3 space-y-2">
              <p className="text-xs uppercase tracking-wider font-medium text-gray-500 mb-2">
                {groupName}
              </p>
              {items.map((cfg) => {
                const disabledReason = sectionDisabledReason(cfg.key);
                const isChecked = effectiveSections[cfg.key];
                const hasOffWarning = !!cfg.offWarning && isChecked === false;
                return (
                  <label
                    key={cfg.key}
                    className={`flex items-start gap-2 ${
                      disabledReason ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                    title={disabledReason}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={!!disabledReason}
                      onChange={(e) => handleToggleSection(cfg.key, e.target.checked)}
                      className="mt-1 text-[#2d3b2d] focus:ring-[#2d3b2d]/20 rounded"
                    />
                    <div className="text-sm flex-1">
                      <span
                        className={`font-medium ${
                          hasOffWarning ? 'text-amber-900' : 'text-gray-900'
                        }`}
                      >
                        {cfg.label}
                      </span>
                      <p className="text-xs text-gray-500">
                        {disabledReason ?? cfg.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Jurisdiction Requirements Wizard */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-bold text-gray-900 mb-4">Jurisdiction Requirements</h3>
        <p className="text-sm text-gray-600 mb-6">
          Search for your jurisdiction to see what documents and calculations are required for your permit submittal.
          The requirements will be automatically included in your permit packet.
        </p>
        <JurisdictionSearchWizard projectId={projectId} />
      </div>

      {/* Configuration */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
        <h3 className="font-bold text-gray-900">Packet Configuration</h3>

        {/* Packet Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Packet Type
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="packetType"
                value="full"
                checked={packetType === 'full'}
                onChange={() => setPacketType('full')}
                className="text-[#2d3b2d] focus:ring-[#2d3b2d]/20"
              />
              <div>
                <span className="font-medium">Full Packet</span>
                <p className="text-xs text-gray-500">Includes all panel schedules</p>
              </div>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="packetType"
                value="lightweight"
                checked={packetType === 'lightweight'}
                onChange={() => setPacketType('lightweight')}
                className="text-[#2d3b2d] focus:ring-[#2d3b2d]/20"
              />
              <div>
                <span className="font-medium">Lightweight</span>
                <p className="text-xs text-gray-500">Summary only (no panel schedules)</p>
              </div>
            </label>
          </div>
        </div>

        {/* Contractor Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="preparedBy" className="block text-sm font-medium text-gray-700 mb-2">
              Prepared By (Optional)
            </label>
            <input
              id="preparedBy"
              type="text"
              value={preparedBy}
              onChange={(e) => setPreparedBy(e.target.value)}
              placeholder="Contractor/Engineer name"
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:border-[#2d3b2d] focus:ring-2 focus:ring-[#2d3b2d]/20/20 outline-none"
            />
          </div>
          <div>
            <label htmlFor="contractorLicense" className="block text-sm font-medium text-gray-700 mb-2">
              Contractor License <span className="text-red-500">*</span>
            </label>
            <input
              id="contractorLicense"
              type="text"
              value={contractorLicense}
              onChange={(e) => setContractorLicense(e.target.value)}
              placeholder="e.g., EC1234567"
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:border-[#2d3b2d] focus:ring-2 focus:ring-[#2d3b2d]/20/20 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">FL DBPR format: EC####### or ER####### (heads-up only — packet still generates)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="permitNumber" className="block text-sm font-medium text-gray-700 mb-2">
              Permit Number (Optional)
            </label>
            <input
              id="permitNumber"
              type="text"
              value={permitNumber}
              onChange={(e) => setPermitNumber(e.target.value)}
              placeholder="e.g., PER-2024-001234"
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:border-[#2d3b2d] focus:ring-2 focus:ring-[#2d3b2d]/20/20 outline-none"
            />
          </div>
        </div>

        {/* Scope of Work */}
        <div>
          <label htmlFor="scopeOfWork" className="block text-sm font-medium text-gray-700 mb-2">
            Scope of Work <span className="text-red-500">*</span>
          </label>
          <textarea
            id="scopeOfWork"
            value={scopeOfWork}
            onChange={(e) => setScopeOfWork(e.target.value)}
            placeholder="e.g., Replace existing 100A overhead service with 200A underground service, relocate meter to exterior wall, install new 200A main panel"
            rows={3}
            className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:border-[#2d3b2d] focus:ring-2 focus:ring-[#2d3b2d]/20/20 outline-none"
          />
          <p className="text-xs text-gray-500 mt-1">Brief description of work to be performed</p>
        </div>

        {/* Service Entrance Details */}
        <div className="border-t border-gray-200 pt-4">
          <h4 className="font-medium text-gray-900 mb-4">Service Entrance Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="serviceType" className="block text-sm font-medium text-gray-700 mb-2">
                Service Type
              </label>
              <select
                id="serviceType"
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as 'overhead' | 'underground')}
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:border-[#2d3b2d] focus:ring-2 focus:ring-[#2d3b2d]/20/20 outline-none"
              >
                <option value="overhead">Overhead</option>
                <option value="underground">Underground</option>
              </select>
            </div>
            <div>
              <label htmlFor="meterLocation" className="block text-sm font-medium text-gray-700 mb-2">
                Meter Location
              </label>
              <input
                id="meterLocation"
                type="text"
                value={meterLocation}
                onChange={(e) => setMeterLocation(e.target.value)}
                placeholder="e.g., Exterior wall, north side"
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:border-[#2d3b2d] focus:ring-2 focus:ring-[#2d3b2d]/20/20 outline-none"
              />
            </div>
            <div>
              <label htmlFor="serviceConductorRouting" className="block text-sm font-medium text-gray-700 mb-2">
                Conductor Routing
              </label>
              <input
                id="serviceConductorRouting"
                type="text"
                value={serviceConductorRouting}
                onChange={(e) => setServiceConductorRouting(e.target.value)}
                placeholder="e.g., PVC conduit, buried 24in"
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:border-[#2d3b2d] focus:ring-2 focus:ring-[#2d3b2d]/20/20 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Family EV Analysis Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-[#2d3b2d]" />
            <div>
              <h3 className="font-bold text-gray-900">Multi-Family EV Analysis</h3>
              <p className="text-sm text-gray-500">NEC 220.84 + 220.57 + 625.42 compliance</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={includeMultiFamilyEV}
              onChange={(e) => setIncludeMultiFamilyEV(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#2d3b2d]/20/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2d3b2d]"></div>
            <span className="ml-2 text-sm font-medium text-gray-700">Include</span>
          </label>
        </div>

        {includeMultiFamilyEV && (
          <div className="pt-4 border-t border-gray-200 space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> For detailed analysis, use the Multi-Family EV Calculator in the Tools Hub.
                This section provides quick integration for permit packets with basic parameters.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="mfEvBuildingName" className="block text-sm font-medium text-gray-700 mb-2">
                  Building Name (Optional)
                </label>
                <input
                  id="mfEvBuildingName"
                  type="text"
                  value={mfEvBuildingName}
                  onChange={(e) => setMfEvBuildingName(e.target.value)}
                  placeholder="e.g., Parkside Apartments"
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:border-[#2d3b2d] focus:ring-2 focus:ring-[#2d3b2d]/20/20 outline-none"
                />
              </div>
              <div>
                <label htmlFor="mfEvDwellingUnits" className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Dwelling Units
                </label>
                <input
                  id="mfEvDwellingUnits"
                  type="number"
                  min="3"
                  max="500"
                  value={mfEvDwellingUnits}
                  onChange={(e) => setMfEvDwellingUnits(parseInt(e.target.value) || 20)}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:border-[#2d3b2d] focus:ring-2 focus:ring-[#2d3b2d]/20/20 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">Min 3 units for NEC 220.84</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="mfEvChargersPerUnit" className="block text-sm font-medium text-gray-700 mb-2">
                  EV Chargers per Unit
                </label>
                <select
                  id="mfEvChargersPerUnit"
                  value={mfEvChargersPerUnit}
                  onChange={(e) => setMfEvChargersPerUnit(parseInt(e.target.value))}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:border-[#2d3b2d] focus:ring-2 focus:ring-[#2d3b2d]/20/20 outline-none"
                >
                  <option value="1">1 charger per unit</option>
                  <option value="2">2 chargers per unit</option>
                </select>
              </div>
              <div>
                <label htmlFor="mfEvChargerLevel" className="block text-sm font-medium text-gray-700 mb-2">
                  Charger Level
                </label>
                <select
                  id="mfEvChargerLevel"
                  value={mfEvChargerLevel}
                  onChange={(e) => setMfEvChargerLevel(e.target.value as 'level1' | 'level2')}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:border-[#2d3b2d] focus:ring-2 focus:ring-[#2d3b2d]/20/20 outline-none"
                >
                  <option value="level2">Level 2 (40A, 240V) - Recommended</option>
                  <option value="level1">Level 1 (12A, 120V)</option>
                </select>
              </div>
            </div>

            {/* Preview of calculation impact */}
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm font-medium text-gray-700 mb-2">Estimated Impact Preview:</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Total Chargers</p>
                  <p className="font-semibold">{mfEvDwellingUnits * mfEvChargersPerUnit}</p>
                </div>
                <div>
                  <p className="text-gray-500">Connected Load</p>
                  <p className="font-semibold">
                    {((mfEvDwellingUnits * mfEvChargersPerUnit * (mfEvChargerLevel === 'level2' ? 40 : 12) * (mfEvChargerLevel === 'level2' ? 240 : 120)) / 1000).toFixed(1)} kW
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Demand Factor</p>
                  <p className="font-semibold">
                    {mfEvDwellingUnits <= 10 ? '100%' : mfEvDwellingUnits <= 25 ? '70%' : mfEvDwellingUnits <= 50 ? '50%' : '35%'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">NEC Reference</p>
                  <p className="font-semibold">220.57</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-red-900">Error generating permit packet</p>
                <button
                  type="button"
                  className="text-xs text-red-700 underline hover:text-red-900"
                  onClick={() => {
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(error).catch(() => {});
                    }
                  }}
                >
                  Copy
                </button>
              </div>
              <pre className="text-xs text-red-800 bg-red-100/50 rounded p-3 overflow-auto max-h-80 whitespace-pre-wrap font-mono">
                {error}
              </pre>
              <p className="text-xs text-red-600 mt-2">
                Please open your browser devtools console for additional logs (prefixed
                with <code className="font-mono">[permit-packet]</code>).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-green-900">Success</p>
            <p className="text-sm text-green-700">Permit packet generated and downloaded</p>
          </div>
        </div>
      )}

      {/* Generate Button */}
      <div className="flex justify-end">
        <button
          onClick={handleGenerate}
          disabled={!canGenerate || loading || dataLoading}
          className="bg-gray-900 hover:bg-black text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating PDF...
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              Generate Permit Packet
            </>
          )}
        </button>
      </div>

      {/* Hard-gate warnings — block PDF generation */}
      {!canGenerate && !dataLoading && (
        <div className="bg-[#fff8e6] border border-[#c9a227]/40 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-[#c9a227] flex-shrink-0" />
            <div className="text-sm text-[#5a4500]">
              <p className="font-medium mb-1">Cannot generate permit packet</p>
              <ul className="list-disc list-inside space-y-1">
                {panels.length === 0 && <li>At least one panel is required</li>}
                {!hasLicense && <li>Contractor License is required</li>}
                {!hasScope && <li>Scope of Work is required</li>}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Advisory warnings — heads-up only, packet still generates */}
      {canGenerate && hasAnyAdvisory && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Heads up — these may cause AHJ intake friction</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                {addressAdvisory && (
                  <li>Project address: {addressAdvisory} (edit in Project Setup)</li>
                )}
                {licenseAdvisory && <li>Contractor License: {licenseAdvisory}</li>}
                {permitAdvisory && <li>Permit Number: {permitAdvisory}</li>}
              </ul>
              <p className="text-xs text-blue-700 mt-2">
                Packet will still generate — these are informational only. Florida AHJs typically reject submittals with placeholder values like "TBD" or "test" on intake.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

