import { describe, expect, it } from 'vitest';
import { QuizProductionNotApprovedError } from '@/lib/quiz-compliance-gate';
import { prizeGuardErrorResponse } from './route-helpers';

describe('quiz route response helpers', () => {
  it('maps QuizProductionNotApprovedError to a 403 body', async () => {
    const response = prizeGuardErrorResponse(
      new QuizProductionNotApprovedError()
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      code: 'quiz_production_not_approved',
      error: 'Quiz prizes are not approved for production use',
    });
  });

  it('rethrows non-guard errors', () => {
    const err = new Error('boom');

    expect(() => prizeGuardErrorResponse(err)).toThrow('boom');
  });
});
