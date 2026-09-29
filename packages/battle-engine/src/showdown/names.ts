import { Dex } from './simulator';

/**
 * Display names for the ids that appear in battle state and events (`dragonclaw` → "Dragon Claw").
 * Ids are simulator-normalized (no separators), so a UI cannot derive readable names from them; the
 * simulator's own data is the source. English, display only.
 */
export interface BattleDisplayNames {
  moves: Readonly<Record<string, string>>;
  abilities: Readonly<Record<string, string>>;
  items: Readonly<Record<string, string>>;
  /** Weather, terrain, statuses, volatiles, side conditions and other effects. */
  conditions: Readonly<Record<string, string>>;
}

let cached: BattleDisplayNames | null = null;

function table(entries: Iterable<{ id: string; name: string; exists?: boolean }>) {
  const out: Record<string, string> = {};
  for (const entry of entries) if (entry.exists !== false && entry.id) out[entry.id] = entry.name;
  return Object.freeze(out);
}

export function getBattleDisplayNames(): BattleDisplayNames {
  cached ??= Object.freeze({
    moves: table(Dex.moves.all()),
    abilities: table(Dex.abilities.all()),
    items: table(Dex.items.all()),
    // Effects are named after a condition (statuses, weather, hazards…) or the move that creates them.
    conditions: table([
      ...Object.keys(Dex.data.Conditions).map((id) => Dex.conditions.get(id)),
      ...Dex.moves.all(),
    ]),
  });
  return cached;
}
