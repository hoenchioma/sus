// Deploys the Worker with wrangler. Set DEPLOY_DOMAIN (e.g. sus.example.com, a hostname in a zone on your
// Cloudflare account) to serve it on a custom domain; without it, it's served on your workers.dev subdomain.
// TV_APP_URL is where <site>/tv.apk sends people for the Android TV app. Variables can also go in a .env
// file at the repo root.
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const rootEnv = new URL('../../../.env', import.meta.url);
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const domain = process.env.DEPLOY_DOMAIN?.trim();
const outputFile = join(mkdtempSync(join(tmpdir(), 'sus-deploy-')), 'output.ndjson');
const tvApp = process.env.TV_APP_URL?.trim();
const args = ['wrangler', 'deploy', ...(domain ? ['--domain', domain] : []), ...(tvApp ? ['--var', `TV_APP_URL:${tvApp}`] : [])];

const { status } = spawnSync('npx', args, {
  cwd: new URL('..', import.meta.url),
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, WRANGLER_OUTPUT_FILE_PATH: outputFile },
});
if (status !== 0) process.exit(status ?? 1);

// wrangler writes one JSON event per line; the deploy event lists the URLs the Worker now answers on.
const deployed = readFileSync(outputFile, 'utf8').trim().split('\n').map((line) => JSON.parse(line)).find((e) => e.type === 'deploy');
const url = domain ? `https://${domain}` : deployed?.targets?.find((t) => t.startsWith('https://'));
if (!url) {
  console.error('Deployed, but could not tell which URL the Worker is served on.');
  process.exit(1);
}
console.log(`\nLive at ${url}`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `url=${url}\n`);
