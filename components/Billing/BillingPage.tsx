/**
 * BillingPage — top-level T&M Billing page for a project.
 *
 * Tab structure (Phase 1a):
 *   - Overview: project totals, breakdowns, recent activity
 *   - Time:     time entries CRUD
 *   - Materials: material entries CRUD
 *   - Invoices: placeholder ("Coming in Phase 1b") — replaced by InvoicesTab
 *               in the v1b branch
 *   - Settings: project billing rates, markup, customer info
 *
 * Active tab tracked via `?tab=` URL param so a contractor can deep-link to
 * "/project/abc/billing?tab=time".
 */

import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, BarChart3, Clock, Package, FileText, Settings } from 'lucide-react';
import { BillingOverviewTab } from './BillingOverviewTab';
import { TimeEntriesTab } from './TimeEntriesTab';
import { MaterialEntriesTab } from './MaterialEntriesTab';
import { BillingSettingsTab } from './BillingSettingsTab';
import { InvoicesTab } from './InvoicesTab';

type TabKey = 'overview' | 'time' | 'materials' | 'invoices' | 'settings';

const TABS: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'time', label: 'Time', icon: Clock },
  { key: 'materials', label: 'Materials', icon: Package },
  { key: 'invoices', label: 'Invoices', icon: FileText },
  { key: 'settings', label: 'Settings', icon: Settings },
];

const VALID_TABS = new Set<TabKey>(['overview', 'time', 'materials', 'invoices', 'settings']);

interface BillingPageProps {
  projectId: string;
}

export const BillingPage: React.FC<BillingPageProps> = ({ projectId }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: TabKey = useMemo(() => {
    const t = searchParams.get('tab');
    return t && VALID_TABS.has(t as TabKey) ? (t as TabKey) : 'overview';
  }, [searchParams]);

  const setTab = (k: TabKey) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', k);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <header className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <CreditCard className="w-5 h-5 text-[#666]" />
          <h1 className="text-xl font-semibold text-[#1a1a1a]">T&amp;M Billing</h1>
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
            beta
          </span>
        </div>
        <p className="text-sm text-[#666]">
          Track time and materials for this project. Generate invoices and record payments as
          work progresses.
        </p>
      </header>

      {/* Tabs */}
      <div className="border-b border-[#e8e6e3] mb-5">
        <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Billing sections">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = key === activeTab;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  active
                    ? 'border-[#2d3b2d] text-[#1a1a1a]'
                    : 'border-transparent text-[#666] hover:text-[#1a1a1a] hover:border-[#d0d0d0]'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab body */}
      <div>
        {activeTab === 'overview' && <BillingOverviewTab projectId={projectId} />}
        {activeTab === 'time' && <TimeEntriesTab projectId={projectId} />}
        {activeTab === 'materials' && <MaterialEntriesTab projectId={projectId} />}
        {activeTab === 'invoices' && <InvoicesTab projectId={projectId} />}
        {activeTab === 'settings' && <BillingSettingsTab projectId={projectId} />}
      </div>
    </div>
  );
};
