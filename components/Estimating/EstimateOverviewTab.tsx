import React from 'react';
import type { Database } from '@/lib/database.types';
import { computeEstimateTotals } from '@/services/estimating/estimateMath';

type Estimate = Database['public']['Tables']['estimates']['Row'];
type LineItem = Database['public']['Tables']['estimate_line_items']['Row'];

interface OverviewTabProps {
  estimate: Estimate;
  lineItems: LineItem[];
  onUpdate: (patch: Partial<Estimate>) => void;
}

const fmt$ = (n: number): string =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const EstimateOverviewTab: React.FC<OverviewTabProps> = ({
  estimate,
  lineItems,
  onUpdate,
}) => {
  const totals = computeEstimateTotals({
    lineItems: lineItems.map((li) => ({
      category: li.category,
      quantity: li.quantity,
      unit_price: li.unit_price,
      taxable: li.taxable,
    })),
    markupPct: estimate.markup_pct,
    taxPct: estimate.tax_pct,
  });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Money summary */}
      <div className="lg:col-span-1">
        <div className="rounded-lg border border-electric-300 bg-electric-50/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Bid summary
          </h3>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Materials</dt>
              <dd className="font-medium">{fmt$(totals.subtotalMaterials)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Labor</dt>
              <dd className="font-medium">{fmt$(totals.subtotalLabor)}</dd>
            </div>
            {totals.subtotalEquipment + totals.subtotalSubcontract + totals.subtotalOther > 0 && (
              <div className="flex justify-between">
                <dt className="text-gray-600">Other</dt>
                <dd className="font-medium">
                  {fmt$(
                    totals.subtotalEquipment + totals.subtotalSubcontract + totals.subtotalOther
                  )}
                </dd>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-300 pt-1">
              <dt className="text-gray-600">Subtotal</dt>
              <dd className="font-semibold">{fmt$(totals.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Markup ({estimate.markup_pct.toFixed(1)}%)</dt>
              <dd className="font-medium">+ {fmt$(totals.markupAmount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">
                Tax ({estimate.tax_pct.toFixed(2)}% on materials)
              </dt>
              <dd className="font-medium">+ {fmt$(totals.taxAmount)}</dd>
            </div>
            <div className="flex justify-between border-t-2 border-electric-500 pt-2">
              <dt className="text-base font-semibold">TOTAL</dt>
              <dd className="text-lg font-bold text-gray-900">{fmt$(totals.total)}</dd>
            </div>
          </dl>
        </div>

        {/* Markup + tax editor */}
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Markup &amp; tax
          </h3>
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Markup percent</span>
              <div className="relative mt-1">
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  max={100}
                  value={estimate.markup_pct}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) onUpdate({ markup_pct: v });
                  }}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 pr-8 text-sm focus:border-electric-500 focus:outline-none focus:ring-1 focus:ring-electric-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                  %
                </span>
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Sales tax percent</span>
              <div className="relative mt-1">
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  value={estimate.tax_pct}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) onUpdate({ tax_pct: v });
                  }}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 pr-8 text-sm focus:border-electric-500 focus:outline-none focus:ring-1 focus:ring-electric-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                  %
                </span>
              </div>
              <span className="mt-0.5 block text-[11px] text-gray-500">
                Applied to taxable line items only.
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Customer + scope */}
      <div className="space-y-4 lg:col-span-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">Customer</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Name</span>
              <input
                type="text"
                value={estimate.customer_name ?? ''}
                onChange={(e) => onUpdate({ customer_name: e.target.value || null })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-electric-500 focus:outline-none focus:ring-1 focus:ring-electric-500"
                placeholder="e.g. Smith Residence"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Email</span>
              <input
                type="email"
                value={estimate.customer_email ?? ''}
                onChange={(e) => onUpdate({ customer_email: e.target.value || null })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-electric-500 focus:outline-none focus:ring-1 focus:ring-electric-500"
                placeholder="customer@example.com"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-gray-700">Address</span>
              <input
                type="text"
                value={estimate.customer_address ?? ''}
                onChange={(e) => onUpdate({ customer_address: e.target.value || null })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-electric-500 focus:outline-none focus:ring-1 focus:ring-electric-500"
                placeholder="Street, city, state, zip"
              />
            </label>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">Scope</h3>
          <textarea
            value={estimate.scope_summary ?? ''}
            onChange={(e) => onUpdate({ scope_summary: e.target.value || null })}
            rows={4}
            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-electric-500 focus:outline-none focus:ring-1 focus:ring-electric-500"
            placeholder="200A service upgrade including EV charger circuit. New main panel, feeder…"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Exclusions
            </h3>
            <textarea
              value={estimate.exclusions ?? ''}
              onChange={(e) => onUpdate({ exclusions: e.target.value || null })}
              rows={3}
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-electric-500 focus:outline-none focus:ring-1 focus:ring-electric-500"
              placeholder="Permits and impact fees billed separately."
            />
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Payment terms
            </h3>
            <textarea
              value={estimate.payment_terms ?? ''}
              onChange={(e) => onUpdate({ payment_terms: e.target.value || null })}
              rows={3}
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-electric-500 focus:outline-none focus:ring-1 focus:ring-electric-500"
              placeholder="50% deposit, balance on completion."
            />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Internal notes (not shown to customer)
          </h3>
          <textarea
            value={estimate.internal_notes ?? ''}
            onChange={(e) => onUpdate({ internal_notes: e.target.value || null })}
            rows={2}
            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-electric-500 focus:outline-none focus:ring-1 focus:ring-electric-500"
            placeholder="Why this markup, what was a guess, follow-ups…"
          />
        </div>
      </div>
    </div>
  );
};
