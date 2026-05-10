import { generateObject } from 'ai';
import { type NextRequest, NextResponse } from 'next/server';
import z from 'zod';
import {
  ACTIVE_TEXT_MODEL_NAME,
  AI_RATE_LIMITS,
  activeTextModel,
  checkRateLimit,
  sanitizePromptInput,
  withRetry,
} from '@/ai/provider';
import { hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { getAuthenticatedUser } from '@/lib/supabase/mobile-auth';
import { builderConfigSchema } from '@/schemas/builder';
import { BUILDER_GEMINI_SYSTEM_PROMPT } from '../gemini-system-prompt';

const PuckThemeColorsSchema = z
  .object({
    primary: z.string().optional(),
    accent: z.string().optional(),
    header: z
      .object({
        background: z.string().optional(),
        text: z.string().optional(),
        iconColor: z.string().optional(),

        searchBorder: z.string().optional(),
        searchBackground: z.string().optional(),
      })
      .optional(),
    footer: z
      .object({
        background: z.string().optional(),
        text: z.string().optional(),
        linkColor: z.string().optional(),
        linkHoverColor: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

const aiBuilderConfigSchema = builderConfigSchema
  .extend({
    theme: z
      .object({
        colors: PuckThemeColorsSchema.optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const builderGeminiRequestSchema = z.object({
  prompt: z.string().trim().min(1, 'Prompt is required'),
  currentConfig: aiBuilderConfigSchema,
});

const BUILDER_GEMINI_RETRY_CONFIG = {
  maxRetries: 1,
  initialDelayMs: 750,
  maxDelayMs: 1500,
  backoffMultiplier: 2,
};

const BUILDER_GEMINI_TIMEOUT_MS = 25_000;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeThemeValue(existingValue: unknown, nextValue: unknown): unknown {
  if (!isPlainObject(existingValue) || !isPlainObject(nextValue)) {
    return nextValue;
  }

  const merged: Record<string, unknown> = { ...existingValue };
  for (const [key, value] of Object.entries(nextValue)) {
    merged[key] = mergeThemeValue(existingValue[key], value);
  }

  return merged;
}

async function runBuilderGeminiWithTimeout<T>(
  operation: (abortSignal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    BUILDER_GEMINI_TIMEOUT_MS
  );

  try {
    return await operation(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('builder_gemini_timeout');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const aiLogContext: {
    userId?: string;
    merchantId?: string;
    model?: string;
    promptLength?: number;
    componentCount?: number;
  } = {};

  try {
    const { valid, response } = await checkCsrfProtection(req);
    if (!valid) {
      return response as NextResponse;
    }

    // Auth check - supports both cookie (web) and Bearer token (mobile)
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user, supabase } = auth;

    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'builder', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Rate limiting
    const rateLimit = checkRateLimit(
      `builder:${user.id}`,
      AI_RATE_LIMITS.builder
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          code: 'rate_limited',
          details: `Please wait ${Math.ceil(rateLimit.resetIn / 1000)} seconds before trying again.`,
          requestId,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetIn / 1000)),
          },
        }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = builderGeminiRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { prompt, currentConfig } = parsed.data;

    // Sanitize the user prompt
    const sanitizedPrompt = sanitizePromptInput(prompt, 1000).value;

    if (!sanitizedPrompt) {
      return NextResponse.json({ error: 'Invalid prompt' }, { status: 400 });
    }

    Object.assign(aiLogContext, {
      userId: user.id,
      merchantId: merchantContext.merchantId,
      model: ACTIVE_TEXT_MODEL_NAME,
      promptLength: sanitizedPrompt.length,
      componentCount: currentConfig.content.length,
    });

    const builtPrompt = `Current Configuration:
\`\`\`json
${JSON.stringify(currentConfig, null, 2)
  .replace(/ignore (previous|all|above|prior)/gi, '[filtered]')
  .replace(/system:/gi, '[filtered]')}
\`\`\`

User Request: ${sanitizedPrompt}

Please return the complete updated configuration as valid JSON. Make intelligent modifications based on the request while preserving all existing structure and content unless explicitly asked to change or remove it.`;

    // Generate the updated config using Vercel AI SDK with retry logic
    const result = await runBuilderGeminiWithTimeout((abortSignal) =>
      withRetry(async () => {
        return await generateObject({
          model: activeTextModel,
          schema: aiBuilderConfigSchema,
          system: BUILDER_GEMINI_SYSTEM_PROMPT,
          prompt: builtPrompt,
          abortSignal,
        });
      }, BUILDER_GEMINI_RETRY_CONFIG)
    );

    let updatedConfig = result.object;

    // Preserve existing theme sections unless Gemini explicitly changes them.
    const mergedTheme = updatedConfig.theme
      ? (mergeThemeValue(
          currentConfig.theme ?? {},
          updatedConfig.theme
        ) as Record<string, unknown>)
      : (currentConfig.theme ?? {});

    // Ensure all components have unique IDs
    if (updatedConfig.content && Array.isArray(updatedConfig.content)) {
      const contentWithIds = updatedConfig.content.map((component, index) => ({
        ...component,
        props: {
          ...component.props,
          id:
            component.props?.id ||
            `${component.type.toLowerCase()}-${Date.now()}-${index}`,
        },
      }));
      updatedConfig = {
        ...updatedConfig,
        theme: mergedTheme,
        content: contentWithIds,
      };
    }

    // Validate the structure
    if (!updatedConfig.content || !Array.isArray(updatedConfig.content)) {
      console.error('Gemini AI Builder Invalid Output:', {
        requestId,
        userId: aiLogContext.userId,
        merchantId: aiLogContext.merchantId,
        model: aiLogContext.model,
        promptLength: aiLogContext.promptLength,
        componentCount: aiLogContext.componentCount,
        reason: 'missing_content_array',
      });

      return NextResponse.json(
        {
          error: 'AI editor returned an invalid draft',
          code: 'ai_builder_invalid_output',
          requestId,
        },
        { status: 502 }
      );
    }

    if (!updatedConfig.root) {
      updatedConfig.root = currentConfig.root || { title: 'Home' };
    }

    if (!updatedConfig.zones) {
      updatedConfig.zones = currentConfig.zones || {};
    }

    return NextResponse.json(
      { config: updatedConfig },
      {
        headers: {
          'X-RateLimit-Remaining': String(rateLimit.remaining),
        },
      }
    );
  } catch (error) {
    // Log full error details server-side for debugging
    console.error('Gemini AI Builder Error:', {
      requestId,
      userId: aiLogContext.userId,
      merchantId: aiLogContext.merchantId,
      model: aiLogContext.model,
      promptLength: aiLogContext.promptLength,
      componentCount: aiLogContext.componentCount,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: 'AI editor is temporarily unavailable',
        code: 'ai_provider_unavailable',
        requestId,
      },
      { status: 503 }
    );
  }
}
