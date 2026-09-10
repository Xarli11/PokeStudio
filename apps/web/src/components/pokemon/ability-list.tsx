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
    <ul
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--ps-space-3)',
        margin: 0,
        padding: 0,
        listStyle: 'none',
      }}
    >
      {ordered.map((ability) => (
        <li key={ability.slug}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 'var(--ps-space-2)',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontWeight: 600 }}>{ability.name}</span>
            {ability.isHidden ? (
              <span className="ps-tag ps-tag-label ps-tag-accent">{hiddenAbilityLabel}</span>
            ) : null}
          </div>
          <p
            style={{
              margin: '0.125rem 0 0',
              fontSize: 'var(--ps-font-size-sm)',
              color: 'var(--ps-color-text-muted)',
            }}
          >
            {ability.description ?? noDescriptionLabel}
          </p>
        </li>
      ))}
    </ul>
  );
}
