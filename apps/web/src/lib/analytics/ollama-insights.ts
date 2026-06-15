import { getAiChatModel, getOllamaBaseUrl, getOllamaBasicAuth } from '@/env';
import { buildOllamaBasicAuthHeader } from '@/lib/ollama-auth';
import {
  type AnalyticsInsights,
  analyticsInsightsSchema,
} from '@/schemas/analytics-insights';

export interface AnalyticsInsightsContext {
  channels: ChannelPerformanceInsightRow[];
  salesHistory: SalesHistoryInsightRow[];
  topProducts: ProductPerformanceInsightRow[];
}

interface GenerateAnalyticsInsightsWithOllamaOptions {
  timeoutMs: number;
}

type AggregateMetricValue = boolean | number | string | null;

type AggregateMetricRow<AllowedField extends string> = Partial<
  Record<AllowedField, AggregateMetricValue>
> &
  Record<string, unknown>;

type SalesHistoryField =
  | 'avg_order_value'
  | 'order_count'
  | 'paid_orders'
  | 'paid_revenue'
  | 'pending_orders'
  | 'sale_date'
  | 'total_revenue'
  | 'unique_customers';

type ProductPerformanceField =
  | 'last_sold_at'
  | 'name'
  | 'price'
  | 'times_sold'
  | 'total_quantity_sold'
  | 'total_revenue';

type ChannelPerformanceField =
  | 'avg_order_value'
  | 'channel'
  | 'order_count'
  | 'total_revenue';

export type SalesHistoryInsightRow = AggregateMetricRow<SalesHistoryField>;
export type ProductPerformanceInsightRow =
  AggregateMetricRow<ProductPerformanceField>;
export type ChannelPerformanceInsightRow =
  AggregateMetricRow<ChannelPerformanceField>;

type OllamaAnalyticsResponse = {
  message?: {
    content?: unknown;
  };
  response?: unknown;
};

const ANALYTICS_INSIGHTS_FORMAT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    insights: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          type: {
            type: 'string',
            enum: ['positive', 'negative', 'neutral', 'opportunity'],
          },
          priority: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
          },
          action: { type: 'string' },
        },
        required: ['title', 'description', 'type', 'priority'],
      },
    },
  },
  required: ['insights'],
};

const MODEL_NAME_LINE_BREAK_PATTERN = /\\n|\r?\n|\r/g;
const SALES_HISTORY_ALLOWED_FIELDS = [
  'sale_date',
  'order_count',
  'total_revenue',
  'avg_order_value',
  'unique_customers',
  'paid_orders',
  'pending_orders',
  'paid_revenue',
] as const satisfies readonly SalesHistoryField[];
const PRODUCT_PERFORMANCE_ALLOWED_FIELDS = [
  'name',
  'price',
  'times_sold',
  'total_quantity_sold',
  'total_revenue',
  'last_sold_at',
] as const satisfies readonly ProductPerformanceField[];
const CHANNEL_PERFORMANCE_ALLOWED_FIELDS = [
  'channel',
  'order_count',
  'total_revenue',
  'avg_order_value',
] as const satisfies readonly ChannelPerformanceField[];

function cleanModelName(model: string): string {
  return model.replace(MODEL_NAME_LINE_BREAK_PATTERN, '').trim();
}

function normalizeOllamaBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '').replace(/\/api$/i, '');
}

function normalizeAggregateMetricValue(
  value: unknown
): AggregateMetricValue | undefined {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return value;
  }

  return undefined;
}

function keepAllowedAggregateFields<AllowedField extends string>(
  row: AggregateMetricRow<AllowedField>,
  allowedFields: readonly AllowedField[]
): AggregateMetricRow<AllowedField> {
  const sanitized: Partial<Record<AllowedField, AggregateMetricValue>> = {};

  for (const field of allowedFields) {
    const value = normalizeAggregateMetricValue(row[field]);
    if (value !== undefined) sanitized[field] = value;
  }

  return sanitized;
}

function sanitizeAnalyticsInsightsContext(
  context: AnalyticsInsightsContext
): AnalyticsInsightsContext {
  return {
    salesHistory: context.salesHistory.map((row) =>
      keepAllowedAggregateFields(row, SALES_HISTORY_ALLOWED_FIELDS)
    ),
    topProducts: context.topProducts.map((row) =>
      keepAllowedAggregateFields(row, PRODUCT_PERFORMANCE_ALLOWED_FIELDS)
    ),
    channels: context.channels.map((row) =>
      keepAllowedAggregateFields(row, CHANNEL_PERFORMANCE_ALLOWED_FIELDS)
    ),
  };
}

function buildPrompt(context: AnalyticsInsightsContext): string {
  const safeContext = sanitizeAnalyticsInsightsContext(context);

  return [
    'Analyze this Baci merchant ecommerce analytics context.',
    'Return JSON only and match this JSON schema exactly:',
    JSON.stringify(ANALYTICS_INSIGHTS_FORMAT),
    'Provide 3-5 actionable insights. Focus on revenue trends, product performance, and sales-channel effectiveness.',
    'Use concise merchant-facing language. Do not include markdown.',
    `Data Context: ${JSON.stringify(safeContext)}`,
  ].join('\n');
}

function parseOllamaInsightsPayload(payload: OllamaAnalyticsResponse): unknown {
  const content = payload.message?.content ?? payload.response;

  if (typeof content !== 'string') {
    return content;
  }

  try {
    return JSON.parse(content) as unknown;
  } catch (error) {
    throw new Error(
      `Failed to parse Ollama analytics insights JSON: ${
        error instanceof Error ? error.message : 'Unknown parse error'
      }`
    );
  }
}

export function isAnalyticsInsightsOllamaConfigured(): boolean {
  return Boolean(getOllamaBaseUrl());
}

export async function generateAnalyticsInsightsWithOllama(
  context: AnalyticsInsightsContext,
  { timeoutMs }: GenerateAnalyticsInsightsWithOllamaOptions
): Promise<AnalyticsInsights> {
  const baseUrl = getOllamaBaseUrl();
  if (!baseUrl) throw new Error('OLLAMA_BASE_URL is not configured');
  const model = cleanModelName(getAiChatModel());
  if (!model) throw new Error('AI_CHAT_MODEL is not configured');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const basicAuth = getOllamaBasicAuth();
  if (basicAuth) {
    const authorization = buildOllamaBasicAuthHeader(basicAuth);
    if (!authorization) {
      throw new Error(
        'OLLAMA_BASIC_AUTH is invalid: expected raw "user:password", "Basic <base64>", or a base64 payload'
      );
    }
    headers.Authorization = authorization;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `${normalizeOllamaBaseUrl(baseUrl)}/api/chat`,
      {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content:
                'You are a concise ecommerce analytics assistant for African merchants. Return valid JSON only.',
            },
            {
              role: 'user',
              content: buildPrompt(context),
            },
          ],
          stream: false,
          think: false,
          keep_alive: '10m',
          format: ANALYTICS_INSIGHTS_FORMAT,
          options: {
            num_ctx: 4096,
            num_predict: 768,
            temperature: 0.2,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Ollama analytics insights returned ${response.status}`);
    }

    const payload = (await response.json()) as OllamaAnalyticsResponse;
    return analyticsInsightsSchema.parse(parseOllamaInsightsPayload(payload));
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      error.name === 'AbortError'
    ) {
      throw new Error('Ollama analytics insights timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
