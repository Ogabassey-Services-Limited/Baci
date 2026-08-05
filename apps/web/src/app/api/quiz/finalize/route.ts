import { type NextRequest, NextResponse } from 'next/server';
import { getCronSecret } from '@/env';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import { finalizeDueQuizEvents } from '@/lib/quiz/finalize-due-quiz-events';

export const maxDuration = 300;

/** Authenticated manual fallback for the flock-protected direct VPS worker. */
export async function GET(request: NextRequest) {
  const cronSecret = getCronSecret();
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'Server misconfigured' },
      { status: 500 }
    );
  }

  const authorization = request.headers.get('Authorization');
  if (
    !authorization ||
    !constantTimeEqual(authorization, `Bearer ${cronSecret}`)
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await finalizeDueQuizEvents();
  return NextResponse.json(result.body, { status: result.status });
}
