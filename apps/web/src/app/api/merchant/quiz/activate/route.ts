import { type NextRequest, NextResponse } from 'next/server';
import {
  merchantQuizActivationRequestSchema,
  merchantQuizActivationV2RequestSchema,
} from '@/schemas/quiz';
import {
  activateMerchantQuizDraft,
  authorizeMerchantQuizRequest,
  recordMerchantQuizAnswerKeyReview,
} from '../generate/quiz-generate-helpers';
import {
  findLaunchedMerchantQuizV2,
  launchMerchantQuizDraftV2,
} from './quiz-launch-v2';

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

  const parsedV2 = merchantQuizActivationV2RequestSchema.safeParse(body);
  if (parsedV2.success) {
    const reviewRecorded = await recordMerchantQuizAnswerKeyReview(
      context.supabase,
      parsedV2.data.eventId,
      context.merchantId,
      parsedV2.data.answerKeyReview.questions
    );
    if (!reviewRecorded) {
      const alreadyLaunched = await findLaunchedMerchantQuizV2({
        eventId: parsedV2.data.eventId,
        merchantId: context.merchantId,
        supabase: context.supabase,
      });
      if (alreadyLaunched) {
        return NextResponse.json({ event: alreadyLaunched }, { status: 200 });
      }
      return NextResponse.json(
        {
          code: 'QUIZ_ANSWER_KEY_REVIEW_REQUIRED',
          error: 'Review every correct answer before launching this quiz',
        },
        { status: 400 }
      );
    }
    const launched = await launchMerchantQuizDraftV2({
      input: parsedV2.data,
      merchantId: context.merchantId,
      supabase: context.supabase,
    });
    if (!launched.ok) {
      return NextResponse.json(
        { code: launched.code, error: launched.message },
        { status: 400 }
      );
    }
    return NextResponse.json({ event: launched.event }, { status: 200 });
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
      context.merchantId,
      parsed.data.endsAt ?? null
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
    context.merchantId,
    parsed.data.endsAt ?? null
  );
  if (!activatedEvent) {
    return NextResponse.json(
      { error: 'Failed to open quiz event', code: 'QUIZ_ACTIVATION_FAILED' },
      { status: 400 }
    );
  }

  return NextResponse.json({ event: activatedEvent }, { status: 200 });
}
