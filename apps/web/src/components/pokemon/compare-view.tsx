'use client';

import { useRouter } from 'next/navigation';

import type {
  ComparablePokemonForm,
  SpeciesSearchAlias,
  SpeciesSearchItem,
} from '@pokelab/database';
import { formatMessage, type Locale } from '@pokelab/i18n';
import type { BaseStats, PokemonType } from '@pokelab/pokemon-data';

import { cardClass, tagClass } from '@/lib/ui-classes';
import { dexNumberLabel } from '@/lib/pokemon-search';
import { computeDefensiveMatchups, type DefensiveTypeMatchups } from '@/lib/type-matchup';

import { CompareAddInput } from './compare-add-input';
import { PokemonStatBars } from './stat-bars';
import { PokemonTypeBadge } from './type-badge';

const MAX_COMPARE_SLOTS = 4;

export interface CompareViewLabels {
  emptyState: string;
  addPokemon: string;
  addPlaceholder: string;
  noResults: string;
  removeTemplate: string;
  maxReached: string;
  addAnotherHint: string;
  invalidEntryTemplate: string;
  abilities: string;
  hiddenAbility: string;
  baseStats: string;
  baseStatTotal: string;
  typeMatchups: string;
  doubleWeak: string;
  weak: string;
  resist: string;
  doubleResist: string;
  immune: string;
  noNotableMatchups: string;
  multipleFormsMatchTemplate: string;
  ambiguousHint: string;
}

export interface CompareViewProps {
  locale: Locale;
  searchIndex: { items: SpeciesSearchItem[]; aliases: SpeciesSearchAlias[] };
  forms: ComparablePokemonForm[];
  invalidSlugs: string[];
  typeLabels: Record<PokemonType, string>;
  statLabels: Record<keyof BaseStats, string>;
  statTierLabels: Record<'low' | 'average' | 'good' | 'excellent', string>;
  labels: CompareViewLabels;
}

function baseStatTotal(form: ComparablePokemonForm): number {
  const stats = form.baseStats;
  return (
    stats.hp +
    stats.attack +
    stats.defense +
    stats.specialAttack +
    stats.specialDefense +
    stats.speed
  );
}

function matchupGroup(
  types: PokemonType[],
  label: string,
  typeLabels: Record<PokemonType, string>,
) {
  if (types.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5" key={label}>
      <span className="text-xs font-semibold text-muted">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {types.map((type) => (
          <PokemonTypeBadge key={type} type={type} label={typeLabels[type]} size="sm" />
        ))}
      </div>
    </div>
  );
}

function TypeMatchupSection({
  matchups,
  typeLabels,
  labels,
}: {
  matchups: DefensiveTypeMatchups;
  typeLabels: Record<PokemonType, string>;
  labels: CompareViewLabels;
}) {
  const groups = [
    matchupGroup(matchups.doubleWeak, labels.doubleWeak, typeLabels),
    matchupGroup(matchups.weak, labels.weak, typeLabels),
    matchupGroup(matchups.resist, labels.resist, typeLabels),
    matchupGroup(matchups.doubleResist, labels.doubleResist, typeLabels),
    matchupGroup(matchups.immune, labels.immune, typeLabels),
  ].filter((group) => group !== null);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="m-0 text-sm font-semibold text-muted">{labels.typeMatchups}</h3>
      {groups.length > 0 ? (
        <div className="flex flex-col gap-2.5">{groups}</div>
      ) : (
        <p className="m-0 text-sm text-muted">{labels.noNotableMatchups}</p>
      )}
    </div>
  );
}

function CompareCard({
  form,
  locale,
  typeLabels,
  statLabels,
  statTierLabels,
  labels,
  onRemove,
}: {
  form: ComparablePokemonForm;
  locale: Locale;
  typeLabels: Record<PokemonType, string>;
  statLabels: Record<keyof BaseStats, string>;
  statTierLabels: Record<'low' | 'average' | 'good' | 'excellent', string>;
  labels: CompareViewLabels;
  onRemove: () => void;
}) {
  const displayName = form.isDefaultForm ? form.speciesName[locale] : form.formName[locale];
  const matchups = computeDefensiveMatchups(form.types);

  return (
    <div className={cardClass('flex min-w-0 flex-col gap-4 p-4')}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold tabular-nums text-muted">
            {dexNumberLabel(form.nationalDexNumber)}
          </span>
          <h2 className="m-0 text-lg leading-tight">{displayName}</h2>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={formatMessage(labels.removeTemplate, { name: displayName })}
          className="shrink-0 rounded-full border border-border-subtle bg-surface px-2 py-1 text-xs font-semibold text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          ×
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {form.types.map((type) => (
          <PokemonTypeBadge key={type} type={type} label={typeLabels[type]} />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="m-0 text-sm font-semibold text-muted">{labels.baseStats}</h3>
          <span className="text-xs font-semibold tabular-nums text-muted">
            {labels.baseStatTotal}: {baseStatTotal(form)}
          </span>
        </div>
        <PokemonStatBars stats={form.baseStats} labels={statLabels} tierLabels={statTierLabels} />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="m-0 text-sm font-semibold text-muted">{labels.abilities}</h3>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {form.abilities.map((ability) => (
            <li key={ability.slug} className="flex items-center gap-2 text-sm">
              {locale === 'es' ? (ability.nameEs ?? ability.nameEn) : ability.nameEn}
              {ability.isHidden ? <span className={tagClass()}>{labels.hiddenAbility}</span> : null}
            </li>
          ))}
        </ul>
      </div>

      <TypeMatchupSection matchups={matchups} typeLabels={typeLabels} labels={labels} />
    </div>
  );
}

/**
 * Compare's client shell (Milestone 2, Stage 2A). The URL query string
 * (`?pokemon=slug1,slug2,...`) is the only persisted state — add/remove just
 * pushes a new URL, and the server component re-fetches full comparison
 * data for it (`getFormsBySlugs`). No client-side comparison-data cache, no
 * custom state backend (task's explicit preference).
 */
export function CompareView({
  locale,
  searchIndex,
  forms,
  invalidSlugs,
  typeLabels,
  statLabels,
  statTierLabels,
  labels,
}: CompareViewProps) {
  const router = useRouter();

  function navigateTo(formSlugs: string[]): void {
    const query =
      formSlugs.length > 0 ? `?pokemon=${formSlugs.map(encodeURIComponent).join(',')}` : '';
    router.replace(`/${locale}/compare${query}`);
  }

  function handleAdd(formSlug: string): void {
    if (forms.some((form) => form.formSlug === formSlug)) return;
    navigateTo([...forms.map((form) => form.formSlug), formSlug].slice(0, MAX_COMPARE_SLOTS));
  }

  function handleRemove(formSlug: string): void {
    navigateTo(forms.map((form) => form.formSlug).filter((slug) => slug !== formSlug));
  }

  const atMax = forms.length >= MAX_COMPARE_SLOTS;

  return (
    <div className="flex flex-col gap-6">
      {invalidSlugs.length > 0 ? (
        <div
          role="status"
          className="rounded-md border border-border-subtle bg-surface-raised px-4 py-3 text-sm text-muted"
        >
          {invalidSlugs
            .map((slug) => formatMessage(labels.invalidEntryTemplate, { slug }))
            .join(' ')}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {!atMax ? (
          <CompareAddInput
            locale={locale}
            searchIndex={searchIndex}
            typeLabels={typeLabels}
            onAdd={handleAdd}
            searchLabel={labels.addPokemon}
            searchPlaceholder={labels.addPlaceholder}
            multipleFormsMatchTemplate={labels.multipleFormsMatchTemplate}
            ambiguousHintLabel={labels.ambiguousHint}
            noResultsLabel={labels.noResults}
          />
        ) : (
          <p className="m-0 text-sm text-muted">{labels.maxReached}</p>
        )}
        {!atMax && forms.length === 1 ? (
          <p className="m-0 text-sm text-muted">{labels.addAnotherHint}</p>
        ) : null}
      </div>

      {forms.length === 0 ? (
        <p className={cardClass('m-0 px-5 py-8 text-center text-sm text-muted')}>
          {labels.emptyState}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {forms.map((form) => (
            <CompareCard
              key={form.formSlug}
              form={form}
              locale={locale}
              typeLabels={typeLabels}
              statLabels={statLabels}
              statTierLabels={statTierLabels}
              labels={labels}
              onRemove={() => handleRemove(form.formSlug)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Re-exported for callers that only need the cap, not the whole component
// (the server page validates/truncates the URL's slug list before ever
// reaching this component).
export { MAX_COMPARE_SLOTS };
