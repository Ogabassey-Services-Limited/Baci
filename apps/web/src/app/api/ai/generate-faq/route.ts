import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { type GenerateFAQInput, generateFAQ } from '@/ai/flows/generate-faq';
import { AI_RATE_LIMITS, checkRateLimit } from '@/ai/provider';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    // Get authenticated user
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting
    const rateLimit = checkRateLimit(
      `faq-${user.id}`,
      AI_RATE_LIMITS.faqGeneration
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          resetIn: Math.ceil(rateLimit.resetIn / 1000),
        },
        { status: 429 }
      );
    }

    // Parse request body
    const body = (await request.json()) as GenerateFAQInput;

    // Generate FAQs
    const result = await generateFAQ(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      faqs: result.faqs,
      remaining: rateLimit.remaining,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to generate FAQs: ${message}` },
      { status: 500 }
    );
  }
}
