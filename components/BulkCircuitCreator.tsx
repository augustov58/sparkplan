/**
 * Bulk Circuit Creator Component
 * Allows creating multiple circuits at once for efficiency
 * Supports batch input and common parameter application
 */

import React, { useState } from 'react';
import { X, Plus, Trash2, Copy, Check, AlertTriangle } from 'lucide-react';
import { validateCircuitForm, showValidationErrors } from '../lib/validation-utils';

type LoadTypeCode = 'L' | 'M' | 'R' | 'O' | 'H' | 'C' | 'W' | 'D' | 'K';

interface BulkCircuit {
  id: string;
  circuit_number: number;
  description: string;
  breaker_amps: number;
  pole: 1 | 2 | 3;
  load_watts: number;
  conductor_size: string;
  egc_size: string;
  load_type: LoadTypeCode;
}

interface BulkCircuitCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  panelId: string;
  startingCircuitNumber: number;
  onCreateCircuits: (circuits: Omit<BulkCircuit, 'id'>[]) => Promise<void>;
}

export const BulkCircuitCreator: React.FC<BulkCircuitCreatorProps> = ({
  isOpen,
  onClose,
  panelId,
  startingCircuitNumber,
  onCreateCircuits
}) => {
  const [circuits, setCircuits] = useState<BulkCircuit[]>([
    {
      id: '1',
      circuit_number: startingCircuitNumber,
      description: '',
      breaker_amps: 20,
      pole: 1,
      load_watts: 1800,
      conductor_size: '12 AWG',
      egc_size: '12 AWG',
      load_type: 'O'
    }
  ]);

  const [commonSettings, setCommonSettings] = useState({
    applyBreakerAmps: false,
    breakerAmps: 20,
    applyPole: false,
    pole: 1 as 1 | 2 | 3,
    applyLoadWatts: false,
    loadWatts: 1800,
    applyConductorSize: false,
    conductorSize: '12 AWG',
    applyEgcSize: false,
    egcSize: '12 AWG',
    applyLoadType: false,
    loadType: 'O' as LoadTypeCode
  });

  const addCircuit = () => {
    const lastCircuit = circuits[circuits.length - 1];
    const nextCircuitNumber = lastCircuit.circuit_number + 1;

    setCircuits([
      ...circuits,
      {
        id: String(Date.now()),
        circuit_number: nextCircuitNumber,
        description: '',
        breaker_amps: 20,
        pole: 1,
        load_watts: 1800,
        conductor_size: '12 AWG',
        egc_size: '12 AWG',
        load_type: 'O'
      }
    ]);
  };

  const removeCircuit = (id: string) => {
    if (circuits.length === 1) return; // Keep at least one
    setCircuits(circuits.filter(c => c.id !== id));
  };

  const updateCircuit = (id: string, field: keyof BulkCircuit, value: any) => {
    setCircuits(circuits.map(c =>
      c.id === id ? { ...c, [field]: value } : c
    ));
  };

  const applyCommonSettings = () => {
    setCircuits(circuits.map(circuit => ({
      ...circuit,
      breaker_amps: commonSettings.applyBreakerAmps ? commonSettings.breakerAmps : circuit.breaker_amps,
      pole: commonSettings.applyPole ? commonSettings.pole : circuit.pole,
      load_watts: commonSettings.applyLoadWatts ? commonSettings.loadWatts : circuit.load_watts,
      conductor_size: commonSettings.applyConductorSize ? commonSettings.conductorSize : circuit.conductor_size,
      egc_size: commonSettings.applyEgcSize ? commonSettings.egcSize : circuit.egc_size,
      load_type: commonSettings.applyLoadType ? commonSettings.loadType : circuit.load_type
    })));
  };

  const duplicateCircuit = (circuit: BulkCircuit) => {
    const lastCircuitNumber = Math.max(...circuits.map(c => c.circuit_number));
    setCircuits([
      ...circuits,
      {
        ...circuit,
        id: String(Date.now()),
        circuit_number: lastCircuitNumber + 1,
        description: circuit.description + ' (Copy)'
      }
    ]);
  };

  const handleCreate = async () => {
    // Validate all circuits
    const errors: Record<string, string[]> = {};

    circuits.forEach((circuit, index) => {
      const validation = validateCircuitForm({
        circuit_number: circuit.circuit_number,
        description: circuit.description || `Circuit ${circuit.circuit_number}`,
        breaker_amps: circuit.breaker_amps,
        pole: circuit.pole,
        load_watts: circuit.load_watts,
        conductor_size: circuit.conductor_size,
        egc_size: circuit.egc_size
      });

      if (!validation.success) {
        errors[`Circuit ${index + 1}`] = Object.values(validation.errors);
      }
    });

    if (Object.keys(errors).length > 0) {
      const errorMessage = Object.entries(errors)
        .map(([circuit, errs]) => `${circuit}:\n${errs.join('\n')}`)
        .join('\n\n');
      alert(`Please fix the following errors:\n\n${errorMessage}`);
      return;
    }

    // Create circuits
    try {
      const circuitsToCreate = circuits.map(({ id, ...circuit }) => circuit);
      await onCreateCircuits(circuitsToCreate);
      onClose();
      setCircuits([{
        id: '1',
        circuit_number: startingCircuitNumber,
        description: '',
        breaker_amps: 20,
        pole: 1,
        load_watts: 1800,
        conductor_size: '12 AWG',
        egc_size: '12 AWG'
      }]);
    } catch (error) {
      console.error('Error creating circuits:', error);
      alert('Failed to create circuits. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gray-900 text-white p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-semibold">Bulk Circuit Creator</h2>
            <p className="text-sm text-gray-300 mt-1">
              Add multiple circuits at once - {circuits.length} circuit{circuits.length !== 1 ? 's' : ''} ready to create
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Common Settings Panel */}
        <div className="bg-electric-50 p-4 border-b border-electric-200">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Check className="w-4 h-4" />
            Apply Common Settings to All Circuits
          </h3>
          <div className="grid grid-cols-5 gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={commonSettings.applyBreakerAmps}
                onChange={(e) => setCommonSettings({ ...commonSettings, applyBreakerAmps: e.target.checked })}
                className="rounded"
              />
              <span>Breaker:</span>
              <input
                type="number"
                value={commonSettings.breakerAmps}
                onChange={(e) => setCommonSettings({ ...commonSettings, breakerAmps: Number(e.target.value) })}
                className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                disabled={!commonSettings.applyBreakerAmps}
              />
              <span>A</span>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={commonSettings.applyPole}
                onChange={(e) => setCommonSettings({ ...commonSettings, applyPole: e.target.checked })}
                className="rounded"
              />
              <span>Pole:</span>
              <select
                value={commonSettings.pole}
                onChange={(e) => setCommonSettings({ ...commonSettings, pole: Number(e.target.value) as 1 | 2 | 3 })}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
                disabled={!commonSettings.applyPole}
              >
                <option value={1}>1P</option>
                <option value={2}>2P</option>
                <option value={3}>3P</option>
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={commonSettings.applyLoadWatts}
                onChange={(e) => setCommonSettings({ ...commonSettings, applyLoadWatts: e.target.checked })}
                className="rounded"
              />
              <span>Load:</span>
              <input
                type="number"
                value={commonSettings.loadWatts}
                onChange={(e) => setCommonSettings({ ...commonSettings, loadWatts: Number(e.target.value) })}
                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                disabled={!commonSettings.applyLoadWatts}
              />
              <span>W</span>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={commonSettings.applyConductorSize}
                onChange={(e) => setCommonSettings({ ...commonSettings, applyConductorSize: e.target.checked })}
                className="rounded"
              />
              <span>Wire:</span>
              <input
                type="text"
                value={commonSettings.conductorSize}
                onChange={(e) => setCommonSettings({ ...commonSettings, conductorSize: e.target.value })}
                className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                disabled={!commonSettings.applyConductorSize}
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={commonSettings.applyEgcSize}
                onChange={(e) => setCommonSettings({ ...commonSettings, applyEgcSize: e.target.checked })}
                className="rounded"
              />
              <span>EGC:</span>
              <input
                type="text"
                value={commonSettings.egcSize}
                onChange={(e) => setCommonSettings({ ...commonSettings, egcSize: e.target.value })}
                className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                disabled={!commonSettings.applyEgcSize}
              />
            </label>
          </div>
          <button
            onClick={applyCommonSettings}
            className="mt-3 px-4 py-2 bg-electric-400 text-black rounded font-medium hover:bg-electric-500 text-sm"
          >
            Apply to All Circuits
          </button>
        </div>

        {/* Circuits Table */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-gray-700 text-left">
                  <th className="p-2 w-20">#</th>
                  <th className="p-2">Description</th>
                  <th className="p-2 w-24">Breaker (A)</th>
                  <th className="p-2 w-20">Pole</th>
                  <th className="p-2 w-28">Load (W)</th>
                  <th className="p-2 w-32">Conductor</th>
                  <th className="p-2 w-28">EGC</th>
                  <th className="p-2 w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {circuits.map((circuit, index) => (
                  <tr key={circuit.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="p-2">
                      <input
                        type="number"
                        value={circuit.circuit_number}
                        onChange={(e) => updateCircuit(circuit.id, 'circuit_number', Number(e.target.value))}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={circuit.description}
                        onChange={(e) => updateCircuit(circuit.id, 'description', e.target.value)}
                        placeholder="Circuit description"
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={circuit.breaker_amps}
                        onChange={(e) => updateCircuit(circuit.id, 'breaker_amps', Number(e.target.value))}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={circuit.pole}
                        onChange={(e) => updateCircuit(circuit.id, 'pole', Number(e.target.value))}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      >
                        <option value={1}>1P</option>
                        <option value={2}>2P</option>
                        <option value={3}>3P</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={circuit.load_watts}
                        onChange={(e) => updateCircuit(circuit.id, 'load_watts', Number(e.target.value))}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={circuit.conductor_size}
                        onChange={(e) => updateCircuit(circuit.id, 'conductor_size', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={circuit.egc_size}
                        onChange={(e) => updateCircuit(circuit.id, 'egc_size', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <button
                          onClick={() => duplicateCircuit(circuit)}
                          className="p-1 text-gray-600 hover:text-electric-600"
                          title="Duplicate"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeCircuit(circuit.id)}
                          className="p-1 text-gray-600 hover:text-red-600"
                          disabled={circuits.length === 1}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={addCircuit}
            className="mt-4 flex items-center gap-2 px-4 py-2 border border-gray-300 rounded font-medium text-gray-700 hover:bg-gray-50"
          >
            <Plus className="w-4 h-4" />
            Add Another Circuit
          </button>
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 p-6 flex justify-between items-center border-t border-gray-200">
          <div className="text-sm text-gray-600">
            {circuits.length} circuit{circuits.length !== 1 ? 's' : ''} will be created
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-md font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              className="px-6 py-2 bg-electric-400 text-black rounded-md font-medium hover:bg-electric-500 transition-colors flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Create {circuits.length} Circuit{circuits.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
