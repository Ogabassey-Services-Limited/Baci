import { describe, expect, it } from 'vitest';
import { readClaimError } from './read-claim-error';

describe('readClaimError', () => {
  it('reads error payloads without assuming every payload is an error', () => {
    expect(readClaimError({ error: 'Expired' }, 'Fallback')).toBe('Expired');
    expect(
      readClaimError(
        {
          claim: {
            claimed: false,
            customerName: null,
            devices: [],
            merchantName: 'Ogabassey',
          },
        },
        'Fallback'
      )
    ).toBe('Fallback');
  });
});
