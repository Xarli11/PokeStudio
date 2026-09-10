import Link from 'next/link';

import type { EvolutionFamily } from '@pokestudio/database';
import { formatMessage, type Dictionary, type Locale } from '@pokestudio/i18n';

import { groupEvolutionEdges } from '@/lib/evolution-condition';

export interface PokemonEvolutionSectionProps {
  family: EvolutionFamily;
  locale: Locale;
  dictionary: Dictionary;
}

const linkStyle: React.CSSProperties = {
  color: 'var(--ps-color-text)',
  fontWeight: 600,
  fontSize: 'var(--ps-font-size-base)',
  textDecoration: 'none',
  borderRadius: 'var(--ps-radius-sm)',
};

/**
 * A simple row-per-edge evolution flow (UX/UI 0.1, Part E) — not a
 * positioned node/graph diagram. Each row is `[from] → [to]` plus that
 * edge's condition(s) as small secondary chips below the names, so
 * identities stay the visually dominant element and conditions stay
 * readable but subordinate. Rows stack and wrap on narrow screens for free
 * via flexbox. Branching is just multiple rows sharing the same `from`; a
 * species with no evolution renders a plain "does not evolve" card.
 */
export function PokemonEvolutionSection({
  family,
  locale,
  dictionary,
}: PokemonEvolutionSectionProps) {
  const nameBySlug = new Map(family.members.map((member) => [member.slug, member.name[locale]]));

  if (family.edges.length === 0) {
    const soloName = family.members[0]!.name[locale];
    return (
      <section
        className="ps-card"
        style={{
          padding: 'var(--ps-space-5)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--ps-space-2)',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 'var(--ps-font-size-lg)' }}>
          {dictionary.pokedex.evolution.title}
        </h2>
        <p style={{ margin: 0, color: 'var(--ps-color-text-muted)' }}>
          {formatMessage(dictionary.pokedex.evolution.noEvolution, { name: soloName })}
        </p>
      </section>
    );
  }

  const groups = groupEvolutionEdges(family.edges, dictionary.pokedex.evolution).sort((a, b) => {
    const fromCompare = (nameBySlug.get(a.fromSpeciesSlug) ?? '').localeCompare(
      nameBySlug.get(b.fromSpeciesSlug) ?? '',
    );
    return fromCompare !== 0
      ? fromCompare
      : (nameBySlug.get(a.toSpeciesSlug) ?? '').localeCompare(
          nameBySlug.get(b.toSpeciesSlug) ?? '',
        );
  });

  return (
    <section
      className="ps-card"
      style={{
        padding: 'var(--ps-space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--ps-space-4)',
      }}
    >
      <h2 style={{ margin: 0, fontSize: 'var(--ps-font-size-lg)' }}>
        {dictionary.pokedex.evolution.title}
      </h2>

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
        {groups.map((group) => (
          <li
            key={`${group.fromSpeciesSlug}->${group.toSpeciesSlug}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--ps-space-1)',
              padding: 'var(--ps-space-3)',
              borderRadius: 'var(--ps-radius-md)',
              background: 'var(--ps-color-bg-elevated)',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 'var(--ps-space-2)',
              }}
            >
              <Link href={`/${locale}/pokemon/${group.fromSpeciesSlug}`} style={linkStyle}>
                {nameBySlug.get(group.fromSpeciesSlug) ?? group.fromSpeciesSlug}
              </Link>
              <span aria-hidden="true" style={{ color: 'var(--ps-color-text-muted)' }}>
                →
              </span>
              <Link href={`/${locale}/pokemon/${group.toSpeciesSlug}`} style={linkStyle}>
                {nameBySlug.get(group.toSpeciesSlug) ?? group.toSpeciesSlug}
              </Link>
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 'var(--ps-space-2)',
              }}
            >
              {group.conditionDescriptions.map((description, index) => (
                <span key={description} style={{ display: 'contents' }}>
                  {index > 0 ? (
                    <span
                      aria-hidden="true"
                      style={{
                        fontSize: 'var(--ps-font-size-xs)',
                        color: 'var(--ps-color-text-muted)',
                      }}
                    >
                      {dictionary.pokedex.evolution.orSeparator}
                    </span>
                  ) : null}
                  <span className="ps-tag">{description}</span>
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
