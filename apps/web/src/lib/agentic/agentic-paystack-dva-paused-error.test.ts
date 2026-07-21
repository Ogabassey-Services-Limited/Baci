import { describe, expect, it } from 'vitest';
import { AGENTIC_PAYSTACK_DVA_PAUSED_ERROR } from './agentic-paystack-dva-paused-error';

describe('AGENTIC_PAYSTACK_DVA_PAUSED_ERROR', () => {
  it('provides the stable public conflict code', () => {
    expect(AGENTIC_PAYSTACK_DVA_PAUSED_ERROR).toEqual({
      code: 'AGENTIC_PAYSTACK_DVA_PAUSED',
      error: 'Agentic Paystack bank transfer is paused',
    });
  });
});
