import { type NextRequest, NextResponse } from 'next/server';
import { getQuizPhaseEnv } from '@/env';
import { logger } from '@/lib/logger';
import { enforcePrizeProductionGuard } from '@/lib/quiz-compliance-gate';
import { quizEventRowSchema, quizEventsQuerySchema } from '@/schemas/quiz';
import {
  invalidInputResponse,
  prizeGuardErrorResponse,
  requireQuizUser,
  rpcErrorResponse,
} from '../_shared/route-helpers';

const DEFAULT_PRIZE_NAME = 'Quiz prize';

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
  return Array.isArray(event.quiz_question_slots)
    ? event.quiz_question_slots.length
    : 0;
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

  const { data, error } = await auth.supabase
    .from('quiz_events')
    .select(
      'id, title, status, starts_at, ends_at, settings, nlrc_permit_ref, compliance_verified, quiz_question_slots!inner(id)'
    )
    .eq('merchant_id', merchantId)
    .order('starts_at', { ascending: false })
    .range(offset, offset + limit);

  if (error) return rpcErrorResponse();

  const parsedRows = quizEventRowSchema.array().safeParse(data ?? []);
  if (!parsedRows.success) return rpcErrorResponse();

  const rows = parsedRows.data.filter((event) => getQuestionCount(event) > 0);
  if (getQuizPhaseEnv() === 'production') {
    try {
      for (const event of rows) {
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
  const events = rows.slice(0, limit).map((event) => ({
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
      nextOffset: hasMore ? offset + limit : null,
      offset,
    },
  });
}
