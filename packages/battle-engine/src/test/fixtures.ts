import type { BattleTeamInput, BattleTeamMemberInput } from '../types';

export const CUSTOM_FORMAT = 'gen9customgame';
export const SEED = 'gen5,0001000200030004';

const member = (
  species: string,
  ability: string,
  moves: string[],
  extra: Partial<BattleTeamMemberInput> = {},
): BattleTeamMemberInput => ({ species, ability, moves, ...extra });

/** Two sturdy attackers. `gen9customgame` skips tier legality but still checks data existence. */
export const teamA: BattleTeamInput = {
  members: [
    member('Garchomp', 'Rough Skin', ['Earthquake', 'Dragon Claw', 'Swords Dance', 'Protect'], {
      item: 'Life Orb',
      nickname: 'Chompy',
    }),
    member('Rotom-Wash', 'Levitate', ['Hydro Pump', 'Volt Switch', 'Will-O-Wisp', 'Pain Split'], {
      item: 'Leftovers',
    }),
  ],
};

export const teamB: BattleTeamInput = {
  members: [
    member('Dragonite', 'Multiscale', ['Extreme Speed', 'Earthquake', 'Dragon Dance', 'Roost'], {
      item: 'Heavy-Duty Boots',
    }),
    member('Gholdengo', 'Good as Gold', ['Shadow Ball', 'Make It Rain', 'Trick', 'Recover'], {
      item: 'Choice Scarf',
    }),
  ],
};

export const legalOuTeam: BattleTeamInput = {
  members: [
    member('Gholdengo', 'Good as Gold', ['Make It Rain', 'Shadow Ball', 'Trick', 'Focus Blast'], {
      item: 'Choice Scarf',
      nature: 'Timid',
      evs: { spa: 252, spe: 252, hp: 4 },
    }),
    member('Kingambit', 'Defiant', ['Kowtow Cleave', 'Sucker Punch', 'Swords Dance', 'Iron Head'], {
      item: 'Leftovers',
      nature: 'Adamant',
      evs: { atk: 252, hp: 252, spd: 4 },
    }),
  ],
};

/**
 * A legal 6-member team for the Champions family (`champions-bss-reg-mb`). The Champions ruleset uses
 * its own item pool and reads `evs` as Stat Points (at most 32 per stat, 66 in total).
 */
export const championsBssTeam: BattleTeamInput = {
  members: [
    member('Garchomp', 'Rough Skin', ['Earthquake', 'Dragon Claw', 'Swords Dance', 'Protect'], {
      item: 'Life Orb',
      nature: 'Jolly',
      evs: { hp: 2, atk: 32, spe: 32 },
    }),
    member('Rotom-Wash', 'Levitate', ['Hydro Pump', 'Volt Switch', 'Will-O-Wisp', 'Protect'], {
      item: 'Leftovers',
      nature: 'Bold',
      evs: { hp: 32, def: 32, spa: 2 },
    }),
    member('Kingambit', 'Defiant', ['Kowtow Cleave', 'Sucker Punch', 'Iron Head', 'Swords Dance'], {
      item: 'Sitrus Berry',
      nature: 'Adamant',
      evs: { hp: 32, atk: 32, spd: 2 },
    }),
    member('Dragonite', 'Multiscale', ['Extreme Speed', 'Earthquake', 'Dragon Dance', 'Roost'], {
      item: 'Lum Berry',
      nature: 'Adamant',
      evs: { hp: 2, atk: 32, spe: 32 },
    }),
    member('Corviknight', 'Pressure', ['Brave Bird', 'Roost', 'Defog', 'Body Press'], {
      item: 'Shell Bell',
      nature: 'Impish',
      evs: { hp: 32, def: 32, spd: 2 },
    }),
    member('Pelipper', 'Drizzle', ['Hurricane', 'Surf', 'U-turn', 'Roost'], {
      item: 'Focus Sash',
      nature: 'Modest',
      evs: { hp: 2, spa: 32, spe: 32 },
    }),
  ],
};
