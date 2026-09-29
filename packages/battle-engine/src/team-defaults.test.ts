import { Teams } from 'pokemon-showdown';
import { describe, expect, it } from 'vitest';

import { isBattleDomainError } from './errors';
import { createBattle, inputLogForTests } from './session';
import { CUSTOM_FORMAT, SEED, legalOuTeam, teamB } from './test/fixtures';
import type { BattleSession, BattleTeamMemberInput } from './types';

const lead = (
  member: BattleTeamMemberInput,
  formatId = CUSTOM_FORMAT,
  seed = SEED,
): BattleSession =>
  createBattle({
    formatId,
    seed,
    sides: {
      p1: { displayName: 'A', team: { members: [member] } },
      p2: { displayName: 'B', team: teamB },
    },
  });

const garchomp = (extra: Partial<BattleTeamMemberInput> = {}): BattleTeamMemberInput => ({
  species: 'Garchomp',
  ability: 'Rough Skin',
  moves: ['Earthquake'],
  ...extra,
});

const ownMember = (session: BattleSession) => session.getState('p1').sides.p1.team[0]!;

/** The packed team the simulator actually received for p1. */
const packedFor = (session: BattleSession) => {
  const line = inputLogForTests(session).find((l) => l.startsWith('>player p1 '))!;
  const packed = (JSON.parse(line.slice('>player p1 '.length)) as { team: string }).team;
  return Teams.unpack(packed)![0]!;
};

describe('gender: unspecified is not genderless', () => {
  it('variable-gender species with gender omitted is resolved by the simulator to M or F', () => {
    const member = ownMember(lead(garchomp()));
    expect(['M', 'F']).toContain(member.gender);
    expect(packedFor(lead(garchomp())).gender ?? '').toBe(''); // the simulator got "unspecified", not 'N'
  });

  it('resolves deterministically for a given seed', () => {
    expect(ownMember(lead(garchomp())).gender).toBe(ownMember(lead(garchomp())).gender);
  });

  it('respects an explicit M or F', () => {
    expect(ownMember(lead(garchomp({ gender: 'M' }))).gender).toBe('M');
    expect(ownMember(lead(garchomp({ gender: 'F' }))).gender).toBe('F');
    expect(packedFor(lead(garchomp({ gender: 'F' }))).gender).toBe('F');
  });

  it('a genuinely genderless species is genderless, whether omitted or explicit', () => {
    const magnemite = { species: 'Magnemite', ability: 'Magnet Pull', moves: ['Thunderbolt'] };
    expect(ownMember(lead(magnemite)).gender).toBe('N');
    expect(ownMember(lead({ ...magnemite, gender: 'N' })).gender).toBe('N');
  });

  it('fixed-gender species keep their gender when omitted (not turned genderless)', () => {
    expect(
      ownMember(lead({ species: 'Tauros', ability: 'Intimidate', moves: ['Earthquake'] })).gender,
    ).toBe('M');
    expect(
      ownMember(lead({ species: 'Blissey', ability: 'Natural Cure', moves: ['Softboiled'] }))
        .gender,
    ).toBe('F');
  });

  it('holds in a tiered format too (genderless and fixed-gender species from omitted input)', () => {
    const session = createBattle({
      formatId: 'gen9ou',
      seed: SEED,
      sides: {
        p1: { displayName: 'A', team: legalOuTeam },
        p2: { displayName: 'B', team: legalOuTeam },
      },
    });
    const team = session.getState('p1').sides.p1.team;
    expect(team.map((m) => [m.species, m.gender])).toEqual([
      ['Gholdengo', 'N'],
      ['Kingambit', 'M'],
    ]);
  });

  it('the rival sees the resolved gender only through the public switch-in details', () => {
    const session = lead(garchomp({ gender: 'F' }));
    session.submitChoice('p1', { kind: 'team-order', order: [0] });
    session.submitChoice('p2', { kind: 'team-order', order: [0, 1] });
    expect(session.getState('p2').sides.p1.active[0]?.gender).toBe('F');
  });
});

describe('omitted optional fields use the simulator defaults', () => {
  it('evs omitted → the simulator fill rule; an explicit table is used as given', () => {
    const omitted = ownMember(lead(garchomp()));
    const zero = ownMember(lead(garchomp({ evs: {} })));
    const hp = (m: typeof omitted) => (m.hp.kind === 'exact' ? m.hp.max : -1);
    expect(hp(zero)).toBe(357); // base 108, 31 IV, 0 EV, level 100
    expect(hp(omitted)).toBe(420); // customgame has no EV limit, so the simulator fills 252
  });

  it('a partial evs/ivs table completes the missing stats with 0 / 31', () => {
    const member = ownMember(lead(garchomp({ evs: { hp: 252 }, ivs: { hp: 0 } })));
    // (2*108 + 0 IV + 252/4 EV) + 110 at level 100 = 389; other stats are unaffected by the partial table.
    expect(member.hp).toEqual({ kind: 'exact', current: 389, max: 389 });
  });

  it('level omitted → format default; explicit level respected', () => {
    expect(ownMember(lead(garchomp())).level).toBe(100);
    expect(ownMember(lead(garchomp({ level: 50 }))).level).toBe(50);
  });

  it("teraType omitted → the species' first type; explicit respected", () => {
    expect(ownMember(lead(garchomp())).teraType).toBe('Dragon');
    expect(ownMember(lead(garchomp({ teraType: 'Fire' }))).teraType).toBe('Fire');
  });

  it('nature and item omitted are accepted (neutral nature, no item)', () => {
    const member = ownMember(lead(garchomp()));
    expect(member.item).toBeNull();
  });

  it('an EV-limited tiered format rejects an all-omitted spread: that is legality, not an adapter default', () => {
    try {
      createBattle({
        formatId: 'gen9ou',
        sides: {
          p1: { displayName: 'A', team: { members: [garchomp()] } },
          p2: { displayName: 'B', team: { members: [garchomp()] } },
        },
      });
      throw new Error('should reject');
    } catch (error) {
      expect(isBattleDomainError(error, 'INVALID_TEAM')).toBe(true);
    }
  });
});
