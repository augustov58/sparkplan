/**
 * Permit Packet Generator Component
 * UI for generating comprehensive permit application packets
 */

import React, { useState } from 'react';
import { FileText, Download, Loader2, AlertCircle, CheckCircle, Info, Building2 } from 'lucide-react';
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
import { calculateMultiFamilyEV, type MultiFamilyEVInput } from '../services/calculations/multiFamilyEV';

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

  // Multi-Family EV Analysis state
  const [includeMultiFamilyEV, setIncludeMultiFamilyEV] = useState(false);
  const [mfEvDwellingUnits, setMfEvDwellingUnits] = useState(20);
  const [mfEvChargersPerUnit, setMfEvChargersPerUnit] = useState(1);
  const [mfEvChargerLevel, setMfEvChargerLevel] = useState<'level1' | 'level2'>('level2');
  const [mfEvBuildingName, setMfEvBuildingName] = useState('');

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

      {/* Multi-Family EV Analysis Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-electric-500" />
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
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-electric-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-electric-500"></div>
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
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:border-electric-500 focus:ring-2 focus:ring-electric-500/20 outline-none"
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
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:border-electric-500 focus:ring-2 focus:ring-electric-500/20 outline-none"
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
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:border-electric-500 focus:ring-2 focus:ring-electric-500/20 outline-none"
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
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:border-electric-500 focus:ring-2 focus:ring-electric-500/20 outline-none"
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

