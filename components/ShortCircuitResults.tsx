import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Zap, Trash2, FileText, AlertTriangle, CheckCircle } from 'lucide-react';
import { useShortCircuitCalculations } from '../hooks/useShortCircuitCalculations';
import { usePanels } from '../hooks/usePanels';
import { useProjects } from '../hooks/useProjects';
import { exportSingleCalculation, exportSystemReport } from '../services/pdfExport/shortCircuitPDF';

interface ShortCircuitResult {
  faultCurrent: number;
  requiredAIC: number;
  details: {
    sourceFaultCurrent: number;
    conductorImpedance: number;
    totalImpedance: number;
    faultCurrentAtPoint: number;
    safetyFactor: number;
  };
  compliance: {
    necArticle: string;
    compliant: boolean;
    message: string;
  };
}

export const ShortCircuitResults: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const { projects } = useProjects();
  const project = projects.find(p => p.id === projectId);
  const { calculations, loading, deleteCalculation } = useShortCircuitCalculations(projectId);
  const { panels } = usePanels(projectId);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Group calculations
  const serviceCalculation = calculations.find(c => c.calculation_type === 'service' && !c.panel_id);
  const panelCalculations = calculations.filter(c => c.calculation_type === 'panel' || c.panel_id);

  const handleDelete = async (id: string) => {
    await deleteCalculation(id);
    setDeleteConfirmId(null);
  };

  const handleExportAll = async () => {
    if (!project || calculations.length === 0) return;

    try {
      await exportSystemReport(
        calculations,
        project.name,
        project.address || '',
        panels
      );
    } catch (error) {
      console.error('Error exporting system report:', error);
      alert('Failed to export PDF. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="animate-in fade-in duration-500 max-w-6xl">
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-400">Loading calculations...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-light text-gray-900">Short Circuit Analysis</h2>
          <p className="text-gray-500 mt-1">{project?.name || 'Project'}</p>
          <p className="text-sm text-gray-400 mt-1">
            {calculations.length} calculation{calculations.length !== 1 ? 's' : ''} saved
          </p>
        </div>
        <button
          onClick={handleExportAll}
          disabled={calculations.length === 0}
          className="bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FileText className="w-4 h-4" />
          Export All to PDF
        </button>
      </div>

      {calculations.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-lg p-12 text-center">
          <Zap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Calculations Yet</h3>
          <p className="text-gray-500 mb-4">
            Use the Short Circuit Calculator in the Tools section to create calculations.
          </p>
          <a
            href={`#/project/${projectId}/tools`}
            className="inline-flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Go to Tools
          </a>
        </div>
      )}

      {/* Service Calculation */}
      {serviceCalculation && (
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <Zap className="w-5 h-5 text-orange-600" />
            Service Entrance
          </h3>
          <CalculationCard
            calculation={serviceCalculation}
            projectName={project?.name || ''}
            projectAddress={project?.address}
            onDelete={() => setDeleteConfirmId(serviceCalculation.id)}
          />
        </div>
      )}

      {/* Panel Calculations */}
      {panelCalculations.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-600" />
            Panel Calculations ({panelCalculations.length})
          </h3>
          <div className="grid gap-3">
            {panelCalculations.map(calc => {
              const panel = panels.find(p => p.id === calc.panel_id);
              return (
                <CalculationCard
                  key={calc.id}
                  calculation={calc}
                  panel={panel}
                  projectName={project?.name || ''}
                  projectAddress={project?.address}
                  onDelete={() => setDeleteConfirmId(calc.id)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Delete Calculation?</h3>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface CalculationCardProps {
  calculation: any;
  panel?: any;
  projectName: string;
  projectAddress?: string;
  onDelete: () => void;
}

const CalculationCard: React.FC<CalculationCardProps> = ({ calculation, panel, projectName, projectAddress, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const results = calculation.results as ShortCircuitResult;

  const handleExportSingle = async () => {
    try {
      await exportSingleCalculation(
        calculation,
        projectName,
        projectAddress,
        panel?.name
      );
    } catch (error) {
      console.error('Error exporting calculation:', error);
      alert('Failed to export PDF. Please try again.');
    }
  };

  return (
    <div className="bg-white border border-gray-100 rounded-lg shadow-sm hover:shadow-md transition-shadow">
      {/* Header + Metrics - Compact single section */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <h4 className="font-semibold text-gray-900 truncate">
              {calculation.location_name}
            </h4>
            {panel && (
              <span className="text-xs text-gray-500 shrink-0">
                ({panel.bus_rating}A, {panel.voltage}V)
              </span>
            )}
            <span className="text-xs text-gray-400 shrink-0">
              {new Date(calculation.created_at).toLocaleDateString()}
            </span>
          </div>
          <div className="flex gap-1 shrink-0">
            <button
              onClick={handleExportSingle}
              className="text-gray-400 hover:text-blue-600 transition-colors p-1.5"
              title="Export to PDF"
            >
              <FileText className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="text-gray-400 hover:text-red-600 transition-colors p-1.5"
              title="Delete calculation"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Compact Metrics Row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Fault:</span>
            <span className="font-semibold text-gray-900">{(results.faultCurrent / 1000).toFixed(1)} kA</span>
            <span className="text-gray-400">({results.faultCurrent.toLocaleString()} A)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500">AIC:</span>
            <span className="font-semibold text-orange-700">{results.requiredAIC} kA</span>
          </div>
          <div className={`flex items-center gap-1 ${results.compliance.compliant ? 'text-green-700' : 'text-red-700'}`}>
            {results.compliance.compliant ? (
              <CheckCircle className="w-3.5 h-3.5" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5" />
            )}
            <span className="font-medium">
              {results.compliance.compliant ? 'Compliant' : 'Review'}
            </span>
            <span className="text-gray-400">({results.compliance.necArticle})</span>
          </div>
        </div>
      </div>

      {/* Expandable Details */}
      <div className="border-t border-gray-100">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors text-left"
        >
          {expanded ? '▼' : '▶'} {expanded ? 'Hide' : 'Show'} Details
        </button>

        {expanded && (
          <div className="px-3 pb-3 space-y-2">
            {/* Input Parameters */}
            <div className="bg-gray-50 rounded p-2">
              <div className="text-xs font-bold text-gray-600 mb-1">INPUT</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                {calculation.calculation_type === 'service' ? (
                  <>
                    <span className="text-gray-500">Service:</span>
                    <span className="font-mono">{calculation.service_amps}A, {calculation.service_voltage}V, {calculation.service_phase}φ</span>

                    {calculation.transformer_kva && (
                      <>
                        <span className="text-gray-500">Transformer:</span>
                        <span className="font-mono">{calculation.transformer_kva} kVA, {calculation.transformer_impedance}% Z</span>
                      </>
                    )}

                    {calculation.service_conductor_length && (
                      <>
                        <span className="text-gray-500">Conductor:</span>
                        <span className="font-mono">{calculation.service_conductor_size} {calculation.service_conductor_material}, {calculation.service_conductor_length} ft</span>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-gray-500">Source If:</span>
                    <span className="font-mono">{calculation.source_fault_current?.toLocaleString()} A</span>

                    <span className="text-gray-500">Feeder:</span>
                    <span className="font-mono">{calculation.feeder_conductor_size} {calculation.feeder_material}, {calculation.feeder_length} ft</span>

                    <span className="text-gray-500">System:</span>
                    <span className="font-mono">{calculation.feeder_voltage}V, {calculation.feeder_phase}φ</span>
                  </>
                )}
              </div>
            </div>

            {/* Calculation Breakdown */}
            <div className="bg-gray-50 rounded p-2">
              <div className="text-xs font-bold text-gray-600 mb-1">CALCULATION</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                <span className="text-gray-500">Source If:</span>
                <span className="font-mono">{results.details.sourceFaultCurrent.toLocaleString()} A</span>

                {(calculation.calculation_type === 'panel' || (calculation.calculation_type === 'service' && results.details.conductorImpedance > 0)) && (
                  <>
                    <span className="text-gray-500">Conductor Z:</span>
                    <span className="font-mono">{results.details.conductorImpedance.toFixed(4)} Ω</span>
                  </>
                )}

                <span className="text-gray-500">Total Z:</span>
                <span className="font-mono">{results.details.totalImpedance.toFixed(4)} Ω</span>

                <span className="text-gray-500">Safety Factor:</span>
                <span className="font-mono">{results.details.safetyFactor}×</span>
              </div>
            </div>

            {/* Compliance */}
            <div className={`rounded p-2 text-xs ${
              results.compliance.compliant
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              <span className="font-bold" style={{ color: results.compliance.compliant ? '#166534' : '#991b1b' }}>
                {results.compliance.necArticle}:
              </span>{' '}
              <span style={{ color: results.compliance.compliant ? '#15803d' : '#b91c1c' }}>
                {results.compliance.message}
              </span>
            </div>

            {/* Notes */}
            {calculation.notes && (
              <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs">
                <span className="font-bold text-blue-900">Notes:</span>{' '}
                <span className="text-blue-800">{calculation.notes}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
