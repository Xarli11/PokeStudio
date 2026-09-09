import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const monorepoRoot = path.join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pins workspace root detection so an unrelated lockfile elsewhere on disk
  // doesn't get picked instead (Next.js infers this from the nearest lockfile).
  outputFileTracingRoot: monorepoRoot,
  // Next.js targets a Cloudflare-compatible deployment path (ADR-0005, via
  // @opennextjs/cloudflare — see wrangler.jsonc, open-next.config.ts).
  // Domain logic must not depend on Cloudflare-only runtime primitives.
};

export default nextConfig;

// Makes `next dev` itself Cloudflare-binding-aware (env vars, etc.) — the
// normal `pnpm dev` workflow is unchanged; this only affects what's
// available to code that reads Cloudflare bindings, which nothing here
// does yet. No-op outside of `next dev`.
initOpenNextCloudflareForDev();
