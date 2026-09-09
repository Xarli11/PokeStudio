import en from './locales/en.json' with { type: 'json' };
import es from './locales/es.json' with { type: 'json' };

/** Locales supported from Phase 0 onward. Extend this list to add a language. */
export const locales = ['en', 'es'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export type Dictionary = typeof en;

const dictionaries: Record<Locale, Dictionary> = { en, es };

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export { formatMessage } from './format';
