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
  /**
   * Overrides the variant's fixed width/height with responsive Tailwind
   * classes (e.g. `hero` growing at `lg:`/`xl:` for Damage Lab's larger
   * "Pokémon as protagonist" treatment — visual review) instead of a single
   * fixed rem size. Percentage-based inner sizing (brackets, sprite inset)
   * already scales with the box, so no other prop needs to change.
   */
  sizeClassName?: string | undefined;
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
  sizeClassName,
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
            // `sizeClassName` (width/height via Tailwind responsive
            // classes) takes over sizing when given — leave width/height
            // out here so it isn't fighting inline style specificity.
            ...(sizeClassName ? null : { width: '6rem', height: '6rem' }),
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
      className={
        'relative flex shrink-0 items-center justify-center overflow-hidden' +
        (sizeClassName ? ` ${sizeClassName}` : '')
      }
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
        className={
          'absolute top-[12%] left-[12%] rounded-tl-[2px]' +
          (variant === 'tile'
            ? ' opacity-80 transition-opacity duration-200 ease-ps group-hover:opacity-100 group-focus-visible:opacity-100'
            : '')
        }
        style={{
          width: bracketArm,
          height: bracketArm,
          borderTop: `1.5px solid ${bracketColor}`,
          borderLeft: `1.5px solid ${bracketColor}`,
        }}
      />
      <span
        className={
          'absolute right-[12%] bottom-[12%] rounded-br-[2px]' +
          (variant === 'tile'
            ? ' opacity-80 transition-opacity duration-200 ease-ps group-hover:opacity-100 group-focus-visible:opacity-100'
            : '')
        }
        style={{
          width: bracketArm,
          height: bracketArm,
          borderBottom: `1.5px solid ${bracketColor}`,
          borderRight: `1.5px solid ${bracketColor}`,
        }}
      />
      {spriteUrl ? (
        // Fills the frame at a modest inset (not full-bleed). Explicit
        // width/height (not just `inset`) matter here: a replaced element
        // (`<img>`) that's absolutely positioned with all four inset sides
        // set but no explicit width/height falls back to its *intrinsic*
        // pixel size (CSS 2.1 §10.3.8) instead of stretching to fill the
        // inset box — PokéAPI's flat sprite set is ~96×96px, so inside a
        // wide 2:1 tile frame it rendered tiny and pinned toward the
        // top-left corner (the over-constrained left/top offsets win over
        // right/bottom when width/height are also intrinsic). Pairing
        // `inset-[6%]` with matching `h-[88%] w-[88%]` removes that
        // ambiguity — the box is always 88% of the frame on every axis,
        // then `object-contain` fits each species' own aspect ratio inside
        // it (unaffected either way: Wailord and Pikachu both still read
        // clearly, no per-species value here).
        //
        // Same fix now also applies to `hero`/`detailHero` (visual review,
        // Damage Lab's compact card — the first caller to ever pass a real
        // `spriteUrl` into a non-`tile` variant): they had exactly this
        // bug, just previously undetected because nothing exercised the
        // `<img>` branch for them (every other caller is monogram-only, no
        // sprite/artwork source cleared yet — that's still true, so this is
        // a no-op for them, not a behavior change). This is a confirmed
        // rendering bug (the same over-constrained-inset mechanism already
        // diagnosed and fixed for `tile` above), not a guess — it alone is
        // enough to explain a sprite rendering intrinsic-sized and pinned
        // toward one corner instead of centered/contained. Whether the
        // remote sprite *assets themselves* additionally carry asymmetric
        // transparent padding was not independently checked here (no tool
        // access to inspect the actual pixels of an externally hosted
        // image) — if a sprite still looks off-center after this fix, that
        // would point at the asset, not this component, and still isn't a
        // reason to add a per-species offset here.
        // eslint-disable-next-line @next/next/no-img-element -- see pokemon-sprite.ts's doc comment (same provisional external host Team Builder's roster tile already uses).
        <img
          src={spriteUrl}
          alt=""
          loading="lazy"
          onError={onSpriteError}
          className={
            variant === 'tile'
              ? 'absolute inset-[6%] h-[88%] w-[88%] object-contain [image-rendering:pixelated] transition-transform duration-200 ease-ps motion-reduce:transition-none group-hover:-translate-y-[2.5px] group-hover:scale-[1.06] group-focus-visible:-translate-y-[2.5px] group-focus-visible:scale-[1.06] motion-reduce:group-hover:translate-y-0 motion-reduce:group-hover:scale-100 motion-reduce:group-focus-visible:translate-y-0 motion-reduce:group-focus-visible:scale-100'
              : 'absolute inset-[6%] h-[88%] w-[88%] object-contain [image-rendering:pixelated]'
          }
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
