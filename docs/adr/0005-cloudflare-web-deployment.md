# ADR-0005: Cloudflare-oriented web deployment

- Status: Accepted
- Date: 2026-09-08

## Context

PokeStudio should start cheap, fast and globally accessible. Cloudflare offers suitable web/edge deployment capabilities.

## Decision

Target a Cloudflare-compatible deployment path for the Next.js web application, following current supported official guidance at implementation time.

Do not bind core domain logic to Cloudflare-specific primitives without need.

## Consequences

- low initial cost and strong global delivery,
- framework integration must be validated against current Cloudflare recommendations,
- persistent battle workloads may use a separate runtime later.
