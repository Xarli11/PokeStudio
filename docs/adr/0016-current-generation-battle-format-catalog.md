# ADR-0016: Closed PokeStudio battle-format catalog for the current generation

- Status: Accepted
- Date: 2026-09-29

## Context

ADR-0015's `createBattle` accepted any Pokémon Showdown format id that was two-player, Singles and used user-supplied teams. That left "which formats does PokeStudio support" implicit and tied the public API, future URLs, persistence and replays to simulator ids that change (regulations are renamed and retired). The installed `pokemon-showdown@0.11.11` has 146 `gen9` ids in two families: the Scarlet/Violet mod (`gen9`: OU, Ubers, Doubles OU, retired VGC/BSS regulations…) and the Champions mod (`champions`: Stat Points, its own item pool, level-50 Battle Stadium Singles and the active VGC 2026 Reg M-B).

## Decision

- **Current generation is Generation 9**, declared explicitly as `CURRENT_GENERATION = 9`. It is a product decision: not derived from the simulator, PokéAPI or "latest format", and a simulator upgrade cannot change it. Generation 9 currently spans two families, `scarlet-violet` and `champions`; they are one generation, distinguished by a `family` field.
- **Closed, explicit catalog.** `formats.ts` is pure domain data (no simulator import, no simulator ids) and deeply frozen at runtime (array, descriptors and `availability`). The initial catalog has exactly five entries; nothing is discovered automatically, so an upgrade never adds a format to the product.

| PokeStudio id          | Category                 | Family           | Game type | Availability            |
| ---------------------- | ------------------------ | ---------------- | --------- | ----------------------- |
| `sv-ou`                | `smogon-tier`            | `scarlet-violet` | singles   | available               |
| `sv-ubers`             | `smogon-tier`            | `scarlet-violet` | singles   | available               |
| `champions-bss-reg-mb` | `battle-stadium-singles` | `champions`      | singles   | available               |
| `champions-vgc-reg-mb` | `vgc`                    | `champions`      | doubles   | blocked (`vgc-runtime`) |
| `sv-doubles-ou`        | `smogon-doubles`         | `scarlet-violet` | doubles   | available               |

Smogon Doubles gets its own category rather than being folded into `smogon-tier`.

_Update (Singles/Doubles foundations):_ the Doubles runtime now exists, so `sv-doubles-ou` became `available` (played end to end with a legal team, real targets and forced replacements) and the only remaining blocker is `vgc-runtime` for `champions-vgc-reg-mb`; the blocked reason is now `blocked-by-vgc-runtime`. Ids and the closed-catalog rules are unchanged.

- **Format ids are permanent.** A published `BattleFormatId` is never recycled, never changes meaning and is never removed because `CURRENT_GENERATION` moves: `sv-ou` always means the Generation 9 Scarlet/Violet OU context and `champions-bss-reg-mb` always means Champions Battle Stadium Singles Regulation M-B. `CURRENT_GENERATION` only says which generation is the product's current priority. A new generation adds new ids. Each entry carries its own `generation`, and resolving an entry checks that value, never `CURRENT_GENERATION`, so raising the constant cannot invalidate an existing id. How older ids are presented later (selectable vs historical) is decided when persistence or replay need it; whatever is chosen must keep every published id resolvable. No historical registry, deprecated state or migration is designed here.
- **Stable PokeStudio ids; simulator ids stay internal.** The mapping to simulator ids lives in `showdown/formats.ts` and appears only in server-side `BattleInfo.engineFormatId`, never in a player/spectator `BattleState` or the public catalog. Product logic never compares against simulator ids.
- **The simulator stays the authority** for rules, bans, legality, team sizes, pick size, level adjustment, game type, mechanics, timers and Open Team Sheets. The catalog records only what PokeStudio decides: id, generation, category, family, game type and availability. Structural facts are read from the simulator at use and pinned by an upgrade-guard test.
- **Availability has two levels:** `available` and `blocked` (`blockedBy: 'doubles-runtime'`). A format is `available` only if a real legal team was played to `finished` end to end in tests. Champions BSS met that bar (legal 6-member team with Champions items and Stat Points, validator pass, pick 3 of 6, level 50, deterministic by seed).
- **`createBattle` accepts only available catalog ids.** Anything else — including a raw simulator id such as `gen9ou` — throws `UNSUPPORTED_FORMAT` with `reason: 'not-in-catalog'`; a blocked entry throws `reason: 'blocked-by-doubles'`. Unaudited formats (alternate-mechanics metagames) could break state projection and visibility without notice, so the catalog is closed.
- **Test-only path.** Mechanics tests keep using artificial formats such as Custom Game through an internal creator that is not exported, not reachable from `BattleConfig`, and has no flag. Teams are still validated there.
- **Structured format identity:** `BattleFormatInfo` exposes `id`, `name`, `generation`, `gameType`, `category` and `family`, so a consumer (a future agent) never parses ids to learn them.
- **Champions Stat Points:** the simulator reads the `evs` table as Stat Points in the Champions family (max 32 per stat, 66 total). PokeStudio adds no conversion; the validator is the authority.
- **Boundaries.** VGC: `champions-vgc-reg-mb` is only known and blocked; Doubles execution, pick 4, Open Team Sheets, Bo3 and regulation UX belong to `Singles/Doubles foundations` and `VGC-first polish`. Build: no integration or format selector yet; the catalog is neutral and Build is deliberately not coupled to it (no equivalence with Build's game/version-group type is asserted). Cynthia: format identity is structured data reachable through `BattleSideHandle`; no policy lives here. Area Zero: it will map a `BattleFormatId` to a `BattleTeamInput`; banlists and legality are never copied here.

## Consequences

- The supported product surface is explicit, testable and stable across simulator upgrades.
- Upgrading `pokemon-showdown` requires passing the guard (pinned generation, mod, game type, team sizes, pick size and adjusted level per entry) and the real-battle test for every available format.
- Format display names come from the simulator in English; localized names arrive with the UI.
- Deferred: Doubles runtime, VGC polish, Build format integration/validation API, more formats (tiers, Monotype, National Dex, older regulations, Bo3), and Gen 10 (an explicit product change).
