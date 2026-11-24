/**
 * #327: "today" was the UTC day at 22 sites (the Revision Log, billing
 * defaults and the overdue check, download filenames). From 7 PM EST that is
 * tomorrow in Florida. Expected values: the issue's Acceptance (2026-11-24
 * 20:30 EST = 2026-11-25 01:30 UTC → local day 2026-11-24).
 */
process.env.TZ = 'America/New_York'; // before any Date: the user's zone, Florida

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { localDateStamp, localMonthStamp } from '../lib/localDate';
import { deriveInvoiceStatus } from '../services/billing/invoiceStatusTransitions';

const EVENING = new Date('2026-11-25T01:30:00Z'); // 2026-11-24 20:30 EST

describe('#327 local day and month', () => {
  it('the zone is in effect (guard for the cases below)', () => {
    expect(EVENING.getDate()).toBe(24);
    expect(EVENING.toISOString().slice(0, 10)).toBe('2026-11-25'); // what main printed
  });

  it('localDateStamp is the local day', () => {
    expect(localDateStamp(EVENING)).toBe('2026-11-24');
    expect(localDateStamp(new Date('2026-11-24T05:00:00Z'))).toBe('2026-11-24'); // local midnight
    expect(localDateStamp(new Date('2026-11-24T04:59:00Z'))).toBe('2026-11-23');
  });

  it('localMonthStamp is the local month on the last evening of a month', () => {
    expect(localMonthStamp(new Date('2026-12-01T01:30:00Z'))).toBe('2026-11'); // 2026-11-30 20:30 EST; main: 2026-12
    expect(localMonthStamp(new Date('2027-01-01T04:00:00Z'))).toBe('2026-12'); // year boundary
  });
});

describe('#327 an invoice is overdue only after its due day ends locally', () => {
  it('due today (local), unpaid, sent → Sent, not Overdue', () => {
    expect(deriveInvoiceStatus('sent', 0, 1000, '2026-11-24', EVENING)).toBe('sent'); // main: overdue
    expect(deriveInvoiceStatus('partial_paid', 200, 1000, '2026-11-24', EVENING)).toBe('partial_paid'); // main: overdue
  });

  it('guardrail: due yesterday (local) is Overdue', () => {
    expect(deriveInvoiceStatus('sent', 0, 1000, '2026-11-23', EVENING)).toBe('overdue');
  });
});

describe('#327 sweep: no UTC "today" left in app code', () => {
  // Every toISOString() that keeps only a date, month or clock time, in app code (scripts/ are dev fixture tools).
  const hits = execFileSync('git', ['grep', '-nE',
    String.raw`toISOString\(\)\s*\.?(split\(['"]T['"]\)\[0\]|slice\(0, ?(7|10|16)\)|substring\(0, ?10\))`,
    '--', '*.ts', '*.tsx', ':!tests', ':!backend', ':!scripts', ':!node_modules'], { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean)
    .map(l => l.replace(/^([^:]+):\d+:\s*/, '$1: ').trim());

  it('only the known UTC-consistent sites remain', () => {
    expect(hits.sort()).toEqual([
      // UTC calendar arithmetic: parsed at T00:00:00Z, so the UTC day is the date itself
      'components/Billing/GenerateInvoiceModal.tsx: return d.toISOString().slice(0, 10);',
      // the permit drawer stores dates at UTC midnight (fromDateInput) and reads them back the same way
      'components/Permits/PermitDetailDrawer.tsx: return d.toISOString().slice(0, 10);',
      // #337: a typed time stored as UTC (the reverse problem, filed separately)
      'components/SiteVisitManager.tsx: visit_date: new Date().toISOString().slice(0, 16),',
      'components/SiteVisitManager.tsx: visit_date: new Date().toISOString().slice(0, 16), // datetime-local format',
      'services/billing/invoiceGenerator.ts: return d.toISOString().slice(0, 10);',
    ].sort());
  });

  it('the Revision Log date reads the local day', () => {
    const src = readFileSync('services/pdfExport/PermitPacketDocuments.tsx', 'utf8');
    expect(src).toContain('const todayIso = (): string => localDateStamp();');
  });
});
