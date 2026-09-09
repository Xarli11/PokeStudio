/**
 * Bounded-concurrency map (Phase 1B, §7): runs `fn` over `items` with at most
 * `limit` in flight at once — avoids both "thousands of sequential requests"
 * and "thousands of simultaneous requests" against PokéAPI. Deliberately a
 * ~15-line worker-pool, not a dependency: this is ingestion tooling, not a
 * job queue.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index]!, index);
    }
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}
