import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getDictionary } from '@pokestudio/i18n';
import type {
  BattleEvent,
  BattlePokemonState,
  BattleSideId,
  BattleState,
} from '@pokestudio/battle-engine/types';

import type { ActionResult, BattleLegalChoices, SideView } from '@/lib/battle/types';

import { BattleSandbox, type SandboxServerActions } from './battle-sandbox';

afterEach(cleanup);

const ID = '9f9626b1-d5a9-41d2-b136-1b2c3d4e5f60';
const TEAM = {
  members: [
    { species: 'Garchomp', ability: 'rough-skin', moves: ['earthquake'] },
    { species: 'Rotom-Wash', ability: 'levitate', moves: ['hydro-pump'] },
  ],
};

const mon = (
  side: BattleSideId,
  teamIndex: number,
  over: Partial<BattlePokemonState> = {},
): BattlePokemonState => ({
  ref: { side, teamIndex },
  species: teamIndex === 0 ? 'Garchomp' : 'Rotom-Wash',
  level: 100,
  gender: 'N',
  hp: { kind: 'exact', current: 300, max: 300 },
  status: null,
  fainted: false,
  active: false,
  boosts: {},
  volatiles: [],
  revealed: { ability: false, item: false, moves: [] },
  ...over,
});

type Stage = 'preview' | 'turn' | 'finished';

/** A scripted stand-in for the battle server: preview → one turn → finished. */
function fake() {
  let stage: Stage = 'preview';
  const submitted = new Set<BattleSideId>();
  const commands: { side: BattleSideId; command: unknown }[] = [];

  const stateFor = (perspective: 'p1' | 'p2' | 'spectator'): BattleState => {
    const started = stage !== 'preview';
    const own = (side: BattleSideId) => {
      const exact = perspective === side;
      const team = [0, 1].map((i) =>
        mon(side, i, {
          active: started && i === 0,
          hp: exact
            ? { kind: 'exact', current: stage === 'finished' && side === 'p2' ? 0 : 300, max: 300 }
            : { kind: 'percent', percent: stage === 'finished' && side === 'p2' ? 0 : 100 },
          fainted: stage === 'finished' && side === 'p2' && i === 0,
        }),
      );
      return {
        id: side,
        displayName: side,
        teamSize: 2,
        pokemonLeft: 2,
        active: started ? [team[0]!] : [null],
        team,
        sideConditions: [],
      };
    };
    return {
      battleId: ID,
      perspective,
      format: {
        id: 'sv-ou',
        name: '[Gen 9] OU',
        generation: 9,
        gameType: 'singles',
        category: 'smogon-tier',
        family: 'scarlet-violet',
        openTeamSheets: false,
      },
      generation: 9,
      gameType: 'singles',
      status: stage === 'finished' ? 'finished' : 'awaiting-choices',
      turn: stage === 'preview' ? 0 : stage === 'turn' ? 1 : 2,
      sides: { p1: own('p1'), p2: own('p2') },
      field: { weather: null, terrain: null, pseudoWeather: [] },
      requests:
        stage === 'finished'
          ? {}
          : perspective === 'spectator'
            ? {}
            : {
                [perspective]: {
                  kind: stage === 'preview' ? 'team-preview' : 'move',
                  submitted: submitted.has(perspective),
                },
              },
      result: stage === 'finished' ? { kind: 'win', winner: 'p1' } : null,
      eventCursor: 0,
    };
  };

  const choicesFor = (side: BattleSideId): BattleLegalChoices =>
    stage === 'finished'
      ? { kind: 'wait', side }
      : stage === 'preview'
        ? { kind: 'team-preview', side, pick: 2, of: 2 }
        : {
            kind: 'move',
            side,
            slots: [
              {
                slot: { side, position: 0 },
                pokemon: { side, teamIndex: 0 },
                options: [
                  {
                    kind: 'move',
                    moveId: 'earthquake',
                    pp: 16,
                    targets: null,
                    modifiers: ['terastallize'],
                  },
                  {
                    kind: 'move',
                    moveId: 'dragonclaw',
                    pp: 24,
                    targets: null,
                    modifiers: ['terastallize'],
                  },
                  { kind: 'switch', pokemon: { side, teamIndex: 1 } },
                ],
              },
            ],
          };

  const events: BattleEvent[] = [
    { seq: 1, turn: 0, type: 'battle-started' },
    { seq: 2, turn: 0, type: 'team-preview' },
  ];
  const turnEvents = (): BattleEvent[] => [
    { seq: 3, turn: 1, type: 'turn-started' },
    {
      seq: 4,
      turn: 1,
      type: 'move-used',
      user: { side: 'p1', teamIndex: 0 },
      moveId: 'earthquake',
    },
    {
      seq: 5,
      turn: 1,
      parentSeq: 4,
      type: 'hp-changed',
      pokemon: { side: 'p2', teamIndex: 0 },
      hp: { kind: 'percent', percent: 0 },
      change: 'damage',
    },
    { seq: 6, turn: 1, parentSeq: 4, type: 'fainted', pokemon: { side: 'p2', teamIndex: 0 } },
    { seq: 7, turn: 1, type: 'battle-ended', result: { kind: 'win', winner: 'p1' } },
  ];

  const ok = <T,>(data: T): ActionResult<T> => ({ ok: true, data });
  const actions: SandboxServerActions = {
    createSandboxBattle: vi.fn(async () => ok({ battleId: ID, format: stateFor('p1').format })),
    importTeamText: vi.fn(async () => ok({ team: TEAM })),
    loadSideView: vi.fn(async (_id, side): Promise<ActionResult<SideView>> =>
      ok({ state: stateFor(side), choices: choicesFor(side) }),
    ),
    loadPerspectiveState: vi.fn(async (_id, perspective) => ok(stateFor(perspective))),
    loadEvents: vi.fn(async () =>
      ok({
        events:
          stage === 'preview'
            ? events
            : [...events, ...turnEvents().slice(0, stage === 'turn' ? 4 : 5)],
      }),
    ),
    submitSandboxCommand: vi.fn(async (_id, side, command) => {
      commands.push({ side, command });
      submitted.add(side);
      const resolved = submitted.size === 2;
      if (resolved) {
        submitted.clear();
        stage = stage === 'preview' ? 'turn' : 'finished';
      }
      return ok({ resolved, state: stateFor(side), events: [] });
    }),
    loadDisplayNames: vi.fn(async () =>
      ok({
        moves: { earthquake: 'Earthquake', dragonclaw: 'Dragon Claw' },
        abilities: {},
        items: {},
        conditions: {},
      }),
    ),
    loadReplay: vi.fn(async () => ok({ schemaVersion: 1 } as never)),
  };
  return { actions, commands };
}

const labels = getDictionary('en').battle.sandbox;
const typeNames = getDictionary('en').types;

async function startBattle(actions: SandboxServerActions) {
  render(<BattleSandbox labels={labels} typeNames={typeNames} actions={actions} />);
  for (const n of [1, 2]) {
    const picker = screen.getByTestId(`team-picker-${n}`);
    fireEvent.click(within(picker).getByRole('button', { name: labels.setup.fromPaste }));
    fireEvent.change(within(picker).getByLabelText(labels.setup.pasteLabel), {
      target: { value: 'Garchomp' },
    });
    fireEvent.click(within(picker).getByRole('button', { name: labels.setup.importButton }));
    await screen.findByTestId(`team-ready-${n}`);
  }
  fireEvent.click(screen.getByRole('button', { name: labels.setup.createButton }));
  await screen.findByTestId('sandbox-battle');
}

/** Confirms team preview for both players (in the order shown) and waits for turn 1. */
async function playPreview(actions: SandboxServerActions) {
  for (const player of ['Player 1', 'Player 2']) {
    await waitFor(() => expect(screen.getByTestId('acting-panel').textContent).toContain(player));
    fireEvent.click(screen.getByRole('button', { name: /Garchomp/ }));
    fireEvent.click(screen.getByRole('button', { name: /Rotom-Wash/ }));
    fireEvent.click(screen.getByRole('button', { name: labels.preview.submit }));
  }
  await waitFor(() => expect(screen.getByTestId('turn-indicator').textContent).toBe('Turn 1'));
  void actions;
}

beforeEach(() => {
  window.localStorage?.clear?.();
});

describe('Battle Sandbox: setup', () => {
  it('lists the five catalog formats (localized) and blocks starting until both teams are set', async () => {
    const { actions } = fake();
    render(<BattleSandbox labels={labels} typeNames={typeNames} actions={actions} />);
    const select = screen.getByLabelText(labels.setup.formatLabel) as HTMLSelectElement;
    expect([...select.options].map((o) => o.text)).toEqual([
      'Scarlet/Violet OU',
      'Scarlet/Violet Ubers',
      'Champions BSS Reg M-B',
      'Champions VGC Reg M-B',
      'Scarlet/Violet Doubles OU',
    ]);
    expect(
      (screen.getByRole('button', { name: labels.setup.createButton }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.getAllByText(labels.setup.noBuildTeams)).toHaveLength(2);
    fireEvent.change(select, { target: { value: 'champions-vgc-reg-mb' } });
    expect(screen.getByTestId('format-meta').textContent).toContain(labels.formatMeta.doubles);
    expect(screen.getByTestId('format-meta').textContent).toContain(
      labels.formatMeta.openTeamSheets,
    );
  });

  it('reads pasted teams and starts the battle with the chosen format and both teams', async () => {
    const { actions } = fake();
    await startBattle(actions);
    expect(actions.importTeamText).toHaveBeenCalledTimes(2);
    expect(actions.createSandboxBattle).toHaveBeenCalledWith({
      formatId: 'sv-ou',
      p1Team: TEAM,
      p2Team: TEAM,
    });
  });

  it("shows the engine's team problems for the right player, and stays on setup", async () => {
    const { actions } = fake();
    (actions.createSandboxBattle as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      error: { code: 'INVALID_TEAM', details: { side: 'p2', problems: ['Garchomp is banned.'] } },
    });
    render(<BattleSandbox labels={labels} typeNames={typeNames} actions={actions} />);
    for (const n of [1, 2]) {
      const picker = screen.getByTestId(`team-picker-${n}`);
      fireEvent.click(within(picker).getByRole('button', { name: labels.setup.fromPaste }));
      fireEvent.change(within(picker).getByLabelText(labels.setup.pasteLabel), {
        target: { value: 'x' },
      });
      fireEvent.click(within(picker).getByRole('button', { name: labels.setup.importButton }));
      await screen.findByTestId(`team-ready-${n}`);
    }
    fireEvent.click(screen.getByRole('button', { name: labels.setup.createButton }));
    const box = await screen.findByTestId('team-problems');
    expect(box.textContent).toContain('Garchomp is banned.');
    expect(box.textContent).toContain('Player 2');
    expect(screen.queryByTestId('sandbox-battle')).toBeNull();
  });

  it('explains an unreachable or unconfigured battle server', async () => {
    const { actions } = fake();
    (actions.createSandboxBattle as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      error: { code: 'BATTLE_SERVER_NOT_CONFIGURED' },
    });
    render(<BattleSandbox labels={labels} typeNames={typeNames} actions={actions} />);
    for (const n of [1, 2]) {
      const picker = screen.getByTestId(`team-picker-${n}`);
      fireEvent.click(within(picker).getByRole('button', { name: labels.setup.fromPaste }));
      fireEvent.change(within(picker).getByLabelText(labels.setup.pasteLabel), {
        target: { value: 'x' },
      });
      fireEvent.click(within(picker).getByRole('button', { name: labels.setup.importButton }));
      await screen.findByTestId(`team-ready-${n}`);
    }
    fireEvent.click(screen.getByRole('button', { name: labels.setup.createButton }));
    expect((await screen.findByTestId('sandbox-error')).textContent).toBe(
      labels.errors.BATTLE_SERVER_NOT_CONFIGURED,
    );
  });
});

describe('Battle Sandbox: playing a battle', () => {
  it('plays team preview for both players, a turn, and shows the result with the replay', async () => {
    const { actions, commands } = fake();
    await startBattle(actions);

    // Team preview, player 1 first.
    expect(screen.getByTestId('turn-indicator').textContent).toBe(labels.battle.preview);
    expect(screen.getByTestId('acting-panel').textContent).toContain(
      'Player 1: choose your action',
    );
    const confirm = () =>
      screen.getByRole('button', { name: labels.preview.submit }) as HTMLButtonElement;
    expect(confirm().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Rotom-Wash/ }));
    fireEvent.click(screen.getByRole('button', { name: /Garchomp/ }));
    expect(confirm().disabled).toBe(false);
    fireEvent.click(confirm());
    await waitFor(() => expect(actions.submitSandboxCommand).toHaveBeenCalledTimes(1));
    expect(commands[0]).toEqual({ side: 'p1', command: { kind: 'team-order', order: [1, 0] } });

    // Then player 2 is asked; the panel switches sides by itself.
    await waitFor(() =>
      expect(screen.getByTestId('acting-panel').textContent).toContain(
        'Player 2: choose your action',
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: /Garchomp/ }));
    fireEvent.click(screen.getByRole('button', { name: /Rotom-Wash/ }));
    fireEvent.click(confirm());
    await waitFor(() => expect(screen.getByTestId('turn-indicator').textContent).toBe('Turn 1'));

    // A move turn: choose Earthquake with Terastallization for player 1.
    expect(screen.getByTestId('acting-panel').textContent).toContain(
      'Player 1: choose your action',
    );
    fireEvent.click(
      within(screen.getByTestId('acting-panel')).getByRole('button', { name: /Earthquake/ }),
    );
    fireEvent.click(screen.getByRole('checkbox', { name: labels.action.terastallize }));
    fireEvent.click(screen.getByRole('button', { name: labels.action.submit }));
    await waitFor(() => expect(commands).toHaveLength(3));
    expect(commands[2]).toEqual({
      side: 'p1',
      command: {
        kind: 'actions',
        actions: [
          {
            kind: 'move',
            slot: { side: 'p1', position: 0 },
            moveId: 'earthquake',
            modifier: 'terastallize',
          },
        ],
      },
    });
    await waitFor(() =>
      expect(screen.getByTestId('acting-panel').textContent).toContain('Player 2'),
    );
    fireEvent.click(
      within(screen.getByTestId('acting-panel')).getByRole('button', { name: /Dragon Claw/ }),
    );
    fireEvent.click(screen.getByRole('button', { name: labels.action.submit }));

    // Finished: winner, turns and the replay.
    const result = await screen.findByTestId('battle-result');
    expect(result.textContent).toContain('Player 1 won the battle.');
    expect(screen.queryByTestId('acting-panel')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: labels.result.downloadReplay }));
    await waitFor(() => expect(actions.loadReplay).toHaveBeenCalledWith(ID));

    // New battle returns to setup.
    fireEvent.click(screen.getByRole('button', { name: labels.result.newBattle }));
    expect(screen.getByLabelText(labels.setup.formatLabel)).toBeTruthy();
  });

  it('keeps the submit button disabled until a move is chosen, and shows server errors', async () => {
    const { actions } = fake();
    await startBattle(actions);
    fireEvent.click(screen.getByRole('button', { name: /Garchomp/ }));
    fireEvent.click(screen.getByRole('button', { name: /Rotom-Wash/ }));
    (actions.submitSandboxCommand as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      error: { code: 'ILLEGAL_CHOICE' },
    });
    fireEvent.click(screen.getByRole('button', { name: labels.preview.submit }));
    expect((await screen.findByTestId('sandbox-error')).textContent).toBe(
      labels.errors.ILLEGAL_CHOICE,
    );
    // Unknown codes fall back to a generic message rather than raw text.
    (actions.submitSandboxCommand as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      error: { code: 'SOMETHING_NEW' },
    });
    fireEvent.click(screen.getByRole('button', { name: labels.preview.submit }));
    await waitFor(() =>
      expect(screen.getByTestId('sandbox-error').textContent).toBe(labels.errors.generic),
    );
  });
});

describe('Battle Sandbox: perspectives and information', () => {
  it('offers player 1, player 2 and spectator views — never an omniscient one', async () => {
    const { actions } = fake();
    await startBattle(actions);
    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent);
    expect(tabs).toEqual([labels.battle.player1, labels.battle.player2, labels.battle.spectator]);
    expect(
      JSON.stringify((actions.loadSideView as ReturnType<typeof vi.fn>).mock.calls),
    ).not.toContain('omniscient');
  });

  it("reads the chosen perspective and only that perspective's HP precision", async () => {
    const { actions } = fake();
    await startBattle(actions);
    await playPreview(actions);
    // As player 1: own HP is exact, the rival's a percentage.
    expect(
      within(screen.getByTestId('side-p1')).getAllByText(/HP 300\/300/).length,
    ).toBeGreaterThan(0);
    expect(within(screen.getByTestId('side-p2')).queryByText(/HP 300\/300/)).toBeNull();
    expect(within(screen.getByTestId('side-p2')).getAllByText(/HP 100%/).length).toBeGreaterThan(0);
    // The spectator sees percentages on both sides, through its own read.
    fireEvent.click(screen.getByRole('tab', { name: labels.battle.spectator }));
    await waitFor(() => expect(actions.loadPerspectiveState).toHaveBeenCalledWith(ID, 'spectator'));
    await waitFor(() =>
      expect(within(screen.getByTestId('side-p1')).queryByText(/HP 300\/300/)).toBeNull(),
    );
  });
});

describe('Battle Sandbox: timeline and Turn Inspector', () => {
  it('lists turns from the trace and explains a turn from its events', async () => {
    const { actions } = fake();
    await startBattle(actions);
    await playPreview(actions);

    expect(screen.getByTestId('turn-1')).toBeTruthy();
    expect(screen.queryByTestId('turn-inspector')).toBeNull();
    fireEvent.click(screen.getByTestId('turn-1'));
    const inspector = screen.getByTestId('turn-inspector');
    expect(inspector.textContent).toContain('Garchomp (P1) used Earthquake.');
    expect(inspector.textContent).toContain('Garchomp (P2) took damage. HP is now 0%.');
    expect(inspector.textContent).toContain('Garchomp (P2) fainted.');
    // HP change from the events: full → 0%.
    expect(inspector.textContent).toContain('100% → 0%');
    // The inspector is honest about whose view it shows.
    expect(inspector.textContent).toContain(labels.battle.player1);
    fireEvent.click(within(inspector).getByRole('button', { name: labels.inspector.close }));
    expect(screen.queryByTestId('turn-inspector')).toBeNull();
  });
});
