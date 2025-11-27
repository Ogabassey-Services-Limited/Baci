import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import {
    geminiFlash,
    withRetry,
    checkRateLimit,
    AI_RATE_LIMITS,
} from '@/ai/provider';
import { cache, generateCacheKey } from '@/lib/cache';

// Schema for AI insights
const InsightSchema = z.object({
    insights: z.array(z.object({
        title: z.string(),
        description: z.string(),
        type: z.enum(['positive', 'negative', 'neutral', 'opportunity']),
        priority: z.enum(['high', 'medium', 'low']),
        action: z.string().optional().describe('Suggested action for the merchant'),
    })),
});

/**
 * Generate AI-driven insights for a merchant, applying rate limits and caching.
 *
 * Uses recent merchant data to produce 3–5 actionable insights (revenue trends, product performance, and channel effectiveness). Enforces per-user rate limits and returns a cached result when available.
 *
 * @param supabase - Supabase client instance for querying merchant data
 * @param merchantId - ID of the merchant to generate insights for
 * @param userId - ID of the requesting user (used for rate limiting)
 * @returns An object containing either:
 * - `data`: the generated insights matching `InsightSchema` (insights array), or
 * - `error`, `details`, and `status`: an error object when rate-limited or when generation fails
 */
async function generateInsights(supabase: ReturnType<typeof createClient>, merchantId: string, userId: string) {
    // Rate limiting
    const rateLimit = checkRateLimit(`insights:${userId}`, AI_RATE_LIMITS.insights);
    if (!rateLimit.allowed) {
        return {
            error: 'Rate limit exceeded',
            details: `Please wait ${Math.ceil(rateLimit.resetIn / 1000)} seconds before trying again.`,
            status: 429,
        };
    }

    // Generate cache key for AI insights (cached for 1 hour)
    const cacheKey = generateCacheKey('ai-insights', merchantId);

    // Try to get cached insights
    const cachedInsights = cache.get<{ insights: Array<{ title: string; description: string; type: string; priority: string; action?: string }> }>(cacheKey);
    if (cachedInsights) {
        return { data: cachedInsights };
    }

    // Fetch aggregated data for context
    // 1. Daily Sales Summary (Last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: salesHistory } = await supabase
        .from('daily_sales_summary')
        .select('*')
        .eq('merchant_id', merchantId)
        .gte('sale_date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('sale_date', { ascending: true });

    // 2. Product Performance (Top 10)
    const { data: productPerformance } = await supabase
        .from('product_performance')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('total_revenue', { ascending: false })
        .limit(10);

    // 3. Sales by Channel
    const { data: channelPerformance } = await supabase
        .from('sales_by_channel')
        .select('*')
        .eq('merchant_id', merchantId);

    // Prepare context for AI
    const context = {
        salesHistory: salesHistory || [],
        topProducts: productPerformance || [],
        channels: channelPerformance || [],
    };

    // Generate insights with retry logic
    const { object } = await withRetry(async () => {
        return await generateObject({
            model: geminiFlash,
            schema: InsightSchema,
            prompt: `
Analyze the following e-commerce data for a merchant and provide 3-5 actionable insights.
Focus on trends, opportunities for growth, and potential issues.

Data Context:
${JSON.stringify(context, null, 2)}

Provide insights in the following categories:
- Revenue trends (growth, decline, stability)
- Product performance (bestsellers, underperformers)
- Channel effectiveness

Be specific and constructive.
      `,
        });
    });

    // Cache the insights for 1 hour (3600 seconds)
    cache.set(cacheKey, object, 3600);

    return { data: object };
}

/**
 * Handle GET requests by authenticating the user, locating their merchant, and returning AI-generated insights for that merchant.
 *
 * Attempts to authenticate via Supabase cookies, queries the merchant record for the authenticated user, invokes the internal insights generation flow, and responds with the generated insights or a structured error.
 *
 * @returns JSON response: on success the generated insights object; on failure an error object with an `error` message and optional `details`, returned with an appropriate HTTP status (e.g., 401 for unauthorized, 404 for merchant not found, 429 for rate limiting from the insights generator, 500 for internal errors).
 */
export async function GET() {
    try {
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get merchant
        const { data: merchant, error: merchantError } = await supabase
            .from('merchants')
            .select('id')
            .eq('user_id', user.id)
            .single();

        if (merchantError || !merchant) {
            return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
        }

        const result = await generateInsights(supabase, merchant.id, user.id);

        if (result.error) {
            return NextResponse.json(
                { error: result.error, details: result.details },
                { status: result.status }
            );
        }

        return NextResponse.json(result.data);
    } catch (error) {
        console.error('Error generating insights:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * Responds with AI-generated insights for the authenticated merchant.
 *
 * Checks the current user session, resolves the merchant associated with the user,
 * invokes insights generation, and returns the resulting JSON payload or a structured error response.
 *
 * @returns A JSON response containing the generated insights on success; on failure returns a JSON error object with `error` (and optionally `details`) and an appropriate HTTP status (e.g., 401, 404, 429, 500).
 */
export async function POST(_request: Request) {
    try {
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get merchant
        const { data: merchant, error: merchantError } = await supabase
            .from('merchants')
            .select('id')
            .eq('user_id', user.id)
            .single();

        if (merchantError || !merchant) {
            return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
        }

        const result = await generateInsights(supabase, merchant.id, user.id);

        if (result.error) {
            return NextResponse.json(
                { error: result.error, details: result.details },
                { status: result.status }
            );
        }

        return NextResponse.json(result.data);
    } catch (error) {
        console.error('Error generating insights:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}