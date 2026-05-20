import { createHash, createHmac } from 'node:crypto';
import { getQuizRpcServerSecret } from '@/env';
import { constantTimeEqual } from '@/lib/constant-time-equal';

export interface QuizRpcServerProof {
  action: string;
  issued_at: string;
  payload: Record<string, unknown>;
  payload_hash: string;
  proof_id: string;
  scope: 'quiz_phase1a';
  signature: string;
  subject_id: string;
  user_id: string;
  version: 'quiz-rpc-proof:v1';
}

const QUIZ_RPC_PROOF_VERSION = 'quiz-rpc-proof:v1' as const;
const QUIZ_RPC_PROOF_SCOPE = 'quiz_phase1a' as const;
const MAX_FUTURE_SKEW_MS = 5_000;

export class QuizRpcServerConfigError extends Error {
  constructor(message = 'missing_quiz_rpc_server_secret') {
    super(message);
    this.name = 'QuizRpcServerConfigError';
  }
}

function requireQuizRpcServerSecret(secret = getQuizRpcServerSecret()) {
  const normalized = secret?.trim();
  if (!normalized) {
    throw new QuizRpcServerConfigError();
  }

  return normalized;
}

function canonicalQuizRpcProofPayload({
  action,
  issuedAt,
  payloadHash,
  scope = QUIZ_RPC_PROOF_SCOPE,
  subjectId,
  userId,
  version = QUIZ_RPC_PROOF_VERSION,
}: {
  action: string;
  issuedAt: string;
  payloadHash: string;
  scope?: string;
  subjectId: string;
  userId: string;
  version?: string;
}) {
  return [
    version,
    scope,
    action,
    subjectId,
    userId,
    issuedAt,
    payloadHash,
  ].join('\n');
}

function normalizeForCanonicalJson(
  value: unknown,
  path = '$',
  seen = new WeakSet<object>()
): unknown {
  if (value === undefined) {
    throw new Error(`unsupported_quiz_proof_payload_value at ${path}`);
  }

  if (typeof value === 'function' || typeof value === 'symbol') {
    throw new Error(`unsupported_quiz_proof_payload_value at ${path}`);
  }

  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error(`unsupported_quiz_proof_payload_number at ${path}`);
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      throw new Error(`circular_quiz_proof_payload at ${path}`);
    }
    seen.add(value);
    try {
      return value.map((item, index) =>
        normalizeForCanonicalJson(item, `${path}[${index}]`, seen)
      );
    } finally {
      seen.delete(value);
    }
  }

  if (value && typeof value === 'object') {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        throw new Error(`unsupported_quiz_proof_payload_date at ${path}`);
      }
      return value.toISOString();
    }

    if (seen.has(value)) {
      throw new Error(`circular_quiz_proof_payload at ${path}`);
    }

    const symbolKeys = Object.getOwnPropertySymbols(value);
    if (symbolKeys.length > 0) {
      throw new Error(`unsupported_quiz_proof_payload_symbol_key at ${path}`);
    }

    seen.add(value);
    try {
      return Object.fromEntries(
        Object.entries(value)
          .sort(([left], [right]) => {
            if (left < right) return -1;
            if (left > right) return 1;
            return 0;
          })
          .map(([key, nestedValue]) => [
            key,
            normalizeForCanonicalJson(nestedValue, `${path}.${key}`, seen),
          ])
      );
    } finally {
      seen.delete(value);
    }
  }

  return value;
}

function createPayloadHash(payload: Record<string, unknown>): string {
  return createHash('sha256')
    .update(JSON.stringify(normalizeForCanonicalJson(payload)))
    .digest('hex');
}

export function createQuizRpcServerProof({
  action,
  now = new Date().toISOString(),
  payload,
  secret,
  subjectId,
  userId,
}: {
  action: string;
  now?: string;
  payload: Record<string, unknown>;
  secret?: string;
  subjectId: string;
  userId: string;
}): QuizRpcServerProof {
  const signingSecret = requireQuizRpcServerSecret(secret);
  const payloadHash = createPayloadHash(payload);
  const signaturePayload = canonicalQuizRpcProofPayload({
    action,
    issuedAt: now,
    payloadHash,
    subjectId,
    userId,
  });
  const signature = createHmac('sha256', signingSecret)
    .update(signaturePayload)
    .digest('hex');

  return {
    action,
    issued_at: now,
    payload,
    payload_hash: payloadHash,
    proof_id: signature.slice(0, 24),
    scope: QUIZ_RPC_PROOF_SCOPE,
    signature,
    subject_id: subjectId,
    user_id: userId,
    version: QUIZ_RPC_PROOF_VERSION,
  };
}

export function verifyQuizRpcServerProof({
  maxAgeMs,
  now,
  proof,
  secret,
}: {
  maxAgeMs?: number;
  now?: string;
  proof: QuizRpcServerProof;
  secret?: string;
}): { ok: true } | { error: string; ok: false } {
  let signingSecret: string;
  try {
    signingSecret = requireQuizRpcServerSecret(secret);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'missing_quiz_rpc_server_secret',
      ok: false,
    };
  }

  const hasValidPayloadHashFormat = /^[0-9a-f]{64}$/.test(proof.payload_hash);
  if (
    proof.version !== QUIZ_RPC_PROOF_VERSION ||
    proof.scope !== QUIZ_RPC_PROOF_SCOPE ||
    !hasValidPayloadHashFormat ||
    proof.payload_hash !== createPayloadHash(proof.payload)
  ) {
    return { error: 'invalid_quiz_rpc_server_proof', ok: false };
  }

  if (maxAgeMs !== undefined) {
    const issuedAt = Date.parse(proof.issued_at);
    const nowMs = Date.parse(now ?? new Date().toISOString());
    if (!Number.isFinite(issuedAt) || !Number.isFinite(nowMs)) {
      return { error: 'invalid_quiz_rpc_server_proof', ok: false };
    }

    if (nowMs - issuedAt > maxAgeMs || issuedAt - nowMs > MAX_FUTURE_SKEW_MS) {
      return { error: 'stale_quiz_rpc_server_proof', ok: false };
    }
  }

  const expected = createHmac('sha256', signingSecret)
    .update(
      canonicalQuizRpcProofPayload({
        action: proof.action,
        issuedAt: proof.issued_at,
        payloadHash: proof.payload_hash,
        scope: proof.scope,
        subjectId: proof.subject_id,
        userId: proof.user_id,
        version: proof.version,
      })
    )
    .digest('hex');

  if (
    proof.proof_id !== proof.signature.slice(0, 24) ||
    !constantTimeEqual(proof.signature, expected)
  ) {
    return { error: 'invalid_quiz_rpc_server_proof', ok: false };
  }

  return { ok: true };
}
