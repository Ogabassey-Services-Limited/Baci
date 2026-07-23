import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { ModelMessage } from 'ai';
import { type NextRequest, NextResponse } from 'next/server';
import { match } from 'ts-pattern';
import { generateTextWithChain } from '@/ai/generate-text-with-chain';
import { checkCsrfProtection } from '@/lib/csrf';

// Check if Upstash Redis is configured for rate limiting (optional)
const ratelimit =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
        redis: new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        }),
        limiter: Ratelimit.slidingWindow(50, '1 d'),
        analytics: true,
      })
    : null;

export async function POST(req: Request): Promise<Response> {
  // CSRF protection
  const { valid: csrfValid, response: csrfResponse } =
    await checkCsrfProtection(req as NextRequest);
  if (!csrfValid) {
    return (
      csrfResponse ??
      NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
    );
  }

  const { prompt, option, command } = (await req.json()) as {
    prompt: string;
    option: string;
    command: string;
  };

  // Rate limiting (safe failure if not configured)
  if (ratelimit) {
    const ip = req.headers.get('x-forwarded-for') ?? 'anonymous';
    const { success, limit, reset, remaining } = await ratelimit.limit(
      `novel_ratelimit_${ip}`
    );

    if (!success) {
      return new Response('You have reached your request limit for the day.', {
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString(),
        },
      });
    }
  }

  // Generate content using Gemini via Vercel AI SDK
  const messages: ModelMessage[] = match(option)
    .with(
      'continue',
      () =>
        [
          {
            role: 'system',
            content:
              'You are an AI writing assistant that continues existing text based on context from prior text. ' +
              'Give more weight/priority to the later characters than the beginning ones. ' +
              'Limit your response to no more than 200 characters, but make sure to construct complete sentences.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ] as ModelMessage[]
    )
    .with(
      'improve',
      () =>
        [
          {
            role: 'system',
            content:
              'You are an AI writing assistant that improves existing text. ' +
              'Limit your response to no more than 200 characters, but make sure to construct complete sentences.',
          },
          {
            role: 'user',
            content: `The existing text is: ${prompt}`,
          },
        ] as ModelMessage[]
    )
    .with(
      'shorter',
      () =>
        [
          {
            role: 'system',
            content:
              'You are an AI writing assistant that shortens existing text. ' +
              'Limit your response to no more than 200 characters, but make sure to construct complete sentences.',
          },
          {
            role: 'user',
            content: `The existing text is: ${prompt}`,
          },
        ] as ModelMessage[]
    )
    .with(
      'longer',
      () =>
        [
          {
            role: 'system',
            content:
              'You are an AI writing assistant that lengthens existing text. ' +
              'Limit your response to no more than 200 characters, but make sure to construct complete sentences.',
          },
          {
            role: 'user',
            content: `The existing text is: ${prompt}`,
          },
        ] as ModelMessage[]
    )
    .with(
      'fix',
      () =>
        [
          {
            role: 'system',
            content:
              'You are an AI writing assistant that fixes grammar and spelling errors in existing text. ' +
              'Limit your response to no more than 200 characters, but make sure to construct complete sentences.',
          },
          {
            role: 'user',
            content: `The existing text is: ${prompt}`,
          },
        ] as ModelMessage[]
    )
    .with(
      'zap',
      () =>
        [
          {
            role: 'system',
            content:
              'You are an AI writing assistant that generates text based on a prompt. ' +
              'You take an input from the user and a command for manipulating the text. ' +
              'Limit your response to no more than 200 characters, but make sure to construct complete sentences.',
          },
          {
            role: 'user',
            content: `For this text: ${prompt}. You have to respect the command: ${command}`,
          },
        ] as ModelMessage[]
    )
    .run();

  try {
    // Routed through the platform provider chain (Cerebras -> Groq -> Gemini
    // Flash -> Flash-Lite) instead of calling Gemini directly. topP,
    // frequencyPenalty, and presencePenalty aren't supported by the shared
    // chain executor (its options are provider-agnostic across vendors that
    // don't all expose them), so they are dropped here.
    const { text } = await generateTextWithChain({
      messages,
      maxOutputTokens: 400,
      temperature: 0.7,
    });

    return new Response(text);
  } catch (error) {
    console.error('Error generating text:', error);
    return new Response('Unable to generate text.', { status: 500 });
  }
}
