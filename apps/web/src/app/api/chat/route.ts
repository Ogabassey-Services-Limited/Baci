/**
 * Agentic Chat API Route
 *
 * POST /api/chat
 *
 * An AI-powered customer support agent that can:
 * - Search products and get details
 * - Generate virtual bank accounts for payment
 * - Check payment status
 * - Provide upsell/cross-sell recommendations
 * - Add items to cart
 *
 * Security notes:
 * - CSRF: This endpoint is intentionally exempt from CSRF validation because
 *   it serves anonymous storefront customers (no auth cookies/session).
 *   Abuse is mitigated via IP-based rate limiting instead.
 * - Rate limiting: In-memory, see provider.ts for known limitations.
 */

import crypto from 'node:crypto';
import { generateText } from 'ai';
import { headers } from 'next/headers';
import z from 'zod';
import {
  handleAddToCart,
  handleCheckPaymentStatus,
  handleCreateVirtualAccount,
  handleGetProductDetails,
  handleGetRecommendations,
  handleSearchProducts,
} from '@/ai/chat-tool-handlers';
import {
  type AddToCartParams,
  addToCartSchema,
  type CheckPaymentStatusParams,
  type CreateVirtualAccountParams,
  checkPaymentStatusSchema,
  createVirtualAccountSchema,
  type GetProductDetailsParams,
  type GetRecommendationsParams,
  getProductDetailsSchema,
  getRecommendationsSchema,
  type SearchProductsParams,
  searchProductsSchema,
  TOOL_DESCRIPTIONS,
} from '@/ai/chat-tools';
import { activeTextModel, checkRateLimit } from '@/ai/provider';
import { AGENTIC_SYSTEM_PROMPT } from '@/config/agentic-chat-system-prompt';
import {
  getAiChatModel,
  getLlmChatModel,
  getLlmServerBearer,
  getLlmServerUrl,
  getOllamaBaseUrl,
  getOllamaBasicAuth,
} from '@/env';
import { createLlmChatResponse } from '@/lib/llm-chat';
import { createOllamaChatResponse } from '@/lib/ollama-chat';
import { sanitizeHtml } from '@/lib/sanitize';

export const maxDuration = 120; // VPS-hosted Gemma can be slower on cold starts
const CUSTOMER_CHAT_TIMEOUT_MS = 8_000;

// ============================================
// REQUEST SCHEMA
// ============================================

const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().min(1).max(10000),
      })
    )
    .min(1)
    .max(50),
  sessionId: z.string().optional(),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateSessionId(ip: string): string {
  return crypto
    .createHash('sha256')
    .update(`${ip}-ogabassey-chat`)
    .digest('hex')
    .slice(0, 16);
}

function buildChatMessages(
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

function getSafeChatBackendErrorMessage(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Unknown error';

  return message.replace(/https?:\/\/\S+/g, '[url]').slice(0, 300);
}

async function bufferTextResponse(response: Response): Promise<Response> {
  // Read the upstream stream before returning so parse/disconnect failures
  // can still trigger the Gemini fallback. Used for both Ollama and llama-server
  // backends — the message is intentionally backend-neutral.
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

export async function POST(req: Request) {
  try {
    // 1. Get client IP for rate limiting
    const headersList = await headers();
    const forwardedFor = headersList.get('x-forwarded-for');
    const realIp = headersList.get('x-real-ip');
    const clientIp = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';

    // 2. Check rate limit
    const rateLimitKey = `agentic-chat:${clientIp}`;
    const rateLimit = checkRateLimit(rateLimitKey, {
      requests: 30,
      windowMs: 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Too many requests',
          message: 'Please wait a moment before sending another message.',
          resetIn: rateLimit.resetIn,
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Parse and validate request
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const validation = chatRequestSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({
          error: 'Invalid input',
          details: validation.error.format(),
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { messages, sessionId: providedSessionId } = validation.data;
    const sessionId = providedSessionId || generateSessionId(clientIp);

    // 4. Sanitize user messages
    const sanitizedMessages = messages.map((msg) => ({
      ...msg,
      content: msg.role === 'user' ? sanitizeHtml(msg.content) : msg.content,
    }));

    const llmServerUrl = getLlmServerUrl();
    if (llmServerUrl) {
      try {
        const chatModel = getLlmChatModel();
        const llmResponse = await createLlmChatResponse({
          baseUrl: llmServerUrl,
          // env.ts superRefine guarantees LLM_SERVER_BEARER is set whenever
          // LLM_SERVER_URL is set (boot fails closed otherwise). The `?? ''`
          // is a defensive belt-and-suspenders for dev/test where env
          // validation may be bypassed; createLlmChatResponse rejects empty
          // bearers with a clear "failed to build Bearer Authorization
          // header" error that the catch below routes to the Gemini fallback.
          bearer: getLlmServerBearer() ?? '',
          model: chatModel,
          messages: buildChatMessages(sanitizedMessages, chatModel),
          signal: req.signal,
          timeoutMs: CUSTOMER_CHAT_TIMEOUT_MS,
        });
        return await bufferTextResponse(llmResponse);
      } catch (error) {
        if (req.signal.aborted) {
          return new Response(
            JSON.stringify({ error: 'Client Closed Request' }),
            {
              status: 499,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        console.warn(
          '[Agentic Chat] LLM server request failed; falling back to Gemini:',
          getSafeChatBackendErrorMessage(error)
        );
      }
    } else {
      const ollamaBaseUrl = getOllamaBaseUrl();
      if (ollamaBaseUrl) {
        try {
          const chatModel = getAiChatModel();
          const ollamaResponse = await createOllamaChatResponse({
            baseUrl: ollamaBaseUrl,
            model: chatModel,
            basicAuth: getOllamaBasicAuth(),
            messages: buildChatMessages(sanitizedMessages, chatModel),
            signal: req.signal,
            timeoutMs: CUSTOMER_CHAT_TIMEOUT_MS,
          });
          return await bufferTextResponse(ollamaResponse);
        } catch (error) {
          if (req.signal.aborted) {
            return new Response(
              JSON.stringify({ error: 'Client Closed Request' }),
              {
                status: 499,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }

          console.warn(
            '[Agentic Chat] Ollama request failed; falling back to Gemini:',
            getSafeChatBackendErrorMessage(error)
          );
        }
      }
    }

    // 5. Run agentic generation with tools
    // Using AI SDK 5.0 tool format with inputSchema
    const result = await generateText({
      model: activeTextModel,
      system: AGENTIC_SYSTEM_PROMPT,
      messages: sanitizedMessages,
      tools: {
        searchProducts: {
          description: TOOL_DESCRIPTIONS.searchProducts,
          inputSchema: searchProductsSchema,
          execute: async (params: SearchProductsParams) => {
            const result = await handleSearchProducts(params);
            return JSON.stringify(result);
          },
        },
        getProductDetails: {
          description: TOOL_DESCRIPTIONS.getProductDetails,
          inputSchema: getProductDetailsSchema,
          execute: async (params: GetProductDetailsParams) => {
            const result = await handleGetProductDetails(params);
            return JSON.stringify(result);
          },
        },
        createVirtualAccount: {
          description: TOOL_DESCRIPTIONS.createVirtualAccount,
          inputSchema: createVirtualAccountSchema,
          execute: async (params: CreateVirtualAccountParams) => {
            const result = await handleCreateVirtualAccount(params, sessionId);
            return JSON.stringify(result);
          },
        },
        checkPaymentStatus: {
          description: TOOL_DESCRIPTIONS.checkPaymentStatus,
          inputSchema: checkPaymentStatusSchema,
          execute: async (params: CheckPaymentStatusParams) => {
            const result = await handleCheckPaymentStatus(params);
            return JSON.stringify(result);
          },
        },
        getRecommendations: {
          description: TOOL_DESCRIPTIONS.getRecommendations,
          inputSchema: getRecommendationsSchema,
          execute: async (params: GetRecommendationsParams) => {
            const result = await handleGetRecommendations(params);
            return JSON.stringify(result);
          },
        },
        addToCart: {
          description: TOOL_DESCRIPTIONS.addToCart,
          inputSchema: addToCartSchema,
          execute: async (params: AddToCartParams) => {
            const result = await handleAddToCart(params);
            return JSON.stringify(result);
          },
        },
      },
    });

    // 6. Return the final text response
    return new Response(result.text, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error) {
    console.error('[Agentic Chat] Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: "I'm having trouble right now. Please try again in a moment.",
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
