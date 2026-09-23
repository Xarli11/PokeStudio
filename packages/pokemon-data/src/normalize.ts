import { assertValidSlug, classifyForm, detectRegionLabel, pickPrimaryForm } from './classify';
import type {
  PokeApiAbility,
  PokeApiEffectEntry,
  PokeApiEvolutionChain,
  PokeApiEvolutionChainLink,
  PokeApiItem,
  PokeApiMachine,
  PokeApiMove,
  PokeApiMoveLearnMethod,
  PokeApiNature,
  PokeApiPokemon,
  PokeApiPokemonAbility,
  PokeApiPokemonForm,
  PokeApiPokemonMove,
  PokeApiPokemonSpecies,
  PokeApiVersionGroup,
} from './pokeapi-client';
import type {
  BaseStatKey,
  BaseStats,
  DamageClass,
  FormCategory,
  LocalizedName,
  MoveStat,
  NormalizedAbility,
  NormalizedEvolution,
  NormalizedForm,
  NormalizedFormAbility,
  NormalizedItem,
  NormalizedLearnMethod,
  NormalizedLearnsetEntry,
  NormalizedMachine,
  NormalizedMove,
  NormalizedNature,
  NormalizedSpecies,
  NormalizedVersionGroup,
  PokemonType,
} from './types';

/** PokéAPI generation slugs are roman numerals ("generation-i".."generation-ix"); the schema stores the plain 1-9 number (species/species_evolution already use this convention). */
const ROMAN_GENERATION_NUMERALS: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
};

export function parseGenerationSlug(generationSlug: string): number {
  const roman = generationSlug.replace(/^generation-/, '');
  const value = ROMAN_GENERATION_NUMERALS[roman];
  if (!value) throw new Error(`Unrecognized generation slug "${generationSlug}"`);
  return value;
}

function findLocalized(
  names: { name: string; language: { name: string } }[],
  language: string,
): string | undefined {
  return names.find((entry) => entry.language.name === language)?.name;
}

function localizedFrom(names: { name: string; language: { name: string } }[]): LocalizedName {
  const en = findLocalized(names, 'en');
  const es = findLocalized(names, 'es');
  if (!en || !es) {
    throw new Error(`Missing en/es localized name (got en=${en ?? '?'}, es=${es ?? '?'})`);
  }
  return { en, es };
}

export function normalizeSpecies(params: {
  species: PokeApiPokemonSpecies;
  sourceId: string;
}): NormalizedSpecies {
  const slug = params.species.name;
  assertValidSlug(slug, `species #${params.species.id}`);
  return {
    slug,
    nationalDexNumber: params.species.id,
    name: localizedFrom(params.species.names),
    source: { sourceId: params.sourceId, externalId: String(params.species.id) },
  };
}

/**
 * Resolves a non-default form's localized display name.
 *
 * PokéAPI's `pokemon-form` resource is inconsistent across form groups:
 * - `names` (full "Species Form" name) is reliable for English but is
 *   frequently missing Spanish entirely.
 * - `form_names` fills that Spanish gap for *some* form groups (Rotom's
 *   appliance formes: the full name, e.g. "Rotom Calor") but means something
 *   else for others (regional formes: a generic "Forma de Alola"-style
 *   descriptor, not "Meowth de Alola") and for cosmetic sub-forms (just the
 *   pattern/letter/flavor word, e.g. "Meadow", not the species name).
 *
 * So the fallback differs by category:
 * - `regional`: compose `"{species} de {region}"` for Spanish — the real,
 *   consistent Nintendo localization pattern for every regional form, not a
 *   per-Pokémon hardcode.
 * - Gigantamax (`form_name === 'gmax'`, PokéAPI's own consistent signal for
 *   every Gigantamax form, generation-agnostic): compose "Gigantamax
 *   {species}" / "{species} Gigamax" — the real Nintendo localization
 *   pattern, not the raw technical descriptor ("Venusaur (gmax)"). English
 *   already has this from PokéAPI's own `names` directly for every gmax form
 *   as of this ingestion; the composed string is a defensive fallback plus
 *   the actual fix for Spanish, which PokéAPI never localizes for gmax.
 * - anything else (`battle`, `cosmetic`): `names[lang] ?? form_names[lang]`,
 *   falling back further to `"{species} {form_names[lang]}"` when even that
 *   is missing, so a bare descriptor is never shown alone without the
 *   species name attached (avoids "Meadow" standing in for "Meadow
 *   Vivillon").
 */
export type FormNameSource = 'api' | 'composed-regional' | 'composed-fallback';

export function resolveFormName(params: {
  form: PokeApiPokemonForm;
  category: FormCategory;
  speciesName: LocalizedName;
  /** Required for `category: 'regional'` — the region's proper noun, e.g. "Alola". Identical in en/es. */
  regionLabel?: string | undefined;
}): { name: LocalizedName; esSource: FormNameSource } {
  const namesEn = findLocalized(params.form.names, 'en');
  const namesEs = findLocalized(params.form.names, 'es');

  if (params.category === 'regional') {
    if (!params.regionLabel) throw new Error('regionLabel is required for regional forms');
    return {
      name: {
        en: namesEn ?? `${params.regionLabel} ${params.speciesName.en}`,
        es: namesEs ?? `${params.speciesName.es} de ${params.regionLabel}`,
      },
      esSource: namesEs ? 'api' : 'composed-regional',
    };
  }

  const formNamesEn = findLocalized(params.form.form_names, 'en');
  const formNamesEs = findLocalized(params.form.form_names, 'es');
  const descriptor = params.form.form_name || params.form.name;

  if (descriptor === 'gmax') {
    return {
      name: {
        en: namesEn ?? formNamesEn ?? `Gigantamax ${params.speciesName.en}`,
        es: namesEs ?? formNamesEs ?? `${params.speciesName.es} Gigamax`,
      },
      esSource: namesEs ? 'api' : formNamesEs ? 'api' : 'composed-fallback',
    };
  }

  return {
    name: {
      en: namesEn ?? formNamesEn ?? `${params.speciesName.en} (${descriptor})`,
      es: namesEs ?? formNamesEs ?? `${params.speciesName.es} (${descriptor})`,
    },
    esSource: namesEs ? 'api' : formNamesEs ? 'api' : 'composed-fallback',
  };
}

function findStat(stats: { base_stat: number; stat: { name: string } }[], name: string): number {
  const stat = stats.find((entry) => entry.stat.name === name);
  if (!stat) throw new Error(`Missing stat "${name}"`);
  return stat.base_stat;
}

function baseStatsFrom(stats: { base_stat: number; stat: { name: string } }[]): BaseStats {
  return {
    hp: findStat(stats, 'hp'),
    attack: findStat(stats, 'attack'),
    defense: findStat(stats, 'defense'),
    specialAttack: findStat(stats, 'special-attack'),
    specialDefense: findStat(stats, 'special-defense'),
    speed: findStat(stats, 'speed'),
  };
}

function typesEqual(a: readonly PokemonType[], b: readonly PokemonType[]): boolean {
  return a.length === b.length && a.every((type, index) => type === b[index]);
}

function statsEqual(a: BaseStats, b: BaseStats): boolean {
  return (
    a.hp === b.hp &&
    a.attack === b.attack &&
    a.defense === b.defense &&
    a.specialAttack === b.specialAttack &&
    a.specialDefense === b.specialDefense &&
    a.speed === b.speed
  );
}

/** One `pokemon` (variety) plus the raw detail of every `pokemon-form` under it. */
export interface RawVarietyGroup {
  pokemon: PokeApiPokemon;
  isDefaultVariety: boolean;
  forms: PokeApiPokemonForm[];
}

/** Everything fetched for one species — the unit `normalizeSpeciesGroup` transforms. */
export interface RawSpeciesGroup {
  species: PokeApiPokemonSpecies;
  varieties: RawVarietyGroup[];
}

export interface LocalizationNote {
  formSlug: string;
  esSource: FormNameSource;
}

export function normalizeSpeciesGroup(
  group: RawSpeciesGroup,
  sourceId: string,
): {
  species: NormalizedSpecies;
  forms: NormalizedForm[];
  formAbilities: NormalizedFormAbility[];
  formMoves: NormalizedLearnsetEntry[];
  localizationNotes: LocalizationNote[];
} {
  const species = normalizeSpecies({ species: group.species, sourceId });
  const localizationNotes: LocalizationNote[] = [];
  const formAbilities: NormalizedFormAbility[] = [];
  const formMoves: NormalizedLearnsetEntry[] = [];

  const varietyShapes = group.varieties.map((variety) => {
    const types = [...variety.pokemon.types]
      .sort((a, b) => a.slot - b.slot)
      .map((entry) => entry.type.name as PokemonType);
    if (types.length < 1 || types.length > 2) {
      throw new Error(`Expected 1-2 types for ${variety.pokemon.name}, got ${types.length}`);
    }
    return { variety, types, baseStats: baseStatsFrom(variety.pokemon.stats) };
  });
  const defaultShape = varietyShapes.find((shape) => shape.variety.isDefaultVariety);

  const forms = varietyShapes.flatMap(({ variety, types, baseStats }) => {
    const primaryForm = pickPrimaryForm(variety.forms, variety.pokemon.name);

    return variety.forms.map((form) => {
      const isPrimaryForm = form === primaryForm;
      const regionLabel = detectRegionLabel(variety.pokemon.name);
      const mechanicallyDifferentFromDefault = defaultShape
        ? !typesEqual(types, defaultShape.types) || !statsEqual(baseStats, defaultShape.baseStats)
        : false;
      const category = classifyForm({
        isDefaultVariety: variety.isDefaultVariety,
        isPrimaryForm,
        isMega: form.is_mega,
        isBattleOnly: form.is_battle_only,
        regionLabel,
        mechanicallyDifferentFromDefault,
      });
      const isDefault = variety.isDefaultVariety && isPrimaryForm;

      const slug = form.name;
      assertValidSlug(slug, `form of species "${species.slug}"`);

      let name: LocalizedName;
      if (isDefault) {
        name = species.name;
      } else {
        const resolved = resolveFormName({
          form,
          category,
          speciesName: species.name,
          regionLabel,
        });
        name = resolved.name;
        if (resolved.esSource !== 'api') {
          localizationNotes.push({ formSlug: slug, esSource: resolved.esSource });
        }
      }

      const normalized: NormalizedForm = {
        slug,
        speciesSlug: species.slug,
        name,
        isDefault,
        category,
        types,
        baseStats,
        source: { sourceId, externalId: String(form.id) },
        // The variety's own `pokemon` resource id — never `form.id` above,
        // which is the separate `pokemon-form` resource's id (see this
        // field's own doc comment on `NormalizedForm`).
        pokeapiPokemonId: variety.pokemon.id,
      };
      formAbilities.push(...normalizeFormAbilities(slug, variety.pokemon.abilities));
      formMoves.push(...normalizeFormMoves(slug, variety.pokemon.moves));
      return normalized;
    });
  });

  return { species, forms, formAbilities, formMoves, localizationNotes };
}

/**
 * Abilities are a per-variety (`pokemon`) attribute in PokéAPI, not
 * per-`pokemon-form` — every cosmetic sub-form under one variety shares its
 * variety's abilities, same as it shares its variety's types/base stats.
 */
export function normalizeFormAbilities(
  formSlug: string,
  abilities: readonly PokeApiPokemonAbility[],
): NormalizedFormAbility[] {
  return abilities.map((entry) => ({
    formSlug,
    abilitySlug: entry.ability.name,
    slot: entry.slot,
    isHidden: entry.is_hidden,
  }));
}

/**
 * Moves are a per-variety (`pokemon`) attribute in PokéAPI, same as
 * abilities — every cosmetic sub-form under one variety shares its variety's
 * learnset (`normalizeFormAbilities` above documents the identical reasoning).
 * One entry per (move, version group, method, level) triple the variety's
 * `moves[]` array actually contains — level is part of the natural key
 * because the same triple can occur at two different levels (docs/adr/0013).
 * `moveSlug` runs through the same `sanitizeMoveSlug` as `normalizeMove`'s
 * own slug — without it, a Z-Move variant's raw `--physical`/`--special`
 * name here would no longer match its canonical (sanitized) move slug and
 * every such learnset entry would become a silent orphan.
 */
export function normalizeFormMoves(
  formSlug: string,
  moves: readonly PokeApiPokemonMove[],
): NormalizedLearnsetEntry[] {
  const entries: NormalizedLearnsetEntry[] = [];
  for (const moveEntry of moves) {
    for (const detail of moveEntry.version_group_details) {
      entries.push({
        formSlug,
        moveSlug: sanitizeMoveSlug(moveEntry.move.name),
        versionGroupSlug: detail.version_group.name,
        learnMethodSlug: detail.move_learn_method.name,
        level: detail.level_learned_at,
        sortOrder: detail.order ?? undefined,
      });
    }
  }
  return entries;
}

function findEffectText(
  entries: readonly PokeApiEffectEntry[],
  language: string,
): string | undefined {
  const entry = entries.find((e) => e.language.name === language);
  if (!entry) return undefined;
  return entry.short_effect.trim() || entry.effect.trim() || undefined;
}

/**
 * Normalizes one canonical ability (Phase 1C.1, Part A). Spanish name/effect
 * are left `undefined` — never invented — when PokéAPI doesn't provide them;
 * see docs/engineering/DATA_SOURCES.md for how common that gap is at full-dataset scale.
 */
export function normalizeAbility(params: {
  ability: PokeApiAbility;
  sourceId: string;
}): NormalizedAbility {
  const slug = params.ability.name;
  assertValidSlug(slug, `ability #${params.ability.id}`);
  const nameEn = findLocalized(params.ability.names, 'en');
  if (!nameEn) throw new Error(`Missing en name for ability "${slug}"`);

  return {
    slug,
    nameEn,
    nameEs: findLocalized(params.ability.names, 'es'),
    effectEn: findEffectText(params.ability.effect_entries, 'en'),
    effectEs: findEffectText(params.ability.effect_entries, 'es'),
    source: { sourceId: params.sourceId, externalId: String(params.ability.id) },
  };
}

/**
 * Normalizes one canonical nature (Milestone 2, Stage 2.0). Neutral natures
 * (Hardy, Docile, Bashful, Quirky, Serious) have both `increased_stat` and
 * `decreased_stat` null upstream — left `undefined` together here, never
 * invented as a fake "no-op" stat pair.
 */
export function normalizeNature(params: {
  nature: PokeApiNature;
  sourceId: string;
}): NormalizedNature {
  const slug = params.nature.name;
  assertValidSlug(slug, `nature #${params.nature.id}`);
  const nameEn = findLocalized(params.nature.names, 'en');
  if (!nameEn) throw new Error(`Missing en name for nature "${slug}"`);

  return {
    slug,
    nameEn,
    nameEs: findLocalized(params.nature.names, 'es'),
    increasedStat: (params.nature.increased_stat?.name as BaseStatKey | undefined) ?? undefined,
    decreasedStat: (params.nature.decreased_stat?.name as BaseStatKey | undefined) ?? undefined,
    source: { sourceId: params.sourceId, externalId: String(params.nature.id) },
  };
}

/**
 * Normalizes one held item (Milestone 2, Stage 2.0) — callers only pass
 * items already filtered to the "holdable" subset (see
 * `PokeApiClient.fetchHoldableItemRefs`); this function does not re-check
 * that itself, since the raw `PokeApiItem` shape here deliberately doesn't
 * carry the upstream `attributes` array (the filtering already happened at
 * the ref-list level, one HTTP request, not per-item).
 */
export function normalizeItem(params: { item: PokeApiItem; sourceId: string }): NormalizedItem {
  const slug = params.item.name;
  assertValidSlug(slug, `item #${params.item.id}`);
  const nameEn = findLocalized(params.item.names, 'en');
  if (!nameEn) throw new Error(`Missing en name for item "${slug}"`);

  return {
    slug,
    nameEn,
    nameEs: findLocalized(params.item.names, 'es'),
    effectEn: findEffectText(params.item.effect_entries, 'en'),
    effectEs: findEffectText(params.item.effect_entries, 'es'),
    category: params.item.category.name,
    source: { sourceId: params.sourceId, externalId: String(params.item.id) },
  };
}

function timeOfDayFrom(value: string): 'day' | 'night' | undefined {
  return value === 'day' || value === 'night' ? value : undefined;
}

/**
 * Walks one PokéAPI evolution-chain tree into flat edges (Phase 1C.1, Part B
 * — a graph/edge model, never a fixed 3-stage structure; see
 * docs/adr/0011-abilities-evolutions-schema.md). The chain's root node
 * produces no edge (nothing evolves into it); every other node produces one
 * edge per entry in its `evolution_details` — usually one, but several for a
 * species with more than one valid evolution method (e.g. Feebas: max Beauty
 * *or* trade holding Prism Scale).
 */
export function normalizeEvolutionChain(params: {
  chain: PokeApiEvolutionChain;
  sourceId: string;
}): NormalizedEvolution[] {
  const chainExternalId = String(params.chain.id);
  const edges: NormalizedEvolution[] = [];

  function walk(link: PokeApiEvolutionChainLink, fromSpeciesSlug: string | undefined): void {
    const toSpeciesSlug = link.species.name;
    if (fromSpeciesSlug) {
      link.evolution_details.forEach((detail, index) => {
        edges.push({
          chainExternalId,
          fromSpeciesSlug,
          toSpeciesSlug,
          trigger: detail.trigger.name,
          minLevel: detail.min_level ?? undefined,
          itemSlug: detail.item?.name,
          heldItemSlug: detail.held_item?.name,
          minHappiness: detail.min_happiness ?? undefined,
          minBeauty: detail.min_beauty ?? undefined,
          minAffection: detail.min_affection ?? undefined,
          timeOfDay: timeOfDayFrom(detail.time_of_day),
          knownMoveSlug: detail.known_move?.name,
          knownMoveTypeSlug: detail.known_move_type?.name,
          locationSlug: detail.location?.name,
          gender: detail.gender ?? undefined,
          tradeSpeciesSlug: detail.trade_species?.name,
          partySpeciesSlug: detail.party_species?.name,
          partyTypeSlug: detail.party_type?.name,
          relativePhysicalStats: detail.relative_physical_stats ?? undefined,
          needsOverworldRain: detail.needs_overworld_rain,
          turnUpsideDown: detail.turn_upside_down,
          raw: detail as unknown as Record<string, unknown>,
          source: {
            sourceId: params.sourceId,
            externalId: `${chainExternalId}:${toSpeciesSlug}:${index}`,
          },
        });
      });
    }
    for (const child of link.evolves_to) walk(child, toSpeciesSlug);
  }

  walk(params.chain.chain, undefined);
  return edges;
}

/**
 * PokéAPI's signature Z-Move-derived moves (e.g. Breakneck Blitz) are split
 * into two records sharing one display name, disambiguated only by a
 * `--physical`/`--special` suffix depending on the base move's category —
 * not two separately-named in-game moves, just PokéAPI's own record-per-
 * variant modeling. That suffix's double dash fails PokeStudio's general
 * kebab-case slug rule (species/forms/abilities never legitimately have
 * one); collapsing it to a single dash keeps the two variants distinct
 * (e.g. "breakneck-blitz-physical" / "breakneck-blitz-special") without
 * loosening the shared slug rule everywhere else it applies.
 */
function sanitizeMoveSlug(rawName: string): string {
  return rawName.replace(/-{2,}/g, '-');
}

/**
 * Normalizes one canonical move (Phase 1C.2, Part A). `effectEs` is left
 * `undefined` — never invented — because PokéAPI's move `effect_entries` has
 * never been observed to contain an "es" entry (same documented gap as
 * ability effects, docs/engineering/DATA_SOURCES.md). `meta`-derived fields are left
 * `undefined` when PokéAPI's `meta` block is entirely absent — a genuine,
 * current gap for ~110 of 937 moves at full-dataset scale (mostly very
 * recent Generation IX moves and unreleased-game placeholders) — never
 * guessed at (docs/adr/0013-moves-learnsets-schema.md).
 */
export function normalizeMove(params: { move: PokeApiMove; sourceId: string }): NormalizedMove {
  const slug = sanitizeMoveSlug(params.move.name);
  assertValidSlug(slug, `move #${params.move.id}`);
  const nameEn = findLocalized(params.move.names, 'en');
  if (!nameEn) throw new Error(`Missing en name for move "${slug}"`);
  const meta = params.move.meta;

  return {
    slug,
    nameEn,
    nameEs: findLocalized(params.move.names, 'es'),
    type: params.move.type.name as PokemonType,
    damageClass: params.move.damage_class.name as DamageClass,
    // PokéAPI is inconsistent about how it encodes "no fixed power"/"never
    // misses": most status moves use `null`, but some (power-shift,
    // victory-dance, shelter, ...) use literal `0` for the same real
    // absence — no move ever has a genuinely displayed power/accuracy of 0
    // in-game, so both encodings normalize to the identical `undefined`.
    power: params.move.power || undefined,
    accuracy: params.move.accuracy || undefined,
    pp: params.move.pp,
    priority: params.move.priority,
    target: params.move.target.name,
    generation: parseGenerationSlug(params.move.generation.name),
    effectEn: findEffectText(params.move.effect_entries, 'en'),
    effectEs: findEffectText(params.move.effect_entries, 'es'),
    effectChance: params.move.effect_chance ?? undefined,
    ailment: meta?.ailment.name,
    category: meta?.category.name,
    minHits: meta?.min_hits ?? undefined,
    maxHits: meta?.max_hits ?? undefined,
    minTurns: meta?.min_turns ?? undefined,
    maxTurns: meta?.max_turns ?? undefined,
    drain: meta?.drain ?? 0,
    healing: meta?.healing ?? 0,
    critRate: meta?.crit_rate ?? 0,
    ailmentChance: meta?.ailment_chance ?? 0,
    flinchChance: meta?.flinch_chance ?? 0,
    statChance: meta?.stat_chance ?? 0,
    statChanges: params.move.stat_changes.map((sc) => ({
      stat: sc.stat.name as MoveStat,
      change: sc.change,
    })),
    source: { sourceId: params.sourceId, externalId: String(params.move.id) },
  };
}

export function normalizeVersionGroup(params: {
  versionGroup: PokeApiVersionGroup;
  sourceId: string;
}): NormalizedVersionGroup {
  const slug = params.versionGroup.name;
  assertValidSlug(slug, `version group #${params.versionGroup.id}`);
  return {
    slug,
    generation: parseGenerationSlug(params.versionGroup.generation.name),
    displayOrder: params.versionGroup.order,
    source: { sourceId: params.sourceId, externalId: String(params.versionGroup.id) },
  };
}

export function normalizeLearnMethod(params: {
  method: PokeApiMoveLearnMethod;
  sourceId: string;
}): NormalizedLearnMethod {
  const slug = params.method.name;
  assertValidSlug(slug, `move learn method #${params.method.id}`);
  return { slug, source: { sourceId: params.sourceId, externalId: String(params.method.id) } };
}

/** Minimal TM/HM/TR identity (Phase 1C.2, task §7) — item detail is deliberately not modeled, see NormalizedMachine. */
export function normalizeMachine(params: {
  machine: PokeApiMachine;
  sourceId: string;
}): NormalizedMachine {
  return {
    moveSlug: params.machine.move.name,
    versionGroupSlug: params.machine.version_group.name,
    itemSlug: params.machine.item.name,
    source: { sourceId: params.sourceId, externalId: String(params.machine.id) },
  };
}
