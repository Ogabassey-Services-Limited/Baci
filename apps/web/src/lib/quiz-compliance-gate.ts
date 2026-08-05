import { logger } from '@/lib/logger';
import {
  getQuizPhaseEnv,
  getQuizProductionApprovedEnv,
} from '@/lib/quiz/quiz-runtime-env';

export type QuizPhase = '1a' | 'production';

export type QuizProductionGuardEvent = {
  nlrc_permit_ref?: string | null;
};

// Env contract (server-only):
//   QUIZ_PHASE                = "1a" (default) | "production"
//   QUIZ_PRODUCTION_APPROVED  = truthy only once operations signs off prizes
//   QUIZ_RPC_SERVER_SECRET    = required when QUIZ_PHASE=production (validated in env.ts)
//   QUIZ_DEVICE_HASH_PEPPER   = required when QUIZ_PHASE=production (validated in env.ts)
// QUIZ_PHASE defaults to "1a", which keeps every prize claim fail-closed. A real
// production launch MUST set QUIZ_PHASE=production; otherwise the compliance /
// age / permit guards below never treat prizes as live. `assertQuizPhaseMatchesDeployment`
// makes that misconfiguration loud instead of silent when running in prod.
export type QuizDeploymentSignals = {
  nodeEnv?: string;
  vercelEnv?: string;
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

export class QuizPhaseMisconfiguredError extends Error {
  readonly code = 'quiz_phase_misconfigured' as const;
  readonly status = 500 as const;

  constructor() {
    super(
      'QUIZ_PHASE must be set to "production" in a production deployment that awards prizes.'
    );
    this.name = 'QuizPhaseMisconfiguredError';
  }
}

export function getQuizPhase(value: string | undefined): QuizPhase {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) return '1a';
  if (normalized === '1a' || normalized === 'production') return normalized;

  throw new InvalidQuizPhaseError();
}

function readQuizDeploymentSignals(): QuizDeploymentSignals {
  return {
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  };
}

// A real production deployment: Vercel reports VERCEL_ENV=production, and
// self-hosted/non-Vercel prod falls back to NODE_ENV=production when VERCEL_ENV
// is absent. Preview/development/test never count as production.
export function isQuizProductionDeployment(
  signals: QuizDeploymentSignals = readQuizDeploymentSignals()
): boolean {
  if (signals.vercelEnv) {
    return signals.vercelEnv === 'production';
  }
  return signals.nodeEnv === 'production';
}

// Fail CLOSED and LOUD: if we are in a production deployment but QUIZ_PHASE is
// not "production", prize/compliance guards would silently degrade to fail-closed
// stubs. Surface it explicitly so an operator notices before launch instead of
// shipping a "no-guard" quiz.
export function assertQuizPhaseMatchesDeployment(
  phase: QuizPhase,
  signals: QuizDeploymentSignals = readQuizDeploymentSignals()
): void {
  if (isQuizProductionDeployment(signals) && phase !== 'production') {
    logger.error({
      message:
        'QUIZ_PHASE is not "production" in a production deployment. Prize compliance/age guards are running in fail-closed 1a mode. Set QUIZ_PHASE=production (and the production approval env) before awarding real prizes.',
      quizPhase: phase,
      vercelEnv: signals.vercelEnv ?? null,
    });
    throw new QuizPhaseMisconfiguredError();
  }
}

export function enforcePrizeProductionGuard(
  eventRow: QuizProductionGuardEvent,
  complianceVerified: boolean
): void {
  const phase = getQuizPhaseEnv();
  const isProductionPhase = phase === 'production';

  // Loud visibility: a prize claim reaching this guard implies a live prize
  // event exists. If we are in a production deployment but QUIZ_PHASE is unset
  // ("1a"), log it clearly. The claim still fails closed below.
  if (!isProductionPhase && isQuizProductionDeployment()) {
    logger.error({
      message:
        'Prize claim reached the production guard while QUIZ_PHASE is "1a" in a production deployment. Prizes remain fail-closed. Set QUIZ_PHASE=production for the launch.',
      quizPhase: phase,
    });
  }

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
