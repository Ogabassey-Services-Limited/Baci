import { buildOllamaBasicAuthHeader } from '@/lib/ollama-auth';
import type {
  OllamaChatMessage,
  OllamaChatTool,
  OllamaToolCall,
} from '@/lib/ollama-chat';

interface CreateOllamaAgenticChatResponseOptions {
  baseUrl: string;
  model: string;
  messages: OllamaChatMessage[];
  tools: OllamaChatTool[];
  executeToolCall: (call: OllamaToolCall) => Promise<string>;
  onToolExecuted?: (call: OllamaToolCall, result: string) => void;
  basicAuth?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

interface OllamaChatPayload {
  message?: {
    content?: string;
    tool_calls?: unknown;
  };
  error?: string;
}

const OLLAMA_AGENTIC_TIMEOUT_MS = 90_000;
const OLLAMA_AGENTIC_MAX_TOOL_ROUNDS = 4;
const MODEL_NAME_LINE_BREAK_PATTERN = /\\n|\r?\n|\r/g;
const OLLAMA_AGENTIC_TIMEOUT_REASON_NAME = 'TimeoutError';

function normalizeOllamaBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '').replace(/\/api$/i, '');
}

function cleanModelName(model: string): string {
  return model.replace(MODEL_NAME_LINE_BREAK_PATTERN, '').trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createOllamaTimeoutReason(): DOMException {
  return new DOMException(
    'Ollama chat request timed out',
    OLLAMA_AGENTIC_TIMEOUT_REASON_NAME
  );
}

function createAbortSignal(
  upstreamSignal: AbortSignal | undefined,
  timeoutMs: number
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(createOllamaTimeoutReason()),
    timeoutMs
  );
  const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);

  if (upstreamSignal?.aborted) {
    controller.abort(upstreamSignal.reason);
  } else {
    upstreamSignal?.addEventListener('abort', abortFromUpstream, {
      once: true,
    });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeoutId);
      upstreamSignal?.removeEventListener('abort', abortFromUpstream);
    },
  };
}

function isOllamaTimeoutAbort(signal: AbortSignal): boolean {
  return (
    signal.aborted &&
    signal.reason instanceof DOMException &&
    signal.reason.name === OLLAMA_AGENTIC_TIMEOUT_REASON_NAME
  );
}

function createRequestBody(
  model: string,
  messages: OllamaChatMessage[],
  tools: OllamaChatTool[]
) {
  return {
    model: cleanModelName(model),
    messages,
    tools,
    stream: false,
    think: false,
    keep_alive: '10m',
    options: {
      num_ctx: 4096,
      num_predict: 384,
      temperature: 0.4,
    },
  };
}

function normalizeToolCall(value: unknown): OllamaToolCall | null {
  if (!isRecord(value) || !isRecord(value.function)) return null;
  const { function: fn } = value;
  if (typeof fn.name !== 'string' || !fn.name.trim()) return null;

  return {
    type: value.type === 'function' ? 'function' : undefined,
    function: {
      index: typeof fn.index === 'number' ? fn.index : undefined,
      name: fn.name,
      arguments: fn.arguments,
    },
  };
}

function getToolCalls(payload: OllamaChatPayload): OllamaToolCall[] {
  const rawToolCalls = payload.message?.tool_calls;
  if (!Array.isArray(rawToolCalls)) return [];
  return rawToolCalls
    .map((value) => normalizeToolCall(value))
    .filter((value): value is OllamaToolCall => value !== null);
}

async function parseOllamaPayload(
  response: Response
): Promise<OllamaChatPayload> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Invalid Ollama chat JSON: ${message}`);
  }

  if (!isRecord(payload)) {
    throw new Error('Invalid Ollama chat payload');
  }

  if (typeof payload.error === 'string') {
    throw new Error(payload.error);
  }

  const message = isRecord(payload.message) ? payload.message : undefined;
  return {
    message: message
      ? {
          content:
            typeof message.content === 'string' ? message.content : undefined,
          tool_calls: message.tool_calls,
        }
      : undefined,
  };
}

async function fetchOllamaPayload(
  baseUrl: string,
  headers: Record<string, string>,
  signal: AbortSignal,
  body: unknown
): Promise<OllamaChatPayload> {
  let response: Response;
  try {
    response = await fetch(`${normalizeOllamaBaseUrl(baseUrl)}/api/chat`, {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (signal.aborted) {
      if (isOllamaTimeoutAbort(signal)) {
        throw new Error('Ollama chat request timed out');
      }
      throw new Error('Ollama chat request aborted');
    }
    throw error;
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `Ollama chat returned ${response.status}${errorText ? `: ${errorText}` : ''}`
    );
  }

  return parseOllamaPayload(response);
}

export async function createOllamaAgenticChatResponse({
  baseUrl,
  model,
  messages,
  tools,
  executeToolCall,
  onToolExecuted,
  basicAuth,
  signal,
  timeoutMs = OLLAMA_AGENTIC_TIMEOUT_MS,
}: CreateOllamaAgenticChatResponseOptions): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (basicAuth) {
    const authorization = buildOllamaBasicAuthHeader(basicAuth);
    if (!authorization) {
      throw new Error(
        'failed to build Basic Authorization header from basicAuth'
      );
    }
    headers.Authorization = authorization;
  }

  const { signal: ollamaSignal, cleanup } = createAbortSignal(
    signal,
    timeoutMs
  );
  const conversation: OllamaChatMessage[] = [...messages];
  let toolRounds = 0;

  try {
    while (true) {
      const payload = await fetchOllamaPayload(
        baseUrl,
        headers,
        ollamaSignal,
        createRequestBody(model, conversation, tools)
      );
      const content = payload.message?.content ?? '';
      const toolCalls = getToolCalls(payload);

      if (toolCalls.length === 0) {
        if (!content.trim()) {
          throw new Error('Chat returned an empty completion');
        }
        return new Response(content, {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }

      if (toolRounds >= OLLAMA_AGENTIC_MAX_TOOL_ROUNDS) {
        break;
      }
      toolRounds += 1;

      conversation.push({
        role: 'assistant',
        content,
        tool_calls: toolCalls,
      });

      for (const call of toolCalls) {
        const result = await executeToolCall(call);
        onToolExecuted?.(call, result);
        conversation.push({
          role: 'tool',
          tool_name: call.function.name,
          content: result,
        });
      }
    }
  } finally {
    cleanup();
  }

  throw new Error('Ollama tool loop exceeded maximum rounds');
}
