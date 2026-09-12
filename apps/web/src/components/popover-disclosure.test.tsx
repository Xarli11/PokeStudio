import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PopoverDisclosure } from './popover-disclosure';

afterEach(cleanup);

describe('PopoverDisclosure', () => {
  it('is closed by default and opens the panel on trigger click', () => {
    render(
      <PopoverDisclosure trigger="3 games">
        <p>Scarlet / Violet</p>
      </PopoverDisclosure>,
    );
    expect(screen.queryByText('Scarlet / Violet')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '3 games' }));
    expect(screen.queryByText('Scarlet / Violet')).not.toBeNull();
  });

  it('sets aria-expanded to reflect open state', () => {
    render(
      <PopoverDisclosure trigger="3 games">
        <p>content</p>
      </PopoverDisclosure>,
    );
    const trigger = screen.getByRole('button', { name: '3 games' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('closes on outside click', () => {
    render(
      <div>
        <PopoverDisclosure trigger="3 games">
          <p>content</p>
        </PopoverDisclosure>
        <button type="button">outside</button>
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: '3 games' }));
    expect(screen.queryByText('content')).not.toBeNull();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByText('content')).toBeNull();
  });

  it('closes on Escape and returns focus to the trigger', () => {
    render(
      <PopoverDisclosure trigger="3 games">
        <p>content</p>
      </PopoverDisclosure>,
    );
    const trigger = screen.getByRole('button', { name: '3 games' });
    fireEvent.click(trigger);
    expect(screen.queryByText('content')).not.toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('content')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('toggles closed when the trigger is clicked again', () => {
    render(
      <PopoverDisclosure trigger="3 games">
        <p>content</p>
      </PopoverDisclosure>,
    );
    const trigger = screen.getByRole('button', { name: '3 games' });
    fireEvent.click(trigger);
    expect(screen.queryByText('content')).not.toBeNull();
    fireEvent.click(trigger);
    expect(screen.queryByText('content')).toBeNull();
  });

  it('uses triggerAriaLabel as the accessible name when provided', () => {
    render(
      <PopoverDisclosure trigger="3 games" triggerAriaLabel="Show all 3 games">
        <p>content</p>
      </PopoverDisclosure>,
    );
    expect(screen.getByRole('button', { name: 'Show all 3 games' })).not.toBeNull();
  });
});
