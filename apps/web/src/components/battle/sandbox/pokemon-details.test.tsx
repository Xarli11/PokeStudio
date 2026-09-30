import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  BattleFormatInfo,
  BattlePokemonState,
  BattleSideId,
  BattleState,
} from '@pokestudio/battle-engine/types';
import { getDictionary } from '@pokestudio/i18n';

import type { ActionResult } from '@/lib/battle/types';

import { BattleSandbox, type SandboxServerActions } from './battle-sandbox';
import { PokemonDetailsPanel } from './pokemon-details';

afterEach(cleanup);

const en = getDictionary('en').battle.sandbox;
const es = getDictionary('es').battle.sandbox;
const typeNames = getDictionary('en').types;
const ID = '9f9626b1-d5a9-41d2-b136-1b2c3d4e5f60';

const SV: BattleFormatInfo = {
  id: 'sv-ou',
  name: '[Gen 9] OU',
  generation: 9,
  gameType: 'singles',
  category: 'smogon-tier',
  family: 'scarlet-violet',
  openTeamSheets: false,
};
const VGC: BattleFormatInfo = {
  ...SV,
  id: 'champions-bss-reg-mb',
  family: 'champions',
  openTeamSheets: true,
};

const names = {
  moves: { makeitrain: 'Make It Rain', shadowball: 'Shadow Ball', earthquake: 'Earthquake' },
  abilities: { goodasgold: 'Good as Gold', intimidate: 'Intimidate' },
  items: { leftovers: 'Leftovers', lifeorb: 'Life Orb' },
  conditions: {},
};

const PRIVATE = {
  nature: 'Modest',
  evs: { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 },
  ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 },
  stats: { hp: 316, atk: 101, def: 226, spa: 365, spd: 218, spe: 293 },
};

/** A Pokémon the viewer owns: full information. */
const own = (side: BattleSideId, teamIndex: number, over: Partial<BattlePokemonState> = {}) =>
  ({
    ref: { side, teamIndex },
    species: 'Gholdengo',
    level: 100,
    gender: 'N',
    hp: { kind: 'exact', current: 173, max: 316 },
    status: 'par',
    fainted: false,
    active: teamIndex === 0,
    boosts: { atk: 2, spe: -1 },
    volatiles: [],
    types: ['Steel', 'Ghost'],
    teraType: 'Steel',
    ability: 'goodasgold',
    item: 'leftovers',
    moves: [
      { id: 'makeitrain', pp: 7, maxPp: 8, disabled: false },
      { id: 'shadowball', pp: 23, maxPp: 24, disabled: true },
    ],
    privateDetails: PRIVATE,
    revealed: { ability: true, item: true, moves: ['makeitrain', 'shadowball'] },
    ...over,
  }) as BattlePokemonState;

/** What a viewer may know of the other side: only what was revealed. */
const foe = (side: BattleSideId, teamIndex: number, over: Partial<BattlePokemonState> = {}) =>
  ({
    ref: { side, teamIndex },
    species: 'Gyarados',
    level: 100,
    gender: 'M',
    hp: { kind: 'percent', percent: 60 },
    status: null,
    fainted: false,
    active: teamIndex === 0,
    boosts: {},
    volatiles: [],
    ability: 'intimidate',
    moves: [{ id: 'earthquake' }],
    revealed: { ability: true, item: false, moves: ['earthquake'] },
    ...over,
  }) as BattlePokemonState;

interface World {
  format: BattleFormatInfo;
  /** [own view of p1, foe view of p2 as seen by p1, ...] built per perspective below. */
  p1: { own: BattlePokemonState[]; foe: BattlePokemonState[] };
  p2: { own: BattlePokemonState[]; foe: BattlePokemonState[] };
  spectator: { p1: BattlePokemonState[]; p2: BattlePokemonState[] };
}

function stateOf(world: World, perspective: 'p1' | 'p2' | 'spectator'): BattleState {
  const teams =
    perspective === 'spectator'
      ? world.spectator
      : perspective === 'p1'
        ? { p1: world.p1.own, p2: world.p1.foe }
        : { p1: world.p2.foe, p2: world.p2.own };
  const side = (id: BattleSideId) => ({
    id,
    displayName: id,
    teamSize: 2,
    pokemonLeft: 2,
    active: [teams[id].find((p) => p.active) ?? null],
    team: teams[id],
    sideConditions: [],
  });
  return {
    battleId: ID,
    perspective,
    format: world.format,
    generation: 9,
    gameType: 'singles',
    status: 'awaiting-choices',
    turn: 1,
    sides: { p1: side('p1'), p2: side('p2') },
    field: { weather: null, terrain: null, pseudoWeather: [] },
    requests: {},
    result: null,
    eventCursor: 0,
  } as unknown as BattleState;
}

const ok = <T,>(data: T): ActionResult<T> => ({ ok: true, data });

function harness(world: World) {
  const actions = {
    createSandboxBattle: vi.fn(async () => ok({ battleId: ID, format: world.format })),
    importTeamText: vi.fn(async () =>
      ok({ team: { members: [{ species: 'Gholdengo', ability: 'x', moves: ['y'] }] } }),
    ),
    validateSandboxTeam: vi.fn(async () => ok({ valid: true as const })),
    loadSideView: vi.fn(async (_id: string, side: BattleSideId) =>
      ok({ state: stateOf(world, side), choices: { kind: 'wait' as const, side } }),
    ),
    loadPerspectiveState: vi.fn(async (_id: string, p: 'p1' | 'p2' | 'spectator') =>
      ok(stateOf(world, p)),
    ),
    loadEvents: vi.fn(async () => ok({ events: [] })),
    submitSandboxCommand: vi.fn(),
    loadDisplayNames: vi.fn(async () => ok(names)),
    loadReplay: vi.fn(),
    loadDecisionView: vi.fn(),
    createFork: vi.fn(),
  } as unknown as SandboxServerActions;
  return actions;
}

const defaultWorld = (): World => ({
  format: SV,
  p1: {
    own: [own('p1', 0), own('p1', 1, { species: 'Kingambit', active: false })],
    foe: [foe('p2', 0)],
  },
  p2: {
    own: [own('p2', 0, { species: 'Gyarados' })],
    foe: [foe('p1', 0, { species: 'Gholdengo' })],
  },
  spectator: { p1: [foe('p1', 0, { species: 'Gholdengo' })], p2: [foe('p2', 0)] },
});

async function open(world: World, labels = en) {
  const actions = harness(world);
  render(<BattleSandbox labels={labels} typeNames={typeNames} actions={actions} />);
  for (const n of [1, 2]) {
    const picker = screen.getByTestId(`team-picker-${n}`);
    fireEvent.click(within(picker).getByRole('button', { name: labels.setup.fromPaste }));
    fireEvent.change(within(picker).getByLabelText(labels.setup.pasteLabel), {
      target: { value: 'Gholdengo' },
    });
    fireEvent.click(within(picker).getByRole('button', { name: labels.setup.importButton }));
    await screen.findByTestId(`team-ready-${n}`);
  }
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: labels.setup.createButton }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: labels.setup.createButton }));
  await screen.findByTestId('sandbox-battle');
  return actions;
}

const inspect = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name: `Details: ${name}` }));
const dialog = () => screen.getByRole('dialog');
const viewAs = (name: string) => fireEvent.click(screen.getByRole('tab', { name }));

describe('Pokémon details: opening and closing', () => {
  it('opens for the active Pokémon and closes with the button', async () => {
    await open(defaultWorld());
    expect(screen.queryByRole('dialog')).toBeNull();
    inspect('Gholdengo');
    expect(dialog().getAttribute('aria-modal')).toBe('true');
    expect(within(dialog()).getByRole('heading', { name: 'Gholdengo' })).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole('button', { name: en.details.close }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes with Escape and with the backdrop', async () => {
    await open(defaultWorld());
    inspect('Gholdengo');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    inspect('Gholdengo');
    fireEvent.click(screen.getByTestId('pokemon-details-backdrop'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lets a visible bench Pokémon be inspected', async () => {
    await open(defaultWorld());
    inspect('Kingambit');
    expect(within(dialog()).getByRole('heading', { name: 'Kingambit' })).toBeTruthy();
  });

  it('moves focus into the dialog and back to the opener', async () => {
    await open(defaultWorld());
    const opener = screen.getByRole('button', { name: 'Details: Gholdengo' });
    opener.focus();
    fireEvent.click(opener);
    expect(document.activeElement).toBe(
      within(dialog()).getByRole('button', { name: en.details.close }),
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(opener);
  });
});

describe('Pokémon details: what each perspective sees', () => {
  it('shows the owner its stats, set, spread, boosts and move PP', async () => {
    await open(defaultWorld());
    inspect('Gholdengo');
    const panel = within(dialog());
    const stats = within(panel.getByTestId('details-stats'));
    expect(stats.getByText('Attack').nextSibling?.textContent).toBe('101');
    expect(stats.getByText('Sp. Atk').nextSibling?.textContent).toBe('365');
    expect(stats.getByText('HP').nextSibling?.textContent).toBe('316');
    expect(panel.getByText('173 / 316')).toBeTruthy();
    expect(panel.getByText('PAR')).toBeTruthy();
    expect(panel.getByText('Attack +2 · Speed -1')).toBeTruthy(); // boosts stay separate from stats
    expect(panel.getByText('Modest')).toBeTruthy();
    // EVs list only the allocated stats; IVs list all six.
    const evs = within(panel.getByText('EVs').parentElement as HTMLElement);
    expect(evs.getByText('Sp. Atk').nextSibling?.textContent).toBe('252');
    expect(evs.getByText('Speed').nextSibling?.textContent).toBe('252');
    expect(evs.getByText('HP').nextSibling?.textContent).toBe('4');
    expect(evs.queryByText('Attack')).toBeNull();
    const ivs = within(panel.getByText('IVs').parentElement as HTMLElement);
    expect(ivs.getByText('Attack').nextSibling?.textContent).toBe('0');
    expect(ivs.getAllByRole('term')).toHaveLength(6);
    expect(panel.getByText('Good as Gold')).toBeTruthy();
    expect(panel.getByText('Leftovers')).toBeTruthy();
    const moves = within(panel.getByTestId('details-moves'));
    expect(moves.getByText('Make It Rain').closest('li')?.textContent).toContain('7 / 8');
    expect(moves.getByText('Shadow Ball').closest('li')?.textContent).toContain('23 / 24');
    expect(moves.getByText(en.details.disabled)).toBeTruthy();
    expect(panel.getByText(en.details.scopeNote)).toBeTruthy();
  });

  it('shows only what was revealed for an opponent, with no private block', async () => {
    await open(defaultWorld());
    inspect('Gyarados');
    const panel = within(dialog());
    expect(panel.getByText('60%')).toBeTruthy();
    expect(panel.getByText('Intimidate')).toBeTruthy();
    expect(panel.getByText('Earthquake')).toBeTruthy();
    expect(dialog().textContent).not.toMatch(
      new RegExp(`${en.details.sectionStats}|${en.details.nature}|EVs|IVs|${en.details.item}`),
    );
    expect(panel.queryByTestId('details-stats')).toBeNull();
    // A revealed move without PP is a name only: nothing is invented.
    expect(panel.getByText('Earthquake').closest('li')?.textContent).toBe('Earthquake');
  });

  it('shows the Open Team Sheet opponent set but never stats, spread or nature', async () => {
    const world = defaultWorld();
    world.format = VGC;
    world.p1.foe = [
      foe('p2', 0, {
        item: 'lifeorb',
        teraType: 'Ghost',
        revealed: { ability: true, item: true, moves: ['earthquake'] },
      }),
    ];
    await open(world);
    inspect('Gyarados');
    const panel = within(dialog());
    expect(panel.getByText('Life Orb')).toBeTruthy();
    expect(panel.getByText('Intimidate')).toBeTruthy();
    expect(panel.getByText('Earthquake')).toBeTruthy();
    expect(panel.getByText(en.details.tera)).toBeTruthy();
    expect(panel.getByText(typeNames.ghost)).toBeTruthy();
    expect(dialog().textContent).not.toMatch(
      new RegExp(`${en.details.sectionStats}|${en.details.nature}|Stat Points|EVs|IVs`),
    );
    expect(panel.queryByTestId('details-stats')).toBeNull();
  });

  it('shows the spectator no private details, even for the Pokémon a player owns', async () => {
    await open(defaultWorld());
    viewAs(en.battle.spectator);
    await waitFor(() => screen.getAllByRole('button', { name: 'Details: Gholdengo' }));
    inspect('Gholdengo');
    expect(dialog().textContent).not.toMatch(
      new RegExp(`${en.details.sectionStats}|${en.details.nature}|EVs|IVs|Modest`),
    );
  });
});

describe('Pokémon details: perspective and refresh', () => {
  it('re-resolves the selected Pokémon by ref when the perspective changes', async () => {
    await open(defaultWorld());
    inspect('Gholdengo');
    expect(within(dialog()).getByTestId('details-stats')).toBeTruthy();
    viewAs(en.battle.spectator);
    await waitFor(() => expect(screen.queryByTestId('details-stats')).toBeNull());
    // Still visible to the spectator (public), but now only from the spectator's own state.
    expect(within(dialog()).getByRole('heading', { name: 'Gholdengo' })).toBeTruthy();
    expect(dialog().textContent).not.toContain('Modest');
  });

  it('closes when the perspective can no longer see that Pokémon', async () => {
    await open(defaultWorld());
    inspect('Kingambit'); // p1's private bench member
    expect(dialog()).toBeTruthy();
    viewAs(en.battle.spectator);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    viewAs(en.battle.player1);
    await screen.findByTestId('side-p1');
    expect(screen.queryByRole('dialog')).toBeNull(); // it does not reappear with a stale selection
  });

  it('shows refreshed values, never the state it was opened with', async () => {
    const world = defaultWorld();
    const actions = await open(world);
    inspect('Gholdengo');
    expect(within(dialog()).getByText('173 / 316')).toBeTruthy();
    world.p1.own[0] = own('p1', 0, {
      hp: { kind: 'exact', current: 90, max: 316 },
      boosts: { def: 1 },
      status: null,
    });
    fireEvent.click(screen.getByRole('tab', { name: en.battle.player1 }));
    await waitFor(() => expect(within(dialog()).getByText('90 / 316')).toBeTruthy());
    expect(within(dialog()).queryByText('173 / 316')).toBeNull();
    expect(within(dialog()).getByText('Defense +1')).toBeTruthy();
    expect(within(dialog()).queryByText('PAR')).toBeNull();
    expect(actions.loadSideView).toHaveBeenCalled();
  });
});

describe('PokemonDetailsPanel: labels', () => {
  const render_ = (
    pokemon: BattlePokemonState,
    family: 'scarlet-violet' | 'champions',
    labels = en.details,
  ) =>
    render(
      <PokemonDetailsPanel
        pokemon={pokemon}
        family={family}
        labels={labels}
        levelTemplate="Lv. {level}"
        faintedLabel="Fainted"
        names={names}
        typeNames={typeNames}
        onClose={() => undefined}
      />,
    );

  it('calls the spread "Stat Points" in Champions and does not show IVs there', () => {
    const champions = own('p1', 0, {
      privateDetails: { nature: 'Jolly', evs: PRIVATE.evs, stats: PRIVATE.stats },
    });
    render_(champions, 'champions');
    expect(screen.getByText('Stat Points')).toBeTruthy();
    expect(screen.queryByText('EVs')).toBeNull();
    expect(screen.queryByText('IVs')).toBeNull();
  });

  it('calls it EVs in Scarlet/Violet and localizes the labels', () => {
    render_(own('p1', 0), 'scarlet-violet', es.details);
    expect(screen.getByText('EVs')).toBeTruthy();
    expect(screen.getByText('IVs')).toBeTruthy();
    expect(screen.getByText('Estadísticas')).toBeTruthy();
    expect(
      screen.getByText('Solo se muestra la información conocida desde esta perspectiva.'),
    ).toBeTruthy();
    cleanup();
    render_(own('p1', 0, { privateDetails: { ...PRIVATE } }), 'champions', es.details);
    expect(screen.getByText('Puntos de estadística')).toBeTruthy();
  });

  it('places the registered Tera type in SET and Terastallized in STATE only once it happened', () => {
    const section = (name: string) => screen.getByRole('region', { name });
    render_(own('p1', 0), 'scarlet-violet');
    expect(within(section(en.details.sectionSet)).getByText(en.details.tera)).toBeTruthy();
    expect(within(section(en.details.sectionState)).queryByText(en.details.tera)).toBeNull();
    expect(screen.queryByText(en.details.terastallized)).toBeNull();
    cleanup();
    render_(own('p1', 0, { terastallized: 'Steel' }), 'scarlet-violet');
    expect(
      within(section(en.details.sectionState)).getByText(en.details.terastallized),
    ).toBeTruthy();
    expect(within(section(en.details.sectionSet)).getByText(en.details.tera)).toBeTruthy();
  });

  it('lists stats in the fixed order without evaluating them', () => {
    render_(own('p1', 0), 'scarlet-violet');
    const labelsInOrder = [...screen.getByTestId('details-stats').querySelectorAll('dt')].map(
      (dt) => dt.textContent,
    );
    expect(labelsInOrder).toEqual(['HP', 'Attack', 'Defense', 'Sp. Atk', 'Sp. Def', 'Speed']);
  });
});
