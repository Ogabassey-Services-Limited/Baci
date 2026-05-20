import { type NextRequest, NextResponse } from 'next/server';
import {
  invalidInputResponse,
  prizeGuardErrorResponse,
  requireQuizUser,
  rpcErrorResponse,
} from '@/app/api/quiz/_shared/route-helpers';
import { getQuizPhaseEnv } from '@/env';
import { logger } from '@/lib/logger';
import { enforcePrizeProductionGuard } from '@/lib/quiz-compliance-gate';
import {
  type QuizEventRow,
  quizEventRowSchema,
  quizEventsQuerySchema,
} from '@/schemas/quiz';

const DEFAULT_PRIZE_NAME = 'Quiz prize';
const MIN_INTERNAL_PAGE_SIZE = 50;

// rawIndex is the source query offset for a qualifying event. Pagination uses
// it after post-fetch filtering so hidden rows do not cause duplicates.
type IndexedQuizEvent = {
  event: QuizEventRow;
  rawIndex: number;
};

function mapQuizEventStatus(status: string): 'open' | 'scheduled' | 'closed' {
  if (status === 'active') return 'open';
  if (status === 'scheduled') return 'scheduled';
  if (status !== 'closed') {
    logger.warn({
      message: 'Unknown quiz event status mapped to closed',
      status,
      context: 'mapQuizEventStatus',
    });
  }
  return 'closed';
}

function getPrizeName(settings: unknown): string {
  const prizeName =
    settings &&
    typeof settings === 'object' &&
    'prize_name' in settings &&
    typeof (settings as { prize_name?: unknown }).prize_name === 'string'
      ? (settings as { prize_name: string }).prize_name.trim()
      : '';

  if (prizeName.length > 0) {
    return prizeName;
  }

  return DEFAULT_PRIZE_NAME;
}

function getQuestionCount(event: { quiz_question_slots?: unknown[] | null }) {
  if (!Array.isArray(event.quiz_question_slots)) return 0;

  // Keep this defensive even though the query filters embedded rows.
  return event.quiz_question_slots.filter((slot) => {
    if (!slot || typeof slot !== 'object') return false;
    const { active, quiz_question_variants: variants } = slot as {
      active?: boolean;
      quiz_question_variants?: Array<{ active?: boolean }> | null;
    };
    if (active !== true) return false;
    if (!Array.isArray(variants)) return true;
    return variants.some((variant) => variant.active === true);
  }).length;
}

function getResolvedMerchantId(row: unknown) {
  if (!row || typeof row !== 'object' || !('id' in row)) return null;
  const id = (row as { id?: unknown }).id;
  return typeof id === 'string' ? id : null;
}

export async function GET(request: NextRequest) {
  const auth = await requireQuizUser(request);
  if (auth.response) return auth.response;

  const parsedQuery = quizEventsQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  );
  if (!parsedQuery.success) {
    return invalidInputResponse(parsedQuery.error.flatten().fieldErrors);
  }

  const {
    limit,
    merchantId: requestedMerchantId,
    merchantSlug,
    offset,
  } = parsedQuery.data;
  let merchantQuery = auth.supabase.from('merchants').select('id');
  if (requestedMerchantId) {
    merchantQuery = merchantQuery.eq('id', requestedMerchantId);
  }
  if (merchantSlug) {
    merchantQuery = merchantQuery.eq('slug', merchantSlug);
  }

  const { data: merchant, error: merchantError } =
    await merchantQuery.maybeSingle();
  if (merchantError) return rpcErrorResponse();

  const merchantId = getResolvedMerchantId(merchant);
  if (!merchantId) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  const { data: customer, error: customerError } = await auth.supabase
    .from('customers')
    .select('id')
    .eq('merchant_id', merchantId)
    .eq('user_id', auth.user.id)
    .limit(1)
    .maybeSingle();

  if (customerError) return rpcErrorResponse();

  if (!customer) {
    return NextResponse.json({
      events: [],
      pagination: {
        hasMore: false,
        limit,
        nextOffset: null,
        offset,
      },
    });
  }

  const rows: IndexedQuizEvent[] = [];
  let fetchOffset = offset;
  let exhausted = false;
  const internalPageSize = Math.max(limit + 1, MIN_INTERNAL_PAGE_SIZE);

  // Rows are still filtered after each bounded fetch because variant prompts
  // remain RLS-protected until an attempt exists; joining variants here would
  // reintroduce the first-attempt discovery deadlock this route avoids.
  while (rows.length <= limit && !exhausted) {
    const { data, error } = await auth.supabase
      .from('quiz_events')
      .select(
        'id, title, status, starts_at, ends_at, settings, nlrc_permit_ref, compliance_verified, quiz_question_slots!inner(id, active)'
      )
      .eq('merchant_id', merchantId)
      .eq('quiz_question_slots.active', 'true')
      .order('starts_at', { ascending: false })
      .range(fetchOffset, fetchOffset + internalPageSize - 1);

    if (error) return rpcErrorResponse();

    const parsedRows = quizEventRowSchema.array().safeParse(data ?? []);
    if (!parsedRows.success) return rpcErrorResponse();

    parsedRows.data.forEach((event, index) => {
      if (getQuestionCount(event) > 0) {
        rows.push({ event, rawIndex: fetchOffset + index });
      }
    });

    exhausted = parsedRows.data.length < internalPageSize;
    fetchOffset += parsedRows.data.length;
  }

  const pageRows = rows.slice(0, limit);
  if (getQuizPhaseEnv() === 'production') {
    try {
      for (const { event } of pageRows) {
        enforcePrizeProductionGuard(
          { nlrc_permit_ref: event.nlrc_permit_ref },
          event.compliance_verified === true
        );
      }
    } catch (error) {
      return prizeGuardErrorResponse(error);
    }
  }

  const hasMore = rows.length > limit;
  const lastPageRow = pageRows[pageRows.length - 1];
  // Advance from the last returned raw row; filtered rows before it still count
  // in the next database offset.
  const nextOffset = hasMore ? (lastPageRow?.rawIndex ?? offset) + 1 : null;
  const events = pageRows.map(({ event }) => ({
    endsAt: event.ends_at,
    id: event.id,
    prizeName: getPrizeName(event.settings),
    questionCount: getQuestionCount(event),
    startsAt: event.starts_at,
    status: mapQuizEventStatus(event.status),
    title: event.title,
  }));

  return NextResponse.json({
    events,
    pagination: {
      hasMore,
      limit,
      nextOffset,
      offset,
    },
  });
}
