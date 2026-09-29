import { describe, expect, it } from 'vitest';

import { BattleDomainError, isBattleDomainError } from './errors';
import { createBattle } from './session';
import { SEED, legalOuTeam } from './test/fixtures';
import { newBattle, playToEnd } from './test/helpers';
import type { BattleConfig, BattleTeamInput } from './types';

/** A public-API config on a real catalog format (`sv-ou`), with legal teams by default. */
const config = (
  over: Partial<BattleConfig> = {},
  p1: BattleTeamInput = legalOuTeam,
  p2: BattleTeamInput = legalOuTeam,
): BattleConfig => ({
  formatId: 'sv-ou',
  sides: {
    p1: { displayName: 'Ash', team: p1 },
    p2: { displayName: 'Gary', team: p2 },
  },
  ...over,
});

function catchError(run: () => unknown): BattleDomainError {
  try {
    run();
  } catch (error) {
    if (error instanceof BattleDomainError) return error;
    throw error;
  }
  throw new Error('expected a BattleDomainError');
}

describe('createBattle', () => {
  it('creates a ready battle: awaiting choices, no observable setup state', () => {
    const session = createBattle(config({ seed: SEED }));
    const state = session.getState('spectator');
    expect(state.status).toBe('awaiting-choices');
    expect(state.turn).toBe(0);
    expect(session.info.seed).toBe(SEED);
    expect(session.getLegalChoices('p1')).toEqual({
      kind: 'team-preview',
      side: 'p1',
      pick: 2,
      of: 2,
    });
  });

  it('describes the format structurally, without simulator ids in any player-visible state', () => {
    const session = createBattle(config());
    expect(session.getState('p1').format).toEqual({
      id: 'sv-ou',
      name: '[Gen 9] OU',
      generation: 9,
      gameType: 'singles',
      category: 'smogon-tier',
      family: 'scarlet-violet',
    });
    expect(session.info.format.id).toBe('sv-ou');
    expect(session.info.engineFormatId).toBe('gen9ou'); // server-side only
    for (const perspective of ['p1', 'p2', 'spectator', 'omniscient'] as const) {
      expect(JSON.stringify(session.getState(perspective))).not.toContain('gen9ou');
    }
  });

  it.each([
    ['non-object config', null],
    ['missing sides', { formatId: 'sv-ou' }],
    ['empty formatId', config({ formatId: '  ' as never })],
    [
      'blank display name',
      config({
        sides: {
          p1: { displayName: '', team: legalOuTeam },
          p2: { displayName: 'B', team: legalOuTeam },
        },
      }),
    ],
    [
      'display name with control chars',
      config({
        sides: {
          p1: { displayName: 'a\nb', team: legalOuTeam },
          p2: { displayName: 'B', team: legalOuTeam },
        },
      }),
    ],
  ])('rejects invalid config: %s', (_label, input) => {
    const error = catchError(() => createBattle(input as unknown as BattleConfig));
    expect(error.code).toBe('INVALID_CONFIG');
  });

  it.each([
    ['array seed', [1, 2, 3, 4]],
    ['free text', 'hello'],
    ['legacy numeric csv', '1,2,3,4'],
    ['unknown engine', 'foo,00'],
  ])('rejects an invalid seed: %s', (_label, seed) => {
    const error = catchError(() => createBattle(config({ seed: seed as unknown as string })));
    expect(error.code).toBe('INVALID_CONFIG');
  });

  it('rejects an empty team', () => {
    const error = catchError(() => createBattle(config({}, { members: [] })));
    expect(error.code).toBe('INVALID_TEAM');
    expect(error.details).toMatchObject({ side: 'p1' });
  });

  it('rejects more than 6 members', () => {
    const member = legalOuTeam.members[0]!;
    const error = catchError(() => createBattle(config({}, { members: Array(7).fill(member) })));
    expect(error.code).toBe('INVALID_TEAM');
  });

  it('rejects an illegal team via the simulator validator (problems are display text)', () => {
    const bad: BattleTeamInput = {
      members: [{ species: 'Pikachu', ability: 'Blaze', moves: ['Splash'], evs: { hp: 4 } }],
    };
    const error = catchError(() => createBattle(config({}, bad)));
    expect(error.code).toBe('INVALID_TEAM');
    expect((error.details as unknown as { problems: string[] }).problems.length).toBeGreaterThan(0);
  });

  it('rejects a species that does not exist', () => {
    const bad: BattleTeamInput = {
      members: [{ species: 'Notamon', ability: 'Static', moves: ['Splash'] }],
    };
    expect(catchError(() => createBattle(config({}, bad))).code).toBe('INVALID_TEAM');
  });

  it('never lets team text reach the simulator grammar (packed-format injection)', () => {
    const bad: BattleTeamInput = {
      members: [{ species: 'Pikachu|Raichu', ability: 'Static', moves: ['Splash'] }],
    };
    expect(catchError(() => createBattle(config({}, bad))).code).toBe('INVALID_TEAM');
  });

  it('exposes no validation bypass in the public config', () => {
    const bad: BattleTeamInput = {
      members: [{ species: 'Pikachu', ability: 'Blaze', moves: ['Splash'], evs: { hp: 4 } }],
    };
    const sneaky = { ...config({}, bad), validateTeams: false };
    expect(catchError(() => createBattle(sneaky as BattleConfig)).code).toBe('INVALID_TEAM');
  });

  it('isBattleDomainError narrows by code', () => {
    const error = catchError(() => createBattle(config({ formatId: 'nope' as never })));
    expect(isBattleDomainError(error, 'UNSUPPORTED_FORMAT')).toBe(true);
    expect(isBattleDomainError(error, 'INVALID_TEAM')).toBe(false);
  });
});

describe('determinism', () => {
  it('same seed + same choices reproduce the same battle', () => {
    const run = () => {
      const session = newBattle({ seed: 'gen5,0009000200030004' });
      playToEnd(session);
      return {
        result: session.getState('omniscient').result,
        events: session.getEvents('omniscient'),
      };
    };
    const [first, second] = [run(), run()];
    expect(first.result).not.toBeNull();
    expect(second).toEqual(first);
  });

  it('a different seed can change the outcome path', () => {
    const turns = (seed: string) => {
      const session = newBattle({ seed });
      playToEnd(session);
      return session.getEvents('omniscient').length;
    };
    const lengths = new Set(
      ['gen5,0001000200030004', 'gen5,0009000200030004', 'gen5,00ff000200030004'].map(turns),
    );
    expect(lengths.size).toBeGreaterThan(1);
  });

  it('without a seed the resolved sodium seed is exposed and reproduces the battle', () => {
    const first = newBattle({ seed: undefined });
    expect(first.info.seed).toMatch(/^sodium,[0-9a-f]+$/);
    playToEnd(first);
    const second = newBattle({ seed: first.info.seed });
    playToEnd(second);
    expect(second.getEvents('omniscient')).toEqual(first.getEvents('omniscient'));
  });
});
