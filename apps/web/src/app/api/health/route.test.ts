import { afterEach, expect, it, vi } from 'vitest';
import { GET } from './route';

afterEach(() => vi.unstubAllEnvs());

it('reports the new release identity and accepts old Worker bindings during cutover', async () => {
  vi.stubEnv('POKELAB_RELEASE_SHA', undefined);
  vi.stubEnv('POKELAB_RELEASE_TARGET', undefined);
  vi.stubEnv('POKESTUDIO_RELEASE_SHA', 'old-sha');
  vi.stubEnv('POKESTUDIO_RELEASE_TARGET', 'cloud-dev');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://tofhupgwxsexrburoqys.supabase.co');
  expect(GET().status).toBe(200);
  expect(await GET().json()).toEqual({
    sha: 'old-sha',
    target: 'cloud-dev',
    projectRef: 'tofhupgwxsexrburoqys',
  });
  vi.stubEnv('POKELAB_RELEASE_SHA', 'new-sha');
  vi.stubEnv('POKELAB_RELEASE_TARGET', 'new-target');
  expect(await GET().json()).toMatchObject({ sha: 'new-sha', target: 'new-target' });
});
