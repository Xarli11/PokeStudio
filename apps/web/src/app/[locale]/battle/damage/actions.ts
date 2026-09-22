'use server';

import {
  getFormLearnsetForVersionGroup,
  getFormsBySlugs,
  listItems,
  listNatures,
  type ComparablePokemonForm,
  type Item,
  type MoveSummary,
  type Nature,
} from '@pokestudio/database';

import {
  calculateDamage,
  DamageInputError,
  type DamageCalculationResult,
  type DamageInputErrorCode,
  type StatSpread,
} from '@pokestudio/damage';
import type { PokemonType } from '@pokestudio/pokemon-data';

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

export interface AdvancedReferenceData {
  natures: Nature[];
  items: Item[];
}

/**
 * Advanced's own reference data — natures + items only, never the species
 * search index Damage Lab's page already loaded (task §16: "NO quiero
 * volver a descargar el searchIndex solo para conseguir natures/items").
 * A Server Action rather than a new `/api/*` route or reusing
 * `/api/build-reference-data`: that endpoint bundles the whole ~95KB/19KB
 * gzip search index in with natures/items specifically because Team
 * Editor needs all three behind one deferred fetch — Damage Lab needs
 * neither the search index (already has its own) nor that endpoint's
 * release-SHA cache-versioning (this is interaction-gated, fetched at most
 * once per page load, not worth a new cacheable route for). `listNatures`/
 * `listItems` are the exact same `@pokestudio/database` queries that
 * endpoint calls — reused directly, no new query, no new route file
 * (Ponytail: smallest correct solution). Called once, the first time either
 * side's Advanced panel is opened — never on initial page load (task §16).
 */
export async function fetchAdvancedReferenceData(): Promise<AdvancedReferenceData> {
  const client = getPokemonDatabaseClient();
  const [natures, items] = await Promise.all([listNatures(client), listItems(client)]);
  return { natures, items };
}

export interface DamageLabCombatantRequest {
  formSlug: string;
  speciesSlug: string;
  level: number;
  abilitySlug: string | null;
  itemSlug: string | null;
  natureSlug: string | null;
  evs: StatSpread;
  ivs: StatSpread;
  /** Already resolved to the effective value — `null` whenever Terastallize is off (task §11), never a raw UI `teraEnabled` flag. */
  teraType: PokemonType | null;
}

export interface DamageLabCalculationRequest {
  generation: number;
  attacker: DamageLabCombatantRequest;
  defender: DamageLabCombatantRequest;
  moveSlug: string;
  isCritical: boolean;
}

export type DamageLabCalculationResponse =
  | { ok: true; result: DamageCalculationResult }
  | {
      ok: false;
      code: DamageInputErrorCode | 'unknown';
      side: 'attacker' | 'defender' | undefined;
    };

function toDamageCombatant(combatant: DamageLabCombatantRequest) {
  return {
    formSlug: combatant.formSlug,
    speciesSlug: combatant.speciesSlug,
    level: combatant.level,
    abilitySlug: combatant.abilitySlug,
    itemSlug: combatant.itemSlug,
    natureSlug: combatant.natureSlug,
    evs: combatant.evs,
    ivs: combatant.ivs,
    teraType: combatant.teraType,
  };
}

/**
 * Damage Lab's calculation — builds the full slug-native
 * `DamageCalculationInput` from the two combatants' complete configuration
 * (task §17), calls `@pokestudio/damage` directly (never `@smogon/calc`),
 * and returns a plain serializable result. Simple Mode and Advanced share
 * this one path: Simple Mode's fixed assumptions (task §7) are just
 * `DamageAdvancedConfig`'s own default values (`DAMAGE_LAB_SIMPLE_LEVEL`/
 * `_EVS`/`_IVS` below, plus `null` ability/item/nature/tera) — the client
 * builds the same request shape either way, so there is no separate
 * "simple" code path here to keep in sync. `DamageInputError` maps to its
 * own `code` (+ `side` when present); anything else is logged server-side
 * and collapsed to a generic `'unknown'` code — no stack trace or internal
 * error string ever reaches the client (task §13).
 */
export async function calculateDamageAction(
  request: DamageLabCalculationRequest,
): Promise<DamageLabCalculationResponse> {
  try {
    const result = calculateDamage({
      generation: request.generation,
      attacker: toDamageCombatant(request.attacker),
      defender: toDamageCombatant(request.defender),
      moveSlug: request.moveSlug,
      isCritical: request.isCritical,
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
