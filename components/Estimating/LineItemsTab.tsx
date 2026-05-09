import React, { useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import type { Database } from '@/lib/database.types';
import { EstimateLineItemRow, LineItemTableHeader } from './EstimateLineItemRow';

type LineItem = Database['public']['Tables']['estimate_line_items']['Row'];
type LineItemUpdate = Database['public']['Tables']['estimate_line_items']['Update'];

interface LineItemsTabProps {
  /** Empty array allowed = empty state. */
  lineItems: LineItem[];
  /** When set, only items of this category are shown + the new-row button defaults to it. */
  categoryFilter?: 'material' | 'labor' | null;
  estimateId: string;
  /**
   * Set of capabilities the parent forwards from the hook. We don't import the hook
   * here because the parent already owns it and may want to inject test doubles.
   */
  onUpdate: (id: string, patch: LineItemUpdate) => void;
  onDelete: (id: string) => void;
  onCreate: (seed: { category: 'material' | 'labor' | 'equipment' | 'subcontract' | 'other' }) => void;
  onRunAutoTakeoff?: () => void;
  showAutoTakeoffButton?: boolean;
}

export const LineItemsTab: React.FC<LineItemsTabProps> = ({
  lineItems,
  categoryFilter,
  onUpdate,
  onDelete,
  onCreate,
  onRunAutoTakeoff,
  showAutoTakeoffButton,
}) => {
  const [newCategory, setNewCategory] = useState<
    'material' | 'labor' | 'equipment' | 'subcontract' | 'other'
  >(categoryFilter ?? 'material');

  const visible = categoryFilter
    ? lineItems.filter((li) => li.category === categoryFilter)
    : lineItems;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value as typeof newCategory)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-electric-500 focus:outline-none focus:ring-1 focus:ring-electric-500"
          disabled={!!categoryFilter}
        >
          <option value="material">Material</option>
          <option value="labor">Labor</option>
          <option value="equipment">Equipment</option>
          <option value="subcontract">Subcontract</option>
          <option value="other">Other</option>
        </select>
        <button
          onClick={() => onCreate({ category: categoryFilter ?? newCategory })}
          className="inline-flex items-center gap-1.5 rounded-md bg-electric-500 px-3 py-1.5 text-sm font-medium text-gray-900 hover:bg-electric-400"
        >
          <Plus className="h-4 w-4" /> Add line
        </button>
        {showAutoTakeoffButton && onRunAutoTakeoff && (
          <button
            onClick={onRunAutoTakeoff}
            className="inline-flex items-center gap-1.5 rounded-md border border-electric-500 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 hover:bg-electric-50"
            title="Re-run auto-takeoff and append to existing rows"
          >
            <Sparkles className="h-4 w-4 text-electric-600" /> Auto-takeoff
          </button>
        )}
        <span className="ml-auto text-xs text-gray-500">
          {visible.length} {visible.length === 1 ? 'row' : 'rows'}
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
          No line items{categoryFilter ? ` in ${categoryFilter}` : ''} yet. Add a row above
          {showAutoTakeoffButton ? ' or run auto-takeoff' : ''}.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full">
            <LineItemTableHeader />
            <tbody>
              {visible.map((item) => (
                <EstimateLineItemRow
                  key={item.id}
                  item={item}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
