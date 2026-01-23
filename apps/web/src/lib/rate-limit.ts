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
  '/api/wallet': { maxRequests: 5, windowMs: 60000 }, // 5 requests per minute (sensitive financial operations)
  '/api/orders': { maxRequests: 10, windowMs: 60000 }, // 10 requests per minute
  '/api/products': { maxRequests: 30, windowMs: 60000 }, // 30 requests per minute
  '/api/storefront': { maxRequests: 100, windowMs: 60000 }, // 100 requests per minute
  '/api/customers': { maxRequests: 20, windowMs: 60000 }, // 20 requests per minute
  default: { maxRequests: 50, windowMs: 60000 }, // Default: 50 requests per minute
};

// =============================================================================
// IP VALIDATION (Edge-compatible, no Node.js 'net' module)
// =============================================================================

// IPv4 regex pattern
const IPV4_REGEX =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

// IPv6 regex pattern (simplified, covers most common formats)
const IPV6_REGEX =
  /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^[0-9a-fA-F]{1,4}::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,7}:$|^::$/;

/**
 * Validate if a string is a valid IP address (IPv4 or IPv6)
 */
function isValidIP(ip: string): boolean {
  return IPV4_REGEX.test(ip) || IPV6_REGEX.test(ip);
}

// =============================================================================
// TRIE-BASED PREFIX MATCHING
// =============================================================================

/**
 * Trie node for O(k) prefix pattern matching (k = path depth)
 */
class TrieNode {
  children: Map<string, TrieNode>;
  config: RateLimitConfig | null;
  constructor() {
    this.children = new Map();
    this.config = null;
  }
}

/**
 * Builds a Trie from the RATE_LIMITS object for prefix matching
 */
function buildTrie(patterns: Record<string, RateLimitConfig>): TrieNode {
  const root = new TrieNode();
  for (const [pattern, config] of Object.entries(patterns)) {
    if (pattern === 'default') continue;
    const segments = pattern.split('/').filter(Boolean);
    let node = root;
    for (const segment of segments) {
      if (!node.children.has(segment)) {
        node.children.set(segment, new TrieNode());
      }
      const childNode = node.children.get(segment);
      if (childNode) node = childNode;
    }
    node.config = config;
  }
  return root;
}

// Build the Trie once at module load
const rateLimitTrie = buildTrie(RATE_LIMITS);

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Maximum store size to prevent unbounded memory growth
const MAX_STORE_SIZE = 10000;

// Batch size for incremental pruning to avoid blocking event loop
const PRUNE_BATCH_SIZE = 100;

/**
 * Get client identifier (IP address)
 * Validates IP format to prevent header spoofing bypasses
 */
function getClientIdentifier(request: NextRequest): string {
  // Try to get IP from various headers (for proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');

  // Get first valid forwarded IP if header exists
  if (forwarded) {
    const ips = forwarded.split(',').map((ip) => ip.trim());
    const validIp = ips.find((ip) => isValidIP(ip));
    if (validIp) return validIp;
  }

  // Check x-real-ip header
  if (realIp && isValidIP(realIp)) {
    return realIp;
  }

  // Fallback if no valid IP found
  return 'unknown';
}

/**
 * Get rate limit config for the endpoint using Trie lookup
 * O(k) where k is the path depth, instead of O(n) pattern iteration
 */
function getRateLimitConfig(pathname: string): RateLimitConfig {
  const segments = pathname.split('/').filter(Boolean);
  let node = rateLimitTrie;
  let lastConfig: RateLimitConfig | null = null;

  for (const segment of segments) {
    const childNode = node.children.get(segment);
    if (childNode) {
      node = childNode;
      if (node.config) lastConfig = node.config;
    } else {
      break;
    }
  }

  return lastConfig ?? RATE_LIMITS.default;
}

/**
 * Incremental pruning to avoid blocking the event loop
 * Only prunes PRUNE_BATCH_SIZE entries per invocation
 */
function pruneStore(now: number): void {
  if (rateLimitStore.size < MAX_STORE_SIZE) return;

  let pruned = 0;
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
      pruned++;
      if (pruned >= PRUNE_BATCH_SIZE) break;
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

  // Incremental pruning on each request
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
 * Uses Math.max(0, ...) to ensure non-negative Retry-After values
 */
export function createRateLimitResponse(
  limit: number,
  remaining: number,
  resetTime: number
): NextResponse {
  // Ensure non-negative retryAfter per HTTP spec
  const retryAfterSeconds = Math.max(
    0,
    Math.ceil((resetTime - Date.now()) / 1000)
  );

  const response = NextResponse.json(
    {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: retryAfterSeconds,
    },
    { status: 429 }
  );

  response.headers.set('X-RateLimit-Limit', limit.toString());
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  response.headers.set('X-RateLimit-Reset', new Date(resetTime).toISOString());
  response.headers.set('Retry-After', retryAfterSeconds.toString());

  return response;
}

/**
 * Cleanup old entries (call periodically)
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Cleanup every 5 minutes (only in environments that support setInterval)
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
}
