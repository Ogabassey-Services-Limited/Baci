import { streamText } from 'ai';
import { geminiFlash, checkRateLimit, AI_RATE_LIMITS } from '@/ai/provider';
import {
    SANTA_SYSTEM_INSTRUCTION,
    SANTA_ERROR_MESSAGES,
} from '@/ai/prompts/santa';

export const runtime = 'edge';
export const maxDuration = 30;

/**
 * Santa Chat API Route
 *
 * POST /api/chat/santa
 * Body: { messages: Array<{ role: 'user' | 'assistant', content: string }> }
 *
 * Returns a streaming text response from the Santa chatbot.
 */
export async function POST(req: Request) {
    try {
        // Get user identifier for rate limiting (use IP or session)
        const forwarded = req.headers.get('x-forwarded-for');
        const ip = forwarded?.split(',')[0] ?? 'anonymous';
        const rateLimitKey = `santa-chat:${ip}`;

        // Check rate limit (use builder limits for now - 10 req/min)
        const rateLimit = checkRateLimit(rateLimitKey, AI_RATE_LIMITS.builder);
        if (!rateLimit.allowed) {
            return new Response(
                JSON.stringify({
                    error: 'Too many requests',
                    message:
                        "Ho ho ho! Santa's workshop is very busy right now. Please try again in a moment!",
                    resetIn: rateLimit.resetIn,
                }),
                { status: 429, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const { messages } = await req.json();

        if (!messages || !Array.isArray(messages)) {
            return new Response(
                JSON.stringify({ error: 'Messages array is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Stream the response using Vercel AI SDK
        const result = streamText({
            model: geminiFlash,
            system: SANTA_SYSTEM_INSTRUCTION,
            messages,
        });

        // Return the streaming response
        return result.toTextStreamResponse();
    } catch (error) {
        console.error('[Santa Chat] Error:', error);
        return new Response(
            JSON.stringify({
                error: 'Internal server error',
                message: SANTA_ERROR_MESSAGES.general,
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
