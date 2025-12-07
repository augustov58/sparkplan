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
import { Cable, Plus, Trash2, Edit2, Save, X, AlertTriangle, CheckCircle, RefreshCw, Info } from 'lucide-react';
import { useFeeders } from '../hooks/useFeeders';
import { usePanels } from '../hooks/usePanels';
import { useTransformers } from '../hooks/useTransformers';
import { useCircuits } from '../hooks/useCircuits';
import { calculateFeederSizing } from '../services/calculations';
import { validateFeederForm, showValidationErrors } from '../lib/validation-utils';
import { validateFeederConnectivity, getValidFeederDestinations } from '../services/validation/panelConnectivityValidation';
import { checkFeederLoadStatus, getStaleFeedersList } from '../services/feeder/feederLoadSync';
import { calculateAggregatedLoad } from '../services/calculations/upstreamLoadAggregation';
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
    destination_panel_id: null,
    destination_transformer_id: null,
    distance_ft: 100,
    conductor_material: 'Cu',
    conduit_type: 'PVC',
    ambient_temperature_c: 30,
    num_current_carrying: 4
  });
  const [destinationType, setDestinationType] = useState<'panel' | 'transformer'>('panel');
  const [connectivityError, setConnectivityError] = useState<string | null>(null);
  const [showStaleWarning, setShowStaleWarning] = useState(true);
  
  // ISSUE FIX: Add sizing basis option - 'load' uses calculated panel load, 'capacity' uses panel max capacity
  const [sizingBasis, setSizingBasis] = useState<'load' | 'capacity'>('load');

  // Detect stale feeders when circuit loads change
  // Note: Only applies to feeders sized based on calculated load (not max capacity)
  const staleFeeders = useMemo(() => {
    return getStaleFeedersList(feeders, circuits, panels, 5); // 5% threshold
  }, [feeders, circuits, panels]);

  // Get valid destination panels based on selected source
  const validDestinations = useMemo(() => {
    if (!formData.source_panel_id) return [];
    return getValidFeederDestinations(formData.source_panel_id, panels, transformers);
  }, [formData.source_panel_id, panels, transformers]);

  // Validate connectivity when destination changes
  useEffect(() => {
    if (formData.source_panel_id && formData.destination_panel_id) {
      const validation = validateFeederConnectivity(
        formData.source_panel_id,
        formData.destination_panel_id,
        panels,
        transformers
      );
      if (!validation.isConnected) {
        setConnectivityError(validation.message + (validation.technicalReason ? `\n\n${validation.technicalReason}` : ''));
      } else {
        setConnectivityError(null);
      }
    } else {
      setConnectivityError(null);
    }
  }, [formData.source_panel_id, formData.destination_panel_id, panels, transformers]);

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
      // Use updateFeeder directly with recalculated values
      const destPanel = panels.find(p => p.id === feeder.destination_panel_id);
      const sourcePanel = panels.find(p => p.id === feeder.source_panel_id);
      
      if (!destPanel || !sourcePanel) {
        console.error('Cannot recalculate: source or destination panel not found');
        return;
      }
      
      // Calculate loads
      const loads = calculatePanelLoads(feeder.destination_panel_id!);
      
      // Calculate feeder sizing
      const result = calculateFeederSizing({
        source_voltage: sourcePanel.voltage,
        source_phase: sourcePanel.phase,
        destination_voltage: destPanel.voltage,
        destination_phase: destPanel.phase,
        total_load_va: loads.totalVA,
        continuous_load_va: loads.continuousVA,
        noncontinuous_load_va: loads.noncontinuousVA,
        distance_ft: feeder.distance_ft,
        conductor_material: feeder.conductor_material,
        ambient_temperature_c: feeder.ambient_temperature_c || 30,
        num_current_carrying: feeder.num_current_carrying || 4,
        max_voltage_drop_percent: 3
      });
      
      // Get EGC based on panel OCPD
      const ocpdAmps = destPanel.main_breaker_amps || destPanel.feeder_breaker_amps || destPanel.bus_rating;
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
    // Validate form data
    const validation = validateFeederForm({
      name: feeder.name || '',
      source_panel_id: feeder.source_panel_id || '',
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
      // Get source and destination panels
      const sourcePanel = panels.find(p => p.id === feeder.source_panel_id);
      const destPanel = feeder.destination_panel_id
        ? panels.find(p => p.id === feeder.destination_panel_id)
        : null;

      const sourceVoltage = sourcePanel?.voltage || projectVoltage;
      const sourcePhase = sourcePanel?.phase || projectPhase;
      const destVoltage = destPanel?.voltage || projectVoltage;
      const destPhase = destPanel?.phase || projectPhase;

      // ISSUE FIX: Support both load-based and capacity-based sizing
      let loads: { totalVA: number; continuousVA: number; noncontinuousVA: number };
      
      if (sizingBasis === 'capacity' && destPanel) {
        // Use panel's maximum capacity (main breaker or bus rating)
        const panelCapacityAmps = destPanel.main_breaker_amps || destPanel.bus_rating;
        // Calculate VA from capacity: VA = A × V × √3 (for 3-phase) or VA = A × V (single-phase)
        const capacityVA = destPhase === 3 
          ? panelCapacityAmps * destVoltage * Math.sqrt(3)
          : panelCapacityAmps * destVoltage;
        
        loads = {
          totalVA: capacityVA,
          continuousVA: capacityVA, // Assume 100% continuous for capacity-based sizing
          noncontinuousVA: 0
        };
      } else {
        // Use calculated panel loads (existing behavior)
        loads = feeder.destination_panel_id
          ? calculatePanelLoads(feeder.destination_panel_id)
          : { totalVA: 0, continuousVA: 0, noncontinuousVA: 0 };
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
        max_voltage_drop_percent: 3
      });
      
      // ISSUE FIX: EGC should be based on the OCPD protecting the downstream panel
      // per NEC 250.122 - use panel's main breaker or feeder breaker amps
      let egcSize = result.egc_size;
      if (destPanel) {
        const ocpdAmps = destPanel.main_breaker_amps || destPanel.feeder_breaker_amps || destPanel.bus_rating;
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
      destination_panel_id: null,
      destination_transformer_id: null,
      distance_ft: 100,
      conductor_material: 'Cu',
      conduit_type: 'PVC',
      ambient_temperature_c: 30,
      num_current_carrying: 4
    });
    setDestinationType('panel');
  };

  const handleEdit = (feeder: Feeder) => {
    setFormData(feeder);
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
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Cable className="w-5 h-5 text-electric-500" />
            Feeder Sizing (NEC Article 215)
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Manage feeders between panels and transformers
          </p>
        </div>
        {!showCreateForm && !editingId && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-electric-500 text-white rounded-lg hover:bg-electric-600 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Feeder
          </button>
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

            {/* Source Panel */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                Source Panel
              </label>
              <select
                value={formData.source_panel_id || ''}
                onChange={e => setFormData({ ...formData, source_panel_id: e.target.value || null })}
                className="w-full border-gray-200 rounded-md focus:border-electric-500 focus:ring-electric-500 text-sm py-2"
              >
                <option value="">Select Source Panel</option>
                {panels.map(panel => (
                  <option key={panel.id} value={panel.id}>
                    {panel.name} ({panel.voltage}V, {panel.phase}-phase)
                  </option>
                ))}
              </select>
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
                    disabled={!formData.source_panel_id}
                  >
                    <option value="">
                      {formData.source_panel_id ? 'Select Destination Panel' : 'Select source panel first'}
                    </option>
                    {formData.source_panel_id && panels
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
                  {formData.source_panel_id && validDestinations.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      No panels are directly connected to this source. Panels must be on the same electrical branch.
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
                  : 'Size feeder based on panel main breaker or bus rating (full capacity).'}
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
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => handleCalculateFeeder(formData)}
              disabled={
                !formData.name || 
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
            const staleStatus = checkFeederLoadStatus(feeder, circuits, 5);
            return (
              <FeederCard
                key={feeder.id}
                feeder={feeder}
                panels={panels}
                transformers={transformers}
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
  panels: any[];
  transformers: any[];
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
  panels,
  transformers,
  onEdit,
  onDelete,
  onRecalculate,
  isEditing,
  staleStatus
}) => {
  const sourcePanel = panels.find(p => p.id === feeder.source_panel_id);
  const destPanel = panels.find(p => p.id === feeder.destination_panel_id);
  const destTransformer = transformers.find(t => t.id === feeder.destination_transformer_id);

  const vdCompliant = (feeder.voltage_drop_percent || 0) <= 3.0;

  return (
    <div className={`bg-white border rounded-lg p-6 ${
      isEditing ? 'border-electric-500 border-2' : 
      staleStatus.isStale ? 'border-amber-300 border-2' : 
      'border-gray-200'
    }`}>
      {/* Stale Warning Badge */}
      {staleStatus.isStale && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm text-amber-800">
              Load changed: {staleStatus.cachedConnectedVA.toLocaleString()} VA → {staleStatus.currentConnectedVA.toLocaleString()} VA 
              ({staleStatus.loadDifferencePercent > 0 ? '+' : ''}{staleStatus.loadDifferencePercent}%)
            </span>
          </div>
          <button
            onClick={() => onRecalculate(feeder)}
            className="flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 rounded hover:bg-amber-200 transition-colors text-sm font-medium"
          >
            <RefreshCw className="w-3 h-3" />
            Recalculate
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="font-bold text-gray-900 text-lg flex items-center gap-2">
            {feeder.name}
            {staleStatus.isStale && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                Outdated
              </span>
            )}
          </h4>
          <p className="text-sm text-gray-500 mt-1">
            {sourcePanel?.name || 'Unknown'} → {destPanel?.name || destTransformer?.name || 'Unknown'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onRecalculate(feeder)}
            className="p-2 text-gray-500 hover:text-electric-600 hover:bg-electric-50 rounded transition-colors"
            title="Recalculate feeder sizing"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(feeder)}
            className="p-2 text-gray-500 hover:text-electric-600 hover:bg-electric-50 rounded transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(feeder.id)}
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Results Grid */}
      {feeder.phase_conductor_size && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-gray-50 rounded p-3">
            <div className="text-xs text-gray-500 mb-1">Phase Conductor</div>
            <div className="font-bold text-gray-900">{feeder.phase_conductor_size} AWG</div>
          </div>
          <div className="bg-gray-50 rounded p-3">
            <div className="text-xs text-gray-500 mb-1">Neutral</div>
            <div className="font-bold text-gray-900">{feeder.neutral_conductor_size} AWG</div>
          </div>
          <div className="bg-green-50 rounded p-3">
            <div className="text-xs text-green-700 mb-1">EGC</div>
            <div className="font-bold text-green-900">{feeder.egc_size} AWG</div>
          </div>
          <div className="bg-gray-50 rounded p-3">
            <div className="text-xs text-gray-500 mb-1">Conduit</div>
            <div className="font-bold text-gray-900">{feeder.conduit_size}</div>
          </div>
        </div>
      )}

      {/* Voltage Drop Indicator */}
      {feeder.voltage_drop_percent !== undefined && (
        <div className={`flex items-center justify-between p-3 rounded ${
          vdCompliant ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {vdCompliant ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600" />
            )}
            <span className={`text-sm font-medium ${vdCompliant ? 'text-green-900' : 'text-red-900'}`}>
              Voltage Drop: {feeder.voltage_drop_percent.toFixed(2)}%
            </span>
          </div>
          <span className={`text-xs ${vdCompliant ? 'text-green-600' : 'text-red-600'}`}>
            {vdCompliant ? '≤3% (Compliant)' : '>3% (Exceeds NEC Recommendation)'}
          </span>
        </div>
      )}

      {/* Details */}
      <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Distance:</span>
          <span className="ml-2 font-semibold text-gray-900">{feeder.distance_ft} ft</span>
        </div>
        <div>
          <span className="text-gray-500">Material:</span>
          <span className="ml-2 font-semibold text-gray-900">
            {feeder.conductor_material === 'Cu' ? 'Copper' : 'Aluminum'}
          </span>
        </div>
        {feeder.design_load_va && (
          <div>
            <span className="text-gray-500">Design Load:</span>
            <span className="ml-2 font-semibold text-gray-900">
              {(feeder.design_load_va / 1000).toFixed(1)} kVA
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
