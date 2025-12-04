/**
 * Feeder Manager Component
 * NEC Article 215 - Feeder Sizing and Management
 * Manages feeders between panels and transformers with automatic load calculations
 */

import React, { useState } from 'react';
import { Cable, Plus, Trash2, Edit2, Save, X, AlertTriangle, CheckCircle } from 'lucide-react';
import { useFeeders } from '../hooks/useFeeders';
import { usePanels } from '../hooks/usePanels';
import { useTransformers } from '../hooks/useTransformers';
import { useCircuits } from '../hooks/useCircuits';
import { calculateFeederSizing } from '../services/calculations';
import { validateFeederForm, showValidationErrors } from '../lib/validation-utils';
import type { Feeder, FeederCalculationResult } from '../types';

interface FeederManagerProps {
  projectId: string;
  projectVoltage: number;
  projectPhase: number;
}

export const FeederManager: React.FC<FeederManagerProps> = ({
  projectId,
  projectVoltage,
  projectPhase
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

  // Calculate loads for a destination panel
  const calculatePanelLoads = (panelId: string) => {
    const panelCircuits = circuits.filter(c => c.panel_id === panelId);

    let totalVA = 0;
    let continuousVA = 0;
    let noncontinuousVA = 0;

    panelCircuits.forEach(circuit => {
      const loadVA = circuit.load_watts || 0;
      totalVA += loadVA;

      // Assume circuits >20A or HVAC are continuous
      if (circuit.breaker_amps >= 20) {
        continuousVA += loadVA;
      } else {
        noncontinuousVA += loadVA;
      }
    });

    return { totalVA, continuousVA, noncontinuousVA };
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
      // Get loads from destination panel
      const loads = feeder.destination_panel_id
        ? calculatePanelLoads(feeder.destination_panel_id)
        : { totalVA: 0, continuousVA: 0, noncontinuousVA: 0 }; // For transformers, would need different logic

      // Get source and destination voltages
      const sourcePanel = panels.find(p => p.id === feeder.source_panel_id);
      const destPanel = feeder.destination_panel_id
        ? panels.find(p => p.id === feeder.destination_panel_id)
        : null;

      const sourceVoltage = sourcePanel?.voltage || projectVoltage;
      const sourcePhase = sourcePanel?.phase || projectPhase;
      const destVoltage = destPanel?.voltage || projectVoltage;
      const destPhase = destPanel?.phase || projectPhase;

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

      // Update feeder with calculation results
      const updatedFeeder = {
        ...feeder,
        total_load_va: loads.totalVA,
        continuous_load_va: loads.continuousVA,
        noncontinuous_load_va: loads.noncontinuousVA,
        design_load_va: result.design_load_va,
        phase_conductor_size: result.phase_conductor_size,
        neutral_conductor_size: result.neutral_conductor_size,
        egc_size: result.egc_size,
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
                <select
                  value={formData.destination_panel_id || ''}
                  onChange={e => setFormData({ ...formData, destination_panel_id: e.target.value || null })}
                  className="w-full border-gray-200 rounded-md focus:border-electric-500 focus:ring-electric-500 text-sm py-2"
                >
                  <option value="">Select Destination Panel</option>
                  {panels.map(panel => (
                    <option key={panel.id} value={panel.id}>
                      {panel.name} ({panel.voltage}V, {panel.phase}-phase)
                    </option>
                  ))}
                </select>
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
              disabled={!formData.name || (!formData.destination_panel_id && !formData.destination_transformer_id)}
              className="flex items-center gap-2 px-4 py-2 bg-electric-500 text-white rounded-lg hover:bg-electric-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
          {feeders.map(feeder => (
            <FeederCard
              key={feeder.id}
              feeder={feeder}
              panels={panels}
              transformers={transformers}
              onEdit={handleEdit}
              onDelete={handleDelete}
              isEditing={editingId === feeder.id}
            />
          ))}
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
  isEditing: boolean;
}

const FeederCard: React.FC<FeederCardProps> = ({
  feeder,
  panels,
  transformers,
  onEdit,
  onDelete,
  isEditing
}) => {
  const sourcePanel = panels.find(p => p.id === feeder.source_panel_id);
  const destPanel = panels.find(p => p.id === feeder.destination_panel_id);
  const destTransformer = transformers.find(t => t.id === feeder.destination_transformer_id);

  const vdCompliant = (feeder.voltage_drop_percent || 0) <= 3.0;

  return (
    <div className={`bg-white border rounded-lg p-6 ${isEditing ? 'border-electric-500 border-2' : 'border-gray-200'}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="font-bold text-gray-900 text-lg">{feeder.name}</h4>
          <p className="text-sm text-gray-500 mt-1">
            {sourcePanel?.name || 'Unknown'} → {destPanel?.name || destTransformer?.name || 'Unknown'}
          </p>
        </div>
        <div className="flex gap-2">
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
