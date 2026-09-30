'use server';

import { battleServer } from '@/lib/battle/server-client';
import type {
  ActionResult,
  BattleCommand,
  BattleDisplayNames,
  BattleEvent,
  BattleLegalChoices,
  BattleReplay,
  BattleSideId,
  BattleState,
  BattleSubmitResult,
  BattleTeamInput,
  CreatedBattle,
  CreatedFork,
  ReadablePerspective,
  SideView,
} from '@/lib/battle/types';

/**
 * The Battle Sandbox's Server Actions. `'use server'` keeps everything here — including the battle
 * server URL and secret — out of the client bundle; the browser only ever calls these actions. Each
 * action validates its arguments before forwarding: only player and spectator perspectives can be
 * requested (there is no omniscient read), and the battle id must look like one.
 */
const BATTLE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FORMAT_ID = /^[a-z0-9-]{1,40}$/;

const invalid = (code = 'INVALID_CONFIG'): { ok: false; error: { code: string } } => ({
  ok: false,
  error: { code },
});

const isSide = (value: unknown): value is BattleSideId => value === 'p1' || value === 'p2';
const isPerspective = (value: unknown): value is ReadablePerspective =>
  value === 'p1' || value === 'p2' || value === 'spectator';
const isBattleId = (value: unknown): value is string =>
  typeof value === 'string' && BATTLE_ID.test(value);

export async function createSandboxBattle(input: {
  formatId: string;
  p1Team: BattleTeamInput;
  p2Team: BattleTeamInput;
}): Promise<ActionResult<CreatedBattle>> {
  if (!input || typeof input.formatId !== 'string' || !FORMAT_ID.test(input.formatId))
    return invalid();
  return battleServer<CreatedBattle>('POST', '/v1/battles', {
    formatId: input.formatId,
    sides: {
      p1: { displayName: 'Player 1', team: input.p1Team },
      p2: { displayName: 'Player 2', team: input.p2Team },
    },
  });
}

export async function importTeamText(
  text: string,
): Promise<ActionResult<{ team: BattleTeamInput }>> {
  if (typeof text !== 'string') return invalid();
  return battleServer<{ team: BattleTeamInput }>('POST', '/v1/teams/import', { text });
}

/** Asks the engine (through the battle server) whether a team is legal in a format, before starting. */
export async function validateSandboxTeam(
  formatId: string,
  team: BattleTeamInput,
): Promise<ActionResult<{ valid: true }>> {
  if (typeof formatId !== 'string' || !FORMAT_ID.test(formatId) || !team) return invalid();
  return battleServer<{ valid: true }>('POST', '/v1/teams/validate', { formatId, team });
}

/** What one side needs now: its own state and what it may do. */
export async function loadSideView(
  battleId: string,
  side: BattleSideId,
): Promise<ActionResult<SideView>> {
  if (!isBattleId(battleId) || !isSide(side)) return invalid();
  const [state, choices] = await Promise.all([
    battleServer<BattleState>('GET', `/v1/battles/${battleId}/state/${side}`),
    battleServer<BattleLegalChoices>('GET', `/v1/battles/${battleId}/choices/${side}`),
  ]);
  if (!state.ok) return state;
  // A finished battle has no choices: the state alone is the view.
  if (!choices.ok) {
    if (choices.error.code === 'BATTLE_FINISHED') {
      return { ok: true, data: { state: state.data, choices: { kind: 'wait', side } } };
    }
    return choices;
  }
  return { ok: true, data: { state: state.data, choices: choices.data } };
}

export async function loadPerspectiveState(
  battleId: string,
  perspective: ReadablePerspective,
): Promise<ActionResult<BattleState>> {
  if (!isBattleId(battleId) || !isPerspective(perspective)) return invalid();
  return battleServer<BattleState>('GET', `/v1/battles/${battleId}/state/${perspective}`);
}

export async function loadEvents(
  battleId: string,
  perspective: ReadablePerspective,
  afterSeq = 0,
): Promise<ActionResult<{ events: BattleEvent[] }>> {
  if (!isBattleId(battleId) || !isPerspective(perspective)) return invalid();
  if (!Number.isInteger(afterSeq) || afterSeq < 0) return invalid();
  return battleServer<{ events: BattleEvent[] }>(
    'GET',
    `/v1/battles/${battleId}/events/${perspective}?afterSeq=${afterSeq}`,
  );
}

export async function submitSandboxCommand(
  battleId: string,
  side: BattleSideId,
  command: BattleCommand,
): Promise<ActionResult<BattleSubmitResult>> {
  if (!isBattleId(battleId) || !isSide(side) || typeof command !== 'object' || command === null) {
    return invalid();
  }
  return battleServer<BattleSubmitResult>(
    'POST',
    `/v1/battles/${battleId}/commands/${side}`,
    command,
  );
}

export async function loadDisplayNames(): Promise<ActionResult<BattleDisplayNames>> {
  return battleServer<BattleDisplayNames>('GET', '/v1/names');
}

/** Only released by the battle server once the battle has finished. */
export async function loadReplay(battleId: string): Promise<ActionResult<BattleReplay>> {
  if (!isBattleId(battleId)) return invalid();
  return battleServer<BattleReplay>('GET', `/v1/battles/${battleId}/replay`);
}

const isDecision = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0;

/** What `side` could do at the boundary before a past decision. Finished battles only. */
export async function loadDecisionView(
  battleId: string,
  atDecision: number,
  side: BattleSideId,
): Promise<ActionResult<SideView>> {
  if (!isBattleId(battleId) || !isDecision(atDecision) || !isSide(side)) return invalid();
  return battleServer<SideView>('GET', `/v1/battles/${battleId}/decisions/${atDecision}/${side}`);
}

/** Forks a finished battle at a decision with a replacement command. The original is untouched. */
export async function createFork(
  battleId: string,
  input: { atDecision: number; side: BattleSideId; command: BattleCommand },
): Promise<ActionResult<CreatedFork>> {
  if (
    !isBattleId(battleId) ||
    !input ||
    !isDecision(input.atDecision) ||
    !isSide(input.side) ||
    typeof input.command !== 'object' ||
    input.command === null
  ) {
    return invalid();
  }
  return battleServer<CreatedFork>('POST', `/v1/battles/${battleId}/forks`, input);
}
