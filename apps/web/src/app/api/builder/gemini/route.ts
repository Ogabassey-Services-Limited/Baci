import { generateObject } from 'ai';
import { type NextRequest, NextResponse } from 'next/server';
import z from 'zod';
import {
  type CopilotTextProvider,
  getCopilotTextProviderChain,
} from '@/ai/copilot-provider-chain';
import {
  AI_RATE_LIMITS,
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
import { computeNonFinalProviderBudgetMs } from './provider-chain-budget';
import {
  BUILDER_CONFIG_SHAPE_ERROR_NAME,
  BUILDER_GEMINI_RETRY_CONFIG,
  BUILDER_GEMINI_TIMEOUT_MS,
  type BuilderGeminiLogContext,
  getBuilderGeminiFailure,
  logBuilderGeminiError,
  runBuilderGeminiWithTimeout,
} from './route-provider-errors';

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

    // Generate with `output: 'no-schema'` (loose JSON mode) and validate the
    // result in-code with aiBuilderConfigSchema, rather than handing each
    // provider a strict JSON schema. The builder config is an OPEN shape
    // (looseObject + arbitrary props/zones/theme dictionaries) and the
    // providers' strict structured-output modes reject it in incompatible
    // ways — Cerebras rejects string `minLength` and empty (`{}`) sub-schemas,
    // Groq rejects the `propertyNames` emitted by record types. Loose JSON
    // mode is universally supported (verified end-to-end on cerebras
    // gemma-4-31b 0.7s, groq gpt-oss-120b 1.8s, gemini 2.5 flash/lite), and
    // the in-code safeParse is the "is this a renderable config" gate: a
    // provider that returns off-shape JSON is treated as a failed attempt and
    // the chain falls through to the next one.
    //
    // Thinking is disabled for latency (Google-namespaced providerOption;
    // other providers ignore it).
    const generateBuilderConfig = async (
      model: CopilotTextProvider['model'],
      abortSignal: AbortSignal
    ): Promise<AiBuilderConfig> => {
      const { object } = await generateObject({
        model,
        output: 'no-schema',
        system: BUILDER_GEMINI_SYSTEM_PROMPT,
        prompt: builtPrompt,
        abortSignal,
        providerOptions: {
          google: { thinkingConfig: { thinkingBudget: 0 } },
        },
      });

      const failShape = (reason: string): never => {
        const shapeError = new Error(
          `builder config JSON failed validation: ${reason}`
        );
        shapeError.name = BUILDER_CONFIG_SHAPE_ERROR_NAME;
        throw shapeError;
      };

      // Reject partial/empty drafts BEFORE aiBuilderConfigSchema's defaults can
      // mask them. builderConfigSchema defaults `content`→[], `root`→{title},
      // `zones`→{}, so a provider that returns only `theme` (or an empty
      // content array) would otherwise validate as a blank storefront and the
      // client would apply it over the merchant's real page — a silent wipe.
      // Require the model to have actually returned a non-empty content array;
      // anything less is treated as a failed attempt and the chain falls
      // through to the next provider.
      const rawContent = (object as { content?: unknown } | null)?.content;
      if (!Array.isArray(rawContent) || rawContent.length === 0) {
        return failShape(
          'model returned no content array (partial or empty draft)'
        );
      }

      const parsed = aiBuilderConfigSchema.safeParse(object);
      if (!parsed.success) {
        return failShape(parsed.error.issues[0]?.message ?? 'unknown shape');
      }
      return parsed.data;
    };

    // Walk the provider chain (Cerebras → Groq → Gemini → Gemini-Lite →
    // OpenRouter when fully configured). ANY failure — quota, 5xx, network,
    // per-provider timeout, or off-shape JSON — falls through to the next
    // provider; the chain itself is the retry, spread across independent
    // infrastructures, so a single-provider outage or exhausted free pool
    // never dead-ends the merchant.
    let updatedConfig: AiBuilderConfig;
    try {
      updatedConfig = await runBuilderGeminiWithTimeout(async (abortSignal) => {
        const routeDeadline = Date.now() + BUILDER_GEMINI_TIMEOUT_MS;
        // Index of the last RELIABLE provider (the opportunistic OpenRouter
        // tail is excluded). The reliable tail gets the full remaining route
        // budget; opportunistic providers only run with whatever time is left
        // and never have budget reserved on their behalf — so the contended
        // OpenRouter pool can never abort a still-working Gemini fallback early.
        let lastReliableIndex = providerChain.length - 1;
        while (
          lastReliableIndex > 0 &&
          providerChain[lastReliableIndex]?.opportunistic
        ) {
          lastReliableIndex--;
        }

        let lastError: unknown;
        for (const [index, provider] of providerChain.entries()) {
          const isLastProvider = index === providerChain.length - 1;
          const isLastReliable = index === lastReliableIndex;
          aiLogContext.model = provider.name;
          let attemptSignal: AbortSignal;
          if (index >= lastReliableIndex) {
            // Last reliable provider (and any opportunistic tail after it) gets
            // the whole remaining route budget — no per-provider cap.
            attemptSignal = abortSignal;
          } else {
            const budget = computeNonFinalProviderBudgetMs(
              routeDeadline - Date.now(),
              // Divide only among the RELIABLE providers still ahead, so the
              // opportunistic tail doesn't shrink everyone's share.
              lastReliableIndex - index + 1
            );
            attemptSignal = AbortSignal.any([
              abortSignal,
              AbortSignal.timeout(budget),
            ]);
          }
          try {
            // Restore a single transient retry on the last reliable provider —
            // in a Gemini-only deployment (chain = flash + flash-lite) a flaky
            // 5xx on the final fallback should retry once instead of 503ing
            // immediately, matching the pre-chain behavior.
            const attempt = () =>
              generateBuilderConfig(provider.model, attemptSignal);
            return await (isLastReliable
              ? withRetry(attempt, BUILDER_GEMINI_RETRY_CONFIG)
              : attempt());
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
      });
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
