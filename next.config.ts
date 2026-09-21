import type { NextConfig } from 'next'

// standalone: self-contained server bundle for the EC2 (node .next/standalone/server.js).
const nextConfig: NextConfig = { output: 'standalone' }

export default nextConfig
