import { buttonClass } from '@/lib/ui-classes';

/**
 * Class strings shared by the Battle Sandbox. They only compose the design system's own tokens
 * (surface / surface-raised / surface-hover, border-subtle, muted, brand, success, warning,
 * danger), so both themes work. Depth is kept to three levels: the page, a panel
 * (`surface-raised`), and an interactive tile (`surface`). Brand emerald is reserved for what is
 * active, selected or primary.
 */

/** A grouped region of the Sandbox (setup step, battlefield, action area, tools). */
export const panelClass = (className = '') =>
  ['rounded-lg border border-border-subtle bg-surface-raised', className].filter(Boolean).join(' ');

/** An interactive option that sits on a panel (a move, a target, a switch, a team pick). */
export const optionClass = (selected: boolean, className = '') =>
  [
    'flex cursor-pointer items-center justify-between gap-3 rounded-md border px-3.5 py-2.5 text-left text-sm font-semibold transition-colors',
    'disabled:cursor-default disabled:opacity-45',
    selected
      ? 'border-brand/70 bg-brand-muted text-foreground'
      : 'border-transparent bg-surface text-foreground shadow-sm hover:bg-surface-hover',
    className,
  ]
    .filter(Boolean)
    .join(' ');

/** A small pill with a state; `tone` decides the colour, never alone (callers also add a mark/text). */
export const badgeClass = (tone: 'neutral' | 'ready' | 'warning' | 'danger' = 'neutral') =>
  [
    'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold',
    tone === 'ready'
      ? 'bg-brand-muted text-brand'
      : tone === 'warning'
        ? 'bg-warning/15 text-warning'
        : tone === 'danger'
          ? 'bg-danger/15 text-danger'
          : 'bg-surface text-muted',
  ].join(' ');

/** A quiet section label (sentence case, not shouty). */
export const labelClass = 'text-xs font-semibold text-muted';

/** A segmented control: one pill track, the active segment carries the accent. */
export const segmentTrackClass =
  'inline-flex items-center gap-0.5 rounded-full border border-border-subtle bg-surface p-0.5';
export const segmentButtonClass = (active: boolean) =>
  [
    'inline-flex min-h-8 cursor-pointer items-center justify-center rounded-full px-3.5 text-sm font-semibold transition-colors',
    active ? 'bg-brand-muted text-brand' : 'text-muted hover:text-foreground',
  ].join(' ');

/**
 * The high-emphasis action, but unmistakably off when disabled: a neutral surface with muted text,
 * so strong emerald only ever means "available".
 */
export const primaryActionClass = (className = '') =>
  buttonClass(
    'primary',
    [
      'disabled:border-border-subtle disabled:bg-surface disabled:text-muted disabled:opacity-100 disabled:hover:bg-surface disabled:active:scale-100',
      className,
    ]
      .filter(Boolean)
      .join(' '),
  );
