import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getFormsBySlugs } from '@pokestudio/database';
import { getDictionary, isLocale, locales } from '@pokestudio/i18n';

import { SITE_URL } from '@/lib/site-url';
import { CompareView } from '@/components/pokemon/compare-view';
import { getPokemonDatabaseClient } from '@/lib/pokemon-database';
import { getCachedSpeciesSearchIndex } from '@/lib/reference-data-cache';
import { eyebrowClass } from '@/lib/ui-classes';

// Reads live reference data per request — do not attempt to statically
// prerender this at build time (CI has no Supabase instance during `next build`).
export const dynamic = 'force-dynamic';

const MAX_COMPARE_SLOTS = 4;

/** `?pokemon=garchomp,dragonite` — deduplicated, capped at 4, empty entries dropped. */
function parseFormSlugs(raw: string | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const entry of raw.split(',')) {
    const slug = entry.trim().toLowerCase();
    if (slug.length > 0) seen.add(slug);
  }
  return [...seen].slice(0, MAX_COMPARE_SLOTS);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dictionary = getDictionary(locale);

  return {
    metadataBase: new URL(SITE_URL),
    title: dictionary.compare.title,
    description: dictionary.compare.indexDescription,
    alternates: {
      // Canonical is deliberately the query-less shell (task: "query-state
      // URLs shouldn't explode sitemap cardinality") — the specific
      // comparison in `?pokemon=...` is shareable but not a distinct
      // indexable entity.
      canonical: `/${locale}/compare`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}/compare`])),
    },
    openGraph: {
      url: `/${locale}/compare`,
      title: dictionary.compare.title,
      description: dictionary.compare.tagline,
      locale,
      type: 'website',
    },
  };
}

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ pokemon?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale);
  const requestedSlugs = parseFormSlugs((await searchParams).pokemon);
  const [forms, searchIndex] = await Promise.all([
    getFormsBySlugs(getPokemonDatabaseClient(), requestedSlugs),
    getCachedSpeciesSearchIndex(),
  ]);

  // Preserve the URL's own order (the user's own add order), not whatever
  // order the database happened to return.
  const formsBySlug = new Map(forms.map((form) => [form.formSlug, form]));
  const orderedForms = requestedSlugs
    .map((slug) => formsBySlug.get(slug))
    .filter((form) => form !== undefined);
  const invalidSlugs = requestedSlugs.filter((slug) => !formsBySlug.has(slug));

  return (
    <div className="mx-auto flex max-w-wide flex-col gap-10">
      <header className="flex flex-col gap-3">
        <span className={eyebrowClass()}>{dictionary.compare.eyebrow}</span>
        <h1 className="m-0 text-3xl tracking-tight">{dictionary.compare.title}</h1>
        <p className="m-0 max-w-xl text-muted">{dictionary.compare.tagline}</p>
      </header>

      <CompareView
        locale={locale}
        searchIndex={searchIndex}
        forms={orderedForms}
        invalidSlugs={invalidSlugs}
        typeLabels={dictionary.types}
        statLabels={dictionary.pokedex.stat}
        statTierLabels={dictionary.pokedex.statTier}
        labels={{
          emptyState: dictionary.compare.emptyState,
          addPokemon: dictionary.compare.addPokemon,
          addPlaceholder: dictionary.compare.addPlaceholder,
          noResults: dictionary.pokedex.noSearchResults,
          removeTemplate: dictionary.compare.remove,
          maxReached: dictionary.compare.maxReached,
          addAnotherHint: dictionary.compare.addAnotherHint,
          invalidEntryTemplate: dictionary.compare.invalidEntry,
          abilities: dictionary.compare.abilities,
          hiddenAbility: dictionary.compare.hiddenAbility,
          baseStats: dictionary.pokedex.baseStats,
          baseStatTotal: dictionary.compare.baseStatTotal,
          typeMatchups: dictionary.compare.typeMatchups,
          doubleWeak: dictionary.compare.doubleWeak,
          weak: dictionary.compare.weak,
          resist: dictionary.compare.resist,
          doubleResist: dictionary.compare.doubleResist,
          immune: dictionary.compare.immune,
          noNotableMatchups: dictionary.compare.noNotableMatchups,
          multipleFormsMatchTemplate: dictionary.pokedex.multipleFormsMatch,
          ambiguousHint: dictionary.compare.ambiguousHint,
        }}
      />
    </div>
  );
}
