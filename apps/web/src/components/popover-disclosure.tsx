'use client';

import { useEffect, useId, useRef, useState } from 'react';

export interface PopoverDisclosureProps {
  /** Rendered inside the trigger button — keep it short, this is what stays visible in the row. */
  trigger: React.ReactNode;
  /** Overrides the trigger's accessible name when `trigger` alone wouldn't read sensibly to a screen reader (e.g. a bare count). */
  triggerAriaLabel?: string;
  children: React.ReactNode;
  /** Horizontal anchor side, relative to the trigger — `end` avoids overflowing a table's right edge for a right-aligned column. */
  align?: 'start' | 'end';
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
  triggerAriaLabel,
  children,
  align = 'start',
}: PopoverDisclosureProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();

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
  }, [open]);

  return (
    <span ref={rootRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        aria-label={triggerAriaLabel}
        onClick={() => setOpen((value) => !value)}
        className="cursor-pointer rounded-sm border border-border-subtle bg-surface px-1.5 py-0.5 text-xs font-medium text-muted transition-colors hover:border-brand/40 hover:text-foreground focus-visible:border-brand/40 focus-visible:text-foreground"
      >
        {trigger}
      </button>
      {open ? (
        <div
          id={popoverId}
          role="group"
          className={`absolute z-20 mt-1 max-h-[340px] w-max min-w-[11rem] max-w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-md border border-border bg-surface-raised p-2.5 text-xs shadow-md ${
            align === 'end' ? 'right-0' : 'left-0'
          }`}
        >
          {children}
        </div>
      ) : null}
    </span>
  );
}
