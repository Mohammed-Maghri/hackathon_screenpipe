import type { NextConfig } from 'next'
const config: NextConfig = { poweredByHeader: false, output: 'standalone', outputFileTracingRoot: process.cwd(), turbopack: { root: process.cwd() } }
export default config
