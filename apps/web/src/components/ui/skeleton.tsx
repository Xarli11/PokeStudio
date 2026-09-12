/**
 * A pulsing placeholder block for `loading.tsx` boundaries — replaces the
 * old global `.ps-skeleton` class. `motion-reduce:` swaps the pulse for a
 * static dim block instead of animating (prefers-reduced-motion).
 */
/** Callers include their own `rounded-*` in `className` (`rounded-md` fits most placeholders; `rounded-full` for avatar-shaped ones) — kept out of the base classes so it isn't fighting a fixed default at the same specificity. */
export function Skeleton({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`bg-surface-raised motion-reduce:animate-none motion-reduce:opacity-70 animate-pulse ${className}`}
    />
  );
}
