import type { Locale } from '@pokestudio/i18n';

/**
 * Damage Lab's own decimal formatting (task §16) — `Intl.NumberFormat`,
 * never a hardcoded `.` — so a Spanish reader sees "82,1%" (comma decimal
 * separator) the same way every other locale-aware number in a browser
 * would, not an English-formatted number under Spanish copy.
 */
const INTL_LOCALE: Record<Locale, string> = { en: 'en-US', es: 'es-ES' };

export function formatDecimal(locale: Locale, value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}
