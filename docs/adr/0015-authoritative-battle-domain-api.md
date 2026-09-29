# ADR-0015: Authoritative battle-domain API over a direct Showdown `Battle`

- Status: Accepted
- Date: 2026-09-29

## Context

ADR-0003 makes Pokémon Showdown the mechanics authority behind a PokeStudio adapter. Phase 4 needs the domain API that adapter exposes: create a battle, read state, list legal choices, submit choices, receive what happened, finish. The Phase 0 spike (`simulateHeadlessBattle`) only proved a headless run over `BattleStream` and leaked raw idents, HP display strings, a `raw` event and packed teams.

Audit of the installed `pokemon-showdown@0.11.11`: `BattleStream` is documented "VERY NOT FINALIZED" and is a text stream over a `Battle` it constructs itself. `Battle` is exported, synchronous (`choose()` resolves the turn), exposes typed `activeRequest` objects per side, reports choice errors only as free text (`|error|…`, or a thrown `Error` with `strictChoices`), and reports the winner by player **name**. Its `cancelmod` rule (in `gen9customgame`) lets a side silently replace an earlier choice. The log carries a wall-clock `|t:|` line. `PRNG` accepts a seed string (sodium by default, or the legacy Gen 5 LCG) and `Battle` exposes the resolved `prngSeed`.

## Decision

`packages/battle-engine` exposes `createBattle(config): BattleSession`, built on a **directly constructed `Battle`** with its `send` callback (the same mechanism `BattleStream` uses internally), not on `BattleStream`.

- **Session:** one mutable, **synchronous** `BattleSession` per battle. No store, no global registry, no async. Whoever owns the session (a future server) owns exclusivity and any transport.
- **Runtime target: Node, server-side.** `pokemon-showdown@0.11.11` is not demonstrated to run on Cloudflare Workers or in a browser and carries Node-oriented dependencies. Battle UI consumes a session across a server-side boundary; if the web app stays on Cloudflare, the engine deploys later as a separate Node service. No HTTP/RPC/server is part of this decision.
- **Lifecycle:** public status is `awaiting-choices | finished`. Creation is atomic (no observable "setup"); "resolving" is transient inside a synchronous submit and not exposed. Per side: request kind `team-preview | move | forced-switch | wait` plus `submitted`. The session enforces one submission per side per decision itself (`CHOICE_ALREADY_SUBMITTED`), independent of the simulator's Cancel Mod. Results use side ids (`win`/`tie`), never display names.
- **Identity:** sides are `p1|p2`. `BattlePokemonRef {side, teamIndex}`, where `teamIndex` is the original index in `BattleTeamInput`. It is captured once, by simulator `Pokemon` **instance identity**, right after construction, so it survives preview reorder, switches, faints and identical duplicates. Slots are `BattleSlotRef {side, position}`.
- **Names to the simulator:** fixed player names `P1`/`P2`, and adapter tokens `m<teamIndex>` as Pokémon names. Display names and nicknames are PokeStudio-side data and never reach the simulator (no protocol/packed-team injection; unambiguous ident → ref resolution).
- **Explicit perspectives:** `p1 | p2 | spectator | omniscient`, always a required argument, no default. `omniscient` is never reachable through a side handle.
- **Allow-list visibility:** public objects are built field by field from explicit lists, never copied from engine objects and redacted. Opposing/public species, moves, item and ability come only from a per-perspective `RevealedTracker` fed by that perspective's `|split|` channel lines. Own HP is exact; other perspectives get a percentage.
- **Structured choices:** legal options and submitted commands are distinct types. The session validates the whole command against the request first (typed `ILLEGAL_CHOICE` reasons), then translates to the simulator choice string. A simulator rejection after validation is `ENGINE_ERROR`. Shapes are multi-slot (slots, targets, per-slot forced replacement, team-order vector); modifiers other than Terastallization are typed but never offered.
- **Errors:** one `BattleDomainError` with a typed `code` and typed `details`; consumers never parse `message`. `INVALID_TEAM.problems` are the validator's display text only.
- **Events:** a minimal per-perspective contract with monotonic `seq` and `turn` (`battle-started`, `team-preview`, `turn-started`, `switched`, `move-used`, `hp-changed`, `fainted`, `status-changed`, `stat-boosted`, `field-changed`, `battle-ended`). Unrecognized protocol lines are dropped; there is no public `raw` event. This is not the full structured battle trace.
- **RNG:** no PokeStudio RNG. `seed` is an opaque string in the installed simulator's form (`sodium,…` / `gen5,…`; no arrays). Omitted → simulator's sodium seed. The resolved seed is on `session.info` only and is never in a player or spectator `BattleState` (it would allow predicting rolls).
- **Format:** initially the input was a validated Showdown format id; ADR-0016 replaces this with a closed catalog of stable PokeStudio format ids (the rest of this line still holds). Runtime accepts only 2-player `singles` formats with user-supplied teams; doubles, other game types and simulator-generated-team formats are `UNSUPPORTED_FORMAT`. Types stay doubles-capable.
- **Teams:** `BattleTeamInput` is the neutral boundary; names/ids are "Showdown-resolvable canonical identifiers". Team legality is **always** validated with the simulator's `TeamValidator`; there is no public bypass flag. Packing is internal.
- **Import boundary:** only `packages/battle-engine/src/showdown/**` imports `pokemon-showdown`; nothing from it leaves `index.ts`.

## Future consumers (constraints only)

- **Cynthia** (the future combat agent) will consume the engine through `BattleSideHandle` (`getState`, `getLegalChoices`, `submitChoice`, `getEvents`, perspective locked to its side). It must not learn simulator internals or hidden rival information. `battle-engine` does not depend on Cynthia.
- **Area Zero** (future team-building/optimization) will be a producer of teams/sets, mapped externally to `BattleTeamInput`. `battle-engine` does not depend on Area Zero. No shared team-schema package is created until Build and Area Zero demonstrably need one.

## Consequences

- One deterministic, testable, synchronous domain API usable by UI, an agent, headless simulation and tests; Battle UI never sees Showdown.
- Coupling to `Battle` members (`sides`, `activeRequest`, `choose`, `sendUpdates`, `getHealth`, `prngSeed`). Mitigated by pinned exact version and parity tests against a raw simulator.
- Choice-error text is never relied on, but hidden trapping/disable can still make a validated choice unavailable; that surfaces as `ILLEGAL_CHOICE` (`choice-unavailable`).
- Deferred: doubles runtime, replay serialization (config, seed, commands and events are already plain data), the full structured battle trace, and a format catalog.
