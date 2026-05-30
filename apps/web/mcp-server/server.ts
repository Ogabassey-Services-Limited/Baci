import { escapeHtml } from "./escape-html";
import { widgetHtml } from "./widget-html";
/**
 * Ogabassey ChatGPT MCP Server
 *
 * Production-ready MCP server following 2025 security best practices:
 * - Rate limiting per IP
 * - Input validation & sanitization
 * - Audit logging
 * - Proper error handling (fail closed)
 * - Security headers
 * - Request size limits
 *
 * Run with: npx tsx mcp-server/server.ts
 */

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import 'dotenv/config';
import {
  AGENTIC_CHECKOUT_AGENT_ID,
  type AgenticCheckoutClientConfig,
  type AgenticCheckoutSessionRequestResult,
  cancelAgenticCheckoutSession,
  cancelAgenticCheckoutSessionInputSchema,
  completeAgenticCheckoutSession,
  completeAgenticCheckoutSessionInputSchema,
  createAgenticCheckoutSession,
  createAgenticCheckoutSessionMcpInputSchema,
  getAgenticCheckoutSession,
  getAgenticCheckoutSessionInputSchema,
  updateAgenticCheckoutSession,
  updateAgenticCheckoutSessionMcpInputSchema,
} from './agentic-checkout-client';
import { registerAgenticUcpTools } from './agentic-ucp-tools';

// =============================================================================
// CONFIGURATION
// =============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OGABASSEY_SLUG = 'ogabassey';
const PORT = Number(process.env.MCP_PORT ?? 8787);
const MCP_PATH = '/mcp';
const AGENTIC_CHECKOUT_API_BASE_URL =
  process.env.MCP_AGENTIC_CHECKOUT_BASE_URL ?? 'https://ogabassey.com';
const AGENTIC_CHECKOUT_API_KEY = process.env.OPENAI_AGENTIC_API_KEY;
const AGENTIC_CHECKOUT_SIGNING_KEY = process.env.OPENAI_AGENTIC_SIGNING_KEY;

type ConfiguredAgenticCheckoutClientConfig = AgenticCheckoutClientConfig & {
  apiKey: string;
  signingKey: string;
};

function getAgenticCheckoutClientConfig():
  | ConfiguredAgenticCheckoutClientConfig
  | null {
  if (!AGENTIC_CHECKOUT_API_KEY || !AGENTIC_CHECKOUT_SIGNING_KEY) {
    return null;
  }

  return {
    agentId: AGENTIC_CHECKOUT_AGENT_ID,
    apiBaseUrl: AGENTIC_CHECKOUT_API_BASE_URL,
    apiKey: AGENTIC_CHECKOUT_API_KEY,
    signingKey: AGENTIC_CHECKOUT_SIGNING_KEY,
  };
}

function buildAgenticCheckoutErrorResponse({
  action,
  result,
}: {
  action: string;
  result: Extract<AgenticCheckoutSessionRequestResult, { ok: false }>;
}) {
  return {
    content: [
      {
        type: 'text' as const,
        text: `❌ Unable to ${action}: ${result.error}`,
      },
    ],
    structuredContent: {
      details: result.details ?? null,
      endpoint: result.endpoint ?? null,
      error: result.error,
      idempotency_key: result.idempotencyKey ?? null,
      request_id: result.requestId ?? null,
      status: 'error',
      status_code: result.status,
    },
  };
}

function getCheckoutSessionField(response: unknown, field: string) {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    return undefined;
  }

  const value = Object.getOwnPropertyDescriptor(response, field)?.value;
  return typeof value === 'string' ? value : undefined;
}

// Security settings
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60; // 60 requests per minute per IP
const RATE_LIMIT_MAX_ENTRIES = 10_000; // Max unique IPs to track (prevent memory exhaustion)

const REQUEST_TIMEOUT_MS = 30_000; // 30 second timeout

// Validate required environment variables at startup (fail closed)
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('FATAL: Missing required environment variables');
  console.error(
    'Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY'
  );
  process.exit(1);
}

// Create Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// =============================================================================
// RATE LIMITING
// =============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

function getClientIP(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

function checkRateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    // Check if we're at capacity - if so, clean expired entries first
    if (rateLimitMap.size >= RATE_LIMIT_MAX_ENTRIES) {
      // Emergency cleanup: remove all expired entries
      for (const [existingIp, existingEntry] of rateLimitMap.entries()) {
        if (now > existingEntry.resetAt) {
          rateLimitMap.delete(existingIp);
        }
      }
      // If still at capacity after cleanup, reject new IPs (DDoS protection)
      if (rateLimitMap.size >= RATE_LIMIT_MAX_ENTRIES) {
        console.warn(
          JSON.stringify({
            type: 'security',
            event: 'rate_limit_capacity',
            ip: ip.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, '$1.$2.xxx.xxx'),
          })
        );
        return {
          allowed: false,
          remaining: 0,
          resetAt: now + RATE_LIMIT_WINDOW_MS,
        };
      }
    }
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_REQUESTS - 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    };
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - entry.count,
    resetAt: entry.resetAt,
  };
}

// Cleanup old rate limit entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [ip, entry] of rateLimitMap.entries()) {
      if (now > entry.resetAt) {
        rateLimitMap.delete(ip);
      }
    }
  },
  5 * 60 * 1000
);

// =============================================================================
// AUDIT LOGGING
// =============================================================================

interface AuditLogEntry {
  timestamp: string;
  requestId: string;
  ip: string;
  method: string;
  path: string;
  tool?: string;
  statusCode: number;
  durationMs: number;
  error?: string;
}

function logAudit(entry: AuditLogEntry): void {
  // Redact sensitive data, log structured JSON for easy parsing
  const sanitized = {
    ...entry,
    ip: entry.ip.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, '$1.$2.xxx.xxx'), // Partial IP for privacy
  };
  console.log(JSON.stringify({ type: 'audit', ...sanitized }));
}

function logError(requestId: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  // Never log stack traces in production (could leak sensitive info)
  console.error(
    JSON.stringify({
      type: 'error',
      requestId,
      message,
      timestamp: new Date().toISOString(),
    })
  );
}

// =============================================================================
// INPUT VALIDATION & SANITIZATION
// =============================================================================

// Sanitize string input to prevent injection attacks
function sanitizeString(input: string, maxLength = 200): string {
  if (typeof input !== 'string') return '';
  return input
    .slice(0, maxLength)
    .replace(/[\x00-\x1f]/g, '') // Remove null bytes and control characters
    .replace(/[<>"'`\\;]/g, '') // Remove potentially dangerous chars including semicolons and backslashes
    .trim();
}

// Validate and sanitize price input
function sanitizePrice(price: unknown): number | undefined {
  if (typeof price !== 'number') return undefined;
  if (price < 0 || price > 1_000_000_000) return undefined; // Max 1 billion NGN
  return Math.floor(price);
}

// Validate order number format
function isValidOrderNumber(orderNumber: string): boolean {
  // Expected format: ORD-XXXXX or similar
  return /^[A-Z0-9-]{3,20}$/i.test(orderNumber);
}

// Validate phone number format (basic)
function isValidPhone(phone: string): boolean {
  return /^[0-9+\-\s]{7,20}$/.test(phone);
}

// =============================================================================
// SECURITY HEADERS
// =============================================================================

function setSecurityHeaders(res: ServerResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

let cachedMerchantId: string | null = null;
let merchantIdCacheTime = 0;
const MERCHANT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getMerchantId(): Promise<string | null> {
  const now = Date.now();
  if (cachedMerchantId && now - merchantIdCacheTime < MERCHANT_CACHE_TTL) {
    return cachedMerchantId;
  }

  try {
    const { data, error } = await supabase
      .from('merchants')
      .select('id')
      .eq('slug', OGABASSEY_SLUG)
      .single();

    if (error) {
      console.error(
        JSON.stringify({
          type: 'error',
          context: 'getMerchantId',
          message: error.message,
        })
      );
      // On error, invalidate cache and return null
      cachedMerchantId = null;
      return null;
    }

    cachedMerchantId = data?.id || null;
    merchantIdCacheTime = now;
    return cachedMerchantId;
  } catch (err) {
    console.error(
      JSON.stringify({
        type: 'error',
        context: 'getMerchantId',
        message: err instanceof Error ? err.message : 'Unknown error',
      })
    );
    cachedMerchantId = null;
    return null;
  }
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(price);
}

/**
 * Ensure image URL is in a format ChatGPT can render.
 * - Converts .avif to .jpg (ChatGPT may not support AVIF)
 * - Fixes path mismatch: database has /products/, CDN has /core-assets/products/
 */
function ensureJpgImageUrl(
  imageUrl: string | null | undefined
): string | undefined {
  if (!imageUrl) return undefined;

  let url = String(imageUrl);

  // If it's a relative path or doesn't start with https, make it absolute
  if (!url.startsWith('https://')) {
    if (url.startsWith('/')) {
      url = `https://cdn.ogabassey.com${url}`;
    } else {
      url = `https://cdn.ogabassey.com/${url}`;
    }
  }

  // Fix path mismatch: database stores /products/ but CDN serves from /core-assets/products/
  if (url.includes('/products/') && !url.includes('/core-assets/products/')) {
    url = url.replace('/products/', '/core-assets/products/');
  }

  // Convert AVIF to JPG for better compatibility
  if (url.endsWith('.avif')) {
    url = url.replace(/\.avif$/, '.jpg');
  }

  return url;
}

// =============================================================================
// WIDGET HTML (CSP-compliant, no inline event handlers in production)
// =============================================================================

