// Rate Limiting Middleware
// Implements token bucket algorithm for API rate limiting
// Uses Redis (Upstash) in production, falls back to in-memory for development

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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

// Rate limit configurations per endpoint pattern
const RATE_LIMITS: Record<string, RateLimitConfig> = {
    '/api/orders': { maxRequests: 10, windowMs: 60000 }, // 10 requests per minute
    '/api/products': { maxRequests: 30, windowMs: 60000 }, // 30 requests per minute
    '/api/storefront': { maxRequests: 100, windowMs: 60000 }, // 100 requests per minute
    '/api/customers': { maxRequests: 20, windowMs: 60000 }, // 20 requests per minute
    '/api/auth': { maxRequests: 5, windowMs: 60000 }, // 5 requests per minute (stricter for auth)
    default: { maxRequests: 50, windowMs: 60000 }, // Default: 50 requests per minute
};

// ============================================================================
// Redis Rate Limiter (Production)
// ============================================================================

interface RedisClient {
    eval: (script: string, keys: string[], args: (string | number)[]) => Promise<[number, number]>;
}

let redisClient: RedisClient | null = null;

/**
 * Initialize Redis client for rate limiting
 * Uses Upstash Redis which works with serverless/edge environments
 */
async function getRedisClient(): Promise<RedisClient | null> {
    if (redisClient) return redisClient;

    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!redisUrl || !redisToken) {
        return null;
    }

    // Create a simple REST-based Redis client for Upstash
    redisClient = {
        eval: async (script: string, keys: string[], args: (string | number)[]): Promise<[number, number]> => {
            const response = await fetch(`${redisUrl}/eval`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${redisToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    script,
                    keys,
                    args,
                }),
            });

            if (!response.ok) {
                throw new Error(`Redis error: ${response.status}`);
            }

            const data = await response.json();
            return data.result as [number, number];
        },
    };

    return redisClient;
}

/**
 * Lua script for atomic rate limiting with sliding window
 * Returns: [allowed (0 or 1), remaining count]
 */
const RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

-- Remove old entries outside the window
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)

-- Count current requests in window
local count = redis.call('ZCARD', key)

if count < limit then
    -- Add current request
    redis.call('ZADD', key, now, now .. '-' .. math.random())
    redis.call('EXPIRE', key, math.ceil(window / 1000))
    return {1, limit - count - 1}
else
    return {0, 0}
end
`;

async function checkRateLimitRedis(
    identifier: string,
    pathname: string,
    config: RateLimitConfig
): Promise<RateLimitResult | null> {
    try {
        const client = await getRedisClient();
        if (!client) return null;

        const key = `ratelimit:${identifier}:${pathname}`;
        const now = Date.now();

        const [allowed, remaining] = await client.eval(
            RATE_LIMIT_SCRIPT,
            [key],
            [config.maxRequests, config.windowMs, now]
        );

        return {
            allowed: allowed === 1,
            limit: config.maxRequests,
            remaining: Math.max(0, remaining),
            resetTime: now + config.windowMs,
        };
    } catch (error) {
        console.error('Redis rate limit error:', error);
        return null; // Fall back to in-memory
    }
}

// ============================================================================
// In-Memory Rate Limiter (Fallback/Development)
// ============================================================================

// In-memory store for rate limiting (fallback when Redis is unavailable)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimitMemory(
    identifier: string,
    pathname: string,
    config: RateLimitConfig
): RateLimitResult {
    const key = `${identifier}:${pathname}`;
    const now = Date.now();

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

// ============================================================================
// Public API
// ============================================================================

/**
 * Get client identifier (IP address or user ID)
 */
function getClientIdentifier(request: NextRequest): string {
    // Try to get IP from various headers (for proxies/load balancers)
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const cfConnectingIp = request.headers.get('cf-connecting-ip'); // Cloudflare
    const ip = cfConnectingIp || forwarded?.split(',')[0] || realIp || 'unknown';

    return ip.trim();
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
 * Check if request should be rate limited
 * Uses Redis if available, falls back to in-memory
 */
export async function checkRateLimit(request: NextRequest): Promise<RateLimitResult> {
    const identifier = getClientIdentifier(request);
    const pathname = request.nextUrl.pathname;
    const config = getRateLimitConfig(pathname);

    // Try Redis first (production)
    const redisResult = await checkRateLimitRedis(identifier, pathname, config);
    if (redisResult) {
        return redisResult;
    }

    // Fall back to in-memory (development or Redis unavailable)
    return checkRateLimitMemory(identifier, pathname, config);
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
    response.headers.set('Retry-After', Math.ceil((resetTime - Date.now()) / 1000).toString());

    return response;
}

/**
 * Cleanup old entries from in-memory store (call periodically)
 */
export function cleanupRateLimitStore(): void {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
        if (now > entry.resetTime) {
            rateLimitStore.delete(key);
        }
    }
}

// Cleanup every 5 minutes (only in Node.js environment)
if (typeof setInterval !== 'undefined') {
    setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
}

/**
 * Check if Redis rate limiting is available
 */
export async function isRedisRateLimitingAvailable(): Promise<boolean> {
    try {
        const client = await getRedisClient();
        return client !== null;
    } catch {
        return false;
    }
}
