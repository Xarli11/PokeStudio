import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/**
 * The battle engine (and the simulator inside it) runs on the Node battle server only. The web app may
 * use the engine's pure-data subpaths and type-only imports; anything else would drag the simulator
 * into a web bundle.
 */
describe('web bundle boundary', () => {
  const sources = files(SRC).map((path) => ({ path, text: readFileSync(path, 'utf8') }));

  it('never imports the simulator', () => {
    expect(
      sources.filter((s) => /['"]pokemon-showdown['"]/.test(s.text)).map((s) => s.path),
    ).toEqual([]);
  });

  it('imports the battle engine root only as types', () => {
    const offenders = sources.filter(
      (s) =>
        /import\s+(?!type\b)[^;]*from\s+['"]@pokestudio\/battle-engine['"]/.test(s.text) ||
        /require\(['"]@pokestudio\/battle-engine['"]\)/.test(s.text),
    );
    expect(offenders.map((s) => s.path)).toEqual([]);
  });

  it('uses only the pure-data subpaths of the engine', () => {
    const subpaths = new Set<string>();
    for (const { text } of sources) {
      for (const match of text.matchAll(/from\s+['"]@pokestudio\/battle-engine\/([\w-]+)['"]/g)) {
        subpaths.add(match[1]!);
      }
    }
    expect([...subpaths].sort()).toEqual(['formats', 'types']);
  });

  it('never imports the battle server package', () => {
    expect(
      sources.filter((s) => /@pokestudio\/battle-server/.test(s.text)).map((s) => s.path),
    ).toEqual([]);
  });

  it('keeps the battle server URL and secret in server-only files', () => {
    const users = sources
      .filter((s) => /BATTLE_SERVER_(URL|SECRET)/.test(s.text))
      .map((s) => s.path.replace(SRC, ''));
    expect(users).toEqual(['/lib/battle/server-client.ts']);
  });
});
