import type { Locale } from '@pokelab/i18n';

/**
 * Hand-verified phrasing for the small set of well-known status ailments
 * (Phase 1C.2c task §C/§E) — same "never guess, verify by hand" approach as
 * `evolution-item-label.ts`'s evolution-stone table. `chanceClause` is a
 * lowercase infinitive clause with no trailing period (composed into "Has a
 * {chance}% chance to {clause}."); `guaranteedClause` is the capitalized,
 * conjugated standalone form (composed into "{guaranteedClause}."). PokéAPI
 * has ~18 distinct ailment values in the real dataset; anything not listed
 * here (leech-seed, trap, disable, ...) falls back to a generic
 * noun-based sentence built from the ailment's own slug — deliberately never
 * guessed, matching the evolution-item-label precedent.
 */
interface AilmentPhrasing {
  chanceClause: string;
  guaranteedClause: string;
}

const AILMENT_PHRASING_EN: Partial<Record<string, AilmentPhrasing>> = {
  burn: { chanceClause: 'burn the target', guaranteedClause: 'Burns the target' },
  freeze: { chanceClause: 'freeze the target', guaranteedClause: 'Freezes the target' },
  paralysis: { chanceClause: 'paralyze the target', guaranteedClause: 'Paralyzes the target' },
  poison: { chanceClause: 'poison the target', guaranteedClause: 'Poisons the target' },
  sleep: { chanceClause: 'put the target to sleep', guaranteedClause: 'Puts the target to sleep' },
  confusion: { chanceClause: 'confuse the target', guaranteedClause: 'Confuses the target' },
};

const AILMENT_PHRASING_ES: Partial<Record<string, AilmentPhrasing>> = {
  burn: { chanceClause: 'quemar al objetivo', guaranteedClause: 'Quema al objetivo' },
  freeze: { chanceClause: 'congelar al objetivo', guaranteedClause: 'Congela al objetivo' },
  paralysis: { chanceClause: 'paralizar al objetivo', guaranteedClause: 'Paraliza al objetivo' },
  poison: { chanceClause: 'envenenar al objetivo', guaranteedClause: 'Envenena al objetivo' },
  sleep: { chanceClause: 'dormir al objetivo', guaranteedClause: 'Duerme al objetivo' },
  confusion: { chanceClause: 'confundir al objetivo', guaranteedClause: 'Confunde al objetivo' },
};

export function ailmentPhrasing(ailment: string, locale: Locale): AilmentPhrasing | undefined {
  return locale === 'es' ? AILMENT_PHRASING_ES[ailment] : AILMENT_PHRASING_EN[ailment];
}

/** Honest English-slug-derived fallback for an ailment with no hand-verified phrasing (never machine-translated) — same pattern as `evolution-item-label.ts`'s unmapped-item fallback. */
export function ailmentFallbackLabel(ailment: string): string {
  return ailment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
