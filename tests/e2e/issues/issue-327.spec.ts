import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #327: "today" was the UTC day: the packet's Revision Log, billing's default
 * dates and month, the overdue check and download filenames printed tomorrow's
 * date from 7 PM in Florida. Expected values: the issue's Acceptance.
 *
 * The browser runs in a zone where, at this moment, the local day differs from
 * the UTC day (as Florida after 7 PM): Kiritimati (UTC+14) from 10:00 UTC,
 * Pago Pago (UTC−11) before. Read-only: forms are opened and cancelled, the
 * billing test answers the time-entry read with a stub row, and the packet and
 * CSV are downloads.
 */

const LOCAL_TZ = new Date().getUTCHours() >= 10 ? 'Pacific/Kiritimati' : 'Pacific/Pago_Pago';
test.use({ timezoneId: LOCAL_TZ });
const OUT = 'tests/e2e/__output__/screenshots/issue-327';
mkdirSync(OUT, { recursive: true });

/** The local day (YYYY-MM-DD), its month and last day in LOCAL_TZ, and the UTC day, now. */
function days() {
  const now = new Date();
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: LOCAL_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const [y, m] = local.split('-').map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const month = local.slice(0, 7);
  return { local, utc: now.toISOString().slice(0, 10), month, monthStart: `${month}-01`, monthEnd: `${month}-${String(lastDay).padStart(2, '0')}` };
}

async function openProject(page: Page, name: string) {
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  const card = page.getByText(name, { exact: true }).first();
  await expect(card, `QA project "${name}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  return page.url().replace(/(#\/project\/[^/?]+).*/, '$1');
}

test('#327 billing defaults are the local day and month', async ({ page }) => {
  const d = days();
  expect(d.local, 'the zone must put the local day off the UTC day').not.toBe(d.utc);
  const base = await openProject(page, 'QA Commercial calc');
  // "Generate invoice" needs an unbilled entry, and the QA account has no billing data:
  // answer the time-entry read with one stub row (GET only; nothing is written)
  await page.route('**/rest/v1/time_entries**', (r) => r.request().method() !== 'GET' ? r.continue() : r.fulfill({ json: [{
    id: '00000000-0000-4000-8000-000000000327', project_id: '00000000-0000-4000-8000-000000000000',
    user_id: '00000000-0000-4000-8000-000000000000', work_date: d.local, hours: 1, billable_rate: 100,
    billable_amount: 100, cost_rate: null, cost_amount: null, cost_code: null, description: 'QA stub',
    worker_name: 'QA stub', invoice_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }] }));
  await page.goto(base + '/billing');

  // A new time entry defaults to today
  await page.getByRole('button', { name: 'Time', exact: true }).click();
  await page.getByRole('button', { name: /^Add (first )?entry$/ }).first().click();
  await expect(page.locator('input[type="date"]').first()).toHaveValue(d.local); // main: the UTC day
  await page.screenshot({ path: join(OUT, 'time-entry.png') });
  await page.getByRole('button', { name: 'Cancel' }).click();

  // Generate invoice: invoice date today, period = this month
  await page.getByRole('button', { name: 'Invoices', exact: true }).click();
  await page.getByRole('button', { name: 'Generate invoice' }).first().click();
  await expect(page.locator('input[name="period_start"]')).toHaveValue(d.monthStart);
  await expect(page.locator('input[name="period_end"]')).toHaveValue(d.monthEnd);
  await expect(page.locator('input[name="invoice_date"]')).toHaveValue(d.local); // main: the UTC day
  await page.screenshot({ path: join(OUT, 'generate-invoice.png') });
  await page.getByRole('button', { name: 'Cancel' }).click();
});

test('#327 a download is named for the local day', async ({ page }) => {
  const d = days();
  expect(d.local).not.toBe(d.utc);
  const base = await openProject(page, 'QA Commercial calc');
  await page.goto(base + '/load-calc');
  const csv = page.waitForEvent('download', { timeout: 30_000 });
  await page.locator('main').getByRole('button', { name: 'CSV', exact: true }).click();
  const name = (await csv).suggestedFilename();
  expect(name).toContain(d.local); // main: the UTC day
  expect(name).not.toContain(d.utc);
});

test('#327 the packet Revision Log dates Rev 0 with the local day', async ({ page }) => {
  test.setTimeout(180_000);
  const d = days();
  expect(d.local).not.toBe(d.utc);
  const base = await openProject(page, 'QA Short circuit');
  await page.goto(base + '/permit-packet');
  const generate = page.getByRole('button', { name: /Generate Permit Packet/i }).first();
  await expect(generate).toBeEnabled({ timeout: 20_000 });
  await page.waitForTimeout(2_000); // the generator reads the project's data after the button renders
  const download = page.waitForEvent('download', { timeout: 120_000 });
  await generate.click();
  const pdf = join(OUT, 'packet.pdf');
  await (await download).saveAs(pdf);
  const pages = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' }).split('\f').map(p => p.replace(/\s+/g, ' '));
  const log = pages.find(p => p.includes('Revision Log') && p.includes('Rev 0')) ?? '';
  expect(log).toContain(`Rev 0 ${d.local} Initial submittal`); // main: the UTC day
  expect(log).not.toContain(d.utc);
});
