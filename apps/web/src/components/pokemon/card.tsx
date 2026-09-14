import Link from 'next/link';

import type { PokemonType } from '@pokestudio/pokemon-data';
import { pokemonTypeColorVar } from '@pokestudio/ui';

import { interactiveCardClass } from '@/lib/ui-classes';

import { PokemonArtSlot } from './art-slot';
import { PokemonTypeBadge } from './type-badge';

export interface PokemonCardProps {
  href: string;
  name: string;
  dexNumberLabel: string;
  types: { type: PokemonType; label: string }[];
  /**
   * Present when this card is shown because non-default form alias(es)
   * matched the search query, not the species' own name (Search UX v2
   * §2/§3). `label` is the secondary text line — either the matched form's
   * own localized name (e.g. "Meowth de Alola"), or, when several of the
   * species' forms matched equally, an "N forms match" line rather than
   * picking one arbitrarily. `types`, when present, is that one matched
   * form's own types shown instead of the default form's `types` above; it
   * is omitted in the ambiguous case, so the card correctly keeps showing
   * the species' own default types/art rather than recoloring itself for a
   * form that wasn't uniquely identified.
   */
  matchContext?: { label: string; types?: { type: PokemonType; label: string }[] } | undefined;
}

/**
 * One Pokédex index entry (UX/UI 0.2 Part B) — a vertical tile with its own
 * art slot on top, not a flat text row. Sits in a responsive grid
 * (`pokemon/page.tsx`); the art slot's per-type gradient gives each card a
 * little visual personality without any per-card custom styling. A thin
 * type-colored seam (0.2c Part A) carries that identity color from the
 * artwork zone into the data zone below it, instead of the two zones
 * reading as unrelated blocks.
 */
export function PokemonCard({ href, name, dexNumberLabel, types, matchContext }: PokemonCardProps) {
  const displayTypes = matchContext?.types ?? types;
  const primaryVar = pokemonTypeColorVar[displayTypes[0]!.type];

  return (
    <Link href={href} className={interactiveCardClass('flex flex-col overflow-hidden')}>
      <PokemonArtSlot
        initial={name.charAt(0)}
        types={displayTypes.map((t) => t.type)}
        variant="tile"
      />
      <div
        className="flex min-w-0 flex-col gap-1.5 pt-3 px-4 pb-4"
        style={{
          borderTop: `2px solid color-mix(in srgb, var(${primaryVar}) 55%, transparent)`,
        }}
      >
        <span className="text-xs font-semibold tracking-wide text-muted tabular-nums">
          {dexNumberLabel}
        </span>
        <span className="overflow-hidden text-lg font-bold tracking-tight text-ellipsis whitespace-nowrap">
          {name}
        </span>
        {matchContext ? (
          <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[0.6875rem] font-semibold text-muted">
            {matchContext.label}
          </span>
        ) : null}
        <div className="flex flex-wrap gap-1 pt-0.5">
          {displayTypes.map(({ type, label }) => (
            <PokemonTypeBadge key={type} type={type} label={label} />
          ))}
        </div>
      </div>
    </Link>
  );
}
