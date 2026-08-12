import type { NextConfig } from "next";

const IFRAME_ANCESTORS = [
  "'self'",                   // CRITICAL: Retains the explicit single quotes for CSP validation
  "https://dzinlynxt.com",
  "https://mydesigns.pro",
  // Localhost variants — PHP app on port 80
  "http://localhost",         // bare hostname (port 80 implied)
  "http://localhost:80",      // explicit port — some browsers send :80 in Origin header
  "http://127.0.0.1",        // loopback IP (port 80 implied)
  "http://127.0.0.1:80",     // explicit port variant
];

const nextConfig: NextConfig = {
  // Disables the X-Powered-By header for enhanced security runtime setup
  poweredByHeader: false, 
  
  async headers() {
    return [
      {
        // Broad catch-all ensures headers attach to normal paths AND all internal Next.js assets.
        // NB: `/:path*` alone already covers everything (pages, /_next assets, favicon, …).
        // Keep separate entries per source — `|` alternation is NOT valid in path-to-regexp
        // source patterns and silently disables the whole header rule.
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${IFRAME_ANCESTORS.join(" ")};`,
          },
          // CRITICAL: We comment out or exclude X-Frame-Options here. 
          // If you see it anywhere else in this file, delete it entirely!
          /*
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          }
          */
        ],
      },
    ];
  },
};

export default nextConfig;
 