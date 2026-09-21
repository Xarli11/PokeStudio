import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getFormsBySlugs } from '@pokestudio/database';
import { getDictionary, isLocale } from '@pokestudio/i18n';

import { SpriteLab } from '@/components/dev/sprite-lab';
import { GAME_ERA_SUPPORTED_VERSION_GROUPS } from '@/lib/pokemon-sprite';
import { getPokemonDatabaseClient } from '@/lib/pokemon-database';
import { getCachedSpeciesSearchIndex, getCachedVersionGroups } from '@/lib/reference-data-cache';
import {
  POKESPRITE_AUDIT_SNAPSHOT,
  SHOWDOWN_AUDIT_SNAPSHOT,
  auditBoxDexRangeCoverage,
  auditGameEraCoverage,
  auditModernCoverage,
} from '@/lib/sprite-coverage-audit';

/**
 * Dev-only Sprite Lab (final visual review, Sprite Lab task) — compares
 * candidate roster-sprite strategies ('box' / PokéSprite, 'game-era' /
 * PokéAPI per-game sets, 'modern' / PokéAPI's flat current-Dex set) inside
 * PokeStudio's actual approved card styling, before the owner picks a
 * production winner. Reads live reference data per request; never
 * prerendered, same convention as every other database-backed page.
 *
 * Deliberately NOT reachable in a production build (`notFound()` below) —
 * no public nav link, no sitemap entry (`sitemap.ts` is a hand-built list,
 * never directory-scanned), `robots: noindex` as defensive belt-and-braces
 * for any environment where the `NODE_ENV` gate is somehow bypassed.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Sprite Lab (dev)', robots: { index: false, follow: false } };
}

/**
 * Representative Pokémon (task §3) — deliberately including known rough
 * edges, not just flattering examples: `unown-a`/`deoxys-normal` are two of
 * the 172 real PokéSprite default-form naming mismatches this pass's own
 * audit found (see `sprite-coverage-audit.ts`), included here specifically
 * so that gap is visible in the Lab, not hidden.
 */
const REPRESENTATIVE_FORM_SLUGS = [
  'pikachu', // small, iconic
  'mew', // iconic, Mythical
  'charizard', // popular, mid-large
  'garchomp', // large dragon
  'rotom-wash', // non-default form
  'meowth-alola', // non-default form, regional
  'joltik', // very small Pokémon
  'wailord', // very large Pokémon
  'sprigatito', // Generation IX
  'gholdengo', // Generation IX
  'unown-a', // known PokéSprite default-form naming gap
  'deoxys-normal', // known PokéSprite default-form naming gap
];

export default async function SpriteLabPage({ params }: { params: Promise<{ locale: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();

  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale);
  const [forms, versionGroups, searchIndex] = await Promise.all([
    getFormsBySlugs(getPokemonDatabaseClient(), REPRESENTATIVE_FORM_SLUGS),
    getCachedVersionGroups(),
    getCachedSpeciesSearchIndex(),
  ]);

  const gameEraVersionGroups = versionGroups.filter((vg) =>
    GAME_ERA_SUPPORTED_VERSION_GROUPS.includes(vg.slug),
  );

  const audit = {
    modern: auditModernCoverage(searchIndex.items),
    boxDexRange: auditBoxDexRangeCoverage(searchIndex.items),
    gameEra: auditGameEraCoverage(searchIndex.items),
    pokespriteSnapshot: POKESPRITE_AUDIT_SNAPSHOT,
    showdownSnapshot: SHOWDOWN_AUDIT_SNAPSHOT,
  };

  return (
    <SpriteLab
      locale={locale}
      typeLabels={dictionary.types}
      forms={forms}
      gameEraVersionGroups={gameEraVersionGroups}
      audit={audit}
    />
  );
}
