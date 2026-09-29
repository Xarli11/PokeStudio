# PokeStudio — Battle Engine Specification

## Goal

Provide accurate, testable Pokémon battle mechanics without spending years reimplementing a mature simulator.

## Upstream strategy

Use the **MIT-licensed Pokémon Showdown server/simulator** as the initial mechanics foundation where technically compatible.

Do not copy the official client implementation merely to obtain a battle UI. PokeStudio owns its UX.

## PokeStudio boundary

UI and application code must interact with a PokeStudio battle-domain interface, not raw Showdown internals. The boundary is `@pokestudio/battle-engine` (ADR-0003, ADR-0015).

```ts
const session = createBattle({
  formatId: 'sv-ou', // PokeStudio catalog id (see Formats)
  sides: { p1: { displayName, team }, p2: { displayName, team } }, // team: BattleTeamInput
  seed, // optional; resolved seed is on session.info
});

session.getState('p1'); // BattleState from an explicit perspective
session.getLegalChoices('p1'); // structured options per active slot
session.submitChoice('p1', command); // BattleCommand → { resolved, state, events }
session.getEvents('spectator', afterSeq); // minimal structured events
session.forSide('p1'); // BattleSideHandle: perspective-locked, no seed/omniscient
```

- **Runtime:** Node, server-side, synchronous. `pokemon-showdown@0.11.11` is not demonstrated to run on Cloudflare Workers or in a browser, so the web app must reach a session through a server-side boundary (a separate Node service if the web stays on Cloudflare). No server exists yet.
- **Lifecycle:** `awaiting-choices | finished`; per side `team-preview | move | forced-switch | wait` and `submitted`. One submission per side per decision. Results are `win {side}` / `tie`.
- **Perspectives:** `p1 | p2 | spectator | omniscient`, always explicit. Public state is built by allow-list; rival moves/item/ability appear only once the battle reveals them. Own HP is exact, others percentage. The seed is only on `session.info`.
- **Choices vs commands:** legal options (`BattleLegalChoices`) and submitted commands (`BattleCommand`) are different types; the whole command is validated before the simulator is touched. Types are multi-slot (Doubles-capable); the runtime is Singles only and rejects other game types with `UNSUPPORTED_FORMAT`.
- **Doubles (Singles/Doubles foundations):** `gameType` is `singles` (1 active slot per side) or `doubles` (2). Legal choices and commands are per slot and mirror the simulator's request: a move offers `targets` only for the target categories the simulator lets you choose (`normal`, `any`, `adjacentFoe`, `adjacentAlly`, `adjacentAllyOrSelf`; foes, ally and self as the category allows) and `null` for spread, self, field, random and scripted moves. A fainted slot (and a Pokémon commanding its ally) offers only `pass`. Forced replacements are per slot: `forced-switch` carries `switchCount` = min(slots needing a replacement, benched Pokémon); exactly that many slots switch (to different Pokémon) and the surplus flagged slots pass, otherwise `ILLEGAL_CHOICE` (`switch-required`, `pass-unavailable`, `duplicate-switch`). Simultaneous faints, one Terastallization per side per turn, and per-Pokémon reveal tracking work the same in both game types.
- **VGC (ADR-0017):** `champions-vgc-reg-mb` registers 6, brings 4 at level 50 (Champions Stat Points and items). **Open Team Sheets** follow the simulator's rule table (`BattleFormatInfo.openTeamSheets`): the public `|showteam|` line makes each rival's whole team known from the start — species, item, ability and the four moves (no PP), and the Tera type when the format has Tera — while nicknames, exact HP, spreads and the chosen leads stay private; opt-in sheets are treated as accepted. **`createBattleSeries`** runs a best-of-N (odd 3–9) on the same teams with one derived seed per game and the simulator's scoring (a tie awards no win and lowers the wins needed; undecided after N games is a tie); it is not a format.
- **Identity:** `BattlePokemonRef {side, teamIndex}` where `teamIndex` is the original position in the `BattleTeamInput`; stable through reorder, switches, faints and identical duplicates.
- **Teams:** `BattleTeamInput` is the neutral boundary (Build, tools, tests and, later, an Area Zero mapper produce it). Legality is always validated with the simulator's validator; there is no bypass.
- **Team field defaults:** an omitted optional field means "use the simulator's own default" — nothing is invented by the adapter. `gender` omitted is resolved by Showdown from the species (variable → M/F seeded by the battle seed, fixed-gender → that gender, genderless → `N`); `'N'` is only sent if the caller says it. `level`, `nature`, `item`, `teraType`, `evs` and `ivs` omitted are left to the validator's fill rules (format default level, Serious, no item, first type, EVs 0 in EV-limited formats and 252 otherwise, IVs 31). A partially given `evs`/`ivs` table has its missing stats completed with 0 / 31. A structurally valid team can still be rejected by legality (e.g. an all-omitted EV spread in `gen9ou`): that is `INVALID_TEAM` from the format, not an adapter default.
- **Events:** `seq` is contiguous per perspective starting at 1 and is only meaningful with the perspective that produced it. `getEvents(perspective, afterSeq)` returns `seq > afterSeq` (exclusive). `BattleState.eventCursor` is the last `seq` of that perspective (0 if none), so `getEvents(p, state.eventCursor)` is "what is new". `submitChoice` returns the events its call produced for the submitter; the side that submitted first reads the resolution with its own cursor.
- **Known visibility limits:** Illusion is not modeled (a disguised Pokémon can be shown as its real identity in the public state); nicknames are public only after switch-in, species of unswitched Pokémon only where team preview shows them; hidden trapping/disable can make a validated choice `choice-unavailable`.
- **Formats (ADR-0016):** `createBattle` takes a PokeStudio `BattleFormatId` from the closed catalog `BATTLE_FORMATS` (all five catalog formats are available (`sv-ou`, `sv-ubers`, `champions-bss-reg-mb`, `sv-doubles-ou`, `champions-vgc-reg-mb`)). `CURRENT_GENERATION = 9` is explicit (it names the priority generation; published format ids are permanent and never reinterpreted when it changes) and spans the `scarlet-violet` and `champions` families. Simulator ids stay internal (`BattleInfo.engineFormatId`, server-side); rules and legality stay with the simulator. Anything outside the catalog, including a raw simulator id, is `UNSUPPORTED_FORMAT` (`not-in-catalog`); a catalogued-but-blocked entry would be `blocked` (none today). In the Champions family the simulator reads `evs` as Stat Points (max 32 per stat, 66 total). `BattleFormatInfo` exposes `id`, `name`, `generation`, `gameType`, `category`, `family` and `openTeamSheets` structurally.
- **Errors:** `BattleDomainError` with a typed `code` (`INVALID_CONFIG`, `UNSUPPORTED_FORMAT`, `INVALID_TEAM`, `INVALID_SIDE`, `NOT_ACCEPTING_CHOICE`, `CHOICE_ALREADY_SUBMITTED`, `ILLEGAL_CHOICE`, `BATTLE_FINISHED`, `ENGINE_ERROR`) and typed `details`. Never parse `message`.
- **Determinism:** `seed` is an opaque simulator seed string (`sodium,…`/`gen5,…`). Same seed and commands reproduce the battle.
- **Not yet built:** replay serialization/restore, the full structured battle trace, and Build integration with the catalog. Config, commands and events are plain JSON-serializable data so those can follow without reshaping the API.

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

Do not create a persistent battle server before a feature requires it. The authoritative session runs in Node server-side (ADR-0015).

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
