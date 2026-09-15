import { describe, expect, it } from 'vitest';

import { resolveBuildGameCapabilities } from './build-game-capabilities';

describe('resolveBuildGameCapabilities', () => {
  it('Scarlet/Violet: full modern mechanics, Tera, fully validated', () => {
    const caps = resolveBuildGameCapabilities({ slug: 'scarlet-violet', generation: 9 });
    expect(caps).toMatchObject({
      abilities: true,
      natures: true,
      heldItems: true,
      modernEvsIvs: true,
      tera: true,
      dynamax: false,
      megaEvolution: false,
      zMoves: false,
      specialRuleset: null,
      statModel: 'modern',
      fullyValidated: true,
    });
  });

  it('Sword/Shield: modern mechanics, Dynamax, no Tera', () => {
    const caps = resolveBuildGameCapabilities({ slug: 'sword-shield', generation: 8 });
    expect(caps).toMatchObject({
      abilities: true,
      natures: true,
      heldItems: true,
      modernEvsIvs: true,
      tera: false,
      dynamax: true,
      megaEvolution: false,
      zMoves: false,
      statModel: 'modern',
      fullyValidated: true,
    });
  });

  it('Emerald: modern mechanics, no Tera/Dynamax/Mega/Z-Moves', () => {
    const caps = resolveBuildGameCapabilities({ slug: 'emerald', generation: 3 });
    expect(caps).toMatchObject({
      abilities: true,
      natures: true,
      heldItems: true,
      modernEvsIvs: true,
      tera: false,
      dynamax: false,
      megaEvolution: false,
      zMoves: false,
      statModel: 'modern',
      fullyValidated: true,
    });
  });

  it('Gen I (Red/Blue): no abilities/natures/items, legacy stat model, not fully validated', () => {
    const caps = resolveBuildGameCapabilities({ slug: 'red-blue', generation: 1 });
    expect(caps).toMatchObject({
      abilities: false,
      natures: false,
      heldItems: false,
      modernEvsIvs: false,
      tera: false,
      specialRuleset: null,
      statModel: 'legacy-gen1',
      fullyValidated: false,
    });
  });

  it('Gen II (Gold/Silver): held items exist, still no abilities/natures/modern stats', () => {
    const caps = resolveBuildGameCapabilities({ slug: 'gold-silver', generation: 2 });
    expect(caps).toMatchObject({
      abilities: false,
      natures: false,
      heldItems: true,
      modernEvsIvs: false,
      statModel: 'legacy-gen2',
      fullyValidated: false,
    });
  });

  it("Let's Go: identified as a special ruleset, no modern mechanics assumed", () => {
    const caps = resolveBuildGameCapabilities({
      slug: 'lets-go-pikachu-lets-go-eevee',
      generation: 7,
    });
    expect(caps).toMatchObject({
      abilities: false,
      natures: false,
      heldItems: false,
      modernEvsIvs: false,
      tera: false,
      specialRuleset: 'lets-go',
      statModel: 'special',
      fullyValidated: false,
    });
  });

  it('Legends: Arceus: identified as a special ruleset, no modern mechanics assumed', () => {
    const caps = resolveBuildGameCapabilities({ slug: 'legends-arceus', generation: 8 });
    expect(caps).toMatchObject({
      abilities: false,
      natures: false,
      heldItems: false,
      modernEvsIvs: false,
      specialRuleset: 'legends-arceus',
      statModel: 'special',
      fullyValidated: false,
    });
  });

  it('never grants Tera/Dynamax/Mega/Z-Moves to a legacy or special-ruleset context', () => {
    for (const versionGroup of [
      { slug: 'red-blue', generation: 1 },
      { slug: 'gold-silver', generation: 2 },
      { slug: 'lets-go-pikachu-lets-go-eevee', generation: 7 },
      { slug: 'legends-arceus', generation: 8 },
    ]) {
      const caps = resolveBuildGameCapabilities(versionGroup);
      expect(caps.tera).toBe(false);
      expect(caps.dynamax).toBe(false);
      expect(caps.megaEvolution).toBe(false);
      expect(caps.zMoves).toBe(false);
    }
  });

  it('teamAnalysisSupported: false before Generation VI (Fairy/modern type chart), true from Gen VI onward', () => {
    expect(
      resolveBuildGameCapabilities({ slug: 'red-blue', generation: 1 }).teamAnalysisSupported,
    ).toBe(false);
    expect(
      resolveBuildGameCapabilities({ slug: 'gold-silver', generation: 2 }).teamAnalysisSupported,
    ).toBe(false);
    expect(
      resolveBuildGameCapabilities({ slug: 'emerald', generation: 3 }).teamAnalysisSupported,
    ).toBe(false);
    expect(
      resolveBuildGameCapabilities({ slug: 'diamond-pearl', generation: 4 }).teamAnalysisSupported,
    ).toBe(false);
    expect(
      resolveBuildGameCapabilities({ slug: 'black-white', generation: 5 }).teamAnalysisSupported,
    ).toBe(false);
    expect(resolveBuildGameCapabilities({ slug: 'x-y', generation: 6 }).teamAnalysisSupported).toBe(
      true,
    );
    expect(
      resolveBuildGameCapabilities({ slug: 'sword-shield', generation: 8 }).teamAnalysisSupported,
    ).toBe(true);
    expect(
      resolveBuildGameCapabilities({ slug: 'scarlet-violet', generation: 9 }).teamAnalysisSupported,
    ).toBe(true);
  });

  it('teamAnalysisSupported stays true for a Gen 7+ special ruleset — the type chart itself is still modern there', () => {
    expect(
      resolveBuildGameCapabilities({ slug: 'lets-go-pikachu-lets-go-eevee', generation: 7 })
        .teamAnalysisSupported,
    ).toBe(true);
    expect(
      resolveBuildGameCapabilities({ slug: 'legends-arceus', generation: 8 }).teamAnalysisSupported,
    ).toBe(true);
  });

  it('BDSP (Gen VIII remake): standard modern mechanics, no Dynamax despite sharing the generation', () => {
    const caps = resolveBuildGameCapabilities({
      slug: 'brilliant-diamond-shining-pearl',
      generation: 8,
    });
    expect(caps).toMatchObject({
      abilities: true,
      natures: true,
      modernEvsIvs: true,
      dynamax: false,
      fullyValidated: true,
    });
  });
});
