import type { NextRequest } from 'next/server';
import { createPublicOpenAIFeedResponse } from '@/app/feeds/openai-feed-response';

// Cold feed misses hydrate the public catalog and verified image manifest; this
// follows Vercel's route maxDuration config so agent crawlers do not fail at
// the default 15s function timeout.
export const maxDuration = 60;

export function GET(request: NextRequest) {
  return createPublicOpenAIFeedResponse(request, 'current');
}
