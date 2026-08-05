import type { NextRequest } from 'next/server';
import { hasQuizContractHeader } from '@/app/api/quiz/_shared/quiz-v2-contract';
import { getLegacyQuizEvents } from './legacy-route';
import { getQuizEventsV2 } from './v2-route';

export function GET(request: NextRequest) {
  return hasQuizContractHeader(request)
    ? getQuizEventsV2(request)
    : getLegacyQuizEvents(request);
}
