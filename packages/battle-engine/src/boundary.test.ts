import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import * as publicApi from './index';
import { newBattle } from './test/helpers';

const srcDir = __dirname;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

describe('package boundary', () => {
  it('exports only the intended runtime values', () => {
    expect(Object.keys(publicApi).sort()).toEqual([
      'BattleDomainError',
      'createBattle',
      'isBattleDomainError',
    ]);
  });

  it('imports pokemon-showdown only inside src/showdown/** (and tests)', () => {
    const offenders = sourceFiles(srcDir)
      .filter((file) => !file.includes(`${join(srcDir, 'showdown')}`))
      .filter((file) =>
        /from ['"]pokemon-showdown['"]|require\(['"]pokemon-showdown/.test(
          readFileSync(file, 'utf8'),
        ),
      );
    expect(offenders).toEqual([]);
  });

  it('keeps the domain files free of UI, framework, I/O and other-project imports', () => {
    const forbidden =
      /from ['"](react|next|node:http|node:https|node:fs|pg|@supabase|@pokestudio\/(?!battle-engine)[^'"]*)/;
    const offenders = sourceFiles(srcDir).filter((file) =>
      forbidden.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('a session exposes only its public surface at runtime (no engine, seed log or packed teams)', () => {
    const session = newBattle();
    expect(Object.getOwnPropertyNames(session)).toEqual(['info']);
    const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(session)).filter(
      (n) => n !== 'constructor',
    );
    expect(proto.sort()).toEqual([
      'forSide',
      'getEvents',
      'getLegalChoices',
      'getState',
      'submitChoice',
    ]);
    expect(Object.isFrozen(session.info)).toBe(true);
    expect(Object.isFrozen(session.info.format)).toBe(true);
  });

  it('the public entry re-exports no engine internals', () => {
    const entry = readFileSync(join(srcDir, 'index.ts'), 'utf8');
    expect(entry).not.toMatch(/showdown|BattleStream|PRNG|Teams|Dex/);
  });
});
