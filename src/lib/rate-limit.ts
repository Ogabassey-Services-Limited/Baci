// Rate Limiting Middleware
// Implements token bucket algorithm for API rate limiting
// Note: This implementation uses an in-memory store (`Map`).
// In a serverless/edge environment (like Vercel), this store is NOT shared across instances.
// It is effective for basic protection against single-instance floods but is not a global rate limiter.
// For production-grade global rate limiting, use Redis (e.g., Vercel KV or Upstash).

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

// Rate limit configurations per endpoint pattern
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  '/api/orders': { maxRequests: 10, windowMs: 60000 }, // 10 requests per minute
  '/api/products': { maxRequests: 30, windowMs: 60000 }, // 30 requests per minute
  '/api/storefront': { maxRequests: 100, windowMs: 60000 }, // 100 requests per minute
  '/api/customers': { maxRequests: 20, windowMs: 60000 }, // 20 requests per minute
  default: { maxRequests: 50, windowMs: 60000 }, // Default: 50 requests per minute
};

// In-memory store for rate limiting
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Maximum size for the map to prevent memory leaks in long-running containers
const MAX_STORE_SIZE = 10000;

/**
 * Get client identifier (IP address)
 */
function getClientIdentifier(request: NextRequest): string {
  // Try to get IP from various headers (for proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIp || 'unknown';

  return ip;
}

/**
 * Get rate limit config for the endpoint
 */
function getRateLimitConfig(pathname: string): RateLimitConfig {
  for (const [pattern, config] of Object.entries(RATE_LIMITS)) {
    if (pathname.startsWith(pattern)) {
      return config;
    }
  }
  return RATE_LIMITS.default;
}

/**
 * Prune expired entries from the store.
 * Only runs if the store gets too big to avoid blocking the event loop on every request.
 */
function pruneStore(now: number) {
  if (rateLimitStore.size < MAX_STORE_SIZE) return;

  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Check if request should be rate limited
 */
export function checkRateLimit(request: NextRequest): {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
} {
  const identifier = getClientIdentifier(request);
  const pathname = request.nextUrl.pathname;
  const config = getRateLimitConfig(pathname);

  const key = `${identifier}:${pathname}`;
  const now = Date.now();

  // Lazy prune if store is too large
  pruneStore(now);

  // Get or create rate limit entry
  let entry = rateLimitStore.get(key);

  // Reset if window has passed
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);

  // Check if limit exceeded
  const allowed = entry.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);

  return {
    allowed,
    limit: config.maxRequests,
    remaining,
    resetTime: entry.resetTime,
  };
}

/**
 * Create rate limit response
 */
export function createRateLimitResponse(
  limit: number,
  remaining: number,
  resetTime: number
): NextResponse {
  const response = NextResponse.json(
    {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
    },
    { status: 429 }
  );

  response.headers.set('X-RateLimit-Limit', limit.toString());
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  response.headers.set('X-RateLimit-Reset', new Date(resetTime).toISOString());
  response.headers.set(
    'Retry-After',
    Math.ceil((resetTime - Date.now()) / 1000).toString()
  );

  return response;
}
