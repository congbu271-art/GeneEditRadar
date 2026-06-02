import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  typedRoutes: true,
  async redirects() {
    return [
      {
        source: "/radar",
        destination: "/dashboard",
        permanent: false,
      },
      {
        source: "/radar/dashboard",
        destination: "/dashboard",
        permanent: false,
      },
      {
        source: "/radar/papers",
        destination: "/papers",
        permanent: false,
      },
      {
        source: "/radar/paper/:id",
        destination: "/paper/:id",
        permanent: false,
      },
      {
        source: "/radar/subscriptions",
        destination: "/subscriptions",
        permanent: false,
      },
      {
        source: "/radar/analyze",
        destination: "/analyze",
        permanent: false,
      },
      {
        source: "/radar/ideas",
        destination: "/ideas",
        permanent: false,
      },
      {
        source: "/radar/evaluate",
        destination: "/evaluate",
        permanent: false,
      },
      {
        source: "/radar/journals",
        destination: "/journals",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
