import type { PokemonType } from '@pokestudio/pokemon-data';
import { pokemonTypeColorVar } from '@pokestudio/ui';

export interface PokemonArtSlotProps {
  initial: string;
  /** Primary type first — used for the dominant gradient hue and the ring accent. */
  types: readonly PokemonType[];
  /**
   * `tile` — a Pokédex card's top banner. `hero` — a secondary/other-form
   * card's small identity square. `detailHero` — the detail page's primary
   * artwork panel (UX/UI 0.2b Part C): substantially larger and fluid, so
   * it reads as an illustration frame, not an avatar.
   */
  variant: 'tile' | 'hero' | 'detailHero';
  /**
   * Real sprite (Pokédex grid sprites, task §4) — when present, replaces
   * only the monogram (see the doc comment below: this was the intended
   * "forward-compatible" swap point all along). `onSpriteError` lets a
   * caller with its own `useState` fall back to the monogram if the image
   * request itself fails; this component stays hook-free/server-safe
   * either way (a plain prop, not local state) since it's also rendered
   * from the still-monogram-only detail page.
   */
  spriteUrl?: string | undefined;
  onSpriteError?: (() => void) | undefined;
}

/**
 * The deliberate artwork placeholder (UX/UI 0.2 Part C, enlarged in 0.2b,
 * polished in 0.2c). PokeStudio still has no license-cleared Pokémon
 * sprite/artwork source (docs/engineering/DATA_SOURCES.md "Phase 1A decision"), so this is
 * not "no image yet" — it's a designed composition: a soft per-type
 * gradient wash, a faint vignette for depth (no glossy highlight streak),
 * a large low-opacity monogram letterform, and two opposite corner
 * brackets in the primary type's color — a viewfinder/frame motif rather
 * than a centered ring, deliberately avoiding the "circle + centered
 * initial" composition that reads as an avatar/badge.
 *
 * Sizing/gradients stay inline style rather than Tailwind classes: the
 * type (and therefore every color here) is picked at runtime from data, and
 * `detailHero` needs a genuine `clamp()` — neither has a static utility
 * equivalent. Only the variant-independent structural properties below are
 * Tailwind classes.
 *
 * Forward-compatible on purpose: when a real sprite/artwork source is
 * reviewed and approved, only the inner `<span>` monogram needs replacing
 * with an `<img>` (object-fit: cover, same sizing) — the outer frame,
 * gradient, corner brackets, radius and every call site stay exactly as
 * they are.
 */
export function PokemonArtSlot({
  initial,
  types,
  variant,
  spriteUrl,
  onSpriteError,
}: PokemonArtSlotProps) {
  const primaryVar = pokemonTypeColorVar[types[0]!];
  const secondaryVar = pokemonTypeColorVar[types[1] ?? types[0]!];
  // A touch more presence than the wash/monogram — the brackets are the one
  // "technical" line-work detail in this composition.
  const bracketColor = `color-mix(in srgb, var(${primaryVar}) 72%, transparent)`;

  const sizing: React.CSSProperties =
    variant === 'tile'
      ? {
          width: '100%',
          aspectRatio: '2 / 1',
          borderTopLeftRadius: 'var(--ps-radius-lg)',
          borderTopRightRadius: 'var(--ps-radius-lg)',
        }
      : variant === 'detailHero'
        ? {
            width: '100%',
            maxWidth: 'clamp(11rem, 26vw, 17rem)',
            aspectRatio: '1 / 1',
            borderRadius: 'var(--ps-radius-xl)',
          }
        : {
            width: '6rem',
            height: '6rem',
            borderRadius: 'var(--ps-radius-xl)',
          };

  const monogramSize =
    variant === 'tile'
      ? '2.25rem'
      : variant === 'detailHero'
        ? 'clamp(3.5rem, 9vw, 5.5rem)'
        : '2.5rem';

  const bracketArm = variant === 'tile' ? '18%' : '16%';

  // Restrained in the small grid tile (it shares the card with a dex number
  // and name right below), fuller presence once it's the hero moment.
  const monogramOpacity = variant === 'tile' ? 0.26 : variant === 'detailHero' ? 0.38 : 0.3;

  return (
    <div
      aria-hidden="true"
      className="relative flex shrink-0 items-center justify-center overflow-hidden"
      style={{
        background: [
          // Faint edge vignette for depth — never a diagonal shine.
          'radial-gradient(circle at 50% 45%, transparent 55%, color-mix(in srgb, var(--ps-color-bg) 32%, transparent) 100%)',
          `linear-gradient(155deg, color-mix(in srgb, var(${primaryVar}) 23%, var(--ps-color-bg-elevated)), color-mix(in srgb, var(${secondaryVar}) 23%, var(--ps-color-bg-elevated)) 100%)`,
        ].join(', '),
        ...sizing,
      }}
    >
      <span
        className="absolute top-[12%] left-[12%] rounded-tl-[2px]"
        style={{
          width: bracketArm,
          height: bracketArm,
          borderTop: `1.5px solid ${bracketColor}`,
          borderLeft: `1.5px solid ${bracketColor}`,
        }}
      />
      <span
        className="absolute bottom-[12%] right-[12%] rounded-br-[2px]"
        style={{
          width: bracketArm,
          height: bracketArm,
          borderBottom: `1.5px solid ${bracketColor}`,
          borderRight: `1.5px solid ${bracketColor}`,
        }}
      />
      {spriteUrl ? (
        // Fills the frame at a modest inset (not full-bleed) — object-contain
        // then lets each species' own intrinsic size scale within that box,
        // so a tall/narrow sprite (Wailord) and a small/square one (Pikachu)
        // both read clearly without any per-species value here.
        // eslint-disable-next-line @next/next/no-img-element -- see pokemon-sprite.ts's doc comment (same provisional external host Team Builder's roster tile already uses).
        <img
          src={spriteUrl}
          alt=""
          loading="lazy"
          onError={onSpriteError}
          className="absolute inset-[6%] object-contain [image-rendering:pixelated]"
        />
      ) : (
        <span
          className="leading-none font-bold tracking-tight text-foreground select-none"
          style={{ fontSize: monogramSize, opacity: monogramOpacity }}
        >
          {initial}
        </span>
      )}
    </div>
  );
}
