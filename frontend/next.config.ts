import type { NextConfig } from "next";

const backendUrl = process.env.NEXT_PUBLIC_API_URL || "https://bingo-backend-e686.onrender.com";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
