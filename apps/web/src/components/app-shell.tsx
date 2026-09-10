import Link from 'next/link';

import type { Dictionary, Locale } from '@pokestudio/i18n';

import styles from './app-shell.module.css';
import { LocaleSwitcher } from './locale-switcher';
import { ThemeToggle } from './theme-toggle';

export type AppShellActiveSection = 'explore' | 'build' | 'battleLab';

export interface AppShellProps {
  locale: Locale;
  dictionary: Dictionary;
  active: AppShellActiveSection;
  /** 'text' (default) for reading-width pages; 'wide' for the Pokédex grid. */
  contentWidth?: 'text' | 'wide';
  children: React.ReactNode;
}

/**
 * The one PokeStudio application shell (UX/UI 0.1, Part B) — identity,
 * primary navigation (Explore active; Build/Battle Lab visibly reserved but
 * not linked, since they don't exist yet — CLAUDE.md §14 "no fake
 * completeness"), locale/theme controls, skip link, and a slim footer
 * disclaimer. Every page under `[locale]` renders through this instead of
 * hand-rolling its own header, so navigation is consistent everywhere.
 *
 * Responsive without a mobile menu: only 3 nav destinations exist today, so
 * they render as their own horizontally-scrollable row under the header
 * (a small "tab bar," not a hamburger disclosure) — this fits comfortably
 * even at a 320px viewport and needs no additional client-side state.
 */
export function AppShell({
  locale,
  dictionary,
  active,
  contentWidth = 'text',
  children,
}: AppShellProps) {
  const navItems: { key: AppShellActiveSection; label: string; href: string | null }[] = [
    { key: 'explore', label: dictionary.nav.explore, href: `/${locale}/pokemon` },
    { key: 'build', label: dictionary.nav.build, href: null },
    { key: 'battleLab', label: dictionary.nav.battleLab, href: null },
  ];

  return (
    <div className={styles.shell}>
      <a href="#main-content" className="ps-skip-link">
        {dictionary.nav.skipToContent}
      </a>

      <header className={styles.header}>
        <div className={styles.headerRow}>
          <Link href={`/${locale}`} className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true" />
            PokeStudio
          </Link>
          <div className={styles.controls}>
            <LocaleSwitcher currentLocale={locale} />
            <ThemeToggle labels={dictionary.theme} />
          </div>
        </div>

        <nav className={styles.nav} aria-label={dictionary.nav.mainNavigation}>
          {navItems.map((item) =>
            item.href ? (
              <Link
                key={item.key}
                href={item.href}
                className={`ps-btn ${styles.navItem}`}
                aria-current={item.key === active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ) : (
              <span
                key={item.key}
                className={`ps-btn ${styles.navItem}`}
                aria-disabled="true"
                role="link"
              >
                {item.label}
                <span className={styles.soonBadge}>{dictionary.nav.soon}</span>
              </span>
            ),
          )}
        </nav>
      </header>

      <main
        id="main-content"
        className={`${styles.main} ${contentWidth === 'wide' ? styles.mainWide : styles.mainText}`}
      >
        {children}
      </main>

      <footer className={styles.footer}>{dictionary.footer.disclaimer}</footer>
    </div>
  );
}
