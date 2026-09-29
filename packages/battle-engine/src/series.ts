import { randomUUID } from 'node:crypto';

import { battleError } from './errors';
import { createBattle } from './session';
import { deriveGameSeeds, generateSeed } from './showdown/seeds';
import type {
  BattleConfig,
  BattleReplay,
  BattleFormatInfo,
  BattleResult,
  BattleSeed,
  BattleSession,
  BattleSideId,
} from './types';

/**
 * A best-of-N series of battles on the same format and teams (e.g. VGC best-of-three). A series is
 * a PokeStudio concept above `BattleSession`, not another format: the catalog has no "Bo3" ids. The
 * scoring follows the simulator's own best-of rules (odd length 3–9; a tie awards no win and lowers
 * the wins needed; no more than N games; an undecided series after N games is a tie).
 */

export interface BattleSeriesConfig extends BattleConfig {
  /** Odd number of games, 3 to 9. */
  bestOf: number;
}

export type BattleSeriesStatus = 'in-progress' | 'finished';
export type BattleSeriesResult = { kind: 'win'; winner: BattleSideId } | { kind: 'tie' };

export interface BattleSeriesScore {
  wins: Record<BattleSideId, number>;
  ties: number;
  gamesPlayed: number;
}

export interface BattleSeriesGame {
  /** 1-based game number. */
  index: number;
  /** Server-side: seed of this game (derived from the series seed). */
  seed: BattleSeed;
  /** `null` while the game is still being played. */
  result: BattleResult | null;
  /** Server-side, omniscient: what is needed to reproduce this game. */
  replay: BattleReplay;
}

export interface BattleSeriesInfo {
  seriesId: string;
  bestOf: number;
  format: BattleFormatInfo;
  /** Series seed; per-game seeds are derived from it. Server-side only. */
  seed: BattleSeed;
}

export interface BattleSeries {
  readonly info: BattleSeriesInfo;
  getStatus(): BattleSeriesStatus;
  getScore(): BattleSeriesScore;
  /** `null` until the series is decided. */
  getResult(): BattleSeriesResult | null;
  getGames(): readonly BattleSeriesGame[];
  /** The game being played (or just finished, until the next one starts); `null` once the series is over. */
  currentGame(): BattleSession | null;
  /** Starts the next game on the same teams. Only valid once the current game finished. */
  startNextGame(): BattleSession;
}

const isValidBestOf = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 3 &&
  value <= 9 &&
  value % 2 === 1;

/** @internal Exported for tests. The series outcome after the given finished-game results. */
export function seriesOutcome(
  bestOf: number,
  results: readonly BattleResult[],
): { score: BattleSeriesScore; result: BattleSeriesResult | null } {
  const wins: Record<BattleSideId, number> = { p1: 0, p2: 0 };
  let ties = 0;
  for (const result of results) {
    if (result.kind === 'win') wins[result.winner]++;
    else ties++;
  }
  const score = { wins, ties, gamesPlayed: results.length };
  // Each tie lowers the wins needed, exactly like the simulator's best-of game.
  const winsNeeded = Math.floor((bestOf - ties) / 2) + 1;
  const leader = (['p1', 'p2'] as const).find((side) => wins[side] >= winsNeeded);
  if (leader) return { score, result: { kind: 'win', winner: leader } };
  return { score, result: results.length >= bestOf ? { kind: 'tie' } : null };
}

export function createBattleSeries(config: BattleSeriesConfig): BattleSeries {
  if (!isValidBestOf(config?.bestOf)) {
    throw battleError(
      'INVALID_CONFIG',
      { issues: ['bestOf must be an odd integer from 3 to 9'] },
      'Invalid series length',
    );
  }
  const { bestOf, seed: givenSeed, ...gameConfig } = config;
  let seriesSeed: string;
  let gameSeeds: string[];
  try {
    seriesSeed = givenSeed ?? generateSeed();
    gameSeeds = deriveGameSeeds(seriesSeed, bestOf);
  } catch (cause) {
    throw battleError(
      'INVALID_CONFIG',
      { issues: ['seed is not accepted by the simulator'] },
      'Invalid series seed',
      cause,
    );
  }
  const startGame = (index: number) => createBattle({ ...gameConfig, seed: gameSeeds[index]! });

  const sessions: BattleSession[] = [startGame(0)];
  const results: BattleResult[] = [];
  let outcome = seriesOutcome(bestOf, results);

  /** Folds the current game into the score once it has finished. */
  const sync = () => {
    const current = sessions.at(-1)!;
    if (results.length === sessions.length) return;
    const state = current.getState('omniscient');
    if (state.status !== 'finished' || !state.result) return;
    results.push(state.result);
    outcome = seriesOutcome(bestOf, results);
  };

  const first = sessions[0]!;
  return {
    info: Object.freeze({
      seriesId: randomUUID(),
      bestOf,
      format: first.info.format,
      seed: seriesSeed,
    }),
    getStatus() {
      sync();
      return outcome.result ? 'finished' : 'in-progress';
    },
    getScore() {
      sync();
      return {
        wins: { ...outcome.score.wins },
        ties: outcome.score.ties,
        gamesPlayed: outcome.score.gamesPlayed,
      };
    },
    getResult() {
      sync();
      return outcome.result ? { ...outcome.result } : null;
    },
    getGames() {
      sync();
      return sessions.map((_, i) => ({
        index: i + 1,
        seed: gameSeeds[i]!,
        result: results[i] ? { ...results[i]! } : null,
        replay: sessions[i]!.getReplay(),
      }));
    },
    currentGame() {
      sync();
      return outcome.result ? null : sessions.at(-1)!;
    },
    startNextGame() {
      sync();
      if (outcome.result) {
        throw battleError(
          'INVALID_SERIES_STATE',
          { reason: 'series-finished' },
          'The series is over',
        );
      }
      if (results.length < sessions.length) {
        throw battleError(
          'INVALID_SERIES_STATE',
          { reason: 'game-in-progress' },
          'The current game has not finished',
        );
      }
      const next = startGame(sessions.length);
      sessions.push(next);
      return next;
    },
  };
}
