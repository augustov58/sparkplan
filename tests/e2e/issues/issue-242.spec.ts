import { test, expect, Page } from '@playwright/test';

/**
 * #242 — a flow that creates many circuits shows one toast, not one per
 * circuit (the stack covered the panel tabs). Expected values: the issue's
 * Acceptance section. QA projects: tests/e2e/fixtures.md. Writes: the EV
 * builder's panel (deleted in `finally`); "QA Dwelling generate"'s Main Panel
 * circuits are regenerated (the same 18 each run).
 */

async function openProject(page: Page, name: string) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const card = page.getByText(name, { exact: true }).first();
  await expect(card, `QA project "${name}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  return page.url().replace(/(#\/project\/[^/?]+).*/, '$1');
}

const toasts = (page: Page) => page.evaluate(() => (window as unknown as { __toasts: string[] }).__toasts);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('welcomeModalDismissed', 'true');
    const w = window as unknown as { __toasts: string[] };
    w.__toasts = [];
    new MutationObserver(ms => {
      for (const m of ms) for (const n of m.addedNodes) {
        if (!(n instanceof Element)) continue;
        const el = n.matches('[role=status]') ? n : n.querySelector('[role=status]');
        if (el) w.__toasts.push(el.textContent ?? '');
      }
    }).observe(document, { childList: true, subtree: true });
  });
});

test('#242 Create EV Panel shows one toast', async ({ page }) => {
  test.setTimeout(90_000);
  const url = await openProject(page, 'QA EV builder');
  const cleanup = () => page.evaluate(async () => {
    const m = '/lib/supabase.ts';
    const { supabase } = await import(/* @vite-ignore */ m);
    const { data: proj } = await supabase.from('projects').select('id').eq('name', 'QA EV builder').single();
    const { data: panels } = await supabase.from('panels').select('id,name').eq('project_id', proj!.id);
    for (const p of (panels ?? []).filter((x: { name: string }) => !['MDP', 'EV Panel', 'Office Panel'].includes(x.name))) {
      await supabase.from('circuits').delete().eq('panel_id', p.id);
      await supabase.from('panels').delete().eq('id', p.id);
    }
  });
  try {
    await page.goto(`${url}/tools`);
    await page.getByRole('button', { name: 'EV Panel Builder' }).click();
    await expect(page.getByRole('button', { name: 'Create EV Panel' })).toBeEnabled({ timeout: 15_000 });
    await page.evaluate(() => { (window as unknown as { __toasts: string[] }).__toasts = []; });
    await page.getByRole('button', { name: 'Create EV Panel' }).click();
    await expect(page.getByText('EV panel "4× Level 2 (48A) Panel" created under the MDP with 6 circuits')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1_000);
    expect(await toasts(page)).toEqual(['EV panel "4× Level 2 (48A) Panel" created under the MDP with 6 circuits']); // was 8 toasts
  } finally {
    await cleanup();
  }
});

test('#242 the Dwelling Load Calculator applies a schedule with one toast', async ({ page }) => {
  test.setTimeout(90_000);
  const dialogs: string[] = [];
  page.on('dialog', d => { dialogs.push(d.type()); void d.accept(); }); // the re-apply confirm
  const url = await openProject(page, 'QA Dwelling generate');
  await page.goto(`${url}/load-calc`);
  const generate = page.getByRole('button', { name: /Generate Panel Schedule|Regenerate Schedule/ }).first();
  await expect(generate).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1_500); // the calculator reads the project's circuits
  await generate.click();
  await page.evaluate(() => { (window as unknown as { __toasts: string[] }).__toasts = []; });
  await page.getByRole('button', { name: 'Apply to Panel Schedule' }).click();
  await expect(page.getByText('18 circuits added')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1_000);
  const seen = await toasts(page);
  expect(seen.filter(t => t === 'Circuit added')).toHaveLength(0); // was 18
  expect(seen.filter(t => t === '18 circuits added')).toHaveLength(1);
  expect(dialogs.filter(d => d === 'alert')).toHaveLength(0); // was "Successfully created 18 circuits…"
});
