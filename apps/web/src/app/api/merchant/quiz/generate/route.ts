import { type NextRequest, NextResponse } from 'next/server';
import {
  generateQuizQuestionsWithGemma,
  QuizQuestionGenerationUnavailableError,
} from '@/lib/quiz/gemma-question-generator';
import {
  type GeneratedQuizQuestion,
  merchantQuizGenerationRequestSchema,
} from '@/schemas/quiz';
import {
  authorizeMerchantQuizRequest,
  createSlotRows,
  createVariantRows,
  isQuizDraftEvent,
  type MerchantAuthContext,
  slugifyTitle,
} from './quiz-generate-helpers';
import { resolveQuizPrizeSelection } from './quiz-prize-selection';

export const maxDuration = 120;

async function handleGeneration(
  context: MerchantAuthContext,
  body: unknown
): Promise<NextResponse> {
  const parsed = merchantQuizGenerationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'INVALID_INPUT' },
      { status: 400 }
    );
  }

  const prizeProduct = await resolveQuizPrizeSelection(
    context.supabase,
    context.merchantId,
    parsed.data
  );
  if (!prizeProduct) {
    return NextResponse.json(
      {
        code: 'INVALID_PRIZE_PRODUCT',
        error: 'Select an active Ogabassey product as the quiz prize',
      },
      { status: 400 }
    );
  }

  let questions: GeneratedQuizQuestion[];
  try {
    questions = await generateQuizQuestionsWithGemma({
      difficulty: parsed.data.difficulty,
      merchantName: context.merchantDisplayName,
      questionCountPerTopic: parsed.data.questionCountPerTopic,
      topics: parsed.data.topics,
    });
  } catch (error) {
    if (error instanceof QuizQuestionGenerationUnavailableError) {
      return NextResponse.json(
        { error: 'Gemma quiz generation is not configured' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to generate quiz questions' },
      { status: 502 }
    );
  }

  const slots = createSlotRows(questions);
  const variantRows = createVariantRows(questions, slots);
  const { data: event, error: eventError } = await context.supabase
    .rpc('create_merchant_quiz_draft', {
      p_merchant_id: context.merchantId,
      p_settings: {
        prize_name: prizeProduct.name,
        prize_condition: prizeProduct.condition,
        prize_product_id: prizeProduct.productId,
        prize_product_image_url: prizeProduct.imageUrl,
        prize_product_name: prizeProduct.name,
        prize_variant_id: prizeProduct.variantId,
        quiz_mode: parsed.data.mode,
        time_limit_seconds: parsed.data.timeLimitSeconds,
      },
      p_slug: slugifyTitle(parsed.data.title),
      p_slots: slots,
      p_title: parsed.data.title,
      p_variants: variantRows,
    })
    .single();

  if (eventError || !isQuizDraftEvent(event)) {
    return NextResponse.json(
      { error: 'Failed to create quiz draft' },
      { status: 500 }
    );
  }

  // Generation always yields a DRAFT and returns the AI-marked answer key so the
  // admin can review it before deliberately opening the event via the separate
  // POST /api/merchant/quiz/activate route (kept off this expensive-generation
  // rate-limit bucket).
  return NextResponse.json({ event, questions }, { status: 201 });
}

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

  return handleGeneration(context, body);
}
