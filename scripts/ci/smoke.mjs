import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

export function hasErrorDigest(body) {
  const normalized = body.replace(/\\+"/g, '"');
  return [...normalized.matchAll(/"digest"\s*:\s*"([^"\n]+)"/g)].some(
    (match) => match[1] !== '$undefined',
  );
}

export const routes = ['en', 'es'].flatMap((locale) => [
  `/${locale}`,
  `/${locale}/pokemon`,
  `/${locale}/pokemon/bulbasaur`,
  `/${locale}/pokemon/mew`,
  `/${locale}/moves`,
  `/${locale}/moves/tackle`,
  `/${locale}/abilities`,
  `/${locale}/abilities/overgrow`,
  `/${locale}/compare?pokemon=bulbasaur,charmander`,
  `/${locale}/build`,
  `/${locale}/build/smoke-test-team-1`,
]);

export async function smoke(
  base,
  { sha, projectRef, target, fetcher = fetch, sleep = delay } = {},
) {
  const url = new URL(base);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.origin !== base
  ) {
    throw new Error('Smoke requires a canonical origin.');
  }
  async function request(path) {
    const endpoint = new URL(path, base);
    endpoint.searchParams.set('_smoke', `${Date.now()}`);
    return fetcher(endpoint, {
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
      headers: { 'Cache-Control': 'no-cache' },
    });
  }
  if (sha) {
    let ready = false;
    for (let attempt = 1; attempt <= 6; attempt++) {
      try {
        const response = await request('/api/health');
        const identity = response.ok ? await response.json() : {};
        ready =
          response.status === 200 &&
          identity.sha === sha &&
          identity.projectRef === projectRef &&
          identity.target === target;
      } catch {
        ready = false;
      }
      if (ready) break;
      console.warn(`Waiting for release identity (${attempt}/6).`);
      if (attempt < 6) await sleep(10000);
    }
    if (!ready) throw new Error('Worker is not serving the expected release and database target.');
  }
  let consecutive = 0;
  for (let round = 1; round <= 3; round++) {
    let failed = false;
    for (const path of [...routes, '/sitemap.xml', '/en/dev/sprites', '/es/dev/sprites']) {
      try {
        const response = await request(path);
        const body = await response.text();
        const forbidden = path.endsWith('/dev/sprites');
        const expected = forbidden ? 404 : 200;
        const validBody =
          path === '/sitemap.xml'
            ? /<(urlset|sitemapindex)\b/.test(body)
            : /<html[\s>]/i.test(body);
        if (response.status !== expected || !validBody || (!forbidden && hasErrorDigest(body))) {
          throw new Error(`HTTP ${response.status}, unexpected status/body or RSC error`);
        }
        console.warn(`OK [${round}] ${path}`);
      } catch (error) {
        failed = true;
        console.error(`FAIL [${round}] ${path}: ${error.message}`);
      }
    }
    consecutive = failed ? 0 : consecutive + 1;
    if (consecutive === 2) return;
    if (round < 3) await sleep(5000);
  }
  throw new Error('Smoke failed: two consecutive clean rounds are required.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  smoke(process.env.POKELAB_SMOKE_URL, {
    sha: process.env.POKELAB_EXPECTED_SHA,
    projectRef: process.env.POKELAB_EXPECTED_PROJECT_REF,
    target: process.env.POKELAB_EXPECTED_TARGET,
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
