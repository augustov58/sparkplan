/**
 * Jurisdiction Search Wizard
 *
 * Search and select jurisdiction-specific permit requirements
 * Follows ServiceUpgradeWizard pattern: two-column layout, search + results
 *
 * @remarks
 * This wizard helps users find their local AHJ's permit requirements.
 * Users can search by city/county, view requirements, and save to project.
 *
 * Features:
 * - Autocomplete search (city, county, state)
 * - Display required documents + calculations
 * - Save jurisdiction to project (for permit packet)
 * - Shows AHJ notes and review times
 *
 * @example
 * ```tsx
 * <JurisdictionSearchWizard projectId={projectId} />
 * ```
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { MapPin, CheckCircle, Calculator, AlertCircle, FileText } from 'lucide-react';
import { useProjects } from '../hooks/useProjects';
import { useJurisdictions } from '../hooks/useJurisdictions';
import type { Jurisdiction } from '../types';
import { DOCUMENT_LABELS, CALCULATION_LABELS } from '../types';

interface JurisdictionSearchWizardProps {
  projectId?: string;
}

export const JurisdictionSearchWizard: React.FC<JurisdictionSearchWizardProps> = ({ projectId }) => {
  const { projectId: urlProjectId } = useParams<{ projectId: string }>();
  const effectiveProjectId = projectId || urlProjectId;

  const { getProjectById, updateProject } = useProjects();
  const { jurisdictions, loading, searchJurisdictions, getJurisdictionById } = useJurisdictions();
  const project = effectiveProjectId ? getProjectById(effectiveProjectId) : undefined;

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Jurisdiction[]>([]);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<Jurisdiction | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Real-time search filtering
  useEffect(() => {
    if (searchQuery.length >= 2) {
      const results = searchJurisdictions(searchQuery);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]); // Removed searchJurisdictions - it's a stable function, doesn't need tracking

  // Load project's jurisdiction if already set
  useEffect(() => {
    if (project?.jurisdiction_id && jurisdictions.length > 0) {
      const jurisdiction = getJurisdictionById(project.jurisdiction_id);
      if (jurisdiction) {
        setSelectedJurisdiction(jurisdiction);
      }
    }
  }, [project, jurisdictions]); // Removed getJurisdictionById - it's a stable function, doesn't need tracking

  // Save jurisdiction to project
  const handleSaveToProject = async () => {
    if (!project || !selectedJurisdiction) return;

    setSaveStatus('saving');
    try {
      await updateProject({
        ...project,
        jurisdiction_id: selectedJurisdiction.id,
      });

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Error saving jurisdiction:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  // Select jurisdiction from search results
  const handleSelectJurisdiction = (jurisdiction: Jurisdiction) => {
    setSelectedJurisdiction(jurisdiction);
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <MapPin className="w-6 h-6 text-electric-500" />
          Jurisdiction Requirements Wizard
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Find your jurisdiction's permit requirements and document checklist
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-electric-500 mx-auto"></div>
          <p className="text-sm text-gray-500 mt-2">Loading jurisdictions...</p>
        </div>
      )}

      {/* Main Content - Two-column layout */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* LEFT COLUMN: Search & Selection */}
          <div className="space-y-6">

            {/* Search Box */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
              <label className="block text-sm font-semibold text-gray-900">
                Search Jurisdiction
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search city, county, or state..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full border border-gray-200 rounded px-3 py-2 pl-9 focus:border-electric-500 focus:ring-electric-500"
                />
                <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              </div>
              <p className="text-xs text-gray-500">
                Examples: "Miami", "Dallas", "Austin, TX"
              </p>
            </div>

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-900">
                  Results ({searchResults.length})
                </h4>
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                  {searchResults.map(jurisdiction => (
                    <button
                      key={jurisdiction.id}
                      onClick={() => handleSelectJurisdiction(jurisdiction)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                        selectedJurisdiction?.id === jurisdiction.id
                          ? 'bg-electric-50 border-l-4 border-electric-500'
                          : ''
                      }`}
                    >
                      <div className="font-medium text-sm text-gray-900">
                        {jurisdiction.city}, {jurisdiction.county && `${jurisdiction.county} County, `}{jurisdiction.state}
                      </div>
                      {jurisdiction.ahj_name && (
                        <div className="text-xs text-gray-600 mt-0.5">
                          {jurisdiction.ahj_name}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Save to Project Button */}
            {effectiveProjectId && selectedJurisdiction && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-sm text-blue-900">Save to Project</div>
                    <div className="text-xs text-blue-700 mt-1">
                      Save this jurisdiction to your project for reference in permit packet
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleSaveToProject}
                  disabled={saveStatus === 'saving'}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-2 rounded transition-colors text-sm"
                >
                  {saveStatus === 'saving'
                    ? 'Saving...'
                    : saveStatus === 'saved'
                    ? '✓ Saved!'
                    : saveStatus === 'error'
                    ? 'Error - Try Again'
                    : 'Save to Project'}
                </button>
              </div>
            )}

            {/* Current Selection Info */}
            {project?.jurisdiction_id && selectedJurisdiction && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-sm text-green-900">
                      Project Jurisdiction Set
                    </div>
                    <div className="text-xs text-green-700 mt-1">
                      This jurisdiction will be included in your permit packet
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Requirements Display */}
          <div className="space-y-4">
            {selectedJurisdiction ? (
              <>
                {/* Jurisdiction Header */}
                <div className="bg-electric-50 border border-electric-200 rounded-lg p-4">
                  <h4 className="font-bold text-electric-900 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {selectedJurisdiction.jurisdiction_name}
                  </h4>
                  {selectedJurisdiction.ahj_name && (
                    <p className="text-sm text-electric-700 mt-1">
                      Authority: {selectedJurisdiction.ahj_name}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-electric-600">
                    <span>NEC {selectedJurisdiction.nec_edition}</span>
                    {selectedJurisdiction.estimated_review_days && (
                      <>
                        <span>•</span>
                        <span>Review: ~{selectedJurisdiction.estimated_review_days} days</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Required Documents Checklist */}
                <div className="space-y-2">
                  <h5 className="font-semibold text-gray-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-green-600" />
                    Required Documents ({selectedJurisdiction.required_documents.length})
                  </h5>
                  <div className="space-y-1">
                    {selectedJurisdiction.required_documents.map(doc => (
                      <div key={doc} className="flex items-start gap-2 p-2 border border-gray-200 rounded bg-white text-sm">
                        <div className="w-4 h-4 rounded border-2 border-green-500 flex items-center justify-center mt-0.5 flex-shrink-0">
                          <CheckCircle className="w-3 h-3 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {DOCUMENT_LABELS[doc as keyof typeof DOCUMENT_LABELS] || doc}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Required Calculations Checklist */}
                <div className="space-y-2">
                  <h5 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-electric-500" />
                    Required Calculations ({selectedJurisdiction.required_calculations.length})
                  </h5>
                  <div className="space-y-1">
                    {selectedJurisdiction.required_calculations.map(calc => (
                      <div key={calc} className="flex items-start gap-2 p-2 border border-gray-200 rounded bg-white text-sm">
                        <div className="w-4 h-4 rounded border-2 border-electric-500 flex items-center justify-center mt-0.5 flex-shrink-0">
                          <Calculator className="w-3 h-3 text-electric-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {CALCULATION_LABELS[calc as keyof typeof CALCULATION_LABELS] || calc}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Special Notes */}
                {selectedJurisdiction.notes && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-semibold text-sm text-yellow-900">Special Notes</div>
                        <div className="text-xs text-yellow-800 mt-1">{selectedJurisdiction.notes}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Data Source Information */}
                {(selectedJurisdiction.data_source || selectedJurisdiction.source_url) && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="text-xs font-semibold text-gray-700 mb-2">
                      Data Source
                    </div>
                    {selectedJurisdiction.data_source && (
                      <div className="text-sm text-gray-600 mb-1">
                        {selectedJurisdiction.data_source}
                      </div>
                    )}
                    {selectedJurisdiction.source_url && (
                      <a
                        href={selectedJurisdiction.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-electric-600 hover:text-electric-700 underline inline-flex items-center gap-1"
                      >
                        View Official Requirements →
                      </a>
                    )}
                    {selectedJurisdiction.last_verified_date && (
                      <div className="text-xs text-gray-500 mt-2">
                        Last verified: {new Date(selectedJurisdiction.last_verified_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                )}

                {/* AHJ Website Link */}
                {selectedJurisdiction.ahj_website && (
                  <div className="text-center">
                    <a
                      href={selectedJurisdiction.ahj_website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-electric-600 hover:text-electric-700 underline"
                    >
                      Visit {selectedJurisdiction.ahj_name || 'AHJ'} Website →
                    </a>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <MapPin className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Search for a jurisdiction to see requirements</p>
                <p className="text-xs mt-1">
                  {jurisdictions.length} jurisdictions available
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
