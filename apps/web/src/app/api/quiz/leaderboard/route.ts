import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  invalidInputResponse,
  quizRpcClientErrorResponse,
  requireQuizUser,
  rpcErrorResponse,
} from '@/app/api/quiz/_shared/route-auth';
import { logger } from '@/lib/logger';
import { mapQuizLeaderboardRows } from '@/lib/quiz/map-quiz-leaderboard-rows';
import {
  quizLeaderboardQuerySchema,
  quizLeaderboardRowSchema,
} from '@/schemas/quiz-leaderboard';

export async function GET(request: NextRequest) {
  // Auth first. get_quiz_leaderboard_public is granted to `authenticated` and
  // refuses anyone who is not a customer of the event's merchant (QZ031) — this
  // is not a public board.
  const auth = await requireQuizUser(request);
  if (auth.response) return auth.response;

  const parsed = quizLeaderboardQuerySchema.safeParse({
    eventId: request.nextUrl.searchParams.get('eventId') ?? undefined,
  });
  if (!parsed.success) {
    return invalidInputResponse(parsed.error.flatten().fieldErrors);
  }

  // get_quiz_leaderboard_public orders by rank, caps to the top 100, and flags
  // the caller's own row in the database (see 20260721150000), so the route no
  // longer sorts, slices, or resolves the caller's identity itself. It is the
  // scrubbed wrapper — the richer get_quiz_leaderboard (which also returns the
  // internal customer_id/attempt_id) is service_role only.
  const { data, error } = await auth.supabase.rpc(
    'get_quiz_leaderboard_public',
    {
      p_event_id: parsed.data.eventId,
    }
  );

  if (error) {
    const clientErrorResponse = quizRpcClientErrorResponse(error);
    if (clientErrorResponse) return clientErrorResponse;

    logger.error({
      error,
      event: 'get_quiz_leaderboard',
      eventId: parsed.data.eventId,
      message: 'get_quiz_leaderboard RPC failed',
      userId: auth.user.id,
    });
    return rpcErrorResponse();
  }

  const rows = z.array(quizLeaderboardRowSchema).safeParse(data ?? []);
  if (!rows.success) {
    logger.error({
      error: rows.error.flatten(),
      event: 'get_quiz_leaderboard',
      eventId: parsed.data.eventId,
      message: 'get_quiz_leaderboard returned an unexpected shape',
      userId: auth.user.id,
    });
    return rpcErrorResponse();
  }

  return NextResponse.json({
    entries: mapQuizLeaderboardRows(rows.data),
  });
}
