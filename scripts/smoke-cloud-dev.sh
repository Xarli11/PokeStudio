#!/usr/bin/env bash
# Shared HTTP/RSC suite; interactive Build remains covered by component tests.
set -euo pipefail
cd "$(dirname "$0")/.."
export POKESTUDIO_SMOKE_URL="${POKESTUDIO_CLOUD_DEV_WORKER_URL:-https://pokelab.carlosgt2001.workers.dev}"
exec node scripts/ci/smoke.mjs
