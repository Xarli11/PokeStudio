import type { PokemonType } from '@pokestudio/pokemon-data';
import { pokemonTypeColorVar } from '@pokestudio/ui';

/**
 * A deliberate neutral placeholder for Pokémon visuals (DATA_SOURCES.md/
 * THIRD_PARTY_NOTICES.md "Sprite/artwork asset decision", Phase 1A): no
 * documented, license-cleared sprite/artwork source exists yet, so this
 * renders a type-accented initial instead of introducing an undocumented
 * external asset. Purely decorative — the Pokémon's name is always shown as
 * real text alongside it, so `aria-hidden` is correct here.
 */
export function PokemonVisualPlaceholder({
  initial,
  primaryType,
  size = 72,
}: {
  initial: string;
  primaryType: PokemonType;
  size?: number;
}) {
  const colorVar = pokemonTypeColorVar[primaryType];

  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: '9999px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.4,
        fontWeight: 700,
        color: 'var(--ps-color-primary-contrast)',
        background: `linear-gradient(135deg, var(${colorVar}), var(--ps-color-primary))`,
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );
}
