'use client';

import { useEffect, useState } from 'react';

import { type Theme, defaultTheme, isTheme, themeStorageKey } from '@pokestudio/ui';

export function ThemeToggle({
  labels,
}: {
  labels: { toggle: string; light: string; dark: string };
}) {
  const [theme, setTheme] = useState<Theme>(defaultTheme);

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    if (isTheme(current)) setTheme(current);
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
      className="ps-btn ps-btn-ghost"
    >
      {theme === 'dark' ? labels.light : labels.dark}
    </button>
  );
}
