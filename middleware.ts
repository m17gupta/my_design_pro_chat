import { NextResponse, type NextRequest } from 'next/server';

export function middleware(_req: NextRequest) {
  const res = NextResponse.next();

  // Remove X-Frame-Options so the app can be embedded in iframes
  res.headers.delete('X-Frame-Options');

  // CSP is handled entirely by Nginx — do NOT set it here.
  // Setting it here would create a duplicate (and conflicting) CSP header
  // alongside the one Nginx adds, causing the browser to enforce both
  // (most restrictive wins), which breaks inline scripts/styles.

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
