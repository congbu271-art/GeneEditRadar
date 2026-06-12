import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rate limit state (in-memory, per-instance)
const rateLimitStore = new Map<string, { timestamps: number[] }>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): { allowed: boolean; remaining: number } {
  let entry = rateLimitStore.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitStore.set(key, entry);
  }

  const now = Date.now();
  entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  entry.timestamps.push(now);
  return { allowed: true, remaining: maxRequests - entry.timestamps.length };
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Rate limiting for /api/analyze
  if (request.nextUrl.pathname === "/api/analyze" && request.method === "POST") {
    const ip = getClientIp(request);
    const { allowed, remaining } = checkRateLimit(ip, 30, 60_000);

    response.headers.set("X-RateLimit-Limit", "30");
    response.headers.set("X-RateLimit-Remaining", String(remaining));

    if (!allowed) {
      return NextResponse.json(
        { error: "请求过于频繁，请稍后再试。" },
        { status: 429, headers: response.headers },
      );
    }
  }

  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
