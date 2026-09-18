import type { EvolutionCondition, EvolutionEdge } from '@pokelab/database';
import { formatMessage, type Dictionary } from '@pokelab/i18n';

import { localizedItemName } from './evolution-item-label';

/**
 * PokeLab doesn't model items/moves/locations as their own localized
 * entities yet (CLAUDE.md non-goals, ADR-0010 §4 deferred) — evolution
 * conditions only store their PokéAPI slug. Humanizing the slug (kebab-case
 * -> Title Case) is an honest, English-only stand-in until those become real
 * reference tables; it is not a translation (Part D, docs/engineering/DATA_SOURCES.md).
 * `evolution-item-label.ts`'s small, hand-verified table of classic
 * evolution stones is the one deliberate exception (Phase 1C.2b) — real,
 * confidently-known official names, not this fallback.
 */
function humanizeSlug(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

type EvolutionDictionary = Dictionary['pokedex']['evolution'];

/**
 * One edge's condition as a single localized line, e.g. "Use item using
 * Water Stone" / "Level up at level 16, at night". Deliberately does not
 * interpolate `locationSlug`'s actual value (just a fixed "at a special
 * location" phrase) — PokéAPI often lists the *same* conceptual method
 * (e.g. Magneton -> Magnezone) once per game version's location, and
 * without a version-group-scoped model (Part B deliberately doesn't build
 * one yet — see docs/adr/0011), those would otherwise render as many
 * near-duplicate lines. Because this function doesn't surface the location
 * value, `groupEvolutionEdges` below can de-duplicate them for free by
 * comparing the rendered strings.
 */
export function describeEvolutionCondition(
  condition: EvolutionCondition,
  evolutionDictionary: EvolutionDictionary,
  locale: 'en' | 'es' = 'en',
): string {
  const c = evolutionDictionary.condition;
  const triggerLabels = evolutionDictionary.trigger as Record<string, string>;
  const triggerLabel = triggerLabels[condition.trigger] ?? evolutionDictionary.trigger.other;

  function itemName(slug: string): string {
    return localizedItemName(slug, locale) ?? humanizeSlug(slug);
  }

  const parts: string[] = [];
  if (condition.minLevel !== undefined) {
    parts.push(formatMessage(c.minLevel, { level: condition.minLevel }));
  }
  if (condition.itemSlug) parts.push(formatMessage(c.item, { item: itemName(condition.itemSlug) }));
  if (condition.heldItemSlug) {
    parts.push(formatMessage(c.heldItem, { item: itemName(condition.heldItemSlug) }));
  }
  if (condition.minHappiness !== undefined) {
    parts.push(formatMessage(c.minHappiness, { value: condition.minHappiness }));
  }
  if (condition.minBeauty !== undefined) {
    parts.push(formatMessage(c.minBeauty, { value: condition.minBeauty }));
  }
  if (condition.minAffection !== undefined) {
    parts.push(formatMessage(c.minAffection, { value: condition.minAffection }));
  }
  if (condition.timeOfDay === 'day') parts.push(c.timeOfDayDay);
  if (condition.timeOfDay === 'night') parts.push(c.timeOfDayNight);
  if (condition.knownMoveSlug) {
    parts.push(formatMessage(c.knownMove, { move: humanizeSlug(condition.knownMoveSlug) }));
  }
  if (condition.knownMoveTypeSlug) {
    parts.push(formatMessage(c.knownMoveType, { type: humanizeSlug(condition.knownMoveTypeSlug) }));
  }
  if (condition.locationSlug) parts.push(c.location);
  if (condition.gender === 1) parts.push(c.genderFemale);
  if (condition.gender === 2) parts.push(c.genderMale);
  if (condition.tradeSpeciesSlug) {
    parts.push(formatMessage(c.tradeFor, { species: humanizeSlug(condition.tradeSpeciesSlug) }));
  }
  if (condition.partySpeciesSlug) {
    parts.push(
      formatMessage(c.partySpecies, { species: humanizeSlug(condition.partySpeciesSlug) }),
    );
  }
  if (condition.needsOverworldRain) parts.push(c.needsOverworldRain);
  if (condition.turnUpsideDown) parts.push(c.turnUpsideDown);

  return parts.length > 0 ? `${triggerLabel} (${parts.join(', ')})` : triggerLabel;
}

export interface EvolutionEdgeGroup {
  fromSpeciesSlug: string;
  toSpeciesSlug: string;
  /** Deduplicated, rendered alternative methods for this one edge. */
  conditionDescriptions: string[];
}

/**
 * Groups raw edges by (from, to) and renders + deduplicates each one's
 * condition — collapsing PokéAPI's per-game-version location variants
 * (see `describeEvolutionCondition`) and surfacing genuinely distinct
 * alternative methods (e.g. Feebas: max Beauty, or trade holding Prism
 * Scale) as separate lines under the same edge.
 */
export function groupEvolutionEdges(
  edges: readonly EvolutionEdge[],
  evolutionDictionary: EvolutionDictionary,
  locale: 'en' | 'es' = 'en',
): EvolutionEdgeGroup[] {
  const groupByKey = new Map<string, EvolutionEdgeGroup>();
  for (const edge of edges) {
    const key = `${edge.fromSpeciesSlug}->${edge.toSpeciesSlug}`;
    const group = groupByKey.get(key) ?? {
      fromSpeciesSlug: edge.fromSpeciesSlug,
      toSpeciesSlug: edge.toSpeciesSlug,
      conditionDescriptions: [],
    };
    const description = describeEvolutionCondition(edge.condition, evolutionDictionary, locale);
    if (!group.conditionDescriptions.includes(description)) {
      group.conditionDescriptions.push(description);
    }
    groupByKey.set(key, group);
  }
  return [...groupByKey.values()];
}

export interface EvolutionParentGroup {
  fromSpeciesSlug: string;
  children: { toSpeciesSlug: string; conditionDescriptions: string[] }[];
}

/**
 * One level up from `groupEvolutionEdges`: groups every (from,to) edge group
 * sharing the same `fromSpeciesSlug` under one parent (Phase 1C.2b) — so a
 * branching family (Eevee: 8 targets) renders as one "Eevee" node fanning
 * out to 8 children, instead of repeating "Eevee →" once per row. A linear
 * chain (Bulbasaur -> Ivysaur -> Venusaur) is unaffected: each stage is
 * still its own parent group with exactly one child, because each has a
 * different `fromSpeciesSlug`.
 */
export function groupEvolutionsByParent(
  edges: readonly EvolutionEdge[],
  evolutionDictionary: EvolutionDictionary,
  locale: 'en' | 'es' = 'en',
): EvolutionParentGroup[] {
  const edgeGroups = groupEvolutionEdges(edges, evolutionDictionary, locale);
  const byParent = new Map<string, EvolutionParentGroup>();
  for (const edgeGroup of edgeGroups) {
    const parent = byParent.get(edgeGroup.fromSpeciesSlug) ?? {
      fromSpeciesSlug: edgeGroup.fromSpeciesSlug,
      children: [],
    };
    parent.children.push({
      toSpeciesSlug: edgeGroup.toSpeciesSlug,
      conditionDescriptions: edgeGroup.conditionDescriptions,
    });
    byParent.set(edgeGroup.fromSpeciesSlug, parent);
  }
  return [...byParent.values()];
}
