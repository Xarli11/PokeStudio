import { describe, expect, it } from 'vitest';

import { newBattle, startTurnOne } from './test/helpers';
import type { BattleCommand, BattlePerspective, BattleSession, BattleTeamInput } from './types';

// Sentinels: strings that occur nowhere else in fixtures, engine output or PokeStudio text.
const SENTINEL_MOVE = 'fissure';
const SENTINEL_ITEM = 'lifeorb';
const SENTINEL_ABILITY = 'intimidate';
const SEED_TEXT = 'gen5,0001000200030004';

const p1Team: BattleTeamInput = {
  members: [
    {
      species: 'Dragonite',
      ability: 'Multiscale',
      moves: ['Extreme Speed', 'Roost'],
      item: 'Heavy-Duty Boots',
    },
    {
      species: 'Gholdengo',
      ability: 'Good as Gold',
      moves: ['Shadow Ball', 'Recover'],
      item: 'Leftovers',
    },
  ],
};

const p2Team: BattleTeamInput = {
  members: [
    {
      species: 'Gyarados',
      nickname: 'Splashy',
      ability: 'Intimidate',
      item: 'Life Orb',
      moves: ['Waterfall', 'Fissure', 'Dragon Dance', 'Earthquake'],
    },
    {
      species: 'Corviknight',
      ability: 'Pressure',
      moves: ['Brave Bird', 'Roost'],
      item: 'Rocky Helmet',
    },
  ],
};

const act = (side: 'p1' | 'p2', moveId: string): BattleCommand => ({
  kind: 'actions',
  actions: [{ kind: 'move', slot: { side, position: 0 }, moveId }],
});

const dump = (session: BattleSession, perspective: BattlePerspective) =>
  JSON.stringify([session.getState(perspective), session.getEvents(perspective)]);

const leaks = (text: string) =>
  [SENTINEL_MOVE, SENTINEL_ITEM, SENTINEL_ABILITY].filter((word) =>
    text.toLowerCase().includes(word),
  );

describe('hidden information (sentinel leak tests)', () => {
  it('before anything is revealed, no rival secret is visible to p1 or spectators', () => {
    const session = newBattle({ p1: p1Team, p2: p2Team });
    for (const perspective of ['p1', 'spectator'] as const) {
      expect(leaks(dump(session, perspective))).toEqual([]);
    }
    // ...while p2 sees its own, and omniscient sees everything.
    expect(leaks(dump(session, 'p2')).sort()).toEqual(
      [SENTINEL_ABILITY, SENTINEL_ITEM, SENTINEL_MOVE].sort(),
    );
    expect(leaks(dump(session, 'omniscient')).sort()).toEqual(
      [SENTINEL_ABILITY, SENTINEL_ITEM, SENTINEL_MOVE].sort(),
    );
  });

  it('reveals exactly what the battle reveals, and only from then on', () => {
    const session = newBattle({ p1: p1Team, p2: p2Team });
    startTurnOne(session);

    // Switch-in revealed Intimidate (a public message) — and nothing else yet.
    let rival = session.getState('p1').sides.p2.active[0]!;
    expect(rival.species).toBe('Gyarados');
    expect(rival.ability).toBe(SENTINEL_ABILITY);
    expect(rival.revealed).toEqual({ ability: true, item: false, moves: [] });
    expect(leaks(dump(session, 'p1'))).toEqual([SENTINEL_ABILITY]);
    expect(leaks(dump(session, 'spectator'))).toEqual([SENTINEL_ABILITY]);

    // Turn 1: p2 uses Waterfall (revealed) and Life Orb recoil reveals the item; Fissure stays hidden.
    session.submitChoice('p1', act('p1', 'roost'));
    session.submitChoice('p2', act('p2', 'waterfall'));
    rival = session.getState('p1').sides.p2.active[0]!;
    expect(rival.revealed.moves).toEqual(['waterfall']);
    expect(rival.moves).toEqual([{ id: 'waterfall' }]);
    expect(rival.revealed.item).toBe(true);
    expect(rival.item).toBe(SENTINEL_ITEM);
    expect(leaks(dump(session, 'p1')).sort()).toEqual([SENTINEL_ABILITY, SENTINEL_ITEM].sort());
    expect(dump(session, 'p1')).not.toContain(SENTINEL_MOVE);
    expect(dump(session, 'spectator')).not.toContain(SENTINEL_MOVE);

    // The owner and omniscient still see the full moveset.
    const own = session.getState('p2').sides.p2.active[0]!;
    expect(own.moves?.map((m) => m.id)).toContain(SENTINEL_MOVE);
    expect(dump(session, 'omniscient')).toContain(SENTINEL_MOVE);
  });

  it("shows the rival's HP as a percentage and hides the bench it has not shown", () => {
    const session = newBattle({ formatId: 'gen9customgame', p1: p1Team, p2: p2Team });
    startTurnOne(session);
    session.submitChoice('p1', act('p1', 'extremespeed'));
    session.submitChoice('p2', act('p2', 'waterfall'));

    const asP1 = session.getState('p1');
    expect(asP1.sides.p1.active[0]?.hp.kind).toBe('exact');
    expect(asP1.sides.p2.active[0]?.hp.kind).toBe('percent');
    expect(session.getState('spectator').sides.p1.active[0]?.hp.kind).toBe('percent');
    expect(session.getState('omniscient').sides.p2.active[0]?.hp.kind).toBe('exact');

    // The rival's unrevealed teammate has no per-Pokémon info beyond what was announced.
    const rivalTeam = asP1.sides.p2.team;
    for (const pokemon of rivalTeam) {
      expect(pokemon.types).toBeUndefined();
      expect(pokemon.teraType).toBeUndefined();
    }
  });

  it('exposes requests only as each perspective is entitled to see them', () => {
    const session = newBattle();
    expect(Object.keys(session.getState('p1').requests)).toEqual(['p1']);
    expect(Object.keys(session.getState('p2').requests)).toEqual(['p2']);
    expect(session.getState('spectator').requests).toEqual({});
    expect(Object.keys(session.getState('omniscient').requests).sort()).toEqual(['p1', 'p2']);
  });

  it('never puts the seed in any state or event, but keeps it on info', () => {
    const session = newBattle({ seed: SEED_TEXT });
    startTurnOne(session);
    for (const perspective of ['p1', 'p2', 'spectator', 'omniscient'] as const) {
      expect(dump(session, perspective)).not.toContain('gen5,');
      expect(dump(session, perspective)).not.toContain(SEED_TEXT);
    }
    expect(session.info.seed).toBe(SEED_TEXT);
  });

  it('is explicit: perspective is a required argument', () => {
    const session = newBattle();
    // @ts-expect-error there is no default perspective
    expect(() => session.getState()).toThrow();
  });

  it('a nickname is not public until the Pokémon switches in (team preview shows species only)', () => {
    const session = newBattle({
      p1: p1Team,
      p2: {
        members: [
          {
            species: 'Gyarados',
            nickname: 'LeadName',
            ability: 'Intimidate',
            moves: ['Waterfall'],
          },
          {
            species: 'Corviknight',
            nickname: 'BenchSecret',
            ability: 'Pressure',
            moves: ['Roost'],
          },
        ],
      },
    });
    for (const perspective of ['p1', 'spectator'] as const) {
      const rival = session.getState(perspective).sides.p2.team;
      expect(rival.map((p) => p.species)).toEqual(['Gyarados', 'Corviknight']); // preview shows species
      expect(dump(session, perspective)).not.toMatch(/LeadName|BenchSecret/);
    }
    expect(dump(session, 'p2')).toContain('BenchSecret'); // the owner always sees it
    startTurnOne(session);
    const afterLead = session.getState('p1').sides.p2.team;
    expect(afterLead.find((p) => p.species === 'Gyarados')?.nickname).toBe('LeadName');
    expect(dump(session, 'p1')).not.toContain('BenchSecret');
    expect(dump(session, 'spectator')).not.toContain('BenchSecret');
  });

  it('never shows rival PP, max PP or disabled flags, even for revealed moves', () => {
    const session = newBattle({ p1: p1Team, p2: p2Team });
    startTurnOne(session);
    session.submitChoice('p1', act('p1', 'roost'));
    session.submitChoice('p2', act('p2', 'waterfall'));
    const revealed = session.getState('p1').sides.p2.active[0]!.moves!;
    expect(revealed).toEqual([{ id: 'waterfall' }]);
    expect(Object.keys(revealed[0]!)).toEqual(['id']);
  });

  it('without team preview, unrevealed rival Pokémon are absent until they switch in', () => {
    const session = newBattle({
      formatId: 'gen4customgame',
      p1: p1Team,
      p2: {
        members: [
          { species: 'Dragonite', ability: 'Inner Focus', moves: ['Outrage'] },
          {
            species: 'Gyarados',
            nickname: 'HiddenBench',
            ability: 'Intimidate',
            moves: ['Waterfall'],
          },
        ],
      },
    });
    expect(session.getState('p1').turn).toBe(1); // no preview: battle starts at once
    const seen = session.getState('p1').sides.p2;
    expect(seen.team.map((p) => p.species)).toEqual(['Dragonite']);
    expect(seen.teamSize).toBe(2); // the count is public
    expect(dump(session, 'p1')).not.toMatch(/Gyarados|HiddenBench/);
    expect(dump(session, 'spectator')).not.toMatch(/Gyarados|HiddenBench/);
    expect(dump(session, 'omniscient')).toContain('Gyarados');
  });
});
