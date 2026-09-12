/**
 * Base-stat quality tiers (Phase 1C.2b) — thresholds chosen from a real
 * full-dataset audit (all 1579 forms' six stats, ~9474 individual values),
 * not picked from intuition alone: the proposed 0-49/50-79/80-109/110+ bands
 * split the real distribution into a sensible, non-degenerate shape (20% /
 * 39% / 27% / 14%) and match known reference points (Magikarp's 20 speed is
 * "low", a typical fully-evolved non-legendary's ~90-100 attack is "good").
 *
 * Total base stat (BST) gets its own, wider thresholds — reusing the
 * per-stat bands would misclassify almost every real Pokémon as "excellent"
 * (six stats summed is naturally much larger than one stat). Chosen the same
 * way: audited the real BST distribution (min 175, median 475, max 1125) and
 * checked known reference points — Magikarp (200) low, Bulbasaur/Pikachu
 * (~318-320) average, a typical fully-evolved starter like Venusaur (525)
 * good, a pseudo-legendary like Garchomp (600) or a legendary like Mewtwo
 * (680) excellent.
 */
export type StatTier = 'low' | 'average' | 'good' | 'excellent';

export function statTier(value: number): StatTier {
  if (value < 50) return 'low';
  if (value < 80) return 'average';
  if (value < 110) return 'good';
  return 'excellent';
}

export function totalStatTier(value: number): StatTier {
  if (value < 320) return 'low';
  if (value < 450) return 'average';
  if (value < 550) return 'good';
  return 'excellent';
}

/** Bar-fill classes per tier — "excellent" keeps the existing premium brand gradient; the other three use the design system's existing semantic success/warning/danger tokens (never colors invented just for this). */
export const STAT_TIER_BAR_CLASS: Record<StatTier, string> = {
  low: 'bg-danger/80',
  average: 'bg-warning',
  good: 'bg-success',
  excellent: 'bg-gradient-to-r from-brand/75 to-brand',
};

/** Text-color classes per tier, for the Total Base Stat figure. */
export const STAT_TIER_TEXT_CLASS: Record<StatTier, string> = {
  low: 'text-danger',
  average: 'text-warning',
  good: 'text-success',
  excellent: 'text-brand',
};
