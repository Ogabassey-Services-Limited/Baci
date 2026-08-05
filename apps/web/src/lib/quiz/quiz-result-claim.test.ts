import { describe, expect, it } from 'vitest';
import { createQuizResultClaimToken } from './quiz-result-claim';

const AWARD_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

describe('createQuizResultClaimToken', () => {
  it('signs the exact persisted expiry without extending it', () => {
    const expiresAt = '2026-08-05T10:05:00.000Z';
    const token = createQuizResultClaimToken(
      { awardId: AWARD_ID, expiresAt, userId: USER_ID },
      { now: '2026-08-05T10:00:00.000Z', secret: 'test-secret' }
    );
    const body = token?.split('.')[1];
    expect(
      JSON.parse(Buffer.from(body ?? '', 'base64url').toString('utf8'))
    ).toEqual({ awardId: AWARD_ID, expiresAt, userId: USER_ID });
  });

  it('does not sign at or after the persisted expiry', () => {
    expect(
      createQuizResultClaimToken(
        {
          awardId: AWARD_ID,
          expiresAt: '2026-08-05T10:00:00.000Z',
          userId: USER_ID,
        },
        { now: '2026-08-05T10:00:00.000Z', secret: 'test-secret' }
      )
    ).toBeNull();
  });
});
