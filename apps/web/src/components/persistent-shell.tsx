'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { Dictionary, Locale } from '@pokelab/i18n';

import { brandAssets } from '@/lib/brand-assets';
import { soonBadgeClass } from '@/lib/ui-classes';

import { ExploreSubnav } from './explore-subnav';
import { LocaleSwitcher } from './locale-switcher';
import { ThemeToggle } from './theme-toggle';

type NavSection = 'explore' | 'build' | 'battleLab' | undefined;

/**
 * Real pathname-based section detection (Milestone 2, Stage 2B — Build now
 * has real routes, so "Explore is current everywhere" no longer holds).
 * Strips the locale prefix first so this doesn't need per-locale path
 * knowledge.
 */
function currentSectionFor(pathname: string, locale: Locale): NavSection {
  const path = pathname.startsWith(`/${locale}`) ? pathname.slice(locale.length + 1) : pathname;
  const exploreRoutes = ['/pokemon', '/moves', '/abilities', '/compare'];
  if (exploreRoutes.some((route) => path.startsWith(route))) return 'explore';
  if (path.startsWith('/build')) return 'build';
  return undefined;
}

export interface PersistentShellProps {
  locale: Locale;
  dictionary: Dictionary;
  children: React.ReactNode;
}

/**
 * Both theme variants render at all times; the `[[data-theme=light]_&]`
 * arbitrary variant (an ancestor-attribute selector, mirroring the
 * `[data-theme='light']` pattern tokens.css already uses for colors) shows
 * the right one — no client JS, so there's no hydration mismatch and no
 * flash of the wrong variant. Both sit in the same grid cell
 * (`col-start-1 row-start-1`) so the link's box size never changes when the
 * visible one swaps — no layout shift across the theme toggle.
 */
const WORDMARK_SIZE = 'col-start-1 row-start-1 block h-7 w-auto md:h-8 xl:h-11';

/**
 * PokeLab's one persistent application chrome — identity, primary
 * navigation (Explore active; Build/Battle Lab visibly reserved but not
 * linked), locale/theme controls, skip link, and a slim footer disclaimer.
 *
 * Rendered once from `[locale]/layout.tsx` (not per page): header, nav, and
 * the locale/theme controls are a stable ancestor across every route under
 * `[locale]`, so they no longer unmount/remount on ordinary navigation —
 * only `{children}` (the actual page content, passed through from the
 * layout) changes between routes. `<main>` lives here too, for exactly one
 * stable landmark + skip-link target per page; each page owns its own
 * content width by putting `max-w-text|detail|wide` on its own top-level
 * wrapper, not by passing a width prop through this shell.
 *
 * Desktop (≥1200px, `xl:`) is one cohesive row — logo, nav, controls — via
 * flex-wrap + order/basis, not a duplicated nav landmark: `nav` carries
 * `basis-full` to force it onto its own line below `logo`/`controls` at
 * narrower widths, and drops to `basis-auto` once `xl:flex-nowrap` takes
 * over. `nav` keeps its own `overflow-x-auto` regardless — a "horizontal
 * scroll-safe" fallback, never actually engaged once there's room, so it
 * costs nothing at desktop widths.
 */
export function PersistentShell({ locale, dictionary, children }: PersistentShellProps) {
  const pathname = usePathname();
  const currentSection = currentSectionFor(pathname, locale);
  const navItems: { key: NavSection; label: string; href: string | null }[] = [
    { key: 'explore', label: dictionary.nav.explore, href: `/${locale}/pokemon` },
    { key: 'build', label: dictionary.nav.build, href: `/${locale}/build` },
    { key: 'battleLab', label: dictionary.nav.battleLab, href: null },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="fixed top-2 left-2 z-50 -translate-y-[150%] rounded-sm bg-brand px-4 py-2 font-semibold text-brand-contrast no-underline transition-transform focus:translate-y-0"
      >
        {dictionary.nav.skipToContent}
      </a>

      {/*
        Divider: a low-contrast structural border (felt, not noticed) in both
        themes, plus — dark mode only — an extremely faint Emerald gradient
        line riding the same edge, concentrated toward the center and fading
        at the screen edges (never a flat "neon" line edge-to-edge). The
        `[[data-theme=light]_&]` ancestor-attribute variant mirrors the
        pattern the wordmark swap below already uses.
      */}
      <header className="sticky top-0 z-40 min-w-0 border-b border-border-subtle bg-background/92 backdrop-blur after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-brand/25 after:to-transparent [[data-theme=light]_&]:after:opacity-0">
        <div className="mx-auto flex w-full max-w-wide flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 xl:flex-nowrap xl:py-4">
          {/* Brand 1.0 — official Figma wordmark (apps/web/src/lib/brand-assets.ts). */}
          <Link href={`/${locale}`} aria-label="PokeLab" className="order-1 inline-grid rounded-sm">
            <Image
              src={brandAssets.wordmarkOnDark}
              alt=""
              width={640}
              height={160}
              priority
              unoptimized
              className={`${WORDMARK_SIZE} [[data-theme=light]_&]:hidden`}
            />
            <Image
              src={brandAssets.wordmarkOnLight}
              alt=""
              width={640}
              height={160}
              priority
              unoptimized
              className={`${WORDMARK_SIZE} hidden [[data-theme=light]_&]:block`}
            />
          </Link>

          <nav
            aria-label={dictionary.nav.mainNavigation}
            className="order-3 flex min-w-0 basis-full items-center gap-5 overflow-x-auto xl:order-2 xl:ml-10 xl:basis-auto"
          >
            {navItems.map((item) =>
              item.href ? (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={item.key === currentSection ? 'page' : undefined}
                  className="relative inline-flex items-center gap-1 border-b border-transparent py-1 pb-2 text-sm font-semibold whitespace-nowrap text-muted no-underline transition-colors hover:text-foreground aria-[current=page]:border-brand aria-[current=page]:text-foreground"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  key={item.key}
                  aria-disabled="true"
                  role="link"
                  className="relative inline-flex cursor-default items-center gap-1 py-1 pb-2 text-sm font-semibold whitespace-nowrap text-muted opacity-65"
                >
                  {item.label}
                  <span className={soonBadgeClass}>{dictionary.nav.soon}</span>
                </span>
              ),
            )}
          </nav>

          <div className="order-2 ml-auto flex items-center gap-2 xl:order-3">
            <LocaleSwitcher currentLocale={locale} />
            <ThemeToggle labels={dictionary.theme} />
          </div>
        </div>
      </header>

      {/*
        Explore-local subnav (Phase 1C.3 §16) — Pokémon/Moves/Abilities are
        Explore's three current areas, not top-level product destinations
        (those are Explore/Build/Battle Lab, above), so this is its own
        secondary nav rather than crowding the primary header. Only shown on
        Explore's own routes now that Build has real routes of its own
        (Milestone 2, Stage 2B) — it would be confusing chrome on a Build page.
      */}
      {currentSection === 'explore' ? (
        <ExploreSubnav
          ariaLabel={dictionary.nav.exploreNavigation}
          items={[
            { key: 'pokemon', label: dictionary.nav.pokemon, href: `/${locale}/pokemon` },
            { key: 'moves', label: dictionary.moves.title, href: `/${locale}/moves` },
            { key: 'abilities', label: dictionary.abilities.title, href: `/${locale}/abilities` },
          ]}
        />
      ) : null}

      <main id="main-content" className="w-full flex-1 px-4 pt-6 pb-8 sm:pt-12 sm:pb-16">
        {children}
      </main>

      <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted">
        {dictionary.footer.disclaimer}
      </footer>
    </div>
  );
}
