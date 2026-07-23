import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { generateTextWithChain } from '@/ai/generate-text-with-chain';
import { sanitizePromptInput } from '@/ai/provider';
import { checkCsrfProtection } from '@/lib/csrf';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    // CSRF protection
    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(req);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { content, instruction } = await req.json();

    if (!content) {
      return NextResponse.json({ error: 'Content required' }, { status: 400 });
    }

    const sanitizedInstruction = instruction
      ? sanitizePromptInput(instruction).value
      : '';

    const systemPrompt = `You are an expert blog post editor and copywriter.
Your task is to improve the provided blog content based on the user's instruction.
If no instruction is provided, improve the grammar, flow, tone, and readability of the content.
IMPORTANT requirements:
1. Return ONLY the edited content as valid HTML.
2. Do NOT wrap the result in markdown backticks (e.g. \`\`\`html).
3. Preserve the existing HTML structure (headings, lists, etc.) unless instructed to change it.
4. Do not remove images or links unless instructed.
5. Make the content engaging and professional.`;

    const userPrompt = sanitizedInstruction
      ? `Instruction: ${sanitizedInstruction}\n\nContent to edit:\n${content}`
      : `Content to edit:\n${content}`;

    // Routed through the platform provider chain (Cerebras -> Groq -> Gemini
    // Flash -> Flash-Lite) instead of calling Gemini directly.
    const { text } = await generateTextWithChain({
      system: systemPrompt,
      prompt: userPrompt,
    });

    return NextResponse.json({ content: text });
  } catch (error) {
    console.error('AI Edit Error:', error);
    return NextResponse.json(
      { error: 'Failed to process AI edit request' },
      { status: 500 }
    );
  }
}
