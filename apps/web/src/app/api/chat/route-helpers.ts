import { AGENTIC_SYSTEM_PROMPT } from '@/config/agentic-chat-system-prompt';

export const CUSTOMER_CHAT_TIMEOUT_MS = 8_000;

export const CUSTOMER_CHAT_FALLBACK_TEXT =
  "I'm sorry, our AI assistant is temporarily busy. Please use the store search, checkout, or WhatsApp support and we'll help you from there.";

export function buildChatMessages(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  model: string
) {
  return [
    {
      role: 'system' as const,
      content: `${AGENTIC_SYSTEM_PROMPT}

You are currently powered by VPS-hosted ${model}. Tool/function calling is not available in this mode, so do not pretend that you checked live inventory, generated a bank account, or verified payment unless that information is explicitly present in the conversation. For exact availability, prices, checkout, or payment confirmation, guide the customer to the store checkout or support.`,
    },
    ...messages
      .filter((msg) => msg.role !== 'system')
      .map((msg) => ({
        role:
          msg.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: msg.content,
      })),
  ];
}

export function getSafeChatBackendErrorMessage(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Unknown error';

  return message.replace(/https?:\/\/\S+/g, '[url]').slice(0, 300);
}

export function isChatAbortError(
  error: unknown,
  signal?: AbortSignal
): boolean {
  return (
    signal?.aborted === true ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

export async function bufferTextResponse(
  response: Response
): Promise<Response> {
  // Read upstream streams before returning so parse/disconnect failures can
  // still trigger the customer-safe fallback path.
  const text = await response.text();
  if (!text.trim()) {
    throw new Error('Chat returned an empty completion');
  }

  return new Response(text, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  });
}

export function createStaticChatFallbackResponse(): Response {
  return new Response(CUSTOMER_CHAT_FALLBACK_TEXT, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'x-baci-chat-fallback': 'static',
    },
  });
}

export function createClientClosedRequestResponse(): Response {
  return new Response(JSON.stringify({ error: 'Client Closed Request' }), {
    status: 499,
    headers: { 'Content-Type': 'application/json' },
  });
}
