import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeToggle } from './theme-toggle';

const labels = { toggle: 'Toggle theme', light: 'Light', dark: 'Dark' };

/**
 * The system-preference fallback reads `window.matchMedia`, which jsdom
 * doesn't implement — tests exercising that fallback path stub it.
 */
function stubMatchMedia(prefersLight: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: light)' && prefersLight,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })),
  );
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute('data-theme');
    vi.unstubAllGlobals();
  });

  it('toggles the data-theme attribute and persists the choice', () => {
    window.localStorage.setItem('pokestudio-theme', 'dark');
    render(<ThemeToggle labels={labels} />);

    fireEvent.click(screen.getByRole('button', { name: labels.toggle }));

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(window.localStorage.getItem('pokestudio-theme')).toBe('light');
  });

  /**
   * The bug this originally guarded against: a locale switch re-rendering
   * `<html>` without `data-theme`, with nothing re-deriving it. `ThemeToggle`
   * now lives in `PersistentShell` (rendered once from `[locale]/layout.tsx`,
   * not per page), so it no longer remounts on ordinary navigation at all —
   * but it still remounts on an actual locale switch (a different `[locale]`
   * segment value is a genuinely different layout instance), so this
   * resolve-on-mount behavior stays load-bearing precisely for that case.
   * Simulated here via unmount + fresh render, matching that remount.
   */
  it('ES light → EN → dark → ES stays dark', () => {
    window.localStorage.setItem('pokestudio-theme', 'light');

    const es1 = render(<ThemeToggle labels={labels} />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    es1.unmount();

    // Simulated locale switch to /en — a fresh mount, no prior data-theme.
    document.documentElement.removeAttribute('data-theme');
    const en = render(<ThemeToggle labels={labels} />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    fireEvent.click(screen.getByRole('button', { name: labels.toggle }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(window.localStorage.getItem('pokestudio-theme')).toBe('dark');
    en.unmount();

    // Simulated locale switch back to /es.
    document.documentElement.removeAttribute('data-theme');
    render(<ThemeToggle labels={labels} />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('EN dark → ES → light → EN stays light', () => {
    window.localStorage.setItem('pokestudio-theme', 'dark');

    const en1 = render(<ThemeToggle labels={labels} />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    en1.unmount();

    document.documentElement.removeAttribute('data-theme');
    const es = render(<ThemeToggle labels={labels} />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    fireEvent.click(screen.getByRole('button', { name: labels.toggle }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(window.localStorage.getItem('pokestudio-theme')).toBe('light');
    es.unmount();

    document.documentElement.removeAttribute('data-theme');
    render(<ThemeToggle labels={labels} />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('reload preserves the global preference', () => {
    window.localStorage.setItem('pokestudio-theme', 'light');
    // A fresh document load never carries a prior `data-theme` — nothing
    // sets it ahead of the component (the real pre-hydration script would,
    // but this test is exercising the same-source fallback independently).
    document.documentElement.removeAttribute('data-theme');

    render(<ThemeToggle labels={labels} />);

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(screen.getByRole('button', { name: labels.toggle }).textContent).toBe(labels.dark);
  });

  it('first visit with no stored preference respects system preference (light)', () => {
    stubMatchMedia(true);

    render(<ThemeToggle labels={labels} />);

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('first visit with no stored preference respects system preference (dark)', () => {
    stubMatchMedia(false);

    render(<ThemeToggle labels={labels} />);

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
