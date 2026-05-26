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

type SlotRow = {
  category: string | null;
  id: string;
  slot_index: number;
};

function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || `quiz-${Date.now()}`;
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
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  let questions: GeneratedQuizQuestion[];
  try {
    questions = await generateQuizQuestionsWithGemma({
      difficulty: parsed.data.difficulty,
      merchantName: access.merchantId,
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

  const { data: event, error: eventError } = await auth.supabase
    .from('quiz_events')
    .insert({
      merchant_id: access.merchantId,
      settings: {
        prize_name: parsed.data.prizeName,
        time_limit_seconds: parsed.data.timeLimitSeconds,
      },
      slug: slugifyTitle(parsed.data.title),
      status: 'draft',
      title: parsed.data.title,
    })
    .select('id, slug, status, title')
    .single();

  if (eventError || !event) {
    return NextResponse.json(
      { error: 'Failed to create quiz event' },
      { status: 500 }
    );
  }

  const { data: slots, error: slotsError } = await auth.supabase
    .from('quiz_question_slots')
    .insert(
      questions.map((question, index) => ({
        active: true,
        category: question.topic,
        difficulty: question.difficulty,
        event_id: event.id,
        slot_index: index + 1,
      }))
    )
    .select('id, slot_index, category');

  if (slotsError || !slots) {
    return NextResponse.json(
      { error: 'Failed to create quiz topics' },
      { status: 500 }
    );
  }

  let variantRows: ReturnType<typeof createVariantRows>;
  try {
    variantRows = createVariantRows(questions, slots as SlotRow[]);
  } catch {
    return NextResponse.json(
      { error: 'Failed to create quiz questions' },
      { status: 500 }
    );
  }

  const { error: variantsError } = await auth.supabase
    .from('quiz_question_variants')
    .insert(variantRows);

  if (variantsError) {
    return NextResponse.json(
      { error: 'Failed to create quiz questions' },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      event,
      questions: sanitizeGeneratedQuestions(questions),
    },
    { status: 201 }
  );
}
