import Link from 'next/link';

import type { EvolutionFamily } from '@pokelab/database';
import { formatMessage, type Dictionary, type Locale } from '@pokelab/i18n';

import { groupEvolutionsByParent } from '@/lib/evolution-condition';
import { tagClass } from '@/lib/ui-classes';

export interface PokemonEvolutionSectionProps {
  family: EvolutionFamily;
  locale: Locale;
  dictionary: Dictionary;
}

/** One linked family member — a small monogram + name, not a bare text link. */
function MemberChip({ slug, name, locale }: { slug: string; name: string; locale: Locale }) {
  return (
    <Link
      href={`/${locale}/pokemon/${slug}`}
      className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface py-1 pr-3 pl-1 text-base font-semibold text-foreground no-underline transition-[border-color,transform] duration-150 ease-pl hover:-translate-y-px hover:border-brand/45 focus-visible:-translate-y-px focus-visible:border-brand/45 motion-reduce:hover:translate-y-0 motion-reduce:focus-visible:translate-y-0"
    >
      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-muted text-xs font-bold text-brand"
      >
        {name.charAt(0)}
      </span>
      <span>{name}</span>
    </Link>
  );
}

/**
 * A parent-fans-out-to-children evolution flow (Phase 1C.2b, superseding UX/UI
 * 0.1 Part E's row-per-edge layout) — not a positioned node/graph diagram,
 * still plain CSS grid/flex. Each parent renders once (`groupEvolutionsByParent`)
 * with every one of its evolution targets listed as a branch below/beside
 * it, so a branching family (Eevee: 8 targets) reads as one "Eevee" fanning
 * out rather than eight rows each repeating "Eevee →". A linear chain still
 * renders as a natural top-to-bottom sequence, because each stage is its own
 * parent group with exactly one child. A species with no evolution renders a
 * plain "does not evolve" card.
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
      <section className="flex flex-col gap-2 border-t border-border-subtle pt-6">
        <h2 className="m-0 text-lg">{dictionary.pokedex.evolution.title}</h2>
        <p className="m-0 text-muted">
          {formatMessage(dictionary.pokedex.evolution.noEvolution, { name: soloName })}
        </p>
      </section>
    );
  }

  const parentGroups = groupEvolutionsByParent(family.edges, dictionary.pokedex.evolution, locale)
    .map((group) => ({
      ...group,
      children: [...group.children].sort((a, b) =>
        (nameBySlug.get(a.toSpeciesSlug) ?? '').localeCompare(
          nameBySlug.get(b.toSpeciesSlug) ?? '',
        ),
      ),
    }))
    .sort((a, b) =>
      (nameBySlug.get(a.fromSpeciesSlug) ?? '').localeCompare(
        nameBySlug.get(b.fromSpeciesSlug) ?? '',
      ),
    );

  return (
    <section className="flex flex-col gap-4 border-t border-border-subtle pt-6">
      <h2 className="m-0 text-lg">{dictionary.pokedex.evolution.title}</h2>

      <ul className="m-0 flex list-none flex-col gap-4 p-0">
        {parentGroups.map((group) => (
          <li
            key={group.fromSpeciesSlug}
            className="grid grid-cols-1 gap-3 rounded-md bg-surface-raised p-3 sm:grid-cols-[auto_1fr] sm:items-start"
          >
            <div className="flex sm:pt-1">
              <MemberChip
                slug={group.fromSpeciesSlug}
                name={nameBySlug.get(group.fromSpeciesSlug) ?? group.fromSpeciesSlug}
                locale={locale}
              />
            </div>

            <ul className="m-0 flex list-none flex-col gap-2 border-l border-border-subtle p-0 pl-4 sm:border-l">
              {group.children.map((child) => (
                <li key={child.toSpeciesSlug} className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span aria-hidden="true" className="text-muted">
                      →
                    </span>
                    <MemberChip
                      slug={child.toSpeciesSlug}
                      name={nameBySlug.get(child.toSpeciesSlug) ?? child.toSpeciesSlug}
                      locale={locale}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-1">
                    {child.conditionDescriptions.map((description, index) => (
                      <span key={description} className="contents">
                        {index > 0 ? (
                          <span aria-hidden="true" className="text-xs text-muted">
                            {dictionary.pokedex.evolution.orSeparator}
                          </span>
                        ) : null}
                        <span className={tagClass()}>{description}</span>
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
