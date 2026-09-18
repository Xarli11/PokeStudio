import { formatMessage, type Dictionary, type Locale } from '@pokelab/i18n';
import type { MoveStat } from '@pokelab/pokemon-data';

import { ailmentFallbackLabel, ailmentPhrasing } from './move-ailment-label';

export interface MoveMechanicsInput {
  /** PokéAPI's raw move target slug (e.g. "user", "selected-pokemon") — needed to resolve stat-change direction, not just for display. */
  target: string;
  category?: string | undefined;
  statChanges: { stat: MoveStat; change: number }[];
  statChance: number;
  ailment?: string | undefined;
  ailmentChance: number;
  flinchChance: number;
  drain: number;
  healing: number;
  minHits?: number | undefined;
  maxHits?: number | undefined;
  minTurns?: number | undefined;
  maxTurns?: number | undefined;
  /** PokéAPI's `move.meta.crit_rate` — added critical-hit stages (0 = normal rate; almost always 1 in practice, e.g. Slash/Crabhammer). */
  critRate: number;
}

/**
 * Resolves whether a move's stat_changes apply to the user (self) or the
 * target, verified against real PokéAPI data (Phase 1C.2c task §B) rather
 * than guessed: category "damage-raise" always modifies the USER's own
 * stat even when the move's own `target` is "selected-pokemon"/
 * "all-opponents" — e.g. Superpower/Close Combat lower the user's own
 * Attack/Defense despite hitting the opponent, and Steel Wing/Rapid Spin/
 * Metal Claw raise the user's own stat the same way. Every other category
 * (net-good-stats, damage-lower, swagger, unique, ...) follows the move's
 * own `target` field literally in every sampled case (Growl/Charm/Tickle
 * debuff the opponent with target≠"user"; Swords Dance/Shell Smash/
 * Stockpile buff the user with target="user").
 */
function statChangeDirection(category: string | undefined, target: string): 'self' | 'target' {
  if (category === 'damage-raise') return 'self';
  return target === 'user' ? 'self' : 'target';
}

function stagesLabel(magnitude: number, dictionary: Dictionary): string {
  const m = dictionary.moves.mechanics;
  return magnitude === 1 ? m.stageSingular : formatMessage(m.stagePlural, { count: magnitude });
}

function statChangeLine(
  statChange: { stat: MoveStat; change: number },
  move: Pick<MoveMechanicsInput, 'category' | 'target' | 'statChance'>,
  dictionary: Dictionary,
): string {
  const m = dictionary.moves.mechanics;
  const direction = statChangeDirection(move.category, move.target);
  const raises = statChange.change > 0;
  const stat = dictionary.moves.stat[statChange.stat];
  const stages = stagesLabel(Math.abs(statChange.change), dictionary);

  if (move.statChance > 0) {
    const clauseTemplate =
      direction === 'self'
        ? raises
          ? m.statChangeRaiseSelfClause
          : m.statChangeLowerSelfClause
        : raises
          ? m.statChangeRaiseTargetClause
          : m.statChangeLowerTargetClause;
    const clause = formatMessage(clauseTemplate, { stat, stages });
    return formatMessage(m.hasChanceTo, { chance: move.statChance, clause });
  }

  const template =
    direction === 'self'
      ? raises
        ? m.statChangeRaiseSelf
        : m.statChangeLowerSelf
      : raises
        ? m.statChangeRaiseTarget
        : m.statChangeLowerTarget;
  return formatMessage(template, { stat, stages });
}

function ailmentLine(
  ailment: string,
  ailmentChance: number,
  dictionary: Dictionary,
  locale: Locale,
): string {
  const m = dictionary.moves.mechanics;
  const phrasing = ailmentPhrasing(ailment, locale);

  if (ailmentChance > 0) {
    if (phrasing)
      return formatMessage(m.hasChanceTo, { chance: ailmentChance, clause: phrasing.chanceClause });
    return formatMessage(m.ailmentChanceGeneric, {
      chance: ailmentChance,
      ailment: ailmentFallbackLabel(ailment),
    });
  }

  if (phrasing) return `${phrasing.guaranteedClause}.`;
  return formatMessage(m.ailmentGuaranteedGeneric, { ailment: ailmentFallbackLabel(ailment) });
}

/**
 * Turns a move's structured mechanical fields into localized, exact
 * technical sentences (Phase 1C.2c task §E) — deterministic, one bullet per
 * mechanic actually present, never inferring or inventing a value. The
 * structured fields themselves (not this derived text) remain the source of
 * truth for any future consumer (Team Builder, Damage Lab, Battle Lab —
 * task §D); this is a display-only convenience for the current UI.
 */
export function describeMoveMechanics(
  move: MoveMechanicsInput,
  dictionary: Dictionary,
  locale: Locale,
): string[] {
  const m = dictionary.moves.mechanics;
  const lines: string[] = [];

  for (const statChange of move.statChanges) {
    lines.push(statChangeLine(statChange, move, dictionary));
  }

  if (move.ailment && move.ailment !== 'none' && move.ailment !== 'unknown') {
    lines.push(ailmentLine(move.ailment, move.ailmentChance, dictionary, locale));
  }

  if (move.flinchChance > 0) {
    lines.push(formatMessage(m.flinchChance, { chance: move.flinchChance }));
  }

  if (move.drain > 0) {
    lines.push(formatMessage(m.drain, { percent: move.drain }));
  } else if (move.drain < 0) {
    lines.push(formatMessage(m.recoil, { percent: Math.abs(move.drain) }));
  }

  if (move.healing > 0) {
    lines.push(formatMessage(m.healing, { percent: move.healing }));
  }

  if (move.minHits !== undefined && move.maxHits !== undefined) {
    lines.push(
      move.minHits === move.maxHits
        ? formatMessage(m.hitsExact, { count: move.minHits })
        : formatMessage(m.hitsRange, { min: move.minHits, max: move.maxHits }),
    );
  }

  if (move.minTurns !== undefined && move.maxTurns !== undefined) {
    lines.push(
      move.minTurns === move.maxTurns
        ? formatMessage(m.turnsExact, { count: move.minTurns })
        : formatMessage(m.turnsRange, { min: move.minTurns, max: move.maxTurns }),
    );
  }

  if (move.critRate > 0) {
    lines.push(m.critRate);
  }

  return lines;
}

/**
 * Whether the move detail page's "Description" section should render at
 * all (Phase 1C.2 polish, task §6). A missing prose description never
 * implies PokeLab knows nothing about the move — when structured
 * technical effects exist, showing an empty "Description not available"
 * block above them just reads as broken for no reason, so it's omitted
 * and the technical effects carry the page instead. Only shown (with the
 * honest fallback message) when there's truly nothing else to say about
 * the move — never invents prose either way.
 */
export function shouldShowMoveDescription(
  effect: string | undefined,
  mechanicsLineCount: number,
): boolean {
  return effect !== undefined || mechanicsLineCount === 0;
}
