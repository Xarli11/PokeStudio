export const themes = ['dark', 'light'] as const;

export type Theme = (typeof themes)[number];

export const defaultTheme: Theme = 'dark';

export const themeStorageKey = 'pokestudio-theme';

export function isTheme(value: string | null | undefined): value is Theme {
  return !!value && (themes as readonly string[]).includes(value);
}

/**
 * Inline script source executed before hydration to set `data-theme` from
 * storage/system preference and avoid a flash of the wrong theme.
 * Kept as a plain string so it can run as a blocking <script> in <head>.
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
