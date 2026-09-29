import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() =>
        address && typeof address === 'object'
          ? resolve(address.port)
          : reject(new Error('no port')),
      );
    });
  });
}

/**
 * The real entry point, as a real Node process. The engine loads the simulator through Node's own
 * module system, which differs from the bundler used by unit tests: this is the check that catches
 * an ESM/CommonJS regression before it reaches a deployment.
 */
describe('battle server process', () => {
  it('starts on plain Node, serves a battle and refuses an unsafe bind', async () => {
    const port = await freePort();
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
      cwd: join(__dirname, '..'),
      env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', BATTLE_SERVER_SECRET: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => (output += String(chunk)));
    child.stderr.on('data', (chunk) => (output += String(chunk)));
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`did not start:\n${output}`)), 45_000);
        const check = setInterval(() => {
          if (output.includes('listening')) {
            clearTimeout(timer);
            clearInterval(check);
            resolve();
          }
        }, 100);
        child.on('exit', () => reject(new Error(`exited early:\n${output}`)));
      });
      const base = `http://127.0.0.1:${port}`;
      expect(await (await fetch(`${base}/health`)).json()).toEqual({ ok: true, sessions: 0 });
      const names = (await (await fetch(`${base}/v1/names`)).json()) as {
        moves: Record<string, string>;
      };
      expect(names.moves['dragonclaw']).toBe('Dragon Claw');
      const created = await fetch(`${base}/v1/battles`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          formatId: 'sv-doubles-ou',
          sides: {
            p1: {
              displayName: 'A',
              team: {
                members: [
                  {
                    species: 'Garchomp',
                    ability: 'Rough Skin',
                    moves: ['Earthquake'],
                    evs: { hp: 4, atk: 252, spe: 252 },
                  },
                  {
                    species: 'Rotom-Wash',
                    ability: 'Levitate',
                    moves: ['Hydro Pump'],
                    evs: { hp: 252, def: 252, spa: 4 },
                  },
                ],
              },
            },
            p2: {
              displayName: 'B',
              team: {
                members: [
                  {
                    species: 'Garchomp',
                    ability: 'Rough Skin',
                    moves: ['Earthquake'],
                    evs: { hp: 4, atk: 252, spe: 252 },
                  },
                  {
                    species: 'Rotom-Wash',
                    ability: 'Levitate',
                    moves: ['Hydro Pump'],
                    evs: { hp: 252, def: 252, spa: 4 },
                  },
                ],
              },
            },
          },
        }),
      });
      expect(created.status).toBe(201);
    } finally {
      child.kill();
    }
  }, 90_000);

  it('refuses to listen on a non-loopback host without a secret', async () => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
      cwd: join(__dirname, '..'),
      env: { ...process.env, PORT: '0', HOST: '0.0.0.0', BATTLE_SERVER_SECRET: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stderr.on('data', (chunk) => (output += String(chunk)));
    const code = await new Promise<number | null>((resolve) => child.on('exit', resolve));
    expect(code).toBe(1);
    expect(output).toContain('Refusing to listen');
  }, 60_000);
});
