import { NextRequest, NextResponse } from "next/server";
import { env } from "@/utils/env";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes

interface Entry {
  count: number;
  firstAttempt: number;
}

const failedAttempts = new Map<string, Entry>();

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Check admin password with rate limiting on failed attempts.
 * Returns a 401/429 Response if denied, or null if authorized.
 */
export function checkAdminAuth(req: NextRequest): NextResponse | null {
  const ip = getClientIp(req);
  const now = Date.now();

  // Clean up expired entry
  const entry = failedAttempts.get(ip);
  if (entry && now - entry.firstAttempt > WINDOW_MS) {
    failedAttempts.delete(ip);
  }

  // Check if locked out
  const current = failedAttempts.get(ip);
  if (current && current.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil(
      (WINDOW_MS - (now - current.firstAttempt)) / 1000
    );
    return NextResponse.json(
      { error: "Too many failed attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.max(retryAfter, 1)) },
      }
    );
  }

  // Check password
  if (req.headers.get("x-admin-password") !== env.ADMIN_PASSWORD) {
    const existing = failedAttempts.get(ip);
    if (existing) {
      existing.count++;
    } else {
      failedAttempts.set(ip, { count: 1, firstAttempt: now });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Success — clear failed attempts for this IP
  failedAttempts.delete(ip);
  return null;
}
