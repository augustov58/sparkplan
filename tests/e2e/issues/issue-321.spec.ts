import { test, expect, type Page } from '@playwright/test';
import { readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { mainTextWhen } from './pageText';

/**
 * #321 (owner ruling 2026-11-24): Material Take-Off
 * - outlet boxes (60 %) and junction boxes (20 %) from 1-pole circuits only,
 *   rounded down; a count of 0 prints no row. Retail 11 one-pole → 6 and 2
 *   (main 7 and 2); Office 0 and 0 (main 1 and 0); Workshop 0 and 0 (main 3, 1).
 * - Couplings / connectors (circuits × 2) and wire nuts (⌈circuits ÷ 10⌉) unchanged.
 * - Export CSV escapes cells per RFC 4180: 3/4" and 5/8" x 8ft stay in one cell.
 * Expected values: the issue's Acceptance section (hand-calculated).
 *
 * The spec creates a project from each template in the QA account, reads it,
 * and deletes it (as issue-304.spec.ts does).
 */

const OUT = 'tests/e2e/__output__/screenshots/issue-321';
mkdirSync(OUT, { recursive: true });

const TEMPLATES = [
  {
    tab: 'Commercial', name: 'Retail Store (2500 sq ft)', ready: /Copper Wire 12 AWG 1000 ft/,
    boxes: ['Single-Gang Outlet Box - 6 ea', 'Junction Box (4" Square) - 2 ea'], // main: 7, 2 (no size prints "-")
    fittings: ['EMT Set Screw Couplings Assorted 26 ea', 'EMT Set Screw Connectors Assorted 26 ea', 'Wire Nuts (Assorted) - 2 box'],
  },
  {
    tab: 'Commercial', name: 'Office Building (5000 sq ft)', ready: /Copper Wire 1 AWG 300 ft/,
    boxes: [], // main: outlet 1, junction 0
    fittings: ['EMT Set Screw Couplings Assorted 6 ea', 'EMT Set Screw Connectors Assorted 6 ea', 'Wire Nuts (Assorted) - 1 box'],
  },
  {
    tab: 'Industrial', name: 'Small Workshop/Light Manufacturing', ready: /Copper Wire 6 AWG 500 ft/,
    boxes: [], // main: outlet 3, junction 1
    fittings: ['EMT Set Screw Couplings Assorted 12 ea', 'EMT Set Screw Connectors Assorted 12 ea', 'Wire Nuts (Assorted) - 1 box'],
  },
];

/** A minimal RFC 4180 reader for one line: quoted fields, "" inside them, commas. */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { cells.push(cell); cell = ''; }
    else cell += ch;
  }
  cells.push(cell);
  return cells;
}

async function deleteProjects(page: Page, name: string) {
  const main = page.locator('main');
  await page.goto('/');
  await expect(main.locator('h3', { hasText: 'QA Short circuit' }).first()).toBeVisible({ timeout: 20_000 });
  for (let i = 0; i < 5; i++) {
    const heading = main.locator('h3').filter({ hasText: new RegExp(`^${name.replace(/[()/]/g, '\\$&')}$`) });
    if (!(await heading.count())) return;
    const card = heading.first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
    await card.hover();
    const deleted = page.waitForResponse((r) => r.url().includes('/rest/v1/projects') && r.request().method() === 'DELETE');
    await card.locator('button[title="Delete project"]').click();
    expect((await deleted).ok()).toBe(true);
  }
}

test('#321 boxes from 1-pole circuits only; the CSV keeps 3/4" in one cell', async ({ page }) => {
  test.setTimeout(300_000);
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  page.on('dialog', (d) => d.accept()); // "Are you sure you want to delete this project?"
  const main = page.locator('main');

  for (const t of TEMPLATES) {
    await deleteProjects(page, t.name); // a failed run may have left one
    let failure: unknown;
    try {
      await main.getByRole('button', { name: 'Create New NEC Project' }).click();
      await page.getByRole('button', { name: t.tab, exact: true }).click();
      await page.getByRole('button', { name: new RegExp(t.name.replace(/[()/]/g, '\\$&')) }).click();
      await page.getByRole('button', { name: 'Use This Template' }).click();
      await page.waitForURL(/#\/project\/[^/]+/, { timeout: 20_000 });
      const projectUrl = page.url().replace(/(#\/project\/[^/?]+).*/, '$1');

      await page.goto(`${projectUrl}/materials`);
      const text = await mainTextWhen(page, [t.ready, ...t.fittings]); // the circuits have loaded
      for (const box of t.boxes) expect(text).toContain(box);
      if (t.boxes.length === 0) {
        expect(text).not.toContain('Single-Gang Outlet Box');
        expect(text).not.toContain('Junction Box');
      }
      await page.screenshot({ path: join(OUT, `spec-${t.name.slice(0, 6)}.png`), fullPage: true });

      if (t.name.startsWith('Office')) {
        const download = page.waitForEvent('download', { timeout: 30_000 });
        await main.getByRole('button', { name: /Export CSV/ }).click();
        const csv = join(OUT, 'office-takeoff.csv');
        await (await download).saveAs(csv);
        const rows = readFileSync(csv, 'utf8').split('\n').filter(Boolean).map(parseCsvLine);
        expect(rows[0]).toEqual(['Category', 'Description', 'Size', 'Quantity', 'Unit', 'Notes']);
        for (const row of rows) expect(row, row.join(' | ')).toHaveLength(6); // main: a 3/4" row splits
        expect(rows.find((r) => r[1] === 'EMT Conduit' && r[2] === '3/4"'), 'EMT Conduit 3/4" row').toBeTruthy();
        expect(rows.find((r) => r[1] === 'Ground Rod (8ft)')?.[2]).toBe('5/8" x 8ft');
        expect(rows.some((r) => r[1] === 'Single-Gang Outlet Box')).toBe(false);
      }
    } catch (e) {
      failure = e;
    }
    await deleteProjects(page, t.name);
    if (failure) throw failure;
  }
});
