import crypto from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  generateQuizQuestionsWithGemma,
  QuizQuestionGenerationUnavailableError,
} from '@/lib/quiz/gemma-question-generator';
import {
  type GeneratedQuizQuestion,
  merchantQuizGenerationRequestSchema,
} from '@/schemas/quiz';

export const maxDuration = 120;

type SlotRow = {
  active: true;
  category: string | null;
  difficulty: GeneratedQuizQuestion['difficulty'];
  id: string;
  slot_index: number;
};

type QuizDraftEvent = {
  id: string;
  slug: string;
  status: string;
  title: string;
};

type MerchantNameRow = {
  business_name: string | null;
  slug: string | null;
};

function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const baseSlug = slug || 'quiz';
  return `${baseSlug}-${crypto.randomBytes(4).toString('hex')}`;
}

function hashAnswerKey(answer: string): string {
  return crypto
    .createHash('sha256')
    .update(answer.trim().toLowerCase())
    .digest('hex');
}

function sanitizeGeneratedQuestions(questions: GeneratedQuizQuestion[]) {
  return questions.map(
    ({ correctOptionId: _answer, explanation: _explanation, ...question }) =>
      question
  );
}

function createSlotRows(questions: GeneratedQuizQuestion[]): SlotRow[] {
  return questions.map((question, index) => ({
    active: true,
    category: question.topic,
    difficulty: question.difficulty,
    id: crypto.randomUUID(),
    slot_index: index + 1,
  }));
}

function createVariantRows(
  questions: GeneratedQuizQuestion[],
  slots: SlotRow[]
) {
  const slotsByIndex = new Map(slots.map((slot) => [slot.slot_index, slot]));

  return questions.map((question, index) => {
    const slot = slotsByIndex.get(index + 1);
    if (!slot) {
      throw new Error('Quiz slot creation returned an incomplete result');
    }

    return {
      active: true,
      answer_key_hash: hashAnswerKey(question.correctOptionId),
      explanation: question.explanation,
      options: question.options,
      prompt: question.prompt,
      slot_id: slot.id,
      variant_key: `gemma-${index + 1}`,
    };
  });
}

function isQuizDraftEvent(value: unknown): value is QuizDraftEvent {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const event = value as Record<string, unknown>;
  return (
    typeof event.id === 'string' &&
    typeof event.slug === 'string' &&
    typeof event.status === 'string' &&
    typeof event.title === 'string'
  );
}

async function openQuizEventIfRequested(
  supabase: NonNullable<
    Awaited<ReturnType<typeof authenticateApiRequest>>['supabase']
  >,
  event: QuizDraftEvent,
  merchantId: string,
  publicationMode: 'draft' | 'active'
): Promise<{ event: QuizDraftEvent; error: boolean }> {
  if (publicationMode !== 'active') {
    return { event, error: false };
  }

  const { data, error } = await supabase
    .from('quiz_events')
    .update({
      ends_at: null,
      starts_at: new Date().toISOString(),
      status: 'active',
    })
    .eq('id', event.id)
    .eq('merchant_id', merchantId)
    .select('id, slug, status, title')
    .single();

  if (error || !isQuizDraftEvent(data)) {
    return { event, error: true };
  }

  return { event: data, error: false };
}

async function resolveMerchantDisplayName(
  supabase: NonNullable<
    Awaited<ReturnType<typeof authenticateApiRequest>>['supabase']
  >,
  merchantId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('merchants')
    .select('business_name, slug')
    .eq('id', merchantId)
    .maybeSingle();

  if (error) {
    console.error('Merchant display name lookup failed:', error.message);
    return merchantId;
  }

  const merchant = data as MerchantNameRow | null;
  return (
    merchant?.business_name?.trim() || merchant?.slug?.trim() || merchantId
  );
}

export async function POST(request: NextRequest) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = merchantQuizGenerationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'INVALID_INPUT' },
      { status: 400 }
    );
  }

  let questions: GeneratedQuizQuestion[];
  try {
    const merchantName = await resolveMerchantDisplayName(
      auth.supabase,
      access.merchantId
    );
    questions = await generateQuizQuestionsWithGemma({
      difficulty: parsed.data.difficulty,
      merchantName,
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
  const { data: event, error: eventError } = await auth.supabase
    .rpc('create_merchant_quiz_draft', {
      p_merchant_id: access.merchantId,
      p_settings: {
        prize_name: parsed.data.prizeName,
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

  const openedEvent = await openQuizEventIfRequested(
    auth.supabase,
    event,
    access.merchantId,
    parsed.data.publicationMode
  );
  if (openedEvent.error) {
    return NextResponse.json(
      { error: 'Failed to open quiz event' },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      event: openedEvent.event,
      questions: sanitizeGeneratedQuestions(questions),
    },
    { status: 201 }
  );
}
