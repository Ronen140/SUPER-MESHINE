import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // This project is intentionally outside the root pnpm workspace (see
  // pnpm-workspace.yaml in this directory), but the root repo also has a
  // pnpm-lock.yaml. Pin the tracing root explicitly so Next.js doesn't guess.
  outputFileTracingRoot: path.resolve(import.meta.dirname),
};

export default nextConfig;
