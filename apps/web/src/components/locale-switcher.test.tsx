import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LOCALE_CHANGE_EVENT } from '@/lib/locale-navigation';

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

  it('dispatches LOCALE_CHANGE_EVENT with the destination href on a plain same-tab click, never on a modifier-key click', () => {
    window.history.pushState({}, '', '/en/battle/damage');
    const listener = vi.fn();
    window.addEventListener(LOCALE_CHANGE_EVENT, listener);
    render(<LocaleSwitcher currentLocale="en" />);

    // Opens in a new tab/window — must not save a handoff this tab never consumes.
    fireEvent.click(screen.getByRole('link', { name: 'ES' }), { ctrlKey: true });
    expect(listener).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('link', { name: 'ES' }));
    expect(listener).toHaveBeenCalledOnce();
    expect((listener.mock.calls[0]![0] as CustomEvent<string>).detail).toBe('/es/battle/damage');

    window.removeEventListener(LOCALE_CHANGE_EVENT, listener);
  });

  it('does not dispatch when clicking the already-active locale', () => {
    window.history.pushState({}, '', '/en/battle/damage');
    const listener = vi.fn();
    window.addEventListener(LOCALE_CHANGE_EVENT, listener);
    render(<LocaleSwitcher currentLocale="en" />);

    fireEvent.click(screen.getByRole('link', { name: 'EN' }));
    expect(listener).not.toHaveBeenCalled();

    window.removeEventListener(LOCALE_CHANGE_EVENT, listener);
  });
});
