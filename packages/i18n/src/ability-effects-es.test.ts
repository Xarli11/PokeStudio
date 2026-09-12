import { describe, expect, it } from 'vitest';

import { abilityEffectsEs } from './ability-effects-es';

/**
 * Internal invariants only — no live DB access here (packages/i18n has no
 * Supabase dependency by design). The "313/313 against the real ingested
 * ability list, no orphan keys" cross-check lives in
 * packages/database/tests/ability-effects-coverage.integration.test.ts,
 * which can actually query the live `ability` table.
 */
describe('abilityEffectsEs', () => {
  const entries = Object.entries(abilityEffectsEs);

  it('has 313 entries — the known full-dataset ability count (docs/adr/0011)', () => {
    expect(entries.length).toBe(313);
  });

  it('every key looks like a real PokéAPI ability slug (lowercase, hyphen-separated, never a display name)', () => {
    for (const key of Object.keys(abilityEffectsEs)) {
      expect(key).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('has no empty or whitespace-only values', () => {
    for (const [key, value] of entries) {
      expect(value.trim().length, `${key} has an empty translation`).toBeGreaterThan(0);
    }
  });

  it('has no duplicate keys (a duplicate object-literal key would silently keep only the last one)', () => {
    const keys = Object.keys(abilityEffectsEs);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('preserves exact mechanics for representative, mechanically complicated abilities', () => {
    // Percentage chance.
    expect(abilityEffectsEs['static']).toMatch(/30 ?%/);
    // Stat stages, explicit and numeric (never a vague "raises").
    expect(abilityEffectsEs['beast-boost']).toMatch(/1 nivel/);
    expect(abilityEffectsEs['moody']).toMatch(/2 niveles/);
    // HP threshold fraction.
    expect(abilityEffectsEs['blaze']).toMatch(/1\/3/);
    // Weather/terrain interaction.
    expect(abilityEffectsEs['drought']).toMatch(/sol intenso/);
    expect(abilityEffectsEs['electric-surge']).toMatch(/Campo Eléctrico/);
    // Immunity, stated as such.
    expect(abilityEffectsEs['levitate']).toMatch(/[Ee]squiva/);
    expect(abilityEffectsEs['water-veil']).toMatch(/[Ii]mpide/);
    // Once-per-battle / conditional activation, not glossed over as unconditional.
    expect(abilityEffectsEs['supersweet-syrup']).toMatch(/[Uu]na vez por combate/);
    expect(abilityEffectsEs['perish-body']).toMatch(/tres turnos/);
  });
});
