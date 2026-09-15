import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const targets = JSON.parse(readFileSync(new URL('./targets.json', import.meta.url)));

export function targetFor(name) {
  const target = targets[name];
  if (!['cloud-dev', 'production'].includes(name) || !target) {
    throw new Error('Target is not approved in scripts/ci/targets.json.');
  }
  if (!/^[a-z]{20}$/.test(target.projectRef) || !/^[a-z0-9-]+$/.test(target.worker)) {
    throw new Error('Invalid target identity.');
  }
  const url = new URL(target.url);
  if (url.protocol !== 'https:' || url.origin !== target.url || url.username || url.password) {
    throw new Error('Target must have a canonical HTTPS origin.');
  }
  if (
    name === 'production' &&
    (target.projectRef === targets['cloud-dev'].projectRef ||
      target.worker === targets['cloud-dev'].worker ||
      target.url === targets['cloud-dev'].url)
  ) {
    throw new Error('Production must be separate from Cloud DEV.');
  }
  return target;
}

// Parse the authority; a project ref hidden in a password/query/path proves nothing.
// Session pooling on 5432 is supported; transaction pooling cannot hold the ingest lock.
export function assertDatabaseUrl(value, projectRef) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Invalid database URL.');
  }
  const direct = url.hostname === `db.${projectRef}.supabase.co` && url.username === 'postgres';
  const session =
    /^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname) &&
    url.username === `postgres.${projectRef}`;
  const parameters = [...url.searchParams.keys()];
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    (!direct && !session) ||
    !url.password ||
    url.pathname !== '/postgres' ||
    (url.port && url.port !== '5432') ||
    url.hash ||
    parameters.some((key) => key !== 'sslmode') ||
    url.searchParams.getAll('sslmode').length !== 1 ||
    !['require', 'verify-full'].includes(url.searchParams.get('sslmode'))
  ) {
    throw new Error(
      'Database target rejected: require approved Supabase authority, port 5432 and TLS.',
    );
  }
}

export function assertPublishableKey(key, projectRef) {
  if (key?.startsWith('sb_publishable_')) return;
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    if (payload.role === 'anon' && payload.ref === projectRef) return;
  } catch {
    /* Invalid key; do not echo it. */
  }
  throw new Error('A publishable key (or target-matched anon JWT) is required for the web build.');
}

export function assertNoBuildTriggers(triggers) {
  if (!Array.isArray(triggers) || triggers.length !== 0) {
    throw new Error(
      'Disconnect all Cloudflare Git build triggers for this Worker before delivery.',
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const name = process.argv[2];
    const target = targetFor(name);
    assertDatabaseUrl(
      process.env[name === 'cloud-dev' ? 'SUPABASE_CLOUD_DEV_DB_URL' : 'SUPABASE_DB_URL'],
      target.projectRef,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
