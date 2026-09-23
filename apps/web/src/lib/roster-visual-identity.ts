import type { SpeciesSearchAlias, SpeciesSearchItem } from '@pokestudio/database';
import type { LocalizedName, PokemonType } from '@pokestudio/pokemon-data';

/**
 * Enough identity to render a roster tile (sprite frame, type badges, name)
 * before a team member's full `ComparablePokemonForm` reference data has
 * loaded. Visual-only: never fed into validation, abilities, base stats,
 * learnsets or legality — those stay gated on the real form data.
 */
export interface RosterVisualIdentity {
  formSlug: string;
  speciesSlug: string;
  nationalDexNumber: number;
  isDefaultForm: boolean;
  displayName: LocalizedName;
  types: PokemonType[];
  /** See `@pokestudio/database`'s `SpeciesFormSummary.pokeapiPokemonId` doc comment — passed straight through so any sprite resolver downstream can build the exact-form (not just default-form) production sprite URL. */
  pokeapiPokemonId: number | null;
}

/**
 * Resolves a form slug to its visual identity from the search index the
 * roster picker already has loaded (no fetch). A default form is one
 * `SpeciesSearchItem`; a non-default form is a `SpeciesSearchAlias`, whose
 * owning species (matched by `speciesSlug`) supplies the Dex number the
 * alias itself doesn't carry.
 */
export function resolveRosterVisualIdentity(
  searchIndex: {
    items: readonly SpeciesSearchItem[];
    aliases: readonly SpeciesSearchAlias[];
  },
  formSlug: string,
): RosterVisualIdentity | undefined {
  const item = searchIndex.items.find((candidate) => candidate.formSlug === formSlug);
  if (item) {
    return {
      formSlug: item.formSlug,
      speciesSlug: item.slug,
      nationalDexNumber: item.nationalDexNumber,
      isDefaultForm: true,
      displayName: item.name,
      types: item.types,
      pokeapiPokemonId: item.pokeapiPokemonId,
    };
  }

  const alias = searchIndex.aliases.find((candidate) => candidate.formSlug === formSlug);
  if (!alias) return undefined;
  const owner = searchIndex.items.find((candidate) => candidate.slug === alias.speciesSlug);
  if (!owner) return undefined;

  return {
    formSlug: alias.formSlug,
    speciesSlug: alias.speciesSlug,
    nationalDexNumber: owner.nationalDexNumber,
    isDefaultForm: false,
    displayName: alias.name,
    types: alias.types,
    pokeapiPokemonId: alias.pokeapiPokemonId,
  };
}
