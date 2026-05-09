/**
 * MaterialEntriesTab — list view + create/edit drawer for material entries.
 *
 * Layout matches `TimeEntriesTab` for consistency: month + filter row, table,
 * total bar.
 */

import React, { useMemo, useState } from 'react';
import { Plus, Pencil, Inbox, Calendar } from 'lucide-react';
import { Button } from '../ui/Button';
import { MaterialEntryEditor } from './MaterialEntryEditor';
import { AmountDisplay } from './AmountDisplay';
import {
  useMaterialEntries,
  type MaterialEntryInput,
} from '@/hooks/useMaterialEntries';
import { useProjectBillingSettings } from '@/hooks/useProjectBillingSettings';
import { sumMaterialEntries, formatUSD } from '@/services/billing/billingMath';
import type { Database } from '@/lib/database.types';

type MaterialEntry = Database['public']['Tables']['material_entries']['Row'];

interface MaterialEntriesTabProps {
  projectId: string;
}

function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}
function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

export const MaterialEntriesTab: React.FC<MaterialEntriesTabProps> = ({ projectId }) => {
  const {
    materialEntries,
    loading,
    createMaterialEntry,
    updateMaterialEntry,
    deleteMaterialEntry,
  } = useMaterialEntries(projectId);
  const { settings } = useProjectBillingSettings(projectId);

  const [editing, setEditing] = useState<MaterialEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const [monthFilter, setMonthFilter] = useState<string>('all');

  const months = useMemo(() => {
    const ms = new Set<string>();
    for (const e of materialEntries) ms.add(monthKey(e.installed_date));
    return Array.from(ms).sort().reverse();
  }, [materialEntries]);

  React.useEffect(() => {
    if (
      monthFilter === 'all' &&
      materialEntries.length > 0 &&
      months.includes(currentMonthKey())
    ) {
      setMonthFilter(currentMonthKey());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialEntries.length]);

  const filtered = useMemo(() => {
    return materialEntries.filter((e) => {
      if (monthFilter !== 'all' && monthKey(e.installed_date) !== monthFilter) return false;
      return true;
    });
  }, [materialEntries, monthFilter]);

  const totals = useMemo(() => sumMaterialEntries(filtered), [filtered]);

  const handleSubmitCreate = async (values: MaterialEntryInput) => {
    await createMaterialEntry(values);
    setCreating(false);
  };

  const handleSubmitEdit = async (values: MaterialEntryInput) => {
    if (!editing) return;
    await updateMaterialEntry(editing.id, values);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!editing) return;
    await deleteMaterialEntry(editing.id);
    setEditing(null);
  };

  return (
    <div>
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

        <div className="ml-auto">
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setCreating(true)}
          >
            Add material
          </Button>
        </div>
      </div>

      <div className="bg-white border border-[#e8e6e3] rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-[#666]">Loading material entries...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Inbox className="w-8 h-8 text-[#aaa] mx-auto mb-3" />
            <p className="text-sm text-[#666] mb-3">
              {materialEntries.length === 0
                ? 'No material entries yet. Log materials installed on this project to bill the customer.'
                : 'No entries match the current filter.'}
            </p>
            {materialEntries.length === 0 && (
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
                <th className="px-3 py-2 text-left font-medium">Description</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 text-right font-medium">Unit price</th>
                <th className="px-3 py-2 text-right font-medium">Markup</th>
                <th className="px-3 py-2 text-right font-medium">Line total</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0eeeb]">
              {filtered.map((m) => (
                <tr key={m.id} className="hover:bg-[#faf9f7]">
                  <td className="px-3 py-2 tabular-nums text-[#444]">{m.installed_date}</td>
                  <td className="px-3 py-2 text-[#1a1a1a] max-w-xs truncate">
                    {m.description}
                    {m.cost_code && (
                      <span className="ml-1 text-xs text-[#888]">[{m.cost_code}]</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {m.quantity}
                    {m.unit ? ` ${m.unit}` : ''}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatUSD(m.billing_unit_price)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#666]">
                    {m.markup_pct}%
                  </td>
                  <td className="px-3 py-2 text-right">
                    <AmountDisplay value={m.billing_amount} />
                    {!m.taxable && (
                      <div className="text-[10px] text-[#888] uppercase tracking-wide">
                        non-taxable
                      </div>
                    )}
                    {m.invoice_id && (
                      <div className="text-[10px] text-[#888] uppercase tracking-wide">billed</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setEditing(m)}
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
              <tr>
                <td className="px-3 py-2 text-[#666]" colSpan={5}>
                  {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
                  {totals.taxable > 0 && totals.nonTaxable > 0 && (
                    <span className="ml-2 text-xs">
                      (taxable {formatUSD(totals.taxable)} • non-taxable{' '}
                      {formatUSD(totals.nonTaxable)})
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  <AmountDisplay value={totals.billing} />
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {creating && (
        <MaterialEntryEditor
          settings={settings}
          onSubmit={handleSubmitCreate}
          onClose={() => setCreating(false)}
        />
      )}
      {editing && (
        <MaterialEntryEditor
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
