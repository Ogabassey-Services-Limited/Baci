import { generateObject } from 'ai';
import { type NextRequest, NextResponse } from 'next/server';
import z from 'zod';
import {
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
          details: `Please wait ${Math.ceil(rateLimit.resetIn / 1000)} seconds before trying again.`,
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

    // Generate the updated config using Vercel AI SDK with retry logic
    const result = await withRetry(async () => {
      return await generateObject({
        model: activeTextModel,
        schema: aiBuilderConfigSchema,
        system: BUILDER_GEMINI_SYSTEM_PROMPT,
        prompt: `Current Configuration:
\`\`\`json
${JSON.stringify(currentConfig, null, 2)
  .replace(/ignore (previous|all|above|prior)/gi, '[filtered]')
  .replace(/system:/gi, '[filtered]')}
\`\`\`

User Request: ${sanitizedPrompt}

Please return the complete updated configuration as valid JSON. Make intelligent modifications based on the request while preserving all existing structure and content unless explicitly asked to change or remove it.`,
      });
    });

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
      throw new Error(
        'Invalid configuration structure: missing or invalid content array'
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
    console.error('Gemini AI Builder Error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Return generic error message to client to avoid exposing internal details
    return NextResponse.json(
      {
        error: 'Failed to process AI request',
        details: 'An unexpected error occurred. Please try again later.',
      },
      { status: 500 }
    );
  }
}
