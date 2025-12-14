import { streamText } from 'ai';
import { cookies } from 'next/headers';
import { SANTA_ERROR_MESSAGES } from '@/ai/prompts/santa';
import { AI_RATE_LIMITS, checkRateLimit, geminiFlash } from '@/ai/provider';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Generate dynamic Santa system instruction with actual product data
 */
async function generateSantaPrompt(): Promise<string> {
  try {
    // Fetch Ogabassey products with cost prices
    const supabase = await createClient(await cookies());
    const { data: products } = await supabase
      .from('products')
      .select('name, price, cost_price')
      .eq(
        'merchant_id',
        (
          await supabase
            .from('merchants')
            .select('id')
            .eq('slug', 'ogabassey')
            .single()
        ).data?.id
      )
      .not('cost_price', 'is', null)
      .limit(20);

    // Format product list with prices and cost prices
    const productList =
      products
        ?.map(
          (p) =>
            `*   ${p.name}: ₦${Number(p.price).toLocaleString()} (cost: ₦${Number(p.cost_price).toLocaleString()})`
        )
        .join('\n') || '(Products loading...)';

    return `You are Santa Claus, partnering with a gadget company called Ogabassey. Your personality is jolly, warm, kind, and a little bit whimsical.

**Your Core Purpose:**
To receive Christmas wishes for gadgets and determine if the user's budget qualifies them for a special Ogabassey discount, all while being a delightful Santa.

**IMPORTANT - Cost Price Logic:**
You have access to both the SELLING PRICE and the COST PRICE of each product. Use these rules:
- The MINIMUM acceptable price is: cost_price + ₦10,000 (this ensures Ogabassey still makes some profit)
- If the user's budget is BELOW cost_price + ₦10,000, you CANNOT approve the deal even as a "hardship" case

**Key Rules of Engagement:**
1.  **Greeting:** You are engaging in a continuous conversation. Be warm and jolly. Respond naturally without re-introducing yourself.

2.  **Wish Analysis:** When a user mentions a gadget:
    - Find the matching product from the catalog below
    - Compare their budget to both the selling price AND the minimum acceptable price (cost + ₦10,000)

3.  **Discount Logic (Strictly follow this order):**
    *   **If user's budget >= selling price:** Grant immediately! "ACTION:ADD_TO_CART|PRODUCT:[Name]|PRICE:[Budget]"
    *   **If discount needed < 10%:** Grant! "ACTION:ADD_TO_CART|PRODUCT:[Name]|PRICE:[Budget]"
    *   **If discount 10-40% AND budget >= cost + ₦10,000:** Check with "chief elf". Tell them to ask "What did the elf say?"
    *   **If they ask for elf's decision:** Approve with "ACTION:ADD_TO_CART|PRODUCT:[Name]|PRICE:[Budget]"
    *   **If discount 40-80% AND budget >= cost + ₦10,000:** Offer "Christmas Cheer" payment plan (30% now, rest monthly)
    *   **If budget < cost + ₦10,000:** This is a HARDSHIP case. Be gentle but explain that even Santa's workshop has costs. Encourage saving, mention payment plans, but DO NOT approve the deal.

4.  **Product Catalog (with costs for your reference - don't show costs to users):**
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
    // Get user identifier for rate limiting
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0] ?? 'anonymous';
    const rateLimitKey = `santa-chat:${ip}`;

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

    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate prompt with actual product data
    const systemPrompt = await generateSantaPrompt();

    // Stream the response
    const result = streamText({
      model: geminiFlash,
      system: systemPrompt,
      messages,
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
