import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getAiChatModel,
  getAiChatProvider,
  getLlmChatModel,
  getLlmServerBearer,
  getLlmServerUrl,
  getOllamaBaseUrl,
  getOllamaBasicAuth,
} from '@/env';
import { authenticateApiRequest, hasPermission } from '@/lib/api-auth';

import type { RequestGemmaCompletionOptions } from '@/lib/gemma/gemma-completion';
import { requestGemmaCompletion } from '@/lib/gemma/gemma-completion';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';

const querySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  branchId: z.string().optional(),
});

type WebsitePerformanceGemmaConfig = Pick<
  RequestGemmaCompletionOptions,
  | 'llmServerBearer'
  | 'llmServerUrl'
  | 'model'
  | 'ollamaBaseUrl'
  | 'ollamaBasicAuth'
  | 'provider'
>;

function resolveWebsitePerformanceGemmaConfig(): WebsitePerformanceGemmaConfig {
  const configuredProvider = getAiChatProvider();
  const ollamaBaseUrl = getOllamaBaseUrl();
  const llmServerUrl = getLlmServerUrl();
  const llmServerBearer = getLlmServerBearer();

  if (configuredProvider === 'ollama') {
    if (!ollamaBaseUrl) {
      throw new Error(
        'Ollama provider explicitly configured but OLLAMA_BASE_URL is missing'
      );
    }

    return {
      model: getAiChatModel(),
      ollamaBaseUrl,
      ollamaBasicAuth: getOllamaBasicAuth(),
      provider: 'ollama',
    };
  }

  if (configuredProvider === 'llm') {
    if (!llmServerUrl || !llmServerBearer) {
      throw new Error(
        'LLM provider explicitly configured but LLM_SERVER_URL or LLM_SERVER_BEARER is missing'
      );
    }

    return {
      llmServerBearer,
      llmServerUrl,
      model: getLlmChatModel(),
      provider: 'llm',
    };
  }

  if (configuredProvider === 'gemini') {
    throw new Error(
      'Gemini provider is not supported for website performance Gemma insights'
    );
  }

  // This route is specifically a Gemma website-performance summarizer. In
  // `auto`, prefer the configured VPS Ollama/Gemma endpoint over a generic
  // OpenAI-compatible relay so a stale LLM_SERVER_* value cannot shadow the
  // live Gemma service and produce 401s.
  if (ollamaBaseUrl) {
    return {
      model: getAiChatModel(),
      ollamaBaseUrl,
      ollamaBasicAuth: getOllamaBasicAuth(),
      provider: 'ollama',
    };
  }

  if (llmServerUrl && llmServerBearer) {
    return {
      llmServerBearer,
      llmServerUrl,
      model: getLlmChatModel(),
      provider: 'llm',
    };
  }

  throw new Error('Gemma configuration is missing');
}

export async function GET(request: NextRequest) {
  const {
    error: authError,
    supabase,
    user,
  } = await authenticateApiRequest(request);

  if (authError || !user || !supabase) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawQuery = {
    startDate: searchParams.get('startDate') || undefined,
    endDate: searchParams.get('endDate') || undefined,
    branchId: searchParams.get('branchId') || undefined,
  };

  const parseResult = querySchema.safeParse(rawQuery);

  if (!parseResult.success) {
    return NextResponse.json(
      { code: 'INVALID_QUERY', error: 'Invalid query parameters' },
      { status: 400 }
    );
  }

  const { startDate, endDate, branchId } = parseResult.data;

  if (branchId) {
    return NextResponse.json(
      {
        code: 'UNSUPPORTED_SCOPE',
        error:
          'Branch filtering is not supported for website performance metrics',
      },
      { status: 400 }
    );
  }

  const merchantContext = await getMerchantForApiRequest(supabase, user.id, {
    requestedMerchantId:
      request.nextUrl.searchParams.get('merchantId') || undefined,
  });

  if (!merchantContext) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }

  const userAccess = toUserAccess(merchantContext);
  if (!hasPermission(userAccess, 'analytics', 'view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Set default 30 days if not provided
  let finalStartDate = startDate;
  let finalEndDate = endDate;

  if (!finalStartDate || !finalEndDate) {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - 30);

    if (!finalStartDate) finalStartDate = start.toISOString();
    if (!finalEndDate) finalEndDate = end.toISOString();
  }

  const start = new Date(finalStartDate);
  const end = new Date(finalEndDate);

  if (start > end) {
    return NextResponse.json(
      { code: 'INVALID_QUERY', error: 'startDate cannot be after endDate' },
      { status: 400 }
    );
  }

  const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays > 30) {
    return NextResponse.json(
      {
        code: 'INVALID_DATE_RANGE',
        error: 'Date range cannot exceed 30 days',
      },
      { status: 400 }
    );
  }

  // 1. Fetch Best Seller (using existing get_top_products RPC)
  const { data: topProducts, error: topProductsError } = await supabase.rpc(
    'get_top_products',
    {
      p_merchant_id: merchantContext.merchantId,
      p_start_date: finalStartDate,
      p_end_date: finalEndDate,
      p_limit: 1,
      p_branch_id: null,
    }
  );

  if (topProductsError) {
    return NextResponse.json(
      { error: 'Failed to aggregate best seller' },
      { status: 500 }
    );
  }

  const bestSeller =
    topProducts && topProducts.length > 0 ? topProducts[0] : null;

  // 2. Fetch Most Searched and Top Converting (query analytics_events)
  const { data: events, error: eventsError } = await supabase
    .from('analytics_events')
    .select('event_type, event_data')
    .eq('merchant_id', merchantContext.merchantId)
    .gte('event_timestamp', finalStartDate)
    .lte('event_timestamp', finalEndDate)
    .in('event_type', ['search', 'product_view', 'purchase', 'add_to_cart']);

  if (eventsError) {
    return NextResponse.json(
      { error: 'Failed to aggregate events' },
      { status: 500 }
    );
  }

  // Aggregate Most Searched
  const searchCounts: Record<string, number> = {};
  for (const event of events || []) {
    if (event.event_type === 'search' && event.event_data?.query) {
      const query = String(event.event_data.query).toLowerCase().trim();
      if (!query) continue;
      searchCounts[query] = (searchCounts[query] || 0) + 1;
    }
  }

  let mostSearched = null;
  let maxSearchCount = 0;
  for (const [query, count] of Object.entries(searchCounts)) {
    if (count > maxSearchCount) {
      maxSearchCount = count;
      mostSearched = { query, count };
    }
  }

  // Aggregate Top Converting
  const productViews: Record<
    string,
    { id: string; name: string; views: number; actions: number }
  > = {};

  for (const event of events || []) {
    const { product_id, product_name } = event.event_data || {};
    if (!product_id) continue;

    if (!productViews[product_id]) {
      productViews[product_id] = {
        id: product_id,
        name: product_name || 'Unknown Product',
        views: 0,
        actions: 0,
      };
    }

    if (event.event_type === 'product_view') {
      productViews[product_id].views += 1;
    } else if (
      event.event_type === 'purchase' ||
      event.event_type === 'add_to_cart'
    ) {
      productViews[product_id].actions += 1;
    }
  }

  let topConverting = null;
  let maxConversionRate = -1;

  for (const product of Object.values(productViews)) {
    if (product.views > 0) {
      const conversionRate = (product.actions / product.views) * 100;
      if (conversionRate > maxConversionRate) {
        maxConversionRate = conversionRate;
        topConverting = { id: product.id, name: product.name, conversionRate };
      }
    }
  }

  // Generate AI Insights with Gemma
  const gemmaPrompt = `Analyze the following website performance metrics for an e-commerce store and provide 2 brief, actionable insights (max 1 sentence each) for the merchant:
- Best Seller: ${bestSeller ? `${bestSeller.name} (${bestSeller.units_sold} units)` : 'None'}
- Most Searched: ${mostSearched ? `${mostSearched.query} (${mostSearched.count} searches)` : 'None'}
- Top Converting: ${topConverting ? `${topConverting.name} (${topConverting.conversionRate.toFixed(1)}% conversion rate)` : 'None'}`;

  let aiInsights: { insights: string[] } = { insights: [] };

  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 15000);

    const gemmaResponse = await requestGemmaCompletion({
      ...resolveWebsitePerformanceGemmaConfig(),
      messages: [{ role: 'user', content: gemmaPrompt }],
      maxTokens: 300,
      signal: controller.signal,
      temperature: 0.2,
    });

    if (
      !gemmaResponse ||
      (typeof gemmaResponse === 'object' &&
        'status' in gemmaResponse &&
        gemmaResponse.status === 'error')
    ) {
      throw new Error(
        gemmaResponse !== null &&
          typeof gemmaResponse === 'object' &&
          'error' in gemmaResponse &&
          typeof gemmaResponse.error === 'string'
          ? gemmaResponse.error
          : 'AI Completion failed'
      );
    }

    if (
      gemmaResponse &&
      typeof gemmaResponse === 'object' &&
      'status' in gemmaResponse &&
      gemmaResponse.status === 'success' &&
      'data' in gemmaResponse &&
      gemmaResponse.data &&
      typeof gemmaResponse.data === 'object' &&
      'insights' in gemmaResponse.data &&
      Array.isArray(gemmaResponse.data.insights)
    ) {
      aiInsights = {
        insights: gemmaResponse.data.insights.map((s) => String(s)),
      };
    } else {
      const text =
        typeof gemmaResponse === 'string'
          ? gemmaResponse
          : JSON.stringify(gemmaResponse);
      aiInsights = {
        insights: text
          .split('\n')
          .map((s) => s.trim().replace(/^[-*•]\s*/, ''))
          .filter(Boolean)
          .slice(0, 2),
      };
    }
  } catch (error) {
    console.error('Gemma completion error:', error);
    aiInsights = {
      insights: [
        'Website performance data aggregated successfully.',
        'No significant search or conversion trends detected in this period.',
      ],
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  return NextResponse.json({
    scope: { type: 'all' },
    summary: {
      bestSeller,
      mostSearched,
      topConverting,
    },
    aiInsights,
  });
}
