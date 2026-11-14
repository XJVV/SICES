import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async rewrites() {
    const pyPort = process.env.SICES_PY_PORT || "8000";
    return [
      {
        source: "/api/py/:path*",
        destination: `http://127.0.0.1:${pyPort}/api/py/:path*`,
      },
    ];
  },
};

export default nextConfig;
