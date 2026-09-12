import Link from 'next/link';
import { type Locale, getDictionary, isLocale, locales } from '@pokestudio/i18n';
import { notFound } from 'next/navigation';

import { buttonClass, interactiveCardClass, cardClass, soonBadgeClass } from '@/lib/ui-classes';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

function PillarCard({
  href,
  title,
  description,
  soonLabel,
}: {
  href?: string;
  title: string;
  description: string;
  soonLabel?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <h3 className="m-0 text-base font-bold">{title}</h3>
        {soonLabel ? <span className={soonBadgeClass}>{soonLabel}</span> : null}
      </div>
      <p className="m-0 text-sm text-muted">{description}</p>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={interactiveCardClass('flex flex-col gap-3 p-5')}>
        {body}
      </Link>
    );
  }

  return (
    <div aria-disabled="true" className={cardClass('flex flex-col gap-3 p-5 opacity-70')}>
      {body}
    </div>
  );
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale as Locale);

  return (
    <div className="mx-auto flex max-w-detail flex-col gap-14 sm:gap-20">
      <section className="flex max-w-2xl flex-col gap-5">
        <h1 className="m-0 text-4xl leading-[1.05] tracking-tight sm:text-5xl">
          {dictionary.home.title}
        </h1>
        <p className="m-0 text-lg text-muted">{dictionary.home.tagline}</p>
        <p className="m-0 text-sm text-muted">{dictionary.home.status}</p>

        <Link href={`/${locale}/pokemon`} className={buttonClass('primary', 'mt-2 self-start')}>
          {dictionary.nav.explore} →
        </Link>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="m-0 text-sm font-semibold text-muted uppercase tracking-wide">
          {dictionary.home.pillarsTitle}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <PillarCard
            href={`/${locale}/pokemon`}
            title={dictionary.nav.explore}
            description={dictionary.home.pillars.explore}
          />
          <PillarCard
            title={dictionary.nav.build}
            description={dictionary.home.pillars.build}
            soonLabel={dictionary.nav.soon}
          />
          <PillarCard
            title={dictionary.nav.battleLab}
            description={dictionary.home.pillars.battleLab}
            soonLabel={dictionary.nav.soon}
          />
        </div>
      </section>
    </div>
  );
}
