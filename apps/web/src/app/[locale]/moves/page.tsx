import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { listMovesPage } from '@pokestudio/database';
import { formatMessage, getDictionary, isLocale, locales } from '@pokestudio/i18n';

import { PokemonTypeBadge } from '@/components/pokemon/type-badge';
import { getPokemonDatabaseClient } from '@/lib/pokemon-database';
import { buttonClass, eyebrowClass, interactiveCardClass, tagClass } from '@/lib/ui-classes';

// Reads live reference data per request — do not attempt to statically
// prerender this at build time (CI has no Supabase instance during `next build`).
export const dynamic = 'force-dynamic';

// Same "keep the payload reasonable, plain page-number navigation" shape as
// the Pokédex index (apps/web/src/app/[locale]/pokemon/page.tsx) — no
// client-side search/filter table this phase (task §17: "do not build a
// massive client-side data table").
const PAGE_SIZE = 60;

function parsePage(searchParams: { page?: string }): number {
  const page = Number.parseInt(searchParams.page ?? '1', 10);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dictionary = getDictionary(locale);
  const firstPage = await listMovesPage(getPokemonDatabaseClient(), { page: 1, pageSize: 1 });

  return {
    metadataBase: new URL('https://pokestudio.app'),
    title: dictionary.moves.title,
    description: formatMessage(dictionary.moves.indexDescription, { count: firstPage.totalCount }),
    alternates: {
      canonical: `/${locale}/moves`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}/moves`])),
    },
    openGraph: {
      title: dictionary.moves.title,
      description: dictionary.moves.tagline,
      locale,
      type: 'website',
    },
  };
}

export default async function MoveIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale);
  const page = parsePage(await searchParams);
  const result = await listMovesPage(getPokemonDatabaseClient(), { page, pageSize: PAGE_SIZE });

  return (
    <div className="mx-auto flex max-w-wide flex-col gap-10">
      <header className="flex flex-col gap-3">
        <span className={eyebrowClass()}>{dictionary.moves.title}</span>
        <h1 className="m-0 text-3xl tracking-tight">{dictionary.moves.title}</h1>
        <p className="m-0 max-w-xl text-muted">{dictionary.moves.tagline}</p>
      </header>

      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {result.items.map((move) => {
          const name = locale === 'es' ? (move.nameEs ?? move.nameEn) : move.nameEn;
          return (
            <li key={move.slug}>
              <Link
                href={`/${locale}/moves/${move.slug}`}
                className={interactiveCardClass('flex flex-col gap-2 px-4 py-3')}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{name}</span>
                  <span className={tagClass()}>
                    {dictionary.moves.damageClass[move.damageClass]}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <PokemonTypeBadge type={move.type} label={dictionary.types[move.type]} />
                  <span className="text-xs tabular-nums text-muted">
                    {dictionary.moves.power} {move.power ?? dictionary.moves.noPower} ·{' '}
                    {dictionary.moves.pp} {move.pp}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <nav
        aria-label={formatMessage(dictionary.moves.pageLabel, {
          page: result.page,
          totalPages: result.totalPages,
        })}
        className="flex items-center justify-between gap-4"
      >
        {result.page > 1 ? (
          <Link
            href={`/${locale}/moves?page=${result.page - 1}`}
            className={buttonClass('default')}
          >
            ← {dictionary.moves.previousPage}
          </Link>
        ) : (
          <span aria-hidden="true" />
        )}
        <span className="text-sm text-muted tabular-nums">
          {formatMessage(dictionary.moves.pageLabel, {
            page: result.page,
            totalPages: result.totalPages,
          })}
        </span>
        {result.page < result.totalPages ? (
          <Link
            href={`/${locale}/moves?page=${result.page + 1}`}
            className={buttonClass('default')}
          >
            {dictionary.moves.nextPage} →
          </Link>
        ) : (
          <span aria-hidden="true" />
        )}
      </nav>
    </div>
  );
}
