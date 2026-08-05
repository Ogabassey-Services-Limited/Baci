import {
  type BuilderAiEditPlan,
  type BuilderAiEditRequest,
  builderAiEditContract,
  validateBuilderAiEditComplexity,
} from '@baci/shared/contracts';
import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-permissions';
import { applyBuilderAiEditPlan } from '@/lib/builder-ai/apply-builder-ai-edit-plan';
import { checkBuilderAiRateLimit } from '@/lib/builder-ai/builder-ai-rate-limit';
import { getBuilderAiRawPlanMediaWarning } from '@/lib/builder-ai/get-builder-ai-raw-plan-media-warning';
import { logBuilderAiEvent } from '@/lib/builder-ai/log-builder-ai-event';
import { materializeBuilderAiProviderChain } from '@/lib/builder-ai/materialize-builder-ai-provider-chain';
import { prepareBuilderAiEditPromptResponse } from '@/lib/builder-ai/prepare-builder-ai-edit-prompt-response';
import { runBuilderAiProviderChain } from '@/lib/builder-ai/run-builder-ai-provider-chain';
import { checkCsrfProtection } from '@/lib/csrf';
import { readBoundedJsonBody } from '@/lib/events/read-bounded-json-body';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { getAuthenticatedUser } from '@/lib/supabase/mobile-auth';
import { builderGeminiRequestSchema } from '@/schemas/builder-gemini-request';

type Authentication = Omit<
  NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>,
  'authMode'
> & { authMode?: 'bearer' | 'cookie' };
type MerchantContext = NonNullable<
  Awaited<ReturnType<typeof getMerchantForApiRequest>>
>;
type BodyResult = Awaited<ReturnType<typeof readBoundedJsonBody>>;
export interface BuilderAiEditHandlerDependencies {
  authenticate: (request: Request) => Promise<Authentication | null>;
  checkCsrf: (request: NextRequest) => ReturnType<typeof checkCsrfProtection>;
  getMerchant: (
    supabase: Authentication['supabase'],
    userId: string,
    options: { requestedMerchantId: string }
  ) => Promise<MerchantContext | null>;
  materializeProviders: () => ReturnType<
    typeof materializeBuilderAiProviderChain
  >;
  rateLimit: (identifier: string) => ReturnType<typeof checkBuilderAiRateLimit>;
  readBody: (request: Request, maxBytes: number) => Promise<BodyResult>;
  runProviderChain: typeof runBuilderAiProviderChain;
}
export interface BuilderAiEditHandlerOptions {
  dependencies?: BuilderAiEditHandlerDependencies;
  mode?: 'legacy' | 'v1';
}
function dependencies(): BuilderAiEditHandlerDependencies {
  return {
    authenticate: getAuthenticatedUser,
    checkCsrf: checkCsrfProtection,
    getMerchant: getMerchantForApiRequest,
    materializeProviders: materializeBuilderAiProviderChain,
    rateLimit: checkBuilderAiRateLimit,
    readBody: readBoundedJsonBody,
    runProviderChain: runBuilderAiProviderChain,
  };
}

function responseForProviderError(error: unknown, requestId: string): Response {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined;
  if (code === 'ai_builder_invalid_output') {
    return NextResponse.json(
      { code, error: 'AI editor returned an invalid draft', requestId },
      { status: 502 }
    );
  }
  if (code === 'ai_provider_rate_limited') {
    return NextResponse.json(
      {
        code,
        error: 'AI editor quota is temporarily exhausted',
        requestId,
      },
      { status: 429 }
    );
  }
  return NextResponse.json(
    {
      code: 'ai_provider_unavailable',
      error: 'AI editor is temporarily unavailable',
      requestId,
    },
    { status: 503 }
  );
}

function isSemanticallyExecutable(
  plan: BuilderAiEditPlan,
  request: BuilderAiEditRequest
): boolean {
  if (plan.status === 'refused') return true;
  try {
    applyBuilderAiEditPlan(request.currentConfig, plan);
    return true;
  } catch {
    return false;
  }
}

function parseRequest(
  body: unknown,
  mode: 'legacy' | 'v1'
): BuilderAiEditRequest | null {
  if (mode === 'v1') {
    const parsed = builderAiEditContract.requestSchema.safeParse(body);
    return parsed.success ? parsed.data : null;
  }
  const legacy = builderGeminiRequestSchema.safeParse(body);
  return legacy.success
    ? {
        ...legacy.data,
        clientRequestId: crypto.randomUUID(),
        contractVersion: builderAiEditContract.version,
      }
    : null;
}

export async function handleBuilderAiEditRequest(
  request: Request,
  options: BuilderAiEditHandlerOptions = {}
): Promise<Response> {
  const seams = options.dependencies ?? dependencies();
  const mode = options.mode ?? 'v1';
  const auth = await seams.authenticate(request);
  if (!auth)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const csrfRequest =
    auth.authMode === 'cookie' && request.headers.has('Authorization')
      ? new NextRequest(request, {
          headers: new Headers(
            [...request.headers].filter(([name]) => name !== 'authorization')
          ),
        })
      : (request as NextRequest);
  const csrf = await seams.checkCsrf(csrfRequest);
  if (!csrf.valid) return csrf.response as Response;
  const body = await seams.readBody(request, 1_048_576);
  if (!body.ok) {
    return NextResponse.json(
      body.reason === 'too_large'
        ? {
            code: 'builder_ai_request_too_large',
            error: 'Request body is too large',
          }
        : { error: 'Invalid JSON body' },
      { status: body.reason === 'too_large' ? 413 : 400 }
    );
  }
  const parsed = parseRequest(body.body, mode);
  if (
    !parsed ||
    !validateBuilderAiEditComplexity(parsed.currentConfig).success
  ) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
  let merchant: MerchantContext | null;
  try {
    merchant = await seams.getMerchant(auth.supabase, auth.user.id, {
      requestedMerchantId: parsed.merchantId,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error', requestId: parsed.clientRequestId },
      { status: 500 }
    );
  }
  if (!merchant)
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  if (!hasPermission(toUserAccess(merchant), 'builder', 'edit')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const rate = seams.rateLimit(`builder:${auth.user.id}`);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        code: 'rate_limited',
        error: 'Rate limit exceeded',
        requestId: parsed.clientRequestId,
      },
      { headers: { 'X-RateLimit-Remaining': '0' }, status: 429 }
    );
  }
  const promptResult = prepareBuilderAiEditPromptResponse({
    currentConfig: parsed.currentConfig,
    prompt: parsed.prompt,
    requestId: parsed.clientRequestId,
  });
  if ('response' in promptResult) return promptResult.response;
  const materialized = seams.materializeProviders();
  if (materialized.providers.length === 0) {
    return responseForProviderError(
      { code: 'ai_provider_unavailable' },
      parsed.clientRequestId
    );
  }
  logBuilderAiEvent('builder_ai_edit_requested', {
    merchantId: merchant.merchantId,
    requestId: parsed.clientRequestId,
    userId: auth.user.id,
  });
  let plan: BuilderAiEditPlan;
  try {
    plan = await seams.runProviderChain({
      currentConfig: parsed.currentConfig,
      deadlineAt: Date.now() + 25_000,
      logger: {
        warn: (metadata) => {
          const errorClass =
            typeof metadata.errorClass === 'string'
              ? metadata.errorClass
              : 'UnknownProviderError';
          logBuilderAiEvent(
            errorClass === 'AbortError' || errorClass === 'TimeoutError'
              ? 'builder_ai_timeout'
              : 'builder_ai_provider_fallback',
            {
              errorClass,
              merchantId: merchant.merchantId,
              provider:
                typeof metadata.provider === 'string'
                  ? metadata.provider
                  : 'unknown',
              requestId: parsed.clientRequestId,
              userId: auth.user.id,
            }
          );
        },
      },
      prompt: promptResult.prompt,
      providerChain: materialized.providers,
      signal: AbortSignal.timeout(24_000),
      validateSemantics: (candidate) =>
        isSemanticallyExecutable(candidate, parsed),
    });
  } catch (error) {
    logBuilderAiEvent('builder_ai_candidate_rejected', {
      merchantId: merchant.merchantId,
      requestId: parsed.clientRequestId,
      userId: auth.user.id,
    });
    return responseForProviderError(error, parsed.clientRequestId);
  }
  if (plan.status === 'refused') {
    logBuilderAiEvent('builder_ai_candidate_rejected', {
      merchantId: merchant.merchantId,
      requestId: parsed.clientRequestId,
      userId: auth.user.id,
    });
    return NextResponse.json(
      {
        code: 'builder_ai_request_not_supported',
        error: 'This request is not supported',
        requestId: parsed.clientRequestId,
      },
      { status: 422 }
    );
  }
  const result = applyBuilderAiEditPlan(parsed.currentConfig, plan);
  const rawMediaWarning = getBuilderAiRawPlanMediaWarning(plan);
  const candidate = builderAiEditContract.candidateSchema.parse({
    candidateConfig: result.candidateConfig,
    clientRequestId: parsed.clientRequestId,
    contractVersion: builderAiEditContract.version,
    operations: rawMediaWarning ? [] : plan.operations,
    summary: plan.summary,
    warnings: result.warnings,
  });
  logBuilderAiEvent('builder_ai_candidate_created', {
    merchantId: merchant.merchantId,
    operationCount: candidate.operations.length,
    requestId: parsed.clientRequestId,
    userId: auth.user.id,
    warningCount: candidate.warnings.length,
  });
  if (mode === 'legacy') {
    logBuilderAiEvent('legacy_contract_used', {
      merchantId: merchant.merchantId,
      requestId: parsed.clientRequestId,
      userId: auth.user.id,
    });
    return NextResponse.json(
      { config: candidate.candidateConfig },
      { headers: { 'X-RateLimit-Remaining': String(rate.remaining) } }
    );
  }
  return NextResponse.json(candidate, {
    headers: { 'X-RateLimit-Remaining': String(rate.remaining) },
  });
}
