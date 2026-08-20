import type { NextConfig } from "next";

const backendOrigin = (process.env.BACKEND_ORIGIN ?? "https://hackathonback.devdlfjstizlzl.xyz").replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["*.trycloudflare.com"],
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
