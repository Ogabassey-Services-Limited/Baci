import { createCerebras } from '@ai-sdk/cerebras';
import { createGroq } from '@ai-sdk/groq';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import {
  ACTIVE_TEXT_MODEL_NAME,
  activeTextModel,
  FALLBACK_TEXT_MODEL_NAME,
  fallbackTextModel,
} from './provider';

// AI Copilot text-provider chain (builder route).
//
// Order: Cerebras Gemma (fastest; free 1M tokens/day) → Groq gpt-oss-120b
// (free 14,400 req/day; supports loose JSON output — Groq's Llama models
// reject even loose record types) → Gemini 2.5 Flash → Flash-Lite →
// OpenRouter free Gemma-4 (opportunistic last resort). The Cerebras/Groq/
// OpenRouter entries only join the chain when their API keys are configured,
// so environments without those keys keep the Gemini-only behavior.
// Independent free pools across several infrastructures mean AI editing keeps
// working even when any one provider is down or quota-exhausted — no Google
// billing dependency.
//
// Measured on the real copilot task (production keys, 2026-07-07):
// cerebras/gemma-4-31b 0.6-0.8s, groq/gpt-oss-120b 1-3s, gemini-2.5-flash
// 3-4s, flash-lite ~8s — all returned a valid, structure-preserving config
// via loose JSON mode (see the builder route for why no strict schema is
// sent). Cerebras' free tier caps context at ~8K tokens; oversized configs
// fail fast there and fall through.
// Cerebras serves Gemma 4 only as a PREVIEW endpoint (evaluation-tier, may
// change/discontinue on short notice). It is the primary here by deliberate
// choice: the product goal is a Gemma-served copilot, and Cerebras is the only
// currently-healthy Gemma host (Google's Gemma API 500s since April 2026;
// OpenRouter's free Gemma pool is 429-contended). Two things gate the risk:
// (1) it is opt-in — the chain only uses Cerebras when CEREBRAS_API_KEY is
// explicitly set (production otherwise runs Gemini); and (2) any Cerebras
// failure falls through to Groq → Gemini. The exact model is env-overridable
// (COPILOT_CEREBRAS_MODEL) so ops can swap to a stable/production model without
// a code change if the preview endpoint is retired.
export const COPILOT_CEREBRAS_MODEL =
  process.env.COPILOT_CEREBRAS_MODEL?.trim() || 'gemma-4-31b';
export const COPILOT_GROQ_MODEL =
  process.env.COPILOT_GROQ_MODEL?.trim() || 'openai/gpt-oss-120b';
// OpenRouter's free Gemma-4 pool is heavily contended — probes on 2026-07-07
// hit upstream 429 "temporarily rate-limited" on 25/25 attempts across two
// keys/two days. It sits LAST and is flagged `opportunistic`: a bonus free
// Gemma-4 pool consulted only with time left over, and — critically — the
// route must NOT reserve any of the deadline for it, so it can never starve a
// working Gemini fallback (it usually 429s instantly anyway).
export const COPILOT_OPENROUTER_MODEL = 'google/gemma-4-31b-it:free';

export interface CopilotTextProvider {
  /** Stable identifier for logs/metrics, e.g. "cerebras:gemma-4-31b". */
  name: string;
  model: LanguageModel;
  /**
   * A best-effort bonus pool (contended free tier) that must never have
   * route-deadline time reserved on its behalf — it only runs with whatever
   * time is left after the reliable providers, and only if one of them fails.
   */
  opportunistic?: boolean;
}

const cerebrasApiKey = process.env.CEREBRAS_API_KEY?.trim();
const groqApiKey = process.env.GROQ_API_KEY?.trim();
const openRouterApiKey = process.env.OPENROUTER_API_KEY?.trim();

const cerebras = cerebrasApiKey
  ? createCerebras({ apiKey: cerebrasApiKey })
  : null;
const groq = groqApiKey ? createGroq({ apiKey: groqApiKey }) : null;
const openRouter = openRouterApiKey
  ? createOpenAICompatible({
      name: 'openrouter',
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: openRouterApiKey,
    })
  : null;

export function getCopilotTextProviderChain(): CopilotTextProvider[] {
  const chain: CopilotTextProvider[] = [];
  if (cerebras) {
    chain.push({
      name: `cerebras:${COPILOT_CEREBRAS_MODEL}`,
      model: cerebras(COPILOT_CEREBRAS_MODEL),
    });
  }
  if (groq) {
    chain.push({
      name: `groq:${COPILOT_GROQ_MODEL}`,
      model: groq(COPILOT_GROQ_MODEL),
    });
  }
  chain.push({
    name: `google:${ACTIVE_TEXT_MODEL_NAME}`,
    model: activeTextModel,
  });
  chain.push({
    name: `google:${FALLBACK_TEXT_MODEL_NAME}`,
    model: fallbackTextModel,
  });
  if (openRouter) {
    chain.push({
      name: `openrouter:${COPILOT_OPENROUTER_MODEL}`,
      model: openRouter(COPILOT_OPENROUTER_MODEL),
      opportunistic: true,
    });
  }
  return chain;
}
