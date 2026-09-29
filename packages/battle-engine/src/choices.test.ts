import { describe, expect, it } from 'vitest';

import { BattleDomainError } from './errors';
import type { BattleErrorCode, BattleIllegalChoiceReason } from './errors';
import { firstChoice, newBattle, startTurnOne } from './test/helpers';
import type { BattleCommand, BattleSession, BattleSideId } from './types';

function expectError(
  run: () => unknown,
  code: BattleErrorCode,
  reason?: BattleIllegalChoiceReason,
) {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(BattleDomainError);
    const domain = error as BattleDomainError;
    expect(domain.code).toBe(code);
    if (reason) expect(domain.details).toMatchObject({ reason });
    return;
  }
  throw new Error(`expected ${code}`);
}

const slot = (side: BattleSideId) => ({ side, position: 0 });
const move = (side: BattleSideId, moveId: string, extra: object = {}): BattleCommand => ({
  kind: 'actions',
  actions: [{ kind: 'move', slot: slot(side), moveId, ...extra }],
});

describe('team preview', () => {
  it('accepts a full ordered team-order and applies it (lead = first)', () => {
    const session = newBattle();
    startTurnOne(session, [1, 0], [0, 1]);
    const state = session.getState('omniscient');
    expect(state.turn).toBe(1);
    expect(state.sides.p1.active[0]?.ref).toEqual({ side: 'p1', teamIndex: 1 });
  });

  it.each([
    ['too short', [0]],
    ['duplicate', [0, 0]],
    ['unknown index', [0, 5]],
    ['non-integer', [0, 1.5]],
  ])('rejects an invalid order: %s', (_label, order) => {
    const session = newBattle();
    expectError(
      () => session.submitChoice('p1', { kind: 'team-order', order }),
      'ILLEGAL_CHOICE',
      'invalid-team-order',
    );
  });

  it('rejects actions during team preview', () => {
    const session = newBattle();
    expectError(
      () => session.submitChoice('p1', move('p1', 'earthquake')),
      'ILLEGAL_CHOICE',
      'wrong-request-kind',
    );
  });
});

describe('move choices', () => {
  it('lists structured legal moves and switches (no engine strings)', () => {
    const session = newBattle();
    startTurnOne(session);
    const choices = session.getLegalChoices('p1');
    expect(choices.kind).toBe('move');
    if (choices.kind !== 'move') return;
    const options = choices.slots[0]!.options;
    expect(
      options.filter((o) => o.kind === 'move').map((o) => (o.kind === 'move' ? o.moveId : '')),
    ).toEqual(['earthquake', 'dragonclaw', 'swordsdance', 'protect']);
    expect(options).toContainEqual({ kind: 'switch', pokemon: { side: 'p1', teamIndex: 1 } });
    const first = options[0];
    expect(first).toMatchObject({ kind: 'move', targets: null, modifiers: ['terastallize'] });
  });

  it('accepts a legal move and reports whether it resolved', () => {
    const session = newBattle();
    startTurnOne(session);
    const first = session.submitChoice('p1', move('p1', 'earthquake'));
    expect(first.resolved).toBe(false);
    expect(first.state.requests.p1).toEqual({ kind: 'move', submitted: true });
    const second = session.submitChoice('p2', move('p2', 'extremespeed'));
    expect(second.resolved).toBe(true);
    expect(second.state.turn).toBe(2);
    expect(second.events.some((e) => e.type === 'move-used')).toBe(true);
  });

  it('accepts terastallize when the request allows it', () => {
    const session = newBattle();
    startTurnOne(session);
    const result = session.submitChoice(
      'p1',
      move('p1', 'earthquake', { modifier: 'terastallize' }),
    );
    expect(result.resolved).toBe(false);
  });

  it.each([
    ['unknown move', move('p1', 'splash'), 'unknown-move'],
    ['a target in singles', move('p1', 'earthquake', { target: slot('p2') }), 'invalid-target'],
    [
      'a modifier that is not available',
      move('p1', 'earthquake', { modifier: 'dynamax' }),
      'invalid-modifier',
    ],
    [
      'wrong slot',
      {
        kind: 'actions',
        actions: [{ kind: 'move', slot: { side: 'p1', position: 1 }, moveId: 'earthquake' }],
      },
      'invalid-slot',
    ],
    ['wrong action count', { kind: 'actions', actions: [] }, 'wrong-action-count'],
    [
      'switch to the active Pokémon',
      {
        kind: 'actions',
        actions: [{ kind: 'switch', slot: slot('p1'), pokemon: { side: 'p1', teamIndex: 0 } }],
      },
      'switch-unavailable',
    ],
    [
      "switch to the other side's Pokémon",
      {
        kind: 'actions',
        actions: [{ kind: 'switch', slot: slot('p1'), pokemon: { side: 'p2', teamIndex: 1 } }],
      },
      'switch-unavailable',
    ],
    [
      'pass with a live Pokémon',
      { kind: 'actions', actions: [{ kind: 'pass', slot: slot('p1') }] },
      'pass-unavailable',
    ],
    [
      'team order during a move request',
      { kind: 'team-order', order: [0, 1] },
      'wrong-request-kind',
    ],
  ] as const)('rejects %s as ILLEGAL_CHOICE', (_label, command, reason) => {
    const session = newBattle();
    startTurnOne(session);
    expectError(
      () => session.submitChoice('p1', command as BattleCommand),
      'ILLEGAL_CHOICE',
      reason,
    );
    // A rejected command changes nothing: the side can still submit.
    expect(session.getState('p1').requests.p1?.submitted).toBe(false);
  });

  it('accepts a legal switch', () => {
    const session = newBattle();
    startTurnOne(session);
    session.submitChoice('p1', {
      kind: 'actions',
      actions: [{ kind: 'switch', slot: slot('p1'), pokemon: { side: 'p1', teamIndex: 1 } }],
    });
    session.submitChoice('p2', move('p2', 'roost'));
    expect(session.getState('p1').sides.p1.active[0]?.ref).toEqual({ side: 'p1', teamIndex: 1 });
  });

  it('marks a choice-locked move as disabled, excludes it from options and rejects it', () => {
    const session = newBattle();
    startTurnOne(session, [0, 1], [1, 0]); // p2 leads Gholdengo holding a Choice Scarf
    session.submitChoice('p1', move('p1', 'protect'));
    session.submitChoice('p2', move('p2', 'shadowball'));
    const choices = session.getLegalChoices('p2');
    if (choices.kind !== 'move') throw new Error('expected a move request');
    const moves = choices.slots[0]!.options.flatMap((o) => (o.kind === 'move' ? [o.moveId] : []));
    expect(moves).toEqual(['shadowball']);
    expectError(
      () => session.submitChoice('p2', move('p2', 'makeitrain')),
      'ILLEGAL_CHOICE',
      'move-disabled',
    );
    const own = session.getState('p2').sides.p2.active[0];
    expect(own?.moves?.find((m) => m.id === 'makeitrain')?.disabled).toBe(true);
  });
});

describe('sides and submission rules', () => {
  it.each(['p3', 'spectator', '', undefined, null])('rejects side %j with INVALID_SIDE', (side) => {
    const session = newBattle();
    expectError(
      () => session.submitChoice(side as unknown as BattleSideId, move('p1', 'earthquake')),
      'INVALID_SIDE',
    );
    expectError(() => session.getLegalChoices(side as unknown as BattleSideId), 'INVALID_SIDE');
    expectError(() => session.forSide(side as unknown as BattleSideId), 'INVALID_SIDE');
  });

  it('rejects an unknown perspective', () => {
    const session = newBattle();
    expectError(() => session.getState('everyone' as never), 'INVALID_SIDE');
    expectError(() => session.getEvents('everyone' as never), 'INVALID_SIDE');
  });

  it('rejects a malformed command', () => {
    const session = newBattle();
    expectError(() => session.submitChoice('p1', null as never), 'ILLEGAL_CHOICE');
    expectError(() => session.submitChoice('p1', { kind: 'nonsense' } as never), 'ILLEGAL_CHOICE');
  });

  it('rejects a second submit from the same side, even though this format allows the engine to replace choices', () => {
    const session = newBattle(); // gen9customgame includes Cancel Mod
    session.submitChoice('p1', { kind: 'team-order', order: [0, 1] });
    expectError(
      () => session.submitChoice('p1', { kind: 'team-order', order: [1, 0] }),
      'CHOICE_ALREADY_SUBMITTED',
    );
    session.submitChoice('p2', { kind: 'team-order', order: [0, 1] });
    // The first choice stood: p1 kept its original lead.
    expect(session.getState('omniscient').sides.p1.active[0]?.ref.teamIndex).toBe(0);
  });

  it('allows the same side to submit again once the decision resolved', () => {
    const session = newBattle();
    startTurnOne(session);
    session.submitChoice('p1', move('p1', 'protect'));
    session.submitChoice('p2', move('p2', 'roost'));
    expect(() => session.submitChoice('p1', move('p1', 'protect'))).not.toThrow();
  });
});

describe('forced switches', () => {
  /** Plays until exactly one side must switch. */
  function untilForcedSwitch(session: BattleSession) {
    for (let i = 0; i < 100; i++) {
      for (const side of ['p1', 'p2'] as const) {
        const choices = session.getLegalChoices(side);
        if (choices.kind === 'forced-switch') return side;
        const command = firstChoice(choices);
        if (command) session.submitChoice(side, command);
        if (session.getState('spectator').status === 'finished') throw new Error('finished first');
      }
    }
    throw new Error('no forced switch seen');
  }

  it('asks only the affected side; the other side waits and cannot submit', () => {
    const session = newBattle();
    const side = untilForcedSwitch(session);
    const other: BattleSideId = side === 'p1' ? 'p2' : 'p1';
    const choices = session.getLegalChoices(side);
    if (choices.kind !== 'forced-switch') throw new Error('unreachable');
    expect(choices.slots[0]!.options.every((o) => o.kind === 'switch')).toBe(true);
    expect(session.getLegalChoices(other).kind).toBe('wait');
    expectError(
      () => session.submitChoice(other, move(other, 'earthquake')),
      'NOT_ACCEPTING_CHOICE',
    );
    expect(session.getState(side).requests[side]?.kind).toBe('forced-switch');
    // moves are not allowed on a forced switch
    expectError(() => session.submitChoice(side, move(side, 'earthquake')), 'ILLEGAL_CHOICE');
    const target = choices.slots[0]!.options[0];
    if (target?.kind !== 'switch') throw new Error('unreachable');
    const result = session.submitChoice(side, {
      kind: 'actions',
      actions: [{ kind: 'switch', slot: slot(side), pokemon: target.pokemon }],
    });
    expect(result.resolved).toBe(true);
    expect(session.getState('omniscient').sides[side].active[0]?.ref).toEqual(target.pokemon);
  });
});
