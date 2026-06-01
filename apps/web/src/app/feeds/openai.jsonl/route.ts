import type { NextRequest } from 'next/server';
import { createPublicOpenAIFeedResponse } from '@/app/feeds/openai-feed-response';

export function GET(request: NextRequest) {
  return createPublicOpenAIFeedResponse(request, 'legacy');
}
