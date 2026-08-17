// Distributed Rate Limiting
// Uses Upstash Redis (shared across all Vercel instances) with in-memory fallback.
// Sliding window algorithm via @upstash/ratelimit SDK.

import { Ratelimit } from '@upstash/ratelimit';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getRedis } from './redis';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
}

// ---------------------------------------------------------------------------
// Route-specific limits (same as before)
// ---------------------------------------------------------------------------

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Migration preview validation polls the active job about once per second.
  // Keep this prefix above the default ceiling so the UI can stream progress
  // without tripping middleware rate limiting during normal use.
  '/api/import-jobs': { maxRequests: 240, windowMs: 60_000 },
  // Anonymous ad landings can arrive through carrier NAT bursts; the endpoint is
  // cheap and only returns validated Set-Cookie headers, so keep it above the
  // generic API ceiling to avoid losing paid-click attribution.
  '/api/attr': { maxRequests: 1000, windowMs: 60_000 },
  '/api/orders': { maxRequests: 10, windowMs: 60_000 },
  '/api/products': { maxRequests: 30, windowMs: 60_000 },
  '/api/storefront': { maxRequests: 100, windowMs: 60_000 },
  '/api/storefront/negotiation-evidence': {
    maxRequests: 10,
    windowMs: 60_000,
  },
  '/api/storefront/imei-check': { maxRequests: 10, windowMs: 60_000 },
  '/api/storefront/auth/send-code': { maxRequests: 3, windowMs: 60_000 },
  '/api/storefront/auth/verify-code': { maxRequests: 5, windowMs: 60_000 },
  '/api/customers': { maxRequests: 20, windowMs: 60_000 },
  '/api/newsletter': { maxRequests: 5, windowMs: 900_000 },
  '/api/wallet': { maxRequests: 5, windowMs: 60_000 },
  '/api/payments/credit-direct/sign': { maxRequests: 5, windowMs: 60_000 },
  // Quiz: the Gemma generation route is an expensive AI call, and the claim
  // routes mint real prizes/cash — keep both well below the per-IP default.
  '/api/merchant/quiz/generate': { maxRequests: 5, windowMs: 60_000 },
  // Activation is a cheap DB status flip on its own path so it never competes
  // with the generation bucket — an admin can generate several drafts, then
  // review and open one without being throttled by the AI-call limit.
  '/api/merchant/quiz/activate': { maxRequests: 20, windowMs: 60_000 },
  '/api/quiz/attempts/start': { maxRequests: 20, windowMs: 60_000 },
  // A player refreshes live standings and pending results on a bounded timer.
  // Keep those quiz-specific buckets separate from unrelated API traffic so
  // players behind one carrier NAT do not exhaust the generic per-IP budget.
  '/api/quiz/attempts': { maxRequests: 120, windowMs: 60_000 },
  '/api/quiz/leaderboard': { maxRequests: 120, windowMs: 60_000 },
  '/api/quiz/awards/cash/claim': { maxRequests: 10, windowMs: 60_000 },
  '/api/quiz/prizes/grand/claim': { maxRequests: 10, windowMs: 60_000 },
  default: { maxRequests: 50, windowMs: 60_000 },
};

const IMEI_POLL_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 120,
  windowMs: 60_000,
};

// ---------------------------------------------------------------------------
// IP validation (Edge-compatible, no Node.js 'net' module)
// ---------------------------------------------------------------------------

const IPV4_REGEX =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

const IPV6_REGEX =
  /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^[0-9a-fA-F]{1,4}::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,7}:$|^::$/;

function isValidIP(ip: string): boolean {
  return IPV4_REGEX.test(ip) || IPV6_REGEX.test(ip);
}

// ---------------------------------------------------------------------------
// Trie-based prefix matching (O(k) where k = path depth)
// ---------------------------------------------------------------------------

class TrieNode {
  children: Map<string, TrieNode>;
  config: RateLimitConfig | null;
  pattern: string | null;
  constructor() {
    this.children = new Map();
    this.config = null;
    this.pattern = null;
  }
}

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
    node.pattern = pattern;
  }
  return root;
}

const rateLimitTrie = buildTrie(RATE_LIMITS);

function getRateLimitConfig(pathname: string): {
  config: RateLimitConfig;
  pattern: string;
} {
  const segments = pathname.split('/').filter(Boolean);
  let node = rateLimitTrie;
  let lastConfig: RateLimitConfig | null = null;
  let lastPattern: string | null = null;

  for (const segment of segments) {
    const childNode = node.children.get(segment);
    if (childNode) {
      node = childNode;
      if (node.config) {
        lastConfig = node.config;
        lastPattern = node.pattern;
      }
    } else {
      break;
    }
  }

  return {
    config: lastConfig ?? RATE_LIMITS.default,
    pattern: lastPattern ?? 'default',
  };
}

// ---------------------------------------------------------------------------
// Client identifier (IP)
// ---------------------------------------------------------------------------

export function getClientIdentifier(request: NextRequest): string {
  // Prefer Next.js/Vercel trusted IP
  const requestWithIp = request as NextRequest & { ip?: string };
  const requestIp = requestWithIp.ip;
  if (requestIp && isValidIP(requestIp)) {
    return requestIp;
  }

  const realIp = request.headers.get('x-real-ip');
  const forwarded = request.headers.get('x-forwarded-for');

  if (realIp && isValidIP(realIp)) return realIp;

  if (forwarded) {
    const ips = forwarded.split(',').map((ip) => ip.trim());
    for (let i = ips.length - 1; i >= 0; i--) {
      const candidate = ips[i];
      if (candidate && isValidIP(candidate)) {
        return candidate;
      }
    }
  }

  return 'unknown';
}

// ---------------------------------------------------------------------------
// Upstash Ratelimit instances (one per unique config, created lazily)
// ---------------------------------------------------------------------------

const upstashLimiters = new Map<string, Ratelimit>();

function getUpstashLimiter(config: RateLimitConfig): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  const windowSeconds = `${Math.ceil(config.windowMs / 1000)} s` as const;
  const key = `${config.maxRequests}:${windowSeconds}`;

  let limiter = upstashLimiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.maxRequests, windowSeconds),
      prefix: 'baci:ratelimit',
      ephemeralCache: new Map(),
    });
    upstashLimiters.set(key, limiter);
  }
  return limiter;
}

// ---------------------------------------------------------------------------
// In-memory fallback (when Redis is unavailable)
// ---------------------------------------------------------------------------

const memoryStore = new Map<string, { count: number; resetTime: number }>();
const MAX_STORE_SIZE = 10_000;
const PRUNE_BATCH_SIZE = 100;

function pruneStore(now: number): void {
  if (memoryStore.size < MAX_STORE_SIZE) return;
  let pruned = 0;
  for (const [key, entry] of memoryStore) {
    if (now > entry.resetTime) {
      memoryStore.delete(key);
      pruned++;
      if (pruned >= PRUNE_BATCH_SIZE) break;
    }
  }
}

function checkMemoryRateLimit(
  identifier: string,
  pattern: string,
  config: RateLimitConfig
): RateLimitResult {
  const key = `${identifier}:${pattern}`;
  const now = Date.now();
  pruneStore(now);

  let entry = memoryStore.get(key);
  if (!entry || now > entry.resetTime) {
    entry = { count: 0, resetTime: now + config.windowMs };
  }

  entry.count++;
  memoryStore.set(key, entry);

  const allowed = entry.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);

  return {
    allowed,
    limit: config.maxRequests,
    remaining,
    resetTime: entry.resetTime,
  };
}

// ---------------------------------------------------------------------------
// Main entry point (async — uses Redis when available, memory fallback)
// ---------------------------------------------------------------------------

export function checkRateLimit(request: NextRequest): Promise<RateLimitResult> {
  const identifier = getClientIdentifier(request);
  const pathname = request.nextUrl.pathname;
  const { config, pattern } = getRateLimitConfig(pathname);

  return applyRateLimit(identifier, pattern, config);
}

async function applyRateLimit(
  identifier: string,
  pattern: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  // Try Upstash first
  const limiter = getUpstashLimiter(config);
  if (limiter) {
    try {
      const upstashKey = `${identifier}:${pattern}`;
      const result = await limiter.limit(upstashKey);
      return {
        allowed: result.success,
        limit: result.limit,
        remaining: result.remaining,
        resetTime: result.reset,
      };
    } catch {
      // Redis error — fall through to in-memory
    }
  }

  // Fallback to in-memory
  return checkMemoryRateLimit(identifier, pattern, config);
}

export function checkImeiPollRateLimit(
  request: NextRequest
): Promise<RateLimitResult> {
  return applyRateLimit(
    getClientIdentifier(request),
    '/api/storefront/imei-check/:lookupId:poll',
    IMEI_POLL_RATE_LIMIT
  );
}

// ---------------------------------------------------------------------------
// Response helper
// ---------------------------------------------------------------------------

export function createRateLimitResponse(
  limit: number,
  remaining: number,
  resetTime: number
): NextResponse {
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

// ---------------------------------------------------------------------------
// Cleanup (in-memory fallback only)
// ---------------------------------------------------------------------------

export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (now > entry.resetTime) {
      memoryStore.delete(key);
    }
  }
}

if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

export function __resetRateLimitStoreForTesting(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '__resetRateLimitStoreForTesting should only be called in test environment'
    );
  }
  memoryStore.clear();
  upstashLimiters.clear();
}
