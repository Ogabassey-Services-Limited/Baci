import { describe, expect, it } from 'vitest';
import normalizeBvnMatchResult from './normalize-bvn-match-result';

describe('normalizeBvnMatchResult', () => {
  it('identifies explicit field-level mismatches without exposing provider values', () => {
    expect(
      normalizeBvnMatchResult({
        responseBody: {
          name: { matchStatus: 'FULL_MATCH', matchPercentage: 100 },
          dateOfBirth: 'NO_MATCH',
          mobileNo: 'NO_MATCH',
        },
      })
    ).toEqual({
      verified: false,
      mismatchFields: ['date_of_birth', 'mobile_number'],
    });
  });

  it('supports the current-guide overall match boolean', () => {
    expect(
      normalizeBvnMatchResult({
        responseBody: { bvnInformationMatch: true },
      })
    ).toEqual({ verified: true });
  });

  it('keeps compatibility with the existing legacy match status', () => {
    expect(
      normalizeBvnMatchResult({
        responseBody: { matchStatus: 'NO_MATCH' },
      })
    ).toEqual({ verified: false });
  });

  it('rejects unrecognized provider payloads', () => {
    expect(normalizeBvnMatchResult({ responseBody: {} })).toBeNull();
  });
});
