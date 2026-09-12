# PokeStudio — Battle Engine Specification

## Goal

Provide accurate, testable Pokémon battle mechanics without spending years reimplementing a mature simulator.

## Upstream strategy

Use the **MIT-licensed Pokémon Showdown server/simulator** as the initial mechanics foundation where technically compatible.

Do not copy the official client implementation merely to obtain a battle UI. PokeStudio owns its UX.

## PokeStudio boundary

UI and application code must interact with a PokeStudio battle-domain interface, not raw Showdown internals.

Conceptual API:

```ts
interface BattleEngine {
  createBattle(input: CreateBattleInput): BattleSession;
  submitChoice(sessionId: string, side: SideId, choice: BattleChoice): BattleResult;
  getLegalChoices(sessionId: string, side: SideId): LegalChoiceSet;
  serializeReplay(sessionId: string): SerializedReplay;
  restoreReplay(replay: SerializedReplay): BattleReplay;
}
```

Exact API is implementation-dependent; the boundary is mandatory.

## Why wrap upstream

We need freedom to add PokeStudio-specific capabilities such as:

- structured battle traces,
- replay analysis,
- deterministic simulation harnesses,
- batch simulation,
- AI state extraction,
- explainability,
- performance instrumentation,
- future upstream swaps/forks.

## Structured battle trace

PokeStudio should progressively produce machine-readable events beyond human battle text.

Example concepts:

- action chosen,
- action ordering and priority,
- move resolution,
- ability/item activation,
- stat changes,
- status/weather/terrain transitions,
- HP transitions,
- relevant deterministic modifiers,
- random outcomes/roll identifiers where obtainable,
- faint/switch state,
- turn boundaries.

Do not promise unsupported internal details until verified against upstream APIs.

## Damage explanation

Battle logs and damage calculations should be linkable to structured explanation data where feasible.

User-facing goal:

> “Why did this do so much damage?”

The explanation layer should use deterministic calculation/mechanics data, not LLM guesswork.

## Formats

Long-term:

- Singles,
- Doubles,
- VGC,
- Smogon formats,
- Random Battles,
- custom battles,
- historical generations,
- Mega Evolution,
- Z-Moves,
- Dynamax,
- Terastallization,
- future mechanics.

Initial polished priority: current competitive generation/formats, with VGC slightly prioritized for advanced coaching UX.

## Battle server

Do not create a persistent battle server before a feature requires it.

When online PvP/long-running sessions arrive:

- server is authoritative,
- clients submit choices,
- clients never calculate authoritative outcomes,
- battle state is independent from transport,
- reconnect/replay behavior is explicit.

## Battle AI interface

AI consumes a stable PokeStudio state/action representation, not UI state.

Required properties:

- legal actions enumerated deterministically,
- controlled randomness/seeds for evaluation,
- measurable per-turn latency,
- simulation safe to run headlessly,
- no mandatory network/LLM dependency.

## Testing

Maintain PokeStudio regression tests even when upstream already has tests.

Especially test:

- adapter behavior,
- serialization,
- state extraction,
- generation/format selection,
- known PokeStudio bugs,
- structured trace correctness,
- compatibility when updating upstream.

## Fork policy

Default: no fork.

If upstream blocks a strategically important capability:

1. prove the limitation,
2. evaluate extension/adapter options,
3. consider upstream contribution,
4. estimate fork maintenance cost,
5. create ADR before maintaining a fork.
