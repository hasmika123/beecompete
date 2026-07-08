import { fileURLToPath } from 'url';
import type { NextConfig } from 'next';

// Monorepo root (two levels up from apps/web). Pin it so Turbopack doesn't infer the
// wrong root from unrelated lockfiles elsewhere on the machine.
const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: { root: workspaceRoot },
  // Shared workspace packages are consumed as source (architecture §16) — Next
  // compiles their TS/JSX rather than expecting a pre-built dist.
  transpilePackages: ['@beecompete/ui', '@beecompete/config'],
};

export default nextConfig;
