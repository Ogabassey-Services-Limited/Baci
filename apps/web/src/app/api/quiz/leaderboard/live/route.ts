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
  const [leaderboardResponse, participantCountResponse] = await Promise.all([
    auth.supabase.rpc('get_quiz_live_leaderboard_public_v2', {
      p_event_id: parsed.data.eventId,
    }),
    // Keep the count in the same authenticated request as live standings. A
    // separate client poll would double the request rate for every player.
    auth.supabase
      .rpc('get_quiz_participant_count_public_v2', {
        p_event_id: parsed.data.eventId,
      })
      .catch(() => ({ data: null, error: null })),
  ]);
  const { data, error } = leaderboardResponse;
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
  const participantCount =
    typeof participantCountResponse.data === 'number' &&
    Number.isInteger(participantCountResponse.data) &&
    participantCountResponse.data >= 0
      ? participantCountResponse.data
      : null;
  return NextResponse.json({
    currentPlayer: projection.data.current_player
      ? (mapQuizLeaderboardRows([projection.data.current_player])[0] ?? null)
      : null,
    entries: mapQuizLeaderboardRows(projection.data.entries),
    participantCount,
    status: 'live',
  });
}
