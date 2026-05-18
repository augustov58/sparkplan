/**
 * Unified Jurisdiction & AHJ Settings panel.
 *
 * Sprint 2C M4 (2026-05-18): consolidates the previously separate
 * JurisdictionSearchWizard (set `project.jurisdiction_id`) and the inline
 * AHJTemplateAndOverridesPanel (set `settings.manifest_template_id` +
 * override strings) into ONE panel.
 *
 * UX hierarchy:
 *   1. Primary action: pick the AHJ this permit is for. Auto-binds the
 *      Sprint 2C manifest if one is registered, surfacing the binding
 *      via a green "Full SparkPlan support" badge.
 *   2. Conditional: when the picked AHJ has NO manifest, the template
 *      picker auto-expands with an amber callout — "borrow defaults
 *      from a neighboring AHJ."
 *   3. Advanced (collapsed by default): per-project text overrides for
 *      general notes, code references, sheet ID prefix.
 *
 * The two old panels exposed equal-rank symmetry that confused users:
 * "which panel actually affects checkboxes / cover sheet?" Answer was
 * "both, via the same activeManifest", but the UI implied otherwise.
 * This merge encodes the actual hierarchy in the layout.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  MapPin,
  Sparkles,
  X,
} from 'lucide-react';
import { useProjects } from '../hooks/useProjects';
import { useJurisdictions } from '../hooks/useJurisdictions';
import type { Jurisdiction } from '../types';
import {
  ALL_MANIFESTS,
  findManifestForJurisdiction,
} from '../data/ahj/registry';
import type { AHJManifest, AHJSheetIdPrefix } from '../data/ahj/types';

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface JurisdictionAndAHJPanelProps {
  projectId?: string;
  /** The fully-resolved active manifest from the parent (precedence:
      templateManifest ?? jurisdiction-auto-bound). Used to decide which
      status badge to show + which default to display in the template
      picker. Computed by the parent so resolution stays single-source. */
  activeManifest: AHJManifest | null;
  /** Current template ID from `projects.settings.manifest_template_id`,
      empty string / undefined when no template override is set. */
  currentTemplateId: string | undefined;
  /** Per-project override values (Sprint 2C M3 Gap 3). Undefined = use
      manifest fallback. */
  generalNotesOverride: string[] | undefined;
  codeReferencesOverride: string[] | undefined;
  sheetIdPrefixOverride: AHJSheetIdPrefix | undefined;
  /** Handlers that persist to `projects.settings.*`. The parent owns
      these writes so the visibility resolution stays authoritative. */
  onSelectTemplate: (templateId: string) => void;
  onSetGeneralNotesOverride: (lines: string[] | undefined) => void;
  onSetCodeReferencesOverride: (lines: string[] | undefined) => void;
  onSetSheetIdPrefixOverride: (prefix: AHJSheetIdPrefix | undefined) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const JurisdictionAndAHJPanel: React.FC<JurisdictionAndAHJPanelProps> = ({
  projectId,
  activeManifest,
  currentTemplateId,
  generalNotesOverride,
  codeReferencesOverride,
  sheetIdPrefixOverride,
  onSelectTemplate,
  onSetGeneralNotesOverride,
  onSetCodeReferencesOverride,
  onSetSheetIdPrefixOverride,
}) => {
  const { projectId: urlProjectId } = useParams<{ projectId: string }>();
  const effectiveProjectId = projectId || urlProjectId;

  const { getProjectById, updateProject } = useProjects();
  const { jurisdictions, loading, searchJurisdictions, getJurisdictionById } =
    useJurisdictions();
  const project = effectiveProjectId ? getProjectById(effectiveProjectId) : undefined;

  // Search & selection state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Jurisdiction[]>([]);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<Jurisdiction | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Hydrate selected jurisdiction from project record on load.
  useEffect(() => {
    if (project?.jurisdiction_id && jurisdictions.length > 0) {
      const j = getJurisdictionById(project.jurisdiction_id);
      if (j) setSelectedJurisdiction(j);
    } else {
      setSelectedJurisdiction(null);
    }
  }, [project?.jurisdiction_id, jurisdictions.length]);

  // Live search.
  useEffect(() => {
    if (searchQuery.length >= 2) {
      setSearchResults(searchJurisdictions(searchQuery));
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  // Manifest auto-binding check. Drives the "full support" vs "no
  // manifest" badge. Computed from the wizard's selection, not from
  // the parent's `activeManifest`, so we can show whether the
  // wizard's pick alone covers it (vs. relying on a template).
  const wizardAutoBoundManifest: AHJManifest | null = useMemo(() => {
    if (!selectedJurisdiction) return null;
    return (
      findManifestForJurisdiction(
        selectedJurisdiction.jurisdiction_name,
        selectedJurisdiction.ahj_name,
      ) ?? null
    );
  }, [
    selectedJurisdiction?.jurisdiction_name,
    selectedJurisdiction?.ahj_name,
  ]);

  const hasAutoBoundManifest = !!wizardAutoBoundManifest;
  const hasTemplateManifest = !!currentTemplateId;
  const hasOverrides =
    !!generalNotesOverride ||
    !!codeReferencesOverride ||
    !!sheetIdPrefixOverride;

  // Advanced section: auto-expand when the user has anything non-default
  // configured OR when they need to pick a template (no auto-bound).
  const shouldAutoExpand =
    (!hasAutoBoundManifest && !!selectedJurisdiction) ||
    hasTemplateManifest ||
    hasOverrides;
  const [showAdvanced, setShowAdvanced] = useState(shouldAutoExpand);
  useEffect(() => {
    if (shouldAutoExpand) setShowAdvanced(true);
  }, [shouldAutoExpand]);

  const [showOverrides, setShowOverrides] = useState(hasOverrides);

  // Override textarea local state (mirrors persisted values).
  const [generalNotesText, setGeneralNotesText] = useState(
    (generalNotesOverride ?? []).join('\n'),
  );
  const [codeRefsText, setCodeRefsText] = useState(
    (codeReferencesOverride ?? []).join('\n'),
  );
  useEffect(() => {
    setGeneralNotesText((generalNotesOverride ?? []).join('\n'));
  }, [generalNotesOverride?.join('\n')]);
  useEffect(() => {
    setCodeRefsText((codeReferencesOverride ?? []).join('\n'));
  }, [codeReferencesOverride?.join('\n')]);

  const parseLines = (raw: string): string[] | undefined => {
    const lines = raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    return lines.length > 0 ? lines : undefined;
  };

  // -------------------------------------------------------------------------
  // PERSISTENCE HANDLERS
  // -------------------------------------------------------------------------

  const handleSelectJurisdiction = (j: Jurisdiction) => {
    setSelectedJurisdiction(j);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSaveToProject = async () => {
    if (!project || !selectedJurisdiction) return;
    setSaveStatus('saving');
    try {
      await updateProject({ ...project, jurisdiction_id: selectedJurisdiction.id });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (e) {
      console.error('Save jurisdiction failed:', e);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleClearJurisdiction = async () => {
    if (!project) return;
    setSaveStatus('saving');
    try {
      await updateProject({ ...project, jurisdiction_id: null });
      setSelectedJurisdiction(null);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (e) {
      console.error('Clear jurisdiction failed:', e);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------

  // The "is the picked jurisdiction the saved one?" check decides whether
  // to show the Save button (when the user just picked something new) or
  // the saved-jurisdiction card (when project.jurisdiction_id already
  // matches what's selected).
  const isSelectionSaved =
    selectedJurisdiction?.id === project?.jurisdiction_id;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
      {/* HEADER */}
      <div>
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-[#2d3b2d]" />
          Jurisdiction &amp; AHJ
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Pick the AHJ this permit is being submitted to. SparkPlan auto-applies
          the AHJ's lane-aware defaults (sheet ID prefix, code references,
          required sections) when a manifest is registered for the picked
          jurisdiction.
        </p>
      </div>

      {loading && (
        <div className="text-center py-6 text-sm text-gray-500">
          Loading jurisdictions…
        </div>
      )}

      {!loading && (
        <>
          {/* PRIMARY: SEARCH OR SAVED CARD ---------------------------------- */}
          {!selectedJurisdiction || !isSelectionSaved ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
              <label className="block text-sm font-semibold text-gray-900">
                Where is this permit being submitted?
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search city, county, or state…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border border-gray-200 rounded px-3 py-2 pl-9 focus:border-[#2d3b2d] focus:ring-2 focus:ring-[#2d3b2d]/20 outline-none"
                />
                <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              </div>
              <p className="text-xs text-gray-500">
                Examples: "Miami", "Dallas", "Austin, TX"
              </p>

              {searchResults.length > 0 && (
                <div className="space-y-1 mt-2 max-h-56 overflow-y-auto border border-gray-200 rounded bg-white">
                  {searchResults.map((j) => (
                    <button
                      key={j.id}
                      type="button"
                      onClick={() => handleSelectJurisdiction(j)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-b-0 text-sm"
                    >
                      <div className="font-medium text-gray-900">
                        {j.jurisdiction_name}
                      </div>
                      {j.ahj_name && (
                        <div className="text-xs text-gray-500">
                          {j.ahj_name} • NEC {j.nec_edition}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* "No results" — fallback path for unmodeled AHJs (Cape Coral,
                  Sanford, Winter Park, etc.). Lets the contractor proceed
                  WITHOUT a jurisdiction_id by manually picking a template
                  from a similar AHJ in the Advanced section below. The
                  packet generates with the template's defaults; the cover
                  sheet's AHJ name remains blank unless typed in via the
                  override panel. */}
              {searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-md p-3 mt-2 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-900">
                    <span className="font-semibold">
                      No results for &ldquo;{searchQuery}&rdquo;.
                    </span>{' '}
                    SparkPlan only has the major FL + TX AHJs in its search
                    index today. Don't worry — you can still proceed:
                    use <span className="font-medium">Advanced &middot; Use defaults from another AHJ</span>{' '}
                    below to borrow a similar AHJ's manifest. The cover sheet's
                    AHJ name will be blank unless you also fill in the override
                    fields.
                  </div>
                </div>
              )}

              {/* In-flight pick (chosen, not yet saved) */}
              {selectedJurisdiction && !isSelectionSaved && (
                <div className="border border-[#2d3b2d]/30 bg-[#f0f5f0] rounded p-3 mt-2 space-y-2">
                  <div className="text-sm">
                    <span className="font-medium text-[#111711]">
                      {selectedJurisdiction.jurisdiction_name}
                    </span>
                    {selectedJurisdiction.ahj_name && (
                      <span className="text-[#2d3b2d] ml-2">
                        • {selectedJurisdiction.ahj_name}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveToProject}
                    disabled={saveStatus === 'saving'}
                    className="w-full bg-[#2d3b2d] hover:bg-[#1f291f] text-white text-sm font-medium py-2 rounded transition-colors disabled:opacity-50"
                  >
                    {saveStatus === 'saving' ? 'Saving…' : 'Save to project'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Saved jurisdiction card */
            <div className="bg-[#f0f5f0] border border-[#2d3b2d]/30 rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-bold text-[#111711] flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {selectedJurisdiction.jurisdiction_name}
                  </h4>
                  {selectedJurisdiction.ahj_name && (
                    <p className="text-sm text-[#2d3b2d] mt-1">
                      Authority: {selectedJurisdiction.ahj_name}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-xs text-[#2d3b2d]">
                    <span>NEC {selectedJurisdiction.nec_edition}</span>
                    {selectedJurisdiction.estimated_review_days && (
                      <>
                        <span>•</span>
                        <span>
                          Review: ~{selectedJurisdiction.estimated_review_days} days
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearJurisdiction}
                  disabled={saveStatus === 'saving'}
                  className="flex items-center gap-1 border border-green-300 hover:border-red-400 hover:bg-red-50 hover:text-red-700 text-green-800 text-xs font-medium px-2 py-1 rounded transition-colors disabled:opacity-50 whitespace-nowrap"
                  title="Remove this jurisdiction so you can pick a different one"
                >
                  <X className="w-3 h-3" />
                  Clear
                </button>
              </div>
              {saveStatus === 'saved' && (
                <p className="text-xs text-green-700">✓ Saved to project</p>
              )}
              {saveStatus === 'error' && (
                <p className="text-xs text-red-700">
                  Save failed — try again
                </p>
              )}
            </div>
          )}

          {/* MANIFEST STATUS BADGE ---------------------------------------- */}
          {selectedJurisdiction && isSelectionSaved && (
            <>
              {hasAutoBoundManifest && !hasTemplateManifest && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-green-700 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-green-900">
                    <span className="font-semibold">
                      Full SparkPlan support.
                    </span>{' '}
                    {wizardAutoBoundManifest!.name}'s manifest is applied:
                    sheet ID prefix{' '}
                    <code className="bg-green-100 px-1 rounded text-xs">
                      {wizardAutoBoundManifest!.sheetIdPrefix}
                    </code>
                    , code references, NEC fork by building type, and lane-aware
                    section defaults all flow into the packet automatically.
                  </div>
                </div>
              )}
              {hasTemplateManifest && activeManifest && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-blue-700 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-900">
                    <span className="font-semibold">Template active:</span>{' '}
                    using <span className="font-medium">{activeManifest.name}</span>'s
                    defaults (sections, codes, narrative).{' '}
                    {selectedJurisdiction && (
                      <>
                        AHJ identity on the cover sheet stays{' '}
                        <span className="font-medium">
                          {selectedJurisdiction.jurisdiction_name}
                        </span>
                        .
                      </>
                    )}
                  </div>
                </div>
              )}
              {!hasAutoBoundManifest && !hasTemplateManifest && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-900">
                    <span className="font-semibold">
                      No SparkPlan manifest for this AHJ yet.
                    </span>{' '}
                    Pick a similar AHJ's defaults below, or proceed with the
                    generic Sprint 2A baseline (sheet ID{' '}
                    <code className="bg-amber-100 px-1 rounded text-xs">E-</code>,
                    generic codes, all sections default ON — toggle off what
                    you don't need in Configure Sections below).
                  </div>
                </div>
              )}
            </>
          )}

          {/* SPECIAL NOTES (from legacy jurisdictions table) -------------- */}
          {selectedJurisdiction && isSelectionSaved && selectedJurisdiction.notes && (
            <div className="bg-[#fff8e6] border border-[#c9a227]/40 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-[#c9a227] mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-semibold text-sm text-[#5a4500]">
                  Special notes
                </div>
                <div className="text-xs text-[#7a6200] mt-1">
                  {selectedJurisdiction.notes}
                </div>
              </div>
            </div>
          )}

          {/* ADVANCED SECTION ---------------------------------------------
              ALWAYS accessible (Sprint 2C M4 fix-up 2026-05-18): users
              whose AHJ isn't in the search index (Cape Coral, Sanford,
              Winter Park…) need to be able to pick a template + set
              overrides WITHOUT a saved jurisdiction. The previous gating
              on `selectedJurisdiction && isSelectionSaved` blocked that
              path; restoring the always-on behavior the original
              AHJTemplateAndOverridesPanel had. */}
          <div className="border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex items-center gap-1 text-sm font-medium text-[#2d3b2d] hover:text-[#1f291f]"
              >
                {showAdvanced ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                Advanced: customize AHJ defaults
                {!selectedJurisdiction && (
                  <span className="ml-2 text-xs text-gray-500">
                    (pick a template manually if your AHJ isn't listed)
                  </span>
                )}
                {(hasTemplateManifest || hasOverrides) && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                    customized
                  </span>
                )}
              </button>

              {showAdvanced && (
                <div className="mt-4 space-y-5 pl-1">
                  {/* TEMPLATE PICKER */}
                  <div>
                    <label
                      htmlFor="manifestTemplate"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      <Building2 className="w-4 h-4 inline mr-1 -mt-0.5 text-[#2d3b2d]" />
                      Use defaults from another AHJ
                    </label>
                    <select
                      id="manifestTemplate"
                      value={currentTemplateId ?? ''}
                      onChange={(e) => onSelectTemplate(e.target.value)}
                      className="w-full md:w-2/3 border border-gray-200 rounded px-3 py-2 text-sm focus:border-[#2d3b2d] focus:ring-2 focus:ring-[#2d3b2d]/20 outline-none"
                    >
                      <option value="">
                        {hasAutoBoundManifest
                          ? `Auto-detected from jurisdiction (${wizardAutoBoundManifest!.name})`
                          : 'None — use Sprint 2A generic defaults'}
                      </option>
                      {ALL_MANIFESTS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Only needed when your AHJ isn't fully modeled, or to
                      preview another AHJ's defaults. Does NOT change the AHJ
                      name on the cover sheet — that stays{' '}
                      <span className="font-medium">
                        {selectedJurisdiction.jurisdiction_name}
                      </span>
                      .
                    </p>
                  </div>

                  {/* OVERRIDE SUB-SECTION */}
                  <div className="border-t border-gray-100 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowOverrides((v) => !v)}
                      className="flex items-center gap-1 text-sm font-medium text-[#2d3b2d] hover:text-[#1f291f]"
                    >
                      {showOverrides ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      Override AHJ details (general notes, code refs, sheet prefix)
                    </button>

                    {showOverrides && (
                      <div className="mt-3 space-y-4">
                        {/* General notes override */}
                        <div>
                          <label
                            htmlFor="generalNotesOverride"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            General notes
                            <span className="text-gray-500 font-normal ml-2">
                              (one per line — empty = use manifest default)
                            </span>
                          </label>
                          <textarea
                            id="generalNotesOverride"
                            value={generalNotesText}
                            onChange={(e) => setGeneralNotesText(e.target.value)}
                            onBlur={() =>
                              onSetGeneralNotesOverride(parseLines(generalNotesText))
                            }
                            rows={5}
                            placeholder={
                              activeManifest
                                ? `Defaulting to ${activeManifest.name}'s general notes — paste your own here to override.`
                                : 'Paste your AHJ general notes, one per line.'
                            }
                            className="w-full font-mono text-xs border border-gray-200 rounded px-3 py-2 focus:border-[#2d3b2d] focus:ring-2 focus:ring-[#2d3b2d]/20 outline-none"
                          />
                        </div>

                        {/* Code references override */}
                        <div>
                          <label
                            htmlFor="codeReferencesOverride"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Code references
                            <span className="text-gray-500 font-normal ml-2">
                              (one per line — empty = use manifest default)
                            </span>
                          </label>
                          <textarea
                            id="codeReferencesOverride"
                            value={codeRefsText}
                            onChange={(e) => setCodeRefsText(e.target.value)}
                            onBlur={() =>
                              onSetCodeReferencesOverride(parseLines(codeRefsText))
                            }
                            rows={4}
                            placeholder={
                              activeManifest
                                ? `Defaulting to ${activeManifest.name}'s code references — paste your own here to override.`
                                : 'e.g., NFPA-70 (2020 NEC), FBC 8th ed (2023), Local Code Ch. 14'
                            }
                            className="w-full font-mono text-xs border border-gray-200 rounded px-3 py-2 focus:border-[#2d3b2d] focus:ring-2 focus:ring-[#2d3b2d]/20 outline-none"
                          />
                        </div>

                        {/* Sheet ID prefix override */}
                        <div>
                          <label
                            htmlFor="sheetIdPrefixOverride"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Sheet ID prefix
                          </label>
                          <select
                            id="sheetIdPrefixOverride"
                            value={sheetIdPrefixOverride ?? ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === '')
                                onSetSheetIdPrefixOverride(undefined);
                              else
                                onSetSheetIdPrefixOverride(v as AHJSheetIdPrefix);
                            }}
                            className="w-full md:w-1/3 border border-gray-200 rounded px-3 py-2 text-sm focus:border-[#2d3b2d] focus:ring-2 focus:ring-[#2d3b2d]/20 outline-none"
                          >
                            <option value="">
                              Use manifest default
                              {activeManifest ? ` (${activeManifest.sheetIdPrefix})` : ''}
                            </option>
                            <option value="E-">E-</option>
                            <option value="EL-">EL-</option>
                            <option value="ES-">ES-</option>
                          </select>
                          <p className="text-xs text-gray-500 mt-1">
                            Prefix applied to SparkPlan-generated electrical
                            sheets. User-uploaded artifacts keep their own
                            discipline letters (C, X, A, …).
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

          {/* AHJ WEBSITE LINK (footer) ----------------------------------- */}
          {selectedJurisdiction && isSelectionSaved && selectedJurisdiction.ahj_website && (
            <div className="text-right text-xs">
              <a
                href={selectedJurisdiction.ahj_website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#2d3b2d] hover:underline"
              >
                Visit {selectedJurisdiction.ahj_name || 'AHJ'} website →
              </a>
            </div>
          )}
        </>
      )}

      {/* Visual indicator when nothing is picked AND no template/overrides
          set. Suppressed once any Advanced field is configured, since the
          packet then has manifest-aware defaults via the template path. */}
      {!loading && !selectedJurisdiction && !hasTemplateManifest && !hasOverrides && (
        <div className="text-center py-4 text-gray-500 text-xs flex items-center justify-center gap-2 border-t border-gray-100">
          <CheckCircle className="w-3 h-3 opacity-30" />
          No jurisdiction selected — packet will use Sprint 2A generic defaults
        </div>
      )}
    </div>
  );
};
