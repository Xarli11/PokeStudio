import { describe, expect, it } from 'vitest';

import { createPublicDatabaseClient, createServiceDatabaseClient } from './client';

describe('database client boundary', () => {
  it('builds a public client from url/anonKey without contacting the network', () => {
    const client = createPublicDatabaseClient({
      url: 'http://127.0.0.1:54321',
      anonKey: 'test-anon-key',
    });
    expect(client).toBeDefined();
    expect(typeof client.from).toBe('function');
  });

  it('builds a service-role client that disables session persistence', () => {
    const client = createServiceDatabaseClient({
      url: 'http://127.0.0.1:54321',
      anonKey: 'test-anon-key',
      serviceRoleKey: 'test-service-key',
    });
    expect(client).toBeDefined();
  });
});
