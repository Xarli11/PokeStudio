/**
 * Short display names for PokéAPI's `version_group` slugs (Phase 1C.2b's
 * version-group selector, task §4: "localized display names"). Game titles
 * are proper nouns, not prose — kept identical across locales rather than
 * guessed at as official Spanish box-art titles PokeStudio hasn't verified
 * (CLAUDE.md §14 "no fake completeness" applies to naming claims too, not
 * just mechanics). The *localized* part of the selector is the generation
 * label around this ("Generación 9" vs "Generation 9"), not the game name
 * itself — see `moves-filter-bar.tsx` for how the two combine.
 *
 * Falls back to a humanized slug (same technique as
 * `evolution-condition.ts`'s `humanizeSlug`) for any version group not yet
 * in this table — never blocks on a name PokeStudio hasn't hand-verified.
 */
const VERSION_GROUP_NAMES: Record<string, string> = {
  'red-blue': 'Red / Blue',
  yellow: 'Yellow',
  'gold-silver': 'Gold / Silver',
  crystal: 'Crystal',
  'ruby-sapphire': 'Ruby / Sapphire',
  emerald: 'Emerald',
  'firered-leafgreen': 'FireRed / LeafGreen',
  colosseum: 'Colosseum',
  xd: 'XD: Gale of Darkness',
  'diamond-pearl': 'Diamond / Pearl',
  platinum: 'Platinum',
  'heartgold-soulsilver': 'HeartGold / SoulSilver',
  'black-white': 'Black / White',
  'black-2-white-2': 'Black 2 / White 2',
  'x-y': 'X / Y',
  'omega-ruby-alpha-sapphire': 'Omega Ruby / Alpha Sapphire',
  'sun-moon': 'Sun / Moon',
  'ultra-sun-ultra-moon': 'Ultra Sun / Ultra Moon',
  'lets-go-pikachu-lets-go-eevee': "Let's Go, Pikachu! / Let's Go, Eevee!",
  'sword-shield': 'Sword / Shield',
  'the-isle-of-armor': 'The Isle of Armor',
  'the-crown-tundra': 'The Crown Tundra',
  'brilliant-diamond-shining-pearl': 'Brilliant Diamond / Shining Pearl',
  'legends-arceus': 'Legends: Arceus',
  'scarlet-violet': 'Scarlet / Violet',
  'the-teal-mask': 'The Teal Mask',
  'the-indigo-disk': 'The Indigo Disk',
  'red-green-japan': 'Red / Green (JP)',
  'blue-japan': 'Blue (JP)',
  'legends-za': 'Legends: Z-A',
};

function humanizeSlug(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function versionGroupDisplayName(slug: string): string {
  return VERSION_GROUP_NAMES[slug] ?? humanizeSlug(slug);
}
