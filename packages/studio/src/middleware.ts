import { NextRequest, NextResponse } from 'next/server';

/**
 * Sliding-window IP rate limiter.
 * Limits each IP to MAX_REQUESTS per WINDOW_MS across all API routes.
 * Uses server-process memory — appropriate for single-instance Railway deployment.
 * For multi-instance deployments, replace with a Redis-backed store (e.g., Upstash).
 */
const MAX_REQUESTS = 60;
const WINDOW_MS = 60_000; // 60 requests per minute per IP

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only apply rate limiting to API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const ip = getClientIp(req);
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetAt) {
    // Periodically prune expired entries if map grows large to prevent memory leaks
    if (rateLimitStore.size > 10_000) {
      for (const [key, value] of rateLimitStore.entries()) {
        if (now > value.resetAt) {
          rateLimitStore.delete(key);
        }
      }
    }
    rateLimitStore.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return NextResponse.next();
  }

  entry.count++;

  if (entry.count > MAX_REQUESTS) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded. Please wait before retrying.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000))
        }
      }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*']
};
