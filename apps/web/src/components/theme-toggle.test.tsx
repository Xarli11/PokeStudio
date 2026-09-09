import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ThemeToggle } from './theme-toggle';

const labels = { toggle: 'Toggle theme', light: 'Light', dark: 'Dark' };

describe('ThemeToggle', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    window.localStorage.clear();
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
  });

  it('toggles the data-theme attribute and persists the choice', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    render(<ThemeToggle labels={labels} />);

    fireEvent.click(screen.getByRole('button', { name: labels.toggle }));

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(window.localStorage.getItem('pokestudio-theme')).toBe('light');
  });
});
