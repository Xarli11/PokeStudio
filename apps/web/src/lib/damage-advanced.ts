import type { ComparablePokemonForm, Item, Nature } from '@pokestudio/database';
import type { StatSpread } from '@pokestudio/damage';
import { formatMessage, type Locale } from '@pokestudio/i18n';
import type { BaseStats, PokemonType } from '@pokestudio/pokemon-data';

import { itemDisplayName } from '@/lib/item-search';

import type { BuildGameCapabilities } from '@/lib/build-game-capabilities';
import {
  clampEv,
  clampIv,
  clampLevel,
  clampStatSpread,
  DEFAULT_IVS,
  evTotal,
  MAX_EV_TOTAL,
  MAX_LEVEL,
  ZERO_EVS,
} from '@/lib/team-draft';

/**
 * Damage Lab Advanced's own per-combatant state (Fase M3.1C) — web-layer
 * only, never imported by `@pokestudio/damage` (task §13: "NO metas tipos
 * de UI en @pokestudio/damage"). Deliberately the exact same field shapes
 * Build's `TeamMemberDraft` already uses (`evs`/`ivs: StatSpread`,
 * `abilitySlug`/`itemSlug`/`natureSlug: string | null`) so every clamp/total
 * primitive below is reused verbatim from `team-draft.ts`, never redefined
 * (task §5/§9/§10: "no dupliques domain limits").
 *
 * `teraEnabled` is a UI-only concept split out from `teraType` — the damage
 * domain's own `DamageCombatant.teraType?: PokemonType | null` already means
 * "Tera active" by itself (audited directly against `packages/damage/src/
 * index.ts`), but task §11 asks the *UI* to distinguish "Terastallize is on,
 * no type chosen yet" from "Terastallize is off" so a user can toggle it
 * off and back on without losing their last pick. The effective value sent
 * to the Server Action collapses the two back down (`teraEnabled ?
 * teraType : null`) — see `effectiveTeraType` below.
 */
export interface DamageAdvancedConfig {
  level: number;
  abilitySlug: string | null;
  itemSlug: string | null;
  natureSlug: string | null;
  evs: StatSpread;
  ivs: StatSpread;
  teraEnabled: boolean;
  teraType: PokemonType | null;
}

/** Simple Mode's own fixed assumptions (task §1/§7) as the Advanced default — opening Advanced and touching nothing must calculate identically to before this phase. */
export function createDefaultAdvancedConfig(): DamageAdvancedConfig {
  return {
    level: MAX_LEVEL,
    abilitySlug: null,
    itemSlug: null,
    natureSlug: null,
    evs: { ...ZERO_EVS },
    ivs: { ...DEFAULT_IVS },
    teraEnabled: false,
    teraType: null,
  };
}

/** The `teraType` actually sent to the Server Action — `null` whenever Terastallize is off, regardless of what type was last picked (task §11). */
export function effectiveTeraType(config: DamageAdvancedConfig): PokemonType | null {
  return config.teraEnabled ? config.teraType : null;
}

/**
 * Clamps level/EVs/IVs the same way `team-draft.ts`'s `sanitizeMemberPatch`
 * does for Build — a second line of defense against a stray out-of-range
 * number reaching the Server Action, not just the input `min`/`max`
 * attributes (task §18).
 */
export function clampAdvancedConfig(config: DamageAdvancedConfig): DamageAdvancedConfig {
  return {
    ...config,
    level: clampLevel(config.level),
    evs: clampStatSpread(config.evs, clampEv),
    ivs: clampStatSpread(config.ivs, clampIv),
  };
}

/**
 * Game-switch revalidation (task §15) — deliberately more conservative than
 * Build's "leave the field untouched, just hide it" philosophy
 * (`set-editor.tsx`'s own comment): a Damage Lab Advanced config is
 * ephemeral per-calculation state, not a persisted team draft, and
 * ability/nature/item pools differ entirely across generations (Gen I has
 * no abilities at all, Gen II's item pool is its own thing), so a hidden
 * stale value could silently resurface with the wrong meaning. EVs/IVs are
 * the one exception the task calls out explicitly: they're preserved
 * in-memory even while `modernEvsIvs` is false, so switching back to a
 * modern game restores them with no re-entry needed. Level is universal
 * (every generation has it) and is never touched here.
 */
export function revalidateAdvancedConfigForCapabilities(
  config: DamageAdvancedConfig,
  capabilities: BuildGameCapabilities,
): DamageAdvancedConfig {
  return {
    ...config,
    abilitySlug: capabilities.abilities ? config.abilitySlug : null,
    natureSlug: capabilities.natures ? config.natureSlug : null,
    itemSlug: capabilities.heldItems ? config.itemSlug : null,
    teraEnabled: capabilities.tera ? config.teraEnabled : false,
    teraType: capabilities.tera ? config.teraType : null,
  };
}

/**
 * Pokémon-swap revalidation (task §14) — mirrors `team-draft.ts`'s
 * `changeTeamMemberForm` exactly: only `abilitySlug` is form-scoped, so it's
 * the only field reset when it no longer belongs to the new form's ability
 * list. EVs/IVs/level/item/nature/Tera are a player's own set choices, never
 * tied to a specific species/form, so they survive a Pokémon swap
 * unconditionally — same reasoning Build already established for exactly
 * this scenario. Tera type in particular is preserved even though it's
 * unrelated to the new Pokémon's own types: nothing about a species swap
 * invalidates a previously chosen Tera type (every type is a legal Tera
 * choice for every species), unlike ability, which the games genuinely
 * restrict to a specific form's own ability list.
 */
export function revalidateAdvancedConfigForForm(
  config: DamageAdvancedConfig,
  form: ComparablePokemonForm | null,
): DamageAdvancedConfig {
  if (!form) return config;
  const abilityStillValid =
    config.abilitySlug === null || form.abilities.some((a) => a.slug === config.abilitySlug);
  return abilityStillValid ? config : { ...config, abilitySlug: null };
}

/**
 * Second-line validation before a Server Action call (task §18) — the
 * damage domain itself validates again (its own `validateRange`/identity
 * resolution), so this never needs to be exhaustive, only enough to keep
 * the Calculate button honest: an ability that no longer belongs to the
 * selected form, or a total EV investment native HTML `min`/`max` alone
 * couldn't have prevented (e.g. programmatic/pasted state).
 */
export function isAdvancedConfigValid(
  config: DamageAdvancedConfig,
  capabilities: BuildGameCapabilities,
  form: ComparablePokemonForm | null,
): boolean {
  if (config.level < 1 || config.level > 100) return false;
  if (evTotal(config.evs) > MAX_EV_TOTAL) return false;
  for (const value of Object.values(config.evs)) {
    if (value < 0 || value > 252) return false;
  }
  for (const value of Object.values(config.ivs)) {
    if (value < 0 || value > 31) return false;
  }
  if (config.abilitySlug && form && !form.abilities.some((a) => a.slug === config.abilitySlug)) {
    return false;
  }
  if (!capabilities.abilities && config.abilitySlug) return false;
  if (!capabilities.natures && config.natureSlug) return false;
  if (!capabilities.heldItems && config.itemSlug) return false;
  if (!capabilities.tera && config.teraEnabled) return false;
  return true;
}

/** Whether this config differs from the Simple Mode default at all — used to decide whether the compact summary has anything non-default to show. */
export function isDefaultAdvancedConfig(config: DamageAdvancedConfig): boolean {
  const defaults = createDefaultAdvancedConfig();
  return (
    config.level === defaults.level &&
    config.abilitySlug === defaults.abilitySlug &&
    config.itemSlug === defaults.itemSlug &&
    config.natureSlug === defaults.natureSlug &&
    config.teraEnabled === defaults.teraEnabled &&
    config.teraType === defaults.teraType &&
    evTotal(config.evs) === 0 &&
    Object.values(config.ivs).every((value) => value === 31)
  );
}

const EV_STAT_ORDER: (keyof BaseStats)[] = [
  'hp',
  'attack',
  'defense',
  'specialAttack',
  'specialDefense',
  'speed',
];

/**
 * The collapsed-panel compact summary (task §22) — replaces the old single
 * constant assumptions line with a per-combatant dynamic one. Only ever
 * mentions fields that differ from Simple Mode's own defaults (a default
 * level/0 EVs/neutral nature/no ability/no item combatant summarizes to
 * just "Lv. 100", not a wall of "no X" tokens) — deliberately not a giant
 * paragraph (task: "no quiero un párrafo enorme").
 */
export function summarizeAdvancedConfig(params: {
  config: DamageAdvancedConfig;
  locale: Locale;
  nature: Nature | undefined;
  abilityName: string | undefined;
  item: Item | undefined;
  statAbbr: Record<keyof BaseStats, string>;
  teraSummaryTemplate: string;
  typeLabels: Record<PokemonType, string>;
}): string[] {
  const { config, locale, nature, abilityName, item, statAbbr, teraSummaryTemplate, typeLabels } =
    params;
  const tokens: string[] = [`Lv. ${config.level}`];

  const evTokens = EV_STAT_ORDER.filter((key) => config.evs[key] > 0).map(
    (key) => `${config.evs[key]} ${statAbbr[key]}`,
  );
  if (evTokens.length > 0) tokens.push(evTokens.join(' / '));

  const ivTokens = EV_STAT_ORDER.filter((key) => config.ivs[key] !== 31).map(
    (key) => `${config.ivs[key]} ${statAbbr[key]} IV`,
  );
  if (ivTokens.length > 0) tokens.push(ivTokens.join(' / '));

  if (nature) tokens.push(locale === 'es' ? (nature.nameEs ?? nature.nameEn) : nature.nameEn);
  if (abilityName) tokens.push(abilityName);
  if (item) tokens.push(itemDisplayName(item, locale));

  const effectiveTera = effectiveTeraType(config);
  if (effectiveTera) {
    tokens.push(formatMessage(teraSummaryTemplate, { type: typeLabels[effectiveTera] }));
  }

  return tokens;
}
