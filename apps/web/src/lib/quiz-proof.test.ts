import { describe, expect, it } from 'vitest';
import {
  createQuizRpcServerProof,
  verifyQuizRpcServerProof,
} from '@/lib/quiz-proof';

describe('quiz rpc server proof', () => {
  it('creates and verifies action-bound HMAC proof', () => {
    const proof = createQuizRpcServerProof({
      action: 'claim_cash_award',
      now: '2026-05-16T10:00:00.000Z',
      payload: { award_id: 'award-1', user_id: 'user-1' },
      secret: 'server-secret',
      subjectId: 'award-1',
      userId: 'user-1',
    });

    expect(proof.action).toBe('claim_cash_award');
    expect(proof.payload_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(
      verifyQuizRpcServerProof({
        proof,
        secret: 'server-secret',
      })
    ).toEqual({ ok: true });
    expect(
      verifyQuizRpcServerProof({
        proof: { ...proof, action: 'claim_grand_prize' },
        secret: 'server-secret',
      })
    ).toEqual({ error: 'invalid_quiz_rpc_server_proof', ok: false });
    expect(
      verifyQuizRpcServerProof({
        proof: { ...proof, subject_id: 'award-2' },
        secret: 'server-secret',
      })
    ).toEqual({ error: 'invalid_quiz_rpc_server_proof', ok: false });
  });

  it('does not verify tampered signed proof fields', () => {
    const proof = createQuizRpcServerProof({
      action: 'claim_cash_award',
      now: '2026-05-16T10:00:00.000Z',
      payload: { award_id: 'award-1', user_id: 'user-1' },
      secret: 'server-secret',
      subjectId: 'award-1',
      userId: 'user-1',
    });

    expect(
      verifyQuizRpcServerProof({
        proof: { ...proof, payload: { award_id: 'award-2' } },
        secret: 'server-secret',
      })
    ).toEqual({ error: 'invalid_quiz_rpc_server_proof', ok: false });
    expect(
      verifyQuizRpcServerProof({
        proof: { ...proof, version: 'quiz-rpc-proof:v2' as never },
        secret: 'server-secret',
      })
    ).toEqual({ error: 'invalid_quiz_rpc_server_proof', ok: false });
    expect(
      verifyQuizRpcServerProof({
        proof: { ...proof, scope: 'other_scope' as never },
        secret: 'server-secret',
      })
    ).toEqual({ error: 'invalid_quiz_rpc_server_proof', ok: false });
    expect(
      verifyQuizRpcServerProof({
        proof: { ...proof, proof_id: 'x'.repeat(24) },
        secret: 'server-secret',
      })
    ).toEqual({ error: 'invalid_quiz_rpc_server_proof', ok: false });
  });

  it('canonicalizes object key order before signing payloads', () => {
    const left = createQuizRpcServerProof({
      action: 'finalize_awards',
      now: '2026-05-16T10:00:00.000Z',
      payload: { z: 1, A: 2, nested: { beta: 3, alpha: 4 } },
      secret: 'server-secret',
      subjectId: 'event-1',
      userId: 'user-1',
    });
    const right = createQuizRpcServerProof({
      action: 'finalize_awards',
      now: '2026-05-16T10:00:00.000Z',
      payload: { nested: { alpha: 4, beta: 3 }, A: 2, z: 1 },
      secret: 'server-secret',
      subjectId: 'event-1',
      userId: 'user-1',
    });

    expect(left.payload_hash).toBe(right.payload_hash);
    expect(left.signature).toBe(right.signature);
  });

  it('rejects stale proof timestamps', () => {
    const proof = createQuizRpcServerProof({
      action: 'finalize_awards',
      now: '2026-05-16T10:00:00.000Z',
      payload: { event_id: 'event-1' },
      secret: 'server-secret',
      subjectId: 'event-1',
      userId: 'user-1',
    });

    expect(
      verifyQuizRpcServerProof({
        maxAgeMs: 5 * 60 * 1000,
        now: '2026-05-16T10:06:00.000Z',
        proof,
        secret: 'server-secret',
      })
    ).toEqual({ error: 'stale_quiz_rpc_server_proof', ok: false });
  });

  it('rejects proof timestamps beyond the future skew window', () => {
    const proof = createQuizRpcServerProof({
      action: 'finalize_awards',
      now: '2026-05-16T10:00:06.000Z',
      payload: { event_id: 'event-1' },
      secret: 'server-secret',
      subjectId: 'event-1',
      userId: 'user-1',
    });

    expect(
      verifyQuizRpcServerProof({
        maxAgeMs: 5 * 60 * 1000,
        now: '2026-05-16T10:00:00.000Z',
        proof,
        secret: 'server-secret',
      })
    ).toEqual({ error: 'stale_quiz_rpc_server_proof', ok: false });
  });

  it('does not verify forged proof metadata without the matching HMAC', () => {
    expect(
      verifyQuizRpcServerProof({
        proof: {
          action: 'claim_cash_award',
          issued_at: '2026-05-16T10:00:00.000Z',
          payload: { award_id: 'award-1', user_id: 'user-1' },
          payload_hash: '0'.repeat(64),
          proof_id: 'fake-proof-id',
          scope: 'quiz_phase1a',
          signature: '0'.repeat(64),
          subject_id: 'award-1',
          user_id: 'user-1',
          version: 'quiz-rpc-proof:v1',
        },
        secret: 'server-secret',
      })
    ).toEqual({ error: 'invalid_quiz_rpc_server_proof', ok: false });
  });

  it('fails closed when the server secret is missing', () => {
    expect(() =>
      createQuizRpcServerProof({
        action: 'finalize_awards',
        payload: { event_id: 'event-1' },
        secret: '',
        subjectId: 'event-1',
        userId: 'user-1',
      })
    ).toThrow('missing_quiz_rpc_server_secret');

    expect(
      verifyQuizRpcServerProof({
        proof: {
          action: 'finalize_awards',
          issued_at: '2026-05-16T10:00:00.000Z',
          payload: { event_id: 'event-1' },
          payload_hash: '0'.repeat(64),
          proof_id: 'proof-id',
          scope: 'quiz_phase1a',
          signature: 'sig',
          subject_id: 'event-1',
          user_id: 'user-1',
          version: 'quiz-rpc-proof:v1',
        },
        secret: undefined,
      })
    ).toEqual({ error: 'missing_quiz_rpc_server_secret', ok: false });
  });

  it('normalizes dates and rejects unsupported canonical JSON payload values', () => {
    const proof = createQuizRpcServerProof({
      action: 'finalize_awards',
      now: '2026-05-16T10:00:00.000Z',
      payload: { issued: new Date('2026-05-16T10:00:00.000Z') },
      secret: 'server-secret',
      subjectId: 'event-1',
      userId: 'user-1',
    });

    expect(
      verifyQuizRpcServerProof({
        proof,
        secret: 'server-secret',
      })
    ).toEqual({ ok: true });

    expect(() =>
      createQuizRpcServerProof({
        action: 'finalize_awards',
        payload: { nested: { value: undefined } },
        secret: 'server-secret',
        subjectId: 'event-1',
        userId: 'user-1',
      })
    ).toThrow('unsupported_quiz_proof_payload_value at $.nested.value');

    expect(() =>
      createQuizRpcServerProof({
        action: 'finalize_awards',
        payload: { score: Number.NaN },
        secret: 'server-secret',
        subjectId: 'event-1',
        userId: 'user-1',
      })
    ).toThrow('unsupported_quiz_proof_payload_number at $.score');

    const circularPayload: Record<string, unknown> = {};
    circularPayload.self = circularPayload;
    expect(() =>
      createQuizRpcServerProof({
        action: 'finalize_awards',
        payload: circularPayload,
        secret: 'server-secret',
        subjectId: 'event-1',
        userId: 'user-1',
      })
    ).toThrow('circular_quiz_proof_payload at $.self');
  });
});
