import {
  type BuilderAiEditPlan,
  type BuilderData,
  builderAiEditContract,
} from '@baci/shared/contracts';
import { generateText, NoObjectGeneratedError, Output } from 'ai';
import { builderAiPlanOutputBudget } from './builder-ai-plan-output-budget';
import {
  type BuilderAiProvider,
  hasCanonicalBuilderAiProviderOrder,
} from './builder-ai-provider-catalog';

const RESPONSE_MARGIN_MS = builderAiPlanOutputBudget.routeResponseMarginMs;

export interface BuilderAiProviderCooldown {
  isCoolingDown: (providerName: string) => boolean;
  recordFailure?: (providerName: string, error: unknown) => void;
}

export interface RunBuilderAiProviderChainOptions {
  cooldown?: BuilderAiProviderCooldown;
  currentConfig: BuilderData;
  deadlineAt: number;
  logger?: { warn: (metadata: Record<string, unknown>) => void };
  now?: () => number;
  prompt: string;
  providerChain: BuilderAiProvider[];
  signal: AbortSignal;
  validateSemantics?: (
    plan: BuilderAiEditPlan,
    currentConfig: BuilderData
  ) => boolean;
}

function unavailable(): { code: 'ai_provider_unavailable' } {
  return { code: 'ai_provider_unavailable' };
}

function invalidOutput(): { code: 'ai_builder_invalid_output' } {
  return { code: 'ai_builder_invalid_output' };
}

function rateLimited(): { code: 'ai_provider_rate_limited' } {
  return { code: 'ai_provider_rate_limited' };
}

function isTransportFailure(error: unknown): boolean {
  return NoObjectGeneratedError.isInstance(error);
}

function isQuotaFailure(error: unknown): boolean {
  return (
    error instanceof Error &&
    /(?:quota|rate[ -]?limit|too many requests|\b429\b)/i.test(error.message)
  );
}

function logSafeFailure(
  logger: RunBuilderAiProviderChainOptions['logger'],
  provider: BuilderAiProvider,
  error: unknown
): void {
  logger?.warn({
    errorClass:
      error instanceof Error ? error.name.slice(0, 80) : 'UnknownProviderError',
    event: 'builder_ai_provider_fallback',
    provider: provider.name,
  });
}

function attemptSignal(source: AbortSignal, remainingMs: number): AbortSignal {
  return AbortSignal.any([
    source,
    AbortSignal.timeout(Math.max(1, remainingMs - RESPONSE_MARGIN_MS)),
  ]);
}

async function requestPlan(
  provider: BuilderAiProvider,
  prompt: string,
  signal: AbortSignal
): Promise<unknown> {
  const result = await generateText({
    abortSignal: signal,
    maxOutputTokens: builderAiPlanOutputBudget.maxOutputTokens,
    maxRetries: 0,
    model: provider.model,
    output: Output.json(),
    prompt,
  });
  return result.output;
}

export async function runBuilderAiProviderChain({
  cooldown,
  currentConfig,
  deadlineAt,
  logger,
  now = Date.now,
  prompt,
  providerChain,
  signal,
  validateSemantics = () => true,
}: RunBuilderAiProviderChainOptions): Promise<BuilderAiEditPlan> {
  if (
    signal.aborted ||
    !hasCanonicalBuilderAiProviderOrder(providerChain) ||
    deadlineAt - now() <= RESPONSE_MARGIN_MS
  ) {
    throw unavailable();
  }

  let sawInvalidOutput = false;
  let sawQuotaFailure = false;
  for (const provider of providerChain) {
    if (cooldown?.isCoolingDown(provider.name)) continue;
    const remainingMs = deadlineAt - now();
    if (remainingMs <= RESPONSE_MARGIN_MS) break;
    const signalForAttempt = attemptSignal(signal, remainingMs);
    const attempts = provider.opportunistic ? 1 : 2;

    for (let attempt = 0; attempt < attempts; attempt++) {
      if (signal.aborted || signalForAttempt.aborted) break;
      try {
        const output = await requestPlan(provider, prompt, signalForAttempt);
        const parsed = builderAiEditContract.modelPlanSchema.safeParse(output);
        if (!parsed.success || !validateSemantics(parsed.data, currentConfig)) {
          sawInvalidOutput = true;
          break;
        }
        return parsed.data;
      } catch (error) {
        sawQuotaFailure ||= isQuotaFailure(error);
        cooldown?.recordFailure?.(provider.name, error);
        logSafeFailure(logger, provider, error);
        // Malformed SDK JSON is a model-output failure: fall through rather
        // than burning a duplicate request to the same model.
        if (isTransportFailure(error)) break;
        if (signalForAttempt.aborted || signal.aborted) break;
      }
    }
  }
  if (sawInvalidOutput) throw invalidOutput();
  if (sawQuotaFailure) throw rateLimited();
  throw unavailable();
}
