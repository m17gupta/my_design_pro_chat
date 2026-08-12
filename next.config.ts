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
  "http://dzinly-enterprise.me",
  "https://res.cloudinary.com"
];
 
const nextConfig: NextConfig = {
  // Disables the X-Powered-By header for enhanced security runtime setup
  poweredByHeader: false,
 
  // Allow Next.js <Image> to load from Cloudinary
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
 
  async headers() {
    return [
      {
        // Broad catch-all ensures headers attach to normal paths AND all internal Next.js assets.
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            // ─────────────────────────────────────────────────────────────────
            // NGINX NOTE: If your Nginx config also sets a Content-Security-Policy
            // header for this Next.js app, REMOVE it from Nginx to avoid conflict.
            // Two CSP headers → browser picks the most restrictive one.
            // ─────────────────────────────────────────────────────────────────
            value: [
              // Who can embed this app in an <iframe>
              `frame-ancestors ${IFRAME_ANCESTORS.join(" ")}`,
              // Fallback for unspecified directives
              "default-src 'self'",
              // JS — unsafe-inline needed for Next.js inline scripts; unsafe-eval for some libs
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              // CSS — unsafe-inline needed for styled-jsx / Tailwind / inline styles
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Google Fonts glyphs
              "font-src 'self' https://fonts.gstatic.com",
              // API calls — allows all HTTPS so the app can reach any backend
              "connect-src 'self' https:",
              // ✅ KEY FIX: Allow Cloudinary images (res.cloudinary.com) and blobs
              "img-src 'self' data: https://res.cloudinary.com",
              // Audio/video if ever needed
              "media-src 'self' data: https://res.cloudinary.com",
              // Web workers (Next.js uses them internally)
              "worker-src 'self' blob:",
              // Frames the app itself can load
              "frame-src 'self' https:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};
 
export default nextConfig;