import type { NextConfig } from "next";

/**
 * Origins allowed to embed this app in an <iframe>.
 *
 * The chat UI runs inside the PHP site at https://luna.dzinlynxt.com and
 * talks to its parent page via `window.parent.postMessage`, so the parent
 * origin must be whitelisted here via the CSP `frame-ancestors` directive
 * (the modern replacement for the deprecated `X-Frame-Options` header).
 * `'self'` keeps same-origin embedding working.
 */
const IFRAME_ANCESTORS = ["'self'", "https://luna.dzinlynxt.com"];

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
