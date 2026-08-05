import type { NextRequest } from 'next/server';
import { hasQuizContractHeader } from '@/app/api/quiz/_shared/quiz-v2-contract';
import { postLegacyQuizAnswer } from './legacy-route';
import { postQuizAnswerV2 } from './v2-route';

type RouteContext = { params: Promise<{ attemptId: string }> };

export function POST(request: NextRequest, context: RouteContext) {
  return hasQuizContractHeader(request)
    ? postQuizAnswerV2(request, context)
    : postLegacyQuizAnswer(request, context);
}
