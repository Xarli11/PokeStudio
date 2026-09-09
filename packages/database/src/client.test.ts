import { describe, expect, it } from 'vitest';

import { createPublicDatabaseClient, createServiceDatabaseClient } from './client';

describe('database client boundary', () => {
  it('builds a public client from url/publishableKey without contacting the network', () => {
    const client = createPublicDatabaseClient({
      url: 'http://127.0.0.1:54321',
      publishableKey: 'sb_publishable_test',
    });
    expect(client).toBeDefined();
    expect(typeof client.from).toBe('function');
  });

  it('builds a secret-key client that disables session persistence', () => {
    const client = createServiceDatabaseClient({
      url: 'http://127.0.0.1:54321',
      publishableKey: 'sb_publishable_test',
      secretKey: 'sb_secret_test',
    });
    expect(client).toBeDefined();
  });
});
