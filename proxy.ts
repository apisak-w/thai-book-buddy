import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' https://*.line-scdn.net`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: https://*.line-scdn.net`,
    `font-src 'self' data:`,
    `connect-src 'self' https://*.supabase.co https://*.line.me https://*.line-scdn.net http://127.0.0.1:*`,
    `frame-src https://liff.line.me`,
    `frame-ancestors 'self' https://*.line.me`,
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files and images
    { source: "/((?!_next/static|_next/image|favicon.ico).*)" },
  ],
};
