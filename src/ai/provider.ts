import { createGoogleGenerativeAI } from '@ai-sdk/google';

// Configure Google AI provider with API key from environment
const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY,
});

/**
 * Gemini Model Exports (Vercel AI SDK)
 *
 * Model Selection Guide:
 * - geminiFlash: Fast, cost-effective. Use for simple tasks (descriptions, autofill)
 * - geminiPro: More capable. Use for complex reasoning (analytics insights, builder)
 * - gemini25FlashImage: Multimodal model for text, image understanding, AND image generation
 *   Use with providerOptions: { google: { responseModalities: ['TEXT', 'IMAGE'] } }
 */

// Primary models
export const geminiFlash = google('gemini-2.0-flash'); // Fast, cheap - for simple tasks
export const geminiPro = google('gemini-2.0-flash'); // Alias for flash (upgrade to gemini-2.0-pro if needed)

// Multimodal model - handles text, image understanding, and image generation
// Free tier: 500 images/day with gemini-2.5-flash-preview-image
export const gemini25FlashImage = google('gemini-2.5-flash-preview-image');

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
};

/**
 * In-memory rate limiter for AI requests
 * Uses a sliding window approach
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
 * Sanitize user input for AI prompts to prevent prompt injection
 */
export function sanitizePromptInput(input: string, maxLength: number = 500): string {
    if (!input) return '';

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
    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized;
}
