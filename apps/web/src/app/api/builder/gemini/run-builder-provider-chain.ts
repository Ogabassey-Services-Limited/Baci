import { generateObject } from 'ai';
import type { CopilotTextProvider } from '@/ai/copilot-provider-chain';
import { withRetry } from '@/ai/provider';
import { BUILDER_GEMINI_SYSTEM_PROMPT } from '../gemini-system-prompt';
import {
  type AiBuilderConfig,
  aiBuilderConfigSchema,
} from './builder-config-shape';
import { computeNonFinalProviderBudgetMs } from './provider-chain-budget';
import {
  BUILDER_CONFIG_SHAPE_ERROR_NAME,
  BUILDER_GEMINI_RETRY_CONFIG,
  isBuilderConfigShapeError,
  isBuilderGeminiQuotaError,
} from './route-provider-errors';

// Generate one builder-config draft from a single provider using
// `output: 'no-schema'` (loose JSON mode) and validate the result in-code with
// aiBuilderConfigSchema, rather than handing the provider a strict JSON schema.
// The builder config is an OPEN shape and the providers' strict
// structured-output modes reject it in incompatible ways — Cerebras rejects
// string `minLength` and empty (`{}`) sub-schemas, Groq rejects the
// `propertyNames` emitted by record types. Loose JSON mode is universally
// supported (verified end-to-end on cerebras gemma-4-31b 0.7s, groq
// gpt-oss-120b 1.8s, gemini 2.5 flash/lite), and the in-code safeParse is the
// gate: a provider that returns off-shape JSON throws a shape error and the
// chain falls through to the next provider.
//
// Thinking is disabled for latency (Google-namespaced providerOption; other
// providers ignore it).
async function generateBuilderConfigOnce(
  model: CopilotTextProvider['model'],
  builtPrompt: string,
  currentConfig: AiBuilderConfig,
  abortSignal: AbortSignal
): Promise<AiBuilderConfig> {
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

  // Reject partial drafts BEFORE aiBuilderConfigSchema's defaults can mask
  // them. builderConfigSchema defaults a MISSING `content` to [], so a provider
  // that returns only `theme` (a truncated/partial draft) would otherwise
  // validate as a blank storefront and the client would apply it over the
  // merchant's real page — a silent wipe. Require `content` to be an actual
  // array the model returned; a missing or wrong-typed value is a failed
  // attempt that falls through to the next provider.
  //
  // An explicitly-present EMPTY array is allowed: it's a valid config (a
  // blank/new store's default payload is `content: []`, and a merchant can
  // legitimately ask to clear the page). The copilot returns a draft the
  // merchant reviews before publishing, so an unintended empty draft is
  // recoverable — unlike the default-masking wipe above.
  const rawContent = (object as { content?: unknown } | null)?.content;
  if (!Array.isArray(rawContent)) {
    return failShape(
      'model returned no content array (partial draft — content missing)'
    );
  }

  const parsed = aiBuilderConfigSchema.safeParse(object);
  if (!parsed.success) {
    return failShape(parsed.error.issues[0]?.message ?? 'unknown shape');
  }

  // Preserve the merchant's existing zones/root when the model OMITTED them.
  // builderConfigSchema defaults a missing `zones` to {} and `root` to a
  // title-only object — but Puck stores nested/dropzone content in `zones` and
  // the client's setData replaces the whole tree, so applying a draft that
  // dropped `zones` would wipe nested sections. Only take the model's
  // zones/root when it actually returned them (the same "preserve unless
  // changed" rule already applied to theme downstream).
  const rawObj = object as Record<string, unknown> | null;
  const result = parsed.data;
  if (rawObj && !('zones' in rawObj)) {
    result.zones = currentConfig.zones;
  }
  if (rawObj && !('root' in rawObj)) {
    result.root = currentConfig.root;
  }
  return result;
}

export interface RunBuilderProviderChainOptions {
  providerChain: CopilotTextProvider[];
  builtPrompt: string;
  currentConfig: AiBuilderConfig;
  /** Absolute route deadline (Date.now() + BUILDER_GEMINI_TIMEOUT_MS). */
  routeDeadlineMs: number;
  /** Route-level timeout signal shared by every attempt. */
  abortSignal: AbortSignal;
  /** Called before each provider attempt (e.g. to stamp the active model). */
  onProviderAttempt?: (providerName: string) => void;
  /** Called when a provider attempt fails (for logging). */
  onProviderError?: (
    providerName: string,
    error: unknown,
    isLastProvider: boolean
  ) => void;
}

// Walk the provider chain (Cerebras → Groq → Gemini → Gemini-Lite → OpenRouter
// when fully configured). ANY failure — quota, 5xx, network, per-provider
// timeout, or off-shape JSON — falls through to the next provider; the chain
// itself is the retry, spread across independent infrastructures, so a
// single-provider outage or exhausted free pool never dead-ends the merchant.
export async function runBuilderProviderChain({
  providerChain,
  builtPrompt,
  currentConfig,
  routeDeadlineMs,
  abortSignal,
  onProviderAttempt,
  onProviderError,
}: RunBuilderProviderChainOptions): Promise<AiBuilderConfig> {
  // Index of the last RELIABLE provider (the opportunistic OpenRouter tail is
  // excluded). The reliable tail gets the full remaining route budget;
  // opportunistic providers only run with whatever time is left and never have
  // budget reserved on their behalf — so the contended OpenRouter pool can
  // never abort a still-working Gemini fallback early.
  let lastReliableIndex = providerChain.length - 1;
  while (
    lastReliableIndex > 0 &&
    providerChain[lastReliableIndex]?.opportunistic
  ) {
    lastReliableIndex--;
  }

  let lastError: unknown;
  // Track the last NON-shape failure (outage/timeout/quota/network). If the
  // chain exhausts and ANY provider failed for a non-shape reason, the service
  // was genuinely unavailable — surface that (mapped to 503) instead of the
  // last provider's off-shape JSON masquerading as ai_builder_invalid_output
  // (502) as if every provider had produced a bad draft.
  let lastNonShapeError: unknown;
  let sawNonShapeError = false;

  for (const [index, provider] of providerChain.entries()) {
    const isLastProvider = index === providerChain.length - 1;
    // Reliable follows the per-provider flag (not chain position), so an
    // opportunistic entry is never retried or budget-reserved even if a future
    // chain config placed one before the last reliable provider.
    const isReliable = !provider.opportunistic;
    onProviderAttempt?.(provider.name);

    let attemptSignal: AbortSignal;
    if (index >= lastReliableIndex) {
      // Last reliable provider (and any opportunistic tail after it) may use
      // the whole remaining route budget — no per-provider cap.
      attemptSignal = abortSignal;
    } else {
      // Reserve a realistic window for the reliable tail so it always gets a
      // real attempt, but otherwise let this provider — the PRIMARY, in a
      // Gemini-only chain — use most of the route deadline instead of a fixed
      // per-provider cap. Only RELIABLE providers still downstream count
      // toward the reservation.
      const downstreamReliableCount = providerChain
        .slice(index + 1, lastReliableIndex + 1)
        .filter((downstream) => !downstream.opportunistic).length;
      const budget = computeNonFinalProviderBudgetMs(
        routeDeadlineMs - Date.now(),
        downstreamReliableCount
      );
      attemptSignal = AbortSignal.any([
        abortSignal,
        AbortSignal.timeout(budget),
      ]);
    }

    try {
      const attempt = () =>
        generateBuilderConfigOnce(
          provider.model,
          builtPrompt,
          currentConfig,
          attemptSignal
        );
      // Every RELIABLE provider — including the PRIMARY — keeps a transient
      // retry: a flaky 5xx/network blip retries once before the fallback is
      // spent, preserving the pre-chain availability behavior for keyless
      // (Gemini-only) deployments. `signal` is threaded through so the retry is
      // skipped the moment THIS provider's own budget timeout (or the route
      // deadline) fires. Two error classes are terminal for a provider (fall
      // straight to the next link, no backoff or duplicate upstream call):
      // quota/rate-limit (an exhausted pool won't recover in 750ms) and shape
      // errors (the chain's contract is that off-shape JSON advances to the
      // next provider — a model that just returned a malformed draft is likely
      // to repeat it, and the retry burns budget the fallbacks need). The
      // opportunistic tail is best-effort and is not retried.
      return await (isReliable
        ? withRetry(attempt, BUILDER_GEMINI_RETRY_CONFIG, {
            signal: attemptSignal,
            isNonRetryable: (error) =>
              isBuilderGeminiQuotaError(error) ||
              isBuilderConfigShapeError(error),
          })
        : attempt());
    } catch (error) {
      lastError = error;
      if (!isBuilderConfigShapeError(error)) {
        sawNonShapeError = true;
        lastNonShapeError = error;
      }
      // The route-level timeout fired mid-attempt: stop the chain so the
      // timeout maps to the usual failure response instead of burning it on
      // providers that can no longer answer in time.
      if (abortSignal.aborted) throw error;
      onProviderError?.(provider.name, error, isLastProvider);
    }
  }

  // Chain exhausted. Prefer a non-shape cause so a mixed failure (an early
  // provider outage followed by a final provider merely returning off-shape
  // JSON) is reported as "unavailable" (503) rather than "invalid output"
  // (502).
  throw sawNonShapeError ? lastNonShapeError : lastError;
}
