import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getDictionary } from '@pokestudio/i18n';

import HomePage, { generateMetadata } from './page';
import { generateMetadata as generateLayoutMetadata } from './layout';

// The layout module calls next/font at import time, which only exists inside the Next compiler.
vi.mock('next/font/google', () => ({ Inter: () => ({ variable: '', className: '' }) }));

afterEach(cleanup);

async function renderHome(locale: 'es' | 'en') {
  render(await HomePage({ params: Promise.resolve({ locale }) }));
  return getDictionary(locale);
}

/** A pillar card is the link to its section that contains a heading (the hero CTA also links to Explore). */
function cardFor(locale: string, section: 'pokemon' | 'build' | 'battle'): HTMLAnchorElement {
  const card = [...document.querySelectorAll<HTMLAnchorElement>('a')].find(
    (a) => a.getAttribute('href') === `/${locale}/${section}` && a.querySelector('h3'),
  );
  if (!card) throw new Error(`no ${section} card`);
  return card;
}

describe('HomePage product status copy', () => {
  it.each([
    ['es', 'Explora Pokémon, construye equipos y analiza daño con las herramientas de PokeStudio.'],
    ['en', "Explore Pokémon, build teams, and analyze damage with PokeStudio's tools."],
  ] as const)(
    '%s: states what the user can do today, not that modules are under construction',
    async (locale, status) => {
      await renderHome(locale);
      expect(screen.getByText(status)).toBeTruthy();
      expect(document.body.textContent).not.toMatch(
        /en construcción|under (active )?construction/i,
      );
    },
  );

  it.each(['es', 'en'] as const)(
    '%s: no card is presented as coming soon; all three are links',
    async (locale) => {
      const dictionary = await renderHome(locale);
      expect(document.body.textContent).not.toMatch(/pronto|coming soon|\bsoon\b/i);
      expect(document.querySelector('[aria-disabled="true"]')).toBeNull();
      expect(cardFor(locale, 'build').querySelector('h3')?.textContent).toBe(dictionary.nav.build);
      expect(cardFor(locale, 'pokemon').querySelector('h3')?.textContent).toBe(
        dictionary.nav.explore,
      );
      expect(cardFor(locale, 'battle').querySelector('h3')?.textContent).toBe(
        dictionary.nav.battleLab,
      );
    },
  );

  it.each([
    ['es', 'Construye equipos, configura sets y prepara tus Pokémon para el combate.'],
    ['en', 'Build teams, configure sets, and prepare your Pokémon for battle.'],
  ] as const)('%s: the Build card makes no legality/format promise', async (locale, copy) => {
    await renderHome(locale);
    const card = cardFor(locale, 'build');
    expect(within(card).getByText(copy)).toBeTruthy();
    expect(card.textContent).not.toMatch(/legal|formato|format/i);
  });

  it.each([
    [
      'es',
      'Calcula daño, compara enfrentamientos y entiende qué factores afectan a cada resultado.',
    ],
    ['en', 'Calculate damage, compare matchups, and understand the factors behind each result.'],
  ] as const)(
    '%s: the Battle Lab card only describes shipped Damage Lab capabilities',
    async (locale, copy) => {
      await renderHome(locale);
      const card = cardFor(locale, 'battle');
      expect(within(card).getByText(copy)).toBeTruthy();
      expect(card.textContent).not.toMatch(
        /simul|\bIA\b|\bAI\b|Cynthia|traza|trace|replay|VGC|coaching/i,
      );
    },
  );

  it.each([
    ['es', 'Explorar Pokémon'],
    ['en', 'Explore Pokémon'],
  ] as const)('%s: the CTA label matches its destination (Explore)', async (locale, label) => {
    await renderHome(locale);
    const cta = [...document.querySelectorAll<HTMLAnchorElement>('a')].find(
      (a) => a.getAttribute('href') === `/${locale}/pokemon` && !a.querySelector('h3'),
    );
    expect(cta?.textContent).toBe(`${label} →`);
    expect(document.body.textContent).not.toMatch(/hoja de ruta|roadmap/i);
  });
});

describe('home metadata describes what exists today', () => {
  const FUTURE_PROMISES = /simul|combate\.|battle\.|mejora|improve|colecciona|collect/i;

  it.each([
    ['es', 'Explora Pokémon, construye equipos y analiza daño con las herramientas de PokeStudio.'],
    ['en', "Explore Pokémon, build teams, and analyze damage with PokeStudio's tools."],
  ] as const)('%s: description and OpenGraph use the factual copy', async (locale, description) => {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale }) });
    expect(metadata.description).toBe(description);
    expect(metadata.openGraph?.description).toBe(description);
    expect(metadata.description).not.toMatch(FUTURE_PROMISES);
    // Unrelated fields are untouched.
    expect(metadata.title).toBe('PokeStudio');
    expect(metadata.alternates?.canonical).toBe(`/${locale}`);
  });

  it.each(['es', 'en'] as const)(
    '%s: the site-wide default description also stops using the aspirational tagline',
    async (locale) => {
      const dictionary = getDictionary(locale);
      const metadata = await generateLayoutMetadata({ params: Promise.resolve({ locale }) });
      expect(metadata.description).toBe(dictionary.home.metaDescription);
      expect(metadata.description).not.toBe(dictionary.home.tagline);
    },
  );

  it.each(['es', 'en'] as const)(
    '%s: the visible tagline is unchanged (product vision)',
    (locale) => {
      expect(getDictionary(locale).home.tagline).toBe(
        locale === 'es'
          ? 'Busca. Aprende. Construye. Simula. Combate. Analiza. Mejora. Colecciona.'
          : 'Search. Learn. Build. Simulate. Battle. Analyze. Improve. Collect.',
      );
    },
  );
});
