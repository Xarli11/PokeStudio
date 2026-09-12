import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getDictionary } from '@pokestudio/i18n';

import { PersistentShell } from './persistent-shell';

// LocaleSwitcher (rendered inside PersistentShell) calls usePathname(), which
// has no real Next.js router to read from in this unit-test environment.
vi.mock('next/navigation', () => ({ usePathname: () => '/en/pokemon' }));

afterEach(cleanup);

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
});
