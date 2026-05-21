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
import {
  bufferTextResponse,
  buildChatMessages,
  CUSTOMER_CHAT_TIMEOUT_MS,
  createStaticChatFallbackResponse,
  getSafeChatBackendErrorMessage,
} from '@/app/api/chat/route-helpers';
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

function generateSessionId(ip: string): string {
  return crypto
    .createHash('sha256')
    .update(`${ip}-ogabassey-chat`)
    .digest('hex')
    .slice(0, 16);
}

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const forwardedFor = headersList.get('x-forwarded-for');
    const realIp = headersList.get('x-real-ip');
    const clientIp = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';

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

    const sanitizedMessages = messages.map((msg) => ({
      ...msg,
      content: msg.role === 'user' ? sanitizeHtml(msg.content) : msg.content,
    }));

    const llmServerUrl = getLlmServerUrl();
    if (llmServerUrl) {
      // Resolve static config OUTSIDE the try so a misconfigured deployment
      // (blank LLM_CHAT_MODEL, env-validation bypass, etc.) surfaces as a 500
      // rather than getting silently logged as "LLM server request failed"
      // and quietly falling back to Gemini. env.ts superRefine guarantees
      // LLM_SERVER_BEARER is set whenever LLM_SERVER_URL is set; the `?? ''`
      // covers test environments where env validation is bypassed —
      // createLlmChatResponse will reject empty bearers loudly.
      const chatModel = getLlmChatModel();
      const bearer = getLlmServerBearer() ?? '';
      try {
        const llmResponse = await createLlmChatResponse({
          baseUrl: llmServerUrl,
          bearer,
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
        const chatModel = getAiChatModel();
        const basicAuth = getOllamaBasicAuth();
        try {
          const ollamaResponse = await createOllamaChatResponse({
            baseUrl: ollamaBaseUrl,
            model: chatModel,
            basicAuth,
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

    let result: { text: string } | null = null;
    try {
      result = await generateText({
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
              const result = await handleCreateVirtualAccount(
                params,
                sessionId
              );
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
    } catch (error) {
      console.error(
        '[Agentic Chat] Gemini fallback failed; returning static response:',
        getSafeChatBackendErrorMessage(error)
      );
    }

    if (!result) {
      return createStaticChatFallbackResponse();
    }

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
