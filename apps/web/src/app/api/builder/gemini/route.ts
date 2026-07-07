import { generateObject } from 'ai';
import { type NextRequest, NextResponse } from 'next/server';
import z from 'zod';
import {
  AI_RATE_LIMITS,
  type CopilotTextProvider,
  checkRateLimit,
  getCopilotTextProviderChain,
  sanitizePromptInput,
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
import {
  type BuilderGeminiLogContext,
  getBuilderGeminiFailure,
  logBuilderGeminiError,
  runBuilderGeminiWithTimeout,
} from './route-provider-errors';

// Per-provider attempt budget. Every provider in the chain answers this task
// in ~1-4s when healthy (measured 2026-07-07), so a provider that hasn't
// responded in 10s is effectively down — abort it and fall through to the
// next one instead of letting a hung upstream burn the whole route timeout.
// The last provider is exempt and gets whatever remains of the global budget.
const PER_PROVIDER_TIMEOUT_MS = 10_000;

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

type AiBuilderConfig = z.infer<typeof aiBuilderConfigSchema>;

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

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const aiLogContext: BuilderGeminiLogContext = {};

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

    const providerChain = getCopilotTextProviderChain();

    Object.assign(aiLogContext, {
      userId: user.id,
      merchantId: merchantContext.merchantId,
      model: providerChain[0]?.name,
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

    // Thinking is disabled for latency: the copilot must respond within the
    // route timeout, and this structured config-edit task doesn't benefit
    // from extended reasoning. providerOptions are namespaced — non-Google
    // providers in the chain simply ignore the `google` entry.
    const generateBuilderConfig = (
      model: CopilotTextProvider['model'],
      abortSignal: AbortSignal
    ) =>
      generateObject({
        model,
        schema: aiBuilderConfigSchema,
        system: BUILDER_GEMINI_SYSTEM_PROMPT,
        prompt: builtPrompt,
        abortSignal,
        providerOptions: {
          google: { thinkingConfig: { thinkingBudget: 0 } },
        },
      });

    // Walk the provider chain (Cerebras → Groq → Gemini → Gemini-Lite when
    // fully configured). ANY failure — quota, 5xx, network, per-provider
    // timeout — falls through to the next provider; the chain itself is the
    // retry, spread across independent infrastructures, so a single-provider
    // outage or exhausted free pool never dead-ends the merchant.
    let updatedConfig: AiBuilderConfig;
    try {
      const result = (await runBuilderGeminiWithTimeout(async (abortSignal) => {
        let lastError: unknown;
        for (const [index, provider] of providerChain.entries()) {
          const isLastProvider = index === providerChain.length - 1;
          aiLogContext.model = provider.name;
          const attemptSignal = isLastProvider
            ? abortSignal
            : AbortSignal.any([
                abortSignal,
                AbortSignal.timeout(PER_PROVIDER_TIMEOUT_MS),
              ]);
          try {
            return await generateBuilderConfig(provider.model, attemptSignal);
          } catch (error) {
            lastError = error;
            // The route-level timeout fired mid-attempt: stop the chain so
            // the timeout maps to the usual failure response instead of
            // burning it on providers that can no longer answer in time.
            if (abortSignal.aborted) throw error;
            logBuilderGeminiError(
              `AI Builder provider ${provider.name} failed${
                isLastProvider
                  ? '; provider chain exhausted:'
                  : '; falling back to the next provider:'
              }`,
              error,
              requestId,
              aiLogContext,
              isLastProvider ? 'error' : 'warn'
            );
          }
        }
        throw lastError;
      })) as { object: AiBuilderConfig };
      updatedConfig = result.object;
    } catch (error) {
      const failure = getBuilderGeminiFailure(error, requestId);
      logBuilderGeminiError(
        'Gemini AI Builder Error:',
        error,
        requestId,
        aiLogContext,
        failure.logLevel
      );

      return NextResponse.json(failure.response, { status: failure.status });
    }

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
    logBuilderGeminiError(
      'Gemini AI Builder Route Error:',
      error,
      requestId,
      aiLogContext,
      'error'
    );

    return NextResponse.json(
      { error: 'Internal server error', requestId },
      { status: 500 }
    );
  }
}
