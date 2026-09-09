import type { StructuredBattleEvent } from './types';

/**
 * Parses a single Showdown protocol line into a PokeStudio structured event.
 * Unrecognized lines are preserved as `raw` so no information is silently dropped.
 * Protocol reference: https://github.com/smogon/pokemon-showdown/blob/master/sim/SIM-PROTOCOL.md
 */
export function parseProtocolLine(line: string): StructuredBattleEvent {
  const parts = line.split('|');
  const command = parts[1];

  switch (command) {
    case 'turn': {
      const turn = Number.parseInt(parts[2] ?? '', 10);
      if (!Number.isNaN(turn)) return { type: 'turn', turn };
      break;
    }
    case 'move': {
      const source = parts[2];
      const move = parts[3];
      const target = parts[4];
      if (source && move) return { type: 'move', source, move, target };
      break;
    }
    case '-damage': {
      const target = parts[2];
      const remainingHpDisplay = parts[3];
      if (target && remainingHpDisplay) return { type: 'damage', target, remainingHpDisplay };
      break;
    }
    case 'faint': {
      const pokemon = parts[2];
      if (pokemon) return { type: 'faint', pokemon };
      break;
    }
    case 'win': {
      const winner = parts[2];
      if (winner) return { type: 'win', winner };
      break;
    }
  }

  return { type: 'raw', line };
}
