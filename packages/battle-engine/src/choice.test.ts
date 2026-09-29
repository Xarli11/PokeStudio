import { describe, expect, it } from 'vitest';

import type { BattleDomainError } from './errors';
import { analyzeRequest, commandToChoiceString, toLegalChoices } from './showdown/choice';
import type { RequestView } from './showdown/choice';
import type { BattleCommand, BattlePokemonRef } from './types';

/**
 * Pure translation tests over a plain multi-slot request fixture. They prove the TYPES and the
 * translation layer are not Singles-only. They do NOT claim Doubles works: no doubles battle runs
 * (the runtime rejects doubles formats with UNSUPPORTED_FORMAT).
 */
const refs: BattlePokemonRef[] = [0, 1, 2, 3].map((teamIndex) => ({ side: 'p1', teamIndex }));

const doublesMove: RequestView = {
  side: {
    pokemon: [
      { condition: '300/300', active: true },
      { condition: '200/200', active: true },
      { condition: '100/100', active: false },
      { condition: '0 fnt', active: false },
    ],
  },
  active: [
    {
      moves: [
        { id: 'earthquake', pp: 16, target: 'allAdjacent' },
        { id: 'dragonclaw', pp: 24, target: 'normal' },
        { id: 'helpinghand', pp: 32, target: 'adjacentAlly' },
        { id: 'protect', pp: 0, target: 'self' },
      ],
      canTerastallize: 'Dragon',
    },
    { moves: [{ id: 'fakeout', pp: 16, target: 'normal' }], trapped: true },
  ],
};

const errorReason = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return (error as BattleDomainError).details as { reason: string };
  }
  throw new Error('expected an error');
};

describe('multi-slot request translation (types only; no doubles runtime)', () => {
  const decision = analyzeRequest(doublesMove, 'p1', refs, 2);
  const choices = toLegalChoices(decision);

  it('produces one slot entry per active slot', () => {
    if (choices.kind !== 'move') throw new Error('expected move');
    expect(choices.slots.map((s) => s.slot)).toEqual([
      { side: 'p1', position: 0 },
      { side: 'p1', position: 1 },
    ]);
  });

  it('derives targets per move from the target kind, excluding self', () => {
    if (choices.kind !== 'move') throw new Error('expected move');
    const first = choices.slots[0]!.options;
    const byId = (id: string) => first.find((o) => o.kind === 'move' && o.moveId === id);
    expect(byId('earthquake')).toMatchObject({ targets: null });
    expect(byId('dragonclaw')).toMatchObject({
      targets: [
        { side: 'p2', position: 0 },
        { side: 'p2', position: 1 },
        { side: 'p1', position: 1 },
      ],
    });
    expect(byId('helpinghand')).toMatchObject({ targets: [{ side: 'p1', position: 1 }] });
    expect(byId('protect')).toBeUndefined(); // 0 PP is not a legal option
  });

  it('respects trapping per slot and lists the bench without fainted Pokémon', () => {
    if (choices.kind !== 'move') throw new Error('expected move');
    const switches = (i: number) => choices.slots[i]!.options.filter((o) => o.kind === 'switch');
    expect(switches(0)).toEqual([{ kind: 'switch', pokemon: refs[2] }]);
    expect(switches(1)).toEqual([]); // trapped
  });

  it('validates the whole multi-slot command, then serializes it in slot order', () => {
    const command: BattleCommand = {
      kind: 'actions',
      actions: [
        {
          kind: 'move',
          slot: { side: 'p1', position: 0 },
          moveId: 'dragonclaw',
          target: { side: 'p2', position: 1 },
          modifier: 'terastallize',
        },
        {
          kind: 'move',
          slot: { side: 'p1', position: 1 },
          moveId: 'fakeout',
          target: { side: 'p2', position: 0 },
        },
      ],
    };
    expect(commandToChoiceString(decision, command)).toBe('move 2 2 terastallize, move 1 1');
  });

  it('rejects a repeated modifier, a missing target and duplicate switches', () => {
    const slot0 = { side: 'p1', position: 0 } as const;
    const slot1 = { side: 'p1', position: 1 } as const;
    expect(
      errorReason(() =>
        commandToChoiceString(decision, {
          kind: 'actions',
          actions: [
            {
              kind: 'move',
              slot: slot0,
              moveId: 'dragonclaw',
              target: { side: 'p2', position: 0 },
              modifier: 'terastallize',
            },
            {
              kind: 'move',
              slot: slot1,
              moveId: 'fakeout',
              target: { side: 'p2', position: 0 },
              modifier: 'terastallize',
            },
          ],
        }),
      ).reason,
    ).toBe('invalid-modifier');
    expect(
      errorReason(() =>
        commandToChoiceString(decision, {
          kind: 'actions',
          actions: [
            { kind: 'move', slot: slot0, moveId: 'dragonclaw' },
            { kind: 'move', slot: slot1, moveId: 'fakeout', target: { side: 'p2', position: 0 } },
          ],
        }),
      ).reason,
    ).toBe('invalid-target');

    const forced = analyzeRequest(
      {
        forceSwitch: [true, true],
        side: {
          pokemon: [
            { condition: '0 fnt', active: true },
            { condition: '0 fnt', active: true },
            { condition: '90/90', active: false },
            { condition: '80/80', active: false },
          ],
        },
      },
      'p1',
      refs,
      2,
    );
    expect(
      errorReason(() =>
        commandToChoiceString(forced, {
          kind: 'actions',
          actions: [
            { kind: 'switch', slot: slot0, pokemon: refs[2]! },
            { kind: 'switch', slot: slot1, pokemon: refs[2]! },
          ],
        }),
      ).reason,
    ).toBe('duplicate-switch');
    expect(
      commandToChoiceString(forced, {
        kind: 'actions',
        actions: [
          { kind: 'switch', slot: slot0, pokemon: refs[3]! },
          { kind: 'switch', slot: slot1, pokemon: refs[2]! },
        ],
      }),
    ).toBe('switch 4, switch 3');
  });

  it('models a forced replacement for only one slot, and a partial team order', () => {
    const oneSlot = analyzeRequest(
      {
        forceSwitch: [false, true],
        side: {
          pokemon: [
            { condition: '10/10', active: true },
            { condition: '0 fnt', active: true },
            { condition: '90/90', active: false },
          ],
        },
      },
      'p1',
      refs.slice(0, 3),
      2,
    );
    const legal = toLegalChoices(oneSlot);
    if (legal.kind !== 'forced-switch') throw new Error('expected forced-switch');
    expect(legal.slots[0]!.options).toEqual([{ kind: 'pass' }]);
    expect(legal.slots[1]!.options).toEqual([{ kind: 'switch', pokemon: refs[2] }]);

    const preview = analyzeRequest(
      {
        teamPreview: true,
        maxChosenTeamSize: 4,
        side: { pokemon: refs.map(() => ({ condition: '1/1', active: false })) },
      },
      'p1',
      [...refs, { side: 'p1', teamIndex: 4 }, { side: 'p1', teamIndex: 5 }],
      2,
    );
    expect(toLegalChoices(preview)).toEqual({ kind: 'team-preview', side: 'p1', pick: 4, of: 6 });
    expect(commandToChoiceString(preview, { kind: 'team-order', order: [3, 1, 0, 5] })).toBe(
      'team 4, 2, 1, 6',
    );
  });
});
