# ADR-0019: Node battle server and the Battle Sandbox

- Status: Accepted
- Date: 2026-09-29

## Context

The battle engine (ADR-0015…0018) is a synchronous, Node-only library over `pokemon-showdown`. The web app is a Next.js app deployed to Cloudflare Workers through OpenNext (ADR-0005). Pokémon Showdown is not demonstrated to run on Workers or in a browser, and its data loading is Node-oriented, so a battle cannot live inside the web deployment. The first Battle UI must let one person play a whole battle (both sides) without any AI.

Discovered while building the server: `pokemon-showdown` is CommonJS, and Node's own ESM loader cannot see its named exports, so `import { Dex } from 'pokemon-showdown'` works under bundlers and vitest but crashes when the engine runs directly on Node.

## Decision

- **A minimal Node process owns the battles: `apps/battle-server`.** Plain `node:http` and a small router, no framework and no new runtime dependency (`tsx`, already used by `pokemon-data`, runs it). Responsibilities: create a battle, own its lifetime, serve perspective-scoped state, legal choices and events, accept commands, release the replay, expire and delete sessions.
- **HTTP request/response, no WebSockets.** The battle is turn-based and every interaction is create / read / submit; a submit already returns the resolved state and events. Realtime transport is deferred until a feature (private PvP) needs it.
- **Sessions are in memory, with a TTL (default 60 min idle) and a capacity cap (default 500).** Nothing is persisted; a restart drops every battle and the UI says sessions expire. The HTTP API does not depend on the store being memory. There is no database in this change.
- **The web reaches the battle server server-to-server only.** The Battle Sandbox page calls Next Server Actions, which call the battle server with a shared bearer secret (`BATTLE_SERVER_URL`, `BATTLE_SERVER_SECRET`, server-side env only). Browsers never call the battle server and never see its URL or secret. When it is not configured or unreachable the UI says so — there is no fake fallback. The server binds to loopback by default and refuses a non-loopback bind without a secret; the secret is compared in constant time.
- **No omniscient view over HTTP.** Every read is a player perspective (`p1`/`p2`) or the spectator; there is no route for the omniscient perspective, and the Server Actions validate the same. In the Sandbox one person controls both sides, so the UI reads each side through its own perspective and lets the user deliberately switch between them; it never receives one blob and hides parts of it. The replay (both teams and the seed) is only released once the battle has finished. Request bodies are never logged. Battle ids are unguessable UUIDs.
- **The web bundle never contains the simulator.** The web imports only the engine's pure-data subpaths (`@pokestudio/battle-engine/formats`, `/types`, declared in `exports`) and type-only imports; a test scans the web sources for anything else. Display names for ids (`dragonclaw` → "Dragon Claw") and team-text import are engine functions exposed by the server (`GET /v1/names`, `POST /v1/teams/import`), so the web needs no simulator data.
- **The engine loads the simulator through one module (`showdown/simulator.ts`) using `createRequire`,** which works under Node's ESM loader as well as bundlers. A test starts the real server process to guard against a CJS/ESM regression.
- **UI:** the Battle Sandbox (`/[locale]/battle/sandbox`, not indexable) is one person playing both sides: format and teams (from Build's saved teams or pasted text), team preview, per-slot actions with targets, Terastallization and forced replacements, a battlefield per perspective, the result with a downloadable replay, a per-turn timeline, and a Turn Inspector. The timeline and inspector are built from the structured trace only (`cause`/`parentSeq`, HP before/after derived from events) with deterministic, localized (ES/EN) templates — no AI and no generated text.
- **Build integration is a mapping only** (`TeamDraft` → `BattleTeamInput`); the engine decides legality and its typed team problems are shown as they are.

## Consequences

- Deploying the Battle Sandbox needs a separately hosted Node process reachable from the web app; nothing in this change deploys one. Where it runs is an infrastructure decision for the owner. Without it the Sandbox honestly reports that the battle server is not configured.
- Sessions do not survive restarts and are single-instance; horizontal scale or reconnection needs a persistent store first.
- Move/item/ability names in the battle are the simulator's English names; localized names would need a data mapping and are not part of this change. There are no Pokémon sprites in the battle view.
- The Sandbox has no accounts and no authentication beyond the server-to-server secret.
