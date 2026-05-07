import type { NextConfig } from 'next';

/**
 * Next.js 15 config.
 *
 * - `transpilePackages` lists workspace packages that ship un-built TypeScript
 *   sources (per ADR-004 — packages export from `./src/index.ts`). Without
 *   this, Next would refuse to import them.
 * - `webpack` extension alias maps `.js` import specifiers (the NodeNext-
 *   style our workspace packages use) onto `.ts` / `.tsx` source files.
 *   TypeScript's Bundler resolution handles this for the type-checker, but
 *   webpack needs the explicit alias to find the file at compile time.
 */
const nextConfig: NextConfig = {
  transpilePackages: ['@super-meshine/api', '@super-meshine/db', '@super-meshine/ui'],
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};

export default nextConfig;
