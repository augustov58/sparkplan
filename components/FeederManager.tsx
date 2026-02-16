/**
 * Feeder Manager Component
 * NEC Article 215 - Feeder Sizing and Management
 * Manages feeders between panels and transformers with automatic load calculations
 * 
 * Features:
 * - Automatic load calculation with NEC 220 demand factors
 * - Stale feeder detection when panel loads change
 * - Panel connectivity validation (prevents invalid feeder connections)
 * - Upstream load aggregation for cascaded panel systems
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Cable, Plus, Trash2, Edit2, Save, X, AlertTriangle, CheckCircle, RefreshCw, Info, Download } from 'lucide-react';
import { useFeeders } from '../hooks/useFeeders';
import { usePanels } from '../hooks/usePanels';
import { useTransformers } from '../hooks/useTransformers';
import { useCircuits } from '../hooks/useCircuits';
import { calculateFeederSizing } from '../services/calculations';
import { validateFeederForm, showValidationErrors } from '../lib/validation-utils';
import { validateFeederConnectivityEnhanced, getValidFeederDestinations, getValidPanelDestinationsFromTransformer } from '../services/validation/panelConnectivityValidation';
import { checkFeederLoadStatus, getStaleFeedersList } from '../services/feeder/feederLoadSync';
import { calculateAggregatedLoad } from '../services/calculations/upstreamLoadAggregation';
import { exportVoltageDropReport, hasVoltageDropData } from '../services/pdfExport/voltageDropPDF';
import type { Feeder, FeederCalculationResult } from '../types';

interface FeederManagerProps {
  projectId: string;
  projectVoltage: number;
  projectPhase: number;
  occupancyType?: 'dwelling' | 'commercial' | 'industrial';
}

export const FeederManager: React.FC<FeederManagerProps> = ({
  projectId,
  projectVoltage,
  projectPhase,
  occupancyType = 'commercial'
}) => {
  const { feeders, loading, error, createFeeder, updateFeeder, deleteFeeder } = useFeeders(projectId);
  const { panels } = usePanels(projectId);
  const { transformers } = useTransformers(projectId);
  const { circuits } = useCircuits(projectId);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Feeder>>({
    name: '',
    source_panel_id: null,
    source_transformer_id: null, // NEW: Support transformer as source
    destination_panel_id: null,
    destination_transformer_id: null,
    distance_ft: 100,
    conductor_material: 'Cu',
    conduit_type: 'PVC',
    ambient_temperature_c: 30,
    num_current_carrying: 4
  });
  const [sourceType, setSourceType] = useState<'panel' | 'transformer'>('panel'); // NEW: Source type toggle
  const [destinationType, setDestinationType] = useState<'panel' | 'transformer'>('panel');
  const [connectivityError, setConnectivityError] = useState<string | null>(null);
  const [showStaleWarning, setShowStaleWarning] = useState(true);
  
  // ISSUE FIX: Add sizing basis option - 'load' uses calculated panel load, 'capacity' uses panel max capacity
  const [sizingBasis, setSizingBasis] = useState<'load' | 'capacity'>('load');

  // Advanced calculation options
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [continuousLoadPercent, setContinuousLoadPercent] = useState(100); // % of load that is continuous (default 100% for capacity-based)
  const [temperatureRating, setTemperatureRating] = useState<60 | 75 | 90>(75); // Conductor insulation temperature rating

  // Detect stale feeders when circuit loads change
  // Note: Only applies to feeders sized based on calculated load (not max capacity)
  const staleFeeders = useMemo(() => {
    return getStaleFeedersList(feeders, circuits, panels, 5); // 5% threshold
  }, [feeders, circuits, panels]);

  // Get valid destination panels based on selected source (panel or transformer)
  const validDestinations = useMemo(() => {
    if (formData.source_panel_id) {
      return getValidFeederDestinations(formData.source_panel_id, panels, transformers);
    }
    if (formData.source_transformer_id) {
      return getValidPanelDestinationsFromTransformer(formData.source_transformer_id, panels, transformers);
    }
    return [];
  }, [formData.source_panel_id, formData.source_transformer_id, panels, transformers]);

  // Auto-generate feeder name when source and destination are selected
  useEffect(() => {
    // Only auto-generate if name is empty or was previously auto-generated
    // Skip if user has manually entered a custom name
    if (formData.name && !formData.name.includes('→')) return;

    let sourceName = '';
    let destName = '';

    // Get source name
    if (formData.source_panel_id) {
      const sourcePanel = panels.find(p => p.id === formData.source_panel_id);
      sourceName = sourcePanel?.name || '';
    } else if (formData.source_transformer_id) {
      const sourceTransformer = transformers.find(t => t.id === formData.source_transformer_id);
      sourceName = sourceTransformer?.name || '';
    }

    // Get destination name
    if (formData.destination_panel_id) {
      const destPanel = panels.find(p => p.id === formData.destination_panel_id);
      destName = destPanel?.name || '';
    } else if (formData.destination_transformer_id) {
      const destTransformer = transformers.find(t => t.id === formData.destination_transformer_id);
      destName = destTransformer?.name || '';
    }

    // Auto-generate name if both source and destination are selected
    if (sourceName && destName) {
      setFormData(prev => ({ ...prev, name: `${sourceName} → ${destName}` }));
    }
  }, [
    formData.source_panel_id,
    formData.source_transformer_id,
    formData.destination_panel_id,
    formData.destination_transformer_id,
    panels,
    transformers
  ]);

  // Validate connectivity when source or destination changes (enhanced for transformers)
  useEffect(() => {
    // Skip validation if no source or destination selected
    if (!formData.source_panel_id && !formData.source_transformer_id) {
      setConnectivityError(null);
      return;
    }
    if (!formData.destination_panel_id && !formData.destination_transformer_id) {
      setConnectivityError(null);
      return;
    }

    // Use enhanced validation that handles all four combinations
    const validation = validateFeederConnectivityEnhanced(
      formData.source_panel_id,
      formData.source_transformer_id,
      formData.destination_panel_id,
      formData.destination_transformer_id,
      panels,
      transformers
    );

    if (!validation.isConnected) {
      setConnectivityError(validation.message + (validation.technicalReason ? `\n\n${validation.technicalReason}` : ''));
    } else {
      setConnectivityError(null);
    }
  }, [
    formData.source_panel_id,
    formData.source_transformer_id,
    formData.destination_panel_id,
    formData.destination_transformer_id,
    panels,
    transformers
  ]);

  // Calculate loads for a destination panel (includes downstream aggregation per NEC 220.40)
  const calculatePanelLoads = (panelId: string) => {
    // Use aggregated load calculation to include downstream panels
    // Pass occupancyType for correct demand factor selection
    const aggregated = calculateAggregatedLoad(panelId, panels, circuits, transformers, occupancyType);
    
    // Calculate continuous vs non-continuous from direct circuits
    const panelCircuits = circuits.filter(c => c.panel_id === panelId);
    let continuousVA = 0;
    let noncontinuousVA = 0;

    panelCircuits.forEach(circuit => {
      const loadVA = circuit.load_watts || 0;
      // Assume circuits >20A or HVAC/Motor are continuous
      if (circuit.breaker_amps >= 20 || circuit.load_type === 'M' || circuit.load_type === 'H') {
        continuousVA += loadVA;
      } else {
        noncontinuousVA += loadVA;
      }
    });

    // Add downstream loads as non-continuous (already factored)
    noncontinuousVA += aggregated.downstreamPanelsDemandVA + aggregated.transformerLoadVA;

    return { 
      totalVA: aggregated.totalConnectedVA, 
      continuousVA, 
      noncontinuousVA,
      demandVA: aggregated.totalDemandVA,
      hasDownstreamLoads: aggregated.downstreamPanelCount > 0 || aggregated.transformerCount > 0,
      breakdown: aggregated.breakdown
    };
  };

  // Recalculate a stale feeder (always uses current load, not capacity)
  const handleRecalculateFeeder = async (feeder: Feeder) => {
    // For recalculation, we need to update the existing feeder, not create new
    // Temporarily set editingId, recalculate, then clear it
    const previousEditingId = editingId;
    const previousSizingBasis = sizingBasis;
    
    // Force load-based sizing for recalculation (since stale warning only applies to load-based)
    setSizingBasis('load');
    
    try {
      // Safety check: ensure panels and transformers are arrays
      if (!Array.isArray(panels) || panels.length === 0) {
        console.error('Cannot recalculate: panels data not available');
        return;
      }
      if (!Array.isArray(transformers)) {
        console.error('Cannot recalculate: transformers data not available');
        return;
      }

      // Check if destination is transformer or panel
      const isDestTransformer = !!feeder.destination_transformer_id;
      const destTransformer = isDestTransformer
        ? transformers.find(t => t.id === feeder.destination_transformer_id)
        : null;

      const destPanel = !isDestTransformer && feeder.destination_panel_id
        ? panels.find(p => p.id === feeder.destination_panel_id)
        : null;

      // Check if source is transformer or panel (NEW)
      const isSourceTransformer = !!feeder.source_transformer_id;
      const sourceTransformer = isSourceTransformer
        ? transformers.find(t => t.id === feeder.source_transformer_id)
        : null;

      const sourcePanel = !isSourceTransformer && feeder.source_panel_id
        ? panels.find(p => p.id === feeder.source_panel_id)
        : null;

      if (!sourcePanel && !sourceTransformer) {
        console.error('Cannot recalculate: source panel or transformer not found');
        return;
      }

      if (!destPanel && !destTransformer) {
        console.error('Cannot recalculate: destination panel or transformer not found');
        return;
      }

      // Calculate loads (only for panels, not transformers)
      const loads = destPanel
        ? calculatePanelLoads(feeder.destination_panel_id!)
        : { totalVA: 0, continuousVA: 0, noncontinuousVA: 0 };

      // Determine source voltage and phase (from panel OR transformer secondary)
      const sourceVoltage = sourceTransformer?.secondary_voltage || sourcePanel?.voltage || 480;
      const sourcePhase = sourceTransformer?.secondary_phase || sourcePanel?.phase || 3;

      // Calculate feeder sizing
      const result = calculateFeederSizing({
        source_voltage: sourceVoltage,
        source_phase: sourcePhase,
        destination_voltage: destPanel?.voltage || destTransformer?.secondary_voltage || sourceVoltage,
        destination_phase: destPanel?.phase || destTransformer?.secondary_phase || sourcePhase,
        total_load_va: loads.totalVA,
        continuous_load_va: loads.continuousVA,
        noncontinuous_load_va: loads.noncontinuousVA,
        distance_ft: feeder.distance_ft,
        conductor_material: feeder.conductor_material,
        ambient_temperature_c: feeder.ambient_temperature_c || 30,
        num_current_carrying: feeder.num_current_carrying || 4,
        max_voltage_drop_percent: 3,
        // Add transformer parameters if feeding a transformer
        ...(destTransformer && {
          transformer_kva: destTransformer.kva_rating,
          transformer_primary_voltage: destTransformer.primary_voltage,
          transformer_primary_phase: destTransformer.primary_phase
        })
      });

      // Get EGC based on OCPD (panel or transformer primary breaker)
      const ocpdAmps = destPanel
        ? (destPanel.main_breaker_amps || destPanel.feeder_breaker_amps || destPanel.bus_rating)
        : (destTransformer?.primary_breaker_amps || 0);
      const egcTable = [
        { maxOCPD: 15, cu: '14 AWG' }, { maxOCPD: 20, cu: '12 AWG' },
        { maxOCPD: 30, cu: '10 AWG' }, { maxOCPD: 40, cu: '10 AWG' },
        { maxOCPD: 60, cu: '10 AWG' }, { maxOCPD: 100, cu: '8 AWG' },
        { maxOCPD: 200, cu: '6 AWG' }, { maxOCPD: 300, cu: '4 AWG' },
        { maxOCPD: 400, cu: '3 AWG' }, { maxOCPD: 500, cu: '2 AWG' },
        { maxOCPD: 600, cu: '1 AWG' }, { maxOCPD: 800, cu: '1/0 AWG' },
        { maxOCPD: 1000, cu: '2/0 AWG' }, { maxOCPD: 1200, cu: '3/0 AWG' },
        { maxOCPD: 1600, cu: '4/0 AWG' }, { maxOCPD: 2000, cu: '250 kcmil' },
      ];
      const egcEntry = egcTable.find(row => ocpdAmps <= row.maxOCPD);
      const egcSize = egcEntry?.cu || result.egc_size;
      
      // Update feeder
      await updateFeeder(feeder.id, {
        total_load_va: loads.totalVA,
        continuous_load_va: loads.continuousVA,
        noncontinuous_load_va: loads.noncontinuousVA,
        design_load_va: result.design_load_va,
        phase_conductor_size: result.phase_conductor_size,
        neutral_conductor_size: result.neutral_conductor_size,
        egc_size: egcSize,
        conduit_size: result.recommended_conduit_size,
        voltage_drop_percent: result.voltage_drop_percent
      });
      
    } catch (err) {
      console.error('Failed to recalculate feeder:', err);
    } finally {
      // Restore previous state
      setSizingBasis(previousSizingBasis);
    }
  };

  // Calculate feeder and update database
  const handleCalculateFeeder = async (feeder: Partial<Feeder>) => {
    // Validate form data - ensure at least one source (panel OR transformer)
    const validation = validateFeederForm({
      name: feeder.name || '',
      source_panel_id: feeder.source_panel_id || feeder.source_transformer_id || '', // Accept either
      destination_panel_id: feeder.destination_panel_id,
      destination_transformer_id: feeder.destination_transformer_id,
      distance_ft: feeder.distance_ft || 0,
      conductor_material: feeder.conductor_material || 'Cu',
      conduit_type: feeder.conduit_type,
      ambient_temperature_c: feeder.ambient_temperature_c,
      num_current_carrying: feeder.num_current_carrying,
    });

    if (!validation.success) {
      showValidationErrors(validation.errors);
      return;
    }

    if (!feeder.destination_panel_id && !feeder.destination_transformer_id) return;
    if (!feeder.distance_ft || !feeder.conductor_material) return;

    try {
      // Safety check: ensure panels and transformers are arrays
      if (!Array.isArray(panels)) {
        console.error('Cannot calculate feeder: panels data not available');
        return;
      }
      if (!Array.isArray(transformers)) {
        console.error('Cannot calculate feeder: transformers data not available');
        return;
      }

      // Check if feeding a transformer or panel (destination)
      const isDestTransformer = !!feeder.destination_transformer_id;
      const destTransformer = isDestTransformer
        ? transformers.find(t => t.id === feeder.destination_transformer_id)
        : null;

      // Check if source is transformer or panel (NEW)
      const isSourceTransformer = !!feeder.source_transformer_id;
      const sourceTransformer = isSourceTransformer
        ? transformers.find(t => t.id === feeder.source_transformer_id)
        : null;

      // Get source and destination panels
      const sourcePanel = !isSourceTransformer && feeder.source_panel_id
        ? panels.find(p => p.id === feeder.source_panel_id)
        : null;
      const destPanel = !isDestTransformer && feeder.destination_panel_id
        ? panels.find(p => p.id === feeder.destination_panel_id)
        : null;

      // Determine source voltage and phase (from panel OR transformer secondary)
      const sourceVoltage = sourceTransformer?.secondary_voltage || sourcePanel?.voltage || projectVoltage;
      const sourcePhase = sourceTransformer?.secondary_phase || sourcePanel?.phase || projectPhase;

      // Determine destination voltage and phase
      const destVoltage = destPanel?.voltage || destTransformer?.secondary_voltage || projectVoltage;
      const destPhase = destPanel?.phase || destTransformer?.secondary_phase || projectPhase;

      // ISSUE FIX: Support both load-based and capacity-based sizing
      let loads: { totalVA: number; continuousVA: number; noncontinuousVA: number };

      if (sizingBasis === 'capacity') {
        // Use maximum capacity of destination (panel or transformer)
        // NOTE: For capacity-based sizing, we DO NOT apply the 125% continuous load multiplier
        // because we're sizing to match the panel's rating, not actual loads.
        // The panel's main breaker is the limiting factor - it can never deliver more than its rating.
        // Treating all capacity as "noncontinuous" ensures the feeder matches the panel's capacity exactly.
        if (destPanel) {
          // Use panel's maximum capacity (main breaker or bus rating)
          const panelCapacityAmps = destPanel.main_breaker_amps || destPanel.bus_rating;
          // Calculate VA from capacity: VA = A × V × √3 (for 3-phase) or VA = A × V (single-phase)
          const capacityVA = destPhase === 3
            ? panelCapacityAmps * destVoltage * Math.sqrt(3)
            : panelCapacityAmps * destVoltage;

          // Treat all as noncontinuous - no 125% multiplier applied
          // The feeder is sized to match the panel's maximum rated capacity
          loads = {
            totalVA: capacityVA,
            continuousVA: 0,
            noncontinuousVA: capacityVA
          };
        } else if (destTransformer) {
          // Use transformer's maximum capacity (kVA rating)
          const capacityVA = destTransformer.kva_rating * 1000;

          // Treat all as noncontinuous - feeder sized to match transformer's rated kVA
          loads = {
            totalVA: capacityVA,
            continuousVA: 0,
            noncontinuousVA: capacityVA
          };
        } else {
          loads = { totalVA: 0, continuousVA: 0, noncontinuousVA: 0 };
        }
      } else {
        // Use calculated loads based on destination type
        if (destPanel && feeder.destination_panel_id) {
          // Destination is a panel - use panel loads
          loads = calculatePanelLoads(feeder.destination_panel_id);
        } else if (destTransformer && feeder.destination_transformer_id) {
          // Destination is a transformer - calculate loads from secondary side panels
          const secondarySidePanels = panels.filter(
            p => p.fed_from_type === 'transformer' && p.fed_from_transformer_id === feeder.destination_transformer_id
          );

          if (secondarySidePanels.length > 0) {
            // Sum loads from all panels on the transformer's secondary side
            let totalVA = 0;
            let continuousVA = 0;
            let noncontinuousVA = 0;

            secondarySidePanels.forEach(panel => {
              const panelLoads = calculatePanelLoads(panel.id);
              totalVA += panelLoads.totalVA;
              continuousVA += panelLoads.continuousVA;
              noncontinuousVA += panelLoads.noncontinuousVA;
            });

            // If secondary panels have load, use it; otherwise default to transformer capacity
            if (totalVA > 0) {
              loads = { totalVA, continuousVA, noncontinuousVA };
            } else {
              // No load on secondary panels - default to transformer max capacity (as non-continuous)
              const transformerCapacityVA = destTransformer.kva_rating * 1000;
              loads = {
                totalVA: transformerCapacityVA,
                continuousVA: 0,
                noncontinuousVA: transformerCapacityVA
              };
            }
          } else {
            // No panels connected to transformer secondary - default to transformer max capacity
            const transformerCapacityVA = destTransformer.kva_rating * 1000;
            loads = {
              totalVA: transformerCapacityVA,
              continuousVA: 0,
              noncontinuousVA: transformerCapacityVA
            };
          }
        } else {
          loads = { totalVA: 0, continuousVA: 0, noncontinuousVA: 0 };
        }
      }

      // Calculate feeder sizing
      const result = calculateFeederSizing({
        source_voltage: sourceVoltage,
        source_phase: sourcePhase,
        destination_voltage: destVoltage,
        destination_phase: destPhase,
        total_load_va: loads.totalVA,
        continuous_load_va: loads.continuousVA,
        noncontinuous_load_va: loads.noncontinuousVA,
        distance_ft: feeder.distance_ft,
        conductor_material: feeder.conductor_material,
        ambient_temperature_c: feeder.ambient_temperature_c || 30,
        num_current_carrying: feeder.num_current_carrying || 4,
        max_voltage_drop_percent: 3,
        temperature_rating: temperatureRating, // Use user-specified temperature rating
        // Add transformer parameters if feeding a transformer
        ...(destTransformer && {
          transformer_kva: destTransformer.kva_rating,
          transformer_primary_voltage: destTransformer.primary_voltage,
          transformer_primary_phase: destTransformer.primary_phase
        })
      });
      
      // ISSUE FIX: EGC should be based on the OCPD protecting the downstream panel or transformer
      // per NEC 250.122 - use panel's main breaker or feeder breaker amps, or transformer primary breaker
      let egcSize = result.egc_size;
      const ocpdAmps = destPanel
        ? (destPanel.main_breaker_amps || destPanel.feeder_breaker_amps || destPanel.bus_rating)
        : (destTransformer?.primary_breaker_amps || 0);

      if (ocpdAmps > 0) {
        // Import EGC lookup from our inspection service logic
        const egcTable = [
          { maxOCPD: 15, cu: '14 AWG' }, { maxOCPD: 20, cu: '12 AWG' },
          { maxOCPD: 30, cu: '10 AWG' }, { maxOCPD: 40, cu: '10 AWG' },
          { maxOCPD: 60, cu: '10 AWG' }, { maxOCPD: 100, cu: '8 AWG' },
          { maxOCPD: 200, cu: '6 AWG' }, { maxOCPD: 300, cu: '4 AWG' },
          { maxOCPD: 400, cu: '3 AWG' }, { maxOCPD: 500, cu: '2 AWG' },
          { maxOCPD: 600, cu: '1 AWG' }, { maxOCPD: 800, cu: '1/0 AWG' },
          { maxOCPD: 1000, cu: '2/0 AWG' }, { maxOCPD: 1200, cu: '3/0 AWG' },
          { maxOCPD: 1600, cu: '4/0 AWG' }, { maxOCPD: 2000, cu: '250 kcmil' },
        ];
        const egcEntry = egcTable.find(row => ocpdAmps <= row.maxOCPD);
        if (egcEntry) {
          egcSize = egcEntry.cu;
        }
      }

      // Update feeder with calculation results
      const updatedFeeder = {
        ...feeder,
        total_load_va: loads.totalVA,
        continuous_load_va: loads.continuousVA,
        noncontinuous_load_va: loads.noncontinuousVA,
        design_load_va: result.design_load_va,
        phase_conductor_size: result.phase_conductor_size,
        neutral_conductor_size: result.neutral_conductor_size,
        egc_size: egcSize, // Use corrected EGC size based on panel OCPD per NEC 250.122
        conduit_size: result.recommended_conduit_size,
        voltage_drop_percent: result.voltage_drop_percent
      };

      if (editingId) {
        await updateFeeder(editingId, updatedFeeder);
        setEditingId(null);
      } else {
        await createFeeder({
          ...updatedFeeder,
          project_id: projectId
        } as Omit<Feeder, 'id' | 'created_at' | 'updated_at'>);
        setShowCreateForm(false);
        resetForm();
      }
    } catch (err) {
      console.error('Failed to calculate feeder:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      source_panel_id: null,
      source_transformer_id: null,
      destination_panel_id: null,
      destination_transformer_id: null,
      distance_ft: 100,
      conductor_material: 'Cu',
      conduit_type: 'PVC',
      ambient_temperature_c: 30,
      num_current_carrying: 4
    });
    setSourceType('panel');
    setDestinationType('panel');
  };

  const handleEdit = (feeder: Feeder) => {
    setFormData(feeder);
    setSourceType(feeder.source_panel_id ? 'panel' : 'transformer');
    setDestinationType(feeder.destination_panel_id ? 'panel' : 'transformer');
    setEditingId(feeder.id);
    setShowCreateForm(false);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this feeder? This action cannot be undone.')) {
      await deleteFeeder(id);
    }
  };

  const handleExportVoltageDropReport = async () => {
    try {
      // Get project name from first panel or use default
      const projectName = panels.length > 0 ? `Project ${projectId.substring(0, 8)}` : 'Electrical Project';
      const projectAddress = ''; // Could be passed as prop if available

      await exportVoltageDropReport(
        projectName,
        feeders,
        panels,
        transformers,
        projectAddress,
        true // Include NEC references
      );
    } catch (error) {
      console.error('Failed to export voltage drop report:', error);
      alert(`Failed to export voltage drop report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (loading) {
    return <div className="text-gray-500">Loading feeders...</div>;
  }

  if (error) {
    return <div className="text-red-600">Error: {error}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stale Feeders Warning Banner */}
      {staleFeeders.length > 0 && showStaleWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-amber-800">
                  {staleFeeders.length} Feeder{staleFeeders.length > 1 ? 's' : ''} Need Recalculation
                </h4>
                <p className="text-sm text-amber-700 mt-1">
                  Panel loads have changed since these feeders were calculated. Click the refresh button to update.
                </p>
                <ul className="mt-2 space-y-1">
                  {staleFeeders.map(sf => (
                    <li key={sf.feederId} className="text-sm text-amber-700 flex items-center gap-2">
                      <span className="font-medium">{sf.feederName}:</span>
                      <span>
                        {sf.cachedConnectedVA.toLocaleString()} VA → {sf.currentConnectedVA.toLocaleString()} VA
                        ({sf.loadDifferencePercent > 0 ? '+' : ''}{sf.loadDifferencePercent}%)
                      </span>
                      <button
                        onClick={() => {
                          const feeder = feeders.find(f => f.id === sf.feederId);
                          if (feeder) handleRecalculateFeeder(feeder);
                        }}
                        className="p-1 text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded"
                        title="Recalculate feeder"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <button
              onClick={() => setShowStaleWarning(false)}
              className="text-amber-600 hover:text-amber-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Cable className="w-5 h-5 text-electric-500" />
            Feeder Sizing (NEC Article 215)
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Manage feeders between panels and transformers
          </p>
          {/* Debug info for voltage drop export */}
          {feeders.length > 0 && !hasVoltageDropData(feeders) && (
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Voltage drop export requires at least one feeder with length and calculated load.
              {' '}({feeders.filter(f => f.distance_ft && f.distance_ft > 0).length} of {feeders.length} have length,
              {' '}{feeders.filter(f => f.total_load_va && f.total_load_va > 0).length} of {feeders.length} have load)
            </p>
          )}
        </div>
        {!showCreateForm && !editingId && (
          <div className="flex items-center gap-2">
            {/* Export Voltage Drop Report Button */}
            {feeders.length > 0 && (
              <button
                onClick={handleExportVoltageDropReport}
                disabled={!hasVoltageDropData(feeders)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                  hasVoltageDropData(feeders)
                    ? 'bg-gray-700 text-white hover:bg-gray-800'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                title={
                  hasVoltageDropData(feeders)
                    ? 'Export voltage drop analysis report (PDF)'
                    : 'Add length and load data to feeders to enable export'
                }
              >
                <Download className="w-4 h-4" />
                Export Voltage Drop Report
              </button>
            )}

            {/* Add Feeder Button */}
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-electric-500 text-white rounded-lg hover:bg-electric-600 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Feeder
            </button>
          </div>
        )}
      </div>

      {/* Create/Edit Form */}
      {(showCreateForm || editingId) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h4 className="font-bold text-gray-900 mb-4">
            {editingId ? 'Edit Feeder' : 'Create New Feeder'}
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                Feeder Name
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., MDP to Panel 2"
                className="w-full border-gray-200 rounded-md focus:border-electric-500 focus:ring-electric-500 text-sm py-2"
              />
            </div>

            {/* Source Type Toggle */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                Source Type
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSourceType('panel');
                    setFormData({ ...formData, source_transformer_id: null });
                  }}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    sourceType === 'panel'
                      ? 'bg-electric-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Panel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSourceType('transformer');
                    setFormData({ ...formData, source_panel_id: null });
                  }}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    sourceType === 'transformer'
                      ? 'bg-electric-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Transformer
                </button>
              </div>
            </div>

            {/* Source Selection */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                {sourceType === 'panel' ? 'Source Panel' : 'Source Transformer'}
              </label>
              {sourceType === 'panel' ? (
                <select
                  value={formData.source_panel_id || ''}
                  onChange={e => setFormData({ ...formData, source_panel_id: e.target.value || null })}
                  className="w-full border-gray-200 rounded-md focus:border-electric-500 focus:ring-electric-500 text-sm py-2"
                >
                  <option value="">Select Source Panel</option>
                  {panels.map(panel => (
                    <option key={panel.id} value={panel.id}>
                      {panel.name} ({panel.voltage}V, {panel.phase}φ)
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={formData.source_transformer_id || ''}
                  onChange={e => setFormData({ ...formData, source_transformer_id: e.target.value || null })}
                  className="w-full border-gray-200 rounded-md focus:border-electric-500 focus:ring-electric-500 text-sm py-2"
                >
                  <option value="">Select Source Transformer</option>
                  {transformers.map(xfmr => (
                    <option key={xfmr.id} value={xfmr.id}>
                      {xfmr.name} ({xfmr.kva_rating}kVA, {xfmr.primary_voltage}V → {xfmr.secondary_voltage}V)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Destination Type Toggle */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                Destination Type
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setDestinationType('panel');
                    setFormData({ ...formData, destination_transformer_id: null });
                  }}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    destinationType === 'panel'
                      ? 'bg-electric-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Panel
                </button>
                <button
                  onClick={() => {
                    setDestinationType('transformer');
                    setFormData({ ...formData, destination_panel_id: null });
                  }}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    destinationType === 'transformer'
                      ? 'bg-electric-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Transformer
                </button>
              </div>
            </div>

            {/* Destination Selection */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                {destinationType === 'panel' ? 'Destination Panel' : 'Destination Transformer'}
              </label>
              {destinationType === 'panel' ? (
                <>
                  <select
                    value={formData.destination_panel_id || ''}
                    onChange={e => setFormData({ ...formData, destination_panel_id: e.target.value || null })}
                    className={`w-full rounded-md focus:border-electric-500 focus:ring-electric-500 text-sm py-2 ${
                      connectivityError ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`}
                    disabled={!formData.source_panel_id && !formData.source_transformer_id}
                  >
                    <option value="">
                      {(formData.source_panel_id || formData.source_transformer_id) ? 'Select Destination Panel' : 'Select source first'}
                    </option>
                    {(formData.source_panel_id || formData.source_transformer_id) && panels
                      .filter(p => p.id !== formData.source_panel_id)
                      .map(panel => {
                        const isValid = validDestinations.some(vd => vd.id === panel.id);
                        return (
                          <option 
                            key={panel.id} 
                            value={panel.id}
                            disabled={!isValid}
                            className={!isValid ? 'text-gray-400' : ''}
                          >
                            {panel.name} ({panel.voltage}V, {panel.phase}φ)
                            {!isValid ? ' ⚠ Not connected' : ''}
                          </option>
                        );
                      })}
                  </select>
                  {/* Connectivity helper text */}
                  {(formData.source_panel_id || formData.source_transformer_id) && validDestinations.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      {formData.source_transformer_id
                        ? 'No panels are fed from this transformer. Check that panels have this transformer set as their source.'
                        : 'No panels are directly connected to this source. Panels must be on the same electrical branch.'}
                    </p>
                  )}
                </>
              ) : (
                <select
                  value={formData.destination_transformer_id || ''}
                  onChange={e => setFormData({ ...formData, destination_transformer_id: e.target.value || null })}
                  className="w-full border-gray-200 rounded-md focus:border-electric-500 focus:ring-electric-500 text-sm py-2"
                >
                  <option value="">Select Destination Transformer</option>
                  {transformers.map(xfmr => (
                    <option key={xfmr.id} value={xfmr.id}>
                      {xfmr.name} ({xfmr.kva_rating}kVA, {xfmr.primary_voltage}V → {xfmr.secondary_voltage}V)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Connectivity Error Display */}
            {connectivityError && (
              <div className="md:col-span-2 bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-red-700 whitespace-pre-wrap">
                    {connectivityError}
                  </div>
                </div>
              </div>
            )}

            {/* ISSUE FIX: Sizing Basis Toggle */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                Sizing Basis
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSizingBasis('load')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    sizingBasis === 'load'
                      ? 'bg-electric-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Calculated Load
                </button>
                <button
                  onClick={() => setSizingBasis('capacity')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    sizingBasis === 'capacity'
                      ? 'bg-electric-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Panel Max Capacity
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <Info className="w-3 h-3" />
                {sizingBasis === 'load'
                  ? 'Size feeder based on actual connected loads with NEC demand factors.'
                  : 'Size feeder based on destination max capacity (panel main breaker/bus rating or transformer kVA).'}
              </p>
            </div>

            {/* Distance */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                Distance (ft)
              </label>
              <input
                type="number"
                value={formData.distance_ft || 100}
                onChange={e => setFormData({ ...formData, distance_ft: Number(e.target.value) })}
                className="w-full border-gray-200 rounded-md focus:border-electric-500 focus:ring-electric-500 text-sm py-2"
              />
            </div>

            {/* Conductor Material */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                Conductor Material
              </label>
              <select
                value={formData.conductor_material || 'Cu'}
                onChange={e => setFormData({ ...formData, conductor_material: e.target.value as 'Cu' | 'Al' })}
                className="w-full border-gray-200 rounded-md focus:border-electric-500 focus:ring-electric-500 text-sm py-2"
              >
                <option value="Cu">Copper (Cu)</option>
                <option value="Al">Aluminum (Al)</option>
              </select>
            </div>

            {/* Ambient Temperature */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                Ambient Temperature (°C)
              </label>
              <input
                type="number"
                value={formData.ambient_temperature_c || 30}
                onChange={e => setFormData({ ...formData, ambient_temperature_c: Number(e.target.value) })}
                className="w-full border-gray-200 rounded-md focus:border-electric-500 focus:ring-electric-500 text-sm py-2"
              />
            </div>

            {/* Current Carrying Conductors */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                Current-Carrying Conductors
              </label>
              <input
                type="number"
                value={formData.num_current_carrying || 4}
                onChange={e => setFormData({ ...formData, num_current_carrying: Number(e.target.value) })}
                className="w-full border-gray-200 rounded-md focus:border-electric-500 focus:ring-electric-500 text-sm py-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Affects bundling adjustment (NEC 310.15(C)(1))
              </p>
            </div>

            {/* Advanced Options Toggle */}
            <div className="md:col-span-2">
              <button
                type="button"
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className="flex items-center gap-2 text-sm text-electric-600 hover:text-electric-700 font-medium"
              >
                {showAdvancedOptions ? '▼' : '▶'} Advanced Calculation Options
              </button>
            </div>

            {/* Advanced Options Section */}
            {showAdvancedOptions && (
              <>
                {/* Temperature Rating */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                    Insulation Temperature Rating
                  </label>
                  <select
                    value={temperatureRating}
                    onChange={e => setTemperatureRating(Number(e.target.value) as 60 | 75 | 90)}
                    className="w-full border-gray-200 rounded-md focus:border-electric-500 focus:ring-electric-500 text-sm py-2"
                  >
                    <option value={60}>60°C (THHN, TW)</option>
                    <option value={75}>75°C (THWN, XHHW)</option>
                    <option value={90}>90°C (THHN, XHHW-2)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Higher ratings allow smaller conductors
                  </p>
                </div>

                {/* Continuous Load Percentage (only for load-based sizing) */}
                {sizingBasis === 'load' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                      Continuous Load Percentage
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="10"
                        value={continuousLoadPercent}
                        onChange={e => setContinuousLoadPercent(Number(e.target.value))}
                        className="flex-1"
                      />
                      <span className="text-sm font-medium w-12 text-right">{continuousLoadPercent}%</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      % of calculated load that operates continuously (&gt;3 hrs). Continuous loads get 125% multiplier (NEC 215.2(A)(1))
                    </p>
                  </div>
                )}

                {/* Capacity-based sizing explanation */}
                {sizingBasis === 'capacity' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                      <div className="text-xs text-blue-700">
                        <p className="font-semibold">Capacity-Based Sizing</p>
                        <p className="mt-1">
                          Feeder is sized to match the destination's maximum rated capacity (main breaker or kVA rating).
                          No 125% continuous load multiplier is applied because the panel's breaker is the limiting factor -
                          it can never deliver more than its rated capacity.
                        </p>
                        <p className="mt-1 italic">
                          Use this when you want to future-proof the feeder for the panel's full capacity regardless of current loads.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Info box explaining the calculation */}
                <div className="md:col-span-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-gray-600 mt-0.5 shrink-0" />
                    <div className="text-xs text-gray-700 space-y-1">
                      <p className="font-semibold">Derating Factors Applied:</p>
                      <ul className="list-disc ml-4 space-y-1">
                        {sizingBasis === 'load' && (
                          <li>
                            <strong>Continuous load (125%):</strong> {continuousLoadPercent}% of load treated as continuous (NEC 215.2(A)(1))
                          </li>
                        )}
                        <li>
                          <strong>Bundling adjustment:</strong> {formData.num_current_carrying || 4} conductors = {
                            (formData.num_current_carrying || 4) <= 3 ? '100%' :
                            (formData.num_current_carrying || 4) <= 6 ? '80%' :
                            (formData.num_current_carrying || 4) <= 9 ? '70%' :
                            (formData.num_current_carrying || 4) <= 20 ? '50%' : '45%'
                          } (NEC 310.15(C)(1))
                        </li>
                        <li>
                          <strong>Temperature correction:</strong> {formData.ambient_temperature_c || 30}°C ambient @ {temperatureRating}°C insulation rating
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => handleCalculateFeeder(formData)}
              disabled={
                !formData.name ||
                (!formData.source_panel_id && !formData.source_transformer_id) ||
                (!formData.destination_panel_id && !formData.destination_transformer_id) ||
                !!connectivityError
              }
              className="flex items-center gap-2 px-4 py-2 bg-electric-500 text-white rounded-lg hover:bg-electric-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              title={connectivityError ? 'Cannot save: panels are not properly connected' : undefined}
            >
              <Save className="w-4 h-4" />
              Calculate & Save
            </button>
            <button
              onClick={() => {
                if (editingId) {
                  handleCancelEdit();
                } else {
                  setShowCreateForm(false);
                  resetForm();
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Feeders List */}
      {feeders.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <Cable className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No feeders yet. Click "Add Feeder" to create one.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {feeders.map(feeder => {
            const staleStatus = checkFeederLoadStatus(feeder, circuits, panels, 5);
            return (
              <FeederCard
                key={feeder.id}
                feeder={feeder}
                panels={panels || []}
                transformers={transformers || []}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onRecalculate={handleRecalculateFeeder}
                isEditing={editingId === feeder.id}
                staleStatus={staleStatus}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

// Feeder Card Component
interface FeederCardProps {
  feeder: Feeder;
  panels?: any[];
  transformers?: any[];
  onEdit: (feeder: Feeder) => void;
  onDelete: (id: string) => void;
  onRecalculate: (feeder: Feeder) => void;
  isEditing: boolean;
  staleStatus: {
    isStale: boolean;
    currentConnectedVA: number;
    cachedConnectedVA: number;
    loadDifferencePercent: number;
    message: string;
  };
}

const FeederCard: React.FC<FeederCardProps> = ({
  feeder,
  panels = [],
  transformers = [],
  onEdit,
  onDelete,
  onRecalculate,
  isEditing,
  staleStatus
}) => {
  // Safety check: ensure panels and transformers are arrays (defensive programming)
  const panelsArray = Array.isArray(panels) ? panels : [];
  const transformersArray = Array.isArray(transformers) ? transformers : [];

  const sourcePanel = panelsArray.find(p => p.id === feeder.source_panel_id);
  const sourceTransformer = transformersArray.find(t => t.id === feeder.source_transformer_id); // NEW
  const destPanel = panelsArray.find(p => p.id === feeder.destination_panel_id);
  const destTransformer = transformersArray.find(t => t.id === feeder.destination_transformer_id);

  // Build source and destination labels
  const sourceLabel = sourcePanel?.name || sourceTransformer?.name || 'Unknown';
  const destLabel = destPanel?.name || destTransformer?.name || 'Unknown';

  const vdCompliant = (feeder.voltage_drop_percent || 0) <= 3.0;

  return (
    <div className={`bg-white border rounded-lg p-3 ${
      isEditing ? 'border-electric-500 border-2' :
      staleStatus.isStale ? 'border-amber-300 border-2' :
      'border-gray-200'
    }`}>
      {/* Stale Warning Badge - Compact */}
      {staleStatus.isStale && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mb-2 text-xs">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-amber-800">
              Load: {staleStatus.cachedConnectedVA.toLocaleString()} → {staleStatus.currentConnectedVA.toLocaleString()} VA
              ({staleStatus.loadDifferencePercent > 0 ? '+' : ''}{staleStatus.loadDifferencePercent}%)
            </span>
          </div>
          <button
            onClick={() => onRecalculate(feeder)}
            className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded hover:bg-amber-200 transition-colors font-medium"
          >
            <RefreshCw className="w-3 h-3" />
            Recalc
          </button>
        </div>
      )}

      {/* Header - Compact single row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <h4 className="font-semibold text-gray-900 truncate">
            {feeder.name}
          </h4>
          <span className="text-xs text-gray-500 shrink-0">
            {sourceLabel} → {destLabel}
          </span>
          {staleStatus.isStale && (
            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full shrink-0">
              Outdated
            </span>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => onRecalculate(feeder)}
            className="p-1.5 text-gray-400 hover:text-electric-600 hover:bg-electric-50 rounded transition-colors"
            title="Recalculate"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onEdit(feeder)}
            className="p-1.5 text-gray-400 hover:text-electric-600 hover:bg-electric-50 rounded transition-colors"
            title="Edit"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(feeder.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Results Grid - Compact inline */}
      {feeder.phase_conductor_size && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mb-2">
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Phase:</span>
            <span className="font-semibold text-gray-900">{feeder.phase_conductor_size}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Neutral:</span>
            <span className="font-semibold text-gray-900">{feeder.neutral_conductor_size}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-green-700">EGC:</span>
            <span className="font-semibold text-green-800">{feeder.egc_size}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Conduit:</span>
            <span className="font-semibold text-gray-900">{feeder.conduit_size}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Dist:</span>
            <span className="font-semibold text-gray-900">{feeder.distance_ft} ft</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500">{feeder.conductor_material === 'Cu' ? 'Cu' : 'Al'}</span>
          </div>
          {feeder.design_load_va && (
            <div className="flex items-center gap-1">
              <span className="text-gray-500">Load:</span>
              <span className="font-semibold text-gray-900">{(feeder.design_load_va / 1000).toFixed(1)} kVA</span>
            </div>
          )}
        </div>
      )}

      {/* Voltage Drop Indicator - Compact */}
      {feeder.voltage_drop_percent != null && (
        <div className={`flex items-center justify-between px-2 py-1.5 rounded text-xs ${
          vdCompliant ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center gap-1.5">
            {vdCompliant ? (
              <CheckCircle className="w-3.5 h-3.5 text-green-600" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
            )}
            <span className={`font-medium ${vdCompliant ? 'text-green-900' : 'text-red-900'}`}>
              VD: {feeder.voltage_drop_percent.toFixed(2)}%
            </span>
          </div>
          <span className={vdCompliant ? 'text-green-600' : 'text-red-600'}>
            {vdCompliant ? '≤3% OK' : '>3% High'}
          </span>
        </div>
      )}
    </div>
  );
};
