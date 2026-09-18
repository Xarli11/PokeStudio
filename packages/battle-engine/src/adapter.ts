import { BattleStream, Teams, getPlayerStreams } from 'pokemon-showdown';

import { parseProtocolLine } from './parse-event';
import type { HeadlessBattleInput, HeadlessBattleResult, StructuredBattleEvent } from './types';

/**
 * Runs a full battle headlessly, both sides choosing Showdown's default legal
 * action each turn. Proves the PokeLab boundary can invoke the upstream
 * simulator deterministically and extract a structured trace, without any
 * UI code touching `pokemon-showdown` directly (docs/architecture/BATTLE_ENGINE.md).
 */
export async function simulateHeadlessBattle(
  input: HeadlessBattleInput,
): Promise<HeadlessBattleResult> {
  const battleStream = new BattleStream();
  const streams = getPlayerStreams(battleStream);

  const startSpec = { formatid: input.formatId, seed: [...input.seed] };
  void streams.omniscient.write(
    [
      `>start ${JSON.stringify(startSpec)}`,
      `>player p1 ${JSON.stringify({ name: input.players.p1.name, team: input.players.p1.team })}`,
      `>player p2 ${JSON.stringify({ name: input.players.p2.name, team: input.players.p2.team })}`,
    ].join('\n'),
  );

  let winner: string | null = null;
  let turnCount = 0;
  const events: StructuredBattleEvent[] = [];

  async function pumpPlayerChoices(stream: typeof streams.p1): Promise<void> {
    for await (const chunk of stream) {
      if (chunk.includes('|request|') && !chunk.includes('"wait"')) {
        void stream.write('default');
      }
    }
  }

  async function pumpOmniscientLog(): Promise<void> {
    for await (const chunk of streams.omniscient) {
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('|')) continue;
        const event = parseProtocolLine(line);
        events.push(event);
        if (event.type === 'turn') turnCount = event.turn;
        if (event.type === 'win') winner = event.winner;
      }
    }
  }

  await Promise.all([
    pumpPlayerChoices(streams.p1),
    pumpPlayerChoices(streams.p2),
    pumpOmniscientLog(),
  ]);

  return { winner, turnCount, events };
}

/** Generates and packs a legal random team for a format — spike convenience, not a Team Builder API. */
export function generatePackedTeam(formatId: string): string {
  return Teams.pack(Teams.generate(formatId));
}
