import { getQuizPhaseEnv, getQuizProductionApprovedEnv } from '@/env';

export type QuizPhase = '1a' | 'production';

export type QuizProductionGuardEvent = {
  nlrc_permit_ref?: string | null;
};

export class QuizProductionNotApprovedError extends Error {
  readonly code = 'quiz_production_not_approved' as const;
  readonly status = 403 as const;

  constructor() {
    super('Quiz production is not approved for prize claims.');
    this.name = 'QuizProductionNotApprovedError';
  }
}

export class InvalidQuizPhaseError extends Error {
  readonly code = 'invalid_quiz_phase' as const;
  readonly status = 500 as const;

  constructor() {
    super('Invalid quiz phase configuration.');
    this.name = 'InvalidQuizPhaseError';
  }
}

export function getQuizPhase(value: string | undefined): QuizPhase {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) return '1a';
  if (normalized === '1a' || normalized === 'production') return normalized;

  throw new InvalidQuizPhaseError();
}

export function enforcePrizeProductionGuard(
  eventRow: QuizProductionGuardEvent,
  complianceVerified: boolean
): void {
  const phase = getQuizPhaseEnv();
  const isProductionPhase = phase === 'production';
  const hasComplianceApproval = getQuizProductionApprovedEnv();
  const hasPermitReference = (eventRow.nlrc_permit_ref ?? '').trim().length > 0;
  const hasComplianceEvidence = complianceVerified;
  const canClaimProductionPrize =
    isProductionPhase &&
    hasComplianceApproval &&
    hasPermitReference &&
    hasComplianceEvidence;

  // Fail closed until operations has approved production prizes and the event
  // row carries permit/compliance evidence.
  if (!canClaimProductionPrize) {
    throw new QuizProductionNotApprovedError();
  }
}
