# PokeLab — Observability

## Initial tool

Use **Sentry** for production error visibility and useful performance tracing where appropriate.

Do not send secrets, access tokens, provider API keys, private team contents or unnecessary personal data to telemetry.

## What to monitor first

- uncaught server/client errors,
- API failures,
- route performance,
- failed data imports,
- battle engine crashes,
- battle disconnects once multiplayer exists,
- AI provider errors/cost/latency once AI exists.

## Product/engineering metrics later

Examples:

- `battle_simulation_ms`
- `battle_turn_resolution_ms`
- `damage_calculation_ms`
- `search_latency_ms`
- `battle_disconnect_rate`
- `ai_response_ms`
- `ai_provider_cost`
- `db_query_ms`

Do not deploy a heavy metrics stack before there is data worth measuring.

## Alerting

Alerts should be actionable.

Avoid paging/noise for transient non-user-impacting events.

## Correlation

Use safe request/session identifiers for debugging without exposing private content.
