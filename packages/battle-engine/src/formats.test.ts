import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BattleDomainError } from './errors';
import { BATTLE_FORMATS, CURRENT_GENERATION, findBattleFormat } from './formats';
import type { BattleFormatDescriptor, BattleFormatId } from './formats';
import { createBattle, createBattleForTests } from './session';
import { resolveExecutableFormat, resolveFormat, showdownIdOf } from './showdown/formats';
import { championsBssTeam, legalOuTeam } from './test/fixtures';
import { playToEnd } from './test/helpers';
import type { BattleConfig, BattleTeamInput } from './types';

const IDS: BattleFormatId[] = [
  'sv-ou',
  'sv-ubers',
  'champions-bss-reg-mb',
  'champions-vgc-reg-mb',
  'sv-doubles-ou',
];

const configFor = (formatId: string, team: BattleTeamInput, seed?: string): BattleConfig =>
  ({
    formatId,
    ...(seed ? { seed } : {}),
    sides: { p1: { displayName: 'A', team }, p2: { displayName: 'B', team } },
  }) as BattleConfig;

function rejection(run: () => unknown): BattleDomainError {
  try {
    run();
  } catch (error) {
    if (error instanceof BattleDomainError) return error;
    throw error;
  }
  throw new Error('expected a BattleDomainError');
}

describe('format registry (explicit, closed, PokeStudio-owned)', () => {
  it('has exactly the five approved entries with unique stable ids', () => {
    expect(BATTLE_FORMATS.map((f) => f.id)).toEqual(IDS);
    expect(new Set(BATTLE_FORMATS.map((f) => f.id)).size).toBe(IDS.length);
  });

  it('is immutable and carries only PokeStudio-owned fields (no rules, no simulator ids)', () => {
    expect(Object.isFrozen(BATTLE_FORMATS)).toBe(true);
    for (const format of BATTLE_FORMATS) {
      expect(Object.isFrozen(format)).toBe(true);
      expect(Object.keys(format).sort()).toEqual([
        'availability',
        'category',
        'family',
        'gameType',
        'generation',
        'id',
      ]);
    }
    expect(JSON.stringify(BATTLE_FORMATS)).not.toMatch(/gen9|showdown|banlist|ruleset/i);
    // formats.ts is pure domain data: it does not even mention simulator ids or import the simulator.
    const source = readFileSync(join(__dirname, 'formats.ts'), 'utf8');
    expect(source).not.toMatch(/from 'pokemon-showdown'|gen9/);
  });

  it('cannot be mutated at runtime: array, descriptors and nested availability are all frozen', () => {
    const mutations: [string, () => void][] = [
      ['push', () => (BATTLE_FORMATS as BattleFormatDescriptor[]).push(BATTLE_FORMATS[0]!)],
      [
        'replace an entry',
        () => ((BATTLE_FORMATS as BattleFormatDescriptor[])[0] = BATTLE_FORMATS[1]!),
      ],
      ['change a category', () => ((BATTLE_FORMATS[0] as { category: string }).category = 'vgc')],
      ['change an id', () => ((BATTLE_FORMATS[0] as { id: string }).id = 'sv-x')],
      [
        'change availability.level',
        () => ((BATTLE_FORMATS[0]!.availability as { level: string }).level = 'blocked'),
      ],
      [
        'unblock a blocked format',
        () => ((BATTLE_FORMATS[3]!.availability as { level: string }).level = 'available'),
      ],
    ];
    for (const [label, mutate] of mutations) {
      expect(mutate, label).toThrowError(TypeError); // ES modules run in strict mode
    }
    expect(BATTLE_FORMATS.map((f) => [f.id, f.availability.level])).toEqual([
      ['sv-ou', 'available'],
      ['sv-ubers', 'available'],
      ['champions-bss-reg-mb', 'available'],
      ['champions-vgc-reg-mb', 'blocked'],
      ['sv-doubles-ou', 'blocked'],
    ]);
    for (const format of BATTLE_FORMATS) expect(Object.isFrozen(format.availability)).toBe(true);
  });

  it('format ids are stable: resolving an entry never consults CURRENT_GENERATION', () => {
    const source = readFileSync(join(__dirname, 'showdown/formats.ts'), 'utf8');
    expect(source).not.toMatch(/CURRENT_GENERATION/);
  });

  it('declares the current generation explicitly as 9', () => {
    expect(CURRENT_GENERATION).toBe(9);
    const source = readFileSync(join(__dirname, 'formats.ts'), 'utf8');
    expect(source).toMatch(/export const CURRENT_GENERATION = 9;/);
    expect(source).not.toMatch(/latestGen|Dex\./); // never derived from the simulator
  });

  it('classifies category, family and availability as decided', () => {
    const summary = Object.fromEntries(
      BATTLE_FORMATS.map((f: BattleFormatDescriptor) => [
        f.id,
        [f.category, f.family, f.gameType, f.availability],
      ]),
    );
    expect(summary).toEqual({
      'sv-ou': ['smogon-tier', 'scarlet-violet', 'singles', { level: 'available' }],
      'sv-ubers': ['smogon-tier', 'scarlet-violet', 'singles', { level: 'available' }],
      'champions-bss-reg-mb': [
        'battle-stadium-singles',
        'champions',
        'singles',
        { level: 'available' },
      ],
      'champions-vgc-reg-mb': [
        'vgc',
        'champions',
        'doubles',
        { level: 'blocked', blockedBy: 'doubles-runtime' },
      ],
      'sv-doubles-ou': [
        'smogon-doubles',
        'scarlet-violet',
        'doubles',
        { level: 'blocked', blockedBy: 'doubles-runtime' },
      ],
    });
  });

  it('findBattleFormat only knows catalog ids', () => {
    expect(findBattleFormat('sv-ou')?.id).toBe('sv-ou');
    for (const other of ['gen9ou', 'sv-uu', '', undefined, null, 9]) {
      expect(findBattleFormat(other)).toBeUndefined();
    }
  });
});

/**
 * Upgrade guard: the critical structural facts of every entry, pinned against the installed
 * pokemon-showdown. A simulator upgrade that changes any of them fails here and must be a
 * conscious decision. Rules and bans are NOT copied — only what the engine and product depend on.
 */
describe('upgrade guard against the installed simulator', () => {
  const EXPECTED = {
    'sv-ou': {
      showdownId: 'gen9ou',
      mod: 'gen9',
      gameType: 'singles',
      min: 1,
      max: 6,
      pick: null,
      adjust: null,
    },
    'sv-ubers': {
      showdownId: 'gen9ubers',
      mod: 'gen9',
      gameType: 'singles',
      min: 1,
      max: 6,
      pick: null,
      adjust: null,
    },
    'champions-bss-reg-mb': {
      showdownId: 'gen9championsbssregmb',
      mod: 'champions',
      gameType: 'singles',
      min: 6,
      max: 6,
      pick: 3,
      adjust: 50,
    },
    'champions-vgc-reg-mb': {
      showdownId: 'gen9championsvgc2026regmb',
      mod: 'champions',
      gameType: 'doubles',
      min: 6,
      max: 6,
      pick: 4,
      adjust: 50,
    },
    'sv-doubles-ou': {
      showdownId: 'gen9doublesou',
      mod: 'gen9',
      gameType: 'doubles',
      min: 2,
      max: 6,
      pick: null,
      adjust: null,
    },
  } as const;

  it.each(IDS)('%s still resolves to the pinned metadata', (id) => {
    const expected = EXPECTED[id];
    const resolved = resolveFormat(id);
    expect(showdownIdOf(id)).toBe(expected.showdownId);
    expect({
      showdownId: resolved.showdownId,
      mod: resolved.mod,
      gameType: resolved.gameType,
      min: resolved.minTeamSize,
      max: resolved.maxTeamSize,
      pick: resolved.pickedTeamSize,
      adjust: resolved.adjustLevel,
    }).toEqual(expected);
    expect(resolved.generation).toBe(findBattleFormat(id)!.generation);
    // The initial catalog is entirely current-generation.
    expect(findBattleFormat(id)!.generation).toBe(CURRENT_GENERATION);
    expect(resolved.playerCount).toBe(2);
    expect(resolved.generatedTeams).toBe(false);
  });

  it.each(BATTLE_FORMATS.map((f) => f.id))(
    '%s: family matches the simulator mod and game type matches',
    (id) => {
      const descriptor = findBattleFormat(id)!;
      const resolved = resolveFormat(id);
      expect(resolved.mod).toBe(descriptor.family === 'champions' ? 'champions' : 'gen9');
      expect(resolved.gameType).toBe(descriptor.gameType);
      expect(() => resolveExecutableFormat(descriptor)).not.toThrow();
    },
  );
});

describe('available formats run end to end', () => {
  const TEAMS: Record<string, BattleTeamInput> = {
    'sv-ou': legalOuTeam,
    'sv-ubers': legalOuTeam,
    'champions-bss-reg-mb': championsBssTeam,
  };
  const PICK: Record<string, [number, number]> = {
    'sv-ou': [2, 2],
    'sv-ubers': [2, 2],
    'champions-bss-reg-mb': [3, 6],
  };
  const available = BATTLE_FORMATS.filter((f) => f.availability.level === 'available');

  it('the available set is exactly sv-ou, sv-ubers and champions-bss-reg-mb', () => {
    expect(available.map((f) => f.id)).toEqual(['sv-ou', 'sv-ubers', 'champions-bss-reg-mb']);
  });

  it.each(available.map((f) => f.id))(
    '%s: legal team → team preview → played to finished, deterministic',
    (id) => {
      const team = TEAMS[id]!;
      const seed = 'gen5,0001000200030004';
      const run = () => {
        const session = createBattle(configFor(id, team, seed));
        const [pick, of] = PICK[id]!;
        expect(session.getLegalChoices('p1')).toEqual({
          kind: 'team-preview',
          side: 'p1',
          pick,
          of,
        });
        expect(session.getState('p1').format).toMatchObject({ id, generation: 9 });
        const played = playToEnd(session, undefined, 600);
        const state = session.getState('omniscient');
        expect(state.status).toBe('finished');
        expect(played.kinds.has('team-preview') && played.kinds.has('move')).toBe(true);
        return { result: state.result, turn: state.turn, events: session.getEvents('omniscient') };
      };
      const first = run();
      expect(first.result).toMatchObject({ kind: 'win' });
      expect(run()).toEqual(first); // same seed, same battle
    },
  );

  it('champions-bss-reg-mb: brings 3 of 6 at the format-adjusted level 50, with Stat Points accepted as evs', () => {
    const session = createBattle(
      configFor('champions-bss-reg-mb', championsBssTeam, 'gen5,0001000200030004'),
    );
    session.submitChoice('p1', { kind: 'team-order', order: [2, 0, 1] });
    session.submitChoice('p2', { kind: 'team-order', order: [0, 1, 2] });
    const own = session.getState('p1').sides.p1;
    expect(own.teamSize).toBe(3);
    expect(own.active[0]?.ref).toEqual({ side: 'p1', teamIndex: 2 }); // Kingambit leads
    expect(own.team.every((p) => p.level === 50)).toBe(true);
    // The format requires a full team of 6, so a 3-member team is not a legal Champions BSS team.
    expect(() =>
      createBattle(
        configFor('champions-bss-reg-mb', { members: championsBssTeam.members.slice(0, 3) }),
      ),
    ).toThrowError(BattleDomainError);
  });

  it('champions-bss-reg-mb: over-limit Stat Points are rejected by the simulator validator', () => {
    const over: BattleTeamInput = {
      members: championsBssTeam.members.map((m) => ({ ...m, evs: { atk: 252 } })),
    };
    const error = rejection(() => createBattle(configFor('champions-bss-reg-mb', over)));
    expect(error.code).toBe('INVALID_TEAM');
  });
});

describe('blocked formats', () => {
  it.each(['champions-vgc-reg-mb', 'sv-doubles-ou'])(
    '%s is known but createBattle rejects it as blocked-by-doubles',
    (id) => {
      const error = rejection(() => createBattle(configFor(id, legalOuTeam)));
      expect(error.code).toBe('UNSUPPORTED_FORMAT');
      expect(error.details).toEqual({ formatId: id, reason: 'blocked-by-doubles' });
    },
  );
});

describe('formats outside the catalog are not supported', () => {
  it.each([
    ['a raw simulator id of a catalogued format', 'gen9ou'],
    ['a tier that is not in the catalog', 'gen9uu'],
    ['Custom Game', 'gen9customgame'],
    ['a generated-teams simulator format', 'gen9randombattle'],
    ['an invented id', 'sv-made-up'],
    ['a near-miss of a catalog id', 'sv-ou '],
    ['different case', 'SV-OU'],
  ])('%s is not-in-catalog', (_label, formatId) => {
    const error = rejection(() => createBattle(configFor(formatId, legalOuTeam)));
    expect(error.code).toBe('UNSUPPORTED_FORMAT');
    expect(error.details).toEqual({ formatId, reason: 'not-in-catalog' });
  });

  it('a non-string format id is an invalid config', () => {
    for (const bad of [123, null, undefined, {}]) {
      const error = rejection(() => createBattle(configFor(bad as never, legalOuTeam)));
      expect(error.code).toBe('INVALID_CONFIG');
    }
  });
});

describe('engine-unsupported is only an internal defense, never a way around the catalog', () => {
  it('the test-only path reports it for simulator formats the engine cannot run', () => {
    const error = rejection(() =>
      createBattleForTests({
        formatId: 'gen9randombattle',
        sides: {
          p1: { displayName: 'A', team: legalOuTeam },
          p2: { displayName: 'B', team: legalOuTeam },
        },
      }),
    );
    expect(error.details).toEqual({ formatId: 'gen9randombattle', reason: 'engine-unsupported' });
  });

  it('the public createBattle can never produce it for a catalog or non-catalog id', () => {
    for (const id of [...IDS, 'gen9randombattle', 'gen9customgame', 'nonsense']) {
      try {
        createBattle(configFor(id, legalOuTeam));
      } catch (error) {
        const reason = (error as BattleDomainError).details as { reason?: string };
        expect(reason.reason).not.toBe('engine-unsupported');
      }
    }
  });
});
