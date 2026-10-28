import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The map is the home screen; the old dashboard and roadmap URLs land there (query strings are kept,
  // so /roadmap?demo=states → /?demo=states). Not permanent while the shell is still moving.
  // Dev only: Safari reuses its cached copy of the CSS chunk across reloads (same URL every edit), so style
  // changes don't show until its cache is emptied. Forbid caching the dev chunks.
  async headers() {
    if (process.env.NODE_ENV !== 'development') return [];
    return [{ source: '/_next/static/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] }];
  },
  async redirects() {
    return [
      { source: '/dashboard', destination: '/', permanent: false },
      { source: '/roadmap', destination: '/', permanent: false },
      { source: '/league', destination: '/leaderboard', permanent: false },
      // level, streak and badges moved into the profile
      { source: '/progress', destination: '/profile', permanent: false },
    ];
  },
};

export default nextConfig;
