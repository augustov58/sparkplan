import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { mainTextWhen } from './pageText';
import { restoreMdpAicEmpty, saveMdpAicThroughForm } from './mdpAic';

/**
 * #315 (owner rulings 2026-11-24): packet / one-line cosmetics.
 * 1 E-202 Main Breaker "800A"; 2 E-201 title " (MDP)" only when the name lacks
 * MDP; 3 the in-app AIC chip clear of the enclosure border; 4 E-201 "AIC N kA"
 * in the node's dark text; 5 the Short Circuit dropdown "(no downstream
 * panels)"; 6 the packet filename on the local date; 7 realtime on the list
 * tables (an update made outside the app shows without a reload).
 * Expected values: the issue's Acceptance section.
 *
 * QA projects (tests/e2e/fixtures.md): "QA Short circuit" (MDP only; the spec
 * sets 42 kA and a location and puts both back), "QA SF subpanel" and
 * "QA SC parallel" (read only).
 */

// 6: a zone whose local date differs from the UTC date right now (UTC+14 from
// 10:00Z, else UTC−11), so the filename shows which date it used. A fake clock
// can't do this: a time past the token's expiry signs the page out.
const LOCAL_TZ = new Date().getUTCHours() >= 10 ? 'Pacific/Kiritimati' : 'Pacific/Pago_Pago';
test.use({ timezoneId: LOCAL_TZ });

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** "Generated November 25, 2026" → "2026-11-25" */
function generatedIso(text: string): string {
  const m = text.match(/Generated (\w+) (\d{1,2}), (\d{4})/);
  if (!m) return 'no "Generated" date';
  return `${m[3]}-${String(MONTHS.indexOf(m[1]!) + 1).padStart(2, '0')}-${m[2]!.padStart(2, '0')}`;
}

const OUT = 'tests/e2e/__output__/screenshots/issue-315';
mkdirSync(OUT, { recursive: true });

async function openProject(page: Page, name: string) {
  await page.goto('/');
  const card = page.getByText(name, { exact: true }).first();
  await expect(card, `QA project "${name}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  return page.url().replace(/(#\/project\/[^/?]+).*/, '$1');
}

/** Generates the packet; returns its filename, its pages' text and the PDF path. */
async function packet(page: Page, base: string, name: string) {
  await page.goto(base + '/permit-packet');
  const generate = page.getByRole('button', { name: /Generate Permit Packet/i }).first();
  await expect(generate).toBeEnabled({ timeout: 20_000 });
  await page.waitForTimeout(2_000); // the generator reads the project's data after the button renders
  const download = page.waitForEvent('download', { timeout: 120_000 });
  await generate.click();
  const d = await download;
  const pdf = join(OUT, `${name}.pdf`);
  await d.saveAs(pdf);
  const pages = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' }).split('\f');
  const flat = (p: string | undefined) => (p ?? '').replace(/\s+/g, ' ');
  return {
    filename: d.suggestedFilename(),
    pdf,
    all: flat(pages.join(' ')),
    e201: flat(pages.find(p => p.includes('Riser Diagram') && p.includes('LEGEND'))),
    e202: flat(pages.find(p => p.includes('MAIN DISTRIBUTION PANEL') && p.includes('Main Breaker'))),
  };
}

/** The fill colour (#rrggbb) of a text span in the PDF (PyMuPDF). */
function spanColor(pdf: string, text: string): string {
  return execFileSync('python3', ['-P', '-c', `
import fitz, sys
for page in fitz.open(sys.argv[1]):
    for b in page.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            for s in l['spans']:
                if s['text'].strip() == sys.argv[2]:
                    print('#%06x' % s['color']); sys.exit(0)
print('missing')`, pdf, text], { encoding: 'utf8' }).trim();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
});

test('#315 E-202 unit, E-201 title and AIC colour, the in-app chip, the local-date filename', async ({ page }) => {
  test.setTimeout(240_000);
  const base = await openProject(page, 'QA Short circuit');
  let failure: unknown;
  try {
    await saveMdpAicThroughForm(page, base, '42');

    // 3: the chip starts below the enclosure's bottom edge and its 2 px stroke
    await page.goto(base + '/diagram');
    const chip = page.locator('svg text').filter({ hasText: /^AIC 42kA$/ }).first();
    await expect(chip).toBeVisible({ timeout: 20_000 });
    const geometry = await chip.evaluate((el) => {
      const chipRect = el.parentElement!.querySelector('rect')! as SVGRectElement;
      const enclosure = el.parentElement!.parentElement!.querySelector('rect')! as SVGRectElement;
      const c = chipRect.getBBox();
      const e = enclosure.getBBox();
      return { chipTop: c.y, enclosureBottom: e.y + e.height, stroke: Number(enclosure.getAttribute('stroke-width')) };
    });
    expect(geometry.chipTop).toBeGreaterThanOrEqual(geometry.enclosureBottom + geometry.stroke / 2); // main: bottom − 4
    await page.screenshot({ path: join(OUT, 'spec-chip.png') });

    // 1, 2a, 4, 6: the packet; its filename carries the date its pages print
    const utcDate = new Date().toISOString().slice(0, 10);
    const p = await packet(page, base, 'packet');
    const printed = generatedIso(p.all);
    expect(printed).not.toBe(utcDate); // the zone was picked so the two differ
    expect(p.filename).toBe(`Permit_Packet_QA_Short_circuit_${printed}.pdf`); // main: the UTC date
    expect(p.e202).toMatch(/MDP 480V 3Ø 800A 800A/); // main: "800A 800"
    expect(p.e201).not.toContain('MDP (MDP)');
    expect(p.e201).toContain('AIC 42 kA');
    expect(spanColor(p.pdf, 'AIC 42 kA')).toBe('#000000'); // the riser labels' default dark text; main: #7c2d12
  } catch (e) {
    failure = e;
  }
  try {
    await restoreMdpAicEmpty(page, base, 'QA Short circuit');
  } catch (e) {
    if (!failure) throw e;
  }
  if (failure) throw failure;
});

test('#315 E-201 keeps " (MDP)" on a main panel whose name lacks it', async ({ page }) => {
  test.setTimeout(180_000);
  const base = await openProject(page, 'QA SF subpanel');
  const p = await packet(page, base, 'packet-sf');
  expect(p.e201).toContain('Main Panel (MDP)');
});

test('#315 the Short Circuit dropdown says "(no downstream panels)" when only the MDP exists', async ({ page }) => {
  const main = page.locator('main');
  const options = async (project: string) => {
    const base = await openProject(page, project);
    await page.goto(base + '/short-circuit');
    await expect(main.getByText(/calculations? saved/)).toBeVisible({ timeout: 15_000 });
    if (!(await main.getByText('New Calculation').isVisible())) {
      await main.getByRole('button', { name: /Add Short Circuit Calculation/ }).first().click();
    }
    await main.getByRole('button', { name: 'Downstream Panel' }).click();
    await expect.poll(() => main.getByRole('combobox').first().locator('option').allTextContents(), { timeout: 15_000 })
      .toContainEqual(expect.stringMatching(/^\((no downstream panels|all panels already calculated)\)$/));
    return main.getByRole('combobox').first().locator('option').allTextContents();
  };
  expect(await options('QA Short circuit')).toContain('(no downstream panels)'); // main: (all panels already calculated)
  expect(await options('QA SC parallel')).toContain('(all panels already calculated)'); // DP-1 is calculated
});

test('#315 an update made outside the app reaches an open panel page (realtime)', async ({ page }) => {
  const base = await openProject(page, 'QA Short circuit');
  await page.goto(base + '/panel');
  await mainTextWhen(page, ['MDP']);
  await page.waitForTimeout(2_000); // the realtime channel subscribes after the first fetch
  const outside = (location: string) => page.evaluate(async (location) => {
    // a second client with the QA session: another tab or device, not this page's hooks
    // @ts-expect-error — served by the Vite dev server
    const { createClient } = await import('/node_modules/.vite/deps/@supabase_supabase-js.js');
    // @ts-expect-error — served by the Vite dev server
    const { supabase } = await import('/lib/supabase.ts');
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email !== 'augustovalbuena+qa@gmail.com') throw new Error('not the QA account');
    const other = createClient(supabase.supabaseUrl, supabase.supabaseKey, {
      global: { headers: { Authorization: `Bearer ${session.access_token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: proj } = await other.from('projects').select('id').eq('name', 'QA Short circuit').single();
    const { data, error } = await other.from('panels').update({ location }).eq('project_id', proj.id).eq('name', 'MDP').select('id');
    if (error) throw new Error(error.message);
    return data.length;
  }, location);
  try {
    expect(await outside('QA 315 realtime')).toBe(1);
    await expect(page.locator('main')).toContainText('Location: QA 315 realtime', { timeout: 10_000 }); // main: only after a reload
  } finally {
    await outside('');
  }
  await expect(page.locator('main')).not.toContainText('QA 315 realtime', { timeout: 10_000 });
});
