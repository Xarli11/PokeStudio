import { cookies } from 'next/headers';

import { defaultLocale, getDictionary, isLocale } from '@pokestudio/i18n';

/**
 * A light placeholder while `listSpeciesPage` resolves (Part K) — not a
 * full skeleton mirroring every card, just enough shape to avoid a blank
 * page. `loading.tsx` gets no route params, so the locale comes from the
 * `NEXT_LOCALE` cookie the middleware/locale switcher already set.
 */
export default async function Loading() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : defaultLocale;
  const dictionary = getDictionary(locale);

  return (
    <div
      aria-live="polite"
      aria-busy="true"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ps-space-6)' }}
    >
      <span className="ps-visually-hidden">{dictionary.pokedex.loading}</span>
      <div className="ps-skeleton" style={{ height: '2rem', width: '10rem' }} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 'var(--ps-space-3)',
        }}
      >
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="ps-skeleton" style={{ height: '88px' }} />
        ))}
      </div>
    </div>
  );
}
