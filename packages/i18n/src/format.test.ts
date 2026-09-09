import { describe, expect, it } from 'vitest';

import { formatMessage } from './format';

describe('formatMessage', () => {
  it('substitutes known placeholders', () => {
    expect(formatMessage('{name} has {count} forms', { name: 'Rotom', count: 6 })).toBe(
      'Rotom has 6 forms',
    );
  });

  it('leaves unknown placeholders untouched', () => {
    expect(formatMessage('Hello {name}', {})).toBe('Hello {name}');
  });

  it('substitutes the same placeholder repeated multiple times', () => {
    expect(formatMessage('{n} + {n}', { n: 2 })).toBe('2 + 2');
  });
});
