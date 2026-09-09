# PokeStudio — Security Baseline

## Principles

- least privilege,
- validate at trust boundaries,
- private-by-default user data,
- secrets server-side,
- minimal data collection,
- explicit authorization separate from authentication.

## Untrusted inputs

Treat as untrusted:

- team imports,
- Pokémon Showdown text imports,
- usernames/profile content,
- URLs,
- search queries,
- AI prompts/content,
- replay uploads,
- battle choices/messages,
- future community content.

## Authentication/authorization

Supabase Auth is the initial identity platform.

Authorization must be enforced server-side/database-side where relevant.

RLS policies require tests.

Never rely on “hidden UI” as authorization.

## Secrets

- no secrets committed,
- provide `.env.example` without credentials,
- separate public/client-safe environment variables from server secrets,
- rotate compromised credentials,
- never log AI API keys/auth tokens.

## AI security

- distinguish user content from system instructions,
- do not allow retrieved/user content to override privileged system rules,
- use allowlisted structured actions for AI-driven mutations,
- validate every action server-side,
- limit tool permissions by feature.

## Community/moderation

Before public UGC grows, support at least:

- report,
- hide/remove,
- user restriction/ban,
- moderator audit trail.

## Dependency security

- Dependabot or equivalent alerts,
- lockfile committed,
- review strategic dependency upgrades,
- no abandoned package purely for convenience when a platform primitive exists.

## Disclosure

Before public beta, add a clear vulnerability reporting path/security contact.
