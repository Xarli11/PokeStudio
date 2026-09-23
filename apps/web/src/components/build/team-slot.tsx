'use client';

import type { ComparablePokemonForm } from '@pokestudio/database';
import { formatMessage, type Locale } from '@pokestudio/i18n';
import type { PokemonType } from '@pokestudio/pokemon-data';
import { pokemonTypeColorVar } from '@pokestudio/ui';

import { PokemonArtSlot } from '@/components/pokemon/art-slot';
import { buttonClass } from '@/lib/ui-classes';
import { getPokemonSprite } from '@/lib/pokemon-sprite';
import type { RosterVisualIdentity } from '@/lib/roster-visual-identity';
import type { TeamMemberDraft } from '@/lib/team-draft';

export interface TeamSlotLabels {
  addPokemonSlot: string;
  removeFromTeamTemplate: string;
  configureLabel: string;
  configureTemplate: string;
  changeFormTemplate: string;
  /** "Change form" — a short, non-templated tooltip; the templated version above stays the accessible name. */
  changeFormLabel: string;
  /** "Remove Pokémon" — same relationship to `removeFromTeamTemplate`. */
  removePokemonLabel: string;
}

/**
 * A compact team-roster tile (Milestone 2, Build manual review — replaces
 * the earlier tall, narrow slot card; refined again in the final product
 * shape pass, task §6/§7/§8). Purely presentational: the Pokémon/form search
 * used to live inside this card — it's a shared roster-level `RosterPicker`
 * now. This tile only ever renders identity (sprite/name/types), one primary
 * "Configure" action, and two secondary actions (change form / remove).
 */

/** An empty roster slot — a compact trigger, not a search field. */
export function EmptyTeamTile({
  labels,
  onStartAdd,
}: {
  labels: TeamSlotLabels;
  onStartAdd: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onStartAdd}
      className="flex min-h-16 items-center justify-center gap-2 rounded-lg border border-dashed border-border-subtle px-3 py-3 text-sm font-semibold text-muted transition-colors hover:border-brand/40 hover:bg-surface-hover hover:text-foreground"
    >
      <span aria-hidden="true">+</span>
      <span className="truncate">{labels.addPokemonSlot}</span>
    </button>
  );
}

/** Small, square, comfortable-hit-area icon button shared by the change-form and remove actions (task §7: "square click target, comfortable hit area, icon visually centered"). */
function SlotIconButton({
  onClick,
  label,
  title,
  danger,
  children,
}: {
  onClick: () => void;
  label: string;
  title: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={title}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 ${
        danger
          ? 'hover:border-danger/50 hover:bg-danger/10 hover:text-danger focus-visible:border-danger/50'
          : 'hover:bg-surface-hover hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function ChangeFormIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 7h12l-3.5-3.5" />
      <path d="M18 17H6l3.5 3.5" />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7h16" />
      <path d="M9.5 7V4.8a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1V7" />
      <path d="M6.5 7l.9 12.1a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
      <path d="M10.3 11v6M13.7 11v6" />
    </svg>
  );
}

/**
 * An occupied roster slot: sprite + identity + type badges (primary),
 * "Configure" as a real button (primary action — task §6/§20: "must now
 * look like a real button, not a text link"), and change-form/remove as two
 * secondary square icon buttons (task §7).
 */
export function FilledTeamTile({
  locale,
  member,
  form,
  visualIdentity,
  typeLabels,
  labels,
  selected,
  onSelect,
  onRemove,
  onStartChangeForm,
}: {
  locale: Locale;
  member: TeamMemberDraft;
  form: ComparablePokemonForm | undefined;
  /**
   * Fallback identity derived from the already-loaded search index, shown
   * while `form` (the real `ComparablePokemonForm`, from a background
   * fetch keyed on the roster's form slugs) hasn't resolved yet — never
   * used once `form` is present. Visual only: abilities/stats/learnset
   * always come from `form`, never from this.
   */
  visualIdentity: RosterVisualIdentity | undefined;
  typeLabels: Record<PokemonType, string>;
  labels: TeamSlotLabels;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onStartChangeForm: () => void;
}) {
  const resolvedName = form
    ? form.isDefaultForm
      ? form.speciesName
      : form.formName
    : visualIdentity?.displayName;

  const displayName =
    member.nickname.trim().length > 0
      ? member.nickname
      : (resolvedName?.[locale] ?? member.formSlug);

  const types = form?.types ?? visualIdentity?.types;

  const spriteRequest = form
    ? {
        formSlug: form.formSlug,
        speciesSlug: form.speciesSlug,
        nationalDexNumber: form.nationalDexNumber,
        isDefaultForm: form.isDefaultForm,
        pokeapiPokemonId: form.pokeapiPokemonId,
      }
    : visualIdentity
      ? {
          formSlug: visualIdentity.formSlug,
          speciesSlug: visualIdentity.speciesSlug,
          nationalDexNumber: visualIdentity.nationalDexNumber,
          isDefaultForm: visualIdentity.isDefaultForm,
          pokeapiPokemonId: visualIdentity.pokeapiPokemonId,
        }
      : undefined;

  const spriteUrl = spriteRequest ? getPokemonSprite(spriteRequest) : undefined;

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border p-3 transition-colors ${
        selected ? 'border-brand bg-brand-muted' : 'border-border-subtle bg-surface'
      }`}
    >
      <div className="flex items-start gap-3">
        {types && spriteUrl ? (
          <PokemonSpriteFrame spriteUrl={spriteUrl} types={types} />
        ) : types ? (
          <PokemonArtSlot initial={displayName.charAt(0)} types={types} variant="hero" />
        ) : (
          <div
            className="h-16 w-16 shrink-0 animate-pulse rounded-md bg-surface-raised"
            aria-hidden="true"
          />
        )}
        <div className="min-w-0 flex-1 pt-1">
          <span className="block truncate text-sm font-semibold text-foreground">
            {displayName}
          </span>
          {types ? (
            <span className="mt-1 flex flex-wrap gap-1">
              {types.map((type) => (
                <span
                  key={type}
                  className="rounded-full px-1.5 py-px text-[0.625rem] font-bold text-muted"
                  style={{ border: '1px solid var(--ps-color-border)' }}
                >
                  {typeLabels[type]}
                </span>
              ))}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onSelect}
          aria-label={formatMessage(labels.configureTemplate, { name: displayName })}
          aria-pressed={selected}
          className={buttonClass('default', 'px-3 py-1.5 text-xs')}
        >
          {labels.configureLabel}
        </button>

        <div className="flex shrink-0 items-center gap-1.5">
          <SlotIconButton
            onClick={onStartChangeForm}
            label={formatMessage(labels.changeFormTemplate, { name: displayName })}
            title={labels.changeFormLabel}
          >
            <ChangeFormIcon />
          </SlotIconButton>
          <SlotIconButton
            onClick={onRemove}
            label={formatMessage(labels.removeFromTeamTemplate, { name: displayName })}
            title={labels.removePokemonLabel}
            danger
          >
            <RemoveIcon />
          </SlotIconButton>
        </div>
      </div>
    </div>
  );
}

/** The sprite tile's fixed visual viewport (manual review, final correction pass §2) — every sprite/placeholder shares this exact box so swapping between them never reflows the card. */
const SPRITE_VIEWPORT_CLASS = 'h-16 w-16';

/**
 * A real sprite, framed the same size/radius as the placeholder it replaces,
 * with a very subtle type-accented background wash behind it (task §8:
 * "clean pixel sprite + very subtle type aura... do NOT tint the whole
 * card"). A restrained hover lift is the only micro-interaction (task §12).
 *
 * Manual review (final correction pass §2): a real browser check found
 * noticeably inconsistent visual presence across species (Pikachu/Mew read
 * as tiny next to Garchomp) — PokéAPI's `sprites/pokemon/{id}.png` files
 * aren't a consistent canvas/padding per species (they're sourced from
 * various in-game battle-sprite generations, which intentionally draw a
 * physically larger Pokémon bigger within its own frame). The root cause
 * here was a real, fixable bug though: the `<img>` itself was hard-capped to
 * a box *smaller* than its container (48px inside a 64px frame), wasting
 * fixed margin on every sprite alike. The image now fills the *entire*
 * fixed viewport (`h-full w-full`) with `object-contain` — the browser
 * scales each sprite's own intrinsic size up or down to make maximum use of
 * that one shared box, preserving its aspect ratio, with no per-species
 * value anywhere in this file. This doesn't make every sprite's silhouette
 * identically sized (the source art itself still varies) — it makes every
 * sprite use the same viewport as fully as its own image allows, which is
 * the honest ceiling of what CSS alone can normalize here.
 */
function PokemonSpriteFrame({
  spriteUrl,
  types,
}: {
  spriteUrl: string;
  types: readonly PokemonType[];
}) {
  const primaryVar = pokemonTypeColorVar[types[0]!];
  const secondaryVar = pokemonTypeColorVar[types[1] ?? types[0]!];

  return (
    <div
      className={`relative flex ${SPRITE_VIEWPORT_CLASS} shrink-0 items-center justify-center overflow-hidden rounded-xl`}
      style={{
        background: `linear-gradient(155deg, color-mix(in srgb, var(${primaryVar}) 16%, var(--ps-color-bg-elevated)), color-mix(in srgb, var(${secondaryVar}) 16%, var(--ps-color-bg-elevated)) 100%)`,
      }}
    >
      {/* The card's own name text already labels this Pokémon — the image
          itself is decorative, not independently meaningful (task §27).
          Plain <img>, not next/image: the sprite source is an explicitly
          PROVISIONAL/dev-only external host (see pokemon-sprite.ts's doc
          comment) — wiring up Next's image optimizer/remotePatterns for it
          is a production-readiness decision this pass doesn't make. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={spriteUrl}
        alt=""
        // The roster caps at 6 tiles (never an off-screen list to defer), and
        // this is exactly the sprite the player just picked — `lazy` would
        // wait for an IntersectionObserver tick that's already true, adding
        // a visible delay to the one image the flash-visual fix cares about.
        loading="eager"
        className="h-full w-full object-contain p-1 transition-transform duration-200 ease-ps motion-reduce:transition-none [image-rendering:pixelated] hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
      />
    </div>
  );
}
