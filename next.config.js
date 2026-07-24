/** @type {import('next').NextConfig} */
const nextConfig = {
  staticPageGenerationTimeout: 10,
  experimental: {
    missingSuspenseWithCSRBailout: false,
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        'localhost:3001',
        'comagente.gaht.com.br',
        'comagente-comagente-app.nxwkfd.easypanel.host',
      ],
    },
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'header', key: 'x-forwarded-proto', value: 'http' }],
        destination: 'https://comagente.gaht.com.br/:path*',
        permanent: true,
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        source: '/api/evolution/webhook',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'POST, GET, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, apikey, x-evolution-token' },
        ],
      },
    ]
  },
}
module.exports = nextConfig
