import { buildLlmBearerAuthHeader } from '@/lib/llm-auth';
import { buildOllamaBasicAuthHeader } from '@/lib/ollama-auth';

export interface GemmaQuestionCompletionMessage {
  role: 'system' | 'user';
  content: string;
}

interface RequestGemmaQuestionCompletionOptions {
  llmServerUrl?: string;
  llmServerBearer?: string;
  ollamaBaseUrl?: string;
  ollamaBasicAuth?: string;
  model: string;
  messages: GemmaQuestionCompletionMessage[];
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
}: RequestGemmaQuestionCompletionOptions): Promise<unknown> {
  if (!llmServerUrl || !llmServerBearer) {
    throw new Error('Gemma quiz generation is not configured');
  }

  const authorization = buildLlmBearerAuthHeader(llmServerBearer);
  if (!authorization) {
    throw new Error('Gemma quiz generation is not configured');
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
    throw new Error(`Gemma quiz generation failed with ${response.status}`);
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
}: RequestGemmaQuestionCompletionOptions): Promise<unknown> {
  if (!ollamaBaseUrl) {
    throw new Error('Gemma quiz generation is not configured');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (ollamaBasicAuth) {
    const authorization = buildOllamaBasicAuthHeader(ollamaBasicAuth);
    if (!authorization) {
      throw new Error('Gemma quiz generation is not configured');
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
        num_ctx: 4096,
        num_predict: maxTokens,
        temperature,
      },
      stream: false,
      think: false,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Gemma quiz generation failed with ${response.status}`);
  }

  const payload = (await response.json()) as OllamaJsonResponse;
  return payload.message?.content ?? payload.response;
}

export function requestGemmaQuestionCompletion(
  options: RequestGemmaQuestionCompletionOptions
): Promise<unknown> {
  if (options.llmServerUrl) {
    return requestOpenAiCompletion(options);
  }

  return requestOllamaCompletion(options);
}
