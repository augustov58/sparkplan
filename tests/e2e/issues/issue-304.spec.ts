import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #304 (owner ruling 2026-11-23): Material Take-Off and panel templates.
 * - Wire: conductors per circuit = poles, plus 1 neutral on 1-pole (~50 ft
 *   each, rounded up to 100 ft); the EGC line is unchanged.
 * - Conduit: each circuit's EMT at 40 % fill, EGC included (Chapter 9 Tables
 *   4 and 5, THHN), ~10 ft per circuit, totalled by trade size.
 * - Retail: the 3 lighting circuits are L; Exterior Signage stays O.
 *   E-101: 40.44 kVA either way; lighting 5.34 kVA in its own row.
 * - Template descriptions match what they create; "1 circuit".
 * Expected values: the issue's Acceptance section (hand-calculated).
 *
 * The spec creates a project from each template in the QA account, reads it,
 * and deletes it (as issue-294.spec.ts does).
 */

const OUT = 'tests/e2e/__output__/screenshots/issue-304';
mkdirSync(OUT, { recursive: true });

const TEMPLATES = [
  {
    tab: 'Commercial', name: 'Office Building (5000 sq ft)',
    description: '480V 3-phase service: 75 kVA transformer, chiller and elevator circuits', // main: … with step-down transformer
    lines: [
      /THHN\/THWN Copper Wire 1 AWG 300 ft 2 circuits, 6 conductors @ ~50ft avg/, // main: 100 ft
      /THHN\/THWN Copper Wire 6 AWG 200 ft 1 circuit, 3 conductors/,
      /Equipment Grounding Conductor 8 AWG 100 ft 2 circuits/,
      /Equipment Grounding Conductor 10 AWG 100 ft 1 circuit @/,
      /EMT Conduit 3\/4" 1 sticks 1 circuit @ ~10ft, 40% fill/,
      /EMT Conduit 1-1\/4" 2 sticks 2 circuits @ ~10ft, 40% fill/, // main: 3/4" + 1" "For larger wire sizes"
    ],
  },
  {
    tab: 'Industrial', name: 'Small Workshop/Light Manufacturing',
    description: '480V 3-phase, machinery, welding, HVAC and a 208V transformer circuit', // main: … lighting, welding
    lines: [
      /THHN\/THWN Copper Wire 6 AWG 500 ft 3 circuits, 9 conductors/,
      /THHN\/THWN Copper Wire 1 AWG 200 ft 1 circuit, 3 conductors/, // main: "1 circuits"
      /THHN\/THWN Copper Wire 1\/0 AWG 200 ft 1 circuit, 3 conductors/,
      /THHN\/THWN Copper Wire 3 AWG 200 ft 1 circuit, 3 conductors/,
      /EMT Conduit 3\/4" 3 sticks/, /EMT Conduit 1" 1 sticks/, /EMT Conduit 1-1\/4" 1 sticks/, /EMT Conduit 1-1\/2" 1 sticks/,
    ],
  },
  {
    tab: 'Commercial', name: 'Retail Store (2500 sq ft)',
    description: '208V 3-phase service, general lighting, receptacles, HVAC',
    lines: [
      /THHN\/THWN Copper Wire 12 AWG 1000 ft 10 circuits, 20 conductors/, // main: 500 ft
      /THHN\/THWN Copper Wire 10 AWG 300 ft 2 circuits, 6 conductors/, // main: 100 ft
      /THHN\/THWN Copper Wire 14 AWG 100 ft 1 circuit, 2 conductors/,
      /Equipment Grounding Conductor 12 AWG 500 ft 10 circuits/,
      /EMT Conduit 1\/2" 13 sticks 13 circuits/, // main: 3/4" 13 + 1" 4
    ],
  },
];

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

test('#304 take-off counts conductors and sizes conduit; Retail lighting is L', async ({ page }) => {
  test.setTimeout(360_000);
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  page.on('dialog', (d) => d.accept()); // "Are you sure you want to delete this project?"
  const main = page.locator('main');

  for (const t of TEMPLATES) {
    await deleteProjects(page, t.name); // a failed run may have left one
    let failure: unknown;
    try {
      await main.getByRole('button', { name: 'Create New NEC Project' }).click();
      await page.getByRole('button', { name: t.tab, exact: true }).click();
      const card = page.getByRole('button', { name: new RegExp(t.name.replace(/[()/]/g, '\\$&')) });
      await expect(card).toContainText(t.description);
      await card.click();
      await page.getByRole('button', { name: 'Use This Template' }).click();
      await page.waitForURL(/#\/project\/[^/]+/, { timeout: 20_000 });
      const projectUrl = page.url().replace(/(#\/project\/[^/?]+).*/, '$1');

      await page.goto(`${projectUrl}/materials`);
      await expect(main.getByText('Wire & Cable')).toBeVisible({ timeout: 20_000 });
      const text = async () => (await main.innerText()).replace(/\s+/g, ' ');
      await expect.poll(text, { timeout: 20_000 }).toMatch(t.lines[0]!);
      const materials = await text();
      for (const line of t.lines) expect(materials).toMatch(line);
      expect(materials).not.toMatch(/\b1 circuits\b/);
      expect(materials).not.toContain('For larger wire sizes');

      if (t.name.startsWith('Retail')) {
        // Panel schedule: lighting L, the sign O
        await page.goto(`${projectUrl}/panel`);
        await expect.poll(async () => (await main.locator('tr').allInnerTexts()).map((r) => r.replace(/\s+/g, ' ')).join('\n'), { timeout: 20_000 })
          .toMatch(/Sales Floor Lighting Zone 1 L 1\.92 20 1/); // main: O
        const rows = (await main.locator('tr').allInnerTexts()).map((r) => r.replace(/\s+/g, ' ')).join('\n');
        expect(rows).toMatch(/Sales Floor Lighting Zone 2 L 1\.92 20 1/);
        expect(rows).toMatch(/Back Room Lighting L 1\.50 20 1/);
        expect(rows).toMatch(/Exterior Signage O 2\.00 20 1/);

        // E-101: 40.44 kVA; lighting 5.34 kVA in its own row
        await page.goto(`${projectUrl}/permit-packet`);
        const generate = page.getByRole('button', { name: /Generate Permit Packet/i }).first();
        await expect(generate).toBeVisible({ timeout: 20_000 });
        await page.waitForTimeout(2_000);
        await main.getByPlaceholder('e.g., EC1234567').fill('EC0000000');
        await main.locator('label', { hasText: 'Scope of Work' }).locator('xpath=..').locator('textarea, input').first().fill('QA #304 template take-off');
        await expect(generate).toBeEnabled({ timeout: 20_000 });
        const download = page.waitForEvent('download', { timeout: 120_000 });
        await generate.click();
        const pdf = join(OUT, 'retail-packet.pdf');
        await (await download).saveAs(pdf);
        const e101 = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' }).split('\f')
          .find((p) => p.split('\n').slice(0, 3).join(' ').includes('E-101'))!.replace(/\s+/g, ' ');
        expect(e101).toContain('40.44 kVA 40.44 kVA 112 A');
        expect(e101).toContain('Lighting 5.34 100% 5.34 Table 220.42 (All others)'); // main: no lighting row
        expect(e101).toContain('Other 35.10 100% 35.10'); // main: Other 40.44
      }
      await page.screenshot({ path: join(OUT, `spec-${t.tab.toLowerCase()}-${t.name.slice(0, 6)}.png`), fullPage: true });
    } catch (e) {
      failure = e;
    }
    await deleteProjects(page, t.name);
    if (failure) throw failure;
  }
});
