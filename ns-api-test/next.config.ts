import type { NextConfig } from "next";
import withBundleAnalyzer from '@next/bundle-analyzer';

// Initialize the bundle analyzer
const initializeBundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'vt.ns-mlab.nl',
        port: '', // Keep empty unless a specific port is needed
        pathname: '/v1/images/**', // Allow any path under /v1/images/
      },
    ],
  },
};

// Wrap the config with the analyzer
export default initializeBundleAnalyzer(nextConfig);
