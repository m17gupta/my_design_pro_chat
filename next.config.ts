import type { NextConfig } from "next";


const IFRAME_ANCESTORS = [
  "'self'",
  "https://luna.dzinlynxt.com",
  "https://mydesigns.pro",
  // A CSP host without a port matches *any* port, so these cover
  // localhost:3000, localhost:5178, etc. during local development.
  "http://localhost",
  "http://127.0.0.1",
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${IFRAME_ANCESTORS.join(" ")};`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
