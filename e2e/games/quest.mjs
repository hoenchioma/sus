// A full Polashi/Avalon game on bot-driven phones plus a TV. Phone 1 plays in Bangla; phone 3 reloads mid-game.
import { holdAndRelease, phone, saveScreens, sleep, tap, visible } from '../lib.mjs';

const NAMES = ['John Doe', 'Jane Alexandra Doe', 'Richard Roe', 'John Q. Public', 'Mary Major-Minor', 'জন ডো', 'Jonathan Doe-Smith', 'Joe Bloggs', 'Jane Smith', 'Max Mustermann'];
const bengaliToNumber = (s) => Number(s.replace(/[০-৯]/g, (d) => '০১২৩৪৫৬৭৮৯'.indexOf(d)));

export async function playQuest(browser, base, artifacts, { skin, players: count, preset }) {
  const errors = [];
  const res = await fetch(`${base}/api/rooms`, { method: 'POST', body: JSON.stringify({ game: 'quest', skin }) });
  const { code } = await res.json();

  const players = [];
  for (let i = 0; i < count; i++) {
    const p = await phone(browser, errors, i === 1 ? 'bn' : 'en');
    await p.page.goto(`${base}/play/${code}`);
    await p.page.getByPlaceholder(/Your name|আপনার নাম/).fill(NAMES[i]);
    await p.page.getByRole('button', { name: /^(Join|যোগ দিন)$/ }).click();
    await p.page.getByText(`· ${code}`).first().waitFor();
    players.push(p);
  }
  const host = players[0].page;
  const tv = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  tv.on('pageerror', (e) => errors.push(`tv: ${e.message}`));
  await tv.goto(`${base}/tv/${code}`);

  if (skin === 'avalon') await host.getByRole('button', { name: 'Avalon', exact: true }).click();
  await host.getByRole('button', { name: preset, exact: true }).click();
  await host.getByRole('button', { name: /Deal characters/ }).click();

  const pick = async (options) => tap(options.nth(Math.floor(Math.random() * (await options.count()))));

  const step = async (p) => {
    const page = p.page;
    const overlay = page.locator('div.fixed.inset-0.z-30');
    if (await visible(overlay)) return tap(overlay);

    const gotIt = page.getByRole('button', { name: /Got it|বুঝেছি/ });
    if (!p.revealed && (await visible(gotIt))) {
      p.revealed = true;
      await holdAndRelease(page, page.getByText(/Hold to see your character|চরিত্র দেখতে চেপে ধরুন/).first());
      return tap(gotIt);
    }

    const propose = page.getByRole('button', { name: /Propose this team|প্রস্তাব করুন/ });
    if (await visible(propose)) {
      const need = bengaliToNumber((await propose.innerText()).match(/\/(\d+|[০-৯]+)\)/)?.[1] ?? '0');
      const seats = page.locator('ul.grid li button');
      const order = [...Array(await seats.count()).keys()].sort(() => Math.random() - 0.5);
      for (const k of order.slice(0, need)) await tap(seats.nth(k));
      return tap(propose);
    }

    const approve = page.getByRole('button', { name: /👍 (Approve|সমর্থন)/ });
    if (await visible(approve)) {
      if (await page.locator('button.bg-village, button.bg-mafia').count()) return false;
      return tap(Math.random() < 0.65 ? approve : page.getByRole('button', { name: /👎/ }));
    }

    const succeed = page.getByRole('button', { name: /🛡️/ }).first();
    if (await visible(succeed)) {
      const betray = page.getByRole('button', { name: /🗡️/ });
      const canBetray = await betray.isEnabled().catch(() => false);
      return tap(canBetray && Math.random() < 0.6 ? betray : succeed);
    }

    const spy = page.getByText(/🕵️ (Choose someone to inspect|কাকে পরীক্ষা করবেন)/);
    if (await visible(spy)) return pick(spy.locator('xpath=ancestor::div[contains(@class,"rounded-card")]').locator('button'));

    if (await visible(page.getByText(/Point them out|দেখিয়ে দিন/))) return pick(page.locator('button.from-mafia'));
    return false;
  };

  const deadline = Date.now() + 8 * 60_000;
  let reloaded = false;
  while (Date.now() < deadline) {
    let acted = false;
    for (const p of players) acted = (await step(p)) || acted;

    if (!reloaded && (await visible(players[3].page.getByRole('button', { name: /👍 Approve/ })))) {
      // Simulate a phone locking: reopen the page and expect the saved token to rejoin it.
      reloaded = true;
      await players[3].page.close();
      players[3].page = await players[3].ctx.newPage();
      players[3].page.on('pageerror', (e) => errors.push(e.message));
      players[3].page.on('dialog', (d) => d.accept());
      await players[3].page.goto(`${base}/play/${code}`);
      await players[3].page.getByText(`${NAMES[3]} · ${code}`).waitFor({ timeout: 10_000 });
    }

    const winner = players[2].page.getByRole('heading', { level: 1 }).filter({ hasText: /win|ended/ });
    if (await visible(winner)) {
      if (!reloaded) throw new Error('game ended before the reload check ran');
      if (errors.length) throw new Error(`page errors: ${errors.slice(0, 3).join(' | ')}`);
      return (await winner.innerText()).trim();
    }
    if (!acted) await sleep(500);
  }

  await saveScreens(artifacts, [...players.map((p) => p.page), tv]);
  throw new Error(`game did not finish in time${errors.length ? `; page errors: ${errors.slice(0, 3).join(' | ')}` : ''}`);
}
