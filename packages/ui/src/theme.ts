export const themes = ['dark', 'light'] as const;

export type Theme = (typeof themes)[number];

export const defaultTheme: Theme = 'dark';

/**
 * The one storage key for PokeLab's theme preference. Deliberately not
 * namespaced by locale (or anything else) — theme and locale are
 * independent preferences, and there must be exactly one place a user's
 * theme choice lives, read the same way regardless of which locale route
 * they're currently on.
 */
// Stable persisted preference, retained across the PokeLab rebrand.
export const themeStorageKey = 'pokestudio-theme';

export function isTheme(value: string | null | undefined): value is Theme {
  return !!value && (themes as readonly string[]).includes(value);
}

/**
 * Inline script source executed before hydration to set `data-theme` from
 * storage/system preference and avoid a flash of the wrong theme.
 * Kept as a plain string so it can run as a blocking <script> in <head>.
 *
 * This is the *only* place that runs before the first paint of a fresh
 * document load — it can't be shared as an imported function (no bundle has
 * loaded yet when it runs). `ThemeToggle` (apps/web) mirrors this same
 * resolution order in real TS for the case this script can't cover: a
 * client-side locale switch, which re-mounts `ThemeToggle` without re-running
 * this script. Keep the two in sync by hand if this logic ever changes.
 */
export const themeInitScript = `(function () {
  try {
    var stored = localStorage.getItem('${themeStorageKey}');
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (_e) {
    document.documentElement.setAttribute('data-theme', '${defaultTheme}');
  }
})();`;
