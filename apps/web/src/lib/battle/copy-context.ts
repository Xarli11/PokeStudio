import type { EventCopyContext, EventTemplates } from './event-copy';
import type { BattleDisplayNames, BattleSideId, BattleState } from './types';

/** Builds the copy context for one perspective's state and the server's display names. */
export function makeCopyContext(options: {
  templates: EventTemplates;
  names: BattleDisplayNames | null;
  state: BattleState | null;
  sideLabel(side: BattleSideId): string;
  unknownLabel: string;
}): EventCopyContext {
  const { templates, names, state } = options;
  const lookup = (table: Record<string, string> | undefined, id: string) => table?.[id] ?? id;
  return {
    templates,
    sideName: options.sideLabel,
    pokemonName(ref) {
      const member = state?.sides[ref.side].team.find((p) => p.ref.teamIndex === ref.teamIndex);
      const label = member ? (member.nickname ?? member.species) : options.unknownLabel;
      return `${label} (${ref.side === 'p1' ? 'P1' : 'P2'})`;
    },
    moveName: (id) => lookup(names?.moves, id),
    abilityName: (id) => lookup(names?.abilities, id),
    itemName: (id) => lookup(names?.items, id),
    conditionName: (id) => lookup(names?.conditions, id),
  };
}
