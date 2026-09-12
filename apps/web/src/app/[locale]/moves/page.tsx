import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import type { DamageClass, PokemonType } from '@pokestudio/pokemon-data';
import { listMovesPage, type MoveListFilters } from '@pokestudio/database';
import { formatMessage, getDictionary, isLocale, locales } from '@pokestudio/i18n';

import { PokemonTypeBadge } from '@/components/pokemon/type-badge';
import { getPokemonDatabaseClient } from '@/lib/pokemon-database';
import { buttonClass, eyebrowClass, interactiveCardClass, tagClass } from '@/lib/ui-classes';

// Reads live reference data per request — do not attempt to statically
// prerender this at build time (CI has no Supabase instance during `next build`).
export const dynamic = 'force-dynamic';

// Same "keep the payload reasonable, plain page-number navigation" shape as
// the Pokédex index (apps/web/src/app/[locale]/pokemon/page.tsx). Filtering
// is database-backed (`listMovesPage`), not a client-side data table over
// the full ~919-move roster (task §6/§17).
const PAGE_SIZE = 60;

interface MoveIndexSearchParams {
  page?: string | undefined;
  q?: string | undefined;
  type?: string | undefined;
  damageClass?: string | undefined;
  generation?: string | undefined;
  sort?: string | undefined;
  dir?: string | undefined;
}

const KNOWN_TYPES = [
  'normal',
  'fire',
  'water',
  'electric',
  'grass',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
  'dark',
  'steel',
  'fairy',
] as const satisfies readonly PokemonType[];
const KNOWN_DAMAGE_CLASSES = [
  'physical',
  'special',
  'status',
] as const satisfies readonly DamageClass[];
const KNOWN_GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const SORT_COLUMNS = ['name', 'power', 'accuracy', 'pp'] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

function parsePage(raw: string | undefined): number {
  const page = Number.parseInt(raw ?? '1', 10);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function parseFilters(raw: MoveIndexSearchParams): MoveListFilters {
  const generation = raw.generation ? Number.parseInt(raw.generation, 10) : undefined;
  return {
    search: raw.q?.trim() || undefined,
    type: (KNOWN_TYPES as readonly string[]).includes(raw.type ?? '')
      ? (raw.type as PokemonType)
      : undefined,
    damageClass: (KNOWN_DAMAGE_CLASSES as readonly string[]).includes(raw.damageClass ?? '')
      ? (raw.damageClass as DamageClass)
      : undefined,
    generation:
      generation && (KNOWN_GENERATIONS as readonly number[]).includes(generation)
        ? generation
        : undefined,
    sortBy: (SORT_COLUMNS as readonly string[]).includes(raw.sort ?? '')
      ? (raw.sort as SortColumn)
      : 'name',
    sortDirection: raw.dir === 'desc' ? 'desc' : 'asc',
  };
}

/** Builds a URL preserving every current filter param, overriding only the given ones — used by pagination and sort links. */
function hrefWith(
  locale: string,
  raw: MoveIndexSearchParams,
  overrides: Partial<MoveIndexSearchParams>,
): string {
  const merged: MoveIndexSearchParams = { ...raw, ...overrides };
  const params = new URLSearchParams();
  if (merged.q) params.set('q', merged.q);
  if (merged.type) params.set('type', merged.type);
  if (merged.damageClass) params.set('damageClass', merged.damageClass);
  if (merged.generation) params.set('generation', merged.generation);
  if (merged.sort) params.set('sort', merged.sort);
  if (merged.dir) params.set('dir', merged.dir);
  if (merged.page && merged.page !== '1') params.set('page', merged.page);
  const query = params.toString();
  return `/${locale}/moves${query ? `?${query}` : ''}`;
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
      // Always the un-filtered base URL, regardless of the request's own
      // query string — filtered/sorted variants intentionally consolidate
      // here rather than becoming their own indexable pages (task §6/§18:
      // "do not add filter combinations to the sitemap", "avoid thin
      // indexable duplicate pages").
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
  searchParams: Promise<MoveIndexSearchParams>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale);
  const raw = await searchParams;
  const page = parsePage(raw.page);
  const filters = parseFilters(raw);
  const result = await listMovesPage(getPokemonDatabaseClient(), {
    page,
    pageSize: PAGE_SIZE,
    filters,
  });

  const sortLinks: { column: SortColumn; label: string }[] = [
    { column: 'name', label: dictionary.moves.column.name },
    { column: 'power', label: dictionary.moves.column.power },
    { column: 'accuracy', label: dictionary.moves.column.accuracy },
    { column: 'pp', label: dictionary.moves.column.pp },
  ];

  return (
    <div className="mx-auto flex max-w-wide flex-col gap-6">
      <header className="flex flex-col gap-3">
        <span className={eyebrowClass()}>{dictionary.moves.title}</span>
        <h1 className="m-0 text-3xl tracking-tight">{dictionary.moves.title}</h1>
        <p className="m-0 max-w-xl text-muted">{dictionary.moves.tagline}</p>
      </header>

      {/* Plain GET form: works with JS disabled (progressive enhancement,
          task §6), and every filter lands in the URL — shareable, and
          back/forward-navigable for free. Sort state (`sort`/`dir`) is
          preserved as hidden fields so submitting a new text/type/category
          filter doesn't reset the current sort. */}
      <form className="flex flex-wrap items-end gap-2">
        {raw.sort ? <input type="hidden" name="sort" value={raw.sort} /> : null}
        {raw.dir ? <input type="hidden" name="dir" value={raw.dir} /> : null}
        <label className="flex flex-1 basis-48 flex-col gap-1 text-xs text-muted">
          <span>{dictionary.moves.search}</span>
          <input
            type="search"
            name="q"
            defaultValue={raw.q ?? ''}
            placeholder={dictionary.moves.searchPlaceholder}
            className="rounded-md border border-border-subtle bg-surface px-2 py-1.5 text-sm text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          <span>{dictionary.moves.typeFilter}</span>
          <select
            name="type"
            defaultValue={raw.type ?? ''}
            className="rounded-md border border-border-subtle bg-surface px-2 py-1.5 text-sm text-foreground"
          >
            <option value="">{dictionary.moves.allTypes}</option>
            {KNOWN_TYPES.map((t) => (
              <option key={t} value={t}>
                {dictionary.types[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          <span>{dictionary.moves.damageClassFilter}</span>
          <select
            name="damageClass"
            defaultValue={raw.damageClass ?? ''}
            className="rounded-md border border-border-subtle bg-surface px-2 py-1.5 text-sm text-foreground"
          >
            <option value="">{dictionary.moves.allDamageClasses}</option>
            {KNOWN_DAMAGE_CLASSES.map((d) => (
              <option key={d} value={d}>
                {dictionary.moves.damageClass[d]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          <span>{dictionary.moves.generationFilter}</span>
          <select
            name="generation"
            defaultValue={raw.generation ?? ''}
            className="rounded-md border border-border-subtle bg-surface px-2 py-1.5 text-sm text-foreground"
          >
            <option value="">{dictionary.moves.allGenerations}</option>
            {KNOWN_GENERATIONS.map((g) => (
              <option key={g} value={g}>
                {formatMessage(dictionary.moves.generation, { number: g })}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonClass('primary')}>
          {dictionary.moves.search}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span>{dictionary.moves.column.name}:</span>
        {sortLinks.map(({ column, label }) => {
          const active = filters.sortBy === column;
          const nextDir = active && filters.sortDirection === 'asc' ? 'desc' : 'asc';
          return (
            <Link
              key={column}
              href={hrefWith(locale, raw, { sort: column, dir: nextDir, page: undefined })}
              className={
                active
                  ? 'font-semibold text-brand no-underline'
                  : 'no-underline hover:text-foreground'
              }
            >
              {label}
              {active ? (filters.sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
            </Link>
          );
        })}
      </div>

      {result.items.length === 0 ? (
        <p className="m-0 text-sm text-muted">{dictionary.moves.noResults}</p>
      ) : (
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
      )}

      <nav
        aria-label={formatMessage(dictionary.moves.pageLabel, {
          page: result.page,
          totalPages: result.totalPages,
        })}
        className="flex items-center justify-between gap-4"
      >
        {result.page > 1 ? (
          <Link
            href={hrefWith(locale, raw, { page: String(result.page - 1) })}
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
            href={hrefWith(locale, raw, { page: String(result.page + 1) })}
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
