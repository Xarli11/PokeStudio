import Link from 'next/link';
import { cookies } from 'next/headers';

import { defaultLocale, getDictionary, isLocale } from '@pokestudio/i18n';

import { AppShell } from '@/components/app-shell';

/**
 * Replaces Next.js's bare default 404 for every `notFound()` call under
 * `[locale]` (an unknown species slug, an unknown locale segment) — Part K.
 * Reads locale from the `NEXT_LOCALE` cookie rather than `params`, matching
 * `loading.tsx` (a not-found boundary isn't guaranteed the dynamic segment's
 * params in every Next.js version).
 */
export default async function NotFound() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : defaultLocale;
  const dictionary = getDictionary(locale);

  return (
    <AppShell locale={locale} dictionary={dictionary} active="explore">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 'var(--ps-space-3)',
          padding: 'var(--ps-space-6) 0',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 'var(--ps-font-size-2xl)' }}>
          {dictionary.notFound.title}
        </h1>
        <p style={{ margin: 0, color: 'var(--ps-color-text-muted)' }}>
          {dictionary.notFound.description}
        </p>
        <Link href={`/${locale}/pokemon`} className="ps-btn ps-btn-primary">
          {dictionary.notFound.backLink}
        </Link>
      </div>
    </AppShell>
  );
}
