import type { NextConfig } from "next";

const backendOrigin = (process.env.BACKEND_ORIGIN ?? "https://hackathonback.devdlfjstizlzl.xyz").replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["*.trycloudflare.com"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.mcmworldwide.com",
        pathname: "/i/mcmworldwide/**",
      },
      {
        protocol: "https",
        hostname: "mcmworldwide.sa",
        pathname: "/cdn/shop/files/**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: `${backendOrigin}/:path*`,
      },
    ];
  },
};

export default nextConfig;
