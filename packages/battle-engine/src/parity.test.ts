import { Battle } from 'pokemon-showdown';
import { describe, expect, it } from 'vitest';

import { inputLogForTests } from './session';
import { newBattle, playToEnd } from './test/helpers';
import type { BattleSession } from './types';

/**
 * Showdown parity: drive a raw simulator battle directly (its own request objects, its own choice
 * strings) with the same teams and seed, using a policy written against Showdown only, and require
 * the PokeStudio session to reach the same outcome from the same inputs.
 */
const seedLine = /^>start (.*)$/;

function rawBattleFromSession(session: BattleSession) {
  const log = inputLogForTests(session);
  const start = JSON.parse(seedLine.exec(log.find((l) => l.startsWith('>start'))!)![1]!) as {
    formatid: string;
    seed: string;
  };
  const team = (id: 'p1' | 'p2') => {
    const line = log.find((l) => l.startsWith(`>player ${id} `))!;
    return (JSON.parse(line.slice(`>player ${id} `.length)) as { team: string }).team;
  };
  const battle = new Battle({
    formatid: start.formatid as never,
    seed: start.seed as never,
    p1: { name: 'X', team: team('p1') },
    p2: { name: 'Y', team: team('p2') },
  });
  return battle;
}

/** Independent policy over raw requests: team order as-is, first usable move, first live bench. */
function playRaw(battle: Battle) {
  for (let guard = 0; !battle.ended && guard < 500; guard++) {
    for (const id of ['p1', 'p2'] as const) {
      const side = battle.getSide(id);
      const request = side.activeRequest;
      if (!request || request.wait || battle.ended) continue;
      if (request.teamPreview) {
        battle.choose(id, `team ${request.side.pokemon.map((_, i) => i + 1).join(', ')}`);
      } else if (request.forceSwitch) {
        const index = request.side.pokemon.findIndex(
          (p) => !p.active && !p.condition.endsWith(' fnt'),
        );
        battle.choose(id, `switch ${index + 1}`);
      } else {
        const index = request.active[0]!.moves.findIndex(
          (m) => !m.disabled && (m.pp === undefined || m.pp > 0),
        );
        battle.choose(id, `move ${index + 1}`);
      }
    }
  }
}

const choiceLines = (log: readonly string[]) => log.filter((line) => /^>p[12] /.test(line));

describe.each([
  'gen5,0001000200030004',
  'gen5,0009000200030004',
  'sodium,00112233445566778899aabbccddeeff',
])('session vs raw simulator (%s)', (seed) => {
  it('produces the same winner, turn count and choice log', () => {
    const session = newBattle({ seed });
    playToEnd(session);
    const raw = rawBattleFromSession(session);
    playRaw(raw);

    expect(raw.ended).toBe(true);
    const state = session.getState('omniscient');
    expect(state.status).toBe('finished');
    expect(state.turn).toBe(raw.turn);
    // Raw sides are named X/Y here; the session used P1/P2. Compare by side.
    const rawWinner = raw.winner === 'X' ? 'p1' : raw.winner === 'Y' ? 'p2' : null;
    expect(state.result).toEqual(rawWinner ? { kind: 'win', winner: rawWinner } : { kind: 'tie' });

    const expected = choiceLines(raw.inputLog);
    const actual = choiceLines(inputLogForTests(session));
    expect(actual.length).toBeGreaterThan(6);
    expect(actual).toEqual(expected);
  });
});

describe('session events vs the raw public log', () => {
  it('reports the same sequence of moves the simulator logged', () => {
    const session = newBattle();
    playToEnd(session);
    const raw = rawBattleFromSession(session);
    playRaw(raw);
    const normalize = (id: string) => id.toLowerCase().replace(/[^a-z0-9]/g, '');
    const rawMoves = raw.log
      .filter((line) => line.startsWith('|move|'))
      .map((line) => normalize(line.split('|')[3] ?? ''));
    const sessionMoves = session
      .getEvents('spectator')
      .flatMap((e) => (e.type === 'move-used' ? [e.moveId] : []));
    expect(sessionMoves.length).toBeGreaterThan(3);
    expect(sessionMoves).toEqual(rawMoves);
  });
});
