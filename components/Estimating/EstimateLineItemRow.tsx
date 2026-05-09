import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import type { Database } from '@/lib/database.types';
import { computeLineTotal } from '@/services/estimating/estimateMath';

type LineItem = Database['public']['Tables']['estimate_line_items']['Row'];

interface EstimateLineItemRowProps {
  item: LineItem;
  onUpdate: (id: string, patch: Partial<LineItem>) => void;
  onDelete: (id: string) => void;
}

const fmt$ = (n: number): string =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Editable inline row used in the Takeoff / Materials / Labor tabs.
 * Local input state so a partial number ("1.") doesn't immediately propagate;
 * commits on blur / change.
 */
export const EstimateLineItemRow: React.FC<EstimateLineItemRowProps> = ({
  item,
  onUpdate,
  onDelete,
}) => {
  const [description, setDescription] = useState(item.description);
  const [quantity, setQuantity] = useState<string>(String(item.quantity));
  const [unit, setUnit] = useState<string>(item.unit ?? '');
  const [unitPrice, setUnitPrice] = useState<string>(String(item.unit_price));
  const [taxable, setTaxable] = useState<boolean>(item.taxable);

  // Sync from prop when the row changes server-side (realtime).
  useEffect(() => {
    setDescription(item.description);
    setQuantity(String(item.quantity));
    setUnit(item.unit ?? '');
    setUnitPrice(String(item.unit_price));
    setTaxable(item.taxable);
  }, [item.id, item.description, item.quantity, item.unit, item.unit_price, item.taxable]);

  const lineTotal = computeLineTotal(Number(quantity) || 0, Number(unitPrice) || 0);

  const commit = (patch: Partial<LineItem>) => {
    onUpdate(item.id, patch);
  };

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-2 py-1.5 text-xs">
        <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-600">
          {item.category}
        </span>
        {item.source_kind && item.source_kind !== 'manual' && (
          <span className="ml-1 text-[10px] text-electric-600">from {item.source_kind}</span>
        )}
      </td>
      <td className="px-2 py-1.5">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== item.description && commit({ description })}
          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-gray-200 focus:border-electric-500 focus:outline-none"
        />
      </td>
      <td className="px-2 py-1.5 text-right">
        <input
          type="number"
          step="any"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          onBlur={() => {
            const q = Number(quantity);
            if (Number.isFinite(q) && q !== item.quantity) commit({ quantity: q });
          }}
          className="w-20 rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-xs hover:border-gray-200 focus:border-electric-500 focus:outline-none"
        />
      </td>
      <td className="px-2 py-1.5">
        <input
          type="text"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          onBlur={() => unit !== (item.unit ?? '') && commit({ unit: unit || null })}
          className="w-14 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-gray-200 focus:border-electric-500 focus:outline-none"
          placeholder="ea"
        />
      </td>
      <td className="px-2 py-1.5 text-right">
        <input
          type="number"
          step="any"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          onBlur={() => {
            const p = Number(unitPrice);
            if (Number.isFinite(p) && p !== item.unit_price) commit({ unit_price: p });
          }}
          className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-xs hover:border-gray-200 focus:border-electric-500 focus:outline-none"
        />
      </td>
      <td className="px-2 py-1.5 text-right text-xs font-semibold">{fmt$(lineTotal)}</td>
      <td className="px-2 py-1.5 text-center">
        <input
          type="checkbox"
          checked={taxable}
          onChange={(e) => {
            setTaxable(e.target.checked);
            commit({ taxable: e.target.checked });
          }}
          className="rounded border-gray-300 text-electric-500 focus:ring-electric-500"
          title="Taxable?"
        />
      </td>
      <td className="px-2 py-1.5 text-right">
        <button
          onClick={() => {
            if (window.confirm('Remove this line item?')) onDelete(item.id);
          }}
          className="rounded p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-600"
          title="Delete row"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
};

export const LineItemTableHeader: React.FC = () => (
  <thead className="bg-gray-50">
    <tr>
      <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-600">
        Cat
      </th>
      <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-600">
        Description
      </th>
      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-600">
        Qty
      </th>
      <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-600">
        Unit
      </th>
      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-600">
        Unit price
      </th>
      <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-600">
        Total
      </th>
      <th className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-600">
        Tax
      </th>
      <th className="px-2 py-2"></th>
    </tr>
  </thead>
);
