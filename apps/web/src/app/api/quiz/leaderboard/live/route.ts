import { type NextRequest, NextResponse } from 'next/server';
import {
  invalidInputResponse,
  quizRpcClientErrorResponse,
  requireQuizUser,
  rpcErrorResponse,
} from '@/app/api/quiz/_shared/route-auth';
import { logger } from '@/lib/logger';
import { mapQuizLeaderboardRows } from '@/lib/quiz/map-quiz-leaderboard-rows';
import {
  quizLeaderboardProjectionSchema,
  quizLeaderboardQuerySchema,
} from '@/schemas/quiz-leaderboard';

export async function GET(request: NextRequest) {
  const auth = await requireQuizUser(request);
  if (auth.response) return auth.response;
  const parsed = quizLeaderboardQuerySchema.safeParse({
    eventId: request.nextUrl.searchParams.get('eventId') ?? undefined,
  });
  if (!parsed.success)
    return invalidInputResponse(parsed.error.flatten().fieldErrors);
  const { data, error } = await auth.supabase.rpc(
    'get_quiz_live_leaderboard_public_v2',
    { p_event_id: parsed.data.eventId }
  );
  if (error) {
    const clientErrorResponse = quizRpcClientErrorResponse(error);
    if (clientErrorResponse) return clientErrorResponse;
    logger.error({
      error,
      event: 'get_quiz_live_leaderboard',
      eventId: parsed.data.eventId,
      userId: auth.user.id,
      message: 'get_quiz_live_leaderboard RPC failed',
    });
    return rpcErrorResponse();
  }
  const projection = quizLeaderboardProjectionSchema.safeParse(data);
  if (!projection.success) return rpcErrorResponse();
  return NextResponse.json({
    currentPlayer: projection.data.current_player
      ? (mapQuizLeaderboardRows([projection.data.current_player])[0] ?? null)
      : null,
    entries: mapQuizLeaderboardRows(projection.data.entries),
    participantCount: null,
    status: 'live',
  });
}
