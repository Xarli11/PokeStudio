import Link from 'next/link';

import type { DamageClass, PokemonType } from '@pokestudio/pokemon-data';
import { pokemonTypeColorVar } from '@pokestudio/ui';

import { cardClass, tagClass } from '@/lib/ui-classes';

/** Level-up entries first (ascending level), then every other method in a fixed, stable order. */
const METHOD_ORDER = ['level-up', 'machine', 'tutor', 'egg'] as const;

export interface MoveRowItem {
  slug: string;
  name: string;
  type: PokemonType;
  typeLabel: string;
  damageClass: DamageClass;
  damageClassLabel: string;
  power?: number | undefined;
  accuracy?: number | undefined;
  learnMethod: string;
  methodLabel: string;
  level: number;
}

export interface PokemonMovesSectionProps {
  moves: MoveRowItem[];
  localePrefix: string;
  title: string;
  gameContextLabel: string;
  noMoveDataLabel: string;
  powerLabel: string;
  accuracyLabel: string;
  noPowerLabel: string;
  neverMissesLabel: string;
  levelLabel: (level: number) => string;
  levelOnEvolveLabel: string;
  showAllLabel: (count: number) => string;
}

const INITIAL_VISIBLE_COUNT = 15;

function methodRank(method: string): number {
  const index = METHOD_ORDER.indexOf(method as (typeof METHOD_ORDER)[number]);
  return index === -1 ? METHOD_ORDER.length : index;
}

function MoveRow({
  move,
  localePrefix,
  powerLabel,
  accuracyLabel,
  noPowerLabel,
  neverMissesLabel,
  levelLabel,
  levelOnEvolveLabel,
}: {
  move: MoveRowItem;
  localePrefix: string;
  powerLabel: string;
  accuracyLabel: string;
  noPowerLabel: string;
  neverMissesLabel: string;
  levelLabel: (level: number) => string;
  levelOnEvolveLabel: string;
}) {
  const colorVar = pokemonTypeColorVar[move.type];
  const methodDetail =
    move.learnMethod === 'level-up'
      ? move.level === 0
        ? levelOnEvolveLabel
        : levelLabel(move.level)
      : move.methodLabel;

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-subtle py-2.5 last:border-b-0">
      <Link
        href={`${localePrefix}/moves/${move.slug}`}
        className="min-w-[8rem] flex-1 font-semibold text-foreground no-underline hover:text-brand hover:underline"
      >
        {move.name}
      </Link>
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: `var(${colorVar})` }}
      />
      <span className={tagClass()}>{move.typeLabel}</span>
      <span className={tagClass()}>{move.damageClassLabel}</span>
      <span className="w-16 shrink-0 text-right text-sm tabular-nums text-muted">
        {powerLabel}: {move.power ?? noPowerLabel}
      </span>
      <span className="w-24 shrink-0 text-right text-sm tabular-nums text-muted">
        {accuracyLabel}: {move.accuracy ?? neverMissesLabel}
      </span>
      <span className="w-28 shrink-0 text-right text-sm text-muted">{methodDetail}</span>
    </li>
  );
}

/**
 * A restrained Moves widget for the Pokémon detail page (Phase 1C.2, task
 * §15) — not the Team Builder. Grouped by learn method (level-up first,
 * ascending level), collapsed behind "Show all" past
 * `INITIAL_VISIBLE_COUNT` rows for mobile usability, same pattern as the
 * cosmetic-variants `<details>` on this same page
 * (apps/web/src/app/[locale]/pokemon/[slug]/page.tsx).
 */
export function PokemonMovesSection({
  moves,
  localePrefix,
  title,
  gameContextLabel,
  noMoveDataLabel,
  powerLabel,
  accuracyLabel,
  noPowerLabel,
  neverMissesLabel,
  levelLabel,
  levelOnEvolveLabel,
  showAllLabel,
}: PokemonMovesSectionProps) {
  const sorted = [...moves].sort((a, b) => {
    const rankDiff = methodRank(a.learnMethod) - methodRank(b.learnMethod);
    if (rankDiff !== 0) return rankDiff;
    if (a.learnMethod === 'level-up' && a.level !== b.level) return a.level - b.level;
    return a.name.localeCompare(b.name);
  });

  const visible = sorted.slice(0, INITIAL_VISIBLE_COUNT);
  const rest = sorted.slice(INITIAL_VISIBLE_COUNT);

  const rowProps = {
    localePrefix,
    powerLabel,
    accuracyLabel,
    noPowerLabel,
    neverMissesLabel,
    levelLabel,
    levelOnEvolveLabel,
  };

  return (
    <section className={cardClass('flex flex-col gap-3 px-5 py-4')}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-lg">{title}</h2>
        <span className="text-xs text-muted">{gameContextLabel}</span>
      </div>

      {sorted.length === 0 ? (
        <p className="m-0 text-sm text-muted">{noMoveDataLabel}</p>
      ) : (
        <>
          <ul className="m-0 flex list-none flex-col p-0">
            {visible.map((move) => (
              <MoveRow
                key={`${move.slug}:${move.learnMethod}:${move.level}`}
                move={move}
                {...rowProps}
              />
            ))}
          </ul>
          {rest.length > 0 ? (
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-muted transition-colors hover:text-foreground">
                {showAllLabel(sorted.length)}
              </summary>
              <ul className="m-0 mt-1 flex list-none flex-col p-0">
                {rest.map((move) => (
                  <MoveRow
                    key={`${move.slug}:${move.learnMethod}:${move.level}`}
                    move={move}
                    {...rowProps}
                  />
                ))}
              </ul>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}
