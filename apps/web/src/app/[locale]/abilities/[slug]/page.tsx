import { SITE_NAME, SITE_URL } from '@/lib/site';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getPokemonForAbility } from '@pokelab/database';
import { abilityEffectsEs, formatMessage, getDictionary, isLocale, locales } from '@pokelab/i18n';

import { getCachedAbilityBySlug, getPokemonDatabaseClient } from '@/lib/pokemon-database';
import { buttonClass, cardClass, eyebrowClass, tagClass } from '@/lib/ui-classes';

// Reads live reference data per request — do not attempt to statically
// prerender this at build time (CI has no Supabase instance during `next build`).
export const dynamic = 'force-dynamic';

const POKEMON_PAGE_SIZE = 60;

type PageParams = { locale: string; slug: string };

function parsePage(raw: string | undefined): number {
  const page = Number.parseInt(raw ?? '1', 10);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/** Same fallback chain as the Pokémon detail page's ability list (Phase 1C.2b): upstream Spanish → PokeLab-owned Spanish → English, honestly marked, never invented. */
function abilityEffect(
  ability: { effectEn?: string | undefined; effectEs?: string | undefined; slug: string },
  locale: 'en' | 'es',
): { text: string | undefined; isFallback: boolean } {
  if (locale !== 'es') return { text: ability.effectEn, isFallback: false };
  const pokeLabEs = abilityEffectsEs[ability.slug];
  const text = ability.effectEs ?? pokeLabEs ?? ability.effectEn;
  return { text, isFallback: !ability.effectEs && !pokeLabEs && text !== undefined };
}

// National Dex number is a product identifier, not translatable prose
// (CLAUDE.md brand-cleanup pass) — always "#NNN", independent of locale.
function dexNumberLabel(n: number): string {
  return `#${String(n).padStart(3, '0')}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { locale, slug: rawSlug } = await params;
  if (!isLocale(locale)) return {};
  const slug = rawSlug.toLowerCase();
  const dictionary = getDictionary(locale);
  const ability = await getCachedAbilityBySlug(getPokemonDatabaseClient(), slug);
  if (!ability) return {};

  const name = locale === 'es' ? (ability.nameEs ?? ability.nameEn) : ability.nameEn;
  return {
    metadataBase: new URL(SITE_URL),
    title: `${name} — ${dictionary.abilities.title}`,
    description: formatMessage(dictionary.abilities.detailDescription, { name }),
    alternates: {
      // Always the lowercase canonical slug — see pokemon/[slug]/page.tsx's
      // identical comment (task §13/§17).
      canonical: `/${locale}/abilities/${slug}`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}/abilities/${slug}`])),
    },
    openGraph: {
      siteName: SITE_NAME,
      title: name,
      description: dictionary.abilities.tagline,
      locale,
      type: 'website',
    },
  };
}

export default async function AbilityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const rawSearchParams = await searchParams;

  const dictionary = getDictionary(locale);
  const client = getPokemonDatabaseClient();
  const page = parsePage(rawSearchParams.page);
  // `getPokemonForAbility` is keyed on `slug` alone, not on the `ability`
  // row's data — genuinely independent, so it doesn't need to wait for the
  // ability lookup to resolve first (Performance pass §7). The rare 404
  // case fetches one extra page it then discards; every real hit saves a
  // full round trip's worth of latency.
  const [ability, pokemonPage] = await Promise.all([
    getCachedAbilityBySlug(client, slug),
    getPokemonForAbility(client, slug, { page, pageSize: POKEMON_PAGE_SIZE }),
  ]);
  if (!ability) notFound();

  const name = locale === 'es' ? (ability.nameEs ?? ability.nameEn) : ability.nameEn;
  const { text: effectText, isFallback } = abilityEffect(ability, locale);
  // English name is only worth showing as a subtitle when it actually
  // differs from what's already the page's own title (task §10 "source/
  // English name when useful" — never a redundant duplicate line).
  const showEnglishName = locale === 'es' && ability.nameEn !== name;

  return (
    <div className="mx-auto flex max-w-detail flex-col gap-8">
      <Link
        href={`/${locale}/abilities`}
        className="self-start text-sm text-muted no-underline hover:text-foreground"
      >
        ← {dictionary.abilities.backToAbilities}
      </Link>

      <header className="flex flex-col gap-2">
        <span className={eyebrowClass()}>{dictionary.abilities.title}</span>
        <h1 className="m-0 text-3xl tracking-tight">{name}</h1>
        {showEnglishName ? (
          <p className="m-0 text-sm text-muted">
            {dictionary.abilities.englishName}: {ability.nameEn}
          </p>
        ) : null}
      </header>

      {effectText ? (
        <section className="flex flex-col gap-2">
          <h2 className="m-0 text-lg">{dictionary.abilities.effect}</h2>
          <p className="m-0 text-muted">{effectText}</p>
          {isFallback ? (
            <span className={tagClass({ label: true }, 'self-start')}>
              {dictionary.pokedex.descriptionFallbackLanguage}
            </span>
          ) : null}
        </section>
      ) : (
        <p className="m-0 text-sm text-muted">{dictionary.pokedex.noAbilityDescription}</p>
      )}

      <section className="flex flex-col gap-4 border-t border-border-subtle pt-5">
        <h2 className="m-0 text-lg">{dictionary.abilities.pokemonWithThisAbility}</h2>

        {!pokemonPage || pokemonPage.items.length === 0 ? (
          <p className="m-0 text-sm text-muted">{dictionary.abilities.noPokemon}</p>
        ) : (
          <>
            <ul className="m-0 grid grid-cols-1 gap-2 p-0 sm:grid-cols-2 md:grid-cols-3">
              {pokemonPage.items.map((item) => (
                <li key={item.speciesSlug} className="list-none">
                  <Link
                    href={`/${locale}/pokemon/${item.speciesSlug}`}
                    className={cardClass(
                      'flex flex-col gap-1 px-3 py-2 text-inherit no-underline transition-colors hover:border-brand/40 hover:bg-surface-hover',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{item.name[locale]}</span>
                      <span className="text-xs tabular-nums text-muted">
                        {dexNumberLabel(item.nationalDexNumber)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.isHidden ? (
                        <span className={tagClass({ label: true, accent: true })}>
                          {dictionary.pokedex.hiddenAbility}
                        </span>
                      ) : null}
                      {item.formName ? (
                        <span className={tagClass({ label: true })}>
                          {formatMessage(dictionary.abilities.onlyOnForm, {
                            form: item.formName[locale],
                          })}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            <nav
              aria-label={formatMessage(dictionary.moves.pageLabel, {
                page: pokemonPage.page,
                totalPages: pokemonPage.totalPages,
              })}
              className="flex items-center justify-between gap-4"
            >
              {pokemonPage.page > 1 ? (
                <Link
                  href={`/${locale}/abilities/${slug}?page=${pokemonPage.page - 1}`}
                  className={buttonClass('default')}
                >
                  ← {dictionary.moves.previousPage}
                </Link>
              ) : (
                <span aria-hidden="true" />
              )}
              <span className="text-sm text-muted tabular-nums">
                {formatMessage(dictionary.moves.pageLabel, {
                  page: pokemonPage.page,
                  totalPages: pokemonPage.totalPages,
                })}
              </span>
              {pokemonPage.page < pokemonPage.totalPages ? (
                <Link
                  href={`/${locale}/abilities/${slug}?page=${pokemonPage.page + 1}`}
                  className={buttonClass('default')}
                >
                  {dictionary.moves.nextPage} →
                </Link>
              ) : (
                <span aria-hidden="true" />
              )}
            </nav>
          </>
        )}
      </section>
    </div>
  );
}
