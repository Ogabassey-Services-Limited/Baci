import { timingSafeEqual } from 'node:crypto';
import { agenticDvaCutoverConstants } from '@/lib/agentic/agentic-dva-cutover-constants';
import { resolveAgenticPaystackDvaMode } from '@/lib/agentic/agentic-paystack-dva-mode-value';
import { logger } from '@/lib/logger';

function isPaused(): boolean {
  try {
    return resolveAgenticPaystackDvaMode() === 'paused';
  } catch (error) {
    logger.error({
      code: 'AGENTIC_DVA_CUTOVER_MODE_RESOLUTION_FAILED',
      error:
        error instanceof Error
          ? error.message
          : 'Unknown DVA mode configuration error',
      message: 'Agentic DVA cutover mode resolution failed',
    });
    return false;
  }
}

function emitDriftAlert(input: Record<string, unknown>): void {
  logger.error({
    code: 'AGENTIC_DVA_CUTOVER_EVIDENCE_MISMATCH',
    message: 'Agentic DVA cutover state or evidence changed; no action taken',
    ...input,
  });
}

function fingerprintsMatch(actual: string, expected: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(actual) || !/^[a-f0-9]{64}$/.test(expected)) {
    return false;
  }
  const actualBuffer = Buffer.from(actual, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function parseArgs(argv: string[]) {
  const values = new Map<string, string>();
  let apply = false;
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--apply') {
      if (apply) throw new Error('Duplicate argument: --apply');
      apply = true;
      continue;
    }
    if (
      !['--session-id', '--expected-state', '--evidence-fingerprint'].includes(
        flag
      )
    ) {
      throw new Error('Unknown argument');
    }
    index += 1;
    const value = argv[index];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing required argument: ${flag}`);
    }
    if (values.has(flag)) throw new Error(`Duplicate argument: ${flag}`);
    values.set(flag, value);
  }
  const sessionId = values.get('--session-id');
  const expectedState = values.get('--expected-state');
  const fingerprint = values.get('--evidence-fingerprint');
  if (!sessionId) throw new Error('Missing required argument: --session-id');
  if (!/^agentic_[A-Za-z0-9_-]{1,120}$/.test(sessionId)) {
    throw new Error('--session-id is invalid');
  }
  if (!expectedState) {
    throw new Error('Missing required argument: --expected-state');
  }
  if (
    !agenticDvaCutoverConstants.transitionalStates.includes(
      expectedState as (typeof agenticDvaCutoverConstants.transitionalStates)[number]
    )
  ) {
    throw new Error('--expected-state is invalid');
  }
  if (!fingerprint) {
    throw new Error('Missing required argument: --evidence-fingerprint');
  }
  if (!/^[a-f0-9]{64}$/.test(fingerprint)) {
    throw new Error(
      '--evidence-fingerprint must be a lowercase SHA-256 digest'
    );
  }
  return { apply, expectedState, fingerprint, sessionId };
}

function printResult(input: Record<string, unknown>): void {
  console.log(JSON.stringify(input, null, 2));
}

export const agenticDvaCutoverCli = {
  emitDriftAlert,
  fingerprintsMatch,
  isPaused,
  parseArgs,
  printResult,
} as const;
