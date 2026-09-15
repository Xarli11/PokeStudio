import { describe, expect, it } from 'vitest';

import { LATEST_KNOWN_GENERATION, generationForNationalDexNumber } from './species-generation';

describe('generationForNationalDexNumber', () => {
  it('resolves the boundary of every known generation correctly (first/last dex number)', () => {
    expect(generationForNationalDexNumber(1)).toBe(1); // Bulbasaur
    expect(generationForNationalDexNumber(151)).toBe(1); // Mew
    expect(generationForNationalDexNumber(152)).toBe(2); // Chikorita
    expect(generationForNationalDexNumber(251)).toBe(2); // Celebi
    expect(generationForNationalDexNumber(252)).toBe(3); // Treecko
    expect(generationForNationalDexNumber(386)).toBe(3); // Deoxys
    expect(generationForNationalDexNumber(387)).toBe(4); // Turtwig
    expect(generationForNationalDexNumber(493)).toBe(4); // Arceus
    expect(generationForNationalDexNumber(494)).toBe(5); // Victini
    expect(generationForNationalDexNumber(649)).toBe(5); // Genesect
    expect(generationForNationalDexNumber(650)).toBe(6); // Chespin
    expect(generationForNationalDexNumber(721)).toBe(6); // Volcanion
    expect(generationForNationalDexNumber(722)).toBe(7); // Rowlet
    expect(generationForNationalDexNumber(809)).toBe(7); // Melmetal
    expect(generationForNationalDexNumber(810)).toBe(8); // Grookey
    expect(generationForNationalDexNumber(905)).toBe(8); // Enamorus
    expect(generationForNationalDexNumber(906)).toBe(9); // Sprigatito
    expect(generationForNationalDexNumber(1025)).toBe(9); // Pecharunt
  });

  it('returns undefined past the highest known dex number', () => {
    expect(generationForNationalDexNumber(1026)).toBeUndefined();
  });
});

describe('LATEST_KNOWN_GENERATION', () => {
  it('is 9', () => {
    expect(LATEST_KNOWN_GENERATION).toBe(9);
  });
});
