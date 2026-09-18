import { cookies } from 'next/headers';

import { defaultLocale, getDictionary, isLocale } from '@pokelab/i18n';

import { Skeleton } from '@/components/ui/skeleton';

/** A light placeholder while `listAbilities` resolves — same shape as `pokemon/loading.tsx`/`moves/loading.tsx`. */
export default async function Loading() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : defaultLocale;
  const dictionary = getDictionary(locale);

  return (
    <div aria-live="polite" aria-busy="true" className="mx-auto flex max-w-wide flex-col gap-8">
      <span className="sr-only">{dictionary.pokedex.loading}</span>
      <Skeleton className="h-8 w-40 rounded-md" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        {Array.from({ length: 9 }).map((_, index) => (
          <Skeleton key={index} className="h-16 rounded-md" />
        ))}
      </div>
    </div>
  );
}
