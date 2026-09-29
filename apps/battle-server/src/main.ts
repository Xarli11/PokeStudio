import { createBattleServer } from './server';

/**
 * Entry point. Configuration is environment only:
 *   PORT (default 8787), HOST (default 127.0.0.1), BATTLE_SERVER_SECRET (shared bearer secret),
 *   BATTLE_SESSION_TTL_MINUTES (default 60), BATTLE_MAX_SESSIONS (default 500).
 * Binding to anything but loopback without a secret is refused.
 */
const host = process.env['HOST'] ?? '127.0.0.1';
const port = Number(process.env['PORT'] ?? 8787);
const secret = process.env['BATTLE_SERVER_SECRET'] || undefined;
const loopback = host === '127.0.0.1' || host === '::1' || host === 'localhost';

if (!secret && !loopback) {
  console.error('Refusing to listen on a non-loopback host without BATTLE_SERVER_SECRET.');
  process.exit(1);
}

const { server, store } = createBattleServer({
  secret,
  ttlMs: Number(process.env['BATTLE_SESSION_TTL_MINUTES'] ?? 60) * 60_000,
  maxSessions: Number(process.env['BATTLE_MAX_SESSIONS'] ?? 500),
});

server.listen(port, host, () => {
  console.warn(
    `battle server listening on http://${host}:${port} (in-memory sessions, none persisted)`,
  );
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.warn(`battle server stopping (${store.size} in-memory session(s) dropped)`);
    server.close(() => process.exit(0));
  });
}
