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
      <div className="flex justify-between items-start">
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
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h4 className="font-medium text-gray-900 text-lg flex items-center gap-2">
              {calculation.location_name}
              {panel && (
                <span className="text-sm text-gray-500 font-normal">
                  ({panel.bus_rating}A, {panel.voltage}V)
                </span>
              )}
            </h4>
            <p className="text-xs text-gray-400 mt-1">
              Calculated {new Date(calculation.created_at).toLocaleDateString()} at {new Date(calculation.created_at).toLocaleTimeString()}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportSingle}
              className="text-gray-400 hover:text-blue-600 transition-colors p-2"
              title="Export to PDF"
            >
              <FileText className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="text-gray-400 hover:text-red-600 transition-colors p-2"
              title="Delete calculation"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="p-4 bg-gray-50">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-gray-500 mb-1">Fault Current</div>
            <div className="text-2xl font-light text-gray-900">
              {(results.faultCurrent / 1000).toFixed(1)} <span className="text-sm text-gray-500">kA</span>
            </div>
            <div className="text-xs text-gray-400">
              {results.faultCurrent.toLocaleString()} A RMS
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Required AIC</div>
            <div className="text-2xl font-light text-orange-700">
              {results.requiredAIC} <span className="text-sm text-orange-600">kA</span>
            </div>
            <div className="text-xs text-gray-400">
              Minimum rating
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">NEC Compliance</div>
            <div className={`flex items-center gap-1 ${results.compliance.compliant ? 'text-green-700' : 'text-red-700'}`}>
              {results.compliance.compliant ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
              <span className="text-sm font-medium">
                {results.compliance.compliant ? 'Compliant' : 'Review'}
              </span>
            </div>
            <div className="text-xs text-gray-400">
              {results.compliance.necArticle}
            </div>
          </div>
        </div>
      </div>

      {/* Expandable Details */}
      <div className="border-t border-gray-100">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors text-left"
        >
          {expanded ? '▼' : '▶'} {expanded ? 'Hide' : 'Show'} Calculation Details
        </button>

        {expanded && (
          <div className="px-4 pb-4 space-y-4">
            {/* Input Parameters */}
            <div className="bg-white border border-gray-200 rounded p-3">
              <div className="text-xs font-bold text-gray-700 mb-2">INPUT PARAMETERS</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
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
                        <span className="text-gray-500">Service Conductor:</span>
                        <span className="font-mono">{calculation.service_conductor_size} {calculation.service_conductor_material}</span>

                        <span className="text-gray-500">Conductor Length:</span>
                        <span className="font-mono">{calculation.service_conductor_length} ft</span>

                        <span className="text-gray-500">Conduit:</span>
                        <span className="font-mono">{calculation.service_conduit_type}</span>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-gray-500">Source If:</span>
                    <span className="font-mono">{calculation.source_fault_current?.toLocaleString()} A</span>

                    <span className="text-gray-500">Feeder:</span>
                    <span className="font-mono">{calculation.feeder_conductor_size} {calculation.feeder_material}</span>

                    <span className="text-gray-500">Length:</span>
                    <span className="font-mono">{calculation.feeder_length} ft</span>

                    <span className="text-gray-500">Voltage/Phase:</span>
                    <span className="font-mono">{calculation.feeder_voltage}V, {calculation.feeder_phase}φ</span>
                  </>
                )}
              </div>
            </div>

            {/* Calculation Details */}
            <div className="bg-white border border-gray-200 rounded p-3">
              <div className="text-xs font-bold text-gray-700 mb-2">CALCULATION BREAKDOWN</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
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
            <div className={`border rounded p-3 ${
              results.compliance.compliant
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="text-xs font-bold mb-1" style={{ color: results.compliance.compliant ? '#166534' : '#991b1b' }}>
                {results.compliance.necArticle}
              </div>
              <div className="text-xs" style={{ color: results.compliance.compliant ? '#15803d' : '#b91c1c' }}>
                {results.compliance.message}
              </div>
            </div>

            {/* Notes */}
            {calculation.notes && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <div className="text-xs font-bold text-blue-900 mb-1">NOTES</div>
                <div className="text-xs text-blue-800">{calculation.notes}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
