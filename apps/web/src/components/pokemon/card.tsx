import Link from 'next/link';

import type { PokemonType } from '@pokestudio/pokemon-data';

import { PokemonTypeBadge } from './type-badge';
import { PokemonVisualPlaceholder } from './visual-placeholder';

export interface PokemonCardProps {
  href: string;
  name: string;
  dexNumberLabel: string;
  types: { type: PokemonType; label: string }[];
}

/**
 * One Pokédex index entry — real localized name/number/types, linking to
 * the detail page. Sits in a responsive grid (`pokemon-grid.module.css`),
 * so it stays a compact tile rather than a full-width row (UX/UI 0.1 Part C).
 */
export function PokemonCard({ href, name, dexNumberLabel, types }: PokemonCardProps) {
  return (
    <Link
      href={href}
      className="ps-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--ps-space-4)',
        padding: 'var(--ps-space-4)',
        color: 'inherit',
        textDecoration: 'none',
      }}
    >
      <PokemonVisualPlaceholder initial={name.charAt(0)} primaryType={types[0]!.type} size={56} />
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ps-space-1)', minWidth: 0 }}
      >
        <span
          style={{
            color: 'var(--ps-color-text-muted)',
            fontSize: 'var(--ps-font-size-xs)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {dexNumberLabel}
        </span>
        <span
          style={{
            fontSize: 'var(--ps-font-size-base)',
            fontWeight: 600,
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
