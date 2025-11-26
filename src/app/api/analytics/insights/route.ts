import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import { geminiPro } from '@/ai/provider';
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

        // Generate cache key for AI insights (cached for 1 hour)
        const cacheKey = generateCacheKey('ai-insights', merchant.id);

        // Try to get cached insights
        const cachedInsights = cache.get<{ insights: Array<{ title: string; description: string; type: string; priority: string; action?: string }> }>(cacheKey);
        if (cachedInsights) {
            return NextResponse.json(cachedInsights);
        }

        // Fetch aggregated data for context
        // 1. Daily Sales Summary (Last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: salesHistory } = await supabase
            .from('daily_sales_summary')
            .select('*')
            .eq('merchant_id', merchant.id)
            .gte('sale_date', thirtyDaysAgo.toISOString().split('T')[0])
            .order('sale_date', { ascending: true });

        // 2. Product Performance (Top 10)
        const { data: productPerformance } = await supabase
            .from('product_performance')
            .select('*')
            .eq('merchant_id', merchant.id)
            .order('total_revenue', { ascending: false })
            .limit(10);

        // 3. Sales by Channel
        const { data: channelPerformance } = await supabase
            .from('sales_by_channel')
            .select('*')
            .eq('merchant_id', merchant.id);

        // Prepare context for AI
        const context = {
            salesHistory: salesHistory || [],
            topProducts: productPerformance || [],
            channels: channelPerformance || [],
        };

        // Generate insights
        const { object } = await generateObject({
            model: geminiPro,
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

        // Cache the insights for 1 hour (3600 seconds)
        cache.set(cacheKey, object, 3600);

        return NextResponse.json(object);
    } catch (error) {
        console.error('Error generating insights:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
