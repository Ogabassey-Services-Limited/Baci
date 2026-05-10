import { createGoogleGenerativeAI } from '@ai-sdk/google';

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
 * - gemini20Flash: Standard Gemini 2.0 Flash text model
 * - geminiFlash: Alias to Gemini 2.0 Flash for backwards compatibility
 * - geminiPro: Alias to Gemini 2.0 Flash
 * - gemini25Flash: Legacy Gemini 2.5 Flash (deprecated, kept for fallback)
 * - gemini25FlashImage: Multimodal model for text, image understanding, AND image generation
 *   Use with providerOptions: { google: { responseModalities: ['TEXT', 'IMAGE'] } }
 */

// Primary text model - Gemini 2.0 Flash
export const ACTIVE_TEXT_MODEL_NAME = 'gemini-2.0-flash';
const gemini20Flash = google(ACTIVE_TEXT_MODEL_NAME);

// UNIFIED MODEL EXPORTS - USE THESE FOR NEW FEATURES
// --------------------------------------------------------------------------
export const activeTextModel = gemini20Flash; // The single standard text model for the platform
export const activeImageModel = google('gemini-2.5-flash-image'); // Fast, cost-effective image generation
// --------------------------------------------------------------------------

// Legacy / Specific Aliases (Prefer activeTextModel where possible)
export const geminiFlash = gemini20Flash; // Alias for backwards compatibility
export const geminiPro = gemini20Flash; // Alias for pro-level tasks

// Legacy models (kept for fallback)
export const gemini25Flash = google('gemini-2.5-flash'); // Legacy Gemini 2.5 Flash

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
