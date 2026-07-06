import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { getPrimaryProductImage } from '@/lib/product-image';
import {
  generateQuizQuestionsWithGemma,
  QuizQuestionGenerationUnavailableError,
} from '@/lib/quiz/gemma-question-generator';
import {
  type GeneratedQuizQuestion,
  merchantQuizActivationRequestSchema,
  merchantQuizGenerationRequestSchema,
} from '@/schemas/quiz';
import {
  activateMerchantQuizDraft,
  createSlotRows,
  createVariantRows,
  isQuizDraftEvent,
  type QuizSupabaseClient,
  resolveMerchantQuizContext,
  resolvePrizeProduct,
  slugifyTitle,
} from './quiz-generate-helpers';

export const maxDuration = 120;

type MerchantAuthContext = {
  merchantDisplayName: string;
  merchantId: string;
  supabase: QuizSupabaseClient;
};

async function authorizeMerchantQuizRequest(
  request: NextRequest
): Promise<MerchantAuthContext | NextResponse> {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const csrf = await checkCsrfProtection(request);
  if (!csrf.valid) {
    return (
      csrf.response ??
      NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    );
  }

  const access = await getUserAccess(auth.supabase);
  if (!access) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }

  if (!hasPermission(access, 'marketing', 'edit')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const merchantContext = await resolveMerchantQuizContext(
    auth.supabase,
    access.merchantId
  );
  if (merchantContext.slug !== 'ogabassey') {
    return NextResponse.json(
      { error: 'Quiz generation is only available for Ogabassey' },
      { status: 403 }
    );
  }

  return {
    merchantDisplayName: merchantContext.displayName,
    merchantId: access.merchantId,
    supabase: auth.supabase,
  };
}

async function handleActivation(
  context: MerchantAuthContext,
  body: unknown
): Promise<NextResponse> {
  const parsed = merchantQuizActivationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'INVALID_INPUT' },
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

  const prizeProduct = await resolvePrizeProduct(
    context.supabase,
    context.merchantId,
    parsed.data.prizeProductId
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
  const prizeVariantId =
    parsed.data.prizeVariantId ?? prizeProduct.default_variant_id ?? null;
  const prizeProductImageUrl = getPrimaryProductImage(prizeProduct.images);
  const { data: event, error: eventError } = await context.supabase
    .rpc('create_merchant_quiz_draft', {
      p_merchant_id: context.merchantId,
      p_settings: {
        prize_name: prizeProduct.name,
        prize_product_id: prizeProduct.id,
        prize_product_image_url: prizeProductImageUrl,
        prize_product_name: prizeProduct.name,
        prize_variant_id: prizeVariantId,
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
  // admin can review it before deliberately opening the event in a second,
  // confirmed request (`confirmActivation`).
  return NextResponse.json({ event, questions }, { status: 201 });
}

function isActivationRequest(body: unknown): boolean {
  return (
    typeof body === 'object' &&
    body !== null &&
    'confirmActivation' in body &&
    (body as { confirmActivation: unknown }).confirmActivation === true
  );
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

  if (isActivationRequest(body)) {
    return handleActivation(context, body);
  }

  return handleGeneration(context, body);
}
