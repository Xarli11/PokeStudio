import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import {
  getSpeciesSearchIndex,
  listItems,
  listNatures,
  listVersionGroups,
} from '@pokelab/database';
import { getDictionary, isLocale } from '@pokelab/i18n';

import { TeamEditor } from '@/components/build/team-editor';
import { getPokemonDatabaseClient } from '@/lib/pokemon-database';

// Reads live reference data per request, and the team roster itself lives
// only in the requesting browser's localStorage — never prerender/cache
// this route.
export const dynamic = 'force-dynamic';

type PageParams = { locale: string; teamId: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dictionary = getDictionary(locale);

  return {
    title: dictionary.build.title,
    // A specific team's editor is local-only state (task: not a sitemap
    // entity) — no canonical/indexable metadata for this route.
    robots: { index: false, follow: false },
  };
}

export default async function TeamEditorPage({ params }: { params: Promise<PageParams> }) {
  const { locale, teamId } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale);
  const client = getPokemonDatabaseClient();
  const [searchIndex, natures, items, versionGroups] = await Promise.all([
    getSpeciesSearchIndex(client),
    listNatures(client),
    listItems(client),
    listVersionGroups(client),
  ]);

  return (
    <div className="mx-auto flex max-w-wide flex-col gap-8">
      <TeamEditor
        locale={locale}
        teamId={teamId}
        searchIndex={searchIndex}
        natures={natures}
        items={items}
        versionGroups={versionGroups}
        typeLabels={dictionary.types}
        labels={{
          backToTeams: dictionary.build.backToTeams,
          teamNameLabel: dictionary.build.teamNameLabel,
          versionGroupLabel: dictionary.build.versionGroupLabel,
          generationOptionTemplate: dictionary.moves.generation,
          statusHeader: {
            savingIndicator: dictionary.build.savingIndicator,
            saveFailed: dictionary.build.saveFailed,
            savedValidLabel: dictionary.build.saveStatusValid,
            draftSavedIncomplete: dictionary.build.saveStatusIncomplete,
            draftSavedInvalidOne: dictionary.build.saveStatusInvalidOne,
            draftSavedInvalidManyTemplate: dictionary.build.saveStatusInvalidMany,
            reviewLabel: dictionary.build.review,
            viewAllIssuesTemplate: dictionary.build.viewAllIssues,
          },
          closeEditorLabel: dictionary.build.closeEditorLabel,
          closeEditorTemplate: dictionary.build.closeEditorTemplate,
          teamSlot: {
            addPokemonSlot: dictionary.build.addPokemonSlot,
            removeFromTeamTemplate: dictionary.build.removeFromTeam,
            configureLabel: dictionary.build.configureLabel,
            configureTemplate: dictionary.build.configureTemplate,
            changeFormTemplate: dictionary.build.changeForm,
            changeFormLabel: dictionary.build.changeFormLabel,
            removePokemonLabel: dictionary.build.removePokemonLabel,
          },
          rosterPicker: {
            addPokemonHeader: dictionary.build.addPokemonHeader,
            addPokemonSlot: dictionary.build.addPokemonSlot,
            changeFormTemplate: dictionary.build.changeForm,
            cancelChangeForm: dictionary.build.cancelChangeForm,
            multipleFormsMatchTemplate: dictionary.pokedex.multipleFormsMatch,
            ambiguousHint: dictionary.compare.ambiguousHint,
            noResultsLabel: dictionary.pokedex.noSearchResults,
          },
          setEditor: {
            nicknameLabel: dictionary.build.nicknameLabel,
            nicknamePlaceholder: dictionary.build.nicknamePlaceholder,
            levelLabel: dictionary.build.levelLabel,
            abilityLabel: dictionary.build.abilityLabel,
            noAbilitySelected: dictionary.build.noAbilitySelected,
            hiddenAbilityMarker: dictionary.build.hiddenAbilityMarker,
            abilityInvalidForForm: dictionary.build.abilityInvalidForForm,
            itemLabel: dictionary.build.itemLabel,
            noItemSelected: dictionary.build.noItemSelected,
            teraTypeLabel: dictionary.build.teraTypeLabel,
            noTeraType: dictionary.build.noTeraType,
            teraTypeHint: dictionary.build.teraTypeHint,
            natureLabel: dictionary.build.natureLabel,
            noNatureSelected: dictionary.build.noNatureSelected,
            natureNeutral: dictionary.build.natureNeutral,
            natureModifierTemplate: dictionary.build.natureModifierTemplate,
            evsLabel: dictionary.build.evsLabel,
            evsRemainingTemplate: dictionary.build.evsRemaining,
            evsMaxTemplate: dictionary.build.evsMax,
            evsOverLimitTemplate: dictionary.build.evsOverLimit,
            ivsLabel: dictionary.build.ivsLabel,
            calculatedStatsLabel: dictionary.build.calculatedStatsLabel,
            legacyStatsUnavailableTemplate: dictionary.build.legacyStatsUnavailableTemplate,
            historicalMechanicsNoteTemplate: dictionary.build.historicalMechanicsNoteTemplate,
            movesLabel: dictionary.build.movesLabel,
            moveLegalityHint: dictionary.build.moveLegalityHint,
            notLearnableTemplate: dictionary.build.notLearnableInGame,
            addMoveLabel: dictionary.build.addMove,
            changeMoveTemplate: dictionary.build.changeMove,
            removeMoveTemplate: dictionary.build.removeMove,
            loadingReferenceData: dictionary.build.loadingReferenceData,
            statLabels: dictionary.pokedex.stat,
            statTierLabels: dictionary.pokedex.statTier,
            typeLabels: dictionary.types,
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
              cancelLabel: dictionary.build.cancelChangeForm,
            },
          },
          analysis: {
            analysisTitle: dictionary.build.analysisTitle,
            unsupportedTemplate: dictionary.build.teamAnalysisUnsupportedTemplate,
            unsupportedDetail: dictionary.build.teamAnalysisUnsupportedDetail,
            defensiveTitle: dictionary.build.defensiveTitle,
            defensiveHint: dictionary.build.defensiveHint,
            defensiveWeakCountTemplate: dictionary.build.defensiveWeakCount,
            defensiveResistCountTemplate: dictionary.build.defensiveResistCount,
            defensiveImmuneCountTemplate: dictionary.build.defensiveImmuneCount,
            repeatedWeaknessBadge: dictionary.build.repeatedWeaknessBadge,
            offensiveTitle: dictionary.build.offensiveTitle,
            offensiveHint: dictionary.build.offensiveHint,
            offensiveSummaryTemplate: dictionary.build.offensiveSummary,
            offensiveNoCoverage: dictionary.build.offensiveNoCoverage,
            coveredLabel: dictionary.build.coveredLabel,
            uncoveredLabel: dictionary.build.uncoveredLabel,
            severityLabels: dictionary.build.severity,
            memberMovesUnavailableOneTemplate: dictionary.build.memberMovesUnavailableOne,
            memberMovesUnavailableManyTemplate: dictionary.build.memberMovesUnavailableMany,
            warningMessages: {
              incompleteTeam: dictionary.build.warning.incompleteTeam,
              repeatedSevereWeakness: dictionary.build.warning.repeatedSevereWeakness,
              noAbility: dictionary.build.warning.noAbility,
              invalidAbility: dictionary.build.warning.invalidAbility,
              noMoves: dictionary.build.warning.noMoves,
              duplicateMove: dictionary.build.warning.duplicateMove,
              illegalMove: dictionary.build.warning.illegalMove,
              evTotalExceeded: dictionary.build.warning.evTotalExceeded,
              evStatExceeded: dictionary.build.warning.evStatExceeded,
              invalidIv: dictionary.build.warning.invalidIv,
              unsupportedRuleset: dictionary.build.warning.unsupportedRuleset,
              speciesUnavailableInGeneration:
                dictionary.build.warning.speciesUnavailableInGeneration,
            },
          },
          problems: {
            problemsTitle: dictionary.build.problemsTitle,
            noProblemsDetected: dictionary.build.noProblemsDetected,
            reviewLabel: dictionary.build.review,
            severityLabels: dictionary.build.severity,
          },
        }}
      />
    </div>
  );
}
