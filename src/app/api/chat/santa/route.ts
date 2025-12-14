import { streamText } from 'ai';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { SANTA_ERROR_MESSAGES } from '@/ai/prompts/santa';
import { AI_RATE_LIMITS, checkRateLimit, geminiFlash } from '@/ai/provider';
import { sanitizeHtml } from '@/lib/sanitize';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Define Zod schema for request validation
const santaChatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string().min(1).max(10000),
      imageUrl: z.string().optional(), // Allow imageUrl if present in client logic
    })
  ).min(1).max(50),
});

/**
 * Generate dynamic Santa system instruction with actual product data
 */
async function generateSantaPrompt(supabase: SupabaseClient): Promise<string> {
  try {
    // Fetch merchant ID first
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('slug', 'ogabassey')
      .single();

    if (!merchant?.id) {
      throw new Error('Merchant not found');
    }

    // Fetch Ogabassey products with cost prices
    const { data: products } = await supabase
      .from('products')
      .select('name, price, cost_price')
      .eq('merchant_id', merchant.id)
      .not('cost_price', 'is', null)
      .limit(20);

    // Format product list with prices and cost prices
    const productList =
      products
        ?.map(
          (p) => {
            const minPrice = (Number(p.cost_price) || 0) + 10000;
            return `*   ${p.name}: ₦${Number(p.price).toLocaleString()} (Min Approved: ₦${minPrice.toLocaleString()})`;
          }
        )
        .join('\n') || '(Products loading...)';

    return `You are Santa Claus, partnering with a gadget company called Ogabassey. Your personality is jolly, warm, kind, and a little bit whimsical.

**Your Core Purpose:**
To receive Christmas wishes for gadgets and determine if the user's budget qualifies them for a special Ogabassey discount, all while being a delightful Santa.

**IMPORTANT - Discount Logic:**
You have access to the SELLING PRICE and the MIN APPROVED PRICE for each item.
- The **MIN APPROVED PRICE** is the absolute lowest amount we can accept.
- If the user's budget is BELOW the Min Approved Price, you CANNOT approve the deal.

**Key Rules of Engagement:**
1.  **Greeting:** You are engaging in a continuous conversation. Be warm and jolly. Respond naturally without re-introducing yourself.

2.  **Wish Analysis:** When a user mentions a gadget:
    - Find the matching product from the catalog below
    - Compare their budget to both the selling price AND the Min Approved Price

3.  **Discount Logic (Strictly follow this order):**
    *   **If user's budget >= selling price:** Grant immediately! "ACTION:ADD_TO_CART|PRODUCT:[Name]|PRICE:[Budget]"
    *   **If discount needed < 10%:** Grant! "ACTION:ADD_TO_CART|PRODUCT:[Name]|PRICE:[Budget]"
    *   **If discount 10-40% AND budget >= Min Approved Price:** Check with "chief elf". Tell them to ask "What did the elf say?"
    *   **If they ask for elf's decision:** Approve with "ACTION:ADD_TO_CART|PRODUCT:[Name]|PRICE:[Budget]"
    *   **If discount 40-80% AND budget >= Min Approved Price:** Offer "Christmas Cheer" payment plan (30% now, rest monthly)
    *   **If budget < Min Approved Price:** This is a HARDSHIP case. Be gentle but explain that even Santa's workshop has costs. Encourage saving, mention payment plans, but DO NOT approve the deal.

4.  **Product Catalog (Confidential - Internal Use Only):**
${productList}

5.  **Formatting:** Use **bold** for excitement, *italics*, and bullet points. Keep responses warm and festive!

6.  **Handling Unknown Products:** If the user asks for a product not in the catalog, say the elves are checking if it's in the workshop and ask them to check back later.`;
  } catch (error) {
    console.error('[Santa] Error fetching products:', error);
    // Fallback to basic prompt
    return `You are Santa Claus, partnering with Ogabassey gadget store. Be jolly and warm. Help users with their Christmas gadget wishes. If they mention a budget, engage playfully about discounts.`;
  }
}

/**
 * Santa Chat API Route
 *
 * POST /api/chat/santa
 * Body: { messages: Array<{ role: 'user' | 'assistant', content: string }> }
 *
 * Returns a streaming text response from the Santa chatbot.
 */
export async function POST(req: Request) {
  try {
    // Step 1: Create Supabase client and verify authentication
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // NOTE: Santa Chat might be public properly? 
    // The previous implementation used IP fallback. 
    // BUT the requirement was explicit: "Always verify user authentication before performing database operations".
    // AND "Product data... fetched without permission checks".
    // However, if this is a storefront chat, maybe anonymous users should use it?
    // CodeRabbit said: "Missing authentication verification (critical)... No user authentication check before database operations"
    // So I MUST add it. If anonymous chat is needed, we'd need a service role or anonymous session.
    // Assuming for now user must be logged in (which fits Baci/Ogabassey logged-in flow).

    if (authError || !user) {
      // CodeRabbit suggestion was to return 401.
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: 'Please sign in to chat with Santa!',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Check rate limit per authenticated user
    const rateLimitKey = `santa-chat:${user.id}`;

    // Check rate limit
    const rateLimit = checkRateLimit(rateLimitKey, AI_RATE_LIMITS.builder);
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
    const body = await req.json();
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

    // Step 4: Sanitize user messages
    const sanitizedMessages = messages.map(msg => ({
      ...msg,
      content: msg.role === 'user' ? sanitizeHtml(msg.content) : msg.content,
    }));

    // Generate prompt with actual product data
    const systemPrompt = await generateSantaPrompt(supabase);

    // Stream the response
    const result = streamText({
      model: geminiFlash,
      system: systemPrompt,
      messages: sanitizedMessages,
    });

    return result.toTextStreamResponse();
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
