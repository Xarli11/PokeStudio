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

/** One Pokédex index entry — real localized name/number/types, links to the detail page. */
export function PokemonCard({ href, name, dexNumberLabel, types }: PokemonCardProps) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '1rem',
        borderRadius: '0.75rem',
        border: '1px solid var(--ps-color-border)',
        background: 'var(--ps-color-bg-surface)',
        color: 'inherit',
        textDecoration: 'none',
      }}
    >
      <PokemonVisualPlaceholder initial={name.charAt(0)} primaryType={types[0]!.type} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', minWidth: 0 }}>
        <span style={{ color: 'var(--ps-color-text-muted)', fontSize: '0.8125rem' }}>
          {dexNumberLabel}
        </span>
        <span style={{ fontSize: '1.0625rem', fontWeight: 600 }}>{name}</span>
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
          {types.map(({ type, label }) => (
            <PokemonTypeBadge key={type} type={type} label={label} />
          ))}
        </div>
      </div>
    </Link>
  );
}
