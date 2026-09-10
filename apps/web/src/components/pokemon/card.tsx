import Link from 'next/link';

import type { PokemonType } from '@pokestudio/pokemon-data';
import { pokemonTypeColorVar } from '@pokestudio/ui';

import { PokemonArtSlot } from './art-slot';
import { PokemonTypeBadge } from './type-badge';

export interface PokemonCardProps {
  href: string;
  name: string;
  dexNumberLabel: string;
  types: { type: PokemonType; label: string }[];
}

/**
 * One Pokédex index entry (UX/UI 0.2 Part B) — a vertical tile with its own
 * art slot on top, not a flat text row. Sits in a responsive grid
 * (`pokemon-grid.module.css`); the art slot's per-type gradient gives each
 * card a little visual personality without any per-card custom styling. A
 * thin type-colored seam (0.2c Part A) carries that identity color from the
 * artwork zone into the data zone below it, instead of the two zones
 * reading as unrelated blocks.
 */
export function PokemonCard({ href, name, dexNumberLabel, types }: PokemonCardProps) {
  const primaryVar = pokemonTypeColorVar[types[0]!.type];

  return (
    <Link
      href={href}
      className="ps-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: 'inherit',
        textDecoration: 'none',
      }}
    >
      <PokemonArtSlot initial={name.charAt(0)} types={types.map((t) => t.type)} variant="tile" />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--ps-space-1)',
          minWidth: 0,
          padding: 'var(--ps-space-3) var(--ps-space-4) var(--ps-space-4)',
          borderTop: `2px solid color-mix(in srgb, var(${primaryVar}) 45%, transparent)`,
        }}
      >
        <span
          style={{
            color: 'var(--ps-color-text-muted)',
            fontSize: 'var(--ps-font-size-xs)',
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 600,
          }}
        >
          {dexNumberLabel}
        </span>
        <span
          style={{
            fontSize: 'var(--ps-font-size-base)',
            fontWeight: 700,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </span>
        <div style={{ display: 'flex', gap: 'var(--ps-space-1)', flexWrap: 'wrap' }}>
          {types.map(({ type, label }) => (
            <PokemonTypeBadge key={type} type={type} label={label} />
          ))}
        </div>
      </div>
    </Link>
  );
}
