import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { getQuizPhaseEnv, getQuizProductionApprovedEnv } from '@/env';
import { logger } from '@/lib/logger';
import {
  getQuizComplianceEvidence,
  getQuizPhase,
  type QuizPhase,
} from '@/lib/quiz-compliance-gate';
import {
  createQuizRpcServerProof,
  type QuizRpcServerProof,
  QuizRpcServerConfigError,
} from '@/lib/quiz-proof';

// A syntactically valid, non-empty subject/user for the throwaway health-check
// proof. quiz_route_proof_valid only requires these to be present; without an
// expected-value argument it validates the signature, window, and metadata.
const QUIZ_RPC_SECRET_HEALTH_PROOF_ID =
  '00000000-0000-0000-0000-000000000000';

export type QuizProductionApprovalEvent = {
  compliance_verified: boolean | null;
  id: string;
  regulatory_basis: string | null;
  regulatory_evidence_ref: string | null;
  regulatory_jurisdiction: string | null;
  status: string | null;
  published_odds: unknown;
};

export type QuizComplianceTrackerRow = {
  item: string;
  verification_status: string | null;
  approved_at: string | null;
  approval_comment?: string | null;
  [key: string]: unknown;
};

export type QuizProductionApprovalInput = {
  quizPhase: string | undefined;
  quizProductionApproved: boolean;
  quizRpcServerSecretConfigured: boolean;
  quizRpcServerSecretMatches: boolean;
  events: QuizProductionApprovalEvent[];
  trackerRows: QuizComplianceTrackerRow[];
};

export type QuizProductionApprovalResult = {
  ok: boolean;
  mode: QuizPhase | 'invalid';
  errors: string[];
};

const UNRESOLVED_MARKER_PATTERN = /UNVERIFIED|TBD_COUNSEL_CONFIRMED_/;

function describeComplianceMarkerValue(value: unknown): string {
  if (Array.isArray(value)) return `array(length=${value.length})`;
  if (value && typeof value === 'object') {
    return `object(keys=${Object.keys(value).slice(0, 5).join(',')})`;
  }
  return typeof value;
}

function containsUnresolvedComplianceMarker(value: unknown): boolean {
  if (typeof value === 'string') {
    return UNRESOLVED_MARKER_PATTERN.test(value);
  }

  if (value === null || value === undefined) {
    return false;
  }

  try {
    return UNRESOLVED_MARKER_PATTERN.test(JSON.stringify(value));
  } catch (error) {
    logger.warn({
      constantName: 'UNRESOLVED_MARKER_PATTERN',
      errorMessage: error instanceof Error ? error.message : String(error),
      functionName: 'containsUnresolvedComplianceMarker',
      markerPattern: String(UNRESOLVED_MARKER_PATTERN),
      message: 'Unable to stringify quiz compliance marker value',
      valueDescription: describeComplianceMarkerValue(value),
      valueType: typeof value,
    });
    throw error;
  }
}

function hasPublishedOdds(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return false;
}

function getEventLabel(event: QuizProductionApprovalEvent): string {
  return event.id || '(unknown event)';
}

function pushEventErrors(
  event: QuizProductionApprovalEvent,
  errors: string[]
) {
  const label = getEventLabel(event);

  if (!getQuizComplianceEvidence(event)) {
    errors.push(
      `Quiz event ${label} is missing a supported regulatory_basis, regulatory_jurisdiction, or regulatory_evidence_ref`
    );
  }

  if (!hasPublishedOdds(event.published_odds)) {
    errors.push(`Quiz event ${label} is missing published_odds`);
  }

  if (event.compliance_verified !== true) {
    errors.push(`Quiz event ${label} is not compliance_verified`);
  }

  if (
    containsUnresolvedComplianceMarker(event.published_odds) ||
    containsUnresolvedComplianceMarker(event.regulatory_basis) ||
    containsUnresolvedComplianceMarker(event.regulatory_evidence_ref) ||
    containsUnresolvedComplianceMarker(event.regulatory_jurisdiction)
  ) {
    errors.push(`Quiz event ${label} contains unresolved compliance placeholders`);
  }
}

function pushTrackerErrors(
  row: QuizComplianceTrackerRow,
  errors: string[]
) {
  const label = row.item || '(unknown item)';

  if (row.verification_status !== 'verified') {
    errors.push(`Compliance tracker ${label} is not verified`);
  }

  if (!row.approved_at) {
    errors.push(`Compliance tracker ${label} is missing approved_at`);
  }

  if (containsUnresolvedComplianceMarker(row)) {
    errors.push(
      `Compliance tracker ${label} contains unresolved compliance placeholders`
    );
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function pushQuizRpcServerSecretErrors(
  input: QuizProductionApprovalInput,
  errors: string[]
): void {
  // Existence is necessary but not sufficient: a DB-side secret can be present
  // while the CI/Vercel QUIZ_RPC_SERVER_SECRET has drifted from it, in which
  // case every proof-gated quiz RPC would fail with QZ010 at runtime even
  // though the gate "passed". Require both configured AND a live signature
  // match (verified by signing a proof with the env secret and validating it in
  // the database) so drift is caught here rather than in production.
  if (!input.quizRpcServerSecretConfigured) {
    errors.push(
      'Postgres setting app.quiz_rpc_server_secret_current must be configured for quiz route proof verification'
    );
    return;
  }

  if (!input.quizRpcServerSecretMatches) {
    errors.push(
      'QUIZ_RPC_SERVER_SECRET does not match the database quiz route-proof secret (proof signature verification would fail at runtime)'
    );
  }
}

export function evaluateQuizProductionApproval(
  input: QuizProductionApprovalInput
): QuizProductionApprovalResult {
  const errors: string[] = [];
  let phase: QuizPhase;

  try {
    phase = getQuizPhase(input.quizPhase);
  } catch {
    return {
      ok: false,
      mode: 'invalid',
      errors: ['QUIZ_PHASE must be 1a or production'],
    };
  }

  if (phase === '1a') {
    pushQuizRpcServerSecretErrors(input, errors);

    return {
      ok: errors.length === 0,
      mode: phase,
      errors,
    };
  }

  pushQuizRpcServerSecretErrors(input, errors);

  if (!input.quizProductionApproved) {
    errors.push(
      'QUIZ_PRODUCTION_APPROVED must be truthy for production prize runtime'
    );
  }

  for (const event of input.events.filter((event) => event.status === 'active')) {
    try {
      pushEventErrors(event, errors);
    } catch (error) {
      errors.push(
        `Quiz event ${getEventLabel(event)} could not be checked against UNRESOLVED_MARKER_PATTERN: ${getErrorMessage(error)}`
      );
    }
  }

  for (const row of input.trackerRows) {
    try {
      pushTrackerErrors(row, errors);
    } catch (error) {
      errors.push(
        `Compliance tracker ${row.item || '(unknown item)'} could not be checked against UNRESOLVED_MARKER_PATTERN: ${getErrorMessage(error)}`
      );
    }
  }

  return {
    ok: errors.length === 0,
    mode: phase,
    errors,
  };
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (row): row is Record<string, unknown> =>
      Boolean(row) && typeof row === 'object' && !Array.isArray(row)
  );
}

function toEvent(row: Record<string, unknown>): QuizProductionApprovalEvent {
  return {
    compliance_verified:
      typeof row.compliance_verified === 'boolean'
        ? row.compliance_verified
        : null,
    id: typeof row.id === 'string' ? row.id : '',
    regulatory_basis:
      typeof row.regulatory_basis === 'string' ? row.regulatory_basis : null,
    regulatory_evidence_ref:
      typeof row.regulatory_evidence_ref === 'string'
        ? row.regulatory_evidence_ref
        : null,
    regulatory_jurisdiction:
      typeof row.regulatory_jurisdiction === 'string'
        ? row.regulatory_jurisdiction
        : null,
    status: typeof row.status === 'string' ? row.status : null,
    published_odds: row.published_odds,
  };
}

function toTrackerRow(row: Record<string, unknown>): QuizComplianceTrackerRow {
  return {
    ...row,
    item: typeof row.item === 'string' ? row.item : '',
    verification_status:
      typeof row.verification_status === 'string'
        ? row.verification_status
        : null,
    approved_at: typeof row.approved_at === 'string' ? row.approved_at : null,
    approval_comment:
      typeof row.approval_comment === 'string' ? row.approval_comment : null,
  };
}

async function loadProductionRows() {
  const { createServiceClient } = await import('@/lib/supabase/service');
  const supabase = createServiceClient();
  const eventSelect =
    'id,status,published_odds,compliance_verified,regulatory_basis,regulatory_jurisdiction,regulatory_evidence_ref';
  const eventsResult = await supabase
    .from('quiz_events')
    .select(eventSelect)
    .eq('status', 'active');

  if (eventsResult.error) {
    throw new Error(
      `Failed to load quiz_events (table=quiz_events select=${eventSelect} filter=status=active code=${eventsResult.error.code ?? 'unknown'}): ${eventsResult.error.message ?? 'unknown'}`
    );
  }
  if (!Array.isArray(eventsResult.data)) {
    throw new Error('Expected quiz_events query data to be an array');
  }

  const trackerSelect =
    'item,verification_status,approved_at,approval_comment,evidence_link,source_reference_checked_at';
  const trackerResult = await supabase
    .from('quiz_compliance_tracker')
    .select(trackerSelect);

  if (trackerResult.error) {
    throw new Error(
      `Failed to load quiz_compliance_tracker (table=quiz_compliance_tracker select=${trackerSelect} filter=none code=${trackerResult.error.code ?? 'unknown'}): ${trackerResult.error.message ?? 'unknown'}`
    );
  }
  if (!Array.isArray(trackerResult.data)) {
    throw new Error(
      'Expected quiz_compliance_tracker query data to be an array'
    );
  }

  return {
    events: asRecordArray(eventsResult.data).map(toEvent),
    trackerRows: asRecordArray(trackerResult.data).map(toTrackerRow),
  };
}

async function loadQuizRpcServerSecretConfigured() {
  const { createServiceClient } = await import('@/lib/supabase/service');
  const supabase = createServiceClient();
  const result = await supabase.rpc('quiz_rpc_server_secret_configured');

  if (result.error) {
    throw new Error(
      `Failed to check quiz RPC server secret configuration (function=quiz_rpc_server_secret_configured code=${result.error.code ?? 'unknown'}): ${result.error.message ?? 'unknown'}`
    );
  }

  return result.data === true;
}

async function loadQuizRpcServerSecretMatches(): Promise<boolean> {
  // Sign a throwaway proof with the CI/Vercel QUIZ_RPC_SERVER_SECRET and let the
  // database verify it with its own current/previous secret. A mismatch (or a
  // missing env secret) means proof-gated quiz RPCs would fail at runtime, so
  // surface it as a gate failure instead of a green-but-broken deploy.
  let proof: QuizRpcServerProof;
  try {
    proof = createQuizRpcServerProof({
      action: 'ci_quiz_rpc_secret_health',
      payload: {},
      subjectId: QUIZ_RPC_SECRET_HEALTH_PROOF_ID,
      userId: QUIZ_RPC_SECRET_HEALTH_PROOF_ID,
    });
  } catch (error) {
    if (error instanceof QuizRpcServerConfigError) {
      // No env secret to sign with: the DB has one but CI does not, so runtime
      // proofs would fail. Treat as a mismatch.
      return false;
    }
    throw error;
  }

  const { createServiceClient } = await import('@/lib/supabase/service');
  const supabase = createServiceClient();
  // Pass all four named args so PostgREST unambiguously selects the
  // (jsonb,text,text,uuid) overload — the DB also has a 1-arg
  // quiz_route_proof_valid(jsonb), and a positional/1-key call is ambiguous.
  // Signature verification does not need the optional expected-value checks.
  const result = await supabase.rpc('quiz_route_proof_valid', {
    p_route_proof: proof,
    p_expected_action: null,
    p_expected_subject_id: null,
    p_expected_user_id: null,
  });

  if (result.error) {
    throw new Error(
      `Failed to verify quiz RPC server secret against the database (function=quiz_route_proof_valid code=${result.error.code ?? 'unknown'}): ${result.error.message ?? 'unknown'}`
    );
  }

  return result.data === true;
}

export async function runCheckQuizProductionApprovalCli(): Promise<number> {
  const phase = getQuizPhaseEnv();
  const approved = getQuizProductionApprovedEnv();
  const quizRpcServerSecretConfigured =
    await loadQuizRpcServerSecretConfigured();
  // Only worth verifying the signature match once the DB actually has a secret;
  // otherwise the "must be configured" error already covers it.
  const quizRpcServerSecretMatches = quizRpcServerSecretConfigured
    ? await loadQuizRpcServerSecretMatches()
    : false;
  const rows =
    phase === 'production'
      ? await loadProductionRows()
      : { events: [], trackerRows: [] };
  const result = evaluateQuizProductionApproval({
    quizPhase: phase,
    quizProductionApproved: approved,
    quizRpcServerSecretConfigured,
    quizRpcServerSecretMatches,
    ...rows,
  });

  if (result.ok) {
    console.log(`Quiz production approval check passed (${result.mode})`);
    return 0;
  }

  for (const error of result.errors) {
    console.error(error);
  }
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCheckQuizProductionApprovalCli()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
