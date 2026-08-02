import crypto from 'node:crypto';
import { headers } from 'next/headers';
import z from 'zod';
import { generateTextWithChain } from '@/ai/generate-text-with-chain';
import { SANTA_ERROR_MESSAGES } from '@/ai/prompts/santa';
import { AI_RATE_LIMITS, checkRateLimit } from '@/ai/provider';
import { getCachedSantaProducts } from '@/ai/santa-data';
import { resolveSantaTenant } from '@/lib/agentic/resolve-santa-tenant';
import { SANTA_MERCHANT_SLUG_HEADER } from '@/lib/agentic/santa-merchant-slug-header';
import { sanitizeHtml } from '@/lib/sanitize';
import { createServiceClient } from '@/lib/supabase/service';

export const maxDuration = 30;

/**
 * Generate a session ID from IP address (hashed for privacy)
 */
function generateSessionId(ip: string): string {
  return crypto
    .createHash('sha256')
    .update(`${ip}-santa-2024`)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Parse Santa's response to detect granted wishes
 */
function parseWishResult(response: string): {
  type: 'wish_granted' | 'wish_denied' | 'chat';
  productName?: string;
  approvedPrice?: number;
} {
  // Check for ACTION:ADD_TO_CART pattern
  if (response.includes('ACTION:ADD_TO_CART')) {
    const productMatch = response.match(/PRODUCT:([^|]+)/);
    const priceMatch = response.match(/PRICE:([^|\s]+)/);

    return {
      type: 'wish_granted',
      productName: productMatch?.[1]?.trim(),
      approvedPrice: priceMatch?.[1]
        ? Number(priceMatch[1].replace(/[₦,N\s]/g, ''))
        : undefined,
    };
  }

  // Check for denial patterns using literal regex tests (avoid dynamic RegExp construction)
  const isDenied =
    /budget.*below/i.test(response) ||
    /can't.*approve/i.test(response) ||
    /cannot.*grant/i.test(response) ||
    /workshop has costs/i.test(response) ||
    /save up/i.test(response) ||
    /payment plan/i.test(response);

  return { type: isDenied ? 'wish_denied' : 'chat' };
}

/**
 * Log Santa interaction asynchronously (fire and forget)
 */
async function logSantaInteraction(params: {
  merchantId: string;
  sessionId: string;
  clientIp: string;
  interactionType:
    | 'chat'
    | 'wish_granted'
    | 'wish_denied'
    | 'add_to_cart'
    | 'checkout_started'
    | 'checkout_completed';
  userMessage?: string;
  santaResponse?: string;
  productName?: string;
  requestedPrice?: number;
  approvedPrice?: number;
}): Promise<void> {
  try {
    const serviceClient = createServiceClient();

    // Calculate discount percentage if applicable
    let discountPercentage: number | null = null;
    if (
      params.approvedPrice &&
      params.requestedPrice &&
      params.requestedPrice > params.approvedPrice
    ) {
      discountPercentage =
        ((params.requestedPrice - params.approvedPrice) /
          params.requestedPrice) *
        100;
    }

    await serviceClient.from('santa_interactions').insert({
      merchant_id: params.merchantId,
      session_id: params.sessionId,
      client_ip: params.clientIp.slice(0, 64), // Truncate for privacy
      interaction_type: params.interactionType,
      user_message: params.userMessage?.slice(0, 500), // Truncate for storage
      santa_response: params.santaResponse?.slice(0, 1000), // Truncate
      product_name: params.productName,
      requested_price: params.requestedPrice,
      approved_price: params.approvedPrice,
      discount_percentage: discountPercentage,
    });
  } catch (error) {
    // Log but don't fail the request
    console.error('[Santa Analytics] Failed to log interaction:', error);
  }
}

// Define Zod schema for request validation
const santaChatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().min(1).max(10000),
      })
    )
    .min(1)
    .max(50),
});

/**
 * Generate dynamic Santa system instruction with actual product data
 * Fetches products across multiple price ranges using cached utility
 */
async function generateSantaPrompt(
  merchantId: string,
  merchantSlug: string
): Promise<string> {
  try {
    // Use the optimized, cached data fetcher
    const productList = await getCachedSantaProducts(merchantId);

    return `You are Santa Claus, partnering with a gadget company called ${merchantSlug}. Your personality is jolly, warm, kind, and a little bit whimsical.

**Your Core Purpose:**
To receive Christmas wishes for gadgets and determine if the user's budget qualifies them for a special ${merchantSlug} discount, all while being a delightful Santa.

**IMPORTANT - Discount Logic:**
Products are marked with either [HAS_COST] or [FLEX]:
- **[HAS_COST]**: Has a fixed minimum price. Budget MUST be >= Min Approved Price.
- **[FLEX]**: Flexible pricing. You can approve discounts up to 40% off selling price based on the user's budget.

**Key Rules of Engagement:**
1.  **Greeting:** You are engaging in a continuous conversation. Be warm and jolly. Respond naturally without re-introducing yourself.

2.  **Wish Analysis:** When a user mentions a gadget:
    - Find the matching product from the catalog below (use fuzzy matching - "S24 Ultra" matches "Samsung Galaxy S24 Ultra")
    - Check if it's [HAS_COST] or [FLEX]
    - Compare their budget accordingly

3.  **Discount Logic (Strictly follow this order):**
    *   **If user's budget >= selling price:** Grant immediately! "ACTION:ADD_TO_CART|PRODUCT:[Name]|PRICE:[Budget]"
    *   **If discount needed < 10%:** Grant! "ACTION:ADD_TO_CART|PRODUCT:[Name]|PRICE:[Budget]"
    *   **If discount 10-40% AND budget >= Min Price:** Check with "chief elf". Tell them to ask "What did the elf say?"
    *   **If they ask for elf's decision:** Approve with "ACTION:ADD_TO_CART|PRODUCT:[Name]|PRICE:[Budget]"
    *   **If discount > 40% for [FLEX] products:** Offer "Christmas Cheer" payment plan (30% now, rest monthly)
    *   **If budget < Min Price:** Be gentle but explain that even Santa's workshop has costs. Encourage saving, mention payment plans, but DO NOT approve the deal.

4.  **Product Catalog (Confidential - Internal Use Only):**
${productList}

5.  **Formatting:** Use **bold** for excitement, *italics*, and bullet points. Keep responses warm and festive!

6.  **Handling Unknown Products:** If the user asks for a product not in the catalog, say the elves are checking if it's in the workshop and ask them to check back later.`;
  } catch (error) {
    console.error('[Santa] Error fetching products:', error);
    // Fallback to basic prompt
    return `You are Santa Claus, partnering with ${merchantSlug} gadget store. Be jolly and warm. Help users with their Christmas gadget wishes. If they mention a budget, engage playfully about discounts.`;
  }
}

/**
 * Santa Chat API Route
 *
 * POST /api/chat/santa
 * Body: { messages: Array<{ role: 'user' | 'assistant', content: string }> }
 *
 * Returns a streaming text response from the Santa chatbot.
 * Allows anonymous access for storefront customers with IP-based rate limiting.
 * Logs interactions for campaign analytics.
 *
 * Security notes:
 * - CSRF: This endpoint is intentionally exempt from CSRF validation because
 *   it serves anonymous storefront customers (no auth cookies/session).
 *   Abuse is mitigated via IP-based rate limiting instead.
 * - Rate limiting: In-memory, see provider.ts for known limitations.
 */
export async function POST(req: Request) {
  try {
    // Step 1: Get client identifier for rate limiting (IP-based for anonymous users)
    const headersList = await headers();
    const forwardedFor = headersList.get('x-forwarded-for');
    const realIp = headersList.get('x-real-ip');
    const clientIp = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';
    const sessionId = generateSessionId(clientIp);

    // Step 2: Check rate limit using IP address
    const rateLimitKey = `santa-chat:${clientIp}`;

    const rateLimit = checkRateLimit(rateLimitKey, AI_RATE_LIMITS.santa);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Too many requests',
          message:
            "Ho ho ho! Santa's workshop is very busy right now. Please try again in a moment!",
          resetIn: rateLimit.resetIn,
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Parse and validate request body with Zod
    let body: unknown;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('[Santa Chat] JSON parse error:', parseError);
      return new Response(
        JSON.stringify({
          error: 'Invalid JSON',
          message: 'Could not parse request body',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const validation = santaChatSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({
          error: 'Invalid input',
          details: validation.error.format(),
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { messages } = validation.data;

    // Resolve the same configured, published tenant used by the product route.
    // The anonymous client enforces the publication gate before the privileged
    // catalogue and analytics reads below.
    const santaTenant = await resolveSantaTenant();
    if (!santaTenant) {
      return new Response(
        JSON.stringify({ error: 'Santa chat is not configured' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Sanitize user messages
    const sanitizedMessages = messages.map((msg) => ({
      ...msg,
      content: msg.role === 'user' ? sanitizeHtml(msg.content) : msg.content,
    }));

    // Get the latest user message for analytics
    const latestUserMessage = sanitizedMessages
      .filter((m) => m.role === 'user')
      .pop()?.content;

    // Extract budget from user message (for analytics)
    const budgetMatch = latestUserMessage?.match(
      /(\d[\d,]*)\s*(million|k|naira|₦)?/i
    );
    let requestedPrice: number | undefined;
    if (budgetMatch) {
      let amount = Number(budgetMatch[1].replace(/,/g, ''));
      if (budgetMatch[2]?.toLowerCase() === 'million') amount *= 1_000_000;
      if (budgetMatch[2]?.toLowerCase() === 'k') amount *= 1_000;
      requestedPrice = amount;
    }

    // Step 5: Generate prompt with cached product data
    const systemPrompt = await generateSantaPrompt(
      santaTenant.id,
      santaTenant.slug
    );

    // Buffered output replaces streaming so every provider in the chain
    // (Cerebras -> Groq -> Gemini Flash -> Flash-Lite) can serve the reply,
    // not just Gemini. Replies are short and Cerebras runs ~1850 tok/s, so
    // perceived latency drops rather than rises.
    const { text } = await generateTextWithChain({
      system: systemPrompt,
      messages: sanitizedMessages,
      abortSignal: req.signal,
      perProviderTimeoutMs: 15_000,
      // Cap the whole walk so it returns before the 30s maxDuration (4 × 15s
      // per-provider would blow past it and hand the client an empty 504);
      // 24s leaves slop for logging + serialization.
      overallTimeoutMs: 24_000,
    });

    // Log the interaction after response is complete (fire and forget)
    const wishResult = parseWishResult(text);
    logSantaInteraction({
      merchantId: santaTenant.id,
      sessionId,
      clientIp,
      interactionType: wishResult.type,
      userMessage: latestUserMessage,
      santaResponse: text,
      productName: wishResult.productName,
      requestedPrice,
      approvedPrice: wishResult.approvedPrice,
    }).catch((err) => console.error('[Santa Analytics] Logging error:', err));

    return new Response(text, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        [SANTA_MERCHANT_SLUG_HEADER]: santaTenant.slug,
      },
    });
  } catch (error) {
    console.error('[Santa Chat] Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: SANTA_ERROR_MESSAGES.general,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
