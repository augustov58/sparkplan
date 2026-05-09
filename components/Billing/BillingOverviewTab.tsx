/**
 * BillingOverviewTab — project-level totals + recent activity feed.
 *
 * Phase 1a surfaces:
 *   - Total billable (labor + materials) across the project
 *   - Total cost (labor + materials, when known)
 *   - Profit + margin %
 *   - Counts of unbilled time entries / material lines
 *   - Recent activity (last 5 entries across both tables, newest first)
 *
 * Phase 1b will add invoice-level totals (paid / outstanding / overdue).
 */

import React, { useMemo } from 'react';
import { Clock, Package, TrendingUp, AlertTriangle, FileText } from 'lucide-react';
import { AmountDisplay } from './AmountDisplay';
import { useTimeEntries } from '@/hooks/useTimeEntries';
import { useMaterialEntries } from '@/hooks/useMaterialEntries';
import { useInvoices } from '@/hooks/useInvoices';
import {
  sumTimeEntries,
  sumMaterialEntries,
  summarizeProfit,
  formatHours,
  formatPct,
  formatUSD,
} from '@/services/billing/billingMath';

interface BillingOverviewTabProps {
  projectId: string;
}

export const BillingOverviewTab: React.FC<BillingOverviewTabProps> = ({ projectId }) => {
  const { timeEntries, loading: timeLoading } = useTimeEntries(projectId);
  const { materialEntries, loading: matLoading } = useMaterialEntries(projectId);
  const { invoices, loading: invLoading } = useInvoices(projectId);

  const timeAgg = useMemo(() => sumTimeEntries(timeEntries), [timeEntries]);
  const matAgg = useMemo(() => sumMaterialEntries(materialEntries), [materialEntries]);
  const profit = useMemo(() => summarizeProfit(timeAgg, matAgg), [timeAgg, matAgg]);

  const unbilledTime = timeEntries.filter((t) => !t.invoice_id);
  const unbilledMat = materialEntries.filter((m) => !m.invoice_id);
  const unbilledTimeAgg = sumTimeEntries(unbilledTime);
  const unbilledMatAgg = sumMaterialEntries(unbilledMat);
  const unbilledTotal = unbilledTimeAgg.billable + unbilledMatAgg.billing;

  // Invoice rollup: skip cancelled when reporting paid/outstanding
  const liveInvoices = invoices.filter((i) => i.status !== 'cancelled');
  const totalInvoiced = liveInvoices.reduce((acc, i) => acc + i.total, 0);
  const totalPaid = liveInvoices.reduce((acc, i) => acc + i.paid_amount, 0);
  const totalOutstanding = liveInvoices.reduce((acc, i) => acc + i.balance_due, 0);
  const overdueCount = liveInvoices.filter((i) => i.status === 'overdue').length;

  type ActivityRow = { date: string; type: 'time' | 'material'; label: string; amount: number };
  const recent: ActivityRow[] = [
    ...timeEntries.slice(0, 5).map((t) => ({
      date: t.work_date,
      type: 'time' as const,
      label: `${t.worker_name} — ${formatHours(t.hours)}${t.cost_code ? ` (${t.cost_code})` : ''}`,
      amount: t.billable_amount,
    })),
    ...materialEntries.slice(0, 5).map((m) => ({
      date: m.installed_date,
      type: 'material' as const,
      label: `${m.description}${m.unit ? ` (${m.quantity} ${m.unit})` : ''}`,
      amount: m.billing_amount,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  const loading = timeLoading || matLoading || invLoading;

  return (
    <div className="space-y-6">
      {/* Top KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Invoiced"
          value={formatUSD(totalInvoiced)}
          icon={<FileText className="w-4 h-4 text-[#666]" />}
          subline={`${liveInvoices.length} ${liveInvoices.length === 1 ? 'invoice' : 'invoices'}`}
          loading={loading}
        />
        <KpiCard
          label="Paid"
          value={formatUSD(totalPaid)}
          accent={totalPaid > 0 ? 'green' : 'neutral'}
          loading={loading}
        />
        <KpiCard
          label="Outstanding"
          value={formatUSD(totalOutstanding)}
          accent={overdueCount > 0 ? 'red' : totalOutstanding > 0 ? 'amber' : 'neutral'}
          subline={overdueCount > 0 ? `${overdueCount} overdue` : undefined}
          icon={<AlertTriangle className="w-4 h-4 text-[#666]" />}
          loading={loading}
        />
        <KpiCard
          label="Unbilled"
          value={formatUSD(unbilledTotal)}
          accent={unbilledTotal > 0 ? 'amber' : 'neutral'}
          subline={`${unbilledTime.length} time + ${unbilledMat.length} material`}
          loading={loading}
        />
      </div>

      {/* Profit row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard
          label="Billable (logged)"
          value={formatUSD(profit.revenue)}
          icon={<TrendingUp className="w-4 h-4 text-[#666]" />}
          loading={loading}
        />
        <KpiCard
          label="Cost"
          value={profit.costPartial ? '—' : formatUSD(profit.cost)}
          subline={profit.costPartial ? 'Some entries omitted cost' : undefined}
          loading={loading}
        />
        <KpiCard
          label="Profit"
          value={profit.costPartial ? '—' : formatUSD(profit.profit)}
          subline={
            profit.marginPct === null
              ? profit.costPartial
                ? 'Add cost rates to compute'
                : undefined
              : `${formatPct(profit.marginPct)} margin`
          }
          accent={profit.profit < 0 ? 'red' : profit.profit > 0 ? 'green' : 'neutral'}
          loading={loading}
        />
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="bg-white border border-[#e8e6e3] rounded-lg p-4">
          <h3 className="text-sm font-semibold text-[#1a1a1a] mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#666]" />
            Labor
          </h3>
          <dl className="space-y-2 text-sm">
            <Row label="Total hours" value={formatHours(timeAgg.hours)} />
            <Row label="Billable" value={<AmountDisplay value={timeAgg.billable} />} />
            <Row
              label="Cost"
              value={timeAgg.cost === null ? '—' : <AmountDisplay value={timeAgg.cost} />}
            />
            <Row label="Entries" value={timeEntries.length.toString()} />
            <Row
              label="Unbilled"
              value={
                <span className="text-[#444]">
                  {unbilledTime.length} entries •{' '}
                  <AmountDisplay value={unbilledTimeAgg.billable} />
                </span>
              }
            />
          </dl>
        </section>

        <section className="bg-white border border-[#e8e6e3] rounded-lg p-4">
          <h3 className="text-sm font-semibold text-[#1a1a1a] mb-3 flex items-center gap-2">
            <Package className="w-4 h-4 text-[#666]" />
            Materials
          </h3>
          <dl className="space-y-2 text-sm">
            <Row label="Billing total" value={<AmountDisplay value={matAgg.billing} />} />
            <Row label="Cost" value={<AmountDisplay value={matAgg.cost} />} />
            <Row label="Taxable" value={<AmountDisplay value={matAgg.taxable} />} />
            <Row label="Non-taxable" value={<AmountDisplay value={matAgg.nonTaxable} />} />
            <Row
              label="Unbilled"
              value={
                <span className="text-[#444]">
                  {unbilledMat.length} items •{' '}
                  <AmountDisplay value={unbilledMatAgg.billing} />
                </span>
              }
            />
          </dl>
        </section>
      </div>

      {/* Recent activity */}
      <section className="bg-white border border-[#e8e6e3] rounded-lg p-4">
        <h3 className="text-sm font-semibold text-[#1a1a1a] mb-3">Recent activity</h3>
        {loading ? (
          <p className="text-sm text-[#666]">Loading...</p>
        ) : recent.length === 0 ? (
          <p className="text-sm text-[#666]">
            Nothing logged yet. Add time entries or materials to populate this feed.
          </p>
        ) : (
          <ul className="divide-y divide-[#f0eeeb] text-sm">
            {recent.map((r, i) => (
              <li key={`${r.type}-${r.date}-${i}`} className="py-2 flex items-center gap-3">
                <span className="text-[#888] tabular-nums w-24">{r.date}</span>
                <span
                  className={`text-[10px] uppercase tracking-wide w-20 px-1.5 py-0.5 rounded ${
                    r.type === 'time'
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {r.type}
                </span>
                <span className="flex-1 text-[#1a1a1a] truncate">{r.label}</span>
                <AmountDisplay value={r.amount} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

// --- Sub-components ---

interface KpiCardProps {
  label: string;
  value: string;
  subline?: string;
  icon?: React.ReactNode;
  accent?: 'neutral' | 'green' | 'red' | 'amber';
  loading?: boolean;
}

const ACCENT_BG: Record<NonNullable<KpiCardProps['accent']>, string> = {
  neutral: 'bg-white',
  green: 'bg-emerald-50 border-emerald-200',
  red: 'bg-red-50 border-red-200',
  amber: 'bg-amber-50 border-amber-200',
};

const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  subline,
  icon,
  accent = 'neutral',
  loading,
}) => (
  <div className={`border rounded-lg p-4 ${ACCENT_BG[accent]}`}>
    <div className="flex items-center justify-between mb-1">
      <span className="text-xs uppercase tracking-wide text-[#666]">{label}</span>
      {icon}
    </div>
    <div className="text-xl font-semibold text-[#1a1a1a] tabular-nums">
      {loading ? '—' : value}
    </div>
    {subline && <div className="text-[11px] text-[#888] mt-1">{subline}</div>}
  </div>
);

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-center justify-between">
    <dt className="text-[#666]">{label}</dt>
    <dd className="text-[#1a1a1a] font-medium">{value}</dd>
  </div>
);
