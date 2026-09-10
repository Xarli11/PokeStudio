import { cookies } from 'next/headers';

import { defaultLocale, getDictionary, isLocale } from '@pokestudio/i18n';

/** A light placeholder while species/evolution data resolves (Part K) — see `pokemon/loading.tsx`. */
export default async function Loading() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : defaultLocale;
  const dictionary = getDictionary(locale);

  return (
    <div
      aria-live="polite"
      aria-busy="true"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ps-space-5)' }}
    >
      <span className="ps-visually-hidden">{dictionary.pokedex.loading}</span>
      <div className="ps-skeleton" style={{ height: '1rem', width: '7rem' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ps-space-4)' }}>
        <div
          className="ps-skeleton"
          style={{ height: '72px', width: '72px', borderRadius: '9999px' }}
        />
        <div className="ps-skeleton" style={{ height: '2rem', width: '12rem' }} />
      </div>
      <div className="ps-skeleton" style={{ height: '160px' }} />
      <div className="ps-skeleton" style={{ height: '100px' }} />
    </div>
  );
}
