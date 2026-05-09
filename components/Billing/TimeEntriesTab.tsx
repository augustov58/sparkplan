/**
 * TimeEntriesTab — list view + create/edit drawer for project time entries.
 *
 * Layout:
 *   [Filter row: month, worker, +Add button]
 *   [Table: Date | Worker | Hours | Cost code | Description | Billable | (...)]
 *   [Total bar: Period hours, Period billable]
 *
 * The filter month is local-only state (URL sync would be nice but adds noise
 * — Phase 1 keeps it simple).
 */

import React, { useMemo, useState } from 'react';
import { Plus, Pencil, Inbox, Calendar } from 'lucide-react';
import { Button } from '../ui/Button';
import { TimeEntryEditor } from './TimeEntryEditor';
import { AmountDisplay } from './AmountDisplay';
import { useTimeEntries, type TimeEntryInput } from '@/hooks/useTimeEntries';
import { useProjectBillingSettings } from '@/hooks/useProjectBillingSettings';
import { sumTimeEntries, formatHours } from '@/services/billing/billingMath';
import type { Database } from '@/lib/database.types';

type TimeEntry = Database['public']['Tables']['time_entries']['Row'];

interface TimeEntriesTabProps {
  projectId: string;
}

/** YYYY-MM key for grouping. Pass an ISO date `YYYY-MM-DD`. */
function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

export const TimeEntriesTab: React.FC<TimeEntriesTabProps> = ({ projectId }) => {
  const { timeEntries, loading, createTimeEntry, updateTimeEntry, deleteTimeEntry } =
    useTimeEntries(projectId);
  const { settings } = useProjectBillingSettings(projectId);

  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [workerFilter, setWorkerFilter] = useState<string>('all');

  // Distinct months + workers for the filter dropdowns
  const { months, workers } = useMemo(() => {
    const ms = new Set<string>();
    const ws = new Set<string>();
    for (const e of timeEntries) {
      ms.add(monthKey(e.work_date));
      ws.add(e.worker_name);
    }
    return {
      months: Array.from(ms).sort().reverse(),
      workers: Array.from(ws).sort(),
    };
  }, [timeEntries]);

  // Default to current month if it has entries; else 'all'
  React.useEffect(() => {
    if (monthFilter === 'all' && timeEntries.length > 0 && months.includes(currentMonthKey())) {
      setMonthFilter(currentMonthKey());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeEntries.length]);

  const filtered = useMemo(() => {
    return timeEntries.filter((e) => {
      if (monthFilter !== 'all' && monthKey(e.work_date) !== monthFilter) return false;
      if (workerFilter !== 'all' && e.worker_name !== workerFilter) return false;
      return true;
    });
  }, [timeEntries, monthFilter, workerFilter]);

  const totals = useMemo(() => sumTimeEntries(filtered), [filtered]);

  const handleSubmitCreate = async (values: TimeEntryInput) => {
    await createTimeEntry(values);
    setCreating(false);
  };

  const handleSubmitEdit = async (values: TimeEntryInput) => {
    if (!editing) return;
    await updateTimeEntry(editing.id, values);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!editing) return;
    await deleteTimeEntry(editing.id);
    setEditing(null);
  };

  return (
    <div>
      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#666]" />
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="px-2 py-1.5 text-sm border border-[#e8e6e3] rounded bg-white"
          >
            <option value="all">All months</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <select
          value={workerFilter}
          onChange={(e) => setWorkerFilter(e.target.value)}
          className="px-2 py-1.5 text-sm border border-[#e8e6e3] rounded bg-white"
        >
          <option value="all">All workers</option>
          {workers.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>

        <div className="ml-auto">
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setCreating(true)}
          >
            Add entry
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#e8e6e3] rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-[#666]">Loading time entries...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Inbox className="w-8 h-8 text-[#aaa] mx-auto mb-3" />
            <p className="text-sm text-[#666] mb-3">
              {timeEntries.length === 0
                ? 'No time entries yet. Log your first hours to start billing this project.'
                : 'No entries match the current filters.'}
            </p>
            {timeEntries.length === 0 && (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => setCreating(true)}
              >
                Add first entry
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#faf9f7] text-[#444]">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-left font-medium">Worker</th>
                <th className="px-3 py-2 text-right font-medium">Hours</th>
                <th className="px-3 py-2 text-left font-medium">Cost code</th>
                <th className="px-3 py-2 text-left font-medium">Description</th>
                <th className="px-3 py-2 text-right font-medium">Billable</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0eeeb]">
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-[#faf9f7]">
                  <td className="px-3 py-2 tabular-nums text-[#444]">{e.work_date}</td>
                  <td className="px-3 py-2 text-[#1a1a1a]">{e.worker_name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{e.hours.toFixed(1)}</td>
                  <td className="px-3 py-2 text-[#666]">{e.cost_code || '—'}</td>
                  <td className="px-3 py-2 text-[#444] max-w-xs truncate">
                    {e.description || '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <AmountDisplay value={e.billable_amount} />
                    {e.invoice_id && (
                      <div className="text-[10px] text-[#888] uppercase tracking-wide">billed</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setEditing(e)}
                      className="p-1 rounded hover:bg-[#f0eeeb] text-[#666]"
                      aria-label="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-[#faf9f7]">
              <tr className="text-sm">
                <td className="px-3 py-2 text-[#666]" colSpan={2}>
                  {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
                </td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">
                  {formatHours(totals.hours)}
                </td>
                <td colSpan={2}></td>
                <td className="px-3 py-2 text-right font-semibold">
                  <AmountDisplay value={totals.billable} />
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Editor */}
      {creating && (
        <TimeEntryEditor
          settings={settings}
          onSubmit={handleSubmitCreate}
          onClose={() => setCreating(false)}
        />
      )}
      {editing && (
        <TimeEntryEditor
          entry={editing}
          settings={settings}
          onSubmit={handleSubmitEdit}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
};
