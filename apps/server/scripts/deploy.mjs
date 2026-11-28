// Deploys the Worker with wrangler. Set DEPLOY_DOMAIN (e.g. sus.example.com, a hostname in a zone on your
// Cloudflare account) to serve it on a custom domain; without it, it's served on your workers.dev subdomain.
// TV_APP_URL is where <site>/tv.apk sends people for the Android TV app. Variables can also go in a .env
// file at the repo root.
//
// It also sets up the stats database: it finds (or creates) the `sus-stats` D1 database on the account, applies
// its schema, and deploys with it attached. The first deploy generates STATS_SECRET, the key that scrambles
// names; it stays on the Worker afterwards. If the API token can't use D1, the site deploys without stats.
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const rootEnv = new URL('../../../.env', import.meta.url);
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const serverDir = new URL('..', import.meta.url);
const scratch = mkdtempSync(join(tmpdir(), 'sus-deploy-'));
const DATABASE = 'sus-stats';
// Sits next to wrangler.jsonc so its relative paths still work. Gitignored: it holds the account's database id.
const deployConfig = 'wrangler.deploy.jsonc';

function wrangler(args, { quiet = false, env = {} } = {}) {
  const result = spawnSync('npx', ['wrangler', ...args], {
    cwd: serverDir,
    stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: { ...process.env, ...env },
  });
  return { ok: result.status === 0, out: result.stdout ?? '', err: result.stderr ?? '' };
}

/** Wrangler's JSON output can be preceded by warnings (e.g. about proxies); take the JSON part. */
function parseJson(text) {
  const start = text.search(/^[[{]/m);
  return start < 0 ? null : JSON.parse(text.slice(start));
}

function findDatabase() {
  const list = wrangler(['d1', 'list', '--json'], { quiet: true });
  if (!list.ok) return { error: list.err.trim().split('\n').slice(-3).join(' ') };
  return { id: parseJson(list.out)?.find((db) => db.name === DATABASE)?.uuid ?? null };
}

function setUpDatabase() {
  let found = findDatabase();
  if (found.error) return found;
  if (!found.id) {
    console.log(`Creating the ${DATABASE} database for game stats…`);
    const created = wrangler(['d1', 'create', DATABASE], { quiet: true });
    if (!created.ok) return { error: created.err.trim() };
    found = findDatabase();
    if (!found.id) return { error: `created ${DATABASE} but could not find it afterwards` };
  }
  return found;
}

// Strip whole-line comments so the config parses as JSON (no value in it contains "//").
const config = JSON.parse(readFileSync(new URL('wrangler.jsonc', serverDir), 'utf8').replace(/^\s*\/\/.*$/gm, ''));
const database = setUpDatabase();
if (database.error) {
  console.warn(`\n⚠ Game stats are off for this deploy: ${database.error}`);
  console.warn('  To turn them on, give the API token the "D1: Edit" permission.\n');
  delete config.d1_databases;
} else {
  config.d1_databases = config.d1_databases.map((db) => ({ ...db, database_id: database.id }));
}
writeFileSync(new URL(deployConfig, serverDir), JSON.stringify(config, null, 2));

if (!database.error) {
  const migrated = wrangler(['d1', 'migrations', 'apply', DATABASE, '--remote', '--config', deployConfig], { env: { CI: 'true' } });
  if (!migrated.ok) process.exit(1);
}

// Only the first deploy sets the secret; later deploys keep whatever the Worker has (--secrets-file only adds).
const deployArgs = ['deploy', '--config', deployConfig];
if (!database.error) {
  const listed = wrangler(['secret', 'list', '--config', deployConfig], { quiet: true });
  // A brand-new Worker has no secrets yet. Any other failure might hide an existing secret, and replacing it
  // would cut every player off from their earlier games, so leave it alone then.
  const newWorker = !listed.ok && /10007|does not exist/i.test(listed.err + listed.out);
  if (!listed.ok && !newWorker) console.warn(`⚠ Could not check the Worker's secrets, so STATS_SECRET was left as it is: ${listed.err.trim()}`);
  const names = listed.ok ? (parseJson(listed.out) ?? []).map((s) => s.name) : [];
  if ((listed.ok || newWorker) && !names.includes('STATS_SECRET')) {
    const secretsFile = join(scratch, 'secrets.json');
    writeFileSync(secretsFile, JSON.stringify({ STATS_SECRET: process.env.STATS_SECRET?.trim() || randomBytes(32).toString('base64url') }));
    deployArgs.push('--secrets-file', secretsFile);
    console.log('Setting STATS_SECRET for the first time.');
  }
}

const domain = process.env.DEPLOY_DOMAIN?.trim();
const tvApp = process.env.TV_APP_URL?.trim();
if (domain) deployArgs.push('--domain', domain);
if (tvApp) deployArgs.push('--var', `TV_APP_URL:${tvApp}`);
const outputFile = join(scratch, 'output.ndjson');
if (!wrangler(deployArgs, { env: { WRANGLER_OUTPUT_FILE_PATH: outputFile } }).ok) process.exit(1);

// wrangler writes one JSON event per line; the deploy event lists the URLs the Worker now answers on.
const deployed = readFileSync(outputFile, 'utf8').trim().split('\n').map((line) => JSON.parse(line)).find((e) => e.type === 'deploy');
const url = domain ? `https://${domain}` : deployed?.targets?.find((t) => t.startsWith('https://'));
if (!url) {
  console.error('Deployed, but could not tell which URL the Worker is served on.');
  process.exit(1);
}
console.log(`\nLive at ${url}`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `url=${url}\n`);
