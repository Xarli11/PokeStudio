import { assertValidSlug, classifyForm, detectRegionLabel, pickPrimaryForm } from './classify';
import type {
  PokeApiAbility,
  PokeApiEffectEntry,
  PokeApiEvolutionChain,
  PokeApiEvolutionChainLink,
  PokeApiPokemon,
  PokeApiPokemonAbility,
  PokeApiPokemonForm,
  PokeApiPokemonSpecies,
} from './pokeapi-client';
import type {
  BaseStats,
  FormCategory,
  LocalizedName,
  NormalizedAbility,
  NormalizedEvolution,
  NormalizedForm,
  NormalizedFormAbility,
  NormalizedSpecies,
  PokemonType,
} from './types';

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
  localizationNotes: LocalizationNote[];
} {
  const species = normalizeSpecies({ species: group.species, sourceId });
  const localizationNotes: LocalizationNote[] = [];
  const formAbilities: NormalizedFormAbility[] = [];

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
      };
      formAbilities.push(...normalizeFormAbilities(slug, variety.pokemon.abilities));
      return normalized;
    });
  });

  return { species, forms, formAbilities, localizationNotes };
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
 * see DATA_SOURCES.md for how common that gap is at full-dataset scale.
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
