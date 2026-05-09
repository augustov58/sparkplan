/**
 * PermitsPage — Phase 1 Permits Beta v1
 *
 * Top-level tabbed page replacing the PR #29 PermitsStub. Tabs:
 *   1. Overview     — at-a-glance cards + recent activity
 *   2. Permits      — full list, click row -> drawer, CRUD
 *   3. Inspections  — flat list across all permits, CRUD
 *   4. Issues       — wraps existing IssuesLog component (no UI change)
 *
 * Tab persistence: `?tab=` URL param (overview | permits | inspections | issues).
 * Default = overview when missing/invalid.
 *
 * Sidebar entry + FeatureGate are controlled upstream (PR #29 + App.tsx).
 */
import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import type { Project } from '../../types';
import { PermitsOverviewTab } from './PermitsOverviewTab';
import { PermitsListTab } from './PermitsListTab';
import { InspectionsListTab } from './InspectionsListTab';
import { IssuesTab } from './IssuesTab';

interface PermitsPageProps {
  project: Project;
  updateProject: (p: Project) => void;
}

const TABS = ['overview', 'permits', 'inspections', 'issues'] as const;
type TabId = (typeof TABS)[number];

const TAB_LABELS: Record<TabId, string> = {
  overview: 'Overview',
  permits: 'Permits',
  inspections: 'Inspections',
  issues: 'Issues',
};

export const PermitsPage: React.FC<PermitsPageProps> = ({
  project,
  updateProject,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab: TabId = useMemo(() => {
    return TABS.includes(rawTab as TabId) ? (rawTab as TabId) : 'overview';
  }, [rawTab]);

  const setTab = (tab: TabId) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: false });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
            <FileText className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h1 className="text-2xl font-light text-gray-900 flex items-center gap-2">
              Permits
              <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                beta
              </span>
            </h1>
            <p className="text-sm text-gray-500">
              Track submissions, AHJ review, approvals, inspections, and
              corrections.
            </p>
          </div>
        </div>
      </div>

      {/* Tab strip */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6" aria-label="Permits tabs">
          {TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setTab(tab)}
                className={`pb-2.5 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-[#2d3b2d] text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                {TAB_LABELS[tab]}
              </button>
            );
          })}
        </nav>
      </div>

      <div>
        {activeTab === 'overview' && (
          <PermitsOverviewTab
            projectId={project.id}
            onSwitchToPermits={() => setTab('permits')}
          />
        )}
        {activeTab === 'permits' && <PermitsListTab projectId={project.id} />}
        {activeTab === 'inspections' && (
          <InspectionsListTab projectId={project.id} />
        )}
        {activeTab === 'issues' && (
          <IssuesTab project={project} updateProject={updateProject} />
        )}
      </div>
    </div>
  );
};
