import { describe, expect, it } from 'vitest';

import { mapWithConcurrency } from './concurrency';

describe('mapWithConcurrency', () => {
  it('preserves result order regardless of completion order', async () => {
    const delays = [30, 10, 20, 5, 25];
    const results = await mapWithConcurrency(delays, 3, async (delay, i) => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return i;
    });
    expect(results).toEqual([0, 1, 2, 3, 4]);
  });

  it('never runs more than `limit` items concurrently', async () => {
    let active = 0;
    let maxActive = 0;
    const items = Array.from({ length: 12 }, (_, i) => i);

    await mapWithConcurrency(items, 4, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
    });

    expect(maxActive).toBeLessThanOrEqual(4);
  });

  it('handles an empty input', async () => {
    expect(await mapWithConcurrency([], 5, async (x) => x)).toEqual([]);
  });
});
