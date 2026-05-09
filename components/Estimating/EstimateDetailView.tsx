import React, { useMemo, useState } from 'react';
import { ArrowLeft, Copy, Loader2 } from 'lucide-react';
import type { Database } from '@/lib/database.types';
import { useEstimateLineItems } from '@/hooks/useEstimateLineItems';
import {
  ALL_ESTIMATE_STATUSES,
  STATUS_LABELS,
  allowedNextStatuses,
  canTransition,
  type EstimateStatus,
} from '@/services/estimating/estimateStatusTransitions';
import {
  computeEstimateTotals,
  totalsForPersistence,
} from '@/services/estimating/estimateMath';
import { autoTakeoffFromProject } from '@/services/estimating/autoTakeoffFromProject';
import { usePanels } from '@/hooks/usePanels';
import { useCircuits } from '@/hooks/useCircuits';
import { useFeeders } from '@/hooks/useFeeders';
import { useTransformers } from '@/hooks/useTransformers';
import { showToast, toastMessages } from '@/lib/toast';
import { EstimateStatusPill } from './EstimateStatusPill';
import { EstimateOverviewTab } from './EstimateOverviewTab';
import { LineItemsTab } from './LineItemsTab';
import { BidOutputTab } from './BidOutputTab';

type Estimate = Database['public']['Tables']['estimates']['Row'];
type Project = Database['public']['Tables']['projects']['Row'];

type Tab = 'overview' | 'takeoff' | 'materials' | 'labor' | 'bid';

interface EstimateDetailViewProps {
  estimate: Estimate;
  project: Pick<Project, 'id' | 'name' | 'address'>;
  onBack: () => void;
  onUpdate: (id: string, patch: Partial<Estimate>) => Promise<void>;
  onClone: (id: string) => Promise<string | null>;
}

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'takeoff', label: 'Takeoff' },
  { key: 'materials', label: 'Materials' },
  { key: 'labor', label: 'Labor' },
  { key: 'bid', label: 'Bid Output' },
];

/**
 * Read the active tab from the URL hash query (e.g. `#/estimating?tab=labor`)
 * so a deep link survives a refresh.
 */
function readTabFromUrl(): Tab {
  if (typeof window === 'undefined') return 'overview';
  const hash = window.location.hash; // e.g. '#/estimating?tab=labor'
  const idx = hash.indexOf('?');
  if (idx < 0) return 'overview';
  const params = new URLSearchParams(hash.slice(idx + 1));
  const tab = params.get('tab') as Tab | null;
  return TABS.some((t) => t.key === tab) ? (tab as Tab) : 'overview';
}

function writeTabToUrl(tab: Tab) {
  if (typeof window === 'undefined') return;
  const hash = window.location.hash;
  const idx = hash.indexOf('?');
  const base = idx >= 0 ? hash.slice(0, idx) : hash;
  window.history.replaceState(null, '', `${base}?tab=${tab}`);
}

export const EstimateDetailView: React.FC<EstimateDetailViewProps> = ({
  estimate,
  project,
  onBack,
  onUpdate,
  onClone,
}) => {
  const [tab, setTab] = useState<Tab>(readTabFromUrl());
  const [cloning, setCloning] = useState(false);

  const {
    lineItems,
    loading: liLoading,
    createLineItem,
    updateLineItem,
    deleteLineItem,
    bulkInsert,
  } = useEstimateLineItems(estimate.id);

  const { panels } = usePanels(project.id);
  const { circuits } = useCircuits(project.id);
  const { feeders } = useFeeders(project.id);
  const { transformers } = useTransformers(project.id);

  // Recompute persisted totals whenever line items / markup / tax change.
  // Debounced via React's natural batching; we push to the DB on a coarser
  // trigger (header field updates, status changes) rather than on every
  // keystroke. The OverviewTab already shows the live re-computation.
  const totals = useMemo(
    () =>
      computeEstimateTotals({
        lineItems: lineItems.map((li) => ({
          category: li.category,
          quantity: li.quantity,
          unit_price: li.unit_price,
          taxable: li.taxable,
        })),
        markupPct: estimate.markup_pct,
        taxPct: estimate.tax_pct,
      }),
    [lineItems, estimate.markup_pct, estimate.tax_pct]
  );

  const persistTotals = async () => {
    const persist = totalsForPersistence(totals);
    if (
      persist.subtotal_materials === estimate.subtotal_materials &&
      persist.subtotal_labor === estimate.subtotal_labor &&
      persist.subtotal_other === estimate.subtotal_other &&
      persist.markup_amount === estimate.markup_amount &&
      persist.tax_amount === estimate.tax_amount &&
      persist.total === estimate.total
    ) {
      return;
    }
    await onUpdate(estimate.id, persist);
  };

  const handleHeaderUpdate = async (patch: Partial<Estimate>) => {
    // Persist the patch first; then recompute totals using the patched values.
    await onUpdate(estimate.id, patch);
    // Compute new totals from current line items + (potentially-changed)
    // markup/tax pct in patch.
    const nextMarkup = patch.markup_pct ?? estimate.markup_pct;
    const nextTax = patch.tax_pct ?? estimate.tax_pct;
    const recomputed = computeEstimateTotals({
      lineItems: lineItems.map((li) => ({
        category: li.category,
        quantity: li.quantity,
        unit_price: li.unit_price,
        taxable: li.taxable,
      })),
      markupPct: nextMarkup,
      taxPct: nextTax,
    });
    const persist = totalsForPersistence(recomputed);
    await onUpdate(estimate.id, persist);
  };

  const handleStatusChange = async (next: EstimateStatus) => {
    const current = estimate.status as EstimateStatus;
    if (!canTransition(current, next)) {
      showToast.error(`Cannot move estimate from ${STATUS_LABELS[current]} to ${STATUS_LABELS[next]}`);
      return;
    }
    const patch: Partial<Estimate> = { status: next };
    if (next === 'submitted' && !estimate.submitted_at) {
      patch.submitted_at = new Date().toISOString();
      // Default 30-day validity unless one is already set.
      if (!estimate.expires_at) {
        const expires = new Date();
        expires.setDate(expires.getDate() + 30);
        patch.expires_at = expires.toISOString();
      }
    }
    if ((next === 'accepted' || next === 'rejected') && !estimate.decided_at) {
      patch.decided_at = new Date().toISOString();
    }
    await onUpdate(estimate.id, patch);
    showToast.success(toastMessages.estimate.statusChanged);
  };

  const handleAddLine = async (seed: {
    category: 'material' | 'labor' | 'equipment' | 'subcontract' | 'other';
  }) => {
    const nextPos = lineItems.length > 0 ? Math.max(...lineItems.map((l) => l.position)) + 1 : 0;
    const isLabor = seed.category === 'labor';
    await createLineItem({
      estimate_id: estimate.id,
      position: nextPos,
      category: seed.category,
      description: 'New line item',
      quantity: 1,
      unit: isLabor ? 'hr' : 'ea',
      unit_cost: 0,
      unit_price: 0,
      source_kind: 'manual',
      source_id: null,
      taxable: !isLabor,
      notes: null,
    });
    // Persist totals after the next render — but we can call now too.
    void persistTotals();
  };

  const handleAutoTakeoff = async () => {
    const result = autoTakeoffFromProject({
      panels,
      circuits,
      feeders,
      transformers,
    });
    if (result.lineItems.length === 0) {
      showToast.error(toastMessages.estimate.autoTakeoff(0));
      return;
    }
    // Append after any existing rows.
    const offset =
      lineItems.length > 0 ? Math.max(...lineItems.map((l) => l.position)) + 1 : 0;
    const rows = result.lineItems.map((li) => ({
      estimate_id: estimate.id,
      position: li.position + offset,
      category: li.category,
      description: li.description,
      quantity: li.quantity,
      unit: li.unit,
      unit_cost: li.unit_cost,
      unit_price: li.unit_price,
      source_kind: li.source_kind,
      source_id: li.source_id,
      taxable: li.taxable,
      notes: li.notes,
    }));
    const inserted = await bulkInsert(rows);
    showToast.success(toastMessages.estimate.autoTakeoff(inserted.length));
    if (result.warnings.length > 0) {
      // Surface a single rolled-up warning toast instead of N popups.
      console.info('Auto-takeoff warnings:', result.warnings);
    }
    void persistTotals();
  };

  const handleClone = async () => {
    setCloning(true);
    try {
      const newId = await onClone(estimate.id);
      if (newId) {
        // Clone view back to overview of the new estimate via parent.
        onBack();
      }
    } finally {
      setCloning(false);
    }
  };

  const setActiveTab = (next: Tab) => {
    setTab(next);
    writeTabToUrl(next);
  };

  const status = estimate.status as EstimateStatus;
  const allowedTransitions = allowedNextStatuses(status);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" /> All estimates
        </button>
        <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          {estimate.name}
          <EstimateStatusPill status={estimate.status} />
          {estimate.revision > 1 && (
            <span className="text-sm font-normal text-gray-500">rev {estimate.revision}</span>
          )}
        </h2>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value as EstimateStatus)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-electric-500 focus:outline-none focus:ring-1 focus:ring-electric-500"
            title="Change status"
          >
            <option value={status}>{STATUS_LABELS[status]} (current)</option>
            {allowedTransitions.map((t) => (
              <option key={t} value={t}>
                → {STATUS_LABELS[t]}
              </option>
            ))}
          </select>
          <button
            onClick={handleClone}
            disabled={cloning}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            title="Create a new revision based on this estimate"
          >
            {cloning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            Clone as revision
          </button>
        </div>
      </div>

      {/* Tab strip */}
      <div className="border-b border-gray-200">
        <nav className="flex flex-wrap gap-1">
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-2 text-sm font-medium ${
                  active
                    ? 'border-b-2 border-electric-500 text-gray-900'
                    : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {tab === 'overview' && (
        <EstimateOverviewTab
          estimate={estimate}
          lineItems={lineItems}
          onUpdate={handleHeaderUpdate}
        />
      )}

      {tab === 'takeoff' && (
        <LineItemsTab
          lineItems={lineItems}
          onUpdate={async (id, patch) => {
            await updateLineItem(id, patch);
            void persistTotals();
          }}
          onDelete={async (id) => {
            await deleteLineItem(id);
            void persistTotals();
          }}
          onCreate={handleAddLine}
          onRunAutoTakeoff={handleAutoTakeoff}
          showAutoTakeoffButton
          estimateId={estimate.id}
        />
      )}

      {tab === 'materials' && (
        <LineItemsTab
          lineItems={lineItems}
          categoryFilter="material"
          onUpdate={async (id, patch) => {
            await updateLineItem(id, patch);
            void persistTotals();
          }}
          onDelete={async (id) => {
            await deleteLineItem(id);
            void persistTotals();
          }}
          onCreate={handleAddLine}
          estimateId={estimate.id}
        />
      )}

      {tab === 'labor' && (
        <LineItemsTab
          lineItems={lineItems}
          categoryFilter="labor"
          onUpdate={async (id, patch) => {
            await updateLineItem(id, patch);
            void persistTotals();
          }}
          onDelete={async (id) => {
            await deleteLineItem(id);
            void persistTotals();
          }}
          onCreate={handleAddLine}
          estimateId={estimate.id}
        />
      )}

      {tab === 'bid' && (
        <BidOutputTab
          estimate={estimate}
          lineItems={lineItems}
          project={project}
          onMarkGenerated={() =>
            onUpdate(estimate.id, { bid_pdf_generated_at: new Date().toISOString() })
          }
        />
      )}

      {liLoading && <div className="text-xs text-gray-500">Loading line items…</div>}
    </div>
  );
};
