import { SITE_NAME, SITE_URL } from '@/lib/site';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getDefaultVersionGroup, getMoveLearners } from '@pokelab/database';
import { formatMessage, getDictionary, isLocale, locales } from '@pokelab/i18n';

import { PokemonTypeBadge } from '@/components/pokemon/type-badge';
import { describeMoveMechanics, shouldShowMoveDescription } from '@/lib/move-mechanics';
import { getCachedMoveBySlug, getPokemonDatabaseClient } from '@/lib/pokemon-database';
import {
  buttonClass,
  cardClass,
  eyebrowClass,
  interactiveCardClass,
  tagClass,
} from '@/lib/ui-classes';

/** Signed integer display for move priority (e.g. "+1", "-6") — never hides the sign on a nonzero value (task §A "priority as signed integer where relevant"). */
function signedPriority(priority: number): string {
  return priority > 0 ? `+${priority}` : `${priority}`;
}

// Reads live reference data per request — do not attempt to statically
// prerender this at build time (CI has no Supabase instance during `next build`).
export const dynamic = 'force-dynamic';

const LEARNERS_PAGE_SIZE = 40;

type PageParams = { locale: string; slug: string };

function parsePage(searchParams: { learnersPage?: string }): number {
  const page = Number.parseInt(searchParams.learnersPage ?? '1', 10);
  return Number.isInteger(page) && page > 0 ? page : 1;
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
  const move = await getCachedMoveBySlug(getPokemonDatabaseClient(), slug);
  if (!move) return {};

  const name = locale === 'es' ? (move.nameEs ?? move.nameEn) : move.nameEn;
  return {
    metadataBase: new URL(SITE_URL),
    title: `${name} — ${dictionary.moves.title}`,
    description: formatMessage(dictionary.moves.detailDescription, { name }),
    alternates: {
      canonical: `/${locale}/moves/${slug}`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}/moves/${slug}`])),
    },
    openGraph: {
      siteName: SITE_NAME,
      title: name,
      description: dictionary.moves.tagline,
      locale,
      type: 'website',
    },
  };
}

export default async function MoveDetailPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<{ learnersPage?: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const rawSearchParams = await searchParams;

  const dictionary = getDictionary(locale);
  const client = getPokemonDatabaseClient();
  const [move, defaultVersionGroup] = await Promise.all([
    getCachedMoveBySlug(client, slug),
    getDefaultVersionGroup(client),
  ]);
  if (!move) notFound();

  const learnersPage = parsePage(rawSearchParams);
  const learners = defaultVersionGroup
    ? await getMoveLearners(client, slug, defaultVersionGroup.slug, {
        page: learnersPage,
        pageSize: LEARNERS_PAGE_SIZE,
      })
    : null;

  const name = locale === 'es' ? (move.nameEs ?? move.nameEn) : move.nameEn;
  const effect = locale === 'es' ? move.effectEs : move.effectEn;
  const mechanicsLines = describeMoveMechanics(
    {
      target: move.target,
      category: move.category,
      statChanges: move.statChanges,
      statChance: move.statChance,
      ailment: move.ailment,
      ailmentChance: move.ailmentChance,
      flinchChance: move.flinchChance,
      drain: move.drain,
      healing: move.healing,
      minHits: move.minHits,
      maxHits: move.maxHits,
      minTurns: move.minTurns,
      maxTurns: move.maxTurns,
      critRate: move.critRate,
    },
    dictionary,
    locale,
  );

  return (
    <div className="mx-auto flex max-w-detail flex-col gap-8">
      <Link
        href={`/${locale}/moves`}
        className="self-start text-sm text-muted no-underline hover:text-foreground"
      >
        ← {dictionary.moves.backToMoves}
      </Link>

      <header className="flex flex-col gap-3">
        <span className={eyebrowClass()}>
          {formatMessage(dictionary.moves.generation, { number: move.generation })}
        </span>
        <h1 className="m-0 text-3xl tracking-tight">{name}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <PokemonTypeBadge type={move.type} label={dictionary.types[move.type]} />
          <span className={tagClass()}>{dictionary.moves.damageClass[move.damageClass]}</span>
        </div>
      </header>

      <section className={cardClass('grid grid-cols-2 gap-4 px-5 py-4 sm:grid-cols-4')}>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            {dictionary.moves.power}
          </span>
          <span className="text-lg tabular-nums">{move.power ?? dictionary.moves.noPower}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            {dictionary.moves.accuracy}
          </span>
          <span className="text-lg tabular-nums">
            {move.accuracy ?? dictionary.moves.neverMisses}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            {dictionary.moves.pp}
          </span>
          <span className="text-lg tabular-nums">{move.pp}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            {dictionary.moves.priority}
          </span>
          <span className="text-lg tabular-nums">{signedPriority(move.priority)}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            {dictionary.moves.target}
          </span>
          <span className="text-lg">
            {dictionary.moves.targetValue[
              move.target as keyof typeof dictionary.moves.targetValue
            ] ?? move.target}
          </span>
        </div>
        {move.effectChance !== undefined ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              {dictionary.moves.effectChance}
            </span>
            <span className="text-lg tabular-nums">{move.effectChance}%</span>
          </div>
        ) : null}
      </section>

      {/* A missing prose description never implies PokeLab knows nothing
          about the move (Phase 1C.2 polish) — when structured technical
          effects exist, they carry the real information below, so an empty
          "Description" block here would just look broken for no reason.
          Only shown empty as a last resort, when there's truly nothing
          else on the page to say about the move. */}
      {shouldShowMoveDescription(effect, mechanicsLines.length) ? (
        <section className="flex flex-col gap-2">
          <h2 className="m-0 text-lg">{dictionary.moves.effect}</h2>
          <p className="m-0 text-muted">{effect ?? dictionary.moves.noEffect}</p>
        </section>
      ) : null}

      {mechanicsLines.length > 0 ? (
        <section className={cardClass('flex flex-col gap-3 px-5 py-4')}>
          <h2 className="m-0 text-lg">{dictionary.moves.mechanics.title}</h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {mechanicsLines.map((line) => (
              <li key={line} className="flex items-start gap-2 text-sm text-foreground">
                <span
                  aria-hidden="true"
                  className="mt-[0.4375rem] h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-4 border-t border-border-subtle pt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="m-0 text-lg">{dictionary.moves.learnedBy}</h2>
          {defaultVersionGroup ? (
            <span className="text-xs text-muted">
              {formatMessage(dictionary.moves.generation, {
                number: defaultVersionGroup.generation,
              })}
            </span>
          ) : null}
        </div>

        {!learners || learners.items.length === 0 ? (
          <p className="m-0 text-sm text-muted">{dictionary.moves.noLearners}</p>
        ) : (
          <>
            <ul className="m-0 grid grid-cols-1 gap-2 p-0 sm:grid-cols-2 md:grid-cols-3">
              {learners.items.map((item) => (
                <li key={item.formSlug} className="list-none">
                  <Link
                    href={`/${locale}/pokemon/${item.speciesSlug}`}
                    className={interactiveCardClass(
                      'flex items-center justify-between gap-2 px-3 py-2',
                    )}
                  >
                    <span className="font-semibold">{item.name[locale]}</span>
                    <span className="flex gap-1">
                      {item.types.map((type) => (
                        <span key={type} aria-label={dictionary.types[type]} className={tagClass()}>
                          {dictionary.types[type]}
                        </span>
                      ))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <nav
              aria-label={formatMessage(dictionary.moves.pageLabel, {
                page: learners.page,
                totalPages: learners.totalPages,
              })}
              className="flex items-center justify-between gap-4"
            >
              {learners.page > 1 ? (
                <Link
                  href={`/${locale}/moves/${slug}?learnersPage=${learners.page - 1}`}
                  className={buttonClass('default')}
                >
                  ← {dictionary.moves.previousPage}
                </Link>
              ) : (
                <span aria-hidden="true" />
              )}
              <span className="text-sm text-muted tabular-nums">
                {formatMessage(dictionary.moves.pageLabel, {
                  page: learners.page,
                  totalPages: learners.totalPages,
                })}
              </span>
              {learners.page < learners.totalPages ? (
                <Link
                  href={`/${locale}/moves/${slug}?learnersPage=${learners.page + 1}`}
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
