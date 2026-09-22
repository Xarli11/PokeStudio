import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LocaleSwitcher } from './locale-switcher';

const mockUsePathname = vi.fn(() => '/en/battle/damage');
vi.mock('next/navigation', () => ({ usePathname: () => mockUsePathname() }));

afterEach(cleanup);
afterEach(() => {
  mockUsePathname.mockReturnValue('/en/battle/damage');
  window.history.pushState({}, '', '/');
});

describe('LocaleSwitcher', () => {
  it('preserves the current query string when switching locale (task §22 — general fix, not Damage Lab-specific)', async () => {
    window.history.pushState({}, '', '/en/battle/damage?team=abc&member=def');
    render(<LocaleSwitcher currentLocale="en" />);

    const esLink = await screen.findByRole('link', { name: 'ES' });
    expect(esLink.getAttribute('href')).toBe('/es/battle/damage?team=abc&member=def');
  });

  it('is a plain locale-prefix swap with no query string present', async () => {
    window.history.pushState({}, '', '/en/pokemon');
    mockUsePathname.mockReturnValue('/en/pokemon');
    render(<LocaleSwitcher currentLocale="en" />);

    const esLink = await screen.findByRole('link', { name: 'ES' });
    expect(esLink.getAttribute('href')).toBe('/es/pokemon');
  });
});
