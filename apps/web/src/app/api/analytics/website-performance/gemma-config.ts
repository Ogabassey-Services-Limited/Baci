import {
  getAiChatModel,
  getAiChatProvider,
  getLlmChatModel,
  getLlmServerBearer,
  getLlmServerUrl,
  getOllamaBaseUrl,
  getOllamaBasicAuth,
} from '@/env';
import type { RequestGemmaCompletionOptions } from '@/lib/gemma/gemma-completion';

export type WebsitePerformanceGemmaConfig = Pick<
  RequestGemmaCompletionOptions,
  | 'llmServerBearer'
  | 'llmServerUrl'
  | 'model'
  | 'ollamaBaseUrl'
  | 'ollamaBasicAuth'
  | 'provider'
>;

export function resolveWebsitePerformanceGemmaConfig(): WebsitePerformanceGemmaConfig {
  const configuredProvider = getAiChatProvider();
  const ollamaBaseUrl = getOllamaBaseUrl();
  const llmServerUrl = getLlmServerUrl();
  const llmServerBearer = getLlmServerBearer();

  if (configuredProvider === 'ollama') {
    if (!ollamaBaseUrl) {
      throw new Error(
        'Ollama provider explicitly configured but OLLAMA_BASE_URL is missing'
      );
    }

    return {
      model: getAiChatModel(),
      ollamaBaseUrl,
      ollamaBasicAuth: getOllamaBasicAuth(),
      provider: 'ollama',
    };
  }

  if (configuredProvider === 'llm') {
    if (!llmServerUrl || !llmServerBearer) {
      throw new Error(
        'LLM provider explicitly configured but LLM_SERVER_URL or LLM_SERVER_BEARER is missing'
      );
    }

    return {
      llmServerBearer,
      llmServerUrl,
      model: getLlmChatModel(),
      provider: 'llm',
    };
  }

  if (configuredProvider === 'gemini') {
    throw new Error(
      'Gemini provider is not supported for website performance Gemma insights'
    );
  }

  // This route is specifically a Gemma website-performance summarizer. In
  // `auto`, prefer the configured VPS Ollama/Gemma endpoint over a generic
  // OpenAI-compatible relay so a stale LLM_SERVER_* value cannot shadow the
  // live Gemma service and produce 401s.
  if (ollamaBaseUrl) {
    return {
      model: getAiChatModel(),
      ollamaBaseUrl,
      ollamaBasicAuth: getOllamaBasicAuth(),
      provider: 'ollama',
    };
  }

  if (llmServerUrl && llmServerBearer) {
    return {
      llmServerBearer,
      llmServerUrl,
      model: getLlmChatModel(),
      provider: 'llm',
    };
  }

  throw new Error('Gemma configuration is missing');
}
