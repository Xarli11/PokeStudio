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

/** Regular abilities first, hidden ability visually distinguished last (Phase 1C.1, Part D). */
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
        gap: '0.5rem',
        margin: 0,
        padding: 0,
        listStyle: 'none',
      }}
    >
      {ordered.map((ability) => (
        <li key={ability.slug}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>{ability.name}</span>
            {ability.isHidden ? (
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  color: 'var(--ps-color-text-muted)',
                  border: '1px solid var(--ps-color-border)',
                  borderRadius: '9999px',
                  padding: '0.0625rem 0.5rem',
                }}
              >
                {hiddenAbilityLabel}
              </span>
            ) : null}
          </div>
          <p
            style={{
              margin: '0.125rem 0 0',
              fontSize: '0.8125rem',
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
