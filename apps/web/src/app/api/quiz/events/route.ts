import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { quizEventRowSchema, quizEventsQuerySchema } from '@/schemas/quiz';
import {
  invalidInputResponse,
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

export async function GET(request: NextRequest) {
  const auth = await requireQuizUser(request);
  if (auth.response) return auth.response;

  const parsedQuery = quizEventsQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  );
  if (!parsedQuery.success) {
    return invalidInputResponse(parsedQuery.error.flatten().fieldErrors);
  }

  const { limit, offset } = parsedQuery.data;
  const { data, error } = await auth.supabase
    .from('quiz_events')
    .select(
      'id, title, status, starts_at, ends_at, settings, quiz_question_slots(id)'
    )
    .order('starts_at', { ascending: false })
    .range(offset, offset + limit);

  if (error) return rpcErrorResponse();

  const parsedRows = quizEventRowSchema.array().safeParse(data ?? []);
  if (!parsedRows.success) return rpcErrorResponse();

  const rows = parsedRows.data;
  const hasMore = rows.length > limit;
  const events = rows.slice(0, limit).map((event) => ({
    endsAt: event.ends_at,
    id: event.id,
    prizeName: getPrizeName(event.settings),
    questionCount: Array.isArray(event.quiz_question_slots)
      ? event.quiz_question_slots.length
      : 0,
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
