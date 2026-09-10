import Link from 'next/link';
import { type Locale, getDictionary, isLocale, locales } from '@pokestudio/i18n';
import { notFound } from 'next/navigation';

import { AppShell } from '@/components/app-shell';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale as Locale);

  return (
    <AppShell locale={locale as Locale} dictionary={dictionary} active="explore">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <h1
          style={{
            margin: 0,
            fontSize: 'var(--ps-font-size-3xl)',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}
        >
          {dictionary.home.title}
        </h1>
        <p
          style={{
            margin: 0,
            color: 'var(--ps-color-text-muted)',
            fontSize: 'var(--ps-font-size-lg)',
          }}
        >
          {dictionary.home.tagline}
        </p>
        <p style={{ margin: 0 }}>{dictionary.home.status}</p>

        <Link
          href={`/${locale}/pokemon`}
          className="ps-btn ps-btn-primary"
          style={{ alignSelf: 'flex-start', marginTop: 'var(--ps-space-2)' }}
        >
          {dictionary.nav.explore} →
        </Link>
      </div>
    </AppShell>
  );
}
