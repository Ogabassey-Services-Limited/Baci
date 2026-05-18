import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { getQuizPhaseEnv, getQuizProductionApprovedEnv } from '@/env';
import { logger } from '@/lib/logger';
import { getQuizPhase, type QuizPhase } from '@/lib/quiz-compliance-gate';

export type QuizProductionApprovalEvent = {
  id: string;
  status: string | null;
  nlrc_permit_ref: string | null;
  published_odds: unknown;
  compliance_flags?: unknown;
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

  if (!(event.nlrc_permit_ref ?? '').trim()) {
    errors.push(`Quiz event ${label} is missing nlrc_permit_ref`);
  }

  if (!hasPublishedOdds(event.published_odds)) {
    errors.push(`Quiz event ${label} is missing published_odds`);
  }

  if (
    containsUnresolvedComplianceMarker(event.published_odds) ||
    containsUnresolvedComplianceMarker(event.compliance_flags)
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
    return {
      ok: true,
      mode: phase,
      errors,
    };
  }

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
    id: typeof row.id === 'string' ? row.id : '',
    status: typeof row.status === 'string' ? row.status : null,
    nlrc_permit_ref:
      typeof row.nlrc_permit_ref === 'string' ? row.nlrc_permit_ref : null,
    published_odds: row.published_odds,
    compliance_flags: row.compliance_flags,
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
  const eventSelect = 'id,status,nlrc_permit_ref,published_odds,compliance_flags';
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

export async function runCheckQuizProductionApprovalCli(): Promise<number> {
  const phase = getQuizPhaseEnv();
  const approved = getQuizProductionApprovedEnv();
  const rows =
    phase === 'production'
      ? await loadProductionRows()
      : { events: [], trackerRows: [] };
  const result = evaluateQuizProductionApproval({
    quizPhase: phase,
    quizProductionApproved: approved,
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
