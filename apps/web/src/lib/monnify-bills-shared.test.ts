import { describe, expect, it } from 'vitest';
import {
  assertMonnifyBusinessSuccess,
  getMonnifyEnvelopeMessage,
  isMonnifyBusinessSuccess,
} from './monnify-bills-shared';

describe('Monnify bill shared helpers', () => {
  it('requires both the Monnify success flag and response code', () => {
    expect(
      isMonnifyBusinessSuccess({ requestSuccessful: true, responseCode: '0' })
    ).toBe(true);
    expect(
      isMonnifyBusinessSuccess({ requestSuccessful: true, responseCode: '1' })
    ).toBe(false);
  });

  it('includes the provider response code in business failure messages', () => {
    expect(
      getMonnifyEnvelopeMessage({
        fallback: 'fallback',
        responseCode: '1',
        responseMessage: 'Unavailable',
      })
    ).toBe('Unavailable (1)');
    expect(() =>
      assertMonnifyBusinessSuccess(
        { requestSuccessful: true, responseCode: '1' },
        'Monnify lookup'
      )
    ).toThrow('Monnify lookup failed: 1');
  });
});
