import { createCerebras } from '@ai-sdk/cerebras';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';

// Configure Google AI provider with API key from environment
const google = createGoogleGenerativeAI({
  apiKey:
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

/**
 * Gemini Model Exports (Vercel AI SDK)
 *
 * Model Selection Guide:
 * - activeTextModel: Standard Gemini 2.5 Flash text model
 * - fallbackTextModel: Gemini 2.5 Flash-Lite, used when the primary model's
 *   quota pool is exhausted (free-tier daily quotas are per model)
 * - geminiFlash / geminiPro: Aliases to the primary text model
 * - gemini25FlashImage: Multimodal model for text, image understanding, AND image generation
 *   Use with providerOptions: { google: { responseModalities: ['TEXT', 'IMAGE'] } }
 */

// Primary text model - Gemini 2.5 Flash.
// Do NOT move this back to the 2.0 family: Google zeroed gemini-2.0-flash's
// free-tier quota (429 "generate_content_free_tier_input_token_count,
// limit: 0" — probed against the production key on 2026-07-06), which made
// every text surface (AI copilot, chat, product descriptions) fail 100% of
// the time on a free-tier key. The 2.5 family carries the free-tier quota.
export const ACTIVE_TEXT_MODEL_NAME = 'gemini-2.5-flash';
const primaryTextModel = google(ACTIVE_TEXT_MODEL_NAME);

// Quota fallback: free-tier requests-per-day pools are PER MODEL, so when the
// primary model's daily pool runs dry a flash-lite retry keeps AI editing
// alive instead of dead-ending merchants (a Play "Broken Functionality"
// repeat offender). Flash-Lite also has the largest free-tier RPD of the family.
export const FALLBACK_TEXT_MODEL_NAME = 'gemini-2.5-flash-lite';
export const fallbackTextModel = google(FALLBACK_TEXT_MODEL_NAME);

// ---------------------------------------------------------------------------
// AI Copilot text-provider chain (builder route)
//
// Order: Cerebras Gemma (fastest; free 1M tokens/day) → Groq gpt-oss-120b
// (free 14,400 req/day; supports the strict json_schema response format the
// AI SDK uses — Groq's Llama models do not) → Gemini 2.5 Flash → Flash-Lite.
// The Cerebras/Groq entries only join the chain when their API keys are
// configured, so environments without those keys keep the Gemini-only
// behavior. Independent free pools across several infrastructures mean AI
// editing keeps working even when any one provider is down or
// quota-exhausted — no Google billing dependency.
//
// Measured on the real copilot task (production keys, 2026-07-07):
// cerebras/gemma-4-31b 0.6-0.8s, groq/gpt-oss-120b 1-3s, gemini-2.5-flash
// 3-4s — all returned correct, structure-preserving JSON via json mode.
// Note: Cerebras' free tier caps context at ~8K tokens; oversized configs
// fail fast there and fall through to Groq/Gemini (131K/1M context).
export const COPILOT_CEREBRAS_MODEL = 'gemma-4-31b';
export const COPILOT_GROQ_MODEL = 'openai/gpt-oss-120b';
// OpenRouter's free Gemma 4 pool is heavily contended (probes on 2026-07-07
// hit upstream 429 "temporarily rate-limited" consistently), so it sits LAST:
// a bonus free Gemma-4 pool (262K context) that is only consulted when every
// other provider has already failed — it can only help, never slow the chain.
export const COPILOT_OPENROUTER_MODEL = 'google/gemma-4-31b-it:free';

export interface CopilotTextProvider {
  /** Stable identifier for logs/metrics, e.g. "cerebras:gemma-4-31b". */
  name: string;
  model: LanguageModel;
}

const cerebrasApiKey = process.env.CEREBRAS_API_KEY?.trim();
const groqApiKey = process.env.GROQ_API_KEY?.trim();
const openRouterApiKey = process.env.OPENROUTER_API_KEY?.trim();

const cerebras = cerebrasApiKey
  ? createCerebras({ apiKey: cerebrasApiKey })
  : null;
const groq = groqApiKey ? createGroq({ apiKey: groqApiKey }) : null;
const openRouter = openRouterApiKey
  ? createOpenAICompatible({
      name: 'openrouter',
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: openRouterApiKey,
    })
  : null;

export function getCopilotTextProviderChain(): CopilotTextProvider[] {
  const chain: CopilotTextProvider[] = [];
  if (cerebras) {
    chain.push({
      name: `cerebras:${COPILOT_CEREBRAS_MODEL}`,
      model: cerebras(COPILOT_CEREBRAS_MODEL),
    });
  }
  if (groq) {
    chain.push({
      name: `groq:${COPILOT_GROQ_MODEL}`,
      model: groq(COPILOT_GROQ_MODEL),
    });
  }
  chain.push({
    name: `google:${ACTIVE_TEXT_MODEL_NAME}`,
    model: activeTextModel,
  });
  chain.push({
    name: `google:${FALLBACK_TEXT_MODEL_NAME}`,
    model: fallbackTextModel,
  });
  if (openRouter) {
    chain.push({
      name: `openrouter:${COPILOT_OPENROUTER_MODEL}`,
      model: openRouter(COPILOT_OPENROUTER_MODEL),
    });
  }
  return chain;
}

// UNIFIED MODEL EXPORTS - USE THESE FOR NEW FEATURES
// --------------------------------------------------------------------------
export const activeTextModel = primaryTextModel; // The single standard text model for the platform
export const activeImageModel = google('gemini-2.5-flash-image'); // Fast, cost-effective image generation
// --------------------------------------------------------------------------

// Legacy / Specific Aliases (Prefer activeTextModel where possible)
export const geminiFlash = primaryTextModel; // Alias for backwards compatibility
export const geminiPro = primaryTextModel; // Alias for pro-level tasks

// Legacy models (kept for fallback)
export const gemini25Flash = primaryTextModel; // Alias — 2.5 Flash is now the primary model

// Image generation models (December 2025)
// Image generation models (December 2025)
// alias for compatibility
const gemini25FlashImage = activeImageModel;

export { gemini25FlashImage };
export const gemini3ProImage = google('gemini-3-pro-image-preview'); // High quality image gen (Nano Banana Pro)

// Imagen 3 model for dedicated image generation (legacy)
// Note: Use 002 version for Google AI API (001 is only available in Vertex AI)
export const imagen3 = google.image('imagen-3.0-generate-002');

/**
 * Rate Limiting Configuration
 * Prevents API abuse and manages costs
 */
export const AI_RATE_LIMITS = {
  // Per-user limits (requests per minute)
  builder: { requests: 10, windowMs: 60 * 1000 },
  productDescription: { requests: 20, windowMs: 60 * 1000 },
  autofill: { requests: 30, windowMs: 60 * 1000 },
  insights: { requests: 5, windowMs: 60 * 1000 },
  imageGeneration: { requests: 5, windowMs: 60 * 1000 },
  santa: { requests: 1000, windowMs: 60 * 1000 },
  faqGeneration: { requests: 5, windowMs: 60 * 1000 },
};

/**
 * In-memory rate limiter for AI requests
 * Uses a sliding window approach
 *
 * LIMITATION: This store lives in process memory. In serverless environments
 * (Vercel Functions), each cold start creates a fresh Map, so rate limits
 * reset when the instance is recycled. For stricter enforcement, migrate
 * to Vercel KV or Upstash Redis with sliding-window counters.
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  identifier: string,
  limitConfig: { requests: number; windowMs: number }
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  // Clean up expired entries periodically
  if (rateLimitStore.size > 10000) {
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetTime < now) {
        rateLimitStore.delete(key);
      }
    }
  }

  if (!record || record.resetTime < now) {
    // New window
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + limitConfig.windowMs,
    });
    return {
      allowed: true,
      remaining: limitConfig.requests - 1,
      resetIn: limitConfig.windowMs,
    };
  }

  if (record.count >= limitConfig.requests) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: record.resetTime - now,
    };
  }

  record.count++;
  return {
    allowed: true,
    remaining: limitConfig.requests - record.count,
    resetIn: record.resetTime - now,
  };
}

/**
 * Retry configuration for AI requests
 *
 * Note: `maxRetries` means the number of additional attempts after the initial try.
 * Total attempts = 1 (initial) + maxRetries = 4 attempts with default config.
 */
export const AI_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Wrapper for AI calls with retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config = AI_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | null = null;
  let delay = config.initialDelayMs;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on non-retryable errors
      const errorMessage = lastError.message.toLowerCase();
      if (
        errorMessage.includes('invalid') ||
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('forbidden') ||
        errorMessage.includes('not found')
      ) {
        throw lastError;
      }

      if (attempt < config.maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs);
      }
    }
  }

  throw lastError;
}

/**
 * Result of sanitizing prompt input
 */
export interface SanitizeResult {
  value: string;
  metadata: {
    wasTruncated: boolean;
    originalLength: number;
    finalLength: number;
    limit: number;
  };
}

/**
 * Sanitize user input for AI prompts to prevent prompt injection
 * @returns Object with sanitized value and metadata about truncation
 */
export function sanitizePromptInput(
  input: string,
  maxLength: number = 500
): SanitizeResult {
  if (!input) {
    return {
      value: '',
      metadata: {
        wasTruncated: false,
        originalLength: 0,
        finalLength: 0,
        limit: maxLength,
      },
    };
  }

  const originalLength = input.length;

  let sanitized = input
    // Remove common prompt injection patterns
    .replace(/ignore (previous|all|above|prior) (instructions?|prompts?)/gi, '')
    .replace(/disregard (previous|all|above|prior)/gi, '')
    .replace(/forget (everything|all|previous)/gi, '')
    .replace(/new instructions?:/gi, '')
    .replace(/system:/gi, '')
    .replace(/assistant:/gi, '')
    .replace(/user:/gi, '')
    // Remove markdown/formatting that could affect prompt
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    .trim();

  // Limit length
  const wasTruncated = sanitized.length > maxLength;
  if (wasTruncated) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return {
    value: sanitized,
    metadata: {
      wasTruncated,
      originalLength,
      finalLength: sanitized.length,
      limit: maxLength,
    },
  };
}
