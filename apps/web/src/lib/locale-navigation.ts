/**
 * Fired on `window` by `LocaleSwitcher` right before a genuine same-tab
 * locale navigation (never on a modifier-key click that opens a new tab) —
 * `detail` is the destination `pathname + search`. A generic signal, not
 * Damage-Lab-specific: `LocaleSwitcher` only broadcasts that a locale
 * change is about to happen and where to; any page that cares about
 * preserving its own ephemeral state listens for this and decides what
 * (if anything) to do with it. Damage Lab is the first, and so far only,
 * listener (`damage-locale-handoff.ts`).
 */
export const LOCALE_CHANGE_EVENT = 'pokestudio:locale-change';
