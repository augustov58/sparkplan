import { test, expect, Page } from '@playwright/test';

/**
 * #252 — opening the Permit Packet page writes nothing: the persist effects
 * compared JSON.stringify of the form with the stored jsonb, whose keys come
 * back reordered, so every visit saved twice. A real edit still saves once.
 * Expected: the issue's Acceptance section. QA projects: tests/e2e/fixtures.md.
 * Writes: row 3 types into Scope of Work and restores it.
 */

async function openPacket(page: Page, project: string, writes: string[]) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const card = page.getByText(project, { exact: true }).first();
  await expect(card, `QA project "${project}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  page.on('request', r => {
    if (r.url().includes('/rest/v1/projects') && ['PATCH', 'POST', 'PUT'].includes(r.method())) writes.push(r.method());
  });
  await page.goto(page.url().replace(/(#\/project\/[^/?]+).*/, '$1') + '/permit-packet');
  await expect(page.locator('#scopeOfWork')).toBeVisible({ timeout: 20_000 });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
});

for (const project of ['QA EVEMS panel', 'QA EVEMS downstream']) {
  test(`#252 ${project}: opening the packet page writes nothing`, async ({ page }) => {
    const writes: string[] = [];
    await openPacket(page, project, writes);
    await page.waitForTimeout(6_000);
    expect(writes, 'project writes on load (was 2 every visit)').toEqual([]);
    await expect(page.getByText('Project updated')).toHaveCount(0);
  });
}

test('#252 an edit to Scope of Work still saves once', async ({ page }) => {
  test.setTimeout(90_000);
  const writes: string[] = [];
  await openPacket(page, 'QA EVEMS downstream', writes);
  await page.waitForTimeout(2_000);
  const scope = page.locator('#scopeOfWork');
  const original = await scope.inputValue();
  try {
    await scope.click();
    await scope.press('End');
    await scope.pressSequentially(' x');
    await expect.poll(() => writes.length, { timeout: 5_000 }).toBe(1);
    await page.waitForTimeout(1_500);
    expect(writes).toHaveLength(1); // one debounced save, no echo
  } finally {
    await scope.fill(original);
    await expect.poll(() => writes.length, { timeout: 5_000 }).toBeGreaterThanOrEqual(2);
  }
});

test('#252 a project with nothing stored is not seeded on load; the first edit saves once', async ({ page }) => {
  test.setTimeout(90_000);
  const strip = () => page.evaluate(async () => {
    const clientModule = '/lib/supabase.ts';
    const { supabase } = await import(/* @vite-ignore */ clientModule);
    const { data: p } = await supabase.from('projects').select('id,settings').eq('name', 'QA Dwelling generate').single();
    const { permitPacketDefaults: _a, nec22087Narrative: _b, ...rest } = (p!.settings ?? {}) as Record<string, unknown>;
    const { error } = await supabase.from('projects').update({ settings: rest }).eq('id', p!.id);
    return error?.message ?? 'ok';
  });
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  expect(await strip()).toBe('ok');
  const writes: string[] = [];
  try {
    await openPacket(page, 'QA Dwelling generate', writes);
    await page.waitForTimeout(6_000);
    expect(writes, 'writes on a first visit (was 2: the defaults)').toEqual([]);
    const scope = page.locator('#scopeOfWork');
    await scope.click();
    await scope.pressSequentially('QA 252');
    await expect.poll(() => writes.length, { timeout: 5_000 }).toBe(1);
    await page.waitForTimeout(1_500);
    expect(writes).toHaveLength(1);
  } finally {
    expect(await strip()).toBe('ok');
  }
});
