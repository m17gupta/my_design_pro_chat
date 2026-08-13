import type { NextConfig } from "next";

const IFRAME_ANCESTORS = [
  "'self'",
  "https://dzinlynxt.com",
  "https://mydesigns.pro",

  // Local development / PHP
  "http://localhost",
  "http://localhost:80",
  "http://127.0.0.1",
  "http://127.0.0.1:80",
  "http://dzinly-enterprise.me",
];

const nextConfig: NextConfig = {
  poweredByHeader: false,

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
        source: "/:path*",

        headers: [
          {
            key: "Content-Security-Policy",

            value: [
              /*
               * Domains allowed to embed this Next.js application.
               */
              `frame-ancestors ${IFRAME_ANCESTORS.join(" ")}`,

              /*
               * Default policy.
               */
              "default-src 'self' 'unsafe-inline' 'unsafe-eval' https:",

              /*
               * Next.js / application JavaScript.
               */
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",

              /*
               * Styles including Google Fonts stylesheets.
               */
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

              /*
               * Font files.
               */
              "font-src 'self' data: https://fonts.gstatic.com",

              /*
               * Fetch/XHR/WebSocket connections.
               *
               * wss: is important for Pusher/WebSockets.
               */
              "connect-src 'self' https: wss:",

              /*
               * Images.
               */
              "img-src 'self' data: blob: https://res.cloudinary.com https:",

              /*
               * Video/audio.
               */
              "media-src 'self' blob: https://res.cloudinary.com https:",

              /*
               * Web workers.
               */
              "worker-src 'self' blob:",

              /*
               * Frames this Next.js app itself may load.
               */
              "frame-src 'self' https:",
            ].join("; "),
          },

          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },

          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;