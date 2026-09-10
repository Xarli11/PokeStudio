import Link from 'next/link';

import type { EvolutionFamily } from '@pokestudio/database';
import { formatMessage, type Dictionary, type Locale } from '@pokestudio/i18n';

import { groupEvolutionEdges } from '@/lib/evolution-condition';

export interface PokemonEvolutionSectionProps {
  family: EvolutionFamily;
  locale: Locale;
  dictionary: Dictionary;
}

/**
 * A simple row-per-edge evolution flow (Phase 1C.1, Part D) — not a
 * positioned node/graph diagram. Each row is `[from] → [to]` plus that
 * edge's condition(s); rows stack and wrap on narrow screens for free via
 * flexbox, which a from→to row list gets without any layout library.
 * Branching is just multiple rows sharing the same `from`; a species with
 * no evolution renders nothing (`getEvolutionFamily` returns zero edges).
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
        style={{
          padding: '1.25rem',
          borderRadius: '0.75rem',
          border: '1px solid var(--ps-color-border)',
          background: 'var(--ps-color-bg-surface)',
        }}
      >
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>
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
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        padding: '1.25rem',
        borderRadius: '0.75rem',
        border: '1px solid var(--ps-color-border)',
        background: 'var(--ps-color-bg-surface)',
      }}
    >
      <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{dictionary.pokedex.evolution.title}</h2>

      <ul
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          margin: 0,
          padding: 0,
          listStyle: 'none',
        }}
      >
        {groups.map((group) => (
          <li
            key={`${group.fromSpeciesSlug}->${group.toSpeciesSlug}`}
            style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}
          >
            <Link
              href={`/${locale}/pokemon/${group.fromSpeciesSlug}`}
              style={{ color: 'var(--ps-color-text)', fontWeight: 600, textDecoration: 'none' }}
            >
              {nameBySlug.get(group.fromSpeciesSlug) ?? group.fromSpeciesSlug}
            </Link>
            <span aria-hidden="true" style={{ color: 'var(--ps-color-text-muted)' }}>
              →
            </span>
            <Link
              href={`/${locale}/pokemon/${group.toSpeciesSlug}`}
              style={{ color: 'var(--ps-color-text)', fontWeight: 600, textDecoration: 'none' }}
            >
              {nameBySlug.get(group.toSpeciesSlug) ?? group.toSpeciesSlug}
            </Link>
            <span style={{ fontSize: '0.8125rem', color: 'var(--ps-color-text-muted)' }}>
              {group.conditionDescriptions.join(` ${dictionary.pokedex.evolution.orSeparator} `)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
