import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { notFound } from 'next/navigation';

import { getDictionary, isLocale, locales } from '@pokelab/i18n';
import { themeInitScript } from '@pokelab/ui';

import { brandAssets } from '@/lib/brand-assets';
import { PersistentShell } from '@/components/persistent-shell';

import '../globals.css';

// Brand 1.0 typography — Inter, Regular/Semibold/Bold only (CLAUDE.md
// brand-integration pass). Self-hosted via next/font (no extra dependency,
// no render-blocking third-party request) and exposed as a CSS variable so
// globals.css can lead its font stack with it.
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--ps-font-inter',
  display: 'swap',
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dictionary = getDictionary(locale);

  return {
    metadataBase: new URL('https://pokelab.com'),
    title: dictionary.home.title,
    description: dictionary.home.tagline,
    alternates: {
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}`])),
    },
    icons: {
      icon: [
        { url: brandAssets.favicon16, sizes: '16x16', type: 'image/svg+xml' },
        { url: brandAssets.favicon32, sizes: '32x32', type: 'image/svg+xml' },
      ],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dictionary = getDictionary(locale);

  return (
    // suppressHydrationWarning is scoped to this element only (React does not
    // propagate it to descendants) and covers exactly one attribute:
    // `data-theme`. The script below runs synchronously before hydration and
    // sets `data-theme` on `documentElement` from localStorage/
    // prefers-color-scheme — neither is available during SSR, so the server
    // deliberately never renders `data-theme` at all (see themeInitScript).
    // That intentional client/server difference is exactly what
    // suppressHydrationWarning exists for; anything else on this element
    // (e.g. `lang`) is unaffected and still fully checked by React.
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Runs before hydration to avoid a flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {/*
          PersistentShell (header/nav/locale/theme controls) is rendered
          once here, not per page — it's a stable ancestor across every
          route under [locale], so it no longer unmounts/remounts on
          ordinary navigation. Only `children` (the page) changes.
        */}
        <PersistentShell locale={locale} dictionary={dictionary}>
          {children}
        </PersistentShell>
      </body>
    </html>
  );
}
