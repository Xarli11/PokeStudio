import { describe, expect, it } from 'vitest';

import { BattleDomainError } from './errors';
import { createBattleSeries, seriesOutcome } from './series';
import type { BattleSeriesConfig } from './series';
import { championsBssTeam, legalOuTeam } from './test/fixtures';
import { playToEnd } from './test/helpers';
import type { BattleResult } from './types';

const P1: BattleResult = { kind: 'win', winner: 'p1' };
const P2: BattleResult = { kind: 'win', winner: 'p2' };
const TIE: BattleResult = { kind: 'tie' };

describe('seriesOutcome follows the simulator best-of rules', () => {
  it.each([
    ['bo3: 2-0 ends it', 3, [P1, P1], { kind: 'win', winner: 'p1' }],
    ['bo3: 1-1 goes on', 3, [P1, P2], null],
    ['bo3: 2-1 to p2', 3, [P1, P2, P2], { kind: 'win', winner: 'p2' }],
    ['bo3: nothing played', 3, [], null],
    ['bo3: a win and a tie leave it open', 3, [P1, TIE], null],
    ['bo3: win then tie then win', 3, [P1, TIE, P1], { kind: 'win', winner: 'p1' }],
    ['bo3: tie, tie then a win decides it', 3, [TIE, TIE, P2], { kind: 'win', winner: 'p2' }],
    ['bo3: two ties leave one win enough', 3, [TIE, TIE], null],
    ['bo3: undecided after 3 games is a tie', 3, [P1, P2, TIE], { kind: 'tie' }],
    ['bo3: three ties is a tie', 3, [TIE, TIE, TIE], { kind: 'tie' }],
    ['bo5: needs 3', 5, [P1, P1, P2, P2], null],
    ['bo5: 3-2', 5, [P1, P2, P1, P2, P1], { kind: 'win', winner: 'p1' }],
    ['bo5: one tie keeps the bar at 3 wins', 5, [P2, TIE, P2], null],
    [
      'bo5: with a tie, three wins still decide it',
      5,
      [P2, TIE, P2, P2],
      { kind: 'win', winner: 'p2' },
    ],
  ] as const)('%s', (_label, bestOf, results, expected) => {
    expect(seriesOutcome(bestOf, results).result).toEqual(expected);
  });

  it('reports the score', () => {
    expect(seriesOutcome(5, [P1, TIE, P2, P1]).score).toEqual({
      wins: { p1: 2, p2: 1 },
      ties: 1,
      gamesPlayed: 4,
    });
  });
});

const config = (over: Partial<BattleSeriesConfig> = {}): BattleSeriesConfig => ({
  formatId: 'sv-ou',
  bestOf: 3,
  seed: 'gen5,0001000200030004',
  sides: {
    p1: { displayName: 'Ash', team: legalOuTeam },
    p2: { displayName: 'Gary', team: legalOuTeam },
  },
  ...over,
});

function playSeries(series: ReturnType<typeof createBattleSeries>) {
  const finished: unknown[] = [];
  for (let guard = 0; guard < 12 && series.currentGame(); guard++) {
    const game = series.currentGame()!;
    playToEnd(game, undefined, 600);
    finished.push(game.getEvents('omniscient'));
    if (series.getStatus() === 'finished') break;
    series.startNextGame();
  }
  return finished;
}

describe('BattleSeries', () => {
  it.each([2, 4, 1, 11, 0, -3, 3.5, '3', undefined, null])('rejects bestOf %j', (bestOf) => {
    try {
      createBattleSeries(config({ bestOf: bestOf as never }));
      throw new Error('should reject');
    } catch (error) {
      expect(error).toBeInstanceOf(BattleDomainError);
      expect((error as BattleDomainError).code).toBe('INVALID_CONFIG');
    }
  });

  it('rejects a bad seed and an unsupported format like a single battle does', () => {
    expect(() => createBattleSeries(config({ seed: 'nope' }))).toThrowError(BattleDomainError);
    expect(() => createBattleSeries(config({ formatId: 'gen9ou' as never }))).toThrowError(
      BattleDomainError,
    );
  });

  it('starts game 1 immediately on the format, with the same teams for every game', () => {
    const series = createBattleSeries(config());
    expect(series.info).toMatchObject({ bestOf: 3, format: { id: 'sv-ou' } });
    expect(series.getStatus()).toBe('in-progress');
    expect(series.getScore()).toEqual({ wins: { p1: 0, p2: 0 }, ties: 0, gamesPlayed: 0 });
    expect(series.getResult()).toBeNull();
    const game = series.currentGame()!;
    expect(game.getState('omniscient').status).toBe('awaiting-choices');
    expect(game.getState('p1').sides.p1.team.map((p) => p.species)).toEqual([
      'Gholdengo',
      'Kingambit',
    ]);
    expect(series.getGames()).toEqual([
      { index: 1, seed: expect.any(String), result: null, replay: expect.any(Object) },
    ]);
  });

  it('cannot start the next game while the current one is being played', () => {
    const series = createBattleSeries(config());
    try {
      series.startNextGame();
      throw new Error('should reject');
    } catch (error) {
      expect((error as BattleDomainError).code).toBe('INVALID_SERIES_STATE');
      expect((error as BattleDomainError).details).toEqual({ reason: 'game-in-progress' });
    }
  });

  it('plays to a decided series, scores each game and then refuses more games', () => {
    const series = createBattleSeries(config());
    playSeries(series);
    expect(series.getStatus()).toBe('finished');
    const score = series.getScore();
    const games = series.getGames();
    expect(games.length).toBeGreaterThanOrEqual(2);
    expect(games.length).toBeLessThanOrEqual(3);
    expect(games.every((g) => g.result !== null)).toBe(true);
    expect(score.gamesPlayed).toBe(games.length);
    expect(score.wins.p1 + score.wins.p2 + score.ties).toBe(games.length);
    const result = series.getResult()!;
    expect(result.kind).toBe('win');
    if (result.kind === 'win') expect(score.wins[result.winner]).toBe(2);
    expect(series.currentGame()).toBeNull();
    try {
      series.startNextGame();
      throw new Error('should reject');
    } catch (error) {
      expect((error as BattleDomainError).details).toEqual({ reason: 'series-finished' });
    }
  });

  it('is reproducible from the series seed, with a distinct derived seed for every game', () => {
    const run = () => {
      const series = createBattleSeries(config());
      const events = playSeries(series);
      return { events, games: series.getGames(), result: series.getResult() };
    };
    const [a, b] = [run(), run()];
    expect(b).toEqual(a);
    const seeds = createBattleSeries(config())
      .getGames()
      .map((g) => g.seed);
    expect(new Set(a.games.map((g) => g.seed)).size).toBe(a.games.length);
    expect(seeds[0]).toBe(a.games[0]!.seed);
    // A different series seed gives a different series.
    const other = createBattleSeries(config({ seed: 'gen5,0009000200030004' })).getGames()[0]!.seed;
    expect(other).not.toBe(a.games[0]!.seed);
  });

  it('without a seed it generates one and exposes it server-side only', () => {
    const series = createBattleSeries(config({ seed: undefined as never }));
    expect(series.info.seed).toMatch(/^sodium,/);
    for (const perspective of ['p1', 'p2', 'spectator', 'omniscient'] as const) {
      expect(JSON.stringify(series.currentGame()!.getState(perspective))).not.toContain(
        series.info.seed,
      );
    }
  });

  it('does not let the score outrun the games: a finished game is only counted once', () => {
    const series = createBattleSeries(config());
    playToEnd(series.currentGame()!, undefined, 600);
    const once = series.getScore();
    expect(series.getScore()).toEqual(once);
    expect(series.getGames().filter((g) => g.result).length).toBe(1);
  });

  it('a VGC best-of-three is a series of real VGC games with Open Team Sheets every game', () => {
    const series = createBattleSeries({
      formatId: 'champions-vgc-reg-mb',
      bestOf: 3,
      seed: 'gen5,0001000200030004',
      sides: {
        p1: { displayName: 'Ash', team: championsBssTeam },
        p2: { displayName: 'Gary', team: championsBssTeam },
      },
    });
    expect(series.info.format).toMatchObject({ id: 'champions-vgc-reg-mb', openTeamSheets: true });
    for (let guard = 0; guard < 6 && series.currentGame(); guard++) {
      const game = series.currentGame()!;
      expect(game.getState('p1').sides.p2.team.every((p) => p.item !== undefined)).toBe(true);
      expect(game.getLegalChoices('p1')).toMatchObject({ kind: 'team-preview', pick: 4, of: 6 });
      playToEnd(game, undefined, 800);
      if (series.getStatus() === 'finished') break;
      series.startNextGame();
    }
    expect(series.getStatus()).toBe('finished');
    expect(series.getResult()?.kind).toBe('win');
  });
});
