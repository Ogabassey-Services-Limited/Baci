import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouteProof } from './route-helpers';

const ORIGINAL_ENV = { ...process.env };
const USER_ID = 'user-1';
const EVENT_ID = '11111111-1111-1111-1111-111111111111';

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

describe('quiz route proof helpers', () => {
  beforeEach(() => {
    restoreEnv();
  });

  afterEach(() => {
    restoreEnv();
    vi.restoreAllMocks();
  });

  it('returns a server error when the RPC server secret is missing', async () => {
    delete process.env.QUIZ_RPC_SERVER_SECRET;

    const { proof, response } = createRouteProof({
      action: 'start_quiz_attempt',
      payload: { user_id: USER_ID },
      subjectId: EVENT_ID,
      userId: USER_ID,
    });

    expect(proof).toBeNull();
    expect(response?.status).toBe(500);
    expect(await (response as Response).json()).toEqual({
      code: 'quiz_route_proof_unavailable',
      error: 'quiz_route_proof_unavailable',
    });
  });

  it('returns a signed, user/subject-bound proof when the secret is configured', () => {
    process.env.QUIZ_RPC_SERVER_SECRET = 'a'.repeat(64);

    const { proof, response } = createRouteProof({
      action: 'start_quiz_attempt',
      payload: { user_id: USER_ID },
      subjectId: EVENT_ID,
      userId: USER_ID,
    });

    expect(response).toBeNull();
    expect(proof).toMatchObject({
      action: 'start_quiz_attempt',
      scope: 'quiz_phase1a',
      subject_id: EVENT_ID,
      user_id: USER_ID,
      version: 'quiz-rpc-proof:v1',
    });
    expect(typeof proof?.signature).toBe('string');
    expect(proof?.proof_id).toHaveLength(24);
    expect(proof?.payload_hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
