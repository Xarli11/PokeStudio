'use client';

import { useEffect, useId, useRef, useState } from 'react';

const DEFAULT_PANEL_CLASS =
  'max-h-[340px] w-max min-w-[11rem] max-w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-md border border-border bg-surface-raised p-2.5 text-xs shadow-md';

export interface PopoverDisclosureProps {
  /** Rendered inside the built-in trigger button — ignored when `renderTrigger` is given. Keep it short, this is what stays visible in the row. */
  trigger?: React.ReactNode;
  /**
   * Renders the trigger yourself (own styling/size, e.g. Damage Lab's
   * already-styled move-select button) instead of this component's default
   * compact pill button. `ref` must be attached to the actual button
   * element for Escape-to-focus-return to keep working; `toggle` opens/
   * closes exactly like clicking the default trigger would.
   */
  renderTrigger?: (state: {
    open: boolean;
    toggle: () => void;
    ref: React.RefObject<HTMLButtonElement | null>;
  }) => React.ReactNode;
  /** Overrides the trigger's accessible name when `trigger` alone wouldn't read sensibly to a screen reader (e.g. a bare count). Ignored with `renderTrigger` — style your own `aria-label` there instead. */
  triggerAriaLabel?: string;
  children: React.ReactNode;
  /** Horizontal anchor side, relative to the trigger — `end` avoids overflowing a table's right edge for a right-aligned column, `center` anchors the panel under the trigger's own midpoint (a real CSS center, not a hack — for a trigger that sits in the visual middle of its own layout, e.g. Damage Lab's Move control). */
  align?: 'start' | 'end' | 'center';
  /**
   * Replaces the default compact panel styling (width/height/border/
   * background/padding/shadow) entirely, for a caller whose `children`
   * already bring their own complete framing (e.g. `MovePicker`'s own
   * bordered box) and only need this component's positioning/outside-
   * click/Escape behavior. Omit to keep the original small-popover look.
   */
  panelClassName?: string;
  /**
   * Controlled mode: a caller that already tracks open/close state
   * elsewhere owns it (`open`/`onOpenChange`) instead of this component's
   * internal `useState`. Omit both to keep the original self-contained
   * behavior — every existing call site does, unaffected.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * A tiny anchored disclosure for compact table cells (Phase 1C.2 polish —
 * "All moves"' games/methods cells): a trigger button toggles a small
 * floating panel positioned right under it, never an inline `<details>`
 * expansion that grows the row's own height. Deliberately not the native
 * `popover` attribute — that renders in the top layer via `position: fixed`
 * with no reliable cross-browser anchoring yet (CSS anchor positioning
 * isn't there), so this stays a plain, fully-controlled component instead:
 * no new dependency, same "smallest correct solution" reasoning as every
 * other primitive in `@/lib/ui-classes`.
 *
 * Click-outside and Escape both close it; Escape also returns focus to the
 * trigger. Content is never revealed by hover alone.
 */
export function PopoverDisclosure({
  trigger,
  renderTrigger,
  triggerAriaLabel,
  children,
  align = 'start',
  panelClassName,
  open: controlledOpen,
  onOpenChange,
}: PopoverDisclosureProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();

  function setOpen(value: boolean): void {
    onOpenChange?.(value);
    if (controlledOpen === undefined) setInternalOpen(value);
  }

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `setOpen` closes over `onOpenChange`/`controlledOpen`, both stable in practice for every call site; re-running only on `open` matches the original behavior.
  }, [open]);

  return (
    <span ref={rootRef} className="relative inline-block">
      {renderTrigger ? (
        renderTrigger({ open, toggle: () => setOpen(!open), ref: triggerRef })
      ) : (
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={open}
          aria-controls={open ? popoverId : undefined}
          aria-label={triggerAriaLabel}
          onClick={() => setOpen(!open)}
          className="cursor-pointer rounded-sm border border-border-subtle bg-surface px-1.5 py-0.5 text-xs font-medium text-muted transition-colors hover:border-brand/40 hover:text-foreground focus-visible:border-brand/40 focus-visible:text-foreground"
        >
          {trigger}
        </button>
      )}
      {open ? (
        <div
          id={popoverId}
          role="group"
          className={`absolute z-20 mt-1 ${panelClassName ?? DEFAULT_PANEL_CLASS} ${
            align === 'end'
              ? 'right-0'
              : align === 'center'
                ? 'left-1/2 -translate-x-1/2'
                : 'left-0'
          }`}
        >
          {children}
        </div>
      ) : null}
    </span>
  );
}
