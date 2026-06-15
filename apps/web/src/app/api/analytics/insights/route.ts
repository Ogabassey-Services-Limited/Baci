import type { SupabaseClient } from '@supabase/supabase-js';
import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import {
  AI_RATE_LIMITS,
  checkRateLimit,
  geminiFlash,
  withRetry,
} from '@/ai/provider';
import {
  generateAnalyticsInsightsWithOllama,
  isAnalyticsInsightsOllamaConfigured,
  sanitizeAnalyticsInsightsContext,
} from '@/lib/analytics/ollama-insights';
import { authenticateApiRequest, hasPermission } from '@/lib/api-auth';
import { cache, generateCacheKey } from '@/lib/cache';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { analyticsInsightsSchema } from '@/schemas/analytics-insights';

const AI_INSIGHTS_TIMEOUT_MS = 10_000;
const AI_INSIGHTS_RETRY_CONFIG = {
  maxRetries: 0,
  initialDelayMs: 0,
  maxDelayMs: 0,
  backoffMultiplier: 1,
};

async function generateInsights(
  supabase: SupabaseClient,
  merchantId: string,
  userId: string
) {
  // Rate limiting
  const rateLimit = checkRateLimit(
    `insights:${userId}`,
    AI_RATE_LIMITS.insights
  );
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
  const cachedInsights = cache.get<{
    insights: Array<{
      title: string;
      description: string;
      type: string;
      priority: string;
      action?: string;
    }>;
  }>(cacheKey);
  if (cachedInsights) {
    return { data: cachedInsights };
  }

  // Fetch aggregated data for context
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // PERFORMANCE: Use Promise.all to fetch analytics context in parallel rather than sequentially,
  // and specify exact columns instead of select('*') to reduce query planning overhead and payload size.
  const [
    { data: salesHistory },
    { data: productPerformance },
    { data: channelPerformance },
  ] = await Promise.all([
    // 1. Daily Sales Summary (Last 30 days)
    supabase
      .from('daily_sales_summary')
      .select(
        'merchant_id, sale_date, order_count, total_revenue, avg_order_value, unique_customers, paid_orders, pending_orders, paid_revenue'
      )
      .eq('merchant_id', merchantId)
      .gte('sale_date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('sale_date', { ascending: true }),

    // 2. Product Performance (Top 10)
    supabase
      .from('product_performance')
      .select(
        'merchant_id, product_id, name, price, times_sold, total_quantity_sold, total_revenue, last_sold_at'
      )
      .eq('merchant_id', merchantId)
      .order('total_revenue', { ascending: false })
      .limit(10),

    // 3. Sales by Channel
    supabase
      .from('sales_by_channel')
      .select(
        'merchant_id, channel, order_count, total_revenue, avg_order_value'
      )
      .eq('merchant_id', merchantId),
  ]);

  // Prepare context for AI
  const context = {
    salesHistory: salesHistory || [],
    topProducts: productPerformance || [],
    channels: channelPerformance || [],
  };

  const safeContext = sanitizeAnalyticsInsightsContext(context);

  // Generate insights with retry logic
  // Wrap in try-catch to prevent server freezing if AI API is unavailable
  try {
    const object = isAnalyticsInsightsOllamaConfigured()
      ? await generateAnalyticsInsightsWithOllama(safeContext, {
          timeoutMs: AI_INSIGHTS_TIMEOUT_MS,
        })
      : (
          await withRetry(async () => {
            return await generateObject({
              model: geminiFlash,
              schema: analyticsInsightsSchema,
              maxRetries: 0,
              timeout: AI_INSIGHTS_TIMEOUT_MS,
              prompt: `
Analyze the following e-commerce data for a merchant and provide 3-5 actionable insights.
Focus on trends, opportunities for growth, and potential issues.

Data Context:
${JSON.stringify(safeContext, null, 2)}

Provide insights in the following categories:
- Revenue trends (growth, decline, stability)
- Product performance (bestsellers, underperformers)
- Channel effectiveness

Be specific and constructive.
      `,
            });
          }, AI_INSIGHTS_RETRY_CONFIG)
        ).object;

    // Cache the insights for 24 hours (86400 seconds)
    cache.set(cacheKey, object, 86400);

    return { data: object };
  } catch (error) {
    console.error('Error generating AI insights (using fallback):', error);
    // Return fallback insights when AI is unavailable
    const fallbackInsights = {
      insights: [
        {
          title: 'AI Insights Temporarily Unavailable',
          description:
            'AI-powered analytics are currently unavailable. Please check your API configuration or try again later.',
          type: 'neutral' as const,
          priority: 'low' as const,
          action: 'Check your Google AI API key in environment variables.',
        },
      ],
    };
    return { data: fallbackInsights };
  }
}

async function handleInsightsRequest(request: Request) {
  const auth = await authenticateApiRequest(request);

  if (auth.error || !auth.user || !auth.supabase) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { supabase, user } = auth;

  // Get merchant context (supports both owners and staff members)
  const merchantContext = await getMerchantForApiRequest(supabase, user.id);
  if (!merchantContext) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }
  const access = toUserAccess(merchantContext);
  if (!hasPermission(access, 'analytics', 'view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const merchantId = merchantContext.merchantId;

  const result = await generateInsights(supabase, merchantId, user.id);

  if (result.error) {
    return NextResponse.json(
      { error: result.error, details: result.details },
      { status: result.status }
    );
  }

  return NextResponse.json(result.data);
}

export async function GET(request: Request) {
  try {
    return await handleInsightsRequest(request);
  } catch (error) {
    console.error('Error generating insights:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST handler - same behavior as GET, kept for API compatibility
export async function POST(request: Request) {
  try {
    return await handleInsightsRequest(request);
  } catch (error) {
    console.error('Error generating insights:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
