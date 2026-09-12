#!/usr/bin/env bash
# Sources .env.local (repo root, gitignored) into the current shell, if
# present, so these scripts see the same variables Next.js loads
# automatically for apps/web — does not touch Next's own .env loading;
# `next dev`/`next build` read .env.local themselves regardless of this.
if [ -f ".env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi
