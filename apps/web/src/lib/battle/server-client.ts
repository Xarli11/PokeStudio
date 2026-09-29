import type { ActionResult, BattleServerError } from './types';

/**
 * Server-to-server client for the battle server (ADR-0019). Server-side only: the URL and the shared
 * secret never reach a browser, and browsers never call the battle server themselves. When the
 * server is not configured or unreachable, callers get a typed error the UI states honestly — there
 * is no fake fallback.
 */
const TIMEOUT_MS = 15_000;

export async function battleServer<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<ActionResult<T>> {
  const base = process.env['BATTLE_SERVER_URL'];
  if (!base) return { ok: false, error: { code: 'BATTLE_SERVER_NOT_CONFIGURED' } };
  const secret = process.env['BATTLE_SERVER_SECRET'];

  let response: Response;
  try {
    response = await fetch(new URL(path, base), {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(secret ? { authorization: `Bearer ${secret}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { ok: false, error: { code: 'BATTLE_SERVER_UNAVAILABLE' } };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON body: handled below by status.
  }
  if (response.ok) return { ok: true, data: payload as T };
  const error = (payload as { error?: BattleServerError } | null)?.error;
  return {
    ok: false,
    error:
      error && typeof error.code === 'string'
        ? error
        : { code: 'BATTLE_SERVER_ERROR', details: { status: response.status } },
  };
}
