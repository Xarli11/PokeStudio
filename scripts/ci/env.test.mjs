import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';

test('Pi setting accepts the legacy private env name and gives the new name precedence', () => {
  const read = (values) =>
    execFileSync('bash', ['-c', 'source scripts/load-env.sh; printf "%s" "$POKELAB_PI_DB_URL"'], {
      encoding: 'utf8',
      env: { PATH: process.env.PATH, CI: 'true', ...values },
    });
  assert.equal(read({ POKESTUDIO_PI_DB_URL: 'legacy' }), 'legacy');
  assert.equal(read({ POKESTUDIO_PI_DB_URL: 'legacy', POKELAB_PI_DB_URL: 'current' }), 'current');
  assert.equal(read({}), '');
});
