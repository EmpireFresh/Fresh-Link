/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ── Ignore TypeScript errors during build ────────────────────────────────
  typescript: { ignoreBuildErrors: true },

  // ── Images ───────────────────────────────────────────────────────────────
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'jwdrwapuetqoqnankgma.supabase.co' },
      { protocol: 'https', hostname: 'empire-fresh.netlify.app' },
      { protocol: 'https', hostname: 'empire-fresh.co.site' },
    ],
  },

  // ── Webpack ───────────────────────────────────────────────────────────────
  webpack: (config, { isServer }) => {
    try {
      config.resolve.alias = {
        ...config.resolve.alias,
        'react-is': require.resolve('react-is'),
      }
    } catch (e) {}

    if (isServer) {
      config.externals = Array.isArray(config.externals)
        ? [...config.externals, 'leaflet']
        : ['leaflet']
    }

    // Firebase est optionnel — ignorer si non installé
    try {
      require.resolve('firebase/app')
    } catch {
      const webpack = require('webpack')
      config.plugins.push(
        new webpack.IgnorePlugin({ resourceRegExp: /^firebase/ })
      )
    }

    return config
  },

  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
}

module.exports = nextConfig
