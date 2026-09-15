import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Run the actual orchestrator with all process and HTTP boundaries replaced.
// It cannot reach a database, provider API, ingester or deploy command.
const fixture = String.raw`
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { writeFileSync } from 'node:fs';
const calls = [];
let migrated = false;
const pending = process.env.SCENARIO.startsWith('pending');
const before = 'a'.repeat(40);
const after = 'b'.repeat(40);
const versions = ['20260908000001', '20260909150000'];
process.on('exit', () => writeFileSync(process.env.TRACE_PATH, JSON.stringify(calls)));
childProcess.execFileSync = (command, args) => {
  if (command === 'git') {
    if (args[0] === 'rev-parse') return after;
    if (args[0] === 'merge-base') return '';
    if (args[0] === 'diff') return pending ? 'A\0packages/database/supabase/migrations/20260909150000_second.sql\0' : 'M\0apps/web/src/app/page.tsx\0';
  }
  if (command === 'psql') {
    const sql = args.at(-1);
    if (sql.includes('to_regclass')) return 't';
    if (sql.includes('select version')) return (pending && !migrated ? versions.slice(0, 1) : versions).join('\n');
    return JSON.stringify({ natures: 25, items: 175, learnsets: 693197, species: 1025, bad_defaults: 0, missing_sentinels: 0 });
  }
  throw new Error('Unexpected process boundary');
};
childProcess.spawnSync = (command, args, options) => {
  calls.push({ command, args, envKeys: Object.keys(options.env) });
  if (args[0] === 'db:cloud-dev:migrate') migrated = true;
  const fail = process.env.SCENARIO === 'pending-fail-migrate' && args[0] === 'db:cloud-dev:migrate' ||
    process.env.SCENARIO === 'pending-fail-ingest' && args[0] === 'ingest:cloud-dev';
  return { status: fail ? 1 : 0 };
};
syncBuiltinESMExports();
globalThis.fetch = async (input, options) => {
  const url = new URL(input);
  if (url.hostname === 'api.github.com') {
    if (url.pathname.endsWith('/commits/main')) return Response.json({ sha: after });
    if (url.pathname.endsWith('/deployment-branch-policies')) return Response.json({ branch_policies: [{ name: 'main', type: 'branch' }] });
    if (url.pathname.includes('/environments/')) return Response.json({ deployment_branch_policy: { custom_branch_policies: true } });
    if (url.pathname.includes('/actions/workflows/')) return Response.json({ workflow_runs: [{ id: 2, event: 'push', conclusion: 'success', head_sha: before, head_repository: { full_name: 'Xarli11/PokeStudio' } }] });
  }
  if (url.hostname === 'api.cloudflare.com') {
    let result;
    if (url.pathname.endsWith('/workers/subdomain')) result = { subdomain: 'carlosgt2001' };
    else if (url.pathname.endsWith('/workers/scripts')) result = [{ id: 'pokestudio', tag: 'a'.repeat(32) }];
    else if (url.pathname.endsWith('/triggers')) result = process.env.SCENARIO === 'active-build' ? [{}] : [];
    else if (url.pathname.endsWith('/settings')) result = { bindings: [] };
    else if (url.pathname.endsWith('/deployments')) result = { deployments: [{ id: 'deployment', versions: [{ percentage: 100, version_id: 'version' }] }] };
    else throw new Error('Unexpected Cloudflare call');
    return Response.json({ success: true, result });
  }
  if (url.hostname === 'tofhupgwxsexrburoqys.supabase.co') {
    if (options.headers.apikey !== 'sb_publishable_test') throw new Error('Privileged public read');
    return Response.json([{ id: 'reference' }]);
  }
  throw new Error('Unexpected network boundary');
};
`;

function scenario(name) {
  const directory = mkdtempSync(join(tmpdir(), 'pokestudio-release-test-'));
  try {
    for (const path of ['apps/web', 'scripts/ci', 'packages/database/supabase/migrations']) {
      mkdirSync(join(directory, path), { recursive: true });
    }
    for (const file of ['20260908000001_first.sql', '20260909150000_second.sql']) {
      writeFileSync(join(directory, 'packages/database/supabase/migrations', file), '');
    }
    writeFileSync(join(directory, 'scripts/ci/integrity.sql'), 'select integrity');
    writeFileSync(join(directory, 'apps/web/wrangler.jsonc'), '{"name":"pokestudio"}');
    writeFileSync(join(directory, 'mock.mjs'), fixture);
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        join(directory, 'mock.mjs'),
        fileURLToPath(new URL('./release.mjs', import.meta.url)),
      ],
      {
        cwd: directory,
        encoding: 'utf8',
        env: {
          PATH: process.env.PATH,
          CI: 'true',
          GITHUB_TOKEN: 'test-token',
          GITHUB_REPOSITORY: 'Xarli11/PokeStudio',
          GITHUB_REF: 'refs/heads/main',
          GITHUB_SHA: 'b'.repeat(40),
          GITHUB_RUN_ID: '3',
          RELEASE_TARGET: 'cloud-dev',
          DELIVERY_ENABLED: 'true',
          CLOUDFLARE_DEPLOY_OWNER: 'github-actions',
          CLOUDFLARE_ACCOUNT_ID: 'c'.repeat(32),
          CLOUDFLARE_API_TOKEN: 'test-cf-token',
          SUPABASE_DB_URL:
            'postgres://postgres:fake@db.tofhupgwxsexrburoqys.supabase.co:5432/postgres?sslmode=require',
          SUPABASE_INGEST_KEY: 'test-ingest',
          SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
          SCENARIO: name,
          TRACE_PATH: join(directory, 'trace.json'),
        },
      },
    );
    return { ...result, calls: JSON.parse(readFileSync(join(directory, 'trace.json'), 'utf8')) };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('frontend delivery skips DB mutations, builds without privileged credentials and deploys once', () => {
  const result = scenario('frontend');
  assert.equal(result.status, 0, result.stderr);
  const commands = result.calls.map((call) => call.args.join(' '));
  assert.deepEqual(commands, [
    'db:cloud-dev:check',
    '--filter @pokestudio/web build:cf --config wrangler.release.json',
    '--filter @pokestudio/web deploy:cf:built --config wrangler.release.json',
    'smoke:cloud-dev',
  ]);
  const build = result.calls.find((call) => call.args.includes('build:cf'));
  for (const key of [
    'SUPABASE_DB_URL',
    'SUPABASE_INGEST_KEY',
    'CLOUDFLARE_API_TOKEN',
    'GITHUB_TOKEN',
  ]) {
    assert.equal(build.envKeys.includes(key), false);
  }
});
test('pending migrations and ingestion precede build, deployment and smoke', () => {
  const result = scenario('pending');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    result.calls.map((call) => call.args[0]),
    [
      'db:cloud-dev:check',
      'db:cloud-dev:migrate',
      'ingest:cloud-dev',
      '--filter',
      '--filter',
      'smoke:cloud-dev',
    ],
  );
});
for (const failure of ['pending-fail-migrate', 'pending-fail-ingest', 'active-build']) {
  test(`${failure} stops before web build or deployment`, () => {
    const result = scenario(failure);
    assert.equal(result.status, 1);
    assert.equal(
      result.calls.some(
        (call) => call.args.includes('build:cf') || call.args.includes('deploy:cf:built'),
      ),
      false,
    );
    if (failure === 'pending-fail-migrate')
      assert.equal(
        result.calls.some((call) => call.args[0] === 'ingest:cloud-dev'),
        false,
      );
    if (failure === 'active-build') assert.equal(result.calls.length, 0);
  });
}
