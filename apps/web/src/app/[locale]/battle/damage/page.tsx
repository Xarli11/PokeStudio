import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getSpeciesSearchIndex, listVersionGroups } from '@pokestudio/database';
import { getDictionary, isLocale, locales } from '@pokestudio/i18n';

import { DamageLab } from '@/components/battle/damage-lab';
import { DEFAULT_BUILD_VERSION_GROUP_SLUG } from '@/lib/build-game-capabilities';
import { getPokemonDatabaseClient } from '@/lib/pokemon-database';
import { SITE_URL } from '@/lib/site-url';
import { eyebrowClass } from '@/lib/ui-classes';

// Reads live reference data per request — same reasoning as every other
// reference-data page in this app (search index/version groups are live DB
// state, not build-time-known).
export const dynamic = 'force-dynamic';

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
    title: dictionary.battle.damageLab.title,
    description: dictionary.battle.damageLab.indexDescription,
    alternates: {
      canonical: `/${locale}/battle/damage`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}/battle/damage`])),
    },
    openGraph: {
      url: `/${locale}/battle/damage`,
      title: dictionary.battle.damageLab.title,
      description: dictionary.battle.damageLab.tagline,
      locale,
      type: 'website',
    },
  };
}

/**
 * Damage Lab (Fase M3.1B). The whole-Pokédex search index is fetched here,
 * server-side, and passed straight to the client picker rather than
 * deferred post-mount (unlike Team Editor's `/api/build-reference-data`
 * pattern) — for *this* route the picker isn't gated behind another
 * interaction, it *is* the primary interaction, so there's no first-paint
 * win to deferring it, only a slower first-usable-picker. See the PR
 * description for the measured payload/TTFB comparison. `natures`/`items`
 * (Build's own reference-data bundle) are deliberately NOT fetched here —
 * Simple Mode never uses them (task §9: "no obligar a bajar natures/items
 * que Simple Mode todavía no necesita").
 */
export default async function DamageLabPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  /**
   * Build → Damage Lab import (Fase M3.2) — opaque local ids only, never
   * metadata/canonical inputs (task §5). The server can't resolve
   * localStorage; these are handed to the client component as-is.
   *
   * `attacker` — Explore → Damage Lab (Phase 3 roadmap, attacker-only): a
   * stable form slug, same contract Compare's `?pokemon=` already uses
   * (never a localized display name). Passed through unvalidated, same as
   * `team`/`member` — `DamageLab` resolves it against `searchIndex`
   * (already fetched below either way) before ever seeding it as the
   * attacker, so this stays exactly as defensive as the existing imports
   * without a second, server-side validation path.
   */
  searchParams: Promise<{ team?: string; member?: string; attacker?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dictionary = getDictionary(locale);
  const {
    team: teamId,
    member: memberId,
    attacker: exploreAttackerFormSlugRaw,
  } = await searchParams;
  // Same normalization Compare's own `?pokemon=` parsing already applies —
  // form slugs are canonically lowercase; `DamageLab` still validates the
  // result against the search index regardless (task §6: never trust a URL
  // value outright).
  const exploreAttackerFormSlug = exploreAttackerFormSlugRaw?.trim().toLowerCase() || null;

  const client = getPokemonDatabaseClient();
  const [searchIndex, versionGroups] = await Promise.all([
    getSpeciesSearchIndex(client),
    listVersionGroups(client),
  ]);

  return (
    <div className="mx-auto flex max-w-detail flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className={eyebrowClass()}>{dictionary.nav.battleLab}</span>
        <h1 className="m-0 text-3xl tracking-tight">{dictionary.battle.damageLab.title}</h1>
        <p className="m-0 max-w-xl text-muted">{dictionary.battle.damageLab.tagline}</p>
      </header>

      <DamageLab
        locale={locale}
        searchIndex={searchIndex}
        versionGroups={versionGroups}
        defaultVersionGroupSlug={DEFAULT_BUILD_VERSION_GROUP_SLUG}
        typeLabels={dictionary.types}
        statLabels={dictionary.pokedex.stat}
        teamId={teamId ?? null}
        memberId={memberId ?? null}
        exploreAttackerFormSlug={exploreAttackerFormSlug}
        labels={{
          gameLabel: dictionary.battle.damageLab.gameLabel,
          generationOptionTemplate: dictionary.moves.generation,
          attackerLabel: dictionary.battle.damageLab.attackerLabel,
          defenderLabel: dictionary.battle.damageLab.defenderLabel,
          moveLabel: dictionary.battle.damageLab.moveLabel,
          noMoveSelected: dictionary.battle.damageLab.noMoveSelected,
          selectMoveLabel: dictionary.battle.damageLab.selectMoveLabel,
          changeMoveTemplate: dictionary.battle.damageLab.changeMoveTemplate,
          noLegalMoves: dictionary.battle.damageLab.noLegalMoves,
          calculateLabel: dictionary.battle.damageLab.calculateLabel,
          calculatingLabel: dictionary.battle.damageLab.calculatingLabel,
          inputsChangedLabel: dictionary.battle.damageLab.inputsChangedLabel,
          recalculateLabel: dictionary.battle.damageLab.recalculateLabel,
          attackerReferenceError: dictionary.battle.damageLab.attackerReferenceError,
          defenderReferenceError: dictionary.battle.damageLab.defenderReferenceError,
          retry: dictionary.build.retryReferenceDataLabel,
          resultHeading: dictionary.battle.damageLab.resultHeading,
          importBanner: {
            importedFromBuildLabel: dictionary.battle.damageLab.importedFromBuildLabel,
            importedMemberTeamTemplate: dictionary.battle.damageLab.importedMemberTeamTemplate,
            backToTeamLabel: dictionary.battle.damageLab.backToTeamLabel,
            teamNotFoundWarning: dictionary.battle.damageLab.teamNotFoundWarning,
            memberNotFoundWarning: dictionary.battle.damageLab.memberNotFoundWarning,
            gameNotAvailableWarning: dictionary.battle.damageLab.gameNotAvailableWarning,
          },
          advancedPanel: {
            advancedLabel: dictionary.battle.damageLab.advancedLabel,
            levelLabel: dictionary.build.levelLabel,
            natureLabel: dictionary.build.natureLabel,
            natureNeutralOption: dictionary.battle.damageLab.natureNeutralOption,
            natureModifierTemplate: dictionary.build.natureModifierTemplate,
            abilityLabel: dictionary.build.abilityLabel,
            noAbilitySelected: dictionary.build.noAbilitySelected,
            hiddenAbilityMarker: dictionary.build.hiddenAbilityMarker,
            itemLabel: dictionary.build.itemLabel,
            noItemSelected: dictionary.build.noItemSelected,
            itemSearchLabel: dictionary.build.itemSearchPlaceholder,
            itemSearchNoResults: dictionary.build.itemSearchNoResults,
            cancelLabel: dictionary.battle.damageLab.cancelLabel,
            evsLabel: dictionary.build.evsLabel,
            evsRemainingTemplate: dictionary.build.evsRemaining,
            evsMaxTemplate: dictionary.build.evsMax,
            evsOverLimitTemplate: dictionary.build.evsOverLimit,
            ivsLabel: dictionary.build.ivsLabel,
            legacyStatsUnavailableTemplate: dictionary.build.legacyStatsUnavailableTemplate,
            historicalMechanicsNoteTemplate: dictionary.build.historicalMechanicsNoteTemplate,
            teraTypeLabel: dictionary.build.teraTypeLabel,
            noTeraType: dictionary.build.noTeraType,
            terastallizeLabel: dictionary.battle.damageLab.terastallizeLabel,
            teraSummaryTemplate: dictionary.battle.damageLab.teraSummaryTemplate,
            criticalLabel: dictionary.battle.damageLab.criticalLabel,
            loadingReferenceData: dictionary.build.loadingReferenceData,
            referenceDataErrorLabel: dictionary.battle.damageLab.advancedReferenceDataError,
            retryLabel: dictionary.build.retryReferenceDataLabel,
            statAbbr: dictionary.battle.damageLab.statAbbr,
          },
          pokemonSlot: {
            selectPokemonLabel: dictionary.battle.damageLab.selectPokemonLabel,
            changeLabel: dictionary.battle.damageLab.changeLabel,
            changePokemonTemplate: dictionary.battle.damageLab.changePokemonTemplate,
            cancelLabel: dictionary.battle.damageLab.cancelLabel,
            multipleFormsMatchTemplate: dictionary.pokedex.multipleFormsMatch,
            ambiguousHint: dictionary.compare.ambiguousHint,
            noResultsLabel: dictionary.pokedex.noSearchResults,
          },
          movePicker: {
            searchLabel: dictionary.build.moveSearchPlaceholder,
            noResultsLabel: dictionary.moves.noResults,
            typeFilterLabel: dictionary.moves.typeFilter,
            allTypesLabel: dictionary.moves.allTypes,
            damageClassFilterLabel: dictionary.moves.damageClassFilter,
            allDamageClassesLabel: dictionary.moves.allDamageClasses,
            damageClassLabels: dictionary.moves.damageClass,
            noPowerLabel: dictionary.moves.noPower,
            alreadySelectedLabel: dictionary.build.alreadySelectedMove,
            cancelLabel: dictionary.battle.damageLab.cancelLabel,
          },
          result: {
            hpRangeTemplate: dictionary.battle.damageLab.hpRangeTemplate,
            percentRangeTemplate: dictionary.battle.damageLab.percentRangeTemplate,
            effectiveness: dictionary.battle.damageLab.effectiveness,
            stabLabel: dictionary.battle.damageLab.stabLabel,
            criticalLabel: dictionary.battle.damageLab.criticalLabel,
            koGuaranteedTemplate: dictionary.battle.damageLab.koGuaranteedTemplate,
            koChanceTemplate: dictionary.battle.damageLab.koChanceTemplate,
            koPossibleTemplate: dictionary.battle.damageLab.koPossibleTemplate,
            koHitWordSingular: dictionary.battle.damageLab.koHitWordSingular,
            koHitWordPlural: dictionary.battle.damageLab.koHitWordPlural,
            koNoDamage: dictionary.battle.damageLab.koNoDamage,
            detailsLabel: dictionary.battle.damageLab.detailsLabel,
            debugDescriptionLabel: dictionary.battle.damageLab.debugDescriptionLabel,
            modifiers: dictionary.battle.damageLab.modifiers,
          },
          errors: {
            'unknown-form': dictionary.battle.damageLab.errors.unknownForm,
            'unsupported-form': dictionary.battle.damageLab.errors.unsupportedForm,
            'unknown-move': dictionary.battle.damageLab.errors.unknownMove,
            'unknown-ability': dictionary.battle.damageLab.errors.unknownAbility,
            'unknown-item': dictionary.battle.damageLab.errors.unknownItem,
            'unknown-nature': dictionary.battle.damageLab.errors.unknownNature,
            naturesNotAvailableInGeneration:
              dictionary.battle.damageLab.errors.naturesNotAvailableInGeneration,
            'level-out-of-range': dictionary.battle.damageLab.errors.levelOutOfRange,
            'ev-out-of-range': dictionary.battle.damageLab.errors.evOutOfRange,
            'iv-out-of-range': dictionary.battle.damageLab.errors.ivOutOfRange,
            'generation-out-of-range': dictionary.battle.damageLab.errors.generationOutOfRange,
            unknown: dictionary.battle.damageLab.errors.generic,
          },
        }}
      />
    </div>
  );
}
