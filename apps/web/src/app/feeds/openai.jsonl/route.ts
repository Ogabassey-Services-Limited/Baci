import type { NextRequest } from 'next/server';
import { createPublicOpenAIFeedResponse } from '@/app/feeds/openai-feed-response';

// Keep this machine-readable feed aligned with the agent-products route; cold
// catalog materialization can legitimately exceed the platform's 15s default.
export const maxDuration = 60;

export function GET(request: NextRequest) {
  return createPublicOpenAIFeedResponse(request, 'legacy');
}
