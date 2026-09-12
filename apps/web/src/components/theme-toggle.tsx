'use client';

import { useEffect, useLayoutEffect, useState } from 'react';

import { type Theme, defaultTheme, isTheme, themeStorageKey } from '@pokestudio/ui';

// `useLayoutEffect` warns when it runs on the server; this component is
// server-rendered (Next.js renders Client Components on the server too),
// so fall back to `useEffect` there — it never actually needs to run
// server-side since there's no DOM/localStorage to read yet.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Same resolution order as `@pokestudio/ui`'s `themeInitScript` (stored
 * preference, else system preference, else the default) — kept here
 * rather than in `packages/ui` because that package's `tsconfig` has no DOM
 * lib (it's meant to stay environment-agnostic); this needs `window`.
 *
 * Exists because `data-theme` on `<html>` is not a reliable source of truth
 * for "what did the user actually choose": a client-side navigation across
 * the `[locale]` route segment re-renders `<html>` from a fresh server
 * payload that (correctly) never includes `data-theme` — the pre-hydration
 * script that would normally re-derive it only runs once, on the initial
 * document load, not on that kind of soft navigation. Reading the one
 * global `themeStorageKey` directly (instead of the DOM attribute) is what
 * makes the theme survive a locale switch: it's the same key regardless of
 * which locale route asked for it.
 */
function resolveStoredOrSystemTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(themeStorageKey);
    if (isTheme(stored)) return stored;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch {
    return defaultTheme;
  }
}

export function ThemeToggle({
  labels,
}: {
  labels: { toggle: string; light: string; dark: string };
}) {
  const [theme, setTheme] = useState<Theme>(defaultTheme);

  // Runs on every mount, including a simulated-locale-switch remount (see
  // `resolveStoredOrSystemTheme` above) — `useLayoutEffect` applies the
  // result before the browser paints this frame, so there's no flash of
  // the wrong theme during that transition.
  useIsomorphicLayoutEffect(() => {
    const resolved = resolveStoredOrSystemTheme();
    setTheme(resolved);
    document.documentElement.setAttribute('data-theme', resolved);
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      window.localStorage.setItem(themeStorageKey, next);
    } catch {
      // Storage unavailable (private browsing, etc.) — theme still applies for this load.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={labels.toggle}
      className="inline-flex h-7 cursor-pointer items-center justify-center rounded-full border border-border-subtle bg-surface px-3 text-xs font-bold text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
    >
      {theme === 'dark' ? labels.light : labels.dark}
    </button>
  );
}
