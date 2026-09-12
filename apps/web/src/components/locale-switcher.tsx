'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { type Locale, locales } from '@pokestudio/i18n';

import { segmentClass, segmentGroupClass } from '@/lib/ui-classes';

export function LocaleSwitcher({ currentLocale }: { currentLocale: Locale }) {
  const pathname = usePathname();

  function hrefFor(locale: Locale) {
    const rest = pathname.replace(`/${currentLocale}`, '') || '/';
    return `/${locale}${rest === '/' ? '' : rest}`;
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
