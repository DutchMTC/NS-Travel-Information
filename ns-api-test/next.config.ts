import type { NextConfig } from "next";

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

export default nextConfig;
