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
        active: [mon('p1', 0, 'Garchomp'), mon('p1', 1, 'Rotom-Wash')],
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
        teamSize: 2,
        pokemonLeft: 2,
        active: [mon('p2', 0, 'Incineroar'), mon('p2', 1, 'Amoonguss')],
        team: [mon('p2', 0, 'Incineroar'), mon('p2', 1, 'Amoonguss')],
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

const renderPanel = (
  choices: Parameters<typeof ActionPanel>[0]['choices'],
  onSubmit = vi.fn(),
  extra: Partial<Parameters<typeof ActionPanel>[0]> = {},
) => {
  render(
    <ActionPanel
      choices={choices}
      state={state()}
      labels={labels.action}
      names={names}
      busy={false}
      playerLabel="Player 1"
      onSubmit={onSubmit}
      {...extra}
    />,
  );
  return onSubmit;
};
const button = (name: string | RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement;
const next = () => button(labels.action.next);
const review = () => button(labels.action.review);
const confirmTurn = () => button(labels.action.confirmTurn);

describe('ActionPanel: Doubles, one Pokémon at a time', () => {
  it('names who is acting and shows only that Pokémon’s options', () => {
    renderPanel(doubles);
    expect(screen.getByTestId('actor-line').textContent).toBe('Player 1 · Garchomp');
    expect(screen.getByTestId('action-prompt').textContent).toContain(labels.action.chooseAction);
    expect(screen.getByTestId('action-prompt').textContent).toContain('1 of 2');
    // Rotom-Wash's moves are not on screen yet.
    expect(screen.queryByRole('button', { name: /Helping Hand/ })).toBeNull();
    expect(next().disabled).toBe(true);
    expect(screen.getByText(labels.action.chooseFirst)).toBeTruthy();
    const progress = screen.getByTestId('turn-progress');
    expect(progress.textContent).toContain('Garchomp');
    expect(progress.textContent).toContain('Rotom-Wash');
    expect(progress.querySelector('[aria-current="step"]')?.textContent).toContain('Garchomp');
  });

  it('asks for a target only when there is a real choice, and reviews the turn before sending', () => {
    const onSubmit = renderPanel(doubles);
    // Slot 1: Earthquake needs no target.
    fireEvent.click(button(/Earthquake/));
    expect(screen.queryByTestId('target-chooser')).toBeNull();
    fireEvent.click(next());
    expect(screen.getByTestId('actor-line').textContent).toBe('Player 1 · Rotom-Wash');
    // Slot 2: Helping Hand has a single legal target, so it is picked for the player.
    fireEvent.click(button(/Helping Hand/));
    expect(screen.queryByTestId('target-chooser')).toBeNull();
    expect(screen.getByTestId('target-auto').textContent).toBe('Target: Garchomp');
    fireEvent.click(review());
    expect(onSubmit).not.toHaveBeenCalled();
    const summary = screen.getByTestId('turn-review').textContent ?? '';
    expect(summary).toContain('Garchomp → Earthquake');
    expect(summary).toContain('Rotom-Wash → Helping Hand on Garchomp');
    fireEvent.click(confirmTurn());
    expect(onSubmit).toHaveBeenCalledWith({
      kind: 'actions',
      actions: [
        { kind: 'move', slot: slot(0), moveId: 'earthquake' },
        { kind: 'move', slot: slot(1), moveId: 'helpinghand', target: slot(0) },
      ],
    });
  });

  it('names real Pokémon as targets and never offers an illegal one as clickable', () => {
    const foesOnly: Extract<BattleLegalChoices, { kind: 'move' }> = {
      ...doubles,
      slots: [
        {
          ...doubles.slots[0]!,
          options: [{ kind: 'move', moveId: 'dragonclaw', pp: 24, targets: foes, modifiers: [] }],
        },
        doubles.slots[1]!,
      ],
    };
    renderPanel(foesOnly);
    fireEvent.click(button(/Dragon Claw/));
    const group = screen.getByRole('group', { name: labels.action.chooseTarget });
    const buttons = [...group.querySelectorAll('button')];
    expect(buttons.map((b) => b.textContent)).toEqual([
      'Incineroar (opponent)',
      'Amoonguss (opponent)',
      'Rotom-Wash (ally)',
    ]);
    expect(buttons.map((b) => b.disabled)).toEqual([false, false, true]);
    expect(next().disabled).toBe(true);
    fireEvent.click(buttons[1]!);
    expect(next().disabled).toBe(false);
  });

  it('offers a clear way back from a chosen move while its target is being picked', () => {
    renderPanel(doubles);
    fireEvent.click(button(/Dragon Claw/));
    expect(screen.getByTestId('target-chooser')).toBeTruthy();
    fireEvent.click(button(labels.action.changeMove));
    // The move is un-chosen: no target list, no chosen state, every move is selectable again.
    expect(screen.queryByTestId('target-chooser')).toBeNull();
    expect(button(/Dragon Claw/).getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('button', { name: labels.action.changeMove })).toBeNull();
    expect(next().disabled).toBe(true);
  });

  it('lets the player change a step from the review, and confirms only once', () => {
    const onSubmit = renderPanel(doubles);
    fireEvent.click(button(/Earthquake/));
    fireEvent.click(next());
    fireEvent.click(button(/Protect/));
    fireEvent.click(review());
    fireEvent.click(screen.getAllByRole('button', { name: labels.action.change })[0]!);
    expect(screen.getByTestId('actor-line').textContent).toBe('Player 1 · Garchomp');
    fireEvent.click(button(/Dragon Claw/));
    fireEvent.click(button(/Incineroar \(opponent\)/));
    fireEvent.click(next());
    fireEvent.click(review());
    expect(screen.getByTestId('turn-review').textContent).toContain(
      'Garchomp → Dragon Claw on Incineroar',
    );
    fireEvent.click(confirmTurn());
    fireEvent.click(confirmTurn());
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('disables confirm while the turn is being resolved', () => {
    renderPanel(doubles, vi.fn(), { busy: true });
    // Busy from the start: nothing can be sent.
    fireEvent.click(button(/Earthquake/));
    fireEvent.click(next());
    fireEvent.click(button(/Protect/));
    fireEvent.click(review());
    const sending = button(labels.action.submitting);
    expect(sending.disabled).toBe(true);
  });

  it('reports the acting Pokémon and the legal targets for the battlefield', () => {
    const onFocus = vi.fn();
    renderPanel(doubles, vi.fn(), { onFocus });
    expect(onFocus).toHaveBeenLastCalledWith({ actor: slot(0), targets: null, selected: null });
    fireEvent.click(button(/Dragon Claw/));
    expect(onFocus).toHaveBeenLastCalledWith({
      actor: slot(0),
      targets: [...foes, slot(1)],
      selected: null,
    });
    fireEvent.click(button(/Amoonguss \(opponent\)/));
    expect(onFocus).toHaveBeenLastCalledWith({
      actor: slot(0),
      targets: [...foes, slot(1)],
      selected: foes[1],
    });
    cleanup();
    expect(onFocus).toHaveBeenLastCalledWith(null);
  });

  it("allows one Terastallization per turn: the other slot's box is disabled once one is ticked", () => {
    renderPanel(doubles);
    fireEvent.click(button(/Earthquake/));
    fireEvent.click(screen.getByRole('checkbox', { name: labels.action.terastallize }));
    fireEvent.click(next());
    fireEvent.click(button(/Protect/));
    const box = screen.getByRole('checkbox', {
      name: labels.action.terastallize,
    }) as HTMLInputElement;
    expect(box.disabled).toBe(true);
  });

  it('does not let both slots switch to the same Pokémon', () => {
    renderPanel(doubles);
    fireEvent.click(button('Kingambit'));
    fireEvent.click(next());
    expect(button('Kingambit').disabled).toBe(true);
    expect(button('Incineroar').disabled).toBe(false);
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
    expect(screen.getByTestId('action-prompt').textContent).toContain(
      labels.action.chooseReplacement,
    );
    expect(screen.getByTestId('action-prompt').textContent).toContain('Send in 1');
    fireEvent.click(button(labels.action.pass));
    fireEvent.click(next());
    fireEvent.click(button(labels.action.pass));
    fireEvent.click(review());
    // Pass/pass is not enough: a replacement is required.
    expect(confirmTurn().disabled).toBe(true);
    expect(screen.getByText(labels.action.forcedCountHint)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: labels.action.change })[1]!);
    fireEvent.click(button('Kingambit'));
    fireEvent.click(review());
    expect(confirmTurn().disabled).toBe(false);
    fireEvent.click(confirmTurn());
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
    fireEvent.click(button('Kingambit'));
    fireEvent.click(next());
    expect(button('Kingambit').disabled).toBe(true);
    fireEvent.click(button('Incineroar'));
    fireEvent.click(review());
    fireEvent.click(confirmTurn());
    expect(
      onSubmit.mock.calls[0]![0].actions.map(
        (a: { pokemon: { teamIndex: number } }) => a.pokemon.teamIndex,
      ),
    ).toEqual([2, 3]);
  });

  it('a slot that only offers pass is settled automatically and skipped', () => {
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
    // One real decision: no stepper and no review, a direct confirm.
    expect(screen.queryByTestId('turn-progress')).toBeNull();
    expect(screen.getByTestId('actor-line').textContent).toBe('Player 1 · Rotom-Wash');
    fireEvent.click(button(/Protect/));
    fireEvent.click(button(labels.action.submit));
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
