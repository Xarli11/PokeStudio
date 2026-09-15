'use client';

import { useEffect, useRef } from 'react';

import { buttonClass } from '@/lib/ui-classes';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A small, focused destructive-confirmation dialog (Milestone 2, Build
 * manual review — replaces `window.confirm`, which can't be styled/
 * localized consistently and reads as a browser chrome interruption, not a
 * PokeStudio surface). Built on the native `<dialog>` element rather than a
 * hand-rolled focus-trap: `showModal()` gives a real accessible modal for
 * free — focus trapped inside, background inert, Escape fires a cancelable
 * `cancel` event, and focus returns to whatever triggered it when closed —
 * without a new dependency or a bespoke a11y implementation (Ponytail:
 * platform capability beats hand-rolled framework).
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // `showModal`/`close` aren't implemented by jsdom (no real browser ships
    // `<dialog>` without them) — fall back to toggling the `open` attribute
    // directly so the component stays testable without changing real-browser
    // behavior, where `showModal()` is what actually gives the focus
    // trap/backdrop/Escape-as-`cancel`-event for free.
    const supportsNativeModal = typeof dialog.showModal === 'function';
    if (open && !dialog.open) {
      if (supportsNativeModal) dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    if (!open && dialog.open) {
      if (supportsNativeModal) dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="confirm-dialog-title"
      onCancel={(event) => {
        // The native Escape-triggered `cancel` event — route it through the
        // same `onCancel` callback as the Cancel button rather than letting
        // the dialog close itself, so the caller's state stays the source
        // of truth for `open`.
        event.preventDefault();
        onCancel();
      }}
      className="m-auto max-w-sm rounded-lg border border-border-subtle bg-surface p-5 text-foreground shadow-sm backdrop:bg-black/50"
    >
      {open ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <h2 id="confirm-dialog-title" className="m-0 text-base font-semibold">
              {title}
            </h2>
            <p className="m-0 text-sm text-muted">{description}</p>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCancel} className={buttonClass('default')}>
              {cancelLabel}
            </button>
            <button type="button" onClick={onConfirm} className={buttonClass('danger')}>
              {confirmLabel}
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
