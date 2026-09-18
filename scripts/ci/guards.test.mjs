import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertDatabaseUrl,
  assertPublishableKey,
  assertNoBuildTriggers,
  targetFor,
  targets,
} from './target.mjs';
import { assertAppendOnly, needsIngestion, planMigrations } from './plan.mjs';
import { assertProtection, assertApproval, assertRepositoryIdentity } from './github.mjs';
import { hasErrorDigest, smoke } from './smoke.mjs';

const ref = targets['cloud-dev'].projectRef;
const direct = `postgresql://postgres:password@db.${ref}.supabase.co:5432/postgres?sslmode=require`;
test('delivery requires a proven empty Cloudflare build trigger list', () => {
  assertNoBuildTriggers([]);
  assert.throws(() => assertNoBuildTriggers([{ branch_includes: ['main'] }]));
  assert.throws(() => assertNoBuildTriggers(undefined));
});
test('accepts direct and session-pooled TLS connections for the exact project', () => {
  assertDatabaseUrl(direct, ref);
  assertDatabaseUrl(
    `postgres://postgres.${ref}:p%40ss@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=verify-full`,
    ref,
  );
});

for (const [name, url] of Object.entries({
  passwordSpoof: `postgres://postgres:${ref}@db.aaaaaaaaaaaaaaaaaaaa.supabase.co/postgres?sslmode=require`,
  querySpoof: `postgres://postgres:pw@example.com/postgres?ref=${ref}&sslmode=require`,
  suffixSpoof: direct.replace('.supabase.co:', '.supabase.co.evil.example:'),
  poolerUserSpoof: `postgres://postgres.${ref}:pw@example.com:5432/postgres?sslmode=require`,
  transactionPool: `postgres://postgres.${ref}:pw@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require`,
  databaseOverride: direct + '&host=evil.example',
  noTls: direct.replace('?sslmode=require', ''),
  duplicateTls: direct + '&sslmode=disable',
  local: 'postgres://postgres:pw@127.0.0.1:5432/postgres?sslmode=require',
}))
  test(`rejects ${name} without printing credentials`, () => {
    assert.throws(
      () => assertDatabaseUrl(url, ref),
      (error) => !error.message.includes(url),
    );
  });

test('production stays blocked until an independently reviewed target exists', () => {
  assert.throws(() => targetFor('production'), /not approved/);
  assert.throws(() => targetFor('staging'), /not approved/);
});
test('web rejects privileged and wrong-project JWT keys', () => {
  const key = (role, project) =>
    `eyJ.${Buffer.from(JSON.stringify({ role, ref: project })).toString('base64url')}.sig`;
  assertPublishableKey('sb_publishable_example', ref);
  assertPublishableKey(key('anon', ref), ref);
  assert.throws(() => assertPublishableKey(key('service_role', ref), ref));
  assert.throws(() => assertPublishableKey(key('anon', 'another'), ref));
  assert.throws(() => assertPublishableKey('sb_secret_example', ref));
});

const files = ['20260908000001_first.sql', '20260909150000_second.sql'];
test('migration plan uses actual canonical prefix; no-op and pending work', () => {
  assert.deepEqual(planMigrations(files, ['20260908000001']), ['20260909150000']);
  assert.deepEqual(planMigrations(files, ['20260908000001', '20260909150000']), []);
  assert.equal(planMigrations(files, []).length, 2);
});
test('unknown history, missing earlier migrations and duplicate versions abort', () => {
  assert.throws(() => planMigrations(files, ['20260914005733']));
  assert.throws(() => planMigrations(files, ['20260909150000']));
  assert.throws(() => planMigrations([...files, '20260908000001_duplicate.sql'], []));
  assert.throws(() => planMigrations(['invalid.sql'], []));
});
test('historical migration edits and deletions fail', () => {
  const path = `packages/database/supabase/migrations/${files[0]}`;
  assertAppendOnly([['A', path]]);
  assert.throws(() => assertAppendOnly([['M', path]]));
  assert.throws(() => assertAppendOnly([['D', path]]));
});
test('frontend-only and test-only releases avoid ingestion', () => {
  assert.equal(needsIngestion(['apps/web/src/app/page.tsx', 'docs/engineering/CI_CD.md']), false);
  assert.equal(needsIngestion(['packages/pokemon-data/src/cache.test.ts']), false);
});
test('ingestion wrappers affect only their own cloud target, never the Pi', () => {
  for (const target of ['cloud-dev', 'production']) {
    const other = target === 'cloud-dev' ? 'production' : 'cloud-dev';
    assert.equal(needsIngestion([`scripts/ingest-${target}.sh`], { target }), true);
    assert.equal(
      needsIngestion([`scripts/ingest-${other}.sh`, 'scripts/ingest-pi.sh'], { target }),
      false,
    );
    assert.equal(needsIngestion(['packages/pokemon-data/src/persist.ts'], { target }), true);
    for (const option of [{ force: true }, { bootstrap: true }, { pending: ['20260908000001'] }]) {
      assert.equal(needsIngestion([], { target, ...option }), true);
    }
  }
  assert.throws(() => needsIngestion([], { target: 'pi' }));
});

test('catch-up diff, deleted importer, lockfile, pending migration, bootstrap and force require ingestion', () => {
  for (const path of [
    'packages/pokemon-data/src/persist.ts',
    'packages/pokemon-data/scripts/ingest.ts',
    'pnpm-lock.yaml',
  ]) {
    assert.equal(needsIngestion([path]), true);
  }
  for (const option of [{ force: true }, { bootstrap: true }, { pending: ['20260908000001'] }]) {
    assert.equal(needsIngestion([], option), true);
  }
});

const environment = {
  deployment_branch_policy: { custom_branch_policies: true },
  id: 101,
  protection_rules: [
    {
      type: 'required_reviewers',
      prevent_self_review: true,
      reviewers: [{ type: 'User', reviewer: { id: 1 } }],
    },
  ],
};
const branches = { branch_policies: [{ name: 'main', type: 'branch' }] };
test('production requires real Environment protections', () => {
  assertProtection(environment, branches, true);
  assert.throws(() => assertProtection({ ...environment, protection_rules: [] }, branches, true));
  assert.throws(() =>
    assertProtection(environment, { branch_policies: [{ name: '*', type: 'branch' }] }, true),
  );
  assert.throws(() =>
    assertProtection(
      {
        ...environment,
        protection_rules: [{ ...environment.protection_rules[0], prevent_self_review: false }],
      },
      branches,
      true,
    ),
  );
});

test('RSC detection handles plain/escaped errors and excludes the no-error marker', () => {
  for (const body of [
    '{"digest":"123"}',
    String.raw`{\"digest\":\"123\"}`,
    String.raw`{\\\"digest\\\":\\\"123\\\"}`,
  ])
    assert.equal(hasErrorDigest(body), true);
  assert.equal(hasErrorDigest(String.raw`{\"digest\":\"$undefined\"}`), false);
});

function fakeResponse(url) {
  const path = url.pathname;
  if (path === '/api/health')
    return Response.json({ sha: 'expected', target: 'cloud-dev', projectRef: ref });
  return new Response(path === '/sitemap.xml' ? '<urlset></urlset>' : '<html>healthy</html>', {
    status: path.endsWith('/dev/sprites') ? 404 : 200,
  });
}
test('smoke verifies identity and requires two complete clean rounds', async (t) => {
  t.mock.method(console, 'warn', () => {});
  let calls = 0;
  await smoke('https://example.com', {
    sha: 'expected',
    target: 'cloud-dev',
    projectRef: ref,
    fetcher: async (url) => {
      calls++;
      return fakeResponse(url);
    },
    sleep: async () => {},
  });
  assert.equal(calls, 51);
});
for (const scenario of ['wrong-sha', 'redirect', 'rsc', 'empty-body', 'network', 'dev-exposed']) {
  test(`smoke rejects ${scenario}`, async (t) => {
    t.mock.method(console, 'warn', () => {});
    t.mock.method(console, 'error', () => {});
    await assert.rejects(
      smoke('https://example.com', {
        sha: scenario === 'wrong-sha' ? 'different' : undefined,
        projectRef: ref,
        target: 'cloud-dev',
        sleep: async () => {},
        fetcher: async (url) => {
          if (url.pathname === '/en/build') {
            if (scenario === 'network') throw new Error('network');
            if (scenario === 'redirect') return new Response('', { status: 302 });
            if (scenario === 'empty-body') return new Response('');
            if (scenario === 'rsc') return new Response('<html>{"digest":"123"}</html>');
          }
          if (scenario === 'dev-exposed' && url.pathname.endsWith('/dev/sprites'))
            return new Response('<html>oops</html>');
          return fakeResponse(url);
        },
      }),
    );
  });
}
test('one transient route failure is visible and needs two subsequent clean rounds', async (t) => {
  t.mock.method(console, 'warn', () => {});
  const errors = t.mock.method(console, 'error', () => {});
  let failed = false;
  await smoke('https://example.com', {
    sleep: async () => {},
    fetcher: async (url) => {
      if (!failed && url.pathname === '/es/moves/tackle') {
        failed = true;
        return new Response('<html>error</html>', { status: 503 });
      }
      return fakeResponse(url);
    },
  });
  assert.equal(errors.mock.callCount(), 1);
});

test('production rejects bypass, self-approval, wrong environment and unlisted reviewers', () => {
  const approval = { state: 'approved', user: { id: 1 }, environments: [{ id: 101 }] };
  assertApproval(environment, [approval], [2, 2]);
  assert.throws(() => assertApproval(environment, [], [2, 2]));
  assert.throws(() => assertApproval(environment, [approval], [1, 2]));
  assert.throws(() => assertApproval(environment, [{ ...approval, user: { id: 3 } }], [2, 2]));
  assert.throws(() =>
    assertApproval(environment, [{ ...approval, environments: [{ id: 102 }] }], [2, 2]),
  );
  assert.throws(() => assertApproval(environment, [{ ...approval, state: 'rejected' }], [2, 2]));
});

// Rebranding must not weaken the release trust boundary or orphan delivery history.
test('release accepts the same repository before and after the approved rename', () => {
  for (const name of ['Xarli11/PokeStudio', 'Xarli11/PokeLab']) {
    assertRepositoryIdentity({
      GITHUB_REPOSITORY: name,
      GITHUB_REPOSITORY_ID: '1361937633',
      GITHUB_REPOSITORY_OWNER_ID: '50557033',
    });
  }
});
test('release rejects a fork, transferred repo, missing identity or reused old name', () => {
  const env = {
    GITHUB_REPOSITORY: 'Xarli11/PokeLab',
    GITHUB_REPOSITORY_ID: '1361937633',
    GITHUB_REPOSITORY_OWNER_ID: '50557033',
  };
  for (const replacement of [
    { GITHUB_REPOSITORY_ID: '123' },
    { GITHUB_REPOSITORY_OWNER_ID: '123' },
    { GITHUB_REPOSITORY: 'attacker/PokeLab' },
    { GITHUB_REPOSITORY_ID: undefined },
    { GITHUB_REPOSITORY: 'Xarli11/PokeStudio', GITHUB_REPOSITORY_ID: '123' },
  ])
    assert.throws(() => assertRepositoryIdentity({ ...env, ...replacement }), /identities/);
});
