'use client';

import { useState } from 'react';

import { PokemonArtSlot, type PokemonArtSlotProps } from './art-slot';

/**
 * The one small client boundary `PokemonFormSection` needs (visual review —
 * "don't make the whole section client-side merely for onError"): owns
 * exactly the sprite-load-failure state `<img onError>` requires, nothing
 * else. `PokemonFormSection` itself stays a Server Component; only this
 * leaf hydrates on the client, the same "small client image boundary"
 * `damage-pokemon-slot.tsx`/`card.tsx` already manage locally — those two
 * are untouched (already client components with zero marginal cost for
 * owning this same bit of state), this is the one caller that genuinely
 * needed somewhere to put it.
 */
export function PokemonFormArt(props: Omit<PokemonArtSlotProps, 'onSpriteError'>) {
  const [spriteFailed, setSpriteFailed] = useState(false);
  return (
    <PokemonArtSlot
      {...props}
      spriteUrl={spriteFailed ? undefined : props.spriteUrl}
      onSpriteError={() => setSpriteFailed(true)}
    />
  );
}
