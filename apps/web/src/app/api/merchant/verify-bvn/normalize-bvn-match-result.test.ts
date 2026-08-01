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

  it('rejects an explicitly unsuccessful Monnify envelope even when its body claims a match', () => {
    expect(
      normalizeBvnMatchResult({
        requestSuccessful: false,
        responseCode: '0',
        responseBody: { bvnInformationMatch: true },
      })
    ).toBeNull();
  });

  it('rejects an explicit non-success response code before reading the body', () => {
    expect(
      normalizeBvnMatchResult({
        requestSuccessful: true,
        responseCode: '99',
        responseBody: { bvnInformationMatch: true },
      })
    ).toBeNull();
  });

  it.each([
    '0',
    0,
  ])('accepts a successful numeric or string response code (%s)', (responseCode) => {
    expect(
      normalizeBvnMatchResult({
        requestSuccessful: true,
        responseCode,
        responseBody: { bvnInformationMatch: true },
      })
    ).toEqual({ verified: true });
  });

  it('reports only the name field for an explicit name mismatch', () => {
    expect(
      normalizeBvnMatchResult({
        responseBody: {
          name: {
            matchStatus: 'NO_MATCH',
            firstName: 'Provider First Name',
            lastName: 'Provider Last Name',
          },
          dateOfBirth: 'FULL_MATCH',
          mobileNo: 'FULL_MATCH',
        },
      })
    ).toEqual({ verified: false, mismatchFields: ['name'] });
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
