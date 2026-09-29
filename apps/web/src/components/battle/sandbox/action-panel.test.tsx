import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getDictionary } from '@pokestudio/i18n';
import type {
  BattleLegalChoices,
  BattlePokemonState,
  BattleSideId,
  BattleState,
} from '@pokestudio/battle-engine/types';

import { ActionPanel, TeamPreviewPanel } from './action-panel';

afterEach(cleanup);

const labels = getDictionary('en').battle.sandbox;
const names = {
  moves: {
    earthquake: 'Earthquake',
    dragonclaw: 'Dragon Claw',
    helpinghand: 'Helping Hand',
    protect: 'Protect',
  },
  abilities: {},
  items: {},
  conditions: {},
};

const mon = (side: BattleSideId, teamIndex: number, species: string): BattlePokemonState => ({
  ref: { side, teamIndex },
  species,
  level: 50,
  gender: 'N',
  hp: { kind: 'exact', current: 100, max: 100 },
  status: null,
  fainted: false,
  active: teamIndex < 2,
  boosts: {},
  volatiles: [],
  revealed: { ability: false, item: false, moves: [] },
});

const state = (): BattleState =>
  ({
    battleId: 'x',
    perspective: 'p1',
    sides: {
      p1: {
        id: 'p1',
        displayName: 'p1',
        teamSize: 4,
        pokemonLeft: 4,
        active: [],
        team: [
          mon('p1', 0, 'Garchomp'),
          mon('p1', 1, 'Rotom-Wash'),
          mon('p1', 2, 'Kingambit'),
          mon('p1', 3, 'Incineroar'),
        ],
        sideConditions: [],
      },
      p2: {
        id: 'p2',
        displayName: 'p2',
        teamSize: 0,
        pokemonLeft: 0,
        active: [],
        team: [],
        sideConditions: [],
      },
    },
  }) as unknown as BattleState;

const slot = (position: number) => ({ side: 'p1' as const, position });
const foes = [
  { side: 'p2' as const, position: 0 },
  { side: 'p2' as const, position: 1 },
];

const doubles: Extract<BattleLegalChoices, { kind: 'move' }> = {
  kind: 'move',
  side: 'p1',
  slots: [
    {
      slot: slot(0),
      pokemon: { side: 'p1', teamIndex: 0 },
      options: [
        { kind: 'move', moveId: 'earthquake', pp: 16, targets: null, modifiers: ['terastallize'] },
        {
          kind: 'move',
          moveId: 'dragonclaw',
          pp: 24,
          targets: [...foes, slot(1)],
          modifiers: ['terastallize'],
        },
        { kind: 'switch', pokemon: { side: 'p1', teamIndex: 2 } },
        { kind: 'switch', pokemon: { side: 'p1', teamIndex: 3 } },
      ],
    },
    {
      slot: slot(1),
      pokemon: { side: 'p1', teamIndex: 1 },
      options: [
        {
          kind: 'move',
          moveId: 'helpinghand',
          pp: 32,
          targets: [slot(0)],
          modifiers: ['terastallize'],
        },
        { kind: 'move', moveId: 'protect', pp: 16, targets: null, modifiers: ['terastallize'] },
        { kind: 'switch', pokemon: { side: 'p1', teamIndex: 2 } },
        { kind: 'switch', pokemon: { side: 'p1', teamIndex: 3 } },
      ],
    },
  ],
};

const renderPanel = (choices: Parameters<typeof ActionPanel>[0]['choices'], onSubmit = vi.fn()) => {
  render(
    <ActionPanel
      choices={choices}
      state={state()}
      labels={labels.action}
      names={names}
      busy={false}
      onSubmit={onSubmit}
    />,
  );
  return onSubmit;
};
const submit = () =>
  screen.getByRole('button', { name: labels.action.submit }) as HTMLButtonElement;

describe('ActionPanel: Doubles', () => {
  it('has a section per slot with each Pokémon named, and blocks submit until every slot is set', () => {
    renderPanel(doubles);
    expect(screen.getAllByRole('group').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Garchomp')).toBeTruthy();
    expect(screen.getByText('Rotom-Wash')).toBeTruthy();
    expect(submit().disabled).toBe(true);
  });

  it('asks for a target only when the move has a choice, and builds the exact command', () => {
    const onSubmit = renderPanel(doubles);
    // Slot 1: Earthquake needs no target.
    fireEvent.click(screen.getAllByRole('button', { name: /Earthquake/ })[0]!);
    expect(screen.queryByRole('group', { name: labels.action.target })).toBeNull();
    // Slot 2: Helping Hand (ally only) needs its target.
    fireEvent.click(screen.getByRole('button', { name: /Helping Hand/ }));
    expect(submit().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: labels.action.targetAlly }));
    expect(submit().disabled).toBe(false);
    fireEvent.click(submit());
    expect(onSubmit).toHaveBeenCalledWith({
      kind: 'actions',
      actions: [
        { kind: 'move', slot: slot(0), moveId: 'earthquake' },
        { kind: 'move', slot: slot(1), moveId: 'helpinghand', target: slot(0) },
      ],
    });
  });

  it("offers foes and the ally for a normal move, labelled from the actor's point of view", () => {
    renderPanel(doubles);
    fireEvent.click(screen.getByRole('button', { name: /Dragon Claw/ }));
    const group = screen.getByRole('group', { name: labels.action.target });
    expect([...group.querySelectorAll('button')].map((b) => b.textContent)).toEqual([
      'Opposing 1',
      'Opposing 2',
      labels.action.targetAlly,
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Opposing 2' }));
    fireEvent.click(screen.getByRole('button', { name: /Protect/ }));
    expect(submit().disabled).toBe(false);
  });

  it("allows one Terastallization per turn: the other slot's box is disabled once one is ticked", () => {
    renderPanel(doubles);
    fireEvent.click(screen.getAllByRole('button', { name: /Earthquake/ })[0]!);
    fireEvent.click(screen.getByRole('button', { name: /Protect/ }));
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(boxes).toHaveLength(2);
    fireEvent.click(boxes[0]!);
    expect(boxes[0]!.checked).toBe(true);
    expect(boxes[1]!.disabled).toBe(true);
  });

  it('does not let both slots switch to the same Pokémon', () => {
    renderPanel(doubles);
    const switchButtons = () =>
      screen.getAllByRole('button', { name: 'Kingambit' }) as HTMLButtonElement[];
    fireEvent.click(switchButtons()[0]!);
    expect(switchButtons()[1]!.disabled).toBe(true);
    expect(switchButtons()[0]!.disabled).toBe(false);
  });
});

describe('ActionPanel: forced replacements', () => {
  const forced = (
    switchCount: number,
    passes: boolean,
  ): Extract<BattleLegalChoices, { kind: 'forced-switch' }> => ({
    kind: 'forced-switch',
    side: 'p1',
    switchCount,
    slots: [0, 1].map((position) => ({
      slot: slot(position),
      pokemon: { side: 'p1' as const, teamIndex: position },
      options: [
        { kind: 'switch' as const, pokemon: { side: 'p1' as const, teamIndex: 2 } },
        ...(switchCount === 2
          ? [{ kind: 'switch' as const, pokemon: { side: 'p1' as const, teamIndex: 3 } }]
          : []),
        ...(passes ? [{ kind: 'pass' as const }] : []),
      ],
    })),
  });

  it('requires exactly switchCount replacements and lets the surplus slot pass', () => {
    const onSubmit = renderPanel(forced(1, true));
    expect(screen.getByText(/Send in 1 Pokémon/)).toBeTruthy();
    const pass = screen.getAllByRole('button', { name: labels.action.pass });
    // Nothing chosen yet, then pass/pass is not enough (a switch is required).
    fireEvent.click(pass[0]!);
    fireEvent.click(pass[1]!);
    expect(submit().disabled).toBe(true);
    // Switch in slot 2, pass in slot 1.
    fireEvent.click(screen.getAllByRole('button', { name: 'Kingambit' })[1]!);
    expect(submit().disabled).toBe(false);
    fireEvent.click(submit());
    expect(onSubmit).toHaveBeenCalledWith({
      kind: 'actions',
      actions: [
        { kind: 'pass', slot: slot(0) },
        { kind: 'switch', slot: slot(1), pokemon: { side: 'p1', teamIndex: 2 } },
      ],
    });
  });

  it('with enough Pokémon for every slot, both switch to different Pokémon', () => {
    const onSubmit = renderPanel(forced(2, false));
    fireEvent.click(screen.getAllByRole('button', { name: 'Kingambit' })[0]!);
    expect(submit().disabled).toBe(true);
    fireEvent.click(screen.getAllByRole('button', { name: 'Incineroar' })[1]!);
    expect(submit().disabled).toBe(false);
    fireEvent.click(submit());
    expect(
      onSubmit.mock.calls[0]![0].actions.map(
        (a: { pokemon: { teamIndex: number } }) => a.pokemon.teamIndex,
      ),
    ).toEqual([2, 3]);
  });

  it('a slot that only offers pass is settled automatically', () => {
    const onlyPass: Extract<BattleLegalChoices, { kind: 'move' }> = {
      kind: 'move',
      side: 'p1',
      slots: [
        { slot: slot(0), pokemon: null, options: [{ kind: 'pass' }] },
        {
          slot: slot(1),
          pokemon: { side: 'p1', teamIndex: 1 },
          options: [{ kind: 'move', moveId: 'protect', pp: 16, targets: null, modifiers: [] }],
        },
      ],
    };
    const onSubmit = renderPanel(onlyPass);
    expect(screen.getByText(labels.action.noActionNeeded)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Protect/ }));
    fireEvent.click(submit());
    expect(onSubmit).toHaveBeenCalledWith({
      kind: 'actions',
      actions: [
        { kind: 'pass', slot: slot(0) },
        { kind: 'move', slot: slot(1), moveId: 'protect' },
      ],
    });
  });
});

describe('TeamPreviewPanel', () => {
  const previewLabels = labels.preview;
  const renderPreview = (pick: number, openTeamSheets = false) => {
    const onSubmit = vi.fn();
    render(
      <TeamPreviewPanel
        side="p1"
        state={state()}
        pick={pick}
        labels={previewLabels}
        openTeamSheets={openTeamSheets}
        busy={false}
        onSubmit={onSubmit}
      />,
    );
    return onSubmit;
  };
  const confirm = () =>
    screen.getByRole('button', { name: previewLabels.submit }) as HTMLButtonElement;

  it('picks in click order, shows the order, and needs exactly `pick` Pokémon', () => {
    const onSubmit = renderPreview(2);
    expect(screen.getByText('0 of 2 chosen')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Incineroar/ }));
    expect(confirm().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Garchomp/ }));
    // A third click beyond the limit is ignored.
    fireEvent.click(screen.getByRole('button', { name: /Kingambit/ }));
    expect(screen.getByRole('button', { name: /Kingambit/ }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(screen.getByRole('button', { name: /Incineroar/ }).textContent).toContain('#1');
    expect(screen.getByRole('button', { name: /Garchomp/ }).textContent).toContain('#2');
    fireEvent.click(confirm());
    expect(onSubmit).toHaveBeenCalledWith({ kind: 'team-order', order: [3, 0] });
  });

  it('can un-pick and clear', () => {
    renderPreview(2);
    fireEvent.click(screen.getByRole('button', { name: /Garchomp/ }));
    fireEvent.click(screen.getByRole('button', { name: /Garchomp/ }));
    expect(screen.getByText('0 of 2 chosen')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Garchomp/ }));
    fireEvent.click(screen.getByRole('button', { name: previewLabels.clear }));
    expect(screen.getByText('0 of 2 chosen')).toBeTruthy();
  });

  it('mentions open team sheets only for formats that publish them', () => {
    renderPreview(2, true);
    expect(screen.getByText(previewLabels.openSheets)).toBeTruthy();
    cleanup();
    renderPreview(2, false);
    expect(screen.queryByText(previewLabels.openSheets)).toBeNull();
  });
});
