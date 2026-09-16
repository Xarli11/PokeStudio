import assert from 'node:assert/strict';
import { queryReadOnly } from './postgres.mjs';

// Explicit opt-in, loopback only: never use a real Cloud DEV/production secret here.
const url = new URL(process.env.INGEST_LOCK_TEST_DB_URL);
assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname));
url.searchParams.set('sslmode', 'disable');
const env = { PATH: process.env.PATH };
const query = (sql) => queryReadOnly(sql, url.href, env);
try {
  const actual = JSON.parse(
    query(`select json_build_object(
    'database', current_database(), 'user', current_user, 'port', inet_server_port(),
    'readonly', current_setting('transaction_read_only'),
    'timeout', current_setting('statement_timeout'))`),
  );
  assert.equal(actual.database, decodeURIComponent(url.pathname.slice(1)));
  assert.equal(actual.user, decodeURIComponent(url.username));
  assert.ok(actual.port > 0); // A TCP connection, not the runner's default Unix socket.
  assert.equal(actual.readonly, 'on');
  assert.equal(actual.timeout, '1min');
  assert.throws(
    () => query('create table public.ci_readonly_must_reject (id integer)'),
    (error) => /read-only transaction/.test(String(error.stderr)),
  );
  assert.equal(query("select to_regclass('public.ci_readonly_must_reject') is null"), 't');
  console.log(
    'Real psql integration passed: correct DB/user, TCP connection, read-only writes rejected, timeout preserved.',
  );
} catch {
  // Assertion/exec errors can include connection values. Do not dump them to CI logs.
  console.error('Real psql integration failed against the disposable local database.');
  process.exitCode = 1;
}
