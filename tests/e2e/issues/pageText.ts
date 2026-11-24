import { expect, type Page } from '@playwright/test';

/**
 * #317: `main`'s text, whitespace collapsed, read once every `ready` string or
 * pattern is on the page.
 *
 * A page renders its headings before all of its data hooks have returned: the
 * MDP's "DEMAND BY LOAD TYPE" shows while every panel still has 0 circuits,
 * and the Short Circuit cards show before the panels the Stale check needs. A
 * spec that waits for a heading and then reads `innerText()` once can read the
 * page half-loaded (issue-291 read "TOTAL DEMAND 0.0 kVA"). Name the text that
 * proves the data is there; a negative check (`not.toContain`) is only
 * meaningful after it.
 */
export async function mainTextWhen(page: Page, ready: ReadonlyArray<string | RegExp>, timeout = 20_000) {
  const text = async () => (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  await expect
    .poll(async () => {
      const t = await text();
      return ready.filter((r) => (typeof r === 'string' ? !t.includes(r) : !r.test(t))).map(String);
    }, { timeout, message: 'text still missing from the page' })
    .toEqual([]);
  return text();
}
