/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    missingSuspenseWithCSRBailout: false,
    serverActions: {
      allowedOrigins: ['localhost:3000', 'comagente.trackermap.app.br'],
    },
  },
}
module.exports = nextConfig
