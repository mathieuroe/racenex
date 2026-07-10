import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // "@handle" folders are reserved for parallel routes in the App
        // Router, so /@handle URLs are rewritten to the internal /u/handle
        // page instead of being a literal app/@[handle] route.
        source: "/@:handle",
        destination: "/u/:handle",
      },
    ];
  },
};

export default nextConfig;
