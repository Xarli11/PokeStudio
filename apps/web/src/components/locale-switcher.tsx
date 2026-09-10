'use client';

import { usePathname, useRouter } from 'next/navigation';

import { type Locale, locales } from '@pokestudio/i18n';

export function LocaleSwitcher({ currentLocale }: { currentLocale: Locale }) {
  const pathname = usePathname();
  const router = useRouter();

  function switchTo(locale: Locale) {
    const rest = pathname.replace(`/${currentLocale}`, '') || '/';
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000`;
    router.push(`/${locale}${rest === '/' ? '' : rest}`);
  }

  return (
    <div role="group" aria-label="Language" style={{ display: 'flex', gap: '0.25rem' }}>
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => switchTo(locale)}
          aria-current={locale === currentLocale}
          data-active={locale === currentLocale}
          className="ps-btn"
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
