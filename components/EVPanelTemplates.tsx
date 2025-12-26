import React, { useState } from 'react';
import { Zap, Check, AlertCircle, Info, DollarSign, Users, Activity, Sparkles } from 'lucide-react';
import {
  EV_PANEL_TEMPLATES,
  applyEVPanelTemplate,
  type EVPanelTemplate,
  type ApplyTemplateInput
} from '../data/ev-panel-templates';
import { usePanels } from '../hooks/usePanels';
import { useCircuits } from '../hooks/useCircuits';
import type { Project } from '../types';

interface EVPanelTemplatesProps {
  project: Project;
}

export const EVPanelTemplates: React.FC<EVPanelTemplatesProps> = ({ project }) => {
  const { panels, createPanel } = usePanels(project.id);
  const { circuits, createCircuit } = useCircuits(project.id);

  const [selectedTemplate, setSelectedTemplate] = useState<EVPanelTemplate | null>(null);
  const [customPanelName, setCustomPanelName] = useState('');
  const [applyStatus, setApplyStatus] = useState<'idle' | 'applying' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleApplyTemplate = async () => {
    if (!selectedTemplate) return;

    setApplyStatus('applying');
    setErrorMessage('');

    try {
      // Apply template to generate panel and circuits
      const { panel, circuits: templateCircuits } = applyEVPanelTemplate({
        projectId: project.id,
        template: selectedTemplate,
        panelName: customPanelName || undefined
      });

      // Create panel in database
      const newPanel = await createPanel(panel);

      if (!newPanel || !newPanel.id) {
        throw new Error('Failed to create panel');
      }

      // Create all circuits for the panel
      for (const circuit of templateCircuits) {
        await createCircuit({
          ...circuit,
          panel_id: newPanel.id,
          project_id: project.id
        });
      }

      setApplyStatus('success');
      setTimeout(() => {
        setApplyStatus('idle');
        setSelectedTemplate(null);
        setCustomPanelName('');
      }, 3000);
    } catch (error: any) {
      console.error('Error applying template:', error);
      setErrorMessage(error.message || 'Failed to apply template');
      setApplyStatus('error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-2">
          <Zap className="w-7 h-7 text-electric-500" />
          <h1 className="text-2xl font-bold text-gray-900">
            EV Panel Templates
          </h1>
        </div>
        <p className="text-sm text-gray-600">
          Pre-designed panel schedules for common EV charging configurations - one-click import
        </p>
      </div>

      {/* Template Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {EV_PANEL_TEMPLATES.map(template => (
          <div
            key={template.id}
            onClick={() => setSelectedTemplate(template)}
            className={`bg-white border-2 rounded-lg p-6 cursor-pointer transition-all hover:shadow-lg ${
              selectedTemplate?.id === template.id
                ? 'border-electric-500 bg-electric-50'
                : 'border-gray-200 hover:border-electric-300'
            }`}
          >
            {/* Template Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-900 text-lg mb-1">{template.name}</h3>
                <p className="text-xs text-gray-600">{template.description}</p>
              </div>
              {selectedTemplate?.id === template.id && (
                <Check className="w-6 h-6 text-electric-500 flex-shrink-0" />
              )}
            </div>

            {/* Specifications */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Panel Rating:</span>
                <span className="font-medium text-gray-900">{template.panelRating}A, {template.voltage}V</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Chargers:</span>
                <span className="font-medium text-gray-900">
                  {template.numberOfChargers}× {template.chargerType} ({template.chargerPowerKw}kW each)
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Total Load:</span>
                <span className="font-medium text-gray-900">{template.totalLoadAmps}A</span>
              </div>
              {template.usesEVEMS && (
                <div className="bg-blue-100 border border-blue-200 rounded px-2 py-1">
                  <span className="text-xs font-medium text-blue-800">
                    ✓ EVEMS Load Management (NEC 625.42)
                  </span>
                </div>
              )}
            </div>

            {/* Ideal For */}
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                <Users className="w-3 h-3" /> Ideal For:
              </h4>
              <ul className="text-xs text-gray-600 space-y-1">
                {template.idealFor.slice(0, 2).map((useCase, idx) => (
                  <li key={idx}>• {useCase}</li>
                ))}
              </ul>
            </div>

            {/* Cost Estimate */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center gap-1 mb-1">
                <DollarSign className="w-3 h-3 text-yellow-700" />
                <span className="text-xs font-semibold text-yellow-900">Estimated Cost:</span>
              </div>
              <p className="text-sm font-bold text-yellow-900">
                ${template.estimatedCost.low.toLocaleString()} - ${template.estimatedCost.high.toLocaleString()}
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                Equipment + installation
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Apply Template Section */}
      {selectedTemplate && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-electric-500" />
            Apply Template: {selectedTemplate.name}
          </h2>

          {/* Template Details */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">This template will create:</h3>
            <ul className="text-sm text-gray-700 space-y-2">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>1 Panel:</strong> {selectedTemplate.panelRating}A, {selectedTemplate.voltage}V, {selectedTemplate.phase}-phase
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>{selectedTemplate.circuits.length} Circuits:</strong> Pre-wired for {selectedTemplate.numberOfChargers}× {selectedTemplate.chargerType} EV chargers
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>NEC Compliant:</strong> {selectedTemplate.necArticles.join(', ')}
                </span>
              </li>
              {selectedTemplate.usesEVEMS && (
                <li className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>EVEMS System:</strong> Allows {selectedTemplate.simultaneousCharging} simultaneous chargers (saves panel capacity)
                  </span>
                </li>
              )}
            </ul>
          </div>

          {/* Custom Panel Name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom Panel Name (optional)
            </label>
            <input
              type="text"
              value={customPanelName}
              onChange={(e) => setCustomPanelName(e.target.value)}
              placeholder={selectedTemplate.name}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-electric-500 focus:border-electric-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave blank to use default name: "{selectedTemplate.name}"
            </p>
          </div>

          {/* Service Upgrade Warning */}
          {selectedTemplate.totalLoadAmps > (project.serviceSizeAmps || 200) && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-orange-900 mb-1">Service Upgrade May Be Required</h4>
                  <p className="text-sm text-orange-800">
                    This template requires <strong>{selectedTemplate.totalLoadAmps}A</strong> of capacity,
                    but your current service is only <strong>{project.serviceSizeAmps || 200}A</strong>.
                    Consider using the <strong>Service Upgrade Wizard</strong> in Tools to determine if
                    an upgrade is needed per NEC 220.87.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Apply Button */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleApplyTemplate}
              disabled={applyStatus === 'applying'}
              className={`flex-1 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                applyStatus === 'applying'
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-electric-500 text-white hover:bg-electric-600'
              }`}
            >
              {applyStatus === 'applying' ? (
                <>
                  <Activity className="w-5 h-5 animate-spin" />
                  Applying Template...
                </>
              ) : applyStatus === 'success' ? (
                <>
                  <Check className="w-5 h-5" />
                  Template Applied Successfully!
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Apply Template to Project
                </>
              )}
            </button>

            <button
              onClick={() => {
                setSelectedTemplate(null);
                setCustomPanelName('');
                setApplyStatus('idle');
              }}
              disabled={applyStatus === 'applying'}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>

          {/* Error Message */}
          {applyStatus === 'error' && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-900 mb-1">Error Applying Template</h4>
                  <p className="text-sm text-red-800">{errorMessage}</p>
                </div>
              </div>
            </div>
          )}

          {/* Circuit Details */}
          <div className="mt-6 border-t border-gray-200 pt-6">
            <h3 className="font-semibold text-gray-900 mb-3">Circuit Details:</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {selectedTemplate.circuits.map((circuit, idx) => (
                <div key={idx} className="bg-gray-50 border border-gray-200 rounded p-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900">
                      Circuit {circuit.circuitNumber}
                    </span>
                    <span className="text-xs font-medium px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                      {circuit.breakerAmps}A / {circuit.poles}P
                    </span>
                  </div>
                  <p className="text-gray-700">{circuit.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                    <span>Conductor: {circuit.conductorSize} {circuit.conductorType}</span>
                    <span>Load: {(circuit.loadVA / 1000).toFixed(1)} kVA</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* NEC References */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-600">
        <p className="font-medium mb-2">NEC References:</p>
        <ul className="space-y-1">
          <li>• NEC 625.41 - Electric Vehicle Coupler</li>
          <li>• NEC 625.42 - Electric Vehicle Supply Equipment Load Management (EVEMS)</li>
          <li>• NEC 625.44 - Electric Vehicle Supply Equipment Demand Factors</li>
          <li>• NEC 210.19 - Conductors - Minimum Ampacity and Size</li>
          <li>• NEC 310.16 - Allowable Ampacities of Insulated Conductors</li>
        </ul>
      </div>
    </div>
  );
};
