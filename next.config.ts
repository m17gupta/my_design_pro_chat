import type { NextConfig } from "next";

const IFRAME_ANCESTORS = [
  "'self'", // CRITICAL: Retains the explicit single quotes for CSP validation
  "https://dzinlynxt.com",
  "https://mydesigns.pro",
  "http://localhost",       // Correctly matches your port 80 setup
  "http://127.0.0.1",
];

const nextConfig: NextConfig = {
  // Disables the X-Powered-By header for enhanced security runtime setup
  poweredByHeader: false, 
  
  async headers() {
    return [
      {
        // Broad catch-all ensures headers attach to normal paths AND all internal Next.js assets
        source: "/_next/(.*)|/:path*",
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
 