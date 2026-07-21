import 'dotenv/config';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import { agenticDvaCutoverCli } from '@/lib/agentic/agentic-dva-cutover-cli';
import { agenticDvaCutoverConstants } from '@/lib/agentic/agentic-dva-cutover-constants';
import { assessAgenticDvaCutoverSession } from '@/lib/agentic/agentic-dva-cutover-evidence';
import { finalizeAgenticCheckoutPayment } from '@/lib/agentic/checkout-completion-finalize';
import { reserveAgenticIdempotencyKey } from '@/lib/agentic/idempotency';
import { logger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';
import { unknownValueGuards } from '@/lib/unknown-value-guards';
const COMPLETE_ROUTE = 'checkout_sessions.complete';
const { emitDriftAlert, fingerprintsMatch, isPaused, parseArgs, printResult } =
  agenticDvaCutoverCli;
export async function runDrainAgenticDvaConsentCutoverCli(
  argv: string[] = process.argv.slice(2),
  supabase?: SupabaseClient,
  now = new Date()
): Promise<number> {
  if (!isPaused()) {
    console.error(
      'Agentic Paystack DVA must be paused before the cutover drain.'
    );
    return 1;
  }
  const args = parseArgs(argv);
  const serviceClient = supabase ?? createServiceClient('event-pipeline');
  const { data, error } = await serviceClient
    .from('checkout_sessions')
    .select(agenticDvaCutoverConstants.sessionSelect)
    .eq('session_id', args.sessionId)
    .maybeSingle();
  if (error || !data) {
    const errorRecord =
      error && typeof error === 'object'
        ? (error as Record<string, unknown>)
        : null;
    logger.error({
      code: 'AGENTIC_DVA_CUTOVER_SESSION_READ_FAILED',
      databaseCode:
        typeof errorRecord?.code === 'string' ? errorRecord.code : undefined,
      errorType:
        error instanceof Error
          ? error.name
          : error === null
            ? 'session_missing'
            : typeof error,
      message: 'Agentic DVA cutover drain session read failed',
      sessionId: args.sessionId,
    });
    console.error('Agentic DVA cutover drain could not read the requested session.');
    return 1;
  }

  const assessment = assessAgenticDvaCutoverSession(data, now);
  if (
    assessment.state !== args.expectedState ||
    !fingerprintsMatch(assessment.evidenceFingerprint, args.fingerprint) ||
    assessment.disposition === 'manual_review'
  ) {
    emitDriftAlert({
      actualFingerprint: assessment.evidenceFingerprint,
      actualState: assessment.state,
      expectedFingerprint: args.fingerprint,
      expectedState: args.expectedState,
      reason: assessment.reason ?? 'state_or_evidence_mismatch',
      sessionId: args.sessionId,
    });
    return 1;
  }

  const action = assessment.disposition;
  if (!args.apply) {
    printResult({
      action,
      evidenceFingerprint: assessment.evidenceFingerprint,
      mode: 'dry_run',
      sessionId: args.sessionId,
      state: args.expectedState,
    });
    return 0;
  }

  if (action === 'release_stale_no_account_claim') {
    if (
      !assessment.sessionId ||
      !assessment.merchantId ||
      !assessment.expectedUpdatedAt ||
      !assessment.actionPayload
    ) {
      emitDriftAlert({
        actualFingerprint: assessment.evidenceFingerprint,
        actualState: assessment.state,
        expectedFingerprint: args.fingerprint,
        expectedState: args.expectedState,
        reason: 'release_identity_or_timestamp_missing',
        sessionId: args.sessionId,
      });
      return 1;
    }
    return releaseStaleClaim({ assessment, supabase: serviceClient });
  }
  if (
    !assessment.resume ||
    !assessment.merchantId ||
    !assessment.expectedUpdatedAt ||
    !assessment.actionPayload
  ) {
    emitDriftAlert({
      actualFingerprint: assessment.evidenceFingerprint,
      actualState: assessment.state,
      expectedFingerprint: args.fingerprint,
      expectedState: args.expectedState,
      reason: 'resume_evidence_missing',
      sessionId: args.sessionId,
    });
    return 1;
  }
  const actionPayload = assessment.actionPayload.unwrap();
  const resume = assessment.resume.unwrap();
  if (
    actionPayload.currency !==
    agenticDvaCutoverConstants.supportedCurrency
  ) {
    emitDriftAlert({
      actualFingerprint: assessment.evidenceFingerprint,
      actualState: assessment.state,
      expectedFingerprint: args.fingerprint,
      expectedState: args.expectedState,
      reason: 'currency_missing_or_invalid',
      sessionId: args.sessionId,
    });
    return 1;
  }

  const idempotencyKey = `agentic-dva-cutover-${assessment.evidenceFingerprint}`;
  const requestId = `dva-cutover-${assessment.evidenceFingerprint.slice(0, 32)}`;
  const reservation = await reserveAgenticIdempotencyKey({
    apiVersion: '2026-07-20.cutover',
    body: JSON.stringify({
      evidence_fingerprint: assessment.evidenceFingerprint,
      expected_state: args.expectedState,
      session_id: args.sessionId,
    }),
    key: idempotencyKey,
    merchantId: assessment.merchantId,
    method: 'POST',
    now,
    pathname: `/internal/agentic-dva-cutover/${args.sessionId}`,
    route: COMPLETE_ROUTE,
    supabase: serviceClient,
  });
  if (!reservation.ok || reservation.state !== 'reserved') {
    emitDriftAlert({
      actualFingerprint: assessment.evidenceFingerprint,
      actualState: assessment.state,
      expectedFingerprint: args.fingerprint,
      expectedState: args.expectedState,
      reason: 'idempotency_reservation_not_acquired',
      sessionId: args.sessionId,
    });
    return 1;
  }

  let response: Response;
  try {
    response = await finalizeAgenticCheckoutPayment({
      buyer: resume.buyer,
      dvaAccount: resume.dvaAccount,
      expectedSessionUpdatedAt: assessment.expectedUpdatedAt,
      finalizationClaimOverride:
        resume.finalizationClaim ?? undefined,
      idempotencyKey,
      merchantId: assessment.merchantId,
      metadata: resume.metadata,
      orderSession: {
        currency: actionPayload.currency,
        merchant_id: assessment.merchantId,
        session_id: args.sessionId,
        shipping_address: actionPayload.shippingAddress,
      },
      orderSessionCalc: {
        ...resume.sessionCalc,
        fulfillmentOptions: [],
        messages: [],
        selectedOptionId:
          typeof actionPayload.shippingMethod === 'string'
            ? actionPayload.shippingMethod
            : undefined,
      },
      requestId,
      route: COMPLETE_ROUTE,
      sessionId: args.sessionId,
      supabase: serviceClient,
    });
  } catch (error) {
    emitDriftAlert({
      actualFingerprint: assessment.evidenceFingerprint,
      actualState: assessment.state,
      expectedFingerprint: args.fingerprint,
      expectedState: args.expectedState,
      finalizerErrorType: error instanceof Error ? error.name : typeof error,
      reason: 'finalizer_threw',
      sessionId: args.sessionId,
    });
    return 1;
  }
  printResult({
    action,
    evidenceFingerprint: assessment.evidenceFingerprint,
    mode: 'apply',
    sessionId: args.sessionId,
    state: args.expectedState,
    status: response.status,
  });
  return response.status === 200 ? 0 : 1;
}

async function releaseStaleClaim({
  assessment,
  supabase,
}: {
  assessment: ReturnType<typeof assessAgenticDvaCutoverSession>;
  supabase: SupabaseClient;
}): Promise<number> {
  const actionPayload = assessment.actionPayload?.unwrap();
  const metadata = actionPayload?.metadata;
  if (
    !unknownValueGuards.isRecord(metadata) ||
    !unknownValueGuards.isRecord(metadata.agentic)
  ) {
    emitDriftAlert({
      actualFingerprint: assessment.evidenceFingerprint,
      actualState: assessment.state,
      expectedFingerprint: assessment.evidenceFingerprint,
      expectedState: 'claiming_payment',
      reason: 'release_metadata_missing',
      sessionId: assessment.sessionId ?? 'unknown',
    });
    return 1;
  }
  const agentic = metadata.agentic;
  const { data, error } = await supabase
    .from('checkout_sessions')
    .update({
      metadata: {
        ...metadata,
        agentic: {
          ...agentic,
          cutover_evidence_fingerprint: assessment.evidenceFingerprint,
          payment_error: 'agentic_dva_cutover_stale_claim_released',
          payment_state: 'payment_setup_failed',
        },
      },
      payment_reference: null,
    })
    .eq('session_id', assessment.sessionId)
    .eq('merchant_id', assessment.merchantId)
    .eq('payment_reference', actionPayload.paymentReference)
    .eq('updated_at', assessment.expectedUpdatedAt)
    .is('order_id', null)
    .is('payment_method', null)
    .is('payment_provider', null)
    .is('virtual_account_bank', null)
    .is('virtual_account_name', null)
    .is('virtual_account_number', null)
    .contains('metadata', { agentic: { payment_state: 'claiming_payment' } })
    .select('session_id')
    .maybeSingle();
  if (error || !data) {
    emitDriftAlert({
      actualFingerprint: assessment.evidenceFingerprint,
      actualState: assessment.state,
      expectedFingerprint: assessment.evidenceFingerprint,
      expectedState: 'claiming_payment',
      reason: 'claim_compare_and_set_failed',
      sessionId: assessment.sessionId ?? 'unknown',
    });
    return 1;
  }
  printResult({
    action: 'release_stale_no_account_claim',
    evidenceFingerprint: assessment.evidenceFingerprint,
    mode: 'apply',
    sessionId: assessment.sessionId ?? 'unknown',
    state: 'claiming_payment',
  });
  return 0;
}

const currentFile = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (import.meta.url === currentFile) {
  runDrainAgenticDvaConsentCutoverCli()
    .then((exitCode) => { process.exitCode = exitCode; })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : 'Drain failed');
      process.exitCode = 1;
    });
}
