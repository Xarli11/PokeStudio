/**
 * Shared Tailwind class-string helpers for PokeLab's small recurring
 * "product primitives" (button, card, tag, segmented control) — Styling
 * Foundation 1.0 / UI Polish 1.1. Every class here composes tokens already
 * aliased into Tailwind's theme (packages/ui/src/tokens.css `@theme`),
 * never a raw hex or arbitrary pixel value.
 *
 * Plain functions rather than components: call sites render very different
 * elements (Link, button, a, li, details) for the same visual treatment, so
 * a class-string helper composes more simply than a polymorphic wrapper.
 */

export type ButtonVariant = 'default' | 'primary' | 'danger';

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-sm font-semibold leading-none no-underline transition-colors disabled:cursor-default disabled:opacity-55 aria-disabled:cursor-default aria-disabled:opacity-55';

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  // The default control — pagination/back-links use this look.
  default:
    'border border-border bg-surface text-foreground px-3 py-2 text-sm cursor-pointer hover:bg-surface-hover active:bg-surface-active active:scale-[0.98]',
  // The one high-emphasis action per page (home hero CTA, not-found back
  // link, global-error retry) — `brand-action`, not `brand`: a filled
  // button's own background is a different contrast problem than brand text
  // on a light page, so it gets its own semantic token (see tokens.css).
  primary:
    'border border-transparent bg-brand-action text-brand-contrast px-5 py-3 text-base cursor-pointer hover:bg-brand-action-hover active:brightness-95',
  // The one destructive action in the product so far (delete a team) — its
  // own semantic token (`--pl-color-danger`, same absolute value in both
  // themes), never the brand color repurposed as a warning color.
  danger:
    'border border-transparent bg-danger text-white px-3 py-2 text-sm cursor-pointer hover:brightness-95 active:brightness-90',
};

export function buttonClass(variant: ButtonVariant = 'default', className = ''): string {
  return [BUTTON_BASE, BUTTON_VARIANT[variant], className].filter(Boolean).join(' ');
}

const CARD_BASE = 'rounded-lg border border-border-subtle bg-surface shadow-sm';

export function cardClass(className = ''): string {
  return [CARD_BASE, className].filter(Boolean).join(' ');
}

/**
 * A `cardClass` that is also the page's primary link target (PokemonCard,
 * home pillar preview) — restrained hover/focus: a border-color shift, a
 * one-notch surface lift (`bg-surface-hover`) and a 2px nudge, never a
 * colored glow shadow or scale (UI Polish 1.1 — "no glass panels, no large
 * shadows").
 */
export function interactiveCardClass(className = ''): string {
  return [
    CARD_BASE,
    'text-inherit no-underline transition-[border-color,background-color,transform] duration-200 ease-pl',
    'hover:border-brand/40 hover:bg-surface-hover hover:-translate-y-0.5',
    'focus-visible:border-brand/40 focus-visible:bg-surface-hover focus-visible:-translate-y-0.5',
    'motion-reduce:hover:translate-y-0 motion-reduce:focus-visible:translate-y-0',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

const TAG_BASE =
  'inline-flex min-w-0 max-w-full whitespace-normal items-center rounded-full border border-border px-2 py-[0.1875rem] text-xs font-semibold leading-tight text-muted';

/** Short uppercase labels (category names, "Hidden Ability") — not for full sentences. */
const TAG_LABEL = 'font-bold uppercase tracking-wide whitespace-nowrap';

const TAG_ACCENT = 'border-transparent bg-brand-muted text-brand';

export function tagClass(
  options: { label?: boolean; accent?: boolean } = {},
  className = '',
): string {
  return [TAG_BASE, options.label && TAG_LABEL, options.accent && TAG_ACCENT, className]
    .filter(Boolean)
    .join(' ');
}

/**
 * The Explore search field family (Search UX v2 — Pokémon combobox, Ability
 * search): a search icon on the left and room for a clear button on the
 * right, sized with a touch more presence than an ordinary filter input.
 */
export const searchInputClass =
  'w-full rounded-md border border-border-subtle bg-surface py-2.5 pl-9 pr-9 text-sm text-foreground transition-colors focus:border-brand focus:outline-none';

/** Small uppercase section kicker above a page title (a dot marker + label). */
export function eyebrowClass(className = ''): string {
  return [
    "inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand before:content-[''] before:inline-block before:h-1.5 before:w-1.5 before:rounded-full before:bg-current",
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

/** The tiny "Soon" marker on a reserved-but-unlinked destination (PersistentShell nav, home pillar preview). */
export const soonBadgeClass =
  'rounded-full bg-brand-muted px-2 py-px text-[0.625rem] font-bold text-brand uppercase tracking-wide';

/**
 * Compact segmented-control chrome for the header's secondary controls
 * (locale switcher, theme toggle) — one quiet pill surface instead of loose
 * ghost-styled text, but still visually secondary to primary navigation.
 */
export const segmentGroupClass =
  'inline-flex items-center gap-0.5 rounded-full border border-border-subtle bg-surface p-0.5';

export function segmentClass(className = ''): string {
  return [
    'inline-flex h-6 items-center justify-center rounded-full px-2.5 text-xs font-bold text-muted transition-colors cursor-pointer hover:text-foreground data-[active=true]:bg-brand-muted data-[active=true]:text-brand',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}
