import { AGENTIC_REPLAY_REQUEST_ID_ERROR } from '@/lib/agentic/request-replay';

export function getAgenticReplayErrorStatus(error: string): 409 | 503 {
  return error === AGENTIC_REPLAY_REQUEST_ID_ERROR ? 409 : 503;
}
