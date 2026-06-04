/**
 * VPS responses are buffered before delivery so a malformed stream can fall
 * back cleanly. Allow a complete bounded generation within the route's 120s
 * execution limit; an 8s budget rejected healthy production completions.
 */
export const CUSTOMER_CHAT_TIMEOUT_MS = 60_000;

export const CUSTOMER_CHAT_FALLBACK_TEXT =
  "I'm sorry, our AI assistant is temporarily busy. Please use the store search, checkout, or WhatsApp support and we'll help you from there.";

const VPS_CHAT_SYSTEM_PROMPT =
  "You are Ogabassey's shopping assistant. Keep replies brief, helpful, and honest. " +
  'You have commerce tools for product search, product details, recommendations, cart actions, payment account requests, and payment status checks. ' +
  'Use tools before answering questions about live inventory, current prices, availability, checkout, cart actions, or payment status. ' +
  'Never invent stock, pricing, order, bank-account, or payment information; if a tool cannot complete an action, explain the tool result and suggest checkout or WhatsApp support.';

export function buildChatMessages(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  model: string
) {
  return [
    {
      role: 'system' as const,
      content: `${VPS_CHAT_SYSTEM_PROMPT}

You are currently powered by VPS-hosted ${model}.`,
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
  _error: unknown,
  signal?: AbortSignal
): boolean {
  return signal?.aborted === true;
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
