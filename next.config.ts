import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              // Fallback for any directive not explicitly listed
              "default-src 'self'",

              // JS — Next.js requires unsafe-inline (inline scripts) and unsafe-eval (some polyfills)
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",

              // CSS — inline styles used heavily by Framer Motion, Next.js, Tailwind
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

              // Images — self + data URIs + blob (Next.js) + Cloudinary
              "img-src 'self' data: blob: https://res.cloudinary.com https://mydesigns.pro",

              // Fonts — Google Fonts CDN
              "font-src 'self' data: https://fonts.gstatic.com",

              // API/WebSocket — allow all HTTPS so /api/* routes and external APIs work
              "connect-src 'self' https: wss:",

              // Media from Cloudinary (if any audio/video)
              "media-src 'self' blob: https://res.cloudinary.com",

              // Web workers — Next.js uses blob: workers internally
              "worker-src 'self' blob:",

              // Sub-frames this app may load
              "frame-src 'self' https:",

              // Who can embed THIS app in an <iframe>
              "frame-ancestors 'self' https://dzinlynxt.com https://mydesigns.pro http://localhost http://localhost:80 http://127.0.0.1 http://127.0.0.1:80 http://dzinly-enterprise.me",

              // Security hardening
              "object-src 'none'",
              "base-uri 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;