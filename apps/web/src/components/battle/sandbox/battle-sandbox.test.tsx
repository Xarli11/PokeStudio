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
const FORK_ID = '11111111-d5a9-41d2-b136-1b2c3d4e5f60';
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

  const choicesFor = (side: BattleSideId, at: Stage = stage): BattleLegalChoices =>
    at === 'finished'
      ? { kind: 'wait', side }
      : at === 'preview'
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
    validateSandboxTeam: vi.fn(async () => ok({ valid: true as const })),
    loadSideView: vi.fn(async (_id, side): Promise<ActionResult<SideView>> =>
      ok({ state: stateFor(side), choices: choicesFor(side) }),
    ),
    loadPerspectiveState: vi.fn(async (_id, perspective) => ok(stateFor(perspective))),
    loadEvents: vi.fn(async (id: string) =>
      id === FORK_ID
        ? ok({
            events: [
              { seq: 3, turn: 1, type: 'turn-started' },
              {
                seq: 4,
                turn: 1,
                type: 'move-used',
                user: { side: 'p1', teamIndex: 0 },
                moveId: 'dragonclaw',
              },
              {
                seq: 5,
                turn: 1,
                parentSeq: 4,
                type: 'hp-changed',
                pokemon: { side: 'p2', teamIndex: 0 },
                hp: { kind: 'percent', percent: 40 },
                change: 'damage',
              },
            ] as BattleEvent[],
          })
        : ok({
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
    loadReplay: vi.fn(async () =>
      ok({
        schemaVersion: 1,
        commands: [
          { decision: 0, turn: 0, side: 'p1', command: { kind: 'team-order', order: [0, 1] } },
          { decision: 1, turn: 1, side: 'p1', command: { kind: 'actions', actions: [] } },
          { decision: 1, turn: 1, side: 'p2', command: { kind: 'actions', actions: [] } },
        ],
      } as never),
    ),
    loadDecisionView: vi.fn(async (_id, _decision, side): Promise<ActionResult<SideView>> =>
      ok({ state: stateFor(side), choices: choicesFor(side, 'turn') }),
    ),
    createFork: vi.fn(async () =>
      ok({
        battleId: FORK_ID,
        format: stateFor('p1').format,
        atDecision: 1,
        reused: ['p2' as const],
        pending: [],
      }),
    ),
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
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: labels.setup.createButton }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: labels.setup.createButton }));
  await screen.findByTestId('sandbox-battle');
}

/** Confirms team preview for both players (in the order shown) and waits for turn 1. */
async function playPreview(actions: SandboxServerActions) {
  for (const player of ['Player 1', 'Player 2']) {
    await waitFor(() => expect(screen.getByTestId('acting-panel').textContent).toContain(player));
    fireEvent.click(
      within(screen.getByTestId('acting-panel')).getByRole('button', { name: /Garchomp/ }),
    );
    fireEvent.click(
      within(screen.getByTestId('acting-panel')).getByRole('button', { name: /Rotom-Wash/ }),
    );
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
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: labels.setup.createButton }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
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
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: labels.setup.createButton }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
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
    expect(screen.getByTestId('acting-panel').textContent).toContain('Player 1 (now)');
    const confirm = () =>
      screen.getByRole('button', { name: labels.preview.submit }) as HTMLButtonElement;
    expect(confirm().disabled).toBe(true);
    fireEvent.click(
      within(screen.getByTestId('acting-panel')).getByRole('button', { name: /Rotom-Wash/ }),
    );
    fireEvent.click(
      within(screen.getByTestId('acting-panel')).getByRole('button', { name: /Garchomp/ }),
    );
    expect(confirm().disabled).toBe(false);
    fireEvent.click(confirm());
    await waitFor(() => expect(actions.submitSandboxCommand).toHaveBeenCalledTimes(1));
    expect(commands[0]).toEqual({ side: 'p1', command: { kind: 'team-order', order: [1, 0] } });

    // Then player 2 is asked; the panel switches sides by itself.
    await waitFor(() =>
      expect(screen.getByTestId('acting-panel').textContent).toContain('Player 2 (now)'),
    );
    fireEvent.click(
      within(screen.getByTestId('acting-panel')).getByRole('button', { name: /Garchomp/ }),
    );
    fireEvent.click(
      within(screen.getByTestId('acting-panel')).getByRole('button', { name: /Rotom-Wash/ }),
    );
    fireEvent.click(confirm());
    await waitFor(() => expect(screen.getByTestId('turn-indicator').textContent).toBe('Turn 1'));

    // A move turn: choose Earthquake with Terastallization for player 1.
    expect(screen.getByTestId('acting-panel').textContent).toContain('Player 1 (now)');
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
    fireEvent.click(
      within(screen.getByTestId('acting-panel')).getByRole('button', { name: /Garchomp/ }),
    );
    fireEvent.click(
      within(screen.getByTestId('acting-panel')).getByRole('button', { name: /Rotom-Wash/ }),
    );
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

    fireEvent.click(screen.getByRole('button', { name: /Show timeline/ }));
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

describe('Battle Sandbox: forks', () => {
  it('offers the fork only on a finished battle and shows original and alternative side by side', async () => {
    const { actions } = fake();
    await startBattle(actions);
    await playPreview(actions);
    fireEvent.click(screen.getByRole('button', { name: /Show timeline/ }));
    fireEvent.click(screen.getByTestId('turn-1'));
    // Mid-battle there is nothing to fork.
    expect(screen.queryByRole('button', { name: labels.inspector.tryDifferent })).toBeNull();

    for (const player of ['Player 1', 'Player 2']) {
      await waitFor(() => expect(screen.getByTestId('acting-panel').textContent).toContain(player));
      fireEvent.click(
        within(screen.getByTestId('acting-panel')).getByRole('button', { name: /Earthquake/ }),
      );
      fireEvent.click(screen.getByRole('button', { name: labels.action.submit }));
    }
    await screen.findByTestId('battle-result');
    // The timeline stays open from before the battle ended.
    fireEvent.click(screen.getByTestId('turn-1'));
    fireEvent.click(screen.getByRole('button', { name: labels.inspector.tryDifferent }));

    const panel = await screen.findByTestId('fork-panel');
    fireEvent.click(within(panel).getByRole('button', { name: 'Player 1' }));
    await waitFor(() => expect(actions.loadDecisionView).toHaveBeenCalledWith(ID, 1, 'p1'));
    fireEvent.click(await within(panel).findByRole('button', { name: /Dragon Claw/ }));
    fireEvent.click(within(panel).getByRole('button', { name: labels.action.submit }));

    await waitFor(() =>
      expect(actions.createFork).toHaveBeenCalledWith(ID, {
        atDecision: 1,
        side: 'p1',
        command: {
          kind: 'actions',
          actions: [{ kind: 'move', slot: { side: 'p1', position: 0 }, moveId: 'dragonclaw' }],
        },
      }),
    );
    const result = await screen.findByTestId('fork-result');
    await waitFor(() => expect(result.textContent).toContain('used Dragon Claw'));
    expect(result.textContent).toContain('used Earthquake'); // the original, untouched
    expect(result.textContent).toContain(labels.fork.original);
    expect(result.textContent).toContain(labels.fork.alternative);
    expect(result.textContent).toContain("Player 2's original play was applied again.");
    // Both are read through the perspective being viewed, never an omniscient one.
    expect(actions.loadEvents).toHaveBeenCalledWith(FORK_ID, 'p1', 0);
  });

  it('shows a fork error without breaking the panel', async () => {
    const { actions } = fake();
    await startBattle(actions);
    await playPreview(actions);
    for (const player of ['Player 1', 'Player 2']) {
      await waitFor(() => expect(screen.getByTestId('acting-panel').textContent).toContain(player));
      fireEvent.click(
        within(screen.getByTestId('acting-panel')).getByRole('button', { name: /Earthquake/ }),
      );
      fireEvent.click(screen.getByRole('button', { name: labels.action.submit }));
    }
    await screen.findByTestId('battle-result');
    (actions.createFork as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      error: { code: 'ILLEGAL_CHOICE' },
    });
    fireEvent.click(screen.getByRole('button', { name: labels.result.showTimeline }));
    fireEvent.click(screen.getByTestId('turn-1'));
    fireEvent.click(screen.getByRole('button', { name: labels.inspector.tryDifferent }));
    const panel = await screen.findByTestId('fork-panel');
    fireEvent.click(within(panel).getByRole('button', { name: 'Player 2' }));
    fireEvent.click(await within(panel).findByRole('button', { name: /Dragon Claw/ }));
    fireEvent.click(within(panel).getByRole('button', { name: labels.action.submit }));
    expect((await screen.findByTestId('fork-error')).textContent).toBe(
      labels.errors.ILLEGAL_CHOICE,
    );
    expect(screen.queryByTestId('fork-result')).toBeNull();
  });
});

async function importTeam(n: 1 | 2) {
  const picker = screen.getByTestId(`team-picker-${n}`);
  fireEvent.click(within(picker).getByRole('button', { name: labels.setup.fromPaste }));
  fireEvent.change(within(picker).getByLabelText(labels.setup.pasteLabel), {
    target: { value: 'Garchomp' },
  });
  fireEvent.click(within(picker).getByRole('button', { name: labels.setup.importButton }));
  await screen.findByTestId(`team-ready-${n}`);
}
const startButton = () =>
  screen.getByRole('button', { name: labels.setup.createButton }) as HTMLButtonElement;

describe('Battle Sandbox UX: setup', () => {
  it('explains what the sandbox is, in order: format, player 1, player 2', () => {
    const { actions } = fake();
    render(<BattleSandbox labels={labels} typeNames={typeNames} actions={actions} />);
    expect(screen.getByTestId('sandbox-purpose').textContent).toBe(
      'Control both sides to test teams, formats, and battle situations.',
    );
    const legends = [
      screen.getByText('1 · Format'),
      screen.getByText('2 · Player 1'),
      screen.getByText('3 · Player 2'),
    ];
    for (let i = 1; i < legends.length; i++) {
      expect(
        legends[i - 1]!.compareDocumentPosition(legends[i]!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it('summarises the chosen format from catalog metadata', () => {
    const { actions } = fake();
    render(<BattleSandbox labels={labels} typeNames={typeNames} actions={actions} />);
    const meta = () => screen.getByTestId('format-meta').textContent;
    expect(meta()).toBe('Singles · 1 active Pokémon');
    fireEvent.change(screen.getByLabelText(labels.setup.formatLabel), {
      target: { value: 'champions-vgc-reg-mb' },
    });
    expect(meta()).toBe('Doubles · 2 active Pokémon · Open team sheets');
  });

  it('shows each team’s status and says what is missing before Start is possible', async () => {
    const { actions } = fake();
    render(<BattleSandbox labels={labels} typeNames={typeNames} actions={actions} />);
    const status = (n: number) => screen.getByTestId(`team-status-${n}`);
    expect(status(1).textContent).toContain(labels.setup.statusEmpty);
    expect(startButton().disabled).toBe(true);
    expect(screen.getByTestId('start-help').textContent).toBe("Choose Player 1's team to start.");

    await importTeam(1);
    await waitFor(() => expect(status(1).dataset['status']).toBe('ready'));
    expect(status(1).textContent).toContain(labels.setup.statusReady);
    expect(startButton().disabled).toBe(true);
    expect(screen.getByTestId('start-help').textContent).toBe("Choose Player 2's team to start.");

    await importTeam(2);
    await waitFor(() => expect(startButton().disabled).toBe(false));
    expect(screen.getByTestId('start-help').dataset['ready']).toBe('true');
    expect(actions.validateSandboxTeam).toHaveBeenCalledWith('sv-ou', TEAM);
  });

  it('presents an illegal team with a friendly heading and the engine’s message as detail, and does not allow starting', async () => {
    const { actions } = fake();
    (actions.validateSandboxTeam as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      error: {
        code: 'INVALID_TEAM',
        details: { side: 'p1', problems: ['Spore is banned by Sleep Moves Clause.'] },
      },
    });
    render(<BattleSandbox labels={labels} typeNames={typeNames} actions={actions} />);
    await importTeam(1);
    await importTeam(2);
    const invalid = await screen.findByTestId('team-invalid-1');
    expect(invalid.textContent).toContain('This team is not valid for Scarlet/Violet OU.');
    expect(invalid.textContent).toContain('Detail: Spore is banned by Sleep Moves Clause.');
    expect(screen.getByTestId('team-status-1').textContent).toContain(labels.setup.statusInvalid);
    expect(startButton().disabled).toBe(true);
    expect(screen.getByTestId('start-help').textContent).toBe("Fix Player 1's team to start.");
    fireEvent.click(startButton());
    expect(actions.createSandboxBattle).not.toHaveBeenCalled();
  });

  it('blocks Start, with an explanation, when legality cannot be checked', async () => {
    const { actions } = fake();
    (actions.validateSandboxTeam as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      error: { code: 'BATTLE_SERVER_UNAVAILABLE' },
    });
    render(<BattleSandbox labels={labels} typeNames={typeNames} actions={actions} />);
    await importTeam(1);
    await importTeam(2);
    await waitFor(() =>
      expect(screen.getByTestId('team-status-1').dataset['status']).toBe('unavailable'),
    );
    expect(screen.getByTestId('team-status-detail-1').textContent).toContain(
      labels.errors.BATTLE_SERVER_UNAVAILABLE,
    );
    expect(startButton().disabled).toBe(true);
    expect(screen.getByTestId('start-help').textContent).toBe(labels.setup.startUnavailable);
  });

  it('has critical setup copy in both languages', () => {
    const es = getDictionary('es').battle.sandbox;
    expect(es.setup.purpose).toBe(
      'Controla ambos lados para probar equipos, formatos y situaciones de combate.',
    );
    expect(es.setup.createButton).toBe('Iniciar combate');
    expect(es.setup.statusReady).toBe('Equipo listo');
    expect(es.setup.statusInvalid).toBe('Necesita ajustes');
    expect(es.battle.resolving).toBe('Resolviendo turno…');
    expect(es.action.chooseAction).toBe('Elige una acción');
    expect(es.action.confirmTurn).toBe('Confirmar turno');
    expect(labels.action.chooseAction).toBe('Choose an action');
  });
});

describe('Battle Sandbox UX: during and after the battle', () => {
  it('always says who acts and with which Pokémon', async () => {
    const { actions } = fake();
    await startBattle(actions);
    await playPreview(actions);
    await waitFor(() =>
      expect(screen.getByTestId('actor-line').textContent).toBe('Player 1 · Garchomp'),
    );
    expect(screen.getByTestId('action-prompt').textContent).toBe(labels.action.chooseAction);
    expect(screen.getByTestId('turn-indicator').textContent).toBe('Turn 1');
    // Player 1 is now, player 2 is waiting.
    const states = [...screen.getByTestId('side-progress').querySelectorAll('li')].map((li) =>
      li.getAttribute('data-state'),
    );
    expect(states).toEqual(['current', 'pending']);
    // Only the first move step is on screen; a single Pokémon confirms directly.
    expect(screen.queryByRole('button', { name: labels.action.next })).toBeNull();
    expect(screen.getByRole('button', { name: labels.action.submit })).toBeTruthy();
  });

  it('shows that the turn is resolving and cannot be sent twice', async () => {
    const { actions } = fake();
    await startBattle(actions);
    await playPreview(actions);
    const before = (actions.submitSandboxCommand as ReturnType<typeof vi.fn>).mock.calls.length;
    let release: (value: unknown) => void = () => undefined;
    (actions.submitSandboxCommand as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => new Promise((resolve) => (release = resolve)),
    );
    fireEvent.click(
      within(screen.getByTestId('acting-panel')).getByRole('button', { name: /Earthquake/ }),
    );
    const confirm = screen.getByRole('button', { name: labels.action.submit });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect((await screen.findByTestId('resolving')).textContent).toBe(labels.battle.resolving);
    expect(actions.submitSandboxCommand).toHaveBeenCalledTimes(before + 1);
    release({ ok: true, data: { resolved: false, state: {}, events: [] } });
    await waitFor(() => expect(screen.queryByTestId('resolving')).toBeNull());
  });

  it('keeps the timeline out of the way during the battle and gives the result priority when it ends', async () => {
    const { actions } = fake();
    await startBattle(actions);
    await playPreview(actions);
    expect(screen.queryByTestId('turn-1')).toBeNull();
    for (const player of ['Player 1', 'Player 2']) {
      await waitFor(() => expect(screen.getByTestId('acting-panel').textContent).toContain(player));
      fireEvent.click(
        within(screen.getByTestId('acting-panel')).getByRole('button', { name: /Earthquake/ }),
      );
      fireEvent.click(screen.getByRole('button', { name: labels.action.submit }));
    }
    const result = await screen.findByTestId('battle-result');
    expect(result.querySelector('[data-testid="result-headline"]')?.textContent).toBe(
      'Player 1 won the battle.',
    );
    expect(screen.queryByTestId('turn-1')).toBeNull();
    // The fork is not offered next to the result: only from an opened turn.
    expect(screen.queryByRole('button', { name: labels.inspector.tryDifferent })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: labels.result.showTimeline }));
    expect(screen.getByTestId('turn-1')).toBeTruthy();
    expect(screen.queryByRole('button', { name: labels.inspector.tryDifferent })).toBeNull();
    fireEvent.click(screen.getByTestId('turn-1'));
    expect(screen.getByRole('button', { name: labels.inspector.tryDifferent })).toBeTruthy();
  });
});

describe('Battle Sandbox layout: mobile-first structure', () => {
  it('is one column by default, with the desktop side column and sticky offsets only at lg', async () => {
    const { actions } = fake();
    await startBattle(actions);
    await playPreview(actions);
    const grid = screen.getByTestId('acting-panel').parentElement!;
    const classes = grid.className.split(/\s+/);
    expect(classes).toContain('grid-cols-1');
    // The 28rem action column may only exist behind the desktop breakpoint.
    const columns = classes.filter((c) => c.includes('grid-cols-['));
    expect(columns.length).toBe(1);
    expect(columns.every((c) => c.startsWith('lg:'))).toBe(true);
    // No fixed or minimum widths outside lg on the panel and its grid.
    const panel = screen.getByTestId('acting-panel').className.split(/\s+/);
    expect(panel).toContain('min-w-0');
    expect(panel.filter((c) => /^(w-\[|min-w-\[|w-max|min-w-max)/.test(c))).toEqual([]);
    expect(panel.filter((c) => /^(w-\[|min-w-\[)/.test(c))).toEqual([]);
  });
});
