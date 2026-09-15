# ADR-0014: GitHub Actions owns guarded delivery

Status: proposed; implementation prepared for review, activation pending.

## Context

Milestone 2 needed schema and data before web deployment. Independent Cloudflare Git builds cannot enforce that order. Full ingestion takes about 35 minutes, and interrupted replacements are not globally atomic. Production has no approved infrastructure identity yet.

## Decision

Reuse repository validation, migration, ingestion, OpenNext and smoke commands in Actions. PR CI is secret-free, with an isolated database integration job. Main delivery targets Cloud DEV. Production requires manual dispatch of the same SHA successfully delivered to DEV, a configured target allowlist and an Environment reviewer gate.

Serialize each environment's entire release with non-cancelling concurrency. Keep the existing database advisory lock for manual/CI ingestion coordination. Determine ingestion from the last successful delivery's Git diff and actual pending migration history, with a manual force-refresh input. Do not use the push event's previous SHA: queued runs can be replaced and failed preparation must be retried.

Perform target/history checks, migrations, conditional ingestion and integrity checks before target-specific build/deploy. Publish the built artifact once and require deployed SHA identity plus HTTP/RSC smoke. Production remains unconfigured until a separately approved infrastructure change. Retire Cloudflare Git deployment before enabling Actions; verify the Worker has no Git build triggers before preparation and deployment.

## Consequences

Frontend-only changes avoid full ingestion. History drift, stale candidates, incomplete reference data, missing Environment protection or unclear targets stop delivery. Additive/backward-compatible database evolution remains mandatory: workflow serialization is not a global DB transaction. Code rollback is separate from schema/data recovery. Private-repository plan limitations cannot be worked around by treating a dispatch input as reviewer approval.

No new data store, service, dependency or deployment-state database is needed. GitHub's successful workflow history supplies the baseline. Full operational details and the initial audit are in [CI/CD](../engineering/CI_CD.md).
