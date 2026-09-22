'use server';

import {
  getFormLearnsetForVersionGroup,
  getFormsBySlugs,
  type ComparablePokemonForm,
  type MoveSummary,
} from '@pokestudio/database';

import {
  calculateDamage,
  DamageInputError,
  type DamageCalculationResult,
  type DamageInputErrorCode,
} from '@pokestudio/damage';

import { DEFAULT_IVS, MAX_LEVEL, ZERO_EVS } from '@/lib/team-draft';
import { getPokemonDatabaseClient } from '@/lib/pokemon-database';

/**
 * Damage Lab's own Server Actions (Fase M3.1B). `'use server'` at the top
 * of the file is what actually keeps `@pokestudio/damage` (and therefore
 * `@smogon/calc`) out of the client bundle — the same guarantee
 * `apps/web/src/app/[locale]/build/actions.ts` already relies on, and
 * already grep-verified against the compiled client chunks (Fase 2B.3a/b,
 * repeated for this PR). No `server-only` package needed: Next's compiler
 * strips a Server Action's implementation out of every client bundle that
 * imports this file, replacing it with an RPC stub — that boundary is
 * enforced by the framework, not by an extra import guard.
 */

/** Simple Mode's fixed assumptions (task §7) — reused from Build's own constants, not redefined. */
export const DAMAGE_LAB_SIMPLE_LEVEL = MAX_LEVEL;
export const DAMAGE_LAB_SIMPLE_EVS = ZERO_EVS;
export const DAMAGE_LAB_SIMPLE_IVS = DEFAULT_IVS;

export interface AttackerReferenceData {
  form: ComparablePokemonForm | null;
  /** Already filtered to damage-dealing moves (physical/special — never status) for Simple Mode's picker (task §11). */
  moves: MoveSummary[];
}

/**
 * The attacker side's reference data once a form is selected: its full
 * `ComparablePokemonForm` plus its legal moves *for this one version
 * group only* — never the form's entire cross-generation learnset (task
 * §10), and never fetched before a form is actually selected.
 */
export async function fetchAttackerReferenceData(
  formSlug: string,
  versionGroupSlug: string,
): Promise<AttackerReferenceData> {
  const client = getPokemonDatabaseClient();
  const [forms, moves] = await Promise.all([
    getFormsBySlugs(client, [formSlug]),
    getFormLearnsetForVersionGroup(client, formSlug, versionGroupSlug),
  ]);
  return {
    form: forms[0] ?? null,
    moves: moves.filter((move) => move.damageClass !== 'status'),
  };
}

/** The defender side only ever needs its form — never a learnset (task §10). */
export async function fetchDefenderReferenceData(
  formSlug: string,
): Promise<ComparablePokemonForm | null> {
  const client = getPokemonDatabaseClient();
  const forms = await getFormsBySlugs(client, [formSlug]);
  return forms[0] ?? null;
}

export interface DamageLabCalculationRequest {
  generation: number;
  attackerFormSlug: string;
  attackerSpeciesSlug: string;
  defenderFormSlug: string;
  defenderSpeciesSlug: string;
  moveSlug: string;
}

export type DamageLabCalculationResponse =
  | { ok: true; result: DamageCalculationResult }
  | {
      ok: false;
      code: DamageInputErrorCode | 'unknown';
      side: 'attacker' | 'defender' | undefined;
    };

/**
 * Simple Mode's calculation — builds the full slug-native
 * `DamageCalculationInput` from just the two forms + move (everything else
 * is Simple Mode's fixed assumption set, task §7), calls
 * `@pokestudio/damage` directly (never `@smogon/calc`), and returns a
 * plain serializable result. `DamageInputError` maps to its own `code`
 * (+ `side` when present); anything else is logged server-side and
 * collapsed to a generic `'unknown'` code — no stack trace or internal
 * error string ever reaches the client (task §13).
 */
export async function calculateDamageAction(
  request: DamageLabCalculationRequest,
): Promise<DamageLabCalculationResponse> {
  try {
    const result = calculateDamage({
      generation: request.generation,
      attacker: {
        formSlug: request.attackerFormSlug,
        speciesSlug: request.attackerSpeciesSlug,
        level: DAMAGE_LAB_SIMPLE_LEVEL,
        abilitySlug: null,
        itemSlug: null,
        natureSlug: null,
        evs: DAMAGE_LAB_SIMPLE_EVS,
        ivs: DAMAGE_LAB_SIMPLE_IVS,
      },
      defender: {
        formSlug: request.defenderFormSlug,
        speciesSlug: request.defenderSpeciesSlug,
        level: DAMAGE_LAB_SIMPLE_LEVEL,
        abilitySlug: null,
        itemSlug: null,
        natureSlug: null,
        evs: DAMAGE_LAB_SIMPLE_EVS,
        ivs: DAMAGE_LAB_SIMPLE_IVS,
      },
      moveSlug: request.moveSlug,
      isCritical: false,
    });
    return { ok: true, result };
  } catch (error) {
    if (error instanceof DamageInputError) {
      return { ok: false, code: error.code, side: error.side };
    }
    // Server-side only — never reaches the client (task §13).
    console.error('calculateDamageAction: unexpected error', error);
    return { ok: false, code: 'unknown', side: undefined };
  }
}
