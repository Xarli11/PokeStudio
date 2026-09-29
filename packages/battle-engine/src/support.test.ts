import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BattleDomainError } from './errors';
import { getBattleDisplayNames, importTeamText } from './index';
import { createBattle } from './session';

describe('display names for ids in state and events', () => {
  const names = getBattleDisplayNames();

  it('maps simulator ids to readable names', () => {
    expect(names.moves['dragonclaw']).toBe('Dragon Claw');
    expect(names.moves['willowisp']).toBe('Will-O-Wisp');
    expect(names.abilities['roughskin']).toBe('Rough Skin');
    expect(names.items['lifeorb']).toBe('Life Orb');
    expect(names.conditions['stealthrock']).toBe('Stealth Rock');
    expect(names.conditions['substitute']).toBe('Substitute');
  });

  it('is memoized and read-only', () => {
    expect(getBattleDisplayNames()).toBe(names);
    expect(Object.isFrozen(names)).toBe(true);
    expect(Object.isFrozen(names.moves)).toBe(true);
  });

  it('covers every id the engine can put in a state or a trace', () => {
    // Each catalog format runs a real battle elsewhere; here check the ids that battle produces.
    const session = createBattle({
      formatId: 'sv-doubles-ou',
      seed: 'gen5,0001000200030004',
      sides: {
        p1: { displayName: 'A', team: importTeamText(PASTE) },
        p2: { displayName: 'B', team: importTeamText(PASTE) },
      },
    });
    const ids = new Set(
      session
        .getState('p1')
        .sides.p1.team.flatMap((p) => [
          ...(p.moves?.map((m) => m.id) ?? []),
          ...(p.ability ? [p.ability] : []),
          ...(p.item ? [p.item] : []),
        ]),
    );
    expect(ids.size).toBeGreaterThan(4);
    for (const id of ids) {
      expect(id in names.moves || id in names.abilities || id in names.items, id).toBe(true);
    }
  });
});

const PASTE = `Garchomp @ Life Orb
Ability: Rough Skin
EVs: 4 HP / 252 Atk / 252 Spe
Jolly Nature
- Earthquake
- Dragon Claw
- Protect
- Rock Slide

Chompy (Rotom-Wash) (F) @ Leftovers
Ability: Levitate
EVs: 252 HP / 252 Def / 4 SpA
Bold Nature
Tera Type: Steel
- Hydro Pump
- Volt Switch
- Will-O-Wisp
- Helping Hand
`;

describe('team text import', () => {
  it('reads the common export format into the neutral team input', () => {
    const team = importTeamText(PASTE);
    expect(team.members).toHaveLength(2);
    expect(team.members[0]).toMatchObject({
      species: 'Garchomp',
      item: 'Life Orb',
      ability: 'Rough Skin',
      nature: 'Jolly',
      evs: { hp: 4, atk: 252, spe: 252 },
      moves: ['Earthquake', 'Dragon Claw', 'Protect', 'Rock Slide'],
    });
    expect(team.members[1]).toMatchObject({
      species: 'Rotom-Wash',
      nickname: 'Chompy',
      gender: 'F',
      teraType: 'Steel',
    });
    expect(team.members[0]!.nickname).toBeUndefined();
  });

  it('produces a team the engine accepts (parsing is not legality)', () => {
    const team = importTeamText(PASTE);
    const session = createBattle({
      formatId: 'sv-doubles-ou',
      sides: { p1: { displayName: 'A', team }, p2: { displayName: 'B', team } },
    });
    expect(session.getState('p1').sides.p1.team.map((p) => p.species)).toEqual([
      'Garchomp',
      'Rotom-Wash',
    ]);
    expect(session.getState('p1').sides.p1.team[1]?.nickname).toBe('Chompy');
  });

  it.each([undefined, null, 42, '', '   ', 'this is not a team', 'x'.repeat(30_000)])(
    'rejects unreadable or oversized input %j',
    (text) => {
      try {
        importTeamText(text);
        throw new Error('should reject');
      } catch (error) {
        expect(error).toBeInstanceOf(BattleDomainError);
        expect((error as BattleDomainError).code).toBe('INVALID_CONFIG');
      }
    },
  );

  it('the package exposes pure-data subpaths that never load the simulator', () => {
    const exportsMap = (
      JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as {
        exports: Record<string, string>;
      }
    ).exports;
    expect(Object.keys(exportsMap).sort()).toEqual(['.', './formats', './types']);
    for (const path of [exportsMap['./formats']!, exportsMap['./types']!]) {
      const source = readFileSync(join(__dirname, '..', path), 'utf8');
      expect(source).not.toMatch(/from 'pokemon-showdown'|from '\.\/(session|showdown)/);
      expect(source).not.toMatch(/^import (?!type)/m);
    }
  });
});
