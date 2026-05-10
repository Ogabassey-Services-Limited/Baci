import {
  getOllamaStorefrontBaseUrl,
  getOllamaStorefrontBasicAuth,
  getOllamaStorefrontModel,
  getOllamaStorefrontTimeoutMs,
} from '@/env';
import {
  type AiStorefrontLayout,
  aiStorefrontLayoutSchema,
} from '@/schemas/ai-storefront-layout';

export interface StorefrontLayoutPromptInput {
  businessName: string;
  businessType: string;
  brandColors: Record<string, unknown> | null;
  productCount: number;
}

const PROMPT_INPUT_MAX_LENGTH = 200;
const ERROR_BODY_MAX_LENGTH = 500;

const OLLAMA_LAYOUT_FORMAT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    theme: {
      type: 'object',
      additionalProperties: false,
      properties: {
        primary: { type: 'string' },
        accent: { type: 'string' },
        background: { type: 'string' },
      },
    },
    sections: {
      type: 'array',
      minItems: 4,
      maxItems: 9,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: {
            type: 'string',
            enum: [
              'Header',
              'Hero',
              'Features',
              'ProductGrid',
              'TrustBadges',
              'Newsletter',
              'Footer',
            ],
          },
          props: { type: 'object' },
        },
        required: ['type', 'props'],
      },
    },
    designRationale: { type: 'string' },
  },
  required: ['sections'],
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '').replace(/\/api$/i, '');
}

function sanitizePromptInput(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\r\n`"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, PROMPT_INPUT_MAX_LENGTH);
}

function sanitizeBrandColors(
  brandColors: Record<string, unknown> | null
): Record<string, string> {
  if (!brandColors) return {};

  const allowedKeys = ['primary', 'secondary', 'accent', 'background'];
  return Object.fromEntries(
    allowedKeys.flatMap((key) => {
      const value = brandColors[key];
      if (typeof value !== 'string') return [];
      return [[key, sanitizePromptInput(value)]];
    })
  );
}

function buildPrompt(input: StorefrontLayoutPromptInput): string {
  return [
    'Design a safe ecommerce homepage using only existing Puck components.',
    'Return JSON only. Do not include HTML, JavaScript, markdown, or code.',
    'Allowed components: Header, Hero, Features, ProductGrid, TrustBadges, Newsletter, Footer.',
    `Business name: ${sanitizePromptInput(input.businessName)}`,
    `Business type: ${sanitizePromptInput(input.businessType)}`,
    `Known product count: ${input.productCount}`,
    `Brand colors: ${JSON.stringify(sanitizeBrandColors(input.brandColors))}`,
    'The homepage must include Header, Hero, ProductGrid, and Footer.',
  ].join('\n');
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, ERROR_BODY_MAX_LENGTH);
  } catch {
    return 'Unable to read response body';
  }
}

export async function generateStorefrontLayoutWithOllama(
  input: StorefrontLayoutPromptInput
): Promise<AiStorefrontLayout> {
  const baseUrl = getOllamaStorefrontBaseUrl();
  if (!baseUrl) throw new Error('OLLAMA_STOREFRONT_BASE_URL is not configured');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const basicAuth = getOllamaStorefrontBasicAuth();
  if (basicAuth) headers.Authorization = `Basic ${basicAuth}`;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    getOllamaStorefrontTimeoutMs()
  );

  try {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/generate`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: getOllamaStorefrontModel(),
        prompt: buildPrompt(input),
        stream: false,
        format: OLLAMA_LAYOUT_FORMAT,
        options: { temperature: 0.2 },
      }),
    });

    if (!response.ok) {
      const errorBody = await readErrorBody(response);
      throw new Error(
        `Ollama returned ${response.status} ${response.statusText}: ${errorBody}`
      );
    }

    const payload = (await response.json()) as { response?: unknown };
    let raw: unknown;
    if (typeof payload.response === 'string') {
      try {
        raw = JSON.parse(payload.response) as unknown;
      } catch (error) {
        throw new Error(
          `Failed to parse Ollama response JSON: ${
            error instanceof Error ? error.message : 'Unknown parse error'
          }`
        );
      }
    } else {
      raw = payload.response;
    }

    return aiStorefrontLayoutSchema.parse(raw);
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      error.name === 'AbortError'
    ) {
      throw new Error('Ollama storefront generation timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
