import { describe, expect, it } from 'vitest';

import { generatePackedTeam, simulateHeadlessBattle } from './adapter';

describe('simulateHeadlessBattle (adapter spike over pokemon-showdown)', () => {
  it('is deterministic for a fixed seed/team and produces a structured trace', async () => {
    // Team generation itself is a separate random source from the battle
    // seed, so fix both teams to isolate battle-mechanics determinism.
    const p1Team = generatePackedTeam('gen9randombattle');
    const p2Team = generatePackedTeam('gen9randombattle');

    const input = {
      formatId: 'gen9randombattle',
      seed: [1, 2, 3, 4] as const,
      players: {
        p1: { name: 'Bot 1', team: p1Team },
        p2: { name: 'Bot 2', team: p2Team },
      },
    };

    const [first, second] = await Promise.all([
      simulateHeadlessBattle(input),
      simulateHeadlessBattle(input),
    ]);

    expect(first.winner).not.toBeNull();
    expect(first.winner).toBe(second.winner);
    expect(first.turnCount).toBe(second.turnCount);
    expect(first.turnCount).toBeGreaterThan(0);

    // Raw upstream internals must not leak: every event is one of PokeLab's
    // own structured event types, never a raw pokemon-showdown object.
    const eventTypes = new Set(first.events.map((event) => event.type));
    expect(eventTypes.has('turn')).toBe(true);
    expect(eventTypes.has('win')).toBe(true);
  }, 20_000);
});
