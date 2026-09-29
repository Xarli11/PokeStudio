import type { Battle, Pokemon } from 'pokemon-showdown';

import type {
  BattleBoostId,
  BattleHp,
  BattleMajorStatus,
  BattlePerspective,
  BattlePokemonRef,
  BattlePokemonState,
  BattleSideId,
  BattleSideState,
} from '../types';
import { parseHpText, toId } from './protocol';
import type { RevealedTracker } from './tracker';

/**
 * State projection by ALLOW-LIST: every public object is built field by field from an explicit
 * list. Nothing is copied from an engine object and then redacted, so a field nobody thought
 * about is simply absent instead of leaked. Opposing/public information about species,
 * moves, item and ability comes only from the perspective's `RevealedTracker`.
 */

const STATUSES: readonly string[] = ['brn', 'par', 'slp', 'frz', 'psn', 'tox'];
const BOOST_IDS: readonly BattleBoostId[] = [
  'atk',
  'def',
  'spa',
  'spd',
  'spe',
  'accuracy',
  'evasion',
];
/** Volatile conditions the battle announces publicly. Anything else is not projected. */
const PUBLIC_VOLATILES: readonly string[] = [
  'substitute',
  'confusion',
  'leechseed',
  'taunt',
  'encore',
  'torment',
  'disable',
  'yawn',
];

export interface ProjectionContext {
  battle: Battle;
  refs: ReadonlyMap<Pokemon, BattlePokemonRef>;
  displayNames: Readonly<Record<BattleSideId, string>>;
  /** Display nicknames by `teamIndex` (PokeStudio-side data; public to others only once the Pokémon has switched in). */
  nicknames: Readonly<Record<BattleSideId, readonly (string | undefined)[]>>;
}

function sharedHp(pokemon: Pokemon): BattleHp {
  const parsed = parseHpText(pokemon.getHealth().shared);
  if (!parsed || parsed.current === 0) return { kind: 'percent', percent: 0 };
  if (!parsed.max) return { kind: 'percent', percent: 1 };
  return { kind: 'percent', percent: Math.round((parsed.current * 100) / parsed.max) };
}

function commonFields(
  ctx: ProjectionContext,
  pokemon: Pokemon,
  ref: BattlePokemonRef,
  hp: BattleHp,
  showNickname: boolean,
): Pick<
  BattlePokemonState,
  'ref' | 'hp' | 'status' | 'fainted' | 'active' | 'boosts' | 'volatiles' | 'nickname' | 'slot'
> {
  const side = ctx.battle.getSide(ref.side);
  const position = side.active.indexOf(pokemon);
  const boosts: Partial<Record<BattleBoostId, number>> = {};
  for (const stat of BOOST_IDS) {
    const value = pokemon.boosts[stat];
    if (value) boosts[stat] = value;
  }
  const nickname = showNickname ? ctx.nicknames[ref.side][ref.teamIndex] : undefined;
  return {
    ref: { side: ref.side, teamIndex: ref.teamIndex },
    hp,
    status: STATUSES.includes(pokemon.status) ? (pokemon.status as BattleMajorStatus) : null,
    fainted: pokemon.fainted,
    active: position >= 0,
    boosts,
    volatiles: Object.keys(pokemon.volatiles).filter((id) => PUBLIC_VOLATILES.includes(id)),
    ...(nickname === undefined ? {} : { nickname }),
    ...(position >= 0 ? { slot: { side: ref.side, position } } : {}),
  };
}

/** Full information about a Pokémon: the owner's own view, or the omniscient view. */
function projectFull(
  ctx: ProjectionContext,
  pokemon: Pokemon,
  ref: BattlePokemonRef,
): BattlePokemonState {
  const moves = pokemon.moveSlots.map((slot) => ({
    id: slot.id,
    pp: slot.pp,
    maxPp: slot.maxpp,
    disabled: slot.disabled === true,
  }));
  return {
    ...commonFields(
      ctx,
      pokemon,
      ref,
      { kind: 'exact', current: pokemon.hp, max: pokemon.maxhp },
      true,
    ),
    species: pokemon.species.name,
    level: pokemon.level,
    gender: pokemon.gender === 'M' || pokemon.gender === 'F' ? pokemon.gender : 'N',
    types: [...pokemon.types],
    teraType: pokemon.teraType,
    ...(pokemon.terastallized ? { terastallized: pokemon.terastallized } : {}),
    ability: pokemon.ability,
    item: pokemon.item || null,
    moves,
    revealed: { ability: true, item: true, moves: moves.map((move) => move.id) },
  };
}

/** Public information only. Returns null for a Pokémon this audience has not been shown yet. */
function projectPublic(
  ctx: ProjectionContext,
  tracker: RevealedTracker,
  pokemon: Pokemon,
  ref: BattlePokemonRef,
): BattlePokemonState | null {
  const known = tracker.get(ref.side, ref.teamIndex);
  if (!known) return null;
  const moves = [...known.moves];
  return {
    // Team preview shows species only: a nickname becomes public when the Pokémon switches in.
    ...commonFields(ctx, pokemon, ref, sharedHp(pokemon), known.switchedIn),
    species: known.species,
    level: known.level,
    gender: known.gender,
    ...(pokemon.terastallized ? { terastallized: pokemon.terastallized } : {}),
    ...(known.ability ? { ability: toId(known.ability) } : {}),
    ...(known.item ? { item: toId(known.item) } : {}),
    ...(moves.length > 0 ? { moves: moves.map((id) => ({ id })) } : {}),
    revealed: {
      ability: known.ability !== undefined,
      item: known.item !== undefined,
      moves,
    },
  };
}

export function projectSide(
  ctx: ProjectionContext,
  sideId: BattleSideId,
  perspective: BattlePerspective,
  tracker: RevealedTracker,
): BattleSideState {
  const side = ctx.battle.getSide(sideId);
  const full = perspective === 'omniscient' || perspective === sideId;
  const project = (pokemon: Pokemon): BattlePokemonState | null => {
    const ref = ctx.refs.get(pokemon);
    if (!ref) return null;
    return full ? projectFull(ctx, pokemon, ref) : projectPublic(ctx, tracker, pokemon, ref);
  };
  const team = side.pokemon
    .map(project)
    .filter((state): state is BattlePokemonState => state !== null)
    .sort((a, b) => a.ref.teamIndex - b.ref.teamIndex);
  return {
    id: sideId,
    displayName: ctx.displayNames[sideId],
    teamSize: side.pokemon.length,
    pokemonLeft: side.pokemonLeft,
    active: side.active.map((pokemon) => (pokemon ? project(pokemon) : null)),
    team,
    sideConditions: tracker.conditions(tracker.sideConditions[sideId]),
  };
}
