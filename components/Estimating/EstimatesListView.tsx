import React, { useState } from 'react';
import { Plus, Calculator, Sparkles, Trash2, ChevronRight } from 'lucide-react';
import type { Database } from '@/lib/database.types';
import { EstimateStatusPill } from './EstimateStatusPill';

type Estimate = Database['public']['Tables']['estimates']['Row'];

interface EstimatesListViewProps {
  estimates: Estimate[];
  loading: boolean;
  onSelect: (id: string) => void;
  onCreate: (opts: { name: string; runAutoTakeoff: boolean }) => Promise<void>;
  onDelete: (id: string) => void;
}

const fmt$ = (n: number): string =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const fmtDate = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const EstimatesListView: React.FC<EstimatesListViewProps> = ({
  estimates,
  loading,
  onSelect,
  onCreate,
  onDelete,
}) => {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('Initial bid');
  const [runAutoTakeoff, setRunAutoTakeoff] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onCreate({ name: name.trim(), runAutoTakeoff });
      setShowCreate(false);
      setName('Initial bid');
      setRunAutoTakeoff(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Estimates for this project</h2>
          <p className="text-sm text-gray-500">
            {estimates.length} {estimates.length === 1 ? 'estimate' : 'estimates'}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-md bg-electric-500 px-3 py-2 text-sm font-medium text-gray-900 shadow-sm hover:bg-electric-400"
        >
          <Plus className="h-4 w-4" /> New estimate
        </button>
      </div>

      {showCreate && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Create estimate</h3>
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-electric-500 focus:outline-none focus:ring-1 focus:ring-electric-500"
                placeholder="e.g. Initial bid"
                disabled={submitting}
              />
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={runAutoTakeoff}
                onChange={(e) => setRunAutoTakeoff(e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-electric-500 focus:ring-electric-500"
                disabled={submitting}
              />
              <span className="text-xs text-gray-700">
                <span className="inline-flex items-center gap-1 font-medium">
                  <Sparkles className="h-3 w-3 text-electric-500" /> Auto-populate takeoff from project
                </span>
                <span className="block text-gray-500">
                  Reads existing panels, feeders, circuits, and transformers and seeds line items
                  with starter pricing. You can edit anything.
                </span>
              </span>
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-md px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting || !name.trim()}
                className="rounded-md bg-electric-500 px-3 py-1.5 text-sm font-medium text-gray-900 hover:bg-electric-400 disabled:opacity-50"
              >
                {submitting ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="text-sm text-gray-500">Loading estimates…</div>}

      {!loading && estimates.length === 0 && !showCreate && (
        <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
          <Calculator className="mx-auto h-10 w-10 text-gray-300" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No estimates yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Create the first estimate for this project. SparkPlan will pre-populate the takeoff from
            your existing panels, feeders, and circuits.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-electric-500 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-electric-400"
          >
            <Plus className="h-4 w-4" /> Create estimate
          </button>
        </div>
      )}

      <ul className="space-y-2">
        {estimates.map((e) => (
          <li key={e.id}>
            <button
              onClick={() => onSelect(e.id)}
              className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm hover:border-electric-500 hover:shadow"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-semibold text-gray-900">{e.name}</h3>
                  <EstimateStatusPill status={e.status} />
                  {e.revision > 1 && (
                    <span className="text-xs text-gray-500">rev {e.revision}</span>
                  )}
                </div>
                <p className="mt-1 truncate text-xs text-gray-500">
                  {e.customer_name ?? '(no customer)'} · created {fmtDate(e.created_at)}
                  {e.submitted_at ? ` · submitted ${fmtDate(e.submitted_at)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3 pl-3">
                <span className="text-base font-semibold text-gray-900">{fmt$(e.total)}</span>
                <button
                  onClick={(ev) => {
                    ev.stopPropagation();
                    if (window.confirm(`Delete "${e.name}"? This cannot be undone.`)) onDelete(e.id);
                  }}
                  className="rounded p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-600"
                  title="Delete estimate"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
