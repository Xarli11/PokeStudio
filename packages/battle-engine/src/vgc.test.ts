import { describe, expect, it } from 'vitest';

import { BattleDomainError } from './errors';
import { createBattle, createBattleForTests } from './session';
import { championsBssTeam, doublesTeam } from './test/fixtures';
import { playToEnd } from './test/helpers';
import type { BattlePerspective, BattleSession, BattleTeamInput } from './types';

const SEED = 'gen5,0001000200030004';

const nicknamed = (team: BattleTeamInput, prefix: string): BattleTeamInput => ({
  members: team.members.map((member, i) => ({ ...member, nickname: `${prefix}${i}` })),
});

const vgc = (over: { p1?: BattleTeamInput; p2?: BattleTeamInput; seed?: string } = {}) =>
  createBattle({
    formatId: 'champions-vgc-reg-mb',
    seed: over.seed ?? SEED,
    sides: {
      p1: { displayName: 'Ash', team: over.p1 ?? nicknamed(championsBssTeam, 'Mine') },
      p2: { displayName: 'Gary', team: over.p2 ?? nicknamed(championsBssTeam, 'Rival') },
    },
  });

const dump = (session: BattleSession, perspective: BattlePerspective) =>
  JSON.stringify([session.getState(perspective), session.getEvents(perspective)]);

describe('champions-vgc-reg-mb: a real VGC format', () => {
  it('is available and describes itself structurally, including Open Team Sheets', () => {
    const session = vgc();
    expect(session.getState('p1').format).toEqual({
      id: 'champions-vgc-reg-mb',
      name: '[Gen 9 Champions] VGC 2026 Reg M-B',
      generation: 9,
      gameType: 'doubles',
      category: 'vgc',
      family: 'champions',
      openTeamSheets: true,
    });
    expect(session.info.engineFormatId).toBe('gen9championsvgc2026regmb');
  });

  it('registers 6, brings 4 at level 50, plays Doubles to finished, deterministically', () => {
    const run = (seed: string) => {
      const session = vgc({ seed });
      expect(session.getLegalChoices('p1')).toEqual({
        kind: 'team-preview',
        side: 'p1',
        pick: 4,
        of: 6,
      });
      const played = playToEnd(session, undefined, 800);
      const state = session.getState('omniscient');
      expect(state.status).toBe('finished');
      expect(state.sides.p1.teamSize).toBe(4);
      expect(state.sides.p1.team.every((p) => p.level === 50)).toBe(true);
      expect(state.sides.p1.active).toHaveLength(2);
      expect(played.kinds.has('team-preview') && played.kinds.has('move')).toBe(true);
      return { result: state.result, events: session.getEvents('omniscient') };
    };
    const first = run(SEED);
    expect(first.result).toMatchObject({ kind: 'win' });
    expect(run(SEED)).toEqual(first);
    expect(run('gen5,0009000200030004').events).not.toEqual(first.events);
  });

  it('validates the pick: exactly 4 distinct Pokémon, leads first, refs keep the original team index', () => {
    const session = vgc();
    for (const bad of [
      [0, 1, 2],
      [0, 1, 2, 3, 4],
      [0, 0, 1, 2],
      [0, 1, 2, 9],
    ]) {
      try {
        session.submitChoice('p1', { kind: 'team-order', order: bad });
        throw new Error('should reject');
      } catch (error) {
        expect(error).toBeInstanceOf(BattleDomainError);
        expect((error as BattleDomainError).details).toMatchObject({
          reason: 'invalid-team-order',
        });
      }
    }
    session.submitChoice('p1', { kind: 'team-order', order: [5, 2, 0, 1] });
    session.submitChoice('p2', { kind: 'team-order', order: [3, 4, 1, 0] });
    const state = session.getState('omniscient');
    expect(state.sides.p1.active.map((p) => p?.ref.teamIndex)).toEqual([5, 2]);
    expect(state.sides.p2.active.map((p) => p?.ref.teamIndex)).toEqual([3, 4]);
    expect(state.sides.p1.team.map((p) => p.ref.teamIndex).sort()).toEqual([0, 1, 2, 5]);
  });

  it('rejects Stat Points over the Champions limit', () => {
    const over: BattleTeamInput = {
      members: championsBssTeam.members.map((m) => ({ ...m, evs: { atk: 252 } })),
    };
    expect(() => vgc({ p1: over })).toThrowError(BattleDomainError);
  });
});

describe('Open Team Sheets: exactly what the simulator publishes', () => {
  it("shows every rival Pokémon's species, item, ability and moves from the start (Tera type only where the format has Tera)", () => {
    const session = vgc();
    for (const perspective of ['p1', 'spectator'] as const) {
      const rival = session.getState(perspective).sides.p2.team;
      expect(rival).toHaveLength(6);
      expect(rival.map((p) => p.species)).toEqual([
        'Garchomp',
        'Rotom-Wash',
        'Kingambit',
        'Dragonite',
        'Corviknight',
        'Pelipper',
      ]);
      for (const [index, pokemon] of rival.entries()) {
        const set = championsBssTeam.members[index]!;
        expect(pokemon.item).toBe(set.item!.toLowerCase().replace(/[^a-z0-9]/g, ''));
        expect(pokemon.ability).toBe(set.ability.toLowerCase().replace(/[^a-z0-9]/g, ''));
        expect(pokemon.moves?.map((m) => m.id).sort()).toEqual(
          set.moves.map((m) => m.toLowerCase().replace(/[^a-z0-9]/g, '')).sort(),
        );
        expect(pokemon.revealed).toMatchObject({ ability: true, item: true });
        expect(pokemon.revealed.moves).toHaveLength(4);
        expect(pokemon.level).toBe(50);
        // Champions has a Terastal clause, so the simulator's sheet carries no Tera type.
        expect(pokemon.teraType).toBeUndefined();
        // Moves are known by name only: no PP.
        expect(pokemon.moves?.every((m) => Object.keys(m).join() === 'id')).toBe(true);
      }
    }
  });

  it('does not reveal nicknames, stat spreads, HP numbers or the chosen leads', () => {
    const session = vgc();
    for (const perspective of ['p1', 'spectator'] as const) {
      const text = dump(session, perspective);
      expect(text).not.toMatch(/Rival\d/); // nicknames stay private until switch-in
      // The owner sees their own spreads (privateDetails); the rival's side never carries any.
      const rivalText = JSON.stringify(session.getState(perspective).sides.p2);
      expect(rivalText).not.toMatch(/"evs"|"ivs"|"stats"|statPoints|privateDetails|nature/i);
      if (perspective === 'spectator') expect(text).not.toMatch(/"evs"|"ivs"|"stats"|statPoints/i);
    }
    // p1 submits its picks; p2 (and spectators) learn nothing about them yet.
    session.submitChoice('p1', { kind: 'team-order', order: [5, 4, 3, 2] });
    for (const perspective of ['p2', 'spectator'] as const) {
      const p1 = session.getState(perspective).sides.p1;
      expect(p1.active).toEqual([null, null]);
      expect(JSON.stringify(session.getEvents(perspective))).not.toContain('switched');
    }
    // The rival's own view of its picks never leaks through p1's state either.
    expect(session.getState('p1').sides.p2.active).toEqual([null, null]);
    // Once leads enter, only those nicknames become public.
    session.submitChoice('p2', { kind: 'team-order', order: [1, 0, 2, 3] });
    const text = dump(session, 'p1');
    expect(text).toContain('Rival1');
    expect(text).toContain('Rival0');
    expect(text).not.toContain('Rival4');
  });

  it('keeps everything else about the rival hidden: exact HP and the Pokémon it keeps in the back', () => {
    const session = vgc();
    expect(session.getState('p1').sides.p2.team.every((p) => p.hp.kind === 'percent')).toBe(true);
    expect(session.getState('p1').sides.p1.team.every((p) => p.hp.kind === 'exact')).toBe(true);
  });

  it('a format without Open Team Sheets still reveals only what the battle shows', () => {
    const session = createBattle({
      formatId: 'sv-doubles-ou',
      seed: SEED,
      sides: {
        p1: { displayName: 'A', team: doublesTeam },
        p2: { displayName: 'B', team: doublesTeam },
      },
    });
    expect(session.getState('p1').format.openTeamSheets).toBe(false);
    for (const pokemon of session.getState('p1').sides.p2.team) {
      expect(pokemon.item).toBeUndefined();
      expect(pokemon.moves).toBeUndefined();
      expect(pokemon.teraType).toBeUndefined();
    }
  });

  it('sheets published by a format that forces them appear without any extra step (Bo3 variant)', () => {
    const session = createBattleForTests({
      formatId: 'gen9championsvgc2026regmbbo3',
      seed: SEED,
      sides: {
        p1: { displayName: 'A', team: championsBssTeam },
        p2: { displayName: 'B', team: championsBssTeam },
      },
    });
    expect(session.getState('p1').format.openTeamSheets).toBe(true);
    expect(session.getState('p1').sides.p2.team.every((p) => p.item !== undefined)).toBe(true);
  });

  it('does not make the omniscient/own views differ in what they own: own data is unchanged', () => {
    const session = vgc();
    const own = session.getState('p1').sides.p1.team;
    expect(
      own.every((p) => p.hp.kind === 'exact' && p.moves?.every((m) => m.pp !== undefined)),
    ).toBe(true);
  });

  it('publishes the Tera type when the format has Terastallization (Scarlet/Violet VGC, internal path)', () => {
    const session = createBattleForTests({
      formatId: 'gen9vgc2025regi',
      seed: SEED,
      sides: {
        p1: { displayName: 'A', team: doublesTeam },
        p2: { displayName: 'B', team: doublesTeam },
      },
    });
    const rival = session.getState('p1').sides.p2.team;
    expect(rival[0]?.teraType).toBe('Dragon'); // Garchomp's default Tera type
    expect(rival.every((p) => typeof p.teraType === 'string' && p.item !== undefined)).toBe(true);
  });
});
