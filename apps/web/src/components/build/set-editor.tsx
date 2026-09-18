'use client';

import { useState } from 'react';

import { calculateStats } from '@pokelab/damage';
import type {
  ComparablePokemonForm,
  FormLearnsetAllVersionGroups,
  Item,
  Nature,
} from '@pokelab/database';
import { formatMessage, type Locale } from '@pokelab/i18n';
import { ALL_POKEMON_TYPES } from '@pokelab/pokemon-data';
import type { BaseStats, PokemonType } from '@pokelab/pokemon-data';

import { PokemonStatBars } from '@/components/pokemon/stat-bars';
import { PokemonTypeBadge } from '@/components/pokemon/type-badge';
import type { BuildGameCapabilities } from '@/lib/build-game-capabilities';
import { moveDisplayName } from '@/lib/move-search';
import { versionGroupDisplayName } from '@/lib/version-group-label';
import {
  MAX_EV_TOTAL,
  MAX_IV_PER_STAT,
  MAX_LEVEL,
  MAX_TEAM_MOVES,
  MIN_LEVEL,
  clampEv,
  clampIv,
  clampLevel,
  evTotal,
  maxEvForStat,
  type TeamMemberDraft,
} from '@/lib/team-draft';

import { MovePicker, type MovePickerLabels } from './move-picker';

export interface SetEditorLabels {
  nicknameLabel: string;
  nicknamePlaceholder: string;
  levelLabel: string;
  abilityLabel: string;
  noAbilitySelected: string;
  hiddenAbilityMarker: string;
  /** "Not valid for this Pokémon's current form" — shown when a preserved (never silently deleted) ability no longer belongs to the form, e.g. after a form swap. */
  abilityInvalidForForm: string;
  itemLabel: string;
  noItemSelected: string;
  teraTypeLabel: string;
  noTeraType: string;
  teraTypeHint: string;
  natureLabel: string;
  noNatureSelected: string;
  natureNeutral: string;
  natureModifierTemplate: string;
  evsLabel: string;
  /** "{count} EVs remaining" — shown while under the 510 budget. */
  evsRemainingTemplate: string;
  /** "{total} / {max}" — shown at exactly 510/510, a distinct clear-valid state from "remaining." */
  evsMaxTemplate: string;
  /** "{count} EVs over the limit" — legacy/corrupt data only; a normal edit can no longer reach this state. */
  evsOverLimitTemplate: string;
  ivsLabel: string;
  calculatedStatsLabel: string;
  /** "Stat calculation for {game} isn't implemented yet..." — shown instead of the EV/IV editor and calculated stats whenever `capabilities.modernEvsIvs` is false (task §19: never show a false modern-formula number for a game it doesn't apply to). */
  legacyStatsUnavailableTemplate: string;
  /** "PokeLab hasn't fully validated {game}'s mechanics yet..." — a small honesty note shown once per set when the game's capabilities aren't fully validated (task §3/§20). */
  historicalMechanicsNoteTemplate: string;
  movesLabel: string;
  moveLegalityHint: string;
  /** "Not learnable in {game}" — a preserved (never silently deleted) move that isn't legal for the current form/version group. */
  notLearnableTemplate: string;
  addMoveLabel: string;
  changeMoveTemplate: string;
  removeMoveTemplate: string;
  loadingReferenceData: string;
  statLabels: Record<keyof BaseStats, string>;
  statTierLabels: Record<'low' | 'average' | 'good' | 'excellent', string>;
  typeLabels: Record<PokemonType, string>;
  movePicker: MovePickerLabels;
}

function natureOptionLabel(nature: Nature, locale: Locale, labels: SetEditorLabels): string {
  const name = locale === 'es' ? (nature.nameEs ?? nature.nameEn) : nature.nameEn;
  if (!nature.increasedStat || !nature.decreasedStat) return `${name} ${labels.natureNeutral}`;
  const increased = labels.statLabels[toStatKey(nature.increasedStat)];
  const decreased = labels.statLabels[toStatKey(nature.decreasedStat)];
  return `${name} (${formatMessage(labels.natureModifierTemplate, { increased, decreased })})`;
}

/** `Nature.increasedStat` uses PokéAPI's kebab-case stat keys; the UI/stat-bars use camelCase. */
function toStatKey(key: string): keyof BaseStats {
  const map: Record<string, keyof BaseStats> = {
    attack: 'attack',
    defense: 'defense',
    'special-attack': 'specialAttack',
    'special-defense': 'specialDefense',
    speed: 'speed',
  };
  return map[key] ?? 'attack';
}

/** One member's full set editor (task: progressive disclosure — every field is a plain, native control, not a competitive-only wall of options). */
export function SetEditor({
  locale,
  member,
  form,
  learnset,
  versionGroupSlug,
  capabilities,
  natures,
  items,
  labels,
  onChange,
}: {
  locale: Locale;
  member: TeamMemberDraft;
  form: ComparablePokemonForm | undefined;
  learnset: FormLearnsetAllVersionGroups | undefined;
  versionGroupSlug: string;
  capabilities: BuildGameCapabilities;
  natures: Nature[];
  items: Item[];
  labels: SetEditorLabels;
  onChange: (patch: Partial<Omit<TeamMemberDraft, 'id'>>) => void;
}) {
  // Hooks must run unconditionally, before the `!form` early return below.
  const [editingMoveIndex, setEditingMoveIndex] = useState<number | null>(null);

  if (!form) {
    return <p className="m-0 text-sm text-muted">{labels.loadingReferenceData}</p>;
  }

  const selectedNature = natures.find((nature) => nature.slug === member.natureSlug);
  const isAbilityValid =
    member.abilitySlug === null ||
    form.abilities.some((ability) => ability.slug === member.abilitySlug);
  const allMoves = learnset?.moves ?? [];
  const legalMoveSlugsForVersionGroup = new Set(
    (learnset?.entries ?? [])
      .filter((entry) => entry.versionGroupSlug === versionGroupSlug)
      .map((entry) => entry.moveSlug),
  );
  // The Move Picker itself only ever offers *legal* moves (frozen — task
  // §19); this filtered/sorted list is exactly what gets passed to it below.
  const legalMoves = allMoves
    .filter((move) => legalMoveSlugsForVersionGroup.has(move.slug))
    .sort((a, b) =>
      (locale === 'es' ? (a.nameEs ?? a.nameEn) : a.nameEn).localeCompare(
        locale === 'es' ? (b.nameEs ?? b.nameEn) : b.nameEn,
      ),
    );

  const calculatedStats = calculateStats({
    baseStats: form.baseStats,
    ivs: member.ivs,
    evs: member.evs,
    level: member.level,
    nature: {
      increasedStat: selectedNature?.increasedStat,
      decreasedStat: selectedNature?.decreasedStat,
    },
  });

  const total = evTotal(member.evs);
  const evsRemaining = MAX_EV_TOTAL - total;
  const evsOverBudget = evsRemaining < 0;
  const evsStatusText =
    evsRemaining > 0
      ? formatMessage(labels.evsRemainingTemplate, { count: evsRemaining })
      : evsRemaining === 0
        ? formatMessage(labels.evsMaxTemplate, { total, max: MAX_EV_TOTAL })
        : formatMessage(labels.evsOverLimitTemplate, { count: Math.abs(evsRemaining) });
  const statKeys: (keyof BaseStats)[] = [
    'hp',
    'attack',
    'defense',
    'specialAttack',
    'specialDefense',
    'speed',
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          {labels.nicknameLabel}
          <input
            type="text"
            value={member.nickname}
            placeholder={labels.nicknamePlaceholder}
            onChange={(event) => onChange({ nickname: event.target.value })}
            className="rounded-md border border-border-subtle bg-surface px-2 py-2 text-sm text-foreground"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted">
          {labels.levelLabel}
          <input
            type="number"
            min={MIN_LEVEL}
            max={MAX_LEVEL}
            value={member.level}
            onChange={(event) => {
              const value = Number.parseInt(event.target.value, 10);
              if (Number.isNaN(value)) return;
              onChange({ level: clampLevel(value) });
            }}
            className="rounded-md border border-border-subtle bg-surface px-2 py-2 text-sm text-foreground"
          />
        </label>

        {/* Mechanic-dependent fields (task §20): a game context that has no
            concept of a mechanic simply doesn't render its field — never an
            ugly disabled control, and never a fake value for a mechanic
            that doesn't exist there. Draft data for a hidden field is left
            untouched underneath (task §4), so switching back to a game
            that supports it restores it automatically. */}
        {capabilities.abilities ? (
          <label className="flex flex-col gap-1 text-xs text-muted">
            {labels.abilityLabel}
            <select
              value={member.abilitySlug ?? ''}
              onChange={(event) => onChange({ abilitySlug: event.target.value || null })}
              aria-invalid={!isAbilityValid || undefined}
              className="rounded-md border border-border-subtle bg-surface px-2 py-2 text-sm text-foreground aria-[invalid=true]:border-danger"
            >
              <option value="">{labels.noAbilitySelected}</option>
              {form.abilities.map((ability) => (
                <option key={ability.slug} value={ability.slug}>
                  {(locale === 'es' ? (ability.nameEs ?? ability.nameEn) : ability.nameEn) +
                    (ability.isHidden ? ` ${labels.hiddenAbilityMarker}` : '')}
                </option>
              ))}
              {/* A preserved-but-now-invalid ability (e.g. after a form swap,
                  task §20/§1: "never destroy user work") is kept selectable
                  — shown as its own slug, since this form's own ability list
                  has no real name for it — rather than silently vanishing. */}
              {member.abilitySlug && !isAbilityValid ? (
                <option value={member.abilitySlug}>{member.abilitySlug}</option>
              ) : null}
            </select>
            {!isAbilityValid ? (
              <span className="text-xs font-semibold text-danger" role="alert">
                <span aria-hidden="true">⚠ </span>
                {labels.abilityInvalidForForm}
              </span>
            ) : null}
          </label>
        ) : null}

        {capabilities.heldItems ? (
          <label className="flex flex-col gap-1 text-xs text-muted">
            {labels.itemLabel}
            <select
              value={member.itemSlug ?? ''}
              onChange={(event) => onChange({ itemSlug: event.target.value || null })}
              className="rounded-md border border-border-subtle bg-surface px-2 py-2 text-sm text-foreground"
            >
              <option value="">{labels.noItemSelected}</option>
              {items.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {locale === 'es' ? (item.nameEs ?? item.nameEn) : item.nameEn}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {capabilities.natures ? (
          <label className="flex flex-col gap-1 text-xs text-muted">
            {labels.natureLabel}
            <select
              value={member.natureSlug ?? ''}
              onChange={(event) => onChange({ natureSlug: event.target.value || null })}
              className="rounded-md border border-border-subtle bg-surface px-2 py-2 text-sm text-foreground"
            >
              <option value="">{labels.noNatureSelected}</option>
              {natures.map((nature) => (
                <option key={nature.slug} value={nature.slug}>
                  {natureOptionLabel(nature, locale, labels)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {capabilities.tera ? (
          <label className="flex flex-col gap-1 text-xs text-muted">
            <span title={labels.teraTypeHint}>{labels.teraTypeLabel}</span>
            <select
              value={member.teraType ?? ''}
              onChange={(event) =>
                onChange({ teraType: (event.target.value || null) as PokemonType | null })
              }
              className="rounded-md border border-border-subtle bg-surface px-2 py-2 text-sm text-foreground"
            >
              <option value="">{labels.noTeraType}</option>
              {ALL_POKEMON_TYPES.map((type) => (
                <option key={type} value={type}>
                  {labels.typeLabels[type]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {!capabilities.fullyValidated ? (
        <p className="m-0 text-xs text-muted" role="note">
          {formatMessage(labels.historicalMechanicsNoteTemplate, {
            game: versionGroupDisplayName(versionGroupSlug),
          })}
        </p>
      ) : null}

      {capabilities.modernEvsIvs ? (
        <>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted">{labels.evsLabel}</span>
                <span
                  className={`text-xs font-semibold tabular-nums ${evsOverBudget ? 'text-danger' : 'text-muted'}`}
                  role={evsOverBudget ? 'alert' : undefined}
                >
                  {evsStatusText}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {statKeys.map((key) => {
                  // The per-field ceiling already accounts for the other five
                  // stats' current values, so a normal edit can never push the
                  // total over 510 in the first place (task: prevent the
                  // invalid total, never redistribute the other fields).
                  // Existing over-budget data (from before this fix) is still
                  // clamped per-field and surfaced honestly above, not silently
                  // "fixed" by touching stats the user didn't edit.
                  const ceiling = maxEvForStat(member.evs, key);
                  return (
                    <label key={key} className="flex flex-col gap-1 text-xs text-muted">
                      {labels.statLabels[key]}
                      <input
                        type="number"
                        min={0}
                        max={ceiling}
                        value={member.evs[key]}
                        aria-invalid={evsOverBudget || undefined}
                        onChange={(event) => {
                          const value = Number.parseInt(event.target.value, 10);
                          if (Number.isNaN(value)) return;
                          onChange({
                            evs: { ...member.evs, [key]: Math.min(ceiling, clampEv(value)) },
                          });
                        }}
                        className="rounded-md border border-border-subtle bg-surface px-2 py-1.5 text-sm text-foreground aria-[invalid=true]:border-danger"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-muted">{labels.ivsLabel}</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {statKeys.map((key) => (
                  <label key={key} className="flex flex-col gap-1 text-xs text-muted">
                    {labels.statLabels[key]}
                    <input
                      type="number"
                      min={0}
                      max={MAX_IV_PER_STAT}
                      value={member.ivs[key]}
                      onChange={(event) => {
                        const value = Number.parseInt(event.target.value, 10);
                        if (Number.isNaN(value)) return;
                        onChange({ ivs: { ...member.ivs, [key]: clampIv(value) } });
                      }}
                      className="rounded-md border border-border-subtle bg-surface px-2 py-1.5 text-sm text-foreground"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted">{labels.calculatedStatsLabel}</span>
            <PokemonStatBars
              stats={calculatedStats}
              labels={labels.statLabels}
              tierLabels={labels.statTierLabels}
            />
          </div>
        </>
      ) : (
        // Task §19: never compute Gen III+ stat formulas for a game they
        // don't apply to (Gen I/II's different DV/stat-experience systems,
        // every special-ruleset game's own investment system) — an honest
        // omission rather than a wrong number.
        <p className="m-0 text-sm text-muted">
          {formatMessage(labels.legacyStatsUnavailableTemplate, {
            game: versionGroupDisplayName(versionGroupSlug),
          })}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted">{labels.movesLabel}</span>
        </div>
        <p className="m-0 text-xs text-muted">{labels.moveLegalityHint}</p>

        {editingMoveIndex !== null ? (
          <MovePicker
            locale={locale}
            moves={legalMoves}
            typeLabels={labels.typeLabels}
            selectedMoveSlugs={member.moveSlugs.filter(
              (slug, index): slug is string => slug !== null && index !== editingMoveIndex,
            )}
            labels={labels.movePicker}
            onSelect={(moveSlug) => {
              const nextSlugs = [...member.moveSlugs];
              nextSlugs[editingMoveIndex] = moveSlug;
              onChange({ moveSlugs: nextSlugs });
              setEditingMoveIndex(null);
            }}
            onClose={() => setEditingMoveIndex(null)}
          />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {Array.from({ length: MAX_TEAM_MOVES }, (_, index) => {
              const moveSlug = member.moveSlugs[index] ?? null;
              if (!moveSlug) {
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setEditingMoveIndex(index)}
                    className="rounded-md border border-dashed border-border-subtle px-2 py-2 text-left text-sm text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                  >
                    + {labels.addMoveLabel}
                  </button>
                );
              }

              // Looked up in the *full* learnset, not just `legalMoves` —
              // task §1/§18: a move that's no longer legal for the current
              // form/version group is kept and its real name/type still
              // shown, never silently reduced to a raw slug. `isLegal` is
              // the only thing that changes.
              const move = allMoves.find((m) => m.slug === moveSlug);
              const isLegal = legalMoveSlugsForVersionGroup.has(moveSlug);
              const displayName = move ? moveDisplayName(move, locale) : moveSlug;
              return (
                <div
                  key={index}
                  className={`flex flex-col gap-1 rounded-md border px-2 py-1.5 ${
                    isLegal ? 'border-border-subtle bg-surface' : 'border-danger bg-surface'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {displayName}
                    </span>
                    {move ? (
                      <PokemonTypeBadge
                        type={move.type}
                        label={labels.typeLabels[move.type]}
                        size="sm"
                      />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setEditingMoveIndex(index)}
                      aria-label={formatMessage(labels.changeMoveTemplate, { name: displayName })}
                      className="shrink-0 rounded-full border border-border-subtle bg-surface px-1.5 py-0.5 text-xs font-semibold text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                    >
                      ⇄
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextSlugs = [...member.moveSlugs];
                        nextSlugs[index] = null;
                        onChange({ moveSlugs: nextSlugs });
                      }}
                      aria-label={formatMessage(labels.removeMoveTemplate, { name: displayName })}
                      className="shrink-0 rounded-full border border-border-subtle bg-surface px-1.5 py-0.5 text-xs font-semibold text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                    >
                      ×
                    </button>
                  </div>
                  {!isLegal ? (
                    <span className="text-xs font-semibold text-danger" role="alert">
                      <span aria-hidden="true">⚠ </span>
                      {formatMessage(labels.notLearnableTemplate, {
                        game: versionGroupDisplayName(versionGroupSlug),
                      })}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
