import { generateObject, type ModelMessage } from 'ai';
import type { ZodType } from 'zod';
import {
  clearProviderCooldown,
  recordProviderFailure,
} from './provider-cooldown';
import { selectAttemptableProviders } from './select-attemptable-providers';
import {
  type ChainProviderOptions,
  getTextProviderChain,
  type TextProvider,
} from './text-provider-chain';

// Generic chain executor for structured (JSON) generation. Uses
// `output: 'no-schema'` (loose JSON mode) and validates in-code with the
// caller's Zod schema instead of handing providers a strict JSON schema —
// the providers' strict structured-output modes reject schemas in
// incompatible ways (Cerebras rejects string `minLength` and empty `{}`
// sub-schemas, Groq rejects the `propertyNames` emitted by record types),
// while loose JSON mode is universally supported. The in-code safeParse is
// the gate: off-shape JSON counts as a failed attempt and falls through to
// the next provider. Same walk semantics as generate-text-with-chain: one
// attempt per provider, opportunistic providers skipped, any failure falls
// through.

export const ALL_OBJECT_PROVIDERS_FAILED_ERROR_NAME =
  'AllObjectProvidersFailedError';

const DEFAULT_PER_PROVIDER_TIMEOUT_MS = 25_000;

const DEFAULT_PROVIDER_OPTIONS: ChainProviderOptions = {
  google: { thinkingConfig: { thinkingBudget: 0 } },
};

export interface GenerateObjectWithChainOptions<T> {
  /** In-code validation gate applied to each provider's raw JSON. */
  schema: ZodType<T>;
  /** Defaults to the platform text chain; pass the vision chain for image input. */
  chain?: TextProvider[];
  system?: string;
  prompt?: string;
  messages?: ModelMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  perProviderTimeoutMs?: number;
  /**
   * Total wall-clock budget for the ENTIRE walk. Each attempt is capped to the
   * time left, and the walk stops (throwing exhaustion) once it elapses instead
   * of starting another provider — so a slow provider can't consume a route's
   * whole `maxDuration` and starve the caller's fallback. Omit for no cap.
   */
  overallTimeoutMs?: number;
  abortSignal?: AbortSignal;
  providerOptions?: ChainProviderOptions;
  /**
   * Extra semantic gate run after schema validation, with access to the raw
   * pre-parse JSON (schema defaults can mask missing fields — see the builder
   * chain's missing-`content` lesson). Return an error string to reject the
   * attempt and fall through; return null to accept.
   */
  validate?: (parsed: T, raw: unknown) => string | null;
  onProviderAttempt?: (providerName: string) => void;
  onProviderError?: (
    providerName: string,
    error: unknown,
    isLastProvider: boolean
  ) => void;
}

export interface ChainObjectResult<T> {
  object: T;
  /** Which provider served the completion, e.g. "cerebras:gemma-4-31b". */
  providerName: string;
}

function buildExhaustionError(failures: string[]): Error {
  const error = new Error(
    `all object providers failed: ${failures.join(' | ')}`
  );
  error.name = ALL_OBJECT_PROVIDERS_FAILED_ERROR_NAME;
  return error;
}

export async function generateObjectWithChain<T>(
  options: GenerateObjectWithChainOptions<T>
): Promise<ChainObjectResult<T>> {
  const chain = selectAttemptableProviders(
    options.chain ?? getTextProviderChain()
  );
  if (chain.length === 0) {
    throw buildExhaustionError(['no providers configured']);
  }

  const timeoutMs =
    options.perProviderTimeoutMs ?? DEFAULT_PER_PROVIDER_TIMEOUT_MS;
  const overallDeadline =
    options.overallTimeoutMs != null
      ? Date.now() + options.overallTimeoutMs
      : null;
  const failures: string[] = [];

  for (let i = 0; i < chain.length; i++) {
    const provider = chain[i];
    const isLastProvider = i === chain.length - 1;

    if (options.abortSignal?.aborted) {
      throw buildExhaustionError([...failures, 'request aborted']);
    }

    // Stop before starting a provider we don't have time to finish, so the
    // caller's fallback runs inside the route deadline.
    const remainingMs = overallDeadline ? overallDeadline - Date.now() : null;
    if (remainingMs != null && remainingMs <= 0) {
      throw buildExhaustionError([...failures, 'overall deadline exceeded']);
    }
    const attemptTimeoutMs =
      remainingMs != null ? Math.min(timeoutMs, remainingMs) : timeoutMs;

    options.onProviderAttempt?.(provider.name);
    try {
      const timeoutSignal = AbortSignal.timeout(attemptTimeoutMs);
      const { object: raw } = await generateObject({
        model: provider.model,
        output: 'no-schema',
        system: options.system,
        ...(options.messages
          ? { messages: options.messages }
          : { prompt: options.prompt ?? '' }),
        temperature: options.temperature,
        maxOutputTokens: options.maxOutputTokens,
        abortSignal: options.abortSignal
          ? AbortSignal.any([options.abortSignal, timeoutSignal])
          : timeoutSignal,
        maxRetries: 0,
        providerOptions: options.providerOptions ?? DEFAULT_PROVIDER_OPTIONS,
      });

      const parsed = options.schema.safeParse(raw);
      if (!parsed.success) {
        throw new Error(
          `response JSON failed validation: ${
            parsed.error.issues[0]?.message ?? 'unknown shape'
          }`
        );
      }

      const semanticError = options.validate?.(parsed.data, raw) ?? null;
      if (semanticError) {
        throw new Error(`response JSON rejected: ${semanticError}`);
      }

      clearProviderCooldown(provider.name);
      return { object: parsed.data, providerName: provider.name };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${provider.name}: ${message.slice(0, 200)}`);
      recordProviderFailure(provider.name, error);
      options.onProviderError?.(provider.name, error, isLastProvider);
    }
  }

  throw buildExhaustionError(failures);
}
