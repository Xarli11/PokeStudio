import { getDictionary } from '@pokestudio/i18n';
import { describe, expect, it } from 'vitest';

import { describeEvolutionCondition, groupEvolutionEdges } from './evolution-condition';
import type { EvolutionCondition, EvolutionEdge } from '@pokestudio/database';

const dictionary = getDictionary('en');
const evolutionDictionary = dictionary.pokedex.evolution;

function condition(overrides: Partial<EvolutionCondition> = {}): EvolutionCondition {
  return { trigger: 'level-up', needsOverworldRain: false, turnUpsideDown: false, ...overrides };
}

describe('describeEvolutionCondition', () => {
  it('describes a plain level-up condition', () => {
    expect(describeEvolutionCondition(condition({ minLevel: 16 }), evolutionDictionary)).toBe(
      'Level up (at level 16)',
    );
  });

  it('describes a use-item condition (stone evolution)', () => {
    expect(
      describeEvolutionCondition(
        condition({ trigger: 'use-item', itemSlug: 'water-stone' }),
        evolutionDictionary,
      ),
    ).toBe('Use item (using Water Stone)');
  });

  it('describes a trade-holding-item condition (Feebas -> Milotic)', () => {
    expect(
      describeEvolutionCondition(
        condition({ trigger: 'trade', heldItemSlug: 'prism-scale' }),
        evolutionDictionary,
      ),
    ).toBe('Trade (holding Prism Scale)');
  });

  it('describes a high-friendship-at-night condition (Umbreon)', () => {
    expect(
      describeEvolutionCondition(
        condition({ minHappiness: 220, timeOfDay: 'night' }),
        evolutionDictionary,
      ),
    ).toBe('Level up (friendship 220+, at night)');
  });

  it('falls back to the "other" trigger label for a trigger PokéAPI added that the dictionary has no entry for', () => {
    expect(
      describeEvolutionCondition(condition({ trigger: 'agile-style-move' }), evolutionDictionary),
    ).toBe('Special method');
  });

  it('renders a bare trigger with no parenthetical when there are no extra conditions', () => {
    expect(describeEvolutionCondition(condition({ trigger: 'shed' }), evolutionDictionary)).toBe(
      'Shed',
    );
  });

  it('does not surface the raw location slug value (only a fixed phrase)', () => {
    const description = describeEvolutionCondition(
      condition({ locationSlug: 'mt-coronet' }),
      evolutionDictionary,
    );
    expect(description).not.toContain('mt-coronet');
    expect(description).not.toContain('Mt Coronet');
    expect(description).toContain('special location');
  });
});

describe('groupEvolutionEdges', () => {
  function edge(overrides: Partial<EvolutionEdge> = {}): EvolutionEdge {
    return {
      fromSpeciesSlug: 'feebas',
      toSpeciesSlug: 'milotic',
      condition: condition(),
      ...overrides,
    };
  }

  it('collapses PokéAPI location-only variants for the same edge into one description', () => {
    const edges: EvolutionEdge[] = [
      edge({
        fromSpeciesSlug: 'magneton',
        toSpeciesSlug: 'magnezone',
        condition: condition({ locationSlug: 'mt-coronet' }),
      }),
      edge({
        fromSpeciesSlug: 'magneton',
        toSpeciesSlug: 'magnezone',
        condition: condition({ locationSlug: 'chargestone-cave' }),
      }),
      edge({
        fromSpeciesSlug: 'magneton',
        toSpeciesSlug: 'magnezone',
        condition: condition({ trigger: 'use-item', itemSlug: 'thunder-stone' }),
      }),
    ];

    const groups = groupEvolutionEdges(edges, evolutionDictionary);
    expect(groups).toHaveLength(1);
    // Two location-only entries collapse into one line; the item entry is distinct.
    expect(groups[0]!.conditionDescriptions).toHaveLength(2);
  });

  it('keeps genuinely distinct alternative methods to the same target separate (Feebas -> Milotic)', () => {
    const edges: EvolutionEdge[] = [
      edge({ condition: condition({ minBeauty: 170 }) }),
      edge({ condition: condition({ trigger: 'trade', heldItemSlug: 'prism-scale' }) }),
    ];
    const groups = groupEvolutionEdges(edges, evolutionDictionary);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.conditionDescriptions).toHaveLength(2);
  });

  it('produces one group per branch for a branching family (Eevee)', () => {
    const edges: EvolutionEdge[] = [
      edge({ fromSpeciesSlug: 'eevee', toSpeciesSlug: 'vaporeon' }),
      edge({ fromSpeciesSlug: 'eevee', toSpeciesSlug: 'jolteon' }),
      edge({ fromSpeciesSlug: 'eevee', toSpeciesSlug: 'flareon' }),
    ];
    const groups = groupEvolutionEdges(edges, evolutionDictionary);
    expect(groups).toHaveLength(3);
    expect(new Set(groups.map((g) => g.toSpeciesSlug))).toEqual(
      new Set(['vaporeon', 'jolteon', 'flareon']),
    );
  });
});
