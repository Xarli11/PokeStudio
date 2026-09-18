'use client';

import type { PokemonType } from '@pokelab/pokemon-data';
import { pokemonTypeColorVar } from '@pokelab/ui';

import { buttonClass } from '@/lib/ui-classes';

/**
 * The "refined card composition" experiment (Sprite Lab task §9) — a
 * candidate roster-card layout, evaluated *alongside* the current approved
 * card (`FilledTeamTile`, reused unmodified elsewhere in the Lab as the
 * baseline), never replacing it. Differences from the current card:
 *
 * - a larger, left-bleeding sprite area (not a small square avatar sitting
 *   inside uniform padding),
 * - a slightly stronger (still subtle) type-derived aura behind the sprite,
 * - name/types set clearly to the right of it.
 *
 * PokeLab's own emerald/charcoal identity stays dominant — the aura is a
 * soft gradient wash behind the sprite only, never a full-card type tint.
 */
export function SpriteLabCard({
  name,
  types,
  typeLabels,
  spriteUrl,
  spriteSizePx,
  onSpriteError,
  broken,
}: {
  name: string;
  types: readonly PokemonType[];
  typeLabels: Record<PokemonType, string>;
  spriteUrl: string | undefined;
  spriteSizePx: number;
  onSpriteError: () => void;
  broken: boolean;
}) {
  const primaryVar = pokemonTypeColorVar[types[0]!];
  const secondaryVar = pokemonTypeColorVar[types[1] ?? types[0]!];

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border-subtle bg-surface">
      <div className="flex items-center gap-3 p-3">
        <div
          className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg"
          style={{
            width: spriteSizePx,
            height: spriteSizePx,
            background: `radial-gradient(circle at 50% 45%, color-mix(in srgb, var(${primaryVar}) 26%, var(--pl-color-bg-elevated)), color-mix(in srgb, var(${secondaryVar}) 12%, var(--pl-color-bg-elevated)) 100%)`,
          }}
        >
          {spriteUrl && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={spriteUrl}
              alt=""
              onError={onSpriteError}
              className="h-full w-full object-contain p-1 [image-rendering:pixelated]"
            />
          ) : (
            <span className="text-xs font-semibold text-muted uppercase">n/a</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
          <span className="mt-1 flex flex-wrap gap-1">
            {types.map((type) => (
              <span
                key={type}
                className="rounded-full px-1.5 py-px text-[0.625rem] font-bold text-muted"
                style={{ border: '1px solid var(--pl-color-border)' }}
              >
                {typeLabels[type]}
              </span>
            ))}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border-subtle px-3 py-2">
        <button type="button" className={buttonClass('default', 'px-3 py-1.5 text-xs')}>
          Configure
        </button>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label={`Change ${name}'s Pokémon or form`}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle bg-surface text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            ⇄
          </button>
          <button
            type="button"
            aria-label={`Remove ${name} from team`}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle bg-surface text-muted transition-colors hover:border-danger/50 hover:bg-danger/10 hover:text-danger"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
