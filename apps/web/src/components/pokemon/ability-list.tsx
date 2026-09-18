import Link from 'next/link';

import { tagClass } from '@/lib/ui-classes';

export interface AbilityListItem {
  slug: string;
  name: string;
  /** When present, the ability's name links to its detail page (Phase 1C.3 §12) — omitted only by callers with no ability-detail route to point at (none currently; kept optional so this component doesn't require one). */
  href?: string | undefined;
  /** Undefined only when neither language has a description at all — never invented. */
  description?: string | undefined;
  /**
   * True when `description` is the English text shown as an intentional
   * fallback in a non-English locale (PokéAPI has no Spanish ability effect
   * for any ability — see docs/engineering/DATA_SOURCES.md). Never machine-translated; the
   * UI marks it honestly rather than either leaving it blank or presenting
   * English text as if it were Spanish.
   */
  descriptionIsFallback?: boolean;
  isHidden: boolean;
}

export interface PokemonAbilityListProps {
  abilities: AbilityListItem[];
  hiddenAbilityLabel: string;
  noDescriptionLabel: string;
  /** e.g. "English" — shown as a small tag next to a fallback description. */
  fallbackLanguageLabel: string;
}

/** Regular abilities first, hidden ability visually distinguished last (Phase 1C.1/UX 0.1). */
export function PokemonAbilityList({
  abilities,
  hiddenAbilityLabel,
  noDescriptionLabel,
  fallbackLanguageLabel,
}: PokemonAbilityListProps) {
  if (abilities.length === 0) return null;

  const ordered = [...abilities].sort((a, b) => Number(a.isHidden) - Number(b.isHidden));

  return (
    <ul className="m-0 flex list-none flex-col gap-4 p-0">
      {ordered.map((ability) => (
        <li
          key={ability.slug}
          className="flex flex-col gap-1 border-b border-border-subtle pb-4 last:border-b-0 last:pb-0"
        >
          <div className="flex flex-wrap items-center gap-2">
            {ability.href ? (
              <Link
                href={ability.href}
                className="text-base font-semibold text-foreground no-underline transition-colors duration-200 ease-pl hover:text-brand hover:underline focus-visible:text-brand"
              >
                {ability.name}
              </Link>
            ) : (
              <span className="text-base font-semibold text-foreground">{ability.name}</span>
            )}
            {ability.isHidden ? (
              <span className={tagClass({ label: true, accent: true })}>{hiddenAbilityLabel}</span>
            ) : null}
            {ability.descriptionIsFallback ? (
              <span className={tagClass({ label: true })}>{fallbackLanguageLabel}</span>
            ) : null}
          </div>
          <p className="m-0 text-sm leading-relaxed text-muted">
            {ability.description ?? noDescriptionLabel}
          </p>
        </li>
      ))}
    </ul>
  );
}
