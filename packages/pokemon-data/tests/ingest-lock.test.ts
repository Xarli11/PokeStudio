import { describe, expect, it } from 'vitest';

import { normalizePgConnectionStringForNodePg } from '../src/ingest-lock';

describe('normalizePgConnectionStringForNodePg', () => {
  it('A: adds uselibpqcompat=true to a bare sslmode=require URL', () => {
    const result = normalizePgConnectionStringForNodePg(
      'postgresql://user:pass@example.test/postgres?sslmode=require',
    );
    expect(result).toContain('sslmode=require');
    expect(result).toContain('uselibpqcompat=true');
  });

  it('B: does not duplicate an already-present uselibpqcompat=true', () => {
    const result = normalizePgConnectionStringForNodePg(
      'postgresql://user:pass@example.test/postgres?sslmode=require&uselibpqcompat=true',
    );
    expect(result.match(/uselibpqcompat=true/g)).toHaveLength(1);
  });

  it('C: leaves sslmode=verify-full exactly as-is (never degraded)', () => {
    const input = 'postgresql://user:pass@example.test/postgres?sslmode=verify-full';
    const result = normalizePgConnectionStringForNodePg(input);
    expect(result).toContain('sslmode=verify-full');
    expect(result).not.toContain('uselibpqcompat');
  });

  it('D: leaves a URL with no sslmode untouched', () => {
    const input = 'postgresql://user:pass@localhost:5432/postgres';
    const result = normalizePgConnectionStringForNodePg(input);
    expect(new URL(result).searchParams.has('uselibpqcompat')).toBe(false);
    expect(new URL(result).host).toBe(new URL(input).host);
    expect(new URL(result).pathname).toBe(new URL(input).pathname);
  });

  it('E: preserves other query parameters alongside sslmode=require', () => {
    const result = normalizePgConnectionStringForNodePg(
      'postgresql://user:pass@example.test/postgres?sslmode=require&application_name=pokestudio-ingest',
    );
    const parsed = new URL(result);
    expect(parsed.searchParams.get('application_name')).toBe('pokestudio-ingest');
    expect(parsed.searchParams.get('sslmode')).toBe('require');
    expect(parsed.searchParams.get('uselibpqcompat')).toBe('true');
  });
});
