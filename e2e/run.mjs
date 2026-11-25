// Simulated game tests: starts the local Worker, plays full games with bot-driven browser phones, then stops it.
// Usage: node e2e/run.mjs mafia [more games...]   (set BASE_URL to test an already-running server)
import { spawn } from 'node:child_process';
import { mkdirSync, openSync } from 'node:fs';
import { chromium } from 'playwright';

const games = process.argv.slice(2);
if (!games.length) {
  console.error('Usage: node e2e/run.mjs <game> [...]');
  process.exit(2);
}

const PORT = 8787;
const base = process.env.BASE_URL ?? `http://127.0.0.1:${PORT}`;
const artifacts = process.env.E2E_ARTIFACTS ?? 'e2e-artifacts';
mkdirSync(artifacts, { recursive: true });

async function waitForServer(url, ms = 90_000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} did not start`);
}

let server;
if (!process.env.BASE_URL) {
  const log = openSync(`${artifacts}/server.log`, 'w');
  server = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--ip', '127.0.0.1'], {
    cwd: new URL('../apps/server/', import.meta.url),
    stdio: ['ignore', log, log],
    detached: true,
  });
}

let failed = false;
try {
  await waitForServer(base);
  const browser = await chromium.launch();
  try {
    for (const name of games) {
      const { play } = await import(`./games/${name}.mjs`);
      const started = Date.now();
      try {
        const result = await play(browser, base, `${artifacts}/${name}`);
        console.log(`✓ ${name}: ${result} (${Math.round((Date.now() - started) / 1000)}s)`);
      } catch (error) {
        failed = true;
        console.error(`✗ ${name}: ${error.message}`);
      }
    }
  } finally {
    await browser.close();
  }
} finally {
  // npx starts wrangler, which starts workerd; kill the whole group so nothing is left holding the port.
  if (server) process.kill(-server.pid);
}
process.exit(failed ? 1 : 0);
