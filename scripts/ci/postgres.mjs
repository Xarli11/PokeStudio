import { execFileSync } from 'node:child_process';

// The release caller validates the target first; integration tests use a loopback DB.
// PGDATABASE is a database name, not a URI. Keep credentials out of argv and logs.
export function queryReadOnly(sql, connectionString, baseEnv) {
  const url = new URL(connectionString);
  return execFileSync('psql', ['-X', '-w', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    encoding: 'utf8',
    timeout: 70000,
    env: {
      ...baseEnv,
      LC_ALL: 'C',
      PGHOST: url.hostname,
      PGPORT: url.port || '5432',
      PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
      PGUSER: decodeURIComponent(url.username),
      PGPASSWORD: decodeURIComponent(url.password),
      PGSSLMODE: url.searchParams.get('sslmode') || 'require',
      PGCONNECT_TIMEOUT: '15',
      PGOPTIONS: '-c default_transaction_read_only=on -c statement_timeout=60000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}
