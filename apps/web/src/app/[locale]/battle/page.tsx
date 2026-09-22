import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getDictionary, isLocale, locales } from '@pokestudio/i18n';

import { SITE_URL } from '@/lib/site-url';
import { eyebrowClass, interactiveCardClass } from '@/lib/ui-classes';

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
    metadataBase: new URL(SITE_URL),
    title: dictionary.battle.title,
    description: dictionary.battle.indexDescription,
    alternates: {
      canonical: `/${locale}/battle`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}/battle`])),
    },
    openGraph: {
      url: `/${locale}/battle`,
      title: dictionary.battle.title,
      description: dictionary.battle.tagline,
      locale,
      type: 'website',
    },
  };
}

/**
 * Battle Lab's landing (Fase M3.1B) — the pillar's own shell, one real tool
 * linked from it (Damage Lab). Deliberately not a grid of feature cards for
 * tools that don't exist yet (task §2: "no inventes tarjetas fake") —
 * `moreComingSoon` names what's planned next in restrained copy instead.
 */
export default async function BattleLabPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dictionary = getDictionary(locale);

  return (
    <div className="mx-auto flex max-w-detail flex-col gap-10">
      <header className="flex flex-col gap-3">
        <span className={eyebrowClass()}>{dictionary.nav.battleLab}</span>
        <h1 className="m-0 text-3xl tracking-tight">{dictionary.battle.title}</h1>
        <p className="m-0 max-w-xl text-muted">{dictionary.battle.tagline}</p>
      </header>

      <Link
        href={`/${locale}/battle/damage`}
        className={interactiveCardClass('flex flex-col gap-2 p-5')}
      >
        <h2 className="m-0 text-lg font-bold">{dictionary.battle.damageLabCardTitle}</h2>
        <p className="m-0 text-sm text-muted">{dictionary.battle.damageLabCardDescription}</p>
        <span className="mt-1 text-sm font-semibold text-brand">
          {dictionary.battle.openDamageLab} →
        </span>
      </Link>

      <p className="m-0 text-sm text-muted">{dictionary.battle.moreComingSoon}</p>
    </div>
  );
}
