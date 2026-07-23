import {
  CopilotRuntime,
  type CopilotServiceAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
  GoogleGenerativeAIAdapter,
  OpenAIAdapter,
} from '@copilotkit/runtime';
import { type NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { AI_RATE_LIMITS, checkRateLimit } from '@/ai/provider';
import {
  getCerebrasTextModelName,
  getGroqTextModelName,
} from '@/ai/text-provider-chain';
import { getAuthenticatedUser } from '@/lib/supabase/mobile-auth';

const runtime = new CopilotRuntime();

/**
 * Resolves the CopilotKit backend adapter for the builder AI sidebar.
 *
 * Unlike the shared text-provider chain, @copilotkit/runtime binds a SINGLE
 * adapter per request and cannot fall through providers mid-request. So the
 * order here favors RELIABILITY over raw speed: Groq's gpt-oss-120b (a
 * production-tier endpoint) is preferred over Cerebras' gemma-4-31b (an
 * evaluation/PREVIEW endpoint that may be rate-limited or discontinued on short
 * notice) — a transient failure of the chosen provider takes the sidebar down
 * with no in-request fallback, so the most stable free provider goes first.
 * Both are reached through OpenAIAdapter pointed at the provider's
 * OpenAI-compatible endpoint (the package ships no dedicated Cerebras/Groq
 * adapter, and OpenAIAdapter accepts any `openai` client, custom baseURL
 * included). Falls back to the direct Gemini adapter when neither cloud key is
 * configured. Exported for testing; called fresh per request — env-driven and
 * cheap to construct, so there is no benefit to caching it at module scope.
 */
export function resolveCopilotKitAdapter(): CopilotServiceAdapter {
  const groqApiKey = process.env.GROQ_API_KEY?.trim();
  if (groqApiKey) {
    return new OpenAIAdapter({
      openai: new OpenAI({
        apiKey: groqApiKey,
        baseURL: 'https://api.groq.com/openai/v1',
      }),
      model: getGroqTextModelName(),
    });
  }

  const cerebrasApiKey = process.env.CEREBRAS_API_KEY?.trim();
  if (cerebrasApiKey) {
    return new OpenAIAdapter({
      openai: new OpenAI({
        apiKey: cerebrasApiKey,
        baseURL: 'https://api.cerebras.ai/v1',
      }),
      model: getCerebrasTextModelName(),
    });
  }

  return new GoogleGenerativeAIAdapter({ model: 'gemini-3-flash-preview' });
}

/**
 * CopilotKit builder-sidebar backend.
 *
 * CSRF: intentionally exempt, like /api/chat — CopilotKit's browser client
 * does not send the app's CSRF token. The sidebar (CopilotBuilderWrapper)
 * only renders inside the authenticated builder page and calls this route
 * with a same-origin relative `runtimeUrl`, so the browser's default
 * same-origin cookie behavior carries the session through
 * getAuthenticatedUser's cookie path. Auth + the per-user rate limit below
 * are the abuse guards instead of CSRF.
 */
export async function POST(req: NextRequest) {
  // Auth first. getAuthenticatedUser supports both cookie (web) and Bearer
  // token auth, mirroring app/api/builder/gemini/route.ts.
  const auth = await getAuthenticatedUser(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimit = checkRateLimit(
    `copilotkit:${auth.user.id}`,
    AI_RATE_LIMITS.builder
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        code: 'rate_limited',
        resetIn: rateLimit.resetIn,
      },
      { status: 429 }
    );
  }

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter: resolveCopilotKitAdapter(),
    endpoint: '/api/copilotkit',
  });

  return handleRequest(req);
}
