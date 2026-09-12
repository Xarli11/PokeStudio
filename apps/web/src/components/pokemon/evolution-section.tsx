import Link from 'next/link';

import type { EvolutionFamily } from '@pokestudio/database';
import { formatMessage, type Dictionary, type Locale } from '@pokestudio/i18n';

import { groupEvolutionEdges } from '@/lib/evolution-condition';
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
      className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface py-1 pr-3 pl-1 text-base font-semibold text-foreground no-underline transition-[border-color,transform] duration-150 ease-ps hover:-translate-y-px hover:border-brand/45 focus-visible:-translate-y-px focus-visible:border-brand/45 motion-reduce:hover:translate-y-0 motion-reduce:focus-visible:translate-y-0"
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
      <section className="flex flex-col gap-2 border-t border-border-subtle pt-6">
        <h2 className="m-0 text-lg">{dictionary.pokedex.evolution.title}</h2>
        <p className="m-0 text-muted">
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
    <section className="flex flex-col gap-4 border-t border-border-subtle pt-6">
      <h2 className="m-0 text-lg">{dictionary.pokedex.evolution.title}</h2>

      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {groups.map((group) => (
          <li
            key={`${group.fromSpeciesSlug}->${group.toSpeciesSlug}`}
            className="flex flex-col gap-1 rounded-md bg-surface-raised p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <MemberChip
                slug={group.fromSpeciesSlug}
                name={nameBySlug.get(group.fromSpeciesSlug) ?? group.fromSpeciesSlug}
                locale={locale}
              />
              <span aria-hidden="true" className="text-muted">
                →
              </span>
              <MemberChip
                slug={group.toSpeciesSlug}
                name={nameBySlug.get(group.toSpeciesSlug) ?? group.toSpeciesSlug}
                locale={locale}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {group.conditionDescriptions.map((description, index) => (
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
    </section>
  );
}
