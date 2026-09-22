import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getDictionary } from '@pokestudio/i18n';

import { PersistentShell } from './persistent-shell';

// LocaleSwitcher (rendered inside PersistentShell) calls usePathname(), which
// has no real Next.js router to read from in this unit-test environment.
// A `vi.fn()` (not a fixed return) so individual tests can point it at a
// different route to exercise `currentSectionFor()`'s branches. Prefixed
// `mock` — Vitest's hoisting rule for names a `vi.mock` factory may close over.
const mockUsePathname = vi.fn(() => '/en/pokemon');
vi.mock('next/navigation', () => ({ usePathname: () => mockUsePathname() }));

afterEach(cleanup);
afterEach(() => mockUsePathname.mockReturnValue('/en/pokemon'));

describe('PersistentShell nav', () => {
  it('shows the Spanish product section name "Equipo" (not the literal verb "Construir")', () => {
    render(
      <PersistentShell locale="es" dictionary={getDictionary('es')}>
        <div />
      </PersistentShell>,
    );
    expect(screen.queryByText('Equipo')).not.toBeNull();
    expect(screen.queryByText('Construir')).toBeNull();
  });

  it('shows the English product section name "Build"', () => {
    render(
      <PersistentShell locale="en" dictionary={getDictionary('en')}>
        <div />
      </PersistentShell>,
    );
    expect(screen.queryByText('Build')).not.toBeNull();
  });

  it('Battle Lab is a real link, not the disabled "Soon" placeholder (Fase M3.1B)', () => {
    render(
      <PersistentShell locale="en" dictionary={getDictionary('en')}>
        <div />
      </PersistentShell>,
    );
    const link = screen.getByRole('link', { name: 'Battle Lab' });
    expect(link.getAttribute('href')).toBe('/en/battle');
    expect(screen.queryByText('Soon')).toBeNull();
  });

  it('/battle marks Battle Lab as the current section (aria-current, active underline)', () => {
    mockUsePathname.mockReturnValue('/en/battle');
    render(
      <PersistentShell locale="en" dictionary={getDictionary('en')}>
        <div />
      </PersistentShell>,
    );
    expect(screen.getByRole('link', { name: 'Battle Lab' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(screen.getByRole('link', { name: 'Build' }).getAttribute('aria-current')).toBeNull();
  });

  it('/battle/damage (a nested route) still marks Battle Lab as current', () => {
    mockUsePathname.mockReturnValue('/en/battle/damage');
    render(
      <PersistentShell locale="en" dictionary={getDictionary('en')}>
        <div />
      </PersistentShell>,
    );
    expect(screen.getByRole('link', { name: 'Battle Lab' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('/es/battle marks Battle Lab as current in Spanish too', () => {
    mockUsePathname.mockReturnValue('/es/battle');
    render(
      <PersistentShell locale="es" dictionary={getDictionary('es')}>
        <div />
      </PersistentShell>,
    );
    const link = screen.getByRole('link', { name: 'Laboratorio de Combate' });
    expect(link.getAttribute('href')).toBe('/es/battle');
    expect(link.getAttribute('aria-current')).toBe('page');
  });
});
