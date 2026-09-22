'use client';

import { useId, useState } from 'react';

import type { ComparablePokemonForm, Item, Nature } from '@pokestudio/database';
import { formatMessage, type Locale } from '@pokestudio/i18n';
import { ALL_POKEMON_TYPES, type BaseStats, type PokemonType } from '@pokestudio/pokemon-data';

import { ItemPicker, type ItemPickerLabels } from '@/components/build/item-picker';
import { itemDisplayName } from '@/lib/item-search';
import type { BuildGameCapabilities } from '@/lib/build-game-capabilities';
import {
  clampEv,
  clampIv,
  clampLevel,
  evTotal,
  MAX_EV_TOTAL,
  MAX_IV_PER_STAT,
  MAX_LEVEL,
  maxEvForStat,
  MIN_LEVEL,
} from '@/lib/team-draft';
import { versionGroupDisplayName } from '@/lib/version-group-label';
import { summarizeAdvancedConfig, type DamageAdvancedConfig } from '@/lib/damage-advanced';

export interface DamageAdvancedPanelLabels {
  advancedLabel: string;
  levelLabel: string;
  natureLabel: string;
  natureNeutralOption: string;
  natureModifierTemplate: string;
  abilityLabel: string;
  noAbilitySelected: string;
  hiddenAbilityMarker: string;
  itemLabel: string;
  noItemSelected: string;
  itemSearchLabel: string;
  itemSearchNoResults: string;
  cancelLabel: string;
  evsLabel: string;
  evsRemainingTemplate: string;
  evsMaxTemplate: string;
  evsOverLimitTemplate: string;
  ivsLabel: string;
  legacyStatsUnavailableTemplate: string;
  historicalMechanicsNoteTemplate: string;
  teraTypeLabel: string;
  noTeraType: string;
  terastallizeLabel: string;
  teraSummaryTemplate: string;
  criticalLabel: string;
  loadingReferenceData: string;
  statLabels: Record<keyof BaseStats, string>;
  statAbbr: Record<keyof BaseStats, string>;
  typeLabels: Record<PokemonType, string>;
}

const STAT_KEYS: (keyof BaseStats)[] = [
  'hp',
  'attack',
  'defense',
  'specialAttack',
  'specialDefense',
  'speed',
];

function natureOptionLabel(
  nature: Nature,
  locale: Locale,
  labels: DamageAdvancedPanelLabels,
): string {
  const name = locale === 'es' ? (nature.nameEs ?? nature.nameEn) : nature.nameEn;
  if (!nature.increasedStat || !nature.decreasedStat) return name;
  const statKeyMap: Record<string, keyof BaseStats> = {
    attack: 'attack',
    defense: 'defense',
    'special-attack': 'specialAttack',
    'special-defense': 'specialDefense',
    speed: 'speed',
  };
  const increased = labels.statLabels[statKeyMap[nature.increasedStat] ?? 'attack'];
  const decreased = labels.statLabels[statKeyMap[nature.decreasedStat] ?? 'attack'];
  return `${name} (${formatMessage(labels.natureModifierTemplate, { increased, decreased })})`;
}

/**
 * One combatant's Advanced controls (Fase M3.1C) — collapsed by default,
 * every field gated by `capabilities` (task §3: never a scattered
 * `if (generation === X)`), rendered inline in the slot/card rather than a
 * modal (task §2: "debe sentirse integrado"). Attacker and defender each
 * get their own independent instance; only the attacker instance renders
 * Critical hit (task §12).
 */
export function DamageAdvancedPanel({
  locale,
  side,
  form,
  capabilities,
  config,
  onChange,
  isCritical,
  onCriticalChange,
  isOpen,
  onToggleOpen,
  natures,
  items,
  labels,
}: {
  locale: Locale;
  side: 'attacker' | 'defender';
  form: ComparablePokemonForm | null;
  capabilities: BuildGameCapabilities;
  config: DamageAdvancedConfig;
  onChange: (patch: Partial<DamageAdvancedConfig>) => void;
  isCritical: boolean;
  onCriticalChange: (value: boolean) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  natures: Nature[] | undefined;
  items: Item[] | undefined;
  labels: DamageAdvancedPanelLabels;
}) {
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const panelId = useId();
  const itemLabelId = useId();
  const itemButtonId = useId();
  const selectedItem = items?.find((item) => item.slug === config.itemSlug);
  const selectedNature = natures?.find((nature) => nature.slug === config.natureSlug);
  const selectedAbility = form?.abilities.find((ability) => ability.slug === config.abilitySlug);
  const abilityName = selectedAbility
    ? locale === 'es'
      ? (selectedAbility.nameEs ?? selectedAbility.nameEn)
      : selectedAbility.nameEn
    : undefined;
  const summaryTokens = summarizeAdvancedConfig({
    config,
    locale,
    nature: selectedNature,
    abilityName,
    item: selectedItem,
    statAbbr: labels.statAbbr,
    teraSummaryTemplate: labels.teraSummaryTemplate,
    typeLabels: labels.typeLabels,
  });
  const total = evTotal(config.evs);
  const evsRemaining = MAX_EV_TOTAL - total;
  const evsOverBudget = evsRemaining < 0;
  const evsStatusText =
    evsRemaining > 0
      ? formatMessage(labels.evsRemainingTemplate, { count: evsRemaining })
      : evsRemaining === 0
        ? formatMessage(labels.evsMaxTemplate, { total, max: MAX_EV_TOTAL })
        : formatMessage(labels.evsOverLimitTemplate, { count: Math.abs(evsRemaining) });

  const needsReferenceData = capabilities.heldItems || capabilities.natures;
  const referenceDataReady = !needsReferenceData || (natures !== undefined && items !== undefined);

  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-xs text-muted">{summaryTokens.join(' · ')}</p>
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="self-start text-xs font-semibold text-brand hover:underline"
      >
        {labels.advancedLabel} {isOpen ? '▲' : '▾'}
      </button>

      {isOpen ? (
        <div
          id={panelId}
          className="flex flex-col gap-4 rounded-lg border border-border-subtle p-3"
        >
          {!referenceDataReady ? (
            <p className="m-0 text-xs text-muted">{labels.loadingReferenceData}</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs text-muted">
                  {labels.levelLabel}
                  <input
                    type="number"
                    min={MIN_LEVEL}
                    max={MAX_LEVEL}
                    value={config.level}
                    onChange={(event) => {
                      const value = Number.parseInt(event.target.value, 10);
                      if (Number.isNaN(value)) return;
                      onChange({ level: clampLevel(value) });
                    }}
                    className="rounded-md border border-border-subtle bg-surface px-2 py-2 text-sm text-foreground"
                  />
                </label>

                {capabilities.natures ? (
                  <label className="flex flex-col gap-1 text-xs text-muted">
                    {labels.natureLabel}
                    <select
                      value={config.natureSlug ?? ''}
                      onChange={(event) => onChange({ natureSlug: event.target.value || null })}
                      className="rounded-md border border-border-subtle bg-surface px-2 py-2 text-sm text-foreground"
                    >
                      <option value="">{labels.natureNeutralOption}</option>
                      {(natures ?? []).map((nature) => (
                        <option key={nature.slug} value={nature.slug}>
                          {natureOptionLabel(nature, locale, labels)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {capabilities.abilities ? (
                  <label className="flex flex-col gap-1 text-xs text-muted">
                    {labels.abilityLabel}
                    <select
                      value={config.abilitySlug ?? ''}
                      onChange={(event) => onChange({ abilitySlug: event.target.value || null })}
                      className="rounded-md border border-border-subtle bg-surface px-2 py-2 text-sm text-foreground"
                    >
                      <option value="">{labels.noAbilitySelected}</option>
                      {(form?.abilities ?? []).map((ability) => (
                        <option key={ability.slug} value={ability.slug}>
                          {(locale === 'es' ? (ability.nameEs ?? ability.nameEn) : ability.nameEn) +
                            (ability.isHidden ? ` ${labels.hiddenAbilityMarker}` : '')}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {capabilities.heldItems ? (
                  <div className="flex flex-col gap-1 text-xs text-muted">
                    <span id={itemLabelId}>{labels.itemLabel}</span>
                    {itemPickerOpen ? (
                      <ItemPicker
                        locale={locale}
                        items={items ?? []}
                        labels={
                          {
                            searchLabel: labels.itemSearchLabel,
                            noResultsLabel: labels.itemSearchNoResults,
                            cancelLabel: labels.cancelLabel,
                          } satisfies ItemPickerLabels
                        }
                        onSelect={(itemSlug) => {
                          onChange({ itemSlug });
                          setItemPickerOpen(false);
                        }}
                        onClose={() => setItemPickerOpen(false)}
                      />
                    ) : (
                      <button
                        type="button"
                        id={itemButtonId}
                        aria-labelledby={`${itemLabelId} ${itemButtonId}`}
                        onClick={() => setItemPickerOpen(true)}
                        className="rounded-md border border-border-subtle bg-surface px-2 py-2 text-left text-sm text-foreground"
                      >
                        {selectedItem
                          ? itemDisplayName(selectedItem, locale)
                          : labels.noItemSelected}
                      </button>
                    )}
                  </div>
                ) : null}

                {capabilities.tera ? (
                  <div className="flex flex-col gap-1 text-xs text-muted">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={config.teraEnabled}
                        onChange={(event) => onChange({ teraEnabled: event.target.checked })}
                      />
                      {labels.terastallizeLabel}
                    </label>
                    {config.teraEnabled ? (
                      <select
                        value={config.teraType ?? ''}
                        aria-label={labels.teraTypeLabel}
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
                    ) : null}
                  </div>
                ) : null}

                {side === 'attacker' ? (
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={isCritical}
                      onChange={(event) => onCriticalChange(event.target.checked)}
                    />
                    {labels.criticalLabel}
                  </label>
                ) : null}
              </div>

              {!capabilities.fullyValidated ? (
                <p className="m-0 text-xs text-muted" role="note">
                  {formatMessage(labels.historicalMechanicsNoteTemplate, {
                    game: versionGroupDisplayName(capabilities.versionGroupSlug),
                  })}
                </p>
              ) : null}

              {capabilities.modernEvsIvs ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                    <div className="grid grid-cols-3 gap-2">
                      {STAT_KEYS.map((key) => {
                        const ceiling = maxEvForStat(config.evs, key);
                        return (
                          <label key={key} className="flex flex-col gap-1 text-xs text-muted">
                            {labels.statLabels[key]}
                            <input
                              type="number"
                              min={0}
                              max={ceiling}
                              value={config.evs[key]}
                              aria-invalid={evsOverBudget || undefined}
                              onChange={(event) => {
                                const value = Number.parseInt(event.target.value, 10);
                                if (Number.isNaN(value)) return;
                                onChange({
                                  evs: { ...config.evs, [key]: Math.min(ceiling, clampEv(value)) },
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
                    <div className="grid grid-cols-3 gap-2">
                      {STAT_KEYS.map((key) => (
                        <label key={key} className="flex flex-col gap-1 text-xs text-muted">
                          {labels.statLabels[key]}
                          <input
                            type="number"
                            min={0}
                            max={MAX_IV_PER_STAT}
                            value={config.ivs[key]}
                            onChange={(event) => {
                              const value = Number.parseInt(event.target.value, 10);
                              if (Number.isNaN(value)) return;
                              onChange({ ivs: { ...config.ivs, [key]: clampIv(value) } });
                            }}
                            className="rounded-md border border-border-subtle bg-surface px-2 py-1.5 text-sm text-foreground"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="m-0 text-sm text-muted">
                  {formatMessage(labels.legacyStatsUnavailableTemplate, {
                    game: versionGroupDisplayName(capabilities.versionGroupSlug),
                  })}
                </p>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
