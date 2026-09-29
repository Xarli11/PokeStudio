import type {
  BattleCommand,
  BattleConfig,
  BattleLegalChoices,
  BattleSession,
  BattleSideId,
  BattleTeamInput,
} from '../types';

export const SIDES: readonly BattleSideId[] = ['p1', 'p2'];

/** Deterministic policy: team order as given, first enabled move, first available switch. */
export function firstChoice(choices: BattleLegalChoices): BattleCommand | null {
  switch (choices.kind) {
    case 'wait':
      return null;
    case 'team-preview':
      return { kind: 'team-order', order: Array.from({ length: choices.pick }, (_, i) => i) };
    case 'move':
    case 'forced-switch':
      return {
        kind: 'actions',
        actions: choices.slots.map(({ slot, options }) => {
          const option = options.find((o) => o.kind === 'move') ?? options[0];
          if (!option) throw new Error('no legal option');
          if (option.kind === 'move') return { kind: 'move', slot, moveId: option.moveId };
          if (option.kind === 'switch') return { kind: 'switch', slot, pokemon: option.pokemon };
          return { kind: 'pass', slot };
        }),
      };
  }
}

export interface PlayLog {
  kinds: Set<string>;
  decisions: number;
}

/** Plays to the end with a per-decision hook; returns what kinds of requests were seen. */
export function playToEnd(
  session: BattleSession,
  choose: (choices: BattleLegalChoices) => BattleCommand | null = firstChoice,
  maxDecisions = 400,
): PlayLog {
  const log: PlayLog = { kinds: new Set(), decisions: 0 };
  while (session.getState('spectator').status !== 'finished') {
    if (log.decisions++ > maxDecisions) throw new Error('battle did not finish');
    for (const side of SIDES) {
      if (session.getState('spectator').status === 'finished') break;
      const choices = session.getLegalChoices(side);
      log.kinds.add(choices.kind);
      const command = choose(choices);
      if (command) session.submitChoice(side, command);
    }
  }
  return log;
}

export const soloTeam = (
  species: string,
  ability: string,
  moves: string[],
  item?: string,
): BattleTeamInput => ({
  members: [{ species, ability, moves, ...(item ? { item } : {}) }],
});

import { findBattleFormat } from '../formats';
import { createBattle, createBattleForTests } from '../session';
import { CUSTOM_FORMAT, SEED, teamA, teamB } from './fixtures';

/**
 * Creates a battle. A PokeStudio catalog id (e.g. `sv-ou`) goes through the public `createBattle`.
 * Anything else — the default is `gen9customgame` — is a raw simulator format and uses the
 * test-only path, which mechanics tests need for artificial formats.
 */
export function newBattle(
  overrides: {
    formatId?: string;
    seed?: string | undefined;
    p1?: BattleTeamInput;
    p2?: BattleTeamInput;
  } = {},
): BattleSession {
  const seed = 'seed' in overrides ? overrides.seed : SEED;
  const formatId = overrides.formatId ?? CUSTOM_FORMAT;
  const config = {
    formatId,
    ...(seed === undefined ? {} : { seed }),
    sides: {
      p1: { displayName: 'Ash', team: overrides.p1 ?? teamA },
      p2: { displayName: 'Gary', team: overrides.p2 ?? teamB },
    },
  };
  return findBattleFormat(formatId)
    ? createBattle(config as BattleConfig)
    : createBattleForTests(config);
}

/** Submits team preview for both sides with the given orders (default: input order). */
export function startTurnOne(session: BattleSession, p1 = [0, 1], p2 = [0, 1]) {
  session.submitChoice('p1', { kind: 'team-order', order: p1 });
  session.submitChoice('p2', { kind: 'team-order', order: p2 });
}
