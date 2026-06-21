import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  typedRoutes: true,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/radar",
        destination: "/dashboard",
        permanent: true,
      },
      {
        source: "/radar/dashboard",
        destination: "/dashboard",
        permanent: true,
      },
      {
        source: "/radar/papers",
        destination: "/papers",
        permanent: true,
      },
      {
        source: "/radar/paper/:id",
        destination: "/paper/:id",
        permanent: true,
      },
      {
        source: "/radar/subscriptions",
        destination: "/subscriptions",
        permanent: true,
      },
      {
        source: "/radar/analyze",
        destination: "/analyze",
        permanent: true,
      },
      {
        source: "/radar/ideas",
        destination: "/ideas",
        permanent: true,
      },
      {
        source: "/radar/evaluate",
        destination: "/evaluate",
        permanent: true,
      },
      {
        source: "/radar/journals",
        destination: "/journals",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
