import { describe, expect, it } from 'vitest';

import { createBattle } from './session';
import { doublesTeam } from './test/fixtures';
import { newBattle } from './test/helpers';
import type {
  BattleCommand,
  BattleCommandAction,
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

/**
 * Doubles: every option each slot is offered (with every target and Tera variant) must be accepted
 * by the engine when combined with a legal action for the other slot.
 */
describe('Doubles: legal choices are accepted by the engine', () => {
  const DOUBLES_SEED = 'gen5,0001000200030004';
  const fresh = () =>
    createBattle({
      formatId: 'sv-doubles-ou',
      seed: DOUBLES_SEED,
      sides: {
        p1: { displayName: 'A', team: doublesTeam },
        p2: { displayName: 'B', team: doublesTeam },
      },
    });

  /** The simplest legal action for a slot, avoiding a switch target `taken` by the other slot. */
  const simplest = (slot: BattleSlotChoices, taken?: number): BattleCommandAction => {
    const option =
      slot.options.find((o) => o.kind === 'move') ??
      slot.options.find((o) => o.kind === 'switch' && o.pokemon.teamIndex !== taken) ??
      slot.options[0]!;
    if (option.kind === 'move') {
      const target = option.targets?.[0];
      return {
        kind: 'move',
        slot: slot.slot,
        moveId: option.moveId,
        ...(target ? { target } : {}),
      };
    }
    if (option.kind === 'switch')
      return { kind: 'switch', slot: slot.slot, pokemon: option.pokemon };
    return { kind: 'pass', slot: slot.slot };
  };

  /** Every variant of one option: each target, with and without its modifiers. */
  const variants = (slot: BattleSlotChoices, option: BattleLegalOption): BattleCommandAction[] => {
    if (option.kind === 'switch')
      return [{ kind: 'switch', slot: slot.slot, pokemon: option.pokemon }];
    if (option.kind === 'pass') return [{ kind: 'pass', slot: slot.slot }];
    const targets = option.targets ?? [undefined];
    return targets.flatMap((target) =>
      [undefined, ...option.modifiers].map((modifier): BattleCommandAction => ({
        kind: 'move',
        slot: slot.slot,
        moveId: option.moveId,
        ...(target ? { target } : {}),
        ...(modifier ? { modifier } : {}),
      })),
    );
  };

  /** Commands that vary one slot at a time against a simple action in the other. */
  function commandsFor(choices: BattleLegalChoices): BattleCommand[] {
    if (choices.kind === 'wait') return [];
    if (choices.kind === 'team-preview') {
      return [{ kind: 'team-order', order: Array.from({ length: choices.pick }, (_, i) => i) }];
    }
    if (choices.kind === 'forced-switch') {
      const list: BattleCommand[] = [];
      // Every way to place the required switches: each slot in turn takes the first replacement.
      for (const lead of choices.slots) {
        const first = lead.options.find((o) => o.kind === 'switch');
        if (!first || first.kind !== 'switch') continue;
        let remaining = choices.switchCount - 1;
        const used = new Set([first.pokemon.teamIndex]);
        list.push({
          kind: 'actions',
          actions: choices.slots.map((slot): BattleCommandAction => {
            if (slot === lead) return { kind: 'switch', slot: slot.slot, pokemon: first.pokemon };
            const next = slot.options.find(
              (o) => o.kind === 'switch' && !used.has(o.pokemon.teamIndex),
            );
            if (next?.kind === 'switch' && remaining > 0) {
              remaining--;
              used.add(next.pokemon.teamIndex);
              return { kind: 'switch', slot: slot.slot, pokemon: next.pokemon };
            }
            return { kind: 'pass', slot: slot.slot };
          }),
        });
      }
      return list;
    }
    const [a, b] = choices.slots as [BattleSlotChoices, BattleSlotChoices];
    const list: BattleCommand[] = [];
    for (const option of a.options) {
      for (const action of variants(a, option)) {
        const taken = action.kind === 'switch' ? action.pokemon.teamIndex : undefined;
        list.push({ kind: 'actions', actions: [action, simplest(b, taken)] });
      }
    }
    for (const option of b.options) {
      for (const action of variants(b, option)) {
        const taken = action.kind === 'switch' ? action.pokemon.teamIndex : undefined;
        list.push({ kind: 'actions', actions: [simplest(a, taken), action] });
      }
    }
    // Both slots switching at once, to different Pokémon.
    const switchA = a.options.find((o) => o.kind === 'switch');
    const switchB = b.options.find(
      (o) =>
        o.kind === 'switch' &&
        o !== switchA &&
        (switchA?.kind === 'switch' ? o.pokemon.teamIndex !== switchA.pokemon.teamIndex : true),
    );
    if (switchA?.kind === 'switch' && switchB?.kind === 'switch') {
      list.push({
        kind: 'actions',
        actions: [
          { kind: 'switch', slot: a.slot, pokemon: switchA.pokemon },
          { kind: 'switch', slot: b.slot, pokemon: switchB.pokemon },
        ],
      });
    }
    return list;
  }

  it('accepts every offered option/target/modifier combination along a full battle', () => {
    const history: Step[] = [];
    const live = fresh();
    const kinds = new Set<string>();
    let checked = 0;
    let decisions = 0;
    while (live.getState('spectator').status !== 'finished' && decisions++ < 25) {
      for (const side of ['p1', 'p2'] as const) {
        if (live.getState('spectator').status === 'finished') break;
        const choices = live.getLegalChoices(side);
        kinds.add(choices.kind);
        const commands = commandsFor(choices);
        for (const command of commands) {
          const copy = fresh();
          for (const step of history) copy.submitChoice(step.side, step.command);
          expect(() => copy.submitChoice(side, command)).not.toThrow();
          checked++;
        }
        const chosen = commands[decisions % Math.max(commands.length, 1)];
        if (!chosen) continue;
        live.submitChoice(side, chosen);
        history.push({ side, command: chosen });
      }
    }
    expect(checked).toBeGreaterThan(60);
    expect(kinds.has('move')).toBe(true);
  }, 120_000);
});
