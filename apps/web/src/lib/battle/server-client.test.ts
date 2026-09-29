import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { battleServer } from './server-client';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  delete process.env['BATTLE_SERVER_URL'];
  delete process.env['BATTLE_SERVER_SECRET'];
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env['BATTLE_SERVER_URL'];
  delete process.env['BATTLE_SERVER_SECRET'];
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('battle server client', () => {
  it('says so, without calling out, when the server is not configured', async () => {
    expect(await battleServer('GET', '/health')).toEqual({
      ok: false,
      error: { code: 'BATTLE_SERVER_NOT_CONFIGURED' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports an unreachable server as a typed error', async () => {
    process.env['BATTLE_SERVER_URL'] = 'http://127.0.0.1:1';
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await battleServer('GET', '/health')).toEqual({
      ok: false,
      error: { code: 'BATTLE_SERVER_UNAVAILABLE' },
    });
  });

  it('sends the shared secret as a bearer token and JSON bodies with the right method', async () => {
    process.env['BATTLE_SERVER_URL'] = 'http://battle.internal:8787';
    process.env['BATTLE_SERVER_SECRET'] = 's3cret';
    fetchMock.mockResolvedValue(json({ ok: true }));
    const result = await battleServer('POST', '/v1/battles', { formatId: 'sv-ou' });
    expect(result).toEqual({ ok: true, data: { ok: true } });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('http://battle.internal:8787/v1/battles');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      authorization: 'Bearer s3cret',
      'content-type': 'application/json',
    });
    expect(init.body).toBe(JSON.stringify({ formatId: 'sv-ou' }));
    expect(init.cache).toBe('no-store');
  });

  it('omits the authorization header when there is no secret and body/content-type for GET', async () => {
    process.env['BATTLE_SERVER_URL'] = 'http://127.0.0.1:8787';
    fetchMock.mockResolvedValue(json({ sessions: 0 }));
    await battleServer('GET', '/health');
    const init = fetchMock.mock.calls[0]![1];
    expect(init.headers).toEqual({});
    expect(init.body).toBeUndefined();
  });

  it("passes the engine's typed error through, and wraps anything else", async () => {
    process.env['BATTLE_SERVER_URL'] = 'http://127.0.0.1:8787';
    fetchMock.mockResolvedValueOnce(
      json({ error: { code: 'INVALID_TEAM', details: { side: 'p1', problems: ['x'] } } }, 422),
    );
    expect(await battleServer('POST', '/v1/battles', {})).toEqual({
      ok: false,
      error: { code: 'INVALID_TEAM', details: { side: 'p1', problems: ['x'] } },
    });
    fetchMock.mockResolvedValueOnce(new Response('<html>bad gateway</html>', { status: 502 }));
    expect(await battleServer('GET', '/v1/names')).toEqual({
      ok: false,
      error: { code: 'BATTLE_SERVER_ERROR', details: { status: 502 } },
    });
  });
});
