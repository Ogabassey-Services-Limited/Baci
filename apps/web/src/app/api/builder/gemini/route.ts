import { type NextRequest, NextResponse } from 'next/server';
import { getCopilotTextProviderChain } from '@/ai/copilot-provider-chain';
import {
  AI_RATE_LIMITS,
  checkRateLimit,
  sanitizePromptInput,
} from '@/ai/provider';
import { hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { getAuthenticatedUser } from '@/lib/supabase/mobile-auth';
import { builderGeminiRequestSchema } from '@/schemas/builder-gemini-request';
import type { AiBuilderConfig } from './builder-config-shape';
import {
  BUILDER_GEMINI_TIMEOUT_MS,
  type BuilderGeminiLogContext,
  getBuilderGeminiFailure,
  logBuilderGeminiError,
  runBuilderGeminiWithTimeout,
} from './route-provider-errors';
import { runBuilderProviderChain } from './run-builder-provider-chain';

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

    const { merchantId, prompt, currentConfig } = parsed.data;

    const merchantContext = await getMerchantForApiRequest(supabase, user.id, {
      requestedMerchantId: merchantId,
    });
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

    let updatedConfig: AiBuilderConfig;
    try {
      updatedConfig = await runBuilderGeminiWithTimeout((abortSignal) =>
        runBuilderProviderChain({
          providerChain,
          builtPrompt,
          currentConfig,
          routeDeadlineMs: Date.now() + BUILDER_GEMINI_TIMEOUT_MS,
          abortSignal,
          onProviderAttempt: (name) => {
            aiLogContext.model = name;
          },
          onProviderError: (name, error, isLastProvider) =>
            logBuilderGeminiError(
              `AI Builder provider ${name} failed${
                isLastProvider
                  ? '; provider chain exhausted:'
                  : '; falling back to the next provider:'
              }`,
              error,
              requestId,
              aiLogContext,
              isLastProvider ? 'error' : 'warn'
            ),
        })
      );
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

    // runBuilderProviderChain rejects missing/non-array content before returning.
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
