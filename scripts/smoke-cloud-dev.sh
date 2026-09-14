#!/usr/bin/env bash
# pnpm smoke:cloud-dev — smoke-tests the deployed DEV Cloudflare Worker
# (Supabase Cloud PokeStudio Dev backing it) after a migrate/ingest/deploy.
#
# Lesson from the 2026-09-14 incident: Next.js served HTTP 200 on every route
# while Pokémon detail pages had actually crashed server-side (PostgREST
# "Could not find the table 'public.pokemon_form_move' in the schema cache");
# the failure was only visible in the React Server Components payload as an
# error digest (`"digest":"<id>"`, sometimes backslash-escaped depending on
# how the response is read — `\"digest\":\"2129715235\"` was the real form
# seen here). A plain HTTP-status check would have missed this entirely, so
# this script greps the response body for a digest marker in addition to
# checking status. `"digest":"$undefined"` is Next's normal no-error payload
# field and is explicitly excluded to avoid a false positive on every page.
set -euo pipefail

BASE_URL="${POKESTUDIO_CLOUD_DEV_WORKER_URL:-https://pokestudio.carlosgt2001.workers.dev}"

ROUTES=(
  "/es"
  "/es/pokemon"
  "/es/pokemon/bulbasaur"
  "/en/pokemon/bulbasaur"
  "/es/pokemon/mew"
  "/es/moves"
  "/es/moves/tackle"
  "/sitemap.xml"
)

fail=0
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

for route in "${ROUTES[@]}"; do
  url="${BASE_URL}${route}"
  code="$(curl -s -o "$tmp" -w "%{http_code}" --max-time 20 "$url")"

  if [ "$code" -lt 200 ] || [ "$code" -ge 400 ]; then
    echo "FAIL  $route  (HTTP $code)"
    fail=1
    continue
  fi

  digest="$(grep -oE '\\?"digest\\?":\\?"[^\\"]+' "$tmp" | grep -v '\$undefined' | sort -u || true)"
  if [ -n "$digest" ]; then
    echo "FAIL  $route  (HTTP $code, RSC error digest: $digest)"
    fail=1
    continue
  fi

  echo "OK    $route  (HTTP $code)"
done

if [ "$fail" -ne 0 ]; then
  echo ""
  echo "Smoke test FAILED — at least one deployed route errored or returned an RSC digest." >&2
  exit 1
fi

echo ""
echo "Smoke test passed — all routes returned success with no RSC error digest."
