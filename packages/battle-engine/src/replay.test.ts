import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

import { BattleDomainError } from './errors';
import type { BattleErrorDetailsByCode } from './errors';
import { BATTLE_REPLAY_SCHEMA_VERSION, parseBattleReplay, restoreBattle } from './replay';
import { createBattle } from './session';
import { createBattleSeries } from './series';
import { championsBssTeam, doublesTeam, legalOuTeam } from './test/fixtures';
import { firstChoice } from './test/helpers';
import type { BattleFormatId } from './formats';
import type {
  BattlePerspective,
  BattleReplay,
  BattleSession,
  BattleState,
  BattleTeamInput,
} from './types';

const SEED = 'gen5,0001000200030004';
const SIMULATOR_VERSION = (
  createRequire(import.meta.url)('pokemon-showdown/package.json') as { version: string }
).version;

const FORMATS: [BattleFormatId, BattleTeamInput][] = [
  ['sv-ou', legalOuTeam],
  ['sv-doubles-ou', doublesTeam],
  ['champions-bss-reg-mb', championsBssTeam],
  ['champions-vgc-reg-mb', championsBssTeam],
];
const PERSPECTIVES: BattlePerspective[] = ['p1', 'p2', 'spectator', 'omniscient'];

const create = (formatId: BattleFormatId, team: BattleTeamInput, seed = SEED) =>
  createBattle({
    formatId,
    seed,
    sides: { p1: { displayName: 'Ash', team }, p2: { displayName: 'Gary', team } },
  });

/** A state with the only intentionally random field removed. */
const stable = (state: BattleState) => ({ ...state, battleId: '' });

/**
 * Plays to the end, snapshotting the omniscient state at every decision boundary (the moment before
 * the first command of a decision is submitted).
 */
function play(session: BattleSession, maxRounds = 500) {
  const boundaries: BattleState[] = [];
  for (let i = 0; i < maxRounds && session.getState('spectator').status !== 'finished'; i++) {
    for (const side of ['p1', 'p2'] as const) {
      if (session.getState('spectator').status === 'finished') break;
      const command = firstChoice(session.getLegalChoices(side));
      if (!command) continue;
      const state = session.getState('omniscient');
      const started = Object.values(state.requests).some((request) => request.submitted);
      if (!started) boundaries.push(state);
      session.submitChoice(side, command);
    }
  }
  return boundaries;
}

function reason(run: () => unknown): BattleErrorDetailsByCode['INVALID_REPLAY'] {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(BattleDomainError);
    expect((error as BattleDomainError).code).toBe('INVALID_REPLAY');
    return (error as BattleDomainError).details as BattleErrorDetailsByCode['INVALID_REPLAY'];
  }
  throw new Error('expected INVALID_REPLAY');
}

describe.each(FORMATS)('replay determinism: %s', (formatId, team) => {
  it('serialize → restore reproduces state, events and result for every perspective', () => {
    const original = create(formatId, team);
    play(original);
    const replay = original.getReplay();
    expect(replay.result).toMatchObject({ kind: 'win' });

    const restored = restoreBattle(JSON.stringify(replay)); // through JSON text, like storage would
    expect(restored.info.seed).toBe(original.info.seed);
    for (const perspective of PERSPECTIVES) {
      expect(stable(restored.getState(perspective))).toEqual(
        stable(original.getState(perspective)),
      );
      expect(restored.getEvents(perspective)).toEqual(original.getEvents(perspective));
    }
    // The restored session records exactly the same replay (idempotent).
    expect(restored.getReplay()).toEqual(replay);
  });

  it('restores to every decision boundary with the same state the battle had there', () => {
    const original = create(formatId, team);
    const boundaries = play(original);
    const replay = original.getReplay();
    expect(boundaries.length).toBeGreaterThan(3);
    for (const [decision, expected] of boundaries.entries()) {
      const restored = restoreBattle(replay, { atDecision: decision });
      expect(stable(restored.getState('omniscient'))).toEqual(stable(expected));
      for (const side of ['p1', 'p2'] as const) {
        expect(restored.getState(side).requests[side]?.submitted).not.toBe(true);
      }
    }
  });
});

describe('the replay format', () => {
  const original = create('sv-doubles-ou', doublesTeam);
  play(original);
  const replay = original.getReplay();

  it('is versioned, records the simulator and the stable format id and seed', () => {
    expect(replay.schemaVersion).toBe(BATTLE_REPLAY_SCHEMA_VERSION);
    expect(replay.schemaVersion).toBe(1);
    expect(replay.engine).toEqual({
      simulator: 'pokemon-showdown',
      simulatorVersion: SIMULATOR_VERSION,
    });
    expect(replay.formatId).toBe('sv-doubles-ou');
    expect(replay.seed).toBe(SEED);
    expect(replay.sides.p1.displayName).toBe('Ash');
    expect(replay.sides.p1.team.members).toHaveLength(6);
  });

  it('is plain JSON: it survives a JSON round trip unchanged', () => {
    expect(JSON.parse(JSON.stringify(replay))).toEqual(replay);
  });

  it('holds structured PokeStudio commands only — no simulator syntax or ids', () => {
    const text = JSON.stringify(replay);
    expect(text).not.toMatch(/"(move|switch|team) [0-9]/);
    expect(text).not.toMatch(/gen9(ou|doublesou|champions)/);
    for (const entry of replay.commands) {
      expect(typeof entry.command).toBe('object');
      expect(['team-order', 'actions']).toContain(entry.command.kind);
    }
  });

  it('numbers decisions consecutively, with side and turn context', () => {
    const decisions = [...new Set(replay.commands.map((c) => c.decision))];
    expect(decisions).toEqual(decisions.map((_, i) => i));
    expect(replay.commands.every((c) => ['p1', 'p2'].includes(c.side) && c.turn >= 0)).toBe(true);
    // Team preview is decision 0, turn 0, one command per side.
    const first = replay.commands.filter((c) => c.decision === 0);
    expect(first.map((c) => [c.side, c.turn, c.command.kind])).toEqual([
      ['p1', 0, 'team-order'],
      ['p2', 0, 'team-order'],
    ]);
    expect(replay.commands.at(-1)!.turn).toBeGreaterThan(1);
  });

  it('records only accepted commands', () => {
    const session = create('sv-ou', legalOuTeam);
    const before = session.getReplay().commands.length;
    expect(() => session.submitChoice('p1', { kind: 'team-order', order: [0, 0] })).toThrowError(
      BattleDomainError,
    );
    expect(session.getReplay().commands).toHaveLength(before);
    session.submitChoice('p1', { kind: 'team-order', order: [0, 1] });
    expect(() => session.submitChoice('p1', { kind: 'team-order', order: [1, 0] })).toThrowError(
      BattleDomainError,
    );
    expect(session.getReplay().commands).toHaveLength(before + 1);
  });

  it('getReplay returns a copy, and restoring never mutates the input', () => {
    const copy = original.getReplay();
    copy.commands.length = 0;
    copy.sides.p1.displayName = 'Mallory';
    expect(original.getReplay().commands.length).toBeGreaterThan(0);
    expect(original.getReplay().sides.p1.displayName).toBe('Ash');
    const frozen = structuredClone(replay);
    restoreBattle(frozen);
    expect(frozen).toEqual(replay);
  });

  it('a mid-decision replay restores with the pending command applied', () => {
    const session = create('sv-ou', legalOuTeam);
    session.submitChoice('p1', { kind: 'team-order', order: [0, 1] });
    const restored = restoreBattle(session.getReplay());
    expect(restored.getState('p1').requests.p1).toEqual({ kind: 'team-preview', submitted: true });
    expect(restored.getState('p2').requests.p2).toEqual({ kind: 'team-preview', submitted: false });
  });
});

describe('rejecting bad replays', () => {
  const base = (() => {
    const session = create('sv-ou', legalOuTeam);
    play(session);
    return session.getReplay();
  })();
  const tweak = (edit: (replay: BattleReplay & Record<string, unknown>) => void) => {
    const copy = structuredClone(base) as BattleReplay & Record<string, unknown>;
    edit(copy);
    return copy;
  };

  it('rejects text that is not JSON', () => {
    expect(reason(() => restoreBattle('{not json')).reason).toBe('malformed-json');
    expect(reason(() => parseBattleReplay('')).reason).toBe('malformed-json');
  });

  it.each([null, 42, 'null', [], undefined])('rejects a non-object replay %j', (value) => {
    expect(reason(() => restoreBattle(value)).reason).toMatch(/malformed/);
  });

  it.each([0, 2, '1', null, undefined])('rejects schema version %j', (schemaVersion) => {
    const bad = tweak((r) => ((r as { schemaVersion: unknown }).schemaVersion = schemaVersion));
    expect(reason(() => restoreBattle(bad)).reason).toBe('unsupported-version');
  });

  it.each([
    ['missing seed', (r: Record<string, unknown>) => delete r['seed']],
    ['missing sides', (r: Record<string, unknown>) => delete r['sides']],
    ['commands not an array', (r: Record<string, unknown>) => (r['commands'] = 'x')],
    ['bad result', (r: Record<string, unknown>) => (r['result'] = { kind: 'win', winner: 'p9' })],
    [
      'bad command entry',
      (r: Record<string, unknown>) => ((r['commands'] as unknown[])[1] = { nope: true }),
    ],
    ['bad engine block', (r: Record<string, unknown>) => (r['engine'] = { simulator: 'other' })],
    [
      'a decision that skips ahead',
      (r: Record<string, unknown>) => ((r['commands'] as { decision: number }[])[2]!.decision = 7),
    ],
  ])('rejects a malformed replay: %s', (_label, edit) => {
    const bad = tweak(edit as never);
    const details = reason(() => restoreBattle(bad));
    expect(details.reason).toBe('malformed');
    expect(details.issues?.length).toBeGreaterThan(0);
  });

  it('rejects a replay recorded with another simulator version', () => {
    const bad = tweak((r) => (r.engine.simulatorVersion = '0.0.1'));
    expect(reason(() => restoreBattle(bad)).reason).toBe('incompatible-engine');
  });

  it('rejects an unknown format and an unusable config', () => {
    expect(
      reason(() => restoreBattle(tweak((r) => ((r as { formatId: string }).formatId = 'gen9ou'))))
        .reason,
    ).toBe('invalid-config');
    expect(reason(() => restoreBattle(tweak((r) => (r.seed = 'nope')))).reason).toBe(
      'invalid-config',
    );
    expect(
      reason(() => restoreBattle(tweak((r) => (r.sides.p1.team = { members: [] })))).reason,
    ).toBe('invalid-config');
  });

  it('rejects a command the engine does not accept, naming which one', () => {
    const bad = tweak((r) => {
      const index = r.commands.findIndex((c) => c.decision === 1 && c.command.kind === 'actions');
      r.commands[index] = { ...r.commands[index]!, command: { kind: 'actions', actions: [] } };
    });
    const details = reason(() => restoreBattle(bad));
    expect(details.reason).toBe('commands-rejected');
    expect(details.commandIndex).toBeGreaterThanOrEqual(2);
  });

  it('rejects a replay whose commands no longer reproduce the recorded result', () => {
    const bad = tweak(
      (r) =>
        (r.result = {
          kind: 'win',
          winner: base.result?.kind === 'win' && base.result.winner === 'p1' ? 'p2' : 'p1',
        }),
    );
    expect(reason(() => restoreBattle(bad)).reason).toBe('result-mismatch');
    const tie = tweak((r) => (r.result = { kind: 'tie' }));
    expect(reason(() => restoreBattle(tie)).reason).toBe('result-mismatch');
  });

  it.each([-1, 1.5, 9999, Number.NaN])('rejects the decision boundary %j', (atDecision) => {
    expect(reason(() => restoreBattle(base, { atDecision })).reason).toBe('decision-out-of-range');
  });

  it('accepts the first and the last existing boundaries', () => {
    const last = base.commands.at(-1)!.decision;
    expect(() => restoreBattle(base, { atDecision: 0 })).not.toThrow();
    expect(() => restoreBattle(base, { atDecision: last })).not.toThrow();
    expect(restoreBattle(base, { atDecision: 0 }).getState('omniscient').turn).toBe(0);
  });
});

describe('replays and series', () => {
  it('every game of a series carries its own reproducible replay', () => {
    const series = createBattleSeries({
      formatId: 'sv-ou',
      bestOf: 3,
      seed: SEED,
      sides: {
        p1: { displayName: 'A', team: legalOuTeam },
        p2: { displayName: 'B', team: legalOuTeam },
      },
    });
    for (let guard = 0; guard < 4 && series.currentGame(); guard++) {
      play(series.currentGame()!);
      if (series.getStatus() === 'finished') break;
      series.startNextGame();
    }
    for (const game of series.getGames()) {
      const restored = restoreBattle(game.replay);
      expect(restored.getState('omniscient').result).toEqual(game.result);
      expect(game.replay.seed).toBe(game.seed);
    }
  });
});
