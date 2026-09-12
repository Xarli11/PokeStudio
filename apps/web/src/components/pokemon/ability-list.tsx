import { tagClass } from '@/lib/ui-classes';

export interface AbilityListItem {
  slug: string;
  name: string;
  /** Undefined when the source has no description in this locale — never invented. */
  description?: string | undefined;
  isHidden: boolean;
}

export interface PokemonAbilityListProps {
  abilities: AbilityListItem[];
  hiddenAbilityLabel: string;
  noDescriptionLabel: string;
}

/** Regular abilities first, hidden ability visually distinguished last (Phase 1C.1/UX 0.1). */
export function PokemonAbilityList({
  abilities,
  hiddenAbilityLabel,
  noDescriptionLabel,
}: PokemonAbilityListProps) {
  if (abilities.length === 0) return null;

  const ordered = [...abilities].sort((a, b) => Number(a.isHidden) - Number(b.isHidden));

  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {ordered.map((ability) => (
        <li key={ability.slug}>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-semibold">{ability.name}</span>
            {ability.isHidden ? (
              <span className={tagClass({ label: true, accent: true })}>{hiddenAbilityLabel}</span>
            ) : null}
          </div>
          <p className="m-0 mt-0.5 text-sm text-muted">
            {ability.description ?? noDescriptionLabel}
          </p>
        </li>
      ))}
    </ul>
  );
}
