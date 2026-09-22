import { beforeEach, describe, expect, it } from 'vitest';

import { createDefaultAdvancedConfig } from '@/lib/damage-advanced';

import {
  saveDamageLocaleHandoff,
  takeDamageLocaleHandoff,
  type DamageLocaleDraft,
} from './damage-locale-handoff';

const STORAGE_KEY = 'pokestudio:damage-locale-handoff';

beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState({}, '', '/es/battle/damage');
});

function makeDraft(): DamageLocaleDraft {
  return {
    versionGroupSlug: 'scarlet-violet',
    attackerFormSlug: 'charizard',
    defenderFormSlug: 'pikachu',
    selectedMoveSlug: 'flamethrower',
    attackerConfig: createDefaultAdvancedConfig(),
    defenderConfig: createDefaultAdvancedConfig(),
    isCritical: true,
  };
}

describe('damage-locale-handoff', () => {
  it('round-trips a full draft (Tera, EVs, IVs) exactly once, with no shared references', () => {
    const original = makeDraft();
    original.attackerConfig.teraEnabled = true;
    original.attackerConfig.teraType = 'fire';
    original.attackerConfig.evs.attack = 252;

    saveDamageLocaleHandoff('/es/battle/damage', original);
    const restored = takeDamageLocaleHandoff();

    expect(restored).toEqual(original);
    expect(restored?.attackerConfig.evs).not.toBe(original.attackerConfig.evs);
    // Read-once: gone after the first take.
    expect(takeDamageLocaleHandoff()).toBeNull();
  });

  it('refuses to restore when the current URL does not match the saved target exactly', () => {
    saveDamageLocaleHandoff('/es/battle/damage?team=a&member=b', makeDraft());
    // beforeEach set the URL to plain '/es/battle/damage', no query — mismatch.
    expect(takeDamageLocaleHandoff()).toBeNull();
  });

  it('treats an expired handoff as absent', () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ target: '/es/battle/damage', expires: Date.now() - 1, draft: makeDraft() }),
    );
    expect(takeDamageLocaleHandoff()).toBeNull();
  });

  it('discards malformed JSON without throwing', () => {
    sessionStorage.setItem(STORAGE_KEY, '{not valid json');
    expect(() => takeDamageLocaleHandoff()).not.toThrow();
    expect(takeDamageLocaleHandoff()).toBeNull();
  });

  it('rejects a draft with an invalid Advanced config shape', () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        target: '/es/battle/damage',
        expires: Date.now() + 1000,
        draft: { ...makeDraft(), attackerConfig: { level: 50 } },
      }),
    );
    expect(takeDamageLocaleHandoff()).toBeNull();
  });

  it('rejects a stray value with the right shape but an invalid Tera type', () => {
    const bad = makeDraft();
    (bad.attackerConfig as { teraType: unknown }).teraType = 'not-a-real-type';
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ target: '/es/battle/damage', expires: Date.now() + 1000, draft: bad }),
    );
    expect(takeDamageLocaleHandoff()).toBeNull();
  });

  it('a failed sessionStorage write never throws (private mode / quota)', () => {
    const original = sessionStorage.setItem;
    sessionStorage.setItem = () => {
      throw new Error('quota exceeded');
    };
    expect(() => saveDamageLocaleHandoff('/es/battle/damage', makeDraft())).not.toThrow();
    sessionStorage.setItem = original;
  });
});
