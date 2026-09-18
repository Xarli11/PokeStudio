import type { ComparablePokemonForm, FormLearnsetAllVersionGroups } from '@pokelab/database';
import {
  ALL_POKEMON_TYPES,
  generationForNationalDexNumber,
  getTypeEffectiveness,
} from '@pokelab/pokemon-data';
import type { DamageClass, PokemonType } from '@pokelab/pokemon-data';

import type { BuildGameCapabilities } from './build-game-capabilities';
import {
  MAX_EV_PER_STAT,
  MAX_EV_TOTAL,
  MAX_IV_PER_STAT,
  MAX_TEAM_MEMBERS,
  evTotal,
  type TeamDraft,
  type TeamMemberDraft,
} from './team-draft';

/**
 * Team-level analysis (Milestone 2, Stage 2B) — pure functions over already
 * -resolved reference data (a member's real types/abilities/legal moves),
 * kept separate from data-fetching so this stays unit-testable without a
 * database. Every count here is "type-based" (ability-driven immunities
 * like Levitate are deliberately excluded and labeled as such at the UI
 * layer) — task's explicit honesty requirement, not a gap.
 */

export interface TeamDefensiveCount {
  weak: number;
  resist: number;
  immune: number;
}

/** Present only for types that are notable for at least one member — an all-zero row is just omitted. */
export type TeamDefensiveProfile = Partial<Record<PokemonType, TeamDefensiveCount>>;

export function computeTeamDefensiveProfile(
  memberTypes: readonly (readonly PokemonType[])[],
): TeamDefensiveProfile {
  const profile: TeamDefensiveProfile = {};
  for (const attackingType of ALL_POKEMON_TYPES) {
    let weak = 0;
    let resist = 0;
    let immune = 0;
    for (const types of memberTypes) {
      const multiplier = getTypeEffectiveness(attackingType, types);
      if (multiplier === 0) immune++;
      else if (multiplier > 1) weak++;
      else if (multiplier < 1) resist++;
    }
    if (weak > 0 || resist > 0 || immune > 0) {
      profile[attackingType] = { weak, resist, immune };
    }
  }
  return profile;
}

/**
 * Super-effective type coverage from damaging moves only (task: "type-only,
 * not a damage calculation") — for each of the 18 defending types, is there
 * at least one non-status move on the team whose type is super effective
 * against it? Each defending type is checked mono-type-only (no simulated
 * dual-type opponent), matching how a coverage check is normally read.
 */
export function computeOffensiveCoverage(
  moves: readonly { type: PokemonType; damageClass: DamageClass }[],
): PokemonType[] {
  const damagingTypes = new Set(
    moves.filter((move) => move.damageClass !== 'status').map((move) => move.type),
  );
  return ALL_POKEMON_TYPES.filter((defendingType) =>
    [...damagingTypes].some(
      (attackingType) => getTypeEffectiveness(attackingType, [defendingType]) >= 2,
    ),
  );
}

export type TeamWarningCode =
  | 'incompleteTeam'
  | 'repeatedSevereWeakness'
  | 'noAbility'
  | 'invalidAbility'
  | 'noMoves'
  | 'duplicateMove'
  | 'illegalMove'
  | 'evTotalExceeded'
  | 'evStatExceeded'
  | 'invalidIv'
  | 'unsupportedRuleset'
  | 'speciesUnavailableInGeneration';

export type TeamWarningSeverity = 'incomplete' | 'warning' | 'invalid';

export interface TeamWarning {
  code: TeamWarningCode;
  severity: TeamWarningSeverity;
  memberId?: string;
  /** e.g. the repeated weak type, the offending move/ability slug. */
  detail?: string;
}

/**
 * Team status model (manual review v2, §8): `noAbility`/`noMoves` moved from
 * `warning` to `incomplete` here — an unfinished set isn't the same kind of
 * problem as a genuinely broken one (task's explicit examples: "no ability
 * selected" and "a member with no moves" are INCOMPLETE, not INVALID).
 * `repeatedSevereWeakness` stays `warning`: a real team-building red flag,
 * but advisory — it never blocks VALID (see `computeTeamStatus` below).
 */
const SEVERITY_BY_CODE: Record<TeamWarningCode, TeamWarningSeverity> = {
  incompleteTeam: 'incomplete',
  repeatedSevereWeakness: 'warning',
  noAbility: 'incomplete',
  invalidAbility: 'invalid',
  noMoves: 'incomplete',
  duplicateMove: 'invalid',
  illegalMove: 'invalid',
  evTotalExceeded: 'invalid',
  evStatExceeded: 'invalid',
  invalidIv: 'invalid',
  // 'incomplete', not 'invalid': PokeLab genuinely doesn't know whether
  // this configuration is legal for this historical/special-ruleset game —
  // that's an engine gap, not a proven mistake in the user's team (task
  // §18: distinguish "no known errors" from "proven fully valid"). Still
  // never lets `computeTeamStatus` return 'valid' while it's present.
  unsupportedRuleset: 'incomplete',
  // A real, provable legality fact (not an engine gap) whenever it can be
  // established at all — a species that debuted in a later generation
  // genuinely did not exist in an earlier game (final correction pass §3).
  speciesUnavailableInGeneration: 'invalid',
};

function warning(code: TeamWarningCode, memberId?: string, detail?: string): TeamWarning {
  return {
    code,
    severity: SEVERITY_BY_CODE[code],
    ...(memberId !== undefined ? { memberId } : {}),
    ...(detail !== undefined ? { detail } : {}),
  };
}

/** A team member's real, resolved data — what the draft's slugs actually refer to right now. */
export interface MemberValidationContext {
  types: PokemonType[];
  validAbilitySlugs: string[];
  legalMoveSlugs: string[];
  /** The underlying species' National Dex number — species-level only (never per-form), since that's the one generation-of-introduction fact PokeLab's data can actually prove (final correction pass §3). */
  nationalDexNumber: number;
}

/**
 * 3+ of a (at most 6-member) team weak to the same attacking type is a
 * genuinely notable team-building red flag (half the roster or more taking
 * extra damage from one type) — chosen as the threshold for "repeated",
 * rather than any 2, which is common and not actually notable.
 */
const REPEATED_WEAKNESS_THRESHOLD = 3;

export function computeTeamWarnings(
  draft: TeamDraft,
  contextByMemberId: ReadonlyMap<string, MemberValidationContext>,
  capabilities?: Partial<
    Pick<BuildGameCapabilities, 'fullyValidated' | 'abilities' | 'generation'>
  >,
): TeamWarning[] {
  // Defaults to `true` when no capabilities are passed at all — every
  // existing caller/test that predates the capability model expects
  // ability validation to run unconditionally; a caller that *does* know
  // its game context (namely `TeamEditor`) passes real capabilities and
  // correctly suppresses this for a game with no abilities (task §20: hide
  // the mechanic, never flag a fake "missing" ability for it).
  const abilitiesApply = capabilities?.abilities ?? true;
  // Undefined (not 0) when no capabilities were passed at all — species
  // -availability is a genuine legality fact, but only checkable once the
  // selected game's own generation is actually known (final correction pass
  // §3). No capabilities → no check, same "can't prove it, don't claim it"
  // default the ruleset-honesty warning above already uses.
  const selectedGameGeneration = capabilities?.generation;
  const warnings: TeamWarning[] = [];

  if (draft.members.length === 0 || draft.members.length < MAX_TEAM_MEMBERS) {
    warnings.push(warning('incompleteTeam'));
  }

  // Team-wide, not per-member (task §18/§32: "team-wide non-member issue has
  // no fake Review action") — whole-ruleset honesty applies to the team,
  // not to any one Pokémon.
  if (capabilities && !capabilities.fullyValidated) {
    warnings.push(warning('unsupportedRuleset'));
  }

  const memberTypesForProfile: PokemonType[][] = [];

  for (const member of draft.members) {
    const context = contextByMemberId.get(member.id);
    if (!context) continue; // reference data not loaded yet — nothing to validate against.
    memberTypesForProfile.push(context.types);

    if (selectedGameGeneration !== undefined) {
      const introducedGeneration = generationForNationalDexNumber(context.nationalDexNumber);
      // `undefined` means a Dex number beyond the currently-known ranges —
      // nothing to honestly compare against, so this is skipped rather than
      // guessed (same "don't invent it" rule as everywhere else here).
      if (introducedGeneration !== undefined && introducedGeneration > selectedGameGeneration) {
        warnings.push(warning('speciesUnavailableInGeneration', member.id));
      }
    }

    if (abilitiesApply) {
      if (member.abilitySlug === null) {
        warnings.push(warning('noAbility', member.id));
      } else if (!context.validAbilitySlugs.includes(member.abilitySlug)) {
        warnings.push(warning('invalidAbility', member.id, member.abilitySlug));
      }
    }

    const selectedMoves = member.moveSlugs.filter((slug): slug is string => slug !== null);
    if (selectedMoves.length === 0) {
      warnings.push(warning('noMoves', member.id));
    }
    const seenMoves = new Set<string>();
    for (const moveSlug of selectedMoves) {
      if (seenMoves.has(moveSlug)) {
        warnings.push(warning('duplicateMove', member.id, moveSlug));
      }
      seenMoves.add(moveSlug);
      if (!context.legalMoveSlugs.includes(moveSlug)) {
        warnings.push(warning('illegalMove', member.id, moveSlug));
      }
    }

    if (evTotal(member.evs) > MAX_EV_TOTAL) {
      warnings.push(warning('evTotalExceeded', member.id));
    }
    for (const value of Object.values(member.evs)) {
      if (value < 0 || value > MAX_EV_PER_STAT) {
        warnings.push(warning('evStatExceeded', member.id));
        break;
      }
    }
    for (const value of Object.values(member.ivs)) {
      if (value < 0 || value > MAX_IV_PER_STAT) {
        warnings.push(warning('invalidIv', member.id));
        break;
      }
    }
  }

  const profile = computeTeamDefensiveProfile(memberTypesForProfile);
  for (const [type, count] of Object.entries(profile) as [PokemonType, TeamDefensiveCount][]) {
    if (count.weak >= REPEATED_WEAKNESS_THRESHOLD) {
      warnings.push(warning('repeatedSevereWeakness', undefined, type));
    }
  }

  return warnings;
}

/**
 * The one derived team status (manual review v2, §8) — never persisted,
 * since it's always cheaply recomputable from a draft's own warnings.
 * `invalid` takes precedence over `incomplete` (a team can be both under-6
 * *and* hold an illegal move at once — the illegal move is the more urgent
 * fact), and a `warning`-severity item (e.g. a repeated shared weakness)
 * never blocks `valid` — it's advisory, not a blocker, matching the task's
 * own "no incomplete requirements + no invalid issues" definition of VALID.
 */
export type TeamStatus = 'incomplete' | 'invalid' | 'valid';

export function computeTeamStatus(warnings: readonly TeamWarning[]): TeamStatus {
  if (warnings.some((item) => item.severity === 'invalid')) return 'invalid';
  if (warnings.some((item) => item.severity === 'incomplete')) return 'incomplete';
  return 'valid';
}

/** A group of members that share the same underlying species. */
export interface SpeciesDuplicateGroup {
  speciesSlug: string;
  memberIds: string[];
}

/**
 * Detects members that share the same underlying SPECIES — by stable
 * `speciesSlug`, never `formSlug` — so Rotom-Wash and Rotom-Heat (two
 * different forms of the same species) are caught together, not treated as
 * unrelated Pokémon (manual review v3, §2).
 *
 * Deliberately NOT wired into `computeTeamWarnings`/`computeTeamStatus`:
 * whether duplicate species are even a problem depends on a competitive
 * format's own Species Clause, which Build v1 has no concept of yet.
 * Generic/casual Build intentionally allows running the same species twice.
 * This exists purely as the reusable primitive a future format-aware
 * ruleset would call — e.g. `format.hasSpeciesClause && findDuplicateSpecies(...).length > 0`.
 */
export function findDuplicateSpecies(
  members: readonly Pick<TeamMemberDraft, 'id' | 'formSlug'>[],
  formsBySlug: ReadonlyMap<string, Pick<ComparablePokemonForm, 'speciesSlug'>>,
): SpeciesDuplicateGroup[] {
  const memberIdsBySpecies = new Map<string, string[]>();
  for (const member of members) {
    const speciesSlug = formsBySlug.get(member.formSlug)?.speciesSlug;
    if (!speciesSlug) continue; // form not resolved yet — nothing to compare.
    const group = memberIdsBySpecies.get(speciesSlug) ?? [];
    group.push(member.id);
    memberIdsBySpecies.set(speciesSlug, group);
  }
  const duplicates: SpeciesDuplicateGroup[] = [];
  for (const [speciesSlug, memberIds] of memberIdsBySpecies) {
    if (memberIds.length > 1) duplicates.push({ speciesSlug, memberIds });
  }
  return duplicates;
}

/**
 * Resolves each member's real, current validation context (types/valid
 * abilities/legal moves for the draft's own version group) from already
 * -fetched reference data — factored out so `TeamEditor` (one team) and
 * `BuildHome`'s "My Teams" status badges (every saved team, one batched
 * fetch) share the exact same logic instead of two hand-rolled copies of it.
 * A member whose form hasn't resolved yet is simply absent from the map —
 * the caller then correctly has nothing to validate it against.
 */
export function buildMemberValidationContexts(
  members: readonly TeamMemberDraft[],
  versionGroupSlug: string,
  formsBySlug: ReadonlyMap<string, ComparablePokemonForm>,
  learnsetsByFormSlug: Readonly<Record<string, FormLearnsetAllVersionGroups>>,
): Map<string, MemberValidationContext> {
  const map = new Map<string, MemberValidationContext>();
  for (const member of members) {
    const form = formsBySlug.get(member.formSlug);
    if (!form) continue;
    const learnset = learnsetsByFormSlug[member.formSlug];
    const legalMoveSlugs = (learnset?.entries ?? [])
      .filter((entry) => entry.versionGroupSlug === versionGroupSlug)
      .map((entry) => entry.moveSlug);
    map.set(member.id, {
      types: form.types,
      validAbilitySlugs: form.abilities.map((ability) => ability.slug),
      legalMoveSlugs,
      nationalDexNumber: form.nationalDexNumber,
    });
  }
  return map;
}
