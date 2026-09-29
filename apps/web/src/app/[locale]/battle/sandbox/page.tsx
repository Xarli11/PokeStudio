import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getDictionary, isLocale, locales } from '@pokestudio/i18n';

import { BattleSandbox } from '@/components/battle/sandbox/battle-sandbox';
import { SITE_URL } from '@/lib/site-url';
import { eyebrowClass } from '@/lib/ui-classes';

import {
  createFork,
  createSandboxBattle,
  importTeamText,
  loadDisplayNames,
  loadDecisionView,
  loadEvents,
  loadPerspectiveState,
  loadReplay,
  loadSideView,
  submitSandboxCommand,
} from './actions';

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
    title: dictionary.battle.sandbox.title,
    description: dictionary.battle.sandbox.metaDescription,
    // Battle sessions are interactive and private to whoever runs them: never indexed.
    robots: { index: false, follow: false },
  };
}

/**
 * Battle Sandbox: play a full authoritative battle controlling both sides. The battle itself runs on
 * the Node battle server (ADR-0019); this page only renders the shell and hands the client the
 * server actions that talk to it.
 */
export default async function BattleSandboxPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dictionary = getDictionary(locale);

  return (
    <div className="mx-auto flex max-w-detail flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className={eyebrowClass()}>{dictionary.nav.battleLab}</span>
        <h1 className="m-0 text-3xl tracking-tight">{dictionary.battle.sandbox.title}</h1>
        <p className="m-0 max-w-xl text-muted">{dictionary.battle.sandbox.tagline}</p>
        <Link href={`/${locale}/battle`} className="text-sm font-semibold text-brand">
          ← {dictionary.battle.title}
        </Link>
      </header>
      <BattleSandbox
        labels={dictionary.battle.sandbox}
        typeNames={dictionary.types}
        actions={{
          createFork,
          createSandboxBattle,
          loadDecisionView,
          importTeamText,
          loadSideView,
          loadPerspectiveState,
          loadEvents,
          submitSandboxCommand,
          loadDisplayNames,
          loadReplay,
        }}
      />
    </div>
  );
}
