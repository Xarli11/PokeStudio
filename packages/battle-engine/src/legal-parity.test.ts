import { describe, expect, it } from 'vitest';

import { newBattle } from './test/helpers';
import type {
  BattleCommand,
  BattleLegalChoices,
  BattleLegalOption,
  BattleSideId,
  BattleSlotChoices,
} from './types';

/**
 * Every option that getLegalChoices() offers must be accepted by submitChoice() and by the
 * simulator (a rejection would surface as ENGINE_ERROR / ILLEGAL_CHOICE). For each decision point we
 * rebuild the battle from the same seed and command history and submit each offered option.
 */
const SEEDS = ['gen5,0001000200030004', 'gen5,0009000200030004'];

interface Step {
  side: BattleSideId;
  command: BattleCommand;
}

const toCommand = (
  slots: BattleSlotChoices[],
  pick: (options: BattleLegalOption[]) => BattleLegalOption,
): BattleCommand => ({
  kind: 'actions',
  actions: slots.map(({ slot, options }) => {
    const option = pick(options);
    if (option.kind === 'move') return { kind: 'move', slot, moveId: option.moveId };
    if (option.kind === 'switch') return { kind: 'switch', slot, pokemon: option.pokemon };
    return { kind: 'pass', slot };
  }),
});

/** All single-slot commands a decision offers, including the Terastallize variant of each move. */
function everyCommand(choices: BattleLegalChoices): BattleCommand[] {
  if (choices.kind === 'wait') return [];
  if (choices.kind === 'team-preview') {
    return [
      { kind: 'team-order', order: Array.from({ length: choices.pick }, (_, i) => i) },
      {
        kind: 'team-order',
        order: Array.from({ length: choices.pick }, (_, i) => choices.pick - 1 - i),
      },
    ];
  }
  const slot = choices.slots[0]!;
  return slot.options.flatMap((option): BattleCommand[] => {
    const base = toCommand([slot], () => option);
    if (option.kind !== 'move' || option.modifiers.length === 0) return [base];
    const withModifier: BattleCommand = {
      kind: 'actions',
      actions: [
        { kind: 'move', slot: slot.slot, moveId: option.moveId, modifier: option.modifiers[0]! },
      ],
    };
    return [base, withModifier];
  });
}

function replay(seed: string, history: readonly Step[]) {
  const session = newBattle({ seed });
  for (const step of history) session.submitChoice(step.side, step.command);
  return session;
}

describe.each(SEEDS)('legal choices are accepted by the engine (%s)', (seed) => {
  it('accepts every offered option at every decision along a full battle', () => {
    const history: Step[] = [];
    const live = newBattle({ seed });
    let checked = 0;
    const kinds = new Set<string>();
    let decisions = 0;
    while (live.getState('spectator').status !== 'finished' && decisions++ < 60) {
      for (const side of ['p1', 'p2'] as const) {
        if (live.getState('spectator').status === 'finished') break;
        const choices = live.getLegalChoices(side);
        kinds.add(choices.kind);
        const commands = everyCommand(choices);
        for (const command of commands) {
          const fresh = replay(seed, history);
          expect(() => fresh.submitChoice(side, command)).not.toThrow();
          checked++;
        }
        if (commands.length === 0) continue;
        // Advance along a varied path: alternate between the offered commands.
        const chosen = commands[decisions % commands.length]!;
        live.submitChoice(side, chosen);
        history.push({ side, command: chosen });
      }
    }
    expect(live.getState('spectator').status).toBe('finished');
    expect(checked).toBeGreaterThan(20);
    expect(kinds.has('forced-switch') && kinds.has('move')).toBe(true);
  });
});
