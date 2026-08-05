import type { NextRequest } from 'next/server';
import { hasQuizContractHeader } from '@/app/api/quiz/_shared/quiz-v2-contract';
import { postLegacyQuizStart } from './legacy-route';
import { postQuizStartV2 } from './v2-route';

export function POST(request: NextRequest) {
  return hasQuizContractHeader(request)
    ? postQuizStartV2(request)
    : postLegacyQuizStart(request);
}
