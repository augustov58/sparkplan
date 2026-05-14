/**
 * Dwelling Load Calculator Component
 * NEC 220.82 (Single-Family) and 220.84 (Multi-Family) Calculations
 * 
 * This component replaces LoadCalculator for residential projects
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Home,
  Zap,
  Flame,
  Droplets,
  Wind,
  Car,
  Waves,
  Plus,
  Trash2,
  Calculator,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertTriangle,
  CheckCircle,
  Download,
  RefreshCw,
  Users,
  Cable,
  Building2,
  Info,
  Loader
} from 'lucide-react';
import { 
  Project, 
  ProjectType, 
  DwellingType, 
  ResidentialAppliances,
  DwellingUnitTemplate,
  PanelCircuit
} from '../types';
import {
  calculateSingleFamilyLoad,
  calculateMultiFamilyLoad,
  generateResidentialPanelSchedule,
  ResidentialLoadResult,
  LoadBreakdown,
  GeneratedCircuit
} from '../services/calculations/residentialLoad';
import { LOAD_TEMPLATES } from '../services/calculations/serviceUpgrade';
import type { LoadTemplate } from '../types';
import { usePanels } from '../hooks/usePanels';
import { useCircuits } from '../hooks/useCircuits';
import {
  generateBasicMultiFamilyProject,
  type BasicGenerationOptions,
  type UnitApplianceConfig
} from '../services/autogeneration/multiFamilyProjectGenerator';
import {
  populateProject,
  projectHasPanels,
  clearProjectElectricalData,
  type PopulationProgress
} from '../services/autogeneration/projectPopulationOrchestrator';
import { NumberInput } from './common/NumberInput';

interface DwellingLoadCalculatorProps {
  project: Project;
  updateProject: (p: Project) => void;
}

// Default appliances for a new project
const DEFAULT_APPLIANCES: ResidentialAppliances = {
  range: { enabled: false, kw: 12, type: 'electric' },
  dryer: { enabled: false, kw: 5.5, type: 'electric' },
  waterHeater: { enabled: false, kw: 4.5, type: 'electric' },
  hvac: { enabled: false, type: 'ac_only', coolingKw: 5, heatingKw: 0 },
  dishwasher: { enabled: false, kw: 1.5 },
  disposal: { enabled: false, kw: 0.5 },
  microwave: { enabled: false, kw: 1.5 },
  evCharger: { enabled: false, kw: 7.7, level: 2 },
  poolPump: { enabled: false, hp: 1.5 },
  poolHeater: { enabled: false, kw: 11 },
  hotTub: { enabled: false, kw: 6 },
  wellPump: { enabled: false, hp: 1 },
  otherAppliances: []
};

// Default unit template for multi-family
const DEFAULT_UNIT_TEMPLATE: DwellingUnitTemplate = {
  id: '',
  name: 'Standard Unit',
  squareFootage: 1000,
  unitCount: 1,
  appliances: { ...DEFAULT_APPLIANCES }
};

export const DwellingLoadCalculator: React.FC<DwellingLoadCalculatorProps> = ({ 
  project, 
  updateProject 
}) => {
  // Hooks
  const { panels, createPanel, updatePanel } = usePanels(project.id);
  const mainPanel = panels.find(p => p.is_main);
  const { circuits, createCircuit, deleteCircuitsByPanel } = useCircuits(project.id);

  // Get existing circuits for the main panel
  const mainPanelCircuits = mainPanel ? circuits.filter(c => c.panel_id === mainPanel.id) : [];

  // Local state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['appliances', 'results']));
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCircuits, setGeneratedCircuits] = useState<GeneratedCircuit[]>([]);
  const [showGenerated, setShowGenerated] = useState(false);
  const [showMFRedirect, setShowMFRedirect] = useState(false);
  const [isGeneratingMF, setIsGeneratingMF] = useState(false);
  const [mfGenerateError, setMfGenerateError] = useState<string | null>(null);
  const [mfGenerateSuccess, setMfGenerateSuccess] = useState(false);
  const [mfProgress, setMfProgress] = useState<PopulationProgress | null>(null);
  const [existingPanelsWarning, setExistingPanelsWarning] = useState(false);

  // Get residential settings
  const residentialSettings = project.settings.residential;
  const dwellingType = residentialSettings?.dwellingType || DwellingType.SINGLE_FAMILY;
  const isSingleFamily = dwellingType === DwellingType.SINGLE_FAMILY;

  // Initialize appliances from project or use defaults
  const [appliances, setAppliances] = useState<ResidentialAppliances>(
    residentialSettings?.appliances || DEFAULT_APPLIANCES
  );

  // Proposed New Loads — additions on existing-construction projects. Each
  // entry is sized, demand-counted, and (on Generate Schedule) inserted as
  // a circuit with is_proposed=true so the permit-packet panel schedule
  // marks it with "* = Proposed new circuit".
  type ProposedLoad = {
    id: string;
    description: string;
    kw: number;
    voltage: 120 | 240;
    continuous: boolean;
    category?: 'EV' | 'HVAC' | 'Appliance' | 'Other';
    necReference?: string;
  };
  const [proposedLoads, setProposedLoads] = useState<ProposedLoad[]>(
    (residentialSettings as any)?.proposedLoads || []
  );
  const [selectedTemplate, setSelectedTemplate] = useState('');

  // Multi-family state
  const [unitTemplates, setUnitTemplates] = useState<DwellingUnitTemplate[]>(
    residentialSettings?.unitTemplates || [{ ...DEFAULT_UNIT_TEMPLATE, id: crypto.randomUUID() }]
  );
  const [housePanelLoad, setHousePanelLoad] = useState(
    () => (project.settings?.residential as any)?.multiFamilyLoadResult?.commonAreaLoadVA || 0
  );

  // Sync appliances + proposedLoads to project when they change (with value
  // comparison to avoid infinite loop). Debounced so rapid edits don't
  // thrash the project state.
  useEffect(() => {
    const stored = project.settings?.residential;
    const storedAppliances = JSON.stringify(stored?.appliances);
    const currentAppliances = JSON.stringify(appliances);
    const storedTemplates = JSON.stringify(stored?.unitTemplates);
    const currentTemplates = JSON.stringify(!isSingleFamily ? unitTemplates : undefined);
    const storedProposed = JSON.stringify((stored as any)?.proposedLoads ?? []);
    const currentProposed = JSON.stringify(proposedLoads);
    if (
      storedAppliances === currentAppliances &&
      storedTemplates === currentTemplates &&
      storedProposed === currentProposed
    ) return;

    const timer = setTimeout(() => {
      updateProject({
        ...project,
        settings: {
          ...project.settings,
          residential: {
            ...project.settings.residential,
            appliances,
            unitTemplates: !isSingleFamily ? unitTemplates : undefined,
            proposedLoads,
          } as any
        }
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [appliances, unitTemplates, proposedLoads]);

  // Merge proposed loads into the appliance set as additional otherAppliances
  // for demand-calc purposes. The calc engine treats them identically to
  // user-added "other fixed appliances", which already honor voltage and
  // continuous (×1.25). They retain their proposed identity in component
  // state so handleApplyToPanelSchedule can flag them is_proposed=true at
  // insert time without interfering with the demand math.
  const appliancesForCalc = useMemo<ResidentialAppliances>(() => {
    if (proposedLoads.length === 0) return appliances;
    const proposedAsOther = proposedLoads.map(p => ({
      description: p.description,
      kw: p.kw,
      voltage: p.voltage,
      continuous: p.continuous,
    }));
    return {
      ...appliances,
      otherAppliances: [...(appliances.otherAppliances ?? []), ...proposedAsOther],
    };
  }, [appliances, proposedLoads]);

  // Calculate load
  const loadResult: ResidentialLoadResult | null = useMemo(() => {
    try {
      if (isSingleFamily) {
        // Project Status (General Information) drives 220.82 vs 220.83.
        // 'new-service' → 220.82 (new construction); anything else
        // ('existing' or 'service-upgrade') → 220.83 (existing dwelling).
        const existingDwelling = project.settings?.service_modification_type
          ? project.settings.service_modification_type !== 'new-service'
          : true; // default to existing — safer assumption for retrofit work
        // Calculation Method (this page) only applies to 220.82 (new). 220.83
        // is always a bucket method by NEC definition.
        const useTrueOptionalMethod = project.settings?.dwelling_calc_mode === 'true-optional';
        return calculateSingleFamilyLoad({
          squareFootage: residentialSettings?.squareFootage || 2000,
          smallApplianceCircuits: residentialSettings?.smallApplianceCircuits || 2,
          laundryCircuit: residentialSettings?.laundryCircuit ?? true,
          appliances: appliancesForCalc,
          existingDwelling,
          useTrueOptionalMethod
        });
      } else {
        return calculateMultiFamilyLoad({
          unitTemplates: unitTemplates.map(t => ({ ...t, appliances: appliancesForCalc })),
          housePanelLoad
        });
      }
    } catch (error) {
      console.error('Load calculation error:', error);
      return null;
    }
  }, [isSingleFamily, residentialSettings, appliancesForCalc, unitTemplates, housePanelLoad, project.settings?.service_modification_type, project.settings?.dwelling_calc_mode]);

  // Persist multi-family load result to project settings so MF EV Calculator can read it
  // Uses value comparison to avoid infinite re-render loop (updateProject changes project → loadResult recomputes → useEffect fires)
  useEffect(() => {
    if (isSingleFamily || !loadResult) return;
    const totalUnits = unitTemplates.reduce((sum, t) => sum + t.unitCount, 0);
    const avgSqFt = totalUnits > 0
      ? Math.round(unitTemplates.reduce((sum, t) => sum + t.squareFootage * t.unitCount, 0) / totalUnits)
      : 1000;
    const hasElectricCooking = appliances.range?.enabled === true && appliances.range.type === 'electric';
    const hasElectricHeat = appliances.hvac?.enabled === true &&
      (appliances.hvac.type === 'heat_pump' || appliances.hvac.type === 'electric_heat');

    // Compare key values to skip update if nothing changed
    const stored = project.settings?.residential?.multiFamilyLoadResult;
    if (stored &&
        stored.totalDemandVA === loadResult.totalDemandVA &&
        stored.serviceAmps === loadResult.serviceAmps &&
        stored.dwellingUnits === totalUnits &&
        stored.commonAreaLoadVA === housePanelLoad) {
      return;
    }

    const timer = setTimeout(() => {
      updateProject({
        ...project,
        settings: {
          ...project.settings,
          residential: {
            ...project.settings.residential,
            multiFamilyLoadResult: {
              totalDemandVA: loadResult.totalDemandVA,
              totalConnectedVA: loadResult.totalConnectedVA,
              demandFactor: loadResult.demandFactor,
              serviceAmps: loadResult.serviceAmps,
              recommendedServiceSize: loadResult.recommendedServiceSize,
              breakdown: loadResult.breakdown,
              dwellingUnits: totalUnits,
              avgUnitSqFt: avgSqFt,
              commonAreaLoadVA: housePanelLoad,
              hasElectricCooking,
              hasElectricHeat,
            },
          } as any,
        },
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [loadResult, isSingleFamily]);

  // Toggle section
  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  // Update an appliance
  const updateAppliance = <K extends keyof ResidentialAppliances>(
    key: K, 
    value: ResidentialAppliances[K]
  ) => {
    setAppliances(prev => ({ ...prev, [key]: value }));
  };

  // Toggle appliance enabled
  const toggleAppliance = (key: keyof ResidentialAppliances) => {
    setAppliances(prev => {
      const current = prev[key] as any;
      if (current && typeof current === 'object' && 'enabled' in current) {
        return { ...prev, [key]: { ...current, enabled: !current.enabled } };
      }
      return prev;
    });
  };

  // Add custom appliance
  const addOtherAppliance = () => {
    setAppliances(prev => ({
      ...prev,
      otherAppliances: [
        ...(prev.otherAppliances || []),
        { description: 'New Appliance', kw: 1, voltage: 240, continuous: false }
      ]
    }));
  };

  // Remove custom appliance
  const removeOtherAppliance = (index: number) => {
    setAppliances(prev => ({
      ...prev,
      otherAppliances: prev.otherAppliances?.filter((_, i) => i !== index)
    }));
  };

  // Update custom appliance — field now includes voltage + continuous so
  // EEs can mark a 240V continuous load (water heater, pool pump) properly.
  const updateOtherAppliance = (index: number, field: 'description' | 'kw' | 'voltage' | 'continuous', value: any) => {
    setAppliances(prev => ({
      ...prev,
      otherAppliances: prev.otherAppliances?.map((a, i) =>
        i === index ? { ...a, [field]: value } : a
      )
    }));
  };

  // === Proposed New Loads helpers ===
  const addProposedFromTemplate = (templateName: string) => {
    const t = LOAD_TEMPLATES.find(x => x.name === templateName);
    if (!t) return;
    setProposedLoads(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        description: t.name,
        kw: t.kw,
        voltage: t.voltage ?? 240,
        continuous: t.continuous,
        category: t.category === 'Solar' ? 'Other' : (t.category as ProposedLoad['category']),
        necReference: t.necReference,
      }
    ]);
    setSelectedTemplate('');
  };

  const addCustomProposed = () => {
    setProposedLoads(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        description: 'New Load',
        kw: 1,
        voltage: 240,
        continuous: false,
        category: 'Other',
      }
    ]);
  };

  const removeProposed = (id: string) => {
    setProposedLoads(prev => prev.filter(p => p.id !== id));
  };

  const updateProposed = (id: string, field: keyof ProposedLoad, value: any) => {
    setProposedLoads(prev =>
      prev.map(p => p.id === id ? { ...p, [field]: value } : p)
    );
  };

  // Add unit template (multi-family)
  const addUnitTemplate = () => {
    setUnitTemplates(prev => [
      ...prev,
      { ...DEFAULT_UNIT_TEMPLATE, id: crypto.randomUUID(), name: `Unit Type ${prev.length + 1}` }
    ]);
  };

  // Update unit template
  const updateUnitTemplate = (id: string, updates: Partial<DwellingUnitTemplate>) => {
    setUnitTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  // Remove unit template
  const removeUnitTemplate = (id: string) => {
    if (unitTemplates.length > 1) {
      setUnitTemplates(prev => prev.filter(t => t.id !== id));
    }
  };

  // Generate panel schedule
  const handleGeneratePanelSchedule = async () => {
    if (!loadResult) {
      alert('Please configure appliances first to calculate the load.');
      return;
    }

    // Check for main panel
    if (!mainPanel) {
      alert(
        '❌ No Main Panel Found\n\n' +
        'You need to create a Main Distribution Panel (MDP) first.\n\n' +
        'Go to "Circuit Design" tab and create an MDP before generating a panel schedule.'
      );
      return;
    }

    // Multi-family: redirect to MF EV Calculator
    if (!isSingleFamily) {
      setShowMFRedirect(true);
      return;
    }
    
    setIsGenerating(true);
    try {
      // Generate circuits for the existing appliance set. Proposed loads are
      // synthesized separately below so each one can be tagged isProposed.
      const generated = generateResidentialPanelSchedule({
        squareFootage: residentialSettings?.squareFootage || 2000,
        smallApplianceCircuits: residentialSettings?.smallApplianceCircuits || 2,
        laundryCircuit: residentialSettings?.laundryCircuit ?? true,
        appliances
      });

      // Append a circuit row per proposed load — same sizing logic as the
      // otherAppliances generator (voltage → poles; continuous → ×1.25
      // breaker per NEC 210.20(A)). Each entry carries isProposed=true so
      // the DB column gets set at insert time.
      const proposedCircuits: GeneratedCircuit[] = proposedLoads.map(p => {
        const pole: 1 | 2 = p.voltage === 240 ? 2 : 1;
        const baseAmps = (p.kw * 1000) / p.voltage;
        const sizedAmps = p.continuous ? baseAmps * 1.25 : baseAmps;
        const breakerAmps = Math.max(15, Math.ceil(sizedAmps / 5) * 5);
        const loadType: GeneratedCircuit['loadType'] =
          p.category === 'HVAC' ? 'C' :
          p.category === 'EV' ? 'O' : 'O';
        return {
          description: p.description,
          breakerAmps,
          pole,
          loadWatts: p.kw * 1000,
          loadType,
          necReference: p.necReference ?? 'NEC 220.83',
          isProposed: true,
        };
      });

      setGeneratedCircuits([...generated, ...proposedCircuits]);
      setShowGenerated(true);
    } finally {
      setIsGenerating(false);
    }
  };

  // Apply generated circuits to panel (clears existing circuits first)
  const handleApplyToPanelSchedule = async () => {
    if (!mainPanel) {
      alert('No main panel found. Please create an MDP first.');
      return;
    }
    if (generatedCircuits.length === 0) {
      alert('No circuits to apply. Please generate the panel schedule first.');
      return;
    }

    // Confirm if circuits already exist
    if (mainPanelCircuits.length > 0) {
      const confirmed = confirm(
        `⚠️ The panel schedule already has ${mainPanelCircuits.length} circuit(s).\n\n` +
        `Applying this generated schedule will DELETE all existing circuits and replace them with ${generatedCircuits.length} new circuits.\n\n` +
        `Do you want to proceed?`
      );
      if (!confirmed) return;
    }

    try {
      // ISSUE FIX: Clear existing circuits before creating new ones
      if (mainPanelCircuits.length > 0) {
        await deleteCircuitsByPanel(mainPanel.id);
      }

      // Conductor sizing per NEC Table 310.16 (60C copper).
      const getConductorSize = (amps: number): string => {
        if (amps <= 15) return '14 AWG';
        if (amps <= 20) return '12 AWG';
        if (amps <= 30) return '10 AWG';
        if (amps <= 40) return '8 AWG';
        if (amps <= 50) return '6 AWG';
        if (amps <= 60) return '6 AWG';
        if (amps <= 100) return '3 AWG';
        return '1 AWG';
      };

      // Slot allocation — respects pole continuations so a 2P breaker at
      // slot N occupies N and N+2, and the next breaker is placed at the
      // smallest slot S where every {S, S+2, ..., S+2(p-1)} is still free.
      // Previously the generator assigned circuit_number = i+1 naively,
      // which collided on continuation slots and produced cascading ↑2P
      // markers (e.g. 2P range at slot 10 + 2P water heater at slot 12
      // both fighting for slot 12).
      const panelSpaces = (mainPanel as any).num_spaces ?? (mainPanel.is_main ? 30 : 42);
      const occupied = new Set<number>();
      const assignedSlots: number[] = [];
      const skipped: number[] = [];
      for (let i = 0; i < generatedCircuits.length; i++) {
        const c = generatedCircuits[i];
        if (!c) { assignedSlots.push(-1); continue; }
        let placed = -1;
        for (let s = 1; s <= panelSpaces; s++) {
          const needed: number[] = [];
          for (let p = 0; p < c.pole; p++) needed.push(s + p * 2);
          if (needed.every(n => n <= panelSpaces && !occupied.has(n))) {
            needed.forEach(n => occupied.add(n));
            placed = s;
            break;
          }
        }
        assignedSlots.push(placed);
        if (placed === -1) skipped.push(i);
      }

      // Create circuits at their allocated slots
      for (let i = 0; i < generatedCircuits.length; i++) {
        const circuit = generatedCircuits[i];
        if (!circuit) continue;
        const slot = assignedSlots[i];
        if (slot === -1) continue; // Skipped — panel out of space; warn after loop

        await createCircuit({
          project_id: project.id,
          panel_id: mainPanel.id,
          circuit_number: slot,
          description: circuit.description,
          breaker_amps: circuit.breakerAmps,
          pole: circuit.pole,
          load_watts: circuit.loadWatts,
          conductor_size: getConductorSize(circuit.breakerAmps),
          load_type: circuit.loadType,
          is_proposed: !!circuit.isProposed,
        });
      }

      if (skipped.length > 0) {
        alert(
          `Panel only has ${panelSpaces} slots — ${skipped.length} circuit(s) ` +
          `could not be placed:\n` +
          skipped.map(i => `  • ${generatedCircuits[i]?.description}`).join('\n') +
          `\n\nIncrease panel size or split into a sub-panel.`
        );
      }
      
      // Update recommended service in project AND sync the main panel's
      // main_breaker_amps. On EXISTING-CONSTRUCTION projects we respect the
      // user-stated Existing Service Size whenever it holds (NEC 220.83
      // demand <= existing); only override when the existing service is
      // actually insufficient. Without this gate, the calc's
      // "recommendedServiceSize" (which is the NEC new-install size, e.g.
      // 113A demand → 150A min for continuous safety) would silently
      // overwrite the user's stated 125A existing service, destroying
      // their input on every Regenerate.
      if (loadResult) {
        const isExisting = project.settings?.service_modification_type
          && project.settings.service_modification_type !== 'new-service';
        const existingAmps = project.settings?.residential?.existingServiceAmps
          ?? mainPanel?.main_breaker_amps;
        const existingHolds = isExisting
          && typeof existingAmps === 'number'
          && loadResult.serviceAmps <= existingAmps;

        // Recommended-service stored in settings should reflect the final
        // decision (existing wins when it holds), not the abstract
        // new-install number.
        const finalRecommendation = existingHolds
          ? existingAmps as number
          : loadResult.recommendedServiceSize;

        updateProject({
          ...project,
          settings: {
            ...project.settings,
            residential: {
              ...project.settings.residential,
              recommendedServiceAmps: loadResult.serviceAmps
            } as any
          }
        });

        if (mainPanel && mainPanel.main_breaker_amps !== finalRecommendation) {
          await updatePanel(mainPanel.id, {
            main_breaker_amps: finalRecommendation
          });
        }
      }

      setShowGenerated(false);
      alert(`Successfully created ${generatedCircuits.length} circuits in the panel schedule!`);
    } catch (error) {
      console.error('Error creating circuits:', error);
      alert('Error creating circuits. Check console for details.');
    }
  };

  // Clear all circuits from main panel
  const handleClearPanelSchedule = async () => {
    if (!mainPanel || mainPanelCircuits.length === 0) return;

    const confirmed = confirm(
      `⚠️ Delete all ${mainPanelCircuits.length} circuit(s) from the panel schedule?\n\n` +
      `This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await deleteCircuitsByPanel(mainPanel.id);
      alert('Panel schedule cleared successfully!');
    } catch (error) {
      console.error('Error clearing panel schedule:', error);
      alert('Error clearing panel schedule. Check console for details.');
    }
  };

  // Generate multi-family project (no EV)
  const handleGenerateMFProject = async () => {
    if (!loadResult) return;

    // Check for existing panels first
    const hasPanels = await projectHasPanels(project.id);
    if (hasPanels) {
      setExistingPanelsWarning(true);
      return;
    }

    await doGenerateMFProject();
  };

  const doGenerateMFProject = async () => {
    if (!loadResult) return;

    setExistingPanelsWarning(false);
    setIsGeneratingMF(true);
    setMfGenerateError(null);
    setMfGenerateSuccess(false);
    setMfProgress(null);

    try {
      // Use shared appliances state (applies to ALL unit types)
      const hasElectricCooking = appliances.range?.enabled === true && appliances.range.type === 'electric';
      const hasElectricHeat = appliances.hvac?.enabled === true &&
        (appliances.hvac.type === 'heat_pump' || appliances.hvac.type === 'electric_heat');

      // Build appliance config with actual wattages from DLC settings
      const applianceConfig: UnitApplianceConfig = {
        rangeKW: hasElectricCooking ? appliances.range!.kw : undefined,
        dryerKW: appliances.dryer?.enabled && appliances.dryer.type === 'electric' ? appliances.dryer.kw : undefined,
        waterHeaterKW: appliances.waterHeater?.enabled ? appliances.waterHeater.kw : undefined,
        coolingKW: appliances.hvac?.enabled ? appliances.hvac.coolingKw : undefined,
        heatingKW: hasElectricHeat ? appliances.hvac!.heatingKw : undefined,
        dishwasherKW: appliances.dishwasher?.enabled ? appliances.dishwasher.kw : undefined,
        disposalKW: appliances.disposal?.enabled ? appliances.disposal.kw : undefined,
      };

      // Calculate total dwelling units
      const totalUnits = unitTemplates.reduce((sum, t) => sum + t.unitCount, 0);
      // Weighted average sq ft
      const avgSqFt = totalUnits > 0
        ? Math.round(unitTemplates.reduce((sum, t) => sum + t.squareFootage * t.unitCount, 0) / totalUnits)
        : 1000;

      const options: BasicGenerationOptions = {
        projectId: project.id,
        voltage: 240,
        phase: 1,
        dwellingUnits: totalUnits,
        avgUnitSqFt: avgSqFt,
        buildingName: project.name,
        serviceAmps: loadResult.recommendedServiceSize,
        commonAreaLoadVA: housePanelLoad,
        hasElectricCooking,
        hasElectricHeat,
        applianceConfig,
      };

      const generated = generateBasicMultiFamilyProject(options);
      await populateProject(generated, (progress) => setMfProgress(progress));

      setMfGenerateSuccess(true);
    } catch (error) {
      console.error('MF generation error:', error);
      setMfGenerateError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsGeneratingMF(false);
    }
  };

  const handleClearAndGenerateMF = async () => {
    try {
      setExistingPanelsWarning(false);
      setIsGeneratingMF(true);
      setMfProgress({ step: 'Clearing existing data...', current: 0, total: 1 });
      await clearProjectElectricalData(project.id);
      await doGenerateMFProject();
    } catch (error) {
      console.error('Clear & generate error:', error);
      setMfGenerateError(error instanceof Error ? error.message : 'Unknown error');
      setIsGeneratingMF(false);
    }
  };

  // Render appliance toggle card
  const renderApplianceCard = (
    key: keyof ResidentialAppliances,
    icon: React.ReactNode,
    title: string,
    children: React.ReactNode
  ) => {
    const appliance = appliances[key] as any;
    const isEnabled = appliance?.enabled;

    return (
      <div className={`border rounded-lg p-4 transition-all ${
        isEnabled ? 'border-[#2d3b2d] bg-[#f0f5f0]/50' : 'border-gray-200 bg-white'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-medium text-gray-900">{title}</span>
          </div>
          <button
            onClick={() => toggleAppliance(key)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isEnabled ? 'bg-[#2d3b2d]' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        {isEnabled && (
          <div className="pt-3 border-t border-gray-100 space-y-2">
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-light text-gray-900 flex items-center gap-2">
            <Home className="w-5 h-5 sm:w-6 sm:h-6 text-[#3d6b3d] flex-shrink-0" />
            <span>Dwelling Load Calculator</span>
          </h2>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">
            {isSingleFamily
              ? (project.settings?.service_modification_type && project.settings.service_modification_type !== 'new-service'
                  ? 'NEC 220.83 - Optional Method for Existing Single-Family Dwellings'
                  : project.settings?.dwelling_calc_mode === 'true-optional'
                    ? 'NEC 220.82 - Optional Method for Single-Family Dwellings (10 kVA / 40% bucket)'
                    : 'NEC 220 Standard Method - Per-Category Demand Factors (220.42 / 220.52 / 220.55 / 220.60)')
              : 'NEC 220.84 - Optional Method for Multi-Family Dwellings'
            }
          </p>
          {/* Existing Service Size input — drives the Service Headroom card.
              Only relevant on existing-construction single-family projects.
              Defaults to the main panel's main_breaker_amps when no override
              is stored, so the headroom card has a sensible value from
              first paint. */}
          {isSingleFamily
            && project.settings?.service_modification_type
            && project.settings.service_modification_type !== 'new-service'
            && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="text-xs font-semibold text-[#888] uppercase">Existing Service Size</label>
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={project.settings?.residential?.existingServiceAmps ?? mainPanel?.main_breaker_amps ?? ''}
                  onChange={e => {
                    const v = e.target.value === '' ? undefined : Number(e.target.value);
                    updateProject({
                      ...project,
                      settings: {
                        ...project.settings,
                        residential: {
                          ...(project.settings?.residential ?? { dwellingType: 'single_family', smallApplianceCircuits: 2, laundryCircuit: true, bathroomCircuits: 0, garageCircuit: false, outdoorCircuit: false } as any),
                          existingServiceAmps: v
                        }
                      }
                    });
                  }}
                  className="w-24 border-[#e8e6e3] rounded-md text-sm py-1 px-2"
                  placeholder="amps"
                />
                <span className="text-xs text-[#888]">A</span>
                <span className="text-xs text-[#888] italic">
                  (auto from main panel breaker; override to model upsize scenarios)
                </span>
              </div>
            )}

          {/* Calculation Method toggle — only meaningful for new 220.82.
              220.83 is always bucket method by NEC definition, so we disable
              the control with a note when an existing dwelling is active. */}
          {isSingleFamily && (() => {
            const isExisting = project.settings?.service_modification_type
              && project.settings.service_modification_type !== 'new-service';
            return (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="text-xs font-semibold text-[#888] uppercase">Calculation Method</label>
                <select
                  disabled={isExisting}
                  value={project.settings?.dwelling_calc_mode ?? 'per-category'}
                  onChange={e => {
                    updateProject({
                      ...project,
                      settings: {
                        ...project.settings,
                        dwelling_calc_mode: e.target.value as 'per-category' | 'true-optional'
                      }
                    });
                  }}
                  className="border-[#e8e6e3] rounded-md text-sm py-1 px-2 disabled:bg-gray-50 disabled:text-gray-400"
                  title={isExisting ? 'NEC 220.83 always uses the 8 kVA / 40% bucket method' : undefined}
                >
                  {isExisting ? (
                    <option value="per-category">220.83 Optional (8 kVA / 40%)</option>
                  ) : (
                    <>
                      <option value="per-category">Per-Category (NEC 220 Standard Method)</option>
                      <option value="true-optional">220.82 Optional (10 kVA / 40%)</option>
                    </>
                  )}
                </select>
                {isExisting && (
                  <span className="text-xs text-[#888] italic">
                    Locked: NEC 220.83 always uses 8 kVA / 40% bucket
                  </span>
                )}
              </div>
            );
          })()}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto">
          {/* Show current panel status */}
          {mainPanel && (
            <div className="text-left lg:text-right flex-1 lg:flex-none">
              <p className="text-sm text-gray-600">
                Panel: <span className="font-medium">{mainPanel.name}</span>
              </p>
              <p className="text-xs text-gray-500">
                {mainPanelCircuits.length === 0 
                  ? 'No circuits created yet' 
                  : `${mainPanelCircuits.length} circuit${mainPanelCircuits.length !== 1 ? 's' : ''} in schedule`
                }
              </p>
            </div>
          )}
          
          {/* Clear Panel Schedule Button - only show if circuits exist */}
          {mainPanelCircuits.length > 0 && (
            <button
              onClick={handleClearPanelSchedule}
              className="px-3 py-2 border border-red-200 text-red-600 rounded-md hover:bg-red-50 transition-colors flex items-center gap-2 text-sm"
              title="Delete all circuits from panel"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
          
          {/* Generate Panel Schedule Button */}
          <button
            onClick={handleGeneratePanelSchedule}
            disabled={isGenerating || !loadResult}
            className="px-3 sm:px-4 py-2 bg-[#2d3b2d] text-white rounded-md hover:bg-[#3d4f3d] transition-colors flex items-center gap-2 disabled:opacity-50 text-sm sm:text-base whitespace-nowrap"
          >
            <Calculator className="w-4 h-4" />
            <span className="hidden sm:inline">{mainPanelCircuits.length > 0 ? 'Regenerate Schedule' : 'Generate Panel Schedule'}</span>
            <span className="sm:hidden">Generate</span>
          </button>
        </div>
      </div>

      {/* Multi-Family Project Generation Card */}
      {showMFRedirect && !isSingleFamily && loadResult && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Building2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-blue-900">
                Multi-Family Service Sizing: {loadResult.recommendedServiceSize}A
              </h4>
              <p className="text-xs text-blue-700 mt-1">
                Generate a complete project with meter stack, unit panels, and house panel.
                {' '}After generating, you can add EV charging infrastructure from the MF EV Calculator in Tools &amp; Calculators.
              </p>

              {/* Existing panels warning */}
              {existingPanelsWarning && (
                <div className="mt-3 p-2.5 bg-[#f0f5f0] border border-[#3d6b3d]/40 rounded-md">
                  <p className="text-xs font-medium text-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                    This project already has panels. Generating will clear all existing panels, circuits, feeders, meters, and meter stacks.
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={handleClearAndGenerateMF}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#2d3b2d] text-white text-xs font-medium rounded hover:bg-[#243024] transition-colors"
                    >
                      Clear & Replace
                    </button>
                    <button
                      onClick={() => setExistingPanelsWarning(false)}
                      className="text-xs text-[#2d3b2d] hover:text-amber-900"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Progress bar */}
              {isGeneratingMF && mfProgress && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 text-xs text-blue-700">
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                    <span>{mfProgress.step}</span>
                  </div>
                  <div className="mt-1 h-1.5 bg-blue-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-300"
                      style={{ width: `${mfProgress.total > 0 ? (mfProgress.current / mfProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error */}
              {mfGenerateError && (
                <p className="mt-2 text-xs text-red-600">Error: {mfGenerateError}</p>
              )}

              {/* Success */}
              {mfGenerateSuccess && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-green-700">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Project generated! Check the Circuit Design and One-Line Diagram tabs.
                </div>
              )}

              {/* Action buttons */}
              {!isGeneratingMF && !mfGenerateSuccess && !existingPanelsWarning && (
                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={handleGenerateMFProject}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Generate Multi-Family Project
                  </button>
                  <button
                    onClick={() => setShowMFRedirect(false)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Reset after success */}
              {mfGenerateSuccess && (
                <button
                  onClick={() => { setMfGenerateSuccess(false); setShowMFRedirect(false); }}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Appliances */}
        <div className="lg:col-span-2 space-y-6">
          {/* Single Family: Square Footage Info */}
          {isSingleFamily && (
            <div className="bg-[#f0f5f0] border border-[#3d6b3d]/30 rounded-lg p-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800">
                    General Lighting Load: {((residentialSettings?.squareFootage || 2000) * 3).toLocaleString()} VA
                  </p>
                  <p className="text-xs text-[#3d6b3d]">
                    {residentialSettings?.squareFootage?.toLocaleString() || '2,000'} sq ft × 3 VA/sq ft (NEC Table 220.12)
                  </p>
                </div>
                <p className="text-xs text-[#2d3b2d]">
                  Edit square footage in Project Setup
                </p>
              </div>
            </div>
          )}

          {/* Multi-Family: Instructions & Unit Templates */}
          {!isSingleFamily && (
            <div className="space-y-4">
              {/* Instructions Card */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5" />
                  Multi-Family Calculation (NEC 220.84)
                </h3>
                <div className="text-sm text-gray-700 space-y-2">
                  <p><strong>How it works:</strong></p>
                  <ol className="list-decimal list-inside space-y-1 text-gray-600">
                    <li>Define unit types below (e.g., "Studio", "1BR", "2BR")</li>
                    <li>Set square footage and count for each type</li>
                    <li>Configure appliances using the section below (applies to ALL units)</li>
                    <li>Add house panel load for common areas (hallways, parking, laundry)</li>
                    <li>The calculator applies NEC Table 220.84 demand factors automatically</li>
                  </ol>
                </div>
              </div>

              {/* Unit Templates */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-medium text-gray-900">Dwelling Unit Types</h3>
                  <button
                    onClick={addUnitTemplate}
                    className="text-sm text-[#2d3b2d] hover:text-[#2d3b2d] flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Add Unit Type
                  </button>
                </div>
                <div className="space-y-3">
                  {unitTemplates.map((template, idx) => (
                    <div key={template.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <input
                            type="text"
                            value={template.name}
                            onChange={e => updateUnitTemplate(template.id, { name: e.target.value })}
                            className="flex-1 min-w-0 border-gray-200 rounded text-sm font-medium"
                            placeholder="e.g., Type A - Studio"
                          />
                          <button
                            onClick={() => removeUnitTemplate(template.id)}
                            className="p-1 text-gray-400 hover:text-red-500 sm:hidden flex-shrink-0"
                            disabled={unitTemplates.length === 1}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="flex items-center gap-1">
                            <label className="text-xs text-gray-500 whitespace-nowrap">Sq Ft:</label>
                            <NumberInput
                              value={template.squareFootage}
                              onChange={v => updateUnitTemplate(template.id, { squareFootage: v })}
                              className="w-20 border-gray-200 rounded text-sm"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <label className="text-xs text-gray-500">Units:</label>
                            <NumberInput
                              value={template.unitCount}
                              onChange={v => updateUnitTemplate(template.id, { unitCount: v })}
                              className="w-16 border-gray-200 rounded text-sm"
                              min={1}
                              allowDecimal={false}
                            />
                          </div>
                          <button
                            onClick={() => removeUnitTemplate(template.id)}
                            className="p-1 text-gray-400 hover:text-red-500 hidden sm:block flex-shrink-0"
                            disabled={unitTemplates.length === 1}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {/* Unit load preview */}
                      <div className="mt-2 text-xs text-gray-500 ml-1">
                        Lighting: {(template.squareFootage * 3).toLocaleString()} VA × {template.unitCount} units = {(template.squareFootage * 3 * template.unitCount).toLocaleString()} VA
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Summary */}
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Dwelling Units:</span>
                    <span className="font-medium">{unitTemplates.reduce((sum, t) => sum + t.unitCount, 0)}</span>
                  </div>
                  
                  {/* House Panel Load */}
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-gray-700">House Panel Load:</label>
                    <NumberInput
                      value={housePanelLoad}
                      onChange={setHousePanelLoad}
                      className="w-28 border-gray-200 rounded text-sm"
                      placeholder="0"
                    />
                    <span className="text-xs text-gray-500">VA (common areas: parking, hallways, laundry room)</span>
                  </div>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                    <Info className="w-3 h-3 flex-shrink-0" />
                    For itemized common area loads (elevators, HVAC, pool, lighting by space), use the Multi-Family EV Calculator in Tools & Calculators.
                  </p>
                </div>
              </div>

              {/* Note about appliances */}
              <div className="bg-[#f0f5f0] border border-[#3d6b3d]/30 rounded-lg p-3">
                <p className="text-xs text-amber-800">
                  <strong>💡 Appliances below apply to ALL unit types.</strong> Configure typical unit appliances (range, A/C, water heater) in the Appliances section below. The calculator assumes each dwelling unit has the same equipment.
                </p>
              </div>
            </div>
          )}

          {/* Appliances Section */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('appliances')}
              className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#2d3b2d]" />
                Appliances & Equipment
              </h3>
              {expandedSections.has('appliances') ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            
            {expandedSections.has('appliances') && (
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Range */}
                  {renderApplianceCard('range', <Flame className="w-5 h-5 text-orange-500" />, 'Electric Range', (
                    <>
                      <select
                        value={appliances.range?.type || 'electric'}
                        onChange={e => updateAppliance('range', { ...appliances.range!, type: e.target.value as any })}
                        className="w-full text-sm border-gray-200 rounded"
                      >
                        <option value="electric">Electric</option>
                        <option value="gas">Gas (no load)</option>
                      </select>
                      {appliances.range?.type === 'electric' && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500 flex-shrink-0">kW:</label>
                          <NumberInput
                            value={appliances.range?.kw || 12}
                            onChange={v => updateAppliance('range', { ...appliances.range!, kw: v })}
                            className="w-24 text-sm border-gray-200 rounded"
                            step={0.5}
                            min={0}
                          />
                        </div>
                      )}
                    </>
                  ))}

                  {/* Dryer */}
                  {renderApplianceCard('dryer', <Wind className="w-5 h-5 text-blue-500" />, 'Clothes Dryer', (
                    <>
                      <select
                        value={appliances.dryer?.type || 'electric'}
                        onChange={e => updateAppliance('dryer', { ...appliances.dryer!, type: e.target.value as any })}
                        className="w-full text-sm border-gray-200 rounded"
                      >
                        <option value="electric">Electric</option>
                        <option value="gas">Gas (no load)</option>
                      </select>
                      {appliances.dryer?.type === 'electric' && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <label className="text-xs text-gray-500 flex-shrink-0">kW:</label>
                          <NumberInput
                            value={appliances.dryer?.kw || 5.5}
                            onChange={v => updateAppliance('dryer', { ...appliances.dryer!, kw: v })}
                            className="w-24 text-sm border-gray-200 rounded"
                            step={0.5}
                            min={5}
                          />
                          <span className="text-xs text-gray-400 flex-shrink-0">min 5 kW</span>
                        </div>
                      )}
                    </>
                  ))}

                  {/* Water Heater */}
                  {renderApplianceCard('waterHeater', <Droplets className="w-5 h-5 text-cyan-500" />, 'Water Heater', (
                    <>
                      <select
                        value={appliances.waterHeater?.type || 'electric'}
                        onChange={e => updateAppliance('waterHeater', { ...appliances.waterHeater!, type: e.target.value as any })}
                        className="w-full text-sm border-gray-200 rounded"
                      >
                        <option value="electric">Electric Tank</option>
                        <option value="tankless">Electric Tankless</option>
                        <option value="gas">Gas (no load)</option>
                      </select>
                      {appliances.waterHeater?.type !== 'gas' && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500 flex-shrink-0">kW:</label>
                          <NumberInput
                            value={appliances.waterHeater?.kw || 4.5}
                            onChange={v => updateAppliance('waterHeater', { ...appliances.waterHeater!, kw: v })}
                            className="w-24 text-sm border-gray-200 rounded"
                            step={0.5}
                            min={0}
                          />
                        </div>
                      )}
                    </>
                  ))}

                  {/* HVAC */}
                  {renderApplianceCard('hvac', <Wind className="w-5 h-5 text-teal-500" />, 'HVAC System', (
                    <>
                      <select
                        value={appliances.hvac?.type || 'ac_only'}
                        onChange={e => updateAppliance('hvac', { ...appliances.hvac!, type: e.target.value as any })}
                        className="w-full text-sm border-gray-200 rounded mb-2"
                      >
                        <option value="ac_only">A/C Only</option>
                        <option value="heat_pump">Heat Pump</option>
                        <option value="electric_heat">Electric Furnace</option>
                        <option value="gas_heat">Gas Heat + A/C</option>
                      </select>
                      <div className="flex flex-wrap gap-2">
                        <div className="flex items-center gap-1">
                          <label className="text-xs text-gray-500 flex-shrink-0">A/C kW:</label>
                          <NumberInput
                            value={appliances.hvac?.coolingKw || 5}
                            onChange={v => updateAppliance('hvac', { ...appliances.hvac!, coolingKw: v })}
                            className="w-20 text-sm border-gray-200 rounded"
                            step={0.5}
                            min={0}
                          />
                        </div>
                        {(appliances.hvac?.type === 'electric_heat' || appliances.hvac?.type === 'heat_pump') && (
                          <div className="flex items-center gap-1">
                            <label className="text-xs text-gray-500 flex-shrink-0">Heat kW:</label>
                            <NumberInput
                              value={appliances.hvac?.heatingKw || 10}
                              onChange={v => updateAppliance('hvac', { ...appliances.hvac!, heatingKw: v })}
                              className="w-20 text-sm border-gray-200 rounded"
                              step={0.5}
                              min={0}
                            />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        NEC 220.60: Use larger of heat or A/C (non-coincident)
                      </p>
                    </>
                  ))}

                  {/* Dishwasher */}
                  {renderApplianceCard('dishwasher', <Droplets className="w-5 h-5 text-blue-400" />, 'Dishwasher', (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 flex-shrink-0">kW:</label>
                      <NumberInput
                        value={appliances.dishwasher?.kw || 1.5}
                        onChange={v => updateAppliance('dishwasher', { ...appliances.dishwasher!, kw: v })}
                        className="w-24 text-sm border-gray-200 rounded"
                        step={0.1}
                        min={0}
                      />
                    </div>
                  ))}

                  {/* Garbage Disposal */}
                  {renderApplianceCard('disposal', <RefreshCw className="w-5 h-5 text-gray-500" />, 'Garbage Disposal', (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 flex-shrink-0">kW:</label>
                      <NumberInput
                        value={appliances.disposal?.kw || 0.5}
                        onChange={v => updateAppliance('disposal', { ...appliances.disposal!, kw: v })}
                        className="w-24 text-sm border-gray-200 rounded"
                        step={0.1}
                        min={0}
                      />
                    </div>
                  ))}

                  {/* EV Charger */}
                  {renderApplianceCard('evCharger', <Car className="w-5 h-5 text-green-500" />, 'EV Charger', (
                    <>
                      <select
                        value={appliances.evCharger?.level || 2}
                        onChange={e => updateAppliance('evCharger', { ...appliances.evCharger!, level: Number(e.target.value) as 1 | 2 })}
                        className="w-full text-sm border-gray-200 rounded"
                      >
                        <option value={1}>Level 1 (120V)</option>
                        <option value={2}>Level 2 (240V)</option>
                      </select>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500 flex-shrink-0">kW:</label>
                        <NumberInput
                          value={appliances.evCharger?.kw || 7.7}
                          onChange={v => updateAppliance('evCharger', { ...appliances.evCharger!, kw: v })}
                          className="w-24 text-sm border-gray-200 rounded"
                          step={0.1}
                          min={0}
                        />
                      </div>
                    </>
                  ))}

                  {/* Pool Pump */}
                  {renderApplianceCard('poolPump', <Waves className="w-5 h-5 text-blue-500" />, 'Pool Pump', (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 flex-shrink-0">HP:</label>
                      <NumberInput
                        value={appliances.poolPump?.hp || 1.5}
                        onChange={v => updateAppliance('poolPump', { ...appliances.poolPump!, hp: v })}
                        className="w-24 text-sm border-gray-200 rounded"
                        step={0.5}
                        min={0}
                      />
                    </div>
                  ))}

                  {/* Pool Heater */}
                  {renderApplianceCard('poolHeater', <Flame className="w-5 h-5 text-red-400" />, 'Pool Heater', (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 flex-shrink-0">kW:</label>
                      <NumberInput
                        value={appliances.poolHeater?.kw || 11}
                        onChange={v => updateAppliance('poolHeater', { ...appliances.poolHeater!, kw: v })}
                        className="w-24 text-sm border-gray-200 rounded"
                        step={1}
                        min={0}
                      />
                    </div>
                  ))}

                  {/* Hot Tub */}
                  {renderApplianceCard('hotTub', <Waves className="w-5 h-5 text-purple-500" />, 'Hot Tub / Spa', (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 flex-shrink-0">kW:</label>
                      <NumberInput
                        value={appliances.hotTub?.kw || 6}
                        onChange={v => updateAppliance('hotTub', { ...appliances.hotTub!, kw: v })}
                        className="w-24 text-sm border-gray-200 rounded"
                        step={0.5}
                        min={0}
                      />
                    </div>
                  ))}

                  {/* Well Pump */}
                  {renderApplianceCard('wellPump', <Droplets className="w-5 h-5 text-gray-600" />, 'Well Pump', (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 flex-shrink-0">HP:</label>
                      <NumberInput
                        value={appliances.wellPump?.hp || 1}
                        onChange={v => updateAppliance('wellPump', { ...appliances.wellPump!, hp: v })}
                        className="w-24 text-sm border-gray-200 rounded"
                        step={0.5}
                        min={0}
                      />
                    </div>
                  ))}
                </div>

                {/* Other Appliances */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-medium text-gray-700">Other Fixed Appliances</h4>
                    <button
                      onClick={addOtherAppliance}
                      className="text-sm text-[#2d3b2d] hover:text-[#2d3b2d] flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Add Appliance
                    </button>
                  </div>
                  {(appliances.otherAppliances || []).map((other, idx) => (
                    <div key={idx} className="flex flex-wrap items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={other.description}
                        onChange={e => updateOtherAppliance(idx, 'description', e.target.value)}
                        className="flex-1 min-w-[140px] text-sm border-gray-200 rounded"
                        placeholder="Description"
                      />
                      <NumberInput
                        value={other.kw}
                        onChange={v => updateOtherAppliance(idx, 'kw', v)}
                        className="w-20 text-sm border-gray-200 rounded"
                        step={0.1}
                        min={0}
                      />
                      <span className="text-xs text-gray-500">kW</span>
                      <select
                        value={other.voltage ?? (other.kw > 2 ? 240 : 120)}
                        onChange={e => updateOtherAppliance(idx, 'voltage', Number(e.target.value) as 120 | 240)}
                        className="text-xs border-gray-200 rounded py-1"
                        title="Branch voltage — 120V → 1P breaker, 240V → 2P breaker"
                      >
                        <option value={120}>120V (1P)</option>
                        <option value={240}>240V (2P)</option>
                      </select>
                      <label className="inline-flex items-center gap-1 text-xs text-gray-600" title="NEC 100 continuous load — operates 3+ hours. Applies ×1.25 per NEC 210.20(A) / 220.18(B).">
                        <input
                          type="checkbox"
                          checked={!!other.continuous}
                          onChange={e => updateOtherAppliance(idx, 'continuous', e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        Continuous
                      </label>
                      <button
                        onClick={() => removeOtherAppliance(idx)}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Proposed New Loads — visible only on existing-construction
                    single-family. Template dropdown sources from the same
                    LOAD_TEMPLATES the Service Upgrade Wizard uses, each with
                    NEC continuous-load flag baked in. Items flow into the
                    demand calc (×1.25 when continuous) and become circuits
                    with is_proposed=true on Generate Schedule. */}
                {isSingleFamily
                  && project.settings?.service_modification_type
                  && project.settings.service_modification_type !== 'new-service'
                  && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-medium text-gray-700">
                        Proposed New Loads
                        <span className="ml-2 text-xs text-gray-500 font-normal">
                          (additions under this permit — marked * on the schedule)
                        </span>
                      </h4>
                      <button
                        onClick={addCustomProposed}
                        className="text-sm text-[#2d3b2d] hover:text-[#2d3b2d] flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" /> Add Custom
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <label className="text-xs font-semibold text-[#888] uppercase">Select from Common Loads</label>
                      <select
                        value={selectedTemplate}
                        onChange={e => {
                          const v = e.target.value;
                          if (v) addProposedFromTemplate(v);
                        }}
                        className="text-sm border-gray-200 rounded py-1 px-2 flex-1 min-w-[200px]"
                      >
                        <option value="">-- Select Load --</option>
                        <optgroup label="EV Chargers (NEC 625.41 continuous)">
                          {LOAD_TEMPLATES.filter(t => t.category === 'EV').map(t => (
                            <option key={t.name} value={t.name}>{t.name}</option>
                          ))}
                        </optgroup>
                        <optgroup label="HVAC">
                          {LOAD_TEMPLATES.filter(t => t.category === 'HVAC').map(t => (
                            <option key={t.name} value={t.name}>{t.name}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Appliances">
                          {LOAD_TEMPLATES.filter(t => t.category === 'Appliance').map(t => (
                            <option key={t.name} value={t.name}>{t.name}</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>

                    {proposedLoads.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">
                        No proposed loads yet. Pick a template above or click "Add Custom".
                      </p>
                    ) : (
                      proposedLoads.map(p => (
                        <div key={p.id} className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-[10px] font-bold rounded px-1 py-0.5 bg-electric-100 text-electric-700 border border-electric-300">NEW</span>
                          <input
                            type="text"
                            value={p.description}
                            onChange={e => updateProposed(p.id, 'description', e.target.value)}
                            className="flex-1 min-w-[140px] text-sm border-gray-200 rounded"
                            placeholder="Description"
                          />
                          <NumberInput
                            value={p.kw}
                            onChange={v => updateProposed(p.id, 'kw', v)}
                            className="w-20 text-sm border-gray-200 rounded"
                            step={0.1}
                            min={0}
                          />
                          <span className="text-xs text-gray-500">kW</span>
                          <select
                            value={p.voltage}
                            onChange={e => updateProposed(p.id, 'voltage', Number(e.target.value) as 120 | 240)}
                            className="text-xs border-gray-200 rounded py-1"
                          >
                            <option value={120}>120V (1P)</option>
                            <option value={240}>240V (2P)</option>
                          </select>
                          <label
                            className="inline-flex items-center gap-1 text-xs text-gray-600"
                            title="NEC 100 continuous load — operates 3+ hours. Applies ×1.25 per NEC 210.20(A) / 220.18(B)."
                          >
                            <input
                              type="checkbox"
                              checked={p.continuous}
                              onChange={e => updateProposed(p.id, 'continuous', e.target.checked)}
                              className="rounded border-gray-300"
                            />
                            Continuous
                          </label>
                          {p.necReference && (
                            <span className="text-[10px] text-gray-400 italic">{p.necReference}</span>
                          )}
                          <button
                            onClick={() => removeProposed(p.id)}
                            className="p-1 text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Results */}
        <div className="space-y-6">
          {/* Service Summary */}
          {loadResult && (
            <div className="bg-white rounded-xl border border-[#e8e6e3] shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-[#2d3b2d] to-[#3d4f3d] px-6 py-3 flex items-center gap-2">
                <Zap className="w-5 h-5 text-white" />
                <span className="text-base font-semibold text-white">Service Calculation</span>
              </div>
              <div className="p-5 space-y-3">
                <div className="flex justify-between items-center py-1">
                  <span className="text-[#888] text-sm">Connected Load</span>
                  <span className="text-lg font-semibold text-[#2d3b2d]">{(loadResult.totalConnectedVA / 1000).toFixed(1)} kVA</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-[#888] text-sm">Demand Load</span>
                  <span className="text-lg font-semibold text-[#2d3b2d]">{(loadResult.totalDemandVA / 1000).toFixed(1)} kVA</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-[#888] text-sm">Demand Factor</span>
                  <span className="text-lg text-[#2d3b2d]">{(loadResult.demandFactor * 100).toFixed(1)}%</span>
                </div>
                <div className="pt-3 mt-3 border-t border-[#e8e6e3]">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-[#888] text-sm">Service Current</span>
                    <span className="text-xl font-bold text-[#c9a227]">{loadResult.serviceAmps}A</span>
                  </div>
                  {(() => {
                    // On existing-construction with a user-stated existing
                    // service that holds, the "recommendation" IS the
                    // existing service — surface that, not the abstract
                    // NEC new-install number that would override it.
                    const isExisting = project.settings?.service_modification_type
                      && project.settings.service_modification_type !== 'new-service';
                    const existing = project.settings?.residential?.existingServiceAmps
                      ?? mainPanel?.main_breaker_amps;
                    const existingHolds = isExisting
                      && typeof existing === 'number'
                      && loadResult.serviceAmps <= existing;
                    return (
                      <div className="flex justify-between items-center py-1">
                        <span className="text-[#888] text-sm">Recommended Service</span>
                        {existingHolds ? (
                          <span className="text-right">
                            <span className="text-2xl font-bold text-[#3d6b3d]">{existing}A</span>
                            <span className="block text-[10px] text-[#3d6b3d] uppercase tracking-wide">existing holds</span>
                          </span>
                        ) : (
                          <span className="text-2xl font-bold text-[#c9a227]">{loadResult.recommendedServiceSize}A</span>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Service Headroom card — only on existing-construction
                    single-family. Compares NEC 220.83 demand to the user's
                    existing service rating so the EE can answer "can my
                    125 A panel hold a new EV?" without leaving this page. */}
                {isSingleFamily
                  && project.settings?.service_modification_type
                  && project.settings.service_modification_type !== 'new-service'
                  && (() => {
                    const existing = project.settings?.residential?.existingServiceAmps
                      ?? mainPanel?.main_breaker_amps;
                    if (!existing || !loadResult.serviceAmps) return null;
                    const demand = loadResult.serviceAmps;
                    const headroom = existing - demand;
                    const utilization = demand / existing;
                    const holds = headroom >= 0;
                    const tight = holds && utilization >= 0.9;
                    return (
                      <div className={`mt-4 rounded-lg border p-3 ${
                        holds
                          ? (tight ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200')
                          : 'bg-red-50 border-red-200'
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-[#555] uppercase tracking-wide">
                            Service Headroom (NEC 220.83 vs Existing)
                          </span>
                          <span className={`text-xs font-bold uppercase ${
                            holds ? (tight ? 'text-amber-700' : 'text-green-700') : 'text-red-700'
                          }`}>
                            {holds ? (tight ? 'At Capacity' : 'Service Holds') : 'Upgrade Required'}
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className="text-sm text-[#555]">
                            {demand.toFixed(0)}A demand &middot; {existing}A existing
                          </span>
                          <span className={`text-xl font-bold ${
                            holds ? (tight ? 'text-amber-700' : 'text-green-700') : 'text-red-700'
                          }`}>
                            {holds ? '+' : ''}{headroom.toFixed(0)}A
                          </span>
                        </div>
                        {!holds && (
                          <p className="mt-2 text-xs text-red-700 leading-snug">
                            Existing {existing}A service is undersized by {Math.abs(headroom).toFixed(0)}A.
                            Either upgrade to {loadResult.recommendedServiceSize}A min, or apply an
                            EVEMS / circuit-sharing scheme per NEC 750 to reduce setpoint.
                          </p>
                        )}
                        {tight && (
                          <p className="mt-2 text-xs text-amber-700 leading-snug">
                            Less than 10% headroom remaining. Future load additions
                            (EV, heat pump, range upgrade) will trigger a service upgrade.
                          </p>
                        )}
                      </div>
                    );
                  })()}
              </div>
            </div>
          )}

          {/* Conductor Sizing */}
          {loadResult && (
            <div className="bg-white rounded-xl border border-[#e8e6e3] shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-[#2d3b2d] to-[#3d4f3d] px-6 py-3 flex items-center gap-2">
                <Cable className="w-5 h-5 text-white" />
                <span className="text-base font-semibold text-white">Recommended Conductor Sizes</span>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-[#faf9f7] rounded-lg p-4 border border-[#e8e6e3]">
                    <div className="text-xs text-[#888] mb-1 uppercase tracking-wide">Service Conductors</div>
                    <div className="text-2xl font-bold text-[#2d3b2d]">{loadResult.serviceConductorSize}</div>
                    <div className="text-sm font-medium text-[#3d6b3d]">Cu</div>
                    <div className="text-xs text-[#888] mt-2">Ungrounded (hot)</div>
                    <div className="text-xs text-[#888]">Per NEC Table 310.12</div>
                  </div>
                  <div className="bg-[#faf9f7] rounded-lg p-4 border border-[#e8e6e3]">
                    <div className="text-xs text-[#888] mb-1 uppercase tracking-wide">Neutral Conductor</div>
                    <div className="text-2xl font-bold text-[#2d3b2d]">{loadResult.neutralConductorSize}</div>
                    <div className="text-sm font-medium text-[#3d6b3d]">Cu</div>
                    <div className="text-xs text-[#888] mt-2">{loadResult.neutralAmps}A demand</div>
                    <div className="text-xs text-[#888]">
                      {loadResult.neutralReduction > 0
                        ? `(${loadResult.neutralReduction}% reduction applied)`
                        : 'No reduction'}
                    </div>
                  </div>
                  <div className="bg-[#faf9f7] rounded-lg p-4 border border-[#e8e6e3]">
                    <div className="text-xs text-[#888] mb-1 uppercase tracking-wide">Grounding Electrode</div>
                    <div className="text-2xl font-bold text-[#2d3b2d]">{loadResult.gecSize}</div>
                    <div className="text-sm font-medium text-[#3d6b3d]">AWG Cu</div>
                    <div className="text-xs text-[#888] mt-2">GEC to electrode</div>
                    <div className="text-xs text-[#888]">Per NEC 250.66</div>
                  </div>
                </div>
                <div className="mt-4 text-xs text-[#666] bg-[#f0eeeb] rounded-md p-3 border border-[#e8e6e3]">
                  <p className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#c9a227]" />
                    <span>Conductor sizes assume copper (Cu), 75°C terminations, and standard installation conditions.
                    For aluminum, underground, or special conditions, use the Conductor Sizing Tool for detailed calculations.</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Warnings */}
          {loadResult?.warnings && loadResult.warnings.length > 0 && (
            <div className="bg-[#fff8e6] border border-[#c9a227]/40 rounded-lg p-4">
              <h4 className="font-medium text-[#7a6200] flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4" />
                Warnings
              </h4>
              <ul className="text-sm text-[#9a7b00] space-y-1">
                {loadResult.warnings.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Load Breakdown */}
          {loadResult && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('results')}
                className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-500" />
                  Load Breakdown
                </h3>
                {expandedSections.has('results') ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>
              
              {expandedSections.has('results') && (
                <div className="p-4 overflow-x-auto">
                  <table className="w-full text-sm min-w-[400px]">
                    <thead>
                      <tr className="text-xs text-gray-500 uppercase">
                        <th className="text-left pb-2 whitespace-nowrap">Category</th>
                        <th className="text-right pb-2 whitespace-nowrap">Connected</th>
                        <th className="text-right pb-2 whitespace-nowrap">Demand</th>
                        <th className="text-right pb-2 whitespace-nowrap">Factor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {loadResult.breakdown.map((item, idx) => (
                        <tr key={idx} className={item.category.includes('Subtotal') ? 'bg-gray-50 font-medium' : ''}>
                          <td className="py-2">
                            <div className="font-medium text-gray-900">{item.category}</div>
                            <div className="text-xs text-gray-500">{item.description}</div>
                          </td>
                          <td className="py-2 text-right text-gray-600">
                            {(item.connectedVA / 1000).toFixed(2)} kVA
                          </td>
                          <td className="py-2 text-right text-gray-900">
                            {item.demandVA > 0 ? `${(item.demandVA / 1000).toFixed(2)} kVA` : '-'}
                          </td>
                          <td className="py-2 text-right text-gray-500">
                            {item.demandFactor > 0 ? `${(item.demandFactor * 100).toFixed(0)}%` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 font-bold">
                        <td className="pt-3">TOTAL</td>
                        <td className="pt-3 text-right">{(loadResult.totalConnectedVA / 1000).toFixed(2)} kVA</td>
                        <td className="pt-3 text-right text-[#2d3b2d]">{(loadResult.totalDemandVA / 1000).toFixed(2)} kVA</td>
                        <td className="pt-3 text-right">{(loadResult.demandFactor * 100).toFixed(1)}%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* NEC References */}
          {loadResult && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-700 mb-2">NEC References</h4>
              <ul className="text-xs text-gray-600 space-y-1">
                {loadResult.necReferences.map((ref, i) => (
                  <li key={i} className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    {ref}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Generated Panel Schedule Modal */}
      {showGenerated && generatedCircuits.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium">Generated Panel Schedule</h3>
              <button
                onClick={() => setShowGenerated(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-center">Breaker</th>
                    <th className="px-3 py-2 text-center">Poles</th>
                    <th className="px-3 py-2 text-right">Load (VA)</th>
                    <th className="px-3 py-2 text-center">Type</th>
                    <th className="px-3 py-2 text-left">NEC Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {generatedCircuits.map((circuit, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium">{circuit.description}</td>
                      <td className="px-3 py-2 text-center">{circuit.breakerAmps}A</td>
                      <td className="px-3 py-2 text-center">{circuit.pole}P</td>
                      <td className="px-3 py-2 text-right">{circuit.loadWatts.toLocaleString()}</td>
                      <td className="px-3 py-2 text-center">
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{circuit.loadType}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">{circuit.necReference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-between items-center bg-gray-50">
              <p className="text-sm text-gray-600">
                {generatedCircuits.length} circuits • 
                Total Load: {(generatedCircuits.reduce((sum, c) => sum + c.loadWatts, 0) / 1000).toFixed(1)} kVA
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowGenerated(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyToPanelSchedule}
                  className="px-4 py-2 bg-[#2d3b2d] text-white rounded-md hover:bg-[#3d4f3d] transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Apply to Panel Schedule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DwellingLoadCalculator;

