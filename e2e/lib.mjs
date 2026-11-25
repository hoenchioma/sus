import { devices } from 'playwright';
import { mkdirSync } from 'node:fs';

/** A phone-sized browser page that collects uncaught page errors. `lang` presets the Polashi/Avalon language. */
export async function phone(browser, errors, lang = 'en') {
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript((l) => localStorage.setItem('sus.lang', JSON.stringify(l)), lang);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  return { ctx, page };
}

/**
 * Screens re-render as the server pushes updates, so a button can disappear between finding and clicking it.
 * Bots treat that as "nothing to do this round" rather than a failure.
 */
export const tap = (locator) => locator.click({ timeout: 2000 }).then(() => true, () => false);

export const visible = (locator) => locator.isVisible().catch(() => false);

export async function holdAndRelease(page, locator, ms = 150) {
  const box = await locator.boundingBox();
  if (!box) return false;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
  return true;
}

export async function saveScreens(dir, pages) {
  mkdirSync(dir, { recursive: true });
  await Promise.all(pages.map((page, i) => page.screenshot({ path: `${dir}/phone-${i}.png` }).catch(() => {})));
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
