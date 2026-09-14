'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

export interface ExploreSubnavProps {
  ariaLabel: string;
  items: { key: string; label: string; href: string }[];
}

/**
 * Explore's own secondary navigation — Pokémon / Moves / Abilities (Phase
 * 1C.3 §16). Every current route lives under Explore (see
 * `PersistentShell`'s `CURRENT_SECTION` comment), so this always renders
 * rather than needing route-based show/hide logic; it just needs
 * `usePathname()` to know which of the three is active, which is the only
 * reason this is a separate client component instead of living inline in
 * the (non-client) `PersistentShell`.
 */
export function ExploreSubnav({ ariaLabel, items }: ExploreSubnavProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={ariaLabel}
      className="w-full overflow-x-auto border-b border-border-subtle bg-surface/60"
    >
      <div className="mx-auto flex w-full max-w-wide items-center gap-4 px-4 py-2">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className="relative inline-flex items-center border-b-2 border-transparent py-1 text-sm font-semibold whitespace-nowrap text-muted no-underline transition-colors hover:text-foreground aria-[current=page]:border-brand aria-[current=page]:text-foreground"
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
