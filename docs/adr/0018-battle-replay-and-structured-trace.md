# ADR-0018: Deterministic battle replay and structured battle trace

- Status: Accepted
- Date: 2026-09-29

## Context

The engine is deterministic for a seed, teams and choices, and already produces per-perspective events. Two things were missing before a Battle UI, a turn inspector and "what if" forks: a durable, versioned way to reproduce a battle, and an event stream rich enough to explain a turn without ever parsing simulator text. They are related (same seed, commands, turns, determinism) but distinct concepts.

## Decision

**Replay (input, reproducible):**

- `BattleReplay` is a PokeStudio-owned, versioned JSON document: `schemaVersion` (currently 1), the simulator name and version, the stable `BattleFormatId`, the resolved seed, both sides' config (teams and display names) and the ordered structured commands, plus the result when finished. It is not `Battle.toJSON()` and not the simulator's input log; the simulator's log stays an internal parity/debug tool.
- Every accepted command is recorded as `{ decision, turn, side, command }` where `command` is the public structured `BattleCommand` — never a choice string. `decision` is the 0-based decision boundary and advances each time the engine resolves a decision. Rejected commands are not recorded. `session.getReplay()` returns a copy.
- A replay is omniscient by nature (full teams and the seed). It is server-side data and never part of a player or spectator state or a `BattleSideHandle`.
- `restoreBattle(replay, { atDecision? })` rebuilds a live `BattleSession` by re-creating it from format, seed and teams and replaying the commands through the normal `submitChoice` path — always from the start (correctness over speed; no snapshots). `atDecision: N` returns the session at the boundary just before decision N (all earlier commands applied, none of N), which is what forks need.
- `parseBattleReplay` validates structure and schema version. Everything is rejected with a typed `INVALID_REPLAY`: malformed JSON or shape, unsupported schema version, a different simulator version (`incompatible-engine`: determinism across simulator versions is not assumed), unknown format or unusable config, a command the engine rejects (with its index), a final result that differs from the recorded one, and a decision that does not exist.
- Each game of a `BattleSeries` carries its own replay; a series is reproducible from its seed and those replays.

**Structured trace (output, explanatory):**

- `BattleEvent` is extended from the minimal contract to a trace vocabulary: switches (forced or chosen) and position swaps, moves with targets, misses, failures, prevented moves, immunity, critical hits, effectiveness, damage/heal/set HP, faints, status, volatile start/end, boosts, ability/item/move/condition effects, item gain/consume/removal, Terastallization, forme changes, weather/terrain/pseudo-weather/side conditions, and the result. Lines that add nothing to that are dropped; raw protocol is never public.
- **Causality is small and derived from what the simulator states.** Every event may carry `cause` (`[from]`/`[of]`: an ability, item, move or condition, and its source) and `parentSeq` (the action it happened under: a `move-used`, `switched` or `move-prevented`, or, for switch-in abilities, the effect that answers a switch). The simulator's own empty line separates the action phase from the end-of-turn phase, so residual effects (Leftovers, weather, poison) have no parent; turn boundaries and battle start/end never do. Switch-in abilities are linked to their own Pokémon's switch even though the simulator lists all switches first.
- Trace events are filtered per perspective exactly like the rest of the state (`|split|` channels), so hidden information stays hidden: a rival's ability or item appears only when the battle reveals it.

**Not decided here:** replay storage/persistence, a transport for replays, and any UI. Snapshotting for speed and series-level replay documents come only if a consumer needs them.

## Consequences

- A battle, or any decision boundary of it, can be reproduced exactly from public, versioned, engine-neutral data; the Turn Inspector and Battle Forks can be built on `restoreBattle` and the trace without touching simulator internals.
- Upgrading the simulator invalidates old replays by design (`incompatible-engine`) until a migration policy exists.
- The trace is a contract: adding event types is additive, changing a type's meaning is not.
