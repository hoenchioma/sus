// A full Mafia game on 7 bot-driven phones plus a TV, with one phone reloading mid-game.
import { holdAndRelease, phone, saveScreens, sleep, tap, visible } from '../lib.mjs';

const NAMES = ['John Doe', 'Jane Alexandra Doe', 'Richard Roe', 'John Q. Public', 'Mary Major-Minor', 'জন ডো', 'Jonathan Doe-Smith'];

export async function play(browser, base, artifacts) {
  const errors = [];
  const players = [];

  const host = await phone(browser, errors);
  await host.page.goto(`${base}/`);
  await host.page.getByRole('button', { name: 'Host', exact: true }).click();
  await host.page.waitForURL(/\/play\/[A-Z]{4}/);
  const code = host.page.url().split('/').pop();
  players.push(host);

  for (let i = 1; i < NAMES.length; i++) players.push(await phone(browser, errors));
  for (let i = 0; i < NAMES.length; i++) {
    const { page } = players[i];
    if (i > 0) await page.goto(`${base}/play/${code}`);
    await page.getByPlaceholder('Your name').fill(NAMES[i]);
    await page.getByRole('button', { name: 'Join', exact: true }).click();
    await page.getByText(`${NAMES[i]} · `).first().waitFor();
  }

  const tv = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  tv.on('pageerror', (e) => errors.push(`tv: ${e.message}`));
  await tv.goto(`${base}/tv/${code}`);

  await host.page.getByRole('button', { name: 'game', exact: true }).click();
  await host.page.getByRole('button', { name: '1 min' }).click();
  await host.page.getByRole('button', { name: 'Deal roles' }).click();

  const step = async (p, i) => {
    const page = p.page;
    const overlay = page.getByText('Tap to close');
    if (await visible(overlay)) return tap(overlay);

    const hold = page.getByText('Hold to see your role');
    if (!p.revealed && (await visible(hold))) {
      p.revealed = true;
      await holdAndRelease(page, hold);
      return tap(page.getByRole('button', { name: 'Got it' }));
    }

    const done = page.getByRole('button', { name: 'Done, close my eyes' });
    if ((await visible(done)) && (await done.isEnabled().catch(() => false))) return tap(done);

    const options = page.locator('button.min-h-14:not([disabled])');
    const prompt = page.getByText(/Who should be voted out\?|Runoff: one of these two|Who (do you|should)|Do you take a shot|Whose ability/).first();
    if ((await visible(prompt)) && (await options.count())) {
      if (await page.locator('button.min-h-14.bg-sky, button.min-h-14.bg-mafia').count()) return false;
      return tap(options.nth((i + 3) % (await options.count())));
    }

    if (i === 0) {
      for (const name of ['Start the vote now', /^Night falls/]) {
        const button = page.getByRole('button', { name });
        if (await visible(button)) return tap(button);
      }
    }
    return false;
  };

  const deadline = Date.now() + 8 * 60_000;
  let reloaded = false;
  while (Date.now() < deadline) {
    let acted = false;
    for (let i = 0; i < players.length; i++) acted = (await step(players[i], i)) || acted;

    if (!reloaded && (await visible(players[4].page.getByText(/Night 1|Day 1/).first()))) {
      // Simulate a phone locking: reopen the page and expect the saved token to rejoin it.
      reloaded = true;
      await players[4].page.close();
      players[4].page = await players[4].ctx.newPage();
      players[4].page.on('pageerror', (e) => errors.push(e.message));
      await players[4].page.goto(`${base}/play/${code}`);
      await players[4].page.getByText(`${NAMES[4]} · `).first().waitFor({ timeout: 10_000 });
    }

    const winner = tv.getByText(/wins|Nobody survived/).first();
    if (await visible(winner)) {
      if (errors.length) throw new Error(`page errors: ${errors.slice(0, 3).join(' | ')}`);
      return (await winner.innerText()).trim();
    }
    if (!acted) await sleep(500);
  }

  await saveScreens(artifacts, [...players.map((p) => p.page), tv]);
  throw new Error(`game did not finish in time${errors.length ? `; page errors: ${errors.slice(0, 3).join(' | ')}` : ''}`);
}
