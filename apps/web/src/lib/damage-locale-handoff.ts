import { ALL_POKEMON_TYPES } from '@pokestudio/pokemon-data';

import { createDefaultAdvancedConfig, type DamageAdvancedConfig } from '@/lib/damage-advanced';

/**
 * Damage Lab's own locale-switch state handoff — `DamageLab` keeps
 * `versionGroupSlug`/`attackerFormSlug`/`defenderFormSlug`/`selectedMoveSlug`/
 * `attackerConfig`/`defenderConfig`/`isCritical` as plain component state,
 * which a locale switch (a real route-segment change, `[locale]`) throws
 * away by unmounting the whole tree. `LocaleSwitcher`'s own query-string
 * preservation fix is a different, already-solved problem — it keeps
 * `?team=`/`?pokemon=` in the URL, but says nothing about React state.
 *
 * This is a one-shot, tab-local, read-once handoff: `sessionStorage`
 * (never `localStorage` — never becomes accidental permanent storage, and
 * never touches `pokestudio:teams:v1`), written only the instant a real
 * same-tab locale navigation is about to happen (`LocaleSwitcher`'s
 * `LOCALE_CHANGE_EVENT`), bound to the exact destination URL, expiring
 * after 60s, and deleted the moment it's read regardless of whether it was
 * valid. No calculation result and no localized/display name is ever part
 * of the draft (task: "Do NOT persist: calculation result, localized/
 * display names" — only slugs/ids/numbers/booleans, the same identity
 * vocabulary the rest of Damage Lab's state already uses).
 */

const STORAGE_KEY = 'pokestudio:damage-locale-handoff';
const TTL_MS = 60_000;

export interface DamageLocaleDraft {
  versionGroupSlug: string;
  attackerFormSlug: string | null;
  defenderFormSlug: string | null;
  selectedMoveSlug: string | null;
  attackerConfig: DamageAdvancedConfig;
  defenderConfig: DamageAdvancedConfig;
  isCritical: boolean;
}

interface StoredHandoff {
  target: string;
  expires: number;
  draft: DamageLocaleDraft;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

const STAT_KEYS = Object.keys(
  createDefaultAdvancedConfig().evs,
) as (keyof DamageAdvancedConfig['evs'])[];

function isStatSpread(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const spread = value as Record<string, unknown>;
  return STAT_KEYS.every((key) => typeof spread[key] === 'number' && Number.isFinite(spread[key]));
}

function isAdvancedConfig(value: unknown): value is DamageAdvancedConfig {
  if (typeof value !== 'object' || value === null) return false;
  const config = value as Partial<DamageAdvancedConfig>;
  return (
    typeof config.level === 'number' &&
    Number.isFinite(config.level) &&
    isNullableString(config.abilitySlug) &&
    isNullableString(config.itemSlug) &&
    isNullableString(config.natureSlug) &&
    typeof config.teraEnabled === 'boolean' &&
    (config.teraType === null ||
      (typeof config.teraType === 'string' &&
        (ALL_POKEMON_TYPES as readonly string[]).includes(config.teraType))) &&
    isStatSpread(config.evs) &&
    isStatSpread(config.ivs)
  );
}

function isDraft(value: unknown): value is DamageLocaleDraft {
  if (typeof value !== 'object' || value === null) return false;
  const draft = value as Partial<DamageLocaleDraft>;
  return (
    typeof draft.versionGroupSlug === 'string' &&
    isNullableString(draft.attackerFormSlug) &&
    isNullableString(draft.defenderFormSlug) &&
    isNullableString(draft.selectedMoveSlug) &&
    typeof draft.isCritical === 'boolean' &&
    isAdvancedConfig(draft.attackerConfig) &&
    isAdvancedConfig(draft.defenderConfig)
  );
}

/** Called right when `LOCALE_CHANGE_EVENT` fires — `target` is that event's own `detail` (the destination `pathname + search`). */
export function saveDamageLocaleHandoff(target: string, draft: DamageLocaleDraft): void {
  try {
    const stored: StoredHandoff = { target, expires: Date.now() + TTL_MS, draft };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage disabled/full/private-mode — navigation must still work; the
    // user just re-selects on the new locale, same as before this existed.
  }
}

/**
 * Reads and immediately deletes the stored handoff (read-once), returning
 * it only if it was written for *this exact* URL, hasn't expired, and
 * passes full runtime validation of every field — anything else (missing,
 * expired, malformed JSON, wrong shape, a stray value from an unrelated
 * page) is treated identically to "no handoff at all," never a throw.
 */
export function takeDamageLocaleHandoff(): DamageLocaleDraft | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const candidate = parsed as Partial<StoredHandoff>;
    if (
      typeof candidate.target !== 'string' ||
      candidate.target !== window.location.pathname + window.location.search ||
      typeof candidate.expires !== 'number' ||
      candidate.expires < Date.now() ||
      !isDraft(candidate.draft)
    ) {
      return null;
    }
    return candidate.draft;
  } catch {
    return null;
  }
}
