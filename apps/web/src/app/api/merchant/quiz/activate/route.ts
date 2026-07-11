import { type NextRequest, NextResponse } from 'next/server';
import { merchantQuizActivationRequestSchema } from '@/schemas/quiz';
import {
  activateMerchantQuizDraft,
  authorizeMerchantQuizRequest,
  recordMerchantQuizAnswerKeyReview,
} from '../generate/quiz-generate-helpers';

/**
 * Opens a reviewed quiz DRAFT into an active event. Deliberately a separate
 * path from POST /api/merchant/quiz/generate: the proxy rate-limits by path,
 * and the Gemma generation route is throttled hard (expensive AI call). Sharing
 * that bucket meant an admin who generated a few drafts then clicked "Open now"
 * could be 429'd on the activation itself.
 */
export async function POST(request: NextRequest) {
  const context = await authorizeMerchantQuizRequest(request);
  if (context instanceof NextResponse) {
    return context;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = merchantQuizActivationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'INVALID_INPUT' },
      { status: 400 }
    );
  }

  const reviewRecorded = await recordMerchantQuizAnswerKeyReview(
    context.supabase,
    parsed.data.eventId,
    context.merchantId,
    parsed.data.answerKeyReview.questions
  );
  if (!reviewRecorded) {
    const alreadyActivatedEvent = await activateMerchantQuizDraft(
      context.supabase,
      parsed.data.eventId,
      context.merchantId
    );
    if (alreadyActivatedEvent) {
      return NextResponse.json(
        { event: alreadyActivatedEvent },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        error: 'Review every correct answer before opening this quiz',
        code: 'QUIZ_ANSWER_KEY_REVIEW_REQUIRED',
      },
      { status: 400 }
    );
  }

  const activatedEvent = await activateMerchantQuizDraft(
    context.supabase,
    parsed.data.eventId,
    context.merchantId
  );
  if (!activatedEvent) {
    return NextResponse.json(
      { error: 'Failed to open quiz event', code: 'QUIZ_ACTIVATION_FAILED' },
      { status: 400 }
    );
  }

  return NextResponse.json({ event: activatedEvent }, { status: 200 });
}
