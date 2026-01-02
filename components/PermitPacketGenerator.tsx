/**
 * Permit Packet Generator Component
 * UI for generating comprehensive permit application packets
 */

import React, { useState } from 'react';
import { FileText, Download, Loader2, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { generatePermitPacket, generateLightweightPermitPacket, type PermitPacketData } from '../services/pdfExport/permitPacketGenerator';
import { usePanels } from '../hooks/usePanels';
import { useCircuits } from '../hooks/useCircuits';
import { useFeeders } from '../hooks/useFeeders';
import { useTransformers } from '../hooks/useTransformers';
import { useGrounding } from '../hooks/useGrounding';
import { useProjects } from '../hooks/useProjects';
import { useJurisdictions } from '../hooks/useJurisdictions';
import { useShortCircuitCalculations } from '../hooks/useShortCircuitCalculations';
import { JurisdictionSearchWizard } from './JurisdictionSearchWizard';

interface PermitPacketGeneratorProps {
  projectId: string;
}

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

  // Fetch project data - hooks must be called unconditionally
  const { projects } = useProjects();
  const currentProject = projectId ? projects.find(p => p.id === projectId) : undefined;
  const { panels, loading: panelsLoading } = usePanels(projectId || '');
  const { circuits, loading: circuitsLoading } = useCircuits(projectId || '');
  const { feeders, loading: feedersLoading } = useFeeders(projectId || '');
  const { transformers, loading: transformersLoading } = useTransformers(projectId || '');
  const { grounding, loading: groundingLoading } = useGrounding(projectId || '');
  const { getJurisdictionById } = useJurisdictions();
  const { calculations: shortCircuitCalculations } = useShortCircuitCalculations(projectId || '');

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

  // Validation
  const canGenerate = 
    currentProject &&
    panels.length > 0 &&
    !dataLoading;

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
        // Tier 3: Jurisdiction requirements
        jurisdictionId: currentProject.jurisdiction_id,
        jurisdiction: jurisdiction,
      };

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
          <FileText className="w-6 h-6 text-electric-500" />
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
                className="text-electric-500 focus:ring-electric-500"
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
                className="text-electric-500 focus:ring-electric-500"
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
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:border-electric-500 focus:ring-2 focus:ring-electric-500/20 outline-none"
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
              placeholder="e.g., C-10 #123456"
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:border-electric-500 focus:ring-2 focus:ring-electric-500/20 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">Required by most jurisdictions</p>
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
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:border-electric-500 focus:ring-2 focus:ring-electric-500/20 outline-none"
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
            className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:border-electric-500 focus:ring-2 focus:ring-electric-500/20 outline-none"
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
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:border-electric-500 focus:ring-2 focus:ring-electric-500/20 outline-none"
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
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:border-electric-500 focus:ring-2 focus:ring-electric-500/20 outline-none"
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
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:border-electric-500 focus:ring-2 focus:ring-electric-500/20 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-900">Error</p>
            <p className="text-sm text-red-700">{error}</p>
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

      {/* Validation Warnings */}
      {!canGenerate && !dataLoading && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <div className="text-sm text-yellow-900">
              <p className="font-medium mb-1">Cannot generate permit packet</p>
              <ul className="list-disc list-inside space-y-1">
                {panels.length === 0 && <li>At least one panel is required</li>}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

