# ADR-0017: VGC runtime — Open Team Sheets and best-of series

- Status: Accepted
- Date: 2026-09-29

## Context

With the Doubles runtime in place, `champions-vgc-reg-mb` was the last blocked catalog format. Auditing `pokemon-showdown@0.11.11` for the real format (`gen9championsvgc2026regmb`) shows: Flat Rules, VGC Timer and the **Open Team Sheets** rule, team of 6 with a pick of 4, level adjusted to 50, Champions Stat Points and item pool. Its Bo3 sibling (`…regmbbo3`) uses **Force Open Team Sheets** and a **Best of = 3** rule.

What the simulator does with Open Team Sheets: `openteamsheets` is opt-in — each player accepts through the room UI and only then does the room call `battle.showOpenTeamSheets()`; `forceopenteamsheets` calls it during team preview itself. It emits one **public** `|showteam|pN|<packed team>` line per side, at turn 0, carrying the whole registered team in team order: species, level, gender, item, ability, all four moves, the nature in the Champions mod, and the Tera type only when the format has Terastallization. Stat spreads and nicknames are not part of the sheet. Best-of is enforced by the room layer (`room-battle-bestof`), not by `Battle`: the series needs `floor(N/2)+1` wins, a tied game awards no win and lowers the wins needed (`floor((N − ties)/2)+1`), and an undecided series after N games is a tie.

## Decision

- **Open Team Sheets are derived from the simulator's rules, never from a format id.** `resolveFormat` reads whether the rule table has `openteamsheets` or `forceopenteamsheets`; `BattleFormatInfo.openTeamSheets` exposes it structurally. There is no `if (formatId === …)` anywhere.
- **A PokeStudio session treats opt-in sheets as accepted.** There is no room UI in the engine, so for `openteamsheets` formats the adapter calls `showOpenTeamSheets()` once at creation (the same call the room makes when both players accept); forced formats already publish during team preview. Sheets are therefore public from the start in VGC.
- **Projection stays protocol-driven and per audience.** The `RevealedTracker` consumes the public `|showteam|` line like any other public information: the rival's whole team becomes known with items, abilities and moves (names only, no PP) and, where the sheet carries one, the Tera type; nicknames stay hidden until switch-in, HP stays a percentage, and the chosen leads/pick remain private until the leads enter. Nature is deliberately not projected. Formats without the rule are unchanged.
- **`champions-vgc-reg-mb` becomes `available`,** backed by an end-to-end test: register 6, bring 4, level 50, sheets visible, Doubles battle, finished, deterministic. No catalog entry is blocked any more; the `blocked` availability state remains a documented, tested gate (`blocked` reason) for formats catalogued ahead of engine support.
- **Best-of is a `BattleSeries`, not a format.** `createBattleSeries({ …BattleConfig, bestOf })` owns N sequential `BattleSession`s on the same format and teams, derives one seed per game from a series seed with the simulator's own PRNG (no PokeStudio RNG), and scores with the simulator's rules (odd length 3–9). It exposes score, per-game results, the current game and the series result, and only starts the next game after the current one finished (`INVALID_SERIES_STATE`). The catalog gets no Bo3 ids.
- **Out of scope:** a series persistence/UI layer, timers, the room-level accept/deny negotiation, series across different teams, and any VGC tournament features.

## Consequences

- VGC is a real, tested format, and the visibility model gained its first "public from the start" information without special cases.
- OTS behavior follows the installed simulator; the upgrade-guard test pins each catalog entry's Open Team Sheets mode.
- Series replay/serialization is part of the replay work that follows; a series is already reproducible from its seed and the per-game commands.
