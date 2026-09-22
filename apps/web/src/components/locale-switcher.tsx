'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { type Locale, locales } from '@pokestudio/i18n';

import { segmentClass, segmentGroupClass } from '@/lib/ui-classes';

export function LocaleSwitcher({ currentLocale }: { currentLocale: Locale }) {
  const pathname = usePathname();
  // `usePathname()` deliberately excludes the query string, so a page like
  // Compare (`?pokemon=...`) or an imported Damage Lab link
  // (`?team=...&member=...`) used to lose it on every locale switch — a
  // general bug, not specific to any one page. Reading `useSearchParams()`
  // instead would force this always-mounted shell component (and every
  // page under it) out of static rendering without its own Suspense
  // boundary; reading `window.location.search` directly after mount avoids
  // that, at the cost of starting from '' during SSR (matches the server
  // HTML, so no hydration mismatch) and filling in the real value a moment
  // later. Re-reads on every route change so a client-side navigation to a
  // new query string is still preserved on the next locale switch.
  const [search, setSearch] = useState('');
  useEffect(() => {
    setSearch(window.location.search);
  }, [pathname]);

  function hrefFor(locale: Locale) {
    const rest = pathname.replace(`/${currentLocale}`, '') || '/';
    return `/${locale}${rest === '/' ? '' : rest}${search}`;
  }

  return (
    <div role="group" aria-label="Language" className={segmentGroupClass}>
      {locales.map((locale) => (
        <Link
          key={locale}
          href={hrefFor(locale)}
          // A cookie, not app state — middleware reads `NEXT_LOCALE` on the
          // *next* request to pick the default locale for an un-prefixed
          // path. `<Link>` still does its own client-side navigation for
          // this click; this only primes the next one.
          onClick={() => {
            document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000`;
          }}
          aria-current={locale === currentLocale}
          data-active={locale === currentLocale}
          className={segmentClass()}
        >
          {locale.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}
