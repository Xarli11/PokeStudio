import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { listVersionGroups } from '@pokelab/database';
import { getDictionary, isLocale, locales } from '@pokelab/i18n';

import { BuildHome } from '@/components/build/build-home';
import { DEFAULT_BUILD_VERSION_GROUP_SLUG } from '@/lib/build-game-capabilities';
import { getPokemonDatabaseClient } from '@/lib/pokemon-database';
import { eyebrowClass } from '@/lib/ui-classes';

// Now reads live reference data per request (task §25's version-group
// lookup for "My Teams" status badges) — same convention as every other
// database-backed page (e.g. `/[locale]/pokemon/page.tsx`), never
// statically prerendered against a build-time database connection.
export const dynamic = 'force-dynamic';

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
    title: dictionary.build.title,
    description: dictionary.build.tagline,
    alternates: {
      canonical: `/${locale}/build`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}/build`])),
    },
    openGraph: {
      title: dictionary.build.title,
      description: dictionary.build.tagline,
      locale,
      type: 'website',
    },
  };
}

export default async function BuildIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale);
  // "My Teams" status badges need each saved team's real capabilities (task
  // §25: never show a misleading "Valid" for a partially-supported
  // historical ruleset) — the same small version-group table Build's own
  // editor already reads.
  const versionGroups = await listVersionGroups(getPokemonDatabaseClient());

  return (
    <div className="mx-auto flex max-w-wide flex-col gap-10">
      <header className="flex flex-col gap-3">
        <span className={eyebrowClass()}>{dictionary.build.eyebrow}</span>
        <h1 className="m-0 text-3xl tracking-tight">{dictionary.build.title}</h1>
        <p className="m-0 max-w-xl text-muted">{dictionary.build.tagline}</p>
      </header>

      <BuildHome
        locale={locale}
        versionGroups={versionGroups}
        // A new team's starting game context (task §1: every generation is
        // now selectable, but a brand-new team still needs one default) —
        // the current flagship modern-mechanics game, not whatever
        // Explore's own "newest/default game" happens to be in the database.
        defaultVersionGroupSlug={DEFAULT_BUILD_VERSION_GROUP_SLUG}
        labels={{
          myTeams: dictionary.build.myTeams,
          newTeam: dictionary.build.newTeam,
          untitledTeam: dictionary.build.untitledTeam,
          noTeams: dictionary.build.noTeams,
          memberCountTemplate: dictionary.build.memberCount,
          openTeamTemplate: dictionary.build.openTeam,
          deleteTeamTemplate: dictionary.build.deleteTeam,
          deleteConfirmTemplate: dictionary.build.deleteConfirm,
          deleteDialogTitle: dictionary.build.deleteDialogTitle,
          confirmDeleteLabel: dictionary.build.confirmDelete,
          cancelLabel: dictionary.build.cancelChangeForm,
          teamStatusValid: dictionary.build.teamStatusValid,
          teamStatusIncomplete: dictionary.build.teamStatusIncomplete,
          teamStatusInvalidOne: dictionary.build.teamStatusInvalidOne,
          teamStatusInvalidManyTemplate: dictionary.build.teamStatusInvalidMany,
        }}
      />
    </div>
  );
}
