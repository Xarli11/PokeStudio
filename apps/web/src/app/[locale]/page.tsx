import { type Locale, getDictionary, isLocale, locales } from '@pokestudio/i18n';
import { notFound } from 'next/navigation';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { ThemeToggle } from '@/components/theme-toggle';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale as Locale);

  return (
    <main
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '4rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <nav style={{ display: 'flex', gap: '1rem', color: 'var(--ps-color-text-muted)' }}>
          <span>{dictionary.nav.explore}</span>
          <span>{dictionary.nav.build}</span>
          <span>{dictionary.nav.battleLab}</span>
        </nav>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <LocaleSwitcher currentLocale={locale as Locale} />
          <ThemeToggle labels={dictionary.theme} />
        </div>
      </header>

      <h1 style={{ fontSize: '2.5rem', margin: 0 }}>{dictionary.home.title}</h1>
      <p style={{ color: 'var(--ps-color-text-muted)', fontSize: '1.125rem' }}>
        {dictionary.home.tagline}
      </p>
      <p>{dictionary.home.status}</p>

      <footer
        style={{
          marginTop: '2rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid var(--ps-color-border)',
          color: 'var(--ps-color-text-muted)',
          fontSize: '0.875rem',
        }}
      >
        {dictionary.footer.disclaimer}
      </footer>
    </main>
  );
}
