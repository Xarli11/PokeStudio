import path from 'node:path';
import { fileURLToPath } from 'node:url';

const monorepoRoot = path.join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pins workspace root detection so an unrelated lockfile elsewhere on disk
  // doesn't get picked instead (Next.js infers this from the nearest lockfile).
  outputFileTracingRoot: monorepoRoot,
  // Next.js targets a Cloudflare-compatible deployment path (ADR-0005).
  // Domain logic must not depend on Cloudflare-only runtime primitives.
};

export default nextConfig;
