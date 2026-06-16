import { buildLlmBearerAuthHeader } from '@/lib/llm-auth';
import { buildOllamaBasicAuthHeader } from '@/lib/ollama-auth';

export interface GemmaCompletionMessage {
  role: 'system' | 'user';
  content: string;
}

export interface RequestGemmaCompletionOptions {
  provider?: 'auto' | 'gemini' | 'llm' | 'ollama';
  llmServerUrl?: string;
  llmServerBearer?: string;
  ollamaBaseUrl?: string;
  ollamaBasicAuth?: string;
  model: string;
  messages: GemmaCompletionMessage[];
  maxTokens: number;
  signal: AbortSignal;
  temperature: number;
}

type OpenAiJsonResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
};

type OllamaJsonResponse = {
  message?: {
    content?: unknown;
  };
  response?: unknown;
};

const MODEL_NAME_LINE_BREAK_PATTERN = /\\n|\r?\n|\r/g;

function cleanModelName(model: string): string {
  return model.replace(MODEL_NAME_LINE_BREAK_PATTERN, '').trim();
}

function buildChatCompletionsUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  const trimmedPath = url.pathname.replace(/\/+$/, '').replace(/\/v1$/i, '');
  url.pathname = `${trimmedPath}/v1/chat/completions`;
  return url.toString();
}

function buildOllamaChatUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  const trimmedPath = url.pathname.replace(/\/+$/, '').replace(/\/api$/i, '');
  url.pathname = `${trimmedPath}/api/chat`;
  return url.toString();
}

async function requestOpenAiCompletion({
  llmServerUrl,
  llmServerBearer,
  model,
  messages,
  maxTokens,
  signal,
  temperature,
}: RequestGemmaCompletionOptions): Promise<unknown> {
  if (!llmServerUrl || !llmServerBearer) {
    throw new Error('LLM configuration is missing');
  }

  const authorization = buildLlmBearerAuthHeader(llmServerBearer);
  if (!authorization) {
    throw new Error('LLM configuration is missing');
  }

  const response = await fetch(buildChatCompletionsUrl(llmServerUrl), {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      max_tokens: maxTokens,
      messages,
      model: cleanModelName(model),
      response_format: { type: 'json_object' },
      stream: false,
      temperature,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Gemma completion failed with ${response.status}`);
  }

  const payload = (await response.json()) as OpenAiJsonResponse;
  return payload.choices?.[0]?.message?.content;
}

async function requestOllamaCompletion({
  ollamaBaseUrl,
  ollamaBasicAuth,
  model,
  messages,
  maxTokens,
  signal,
  temperature,
}: RequestGemmaCompletionOptions): Promise<unknown> {
  if (!ollamaBaseUrl) {
    throw new Error('Ollama configuration is missing');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (ollamaBasicAuth) {
    const authorization = buildOllamaBasicAuthHeader(ollamaBasicAuth);
    if (!authorization) {
      throw new Error('Ollama configuration is missing');
    }
    headers.Authorization = authorization;
  }

  const response = await fetch(buildOllamaChatUrl(ollamaBaseUrl), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      format: 'json',
      keep_alive: '10m',
      messages,
      model: cleanModelName(model),
      options: {
        num_ctx: 2048,
        num_predict: maxTokens,
        temperature,
      },
      stream: false,
      think: false,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Gemma completion failed with ${response.status}`);
  }

  const payload = (await response.json()) as OllamaJsonResponse;
  return payload.message?.content ?? payload.response;
}

export function requestGemmaCompletion(
  options: RequestGemmaCompletionOptions
): Promise<unknown> {
  if (options.provider === 'gemini') {
    return Promise.reject(
      new Error('gemini is not supported for this endpoint')
    );
  }

  if (options.provider === 'llm') {
    return requestOpenAiCompletion(options);
  }

  if (options.provider === 'ollama') {
    return requestOllamaCompletion(options);
  }

  // Fallback to 'auto' logic: prefer LLM only when its full config is usable.
  if (
    options.llmServerUrl &&
    options.llmServerBearer &&
    buildLlmBearerAuthHeader(options.llmServerBearer)
  ) {
    return requestOpenAiCompletion(options);
  }

  if (options.ollamaBaseUrl) {
    return requestOllamaCompletion(options);
  }

  return Promise.reject(new Error('LLM configuration is missing'));
}
