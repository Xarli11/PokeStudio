import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import ts from 'typescript';
import {
  assertDatabaseUrl,
  assertPublishableKey,
  assertNoBuildTriggers,
  targetFor,
} from './target.mjs';
import { assertAppendOnly, migrationDirectory, needsIngestion, planMigrations } from './plan.mjs';
import { assertMain, preflight, successfulRun, summary } from './github.mjs';

const name = process.env.RELEASE_TARGET;
const sha = process.env.GITHUB_SHA;
const generatedConfig = 'apps/web/wrangler.release.json';

function run(command, args, env) {
  const result = spawnSync(command, args, { env, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} failed; delivery stopped.`);
}

// Only operational values required by child commands. DB credentials never reach a build.
function baseEnv() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([key]) =>
      ['PATH', 'HOME', 'TMPDIR', 'LANG', 'CI', 'PNPM_HOME', 'SYSTEMROOT'].includes(key),
    ),
  );
}

function query(sql) {
  try {
    return execFileSync('psql', ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
      encoding: 'utf8',
      timeout: 70000,
      env: {
        ...baseEnv(),
        PGDATABASE: process.env.SUPABASE_DB_URL,
        PGCONNECT_TIMEOUT: '15',
        PGOPTIONS: '-c default_transaction_read_only=on -c statement_timeout=60000',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    throw new Error('Read-only database query failed; details suppressed to protect credentials.');
  }
}

function pendingMigrations() {
  const exists = query("select to_regclass('supabase_migrations.schema_migrations') is not null");
  const applied =
    exists === 't'
      ? query('select version from supabase_migrations.schema_migrations order by version')
          .split('\n')
          .filter(Boolean)
      : [];
  return planMigrations(
    readdirSync(migrationDirectory).filter((file) => file.endsWith('.sql')),
    applied,
  );
}

async function cloudflare(path) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/${path}`,
    {
      headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!response.ok) throw new Error(`Cloudflare target audit failed (${response.status}).`);
  const payload = await response.json();
  if (!payload.success) throw new Error('Cloudflare target audit rejected.');
  if (payload.result_info?.total_pages > 1)
    throw new Error('Cloudflare audit response is incomplete.');
  return payload.result;
}

async function assertWorker(target) {
  if (
    !/^[a-f0-9]{32}$/.test(process.env.CLOUDFLARE_ACCOUNT_ID ?? '') ||
    !process.env.CLOUDFLARE_API_TOKEN
  ) {
    throw new Error('Cloudflare account and scoped token are required.');
  }
  const { subdomain } = await cloudflare('workers/subdomain');
  if (target.url !== `https://${target.worker}.${subdomain}.workers.dev`) {
    throw new Error('Cloudflare account does not own the approved workers.dev target.');
  }
  const workers = await cloudflare('workers/scripts');
  const worker = workers.find((entry) => entry.id === target.worker);
  if (!/^[a-f0-9]{32}$/.test(worker?.tag ?? ''))
    throw new Error('Approved Worker identity is missing.');
  assertNoBuildTriggers(await cloudflare(`builds/workers/${worker.tag}/triggers`));
  const settings = await cloudflare(`workers/scripts/${target.worker}/settings`);
  if (
    settings.bindings?.some((binding) =>
      /SUPABASE.*(SECRET|SERVICE_ROLE|DB_URL|INGEST)/.test(binding.name),
    )
  ) {
    throw new Error('Remove privileged Supabase credentials from the web Worker before delivery.');
  }
}

async function integrity(target) {
  const counts = JSON.parse(query(readFileSync('scripts/ci/integrity.sql', 'utf8')));
  if (
    counts.natures !== 25 ||
    counts.items < 175 ||
    counts.learnsets < 693197 ||
    counts.species < 1025 ||
    counts.bad_defaults !== 0 ||
    counts.missing_sentinels !== 0
  ) {
    throw new Error(`Reference-data integrity failed: ${JSON.stringify(counts)}`);
  }
  summary(`Reference integrity: ${JSON.stringify(counts)}`);
  // Proves the supplied public key actually reads this target; SQL alone bypasses RLS.
  for (const table of ['nature', 'item', 'pokemon_form_move']) {
    const response = await fetch(
      `https://${target.projectRef}.supabase.co/rest/v1/${table}?select=id&source_id=eq.pokeapi&limit=1`,
      {
        headers: {
          apikey: process.env.SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_PUBLISHABLE_KEY}`,
        },
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!response.ok || (await response.json()).length !== 1)
      throw new Error(`Public API integrity failed: ${table}.`);
  }
}

async function main() {
  const target = targetFor(name);
  if (
    process.env.DELIVERY_ENABLED !== 'true' ||
    process.env.CLOUDFLARE_DEPLOY_OWNER !== 'github-actions'
  ) {
    throw new Error('Delivery disabled: complete the reviewed Cloudflare ownership cutover first.');
  }
  await preflight(name, true); // Recheck after waiting for Environment approval.
  assertDatabaseUrl(process.env.SUPABASE_DB_URL, target.projectRef);
  assertPublishableKey(process.env.SUPABASE_PUBLISHABLE_KEY, target.projectRef);
  await assertWorker(target);

  const baseline = (await successfulRun(name)) ?? target.bootstrapSha ?? null;
  let paths = [];
  if (baseline) {
    execFileSync('git', ['merge-base', '--is-ancestor', baseline, sha], { stdio: 'pipe' });
    const changes = execFileSync(
      'git',
      ['diff', '--name-status', '--no-renames', '-z', baseline, sha],
      { encoding: 'utf8' },
    )
      .split('\0')
      .filter(Boolean);
    const entries = [];
    for (let i = 0; i < changes.length; i += 2) entries.push([changes[i], changes[i + 1]]);
    assertAppendOnly(entries);
    paths = entries.map((entry) => entry[1]);
  }
  // Remote history is authoritative. Reject unknown/aliased histories before any repair-capable script.
  const pending = pendingMigrations();
  const ingest = needsIngestion(paths, {
    force: process.env.FORCE_INGEST === 'true',
    bootstrap: !baseline,
    pending,
  });
  summary(
    `## ${name}: ${sha}\nBaseline: ${baseline ?? 'first delivery'}\nPending migrations: ${pending.join(', ') || 'none'}\nIngestion: ${ingest ? 'required' : 'not required'}`,
  );
  const databaseEnv = {
    ...baseEnv(),
    SUPABASE_DB_URL: process.env.SUPABASE_DB_URL,
    SUPABASE_CLOUD_DEV_DB_URL: process.env.SUPABASE_DB_URL,
    POKESTUDIO_PRODUCTION_APPROVED_SHA: name === 'production' ? sha : undefined,
  };
  if (ingest && !process.env.SUPABASE_INGEST_KEY) throw new Error('Missing ingestion credential.');
  run('pnpm', [`db:${name}:check`], databaseEnv);
  if (pending.length) {
    run('pnpm', [`db:${name}:migrate`], databaseEnv);
    if (pendingMigrations().length) throw new Error('Migrations remain pending.');
  }
  if (ingest) {
    if (!process.env.SUPABASE_INGEST_KEY) throw new Error('Missing ingestion credential.');
    run('pnpm', [`ingest:${name}`], {
      ...databaseEnv,
      SUPABASE_CLOUD_DEV_SECRET_KEY: process.env.SUPABASE_INGEST_KEY,
      SUPABASE_INGEST_KEY: process.env.SUPABASE_INGEST_KEY,
    });
  }
  await integrity(target);
  const parsed = ts.parseConfigFileTextToJson(
    'wrangler.jsonc',
    readFileSync('apps/web/wrangler.jsonc', 'utf8'),
  );
  if (
    parsed.error ||
    parsed.config.routes?.length ||
    parsed.config.env ||
    parsed.config.account_id
  ) {
    throw new Error('Base Wrangler config changed; review target generation before delivery.');
  }
  const publicEnv = {
    NEXT_PUBLIC_SUPABASE_URL: `https://${target.projectRef}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
    POKESTUDIO_RELEASE_SHA: sha,
    POKESTUDIO_RELEASE_TARGET: name,
  };
  writeFileSync(
    generatedConfig,
    JSON.stringify(
      {
        ...parsed.config,
        name: target.worker,
        account_id: process.env.CLOUDFLARE_ACCOUNT_ID,
        workers_dev: true,
        routes: [],
        vars: { ...parsed.config.vars, ...publicEnv },
      },
      null,
      2,
    ),
  );
  try {
    run('pnpm', ['--filter', '@pokestudio/web', 'build:cf', '--config', 'wrangler.release.json'], {
      ...baseEnv(),
      ...publicEnv,
    });
    await assertMain(); // Do not publish an obsolete build after a long ingestion.
    await assertWorker(target);
    const before = await cloudflare(`workers/scripts/${target.worker}/deployments`);
    summary(`Previous Worker deployment: ${before.deployments?.[0]?.id ?? 'none'}`);
    run(
      'pnpm',
      ['--filter', '@pokestudio/web', 'deploy:cf:built', '--config', 'wrangler.release.json'],
      {
        ...baseEnv(),
        ...publicEnv,
        CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
        CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
      },
    );
    const after = await cloudflare(`workers/scripts/${target.worker}/deployments`);
    summary(`Worker deployment: ${after.deployments?.[0]?.id ?? 'unavailable'}`);
    summary(`Worker versions: ${JSON.stringify(after.deployments?.[0]?.versions ?? [])}`);
    run('pnpm', [`smoke:${name}`], {
      ...baseEnv(),
      POKESTUDIO_CLOUD_DEV_WORKER_URL: target.url,
      POKESTUDIO_SMOKE_URL: target.url,
      POKESTUDIO_EXPECTED_SHA: sha,
      POKESTUDIO_EXPECTED_PROJECT_REF: target.projectRef,
      POKESTUDIO_EXPECTED_TARGET: name,
    });
    summary('Delivery and smoke passed. This workflow success is the next baseline.');
  } finally {
    rmSync(generatedConfig, { force: true });
  }
}

main().catch((error) => {
  // Child commands and explicit summaries provide diagnostics; never dump exec errors (argv contains secrets).
  console.error(error.message);
  console.error(
    'Delivery failed. Inspect the last completed step; no further mutations were attempted.',
  );
  process.exitCode = 1;
});
