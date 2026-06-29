import { describe, expect, it } from 'vitest';
import {
  isMyCoverHost,
  isTerminalClaimStatusToken,
  normalizeInsuranceCertificateUrl,
  normalizeInsuranceFlowUrl,
  TERMINAL_CLAIM_STATUSES,
} from './index';

describe('isTerminalClaimStatusToken', () => {
  it('treats documented terminal statuses as terminal (case-insensitive)', () => {
    for (const status of TERMINAL_CLAIM_STATUSES) {
      expect(isTerminalClaimStatusToken(status.toUpperCase())).toBe(true);
    }
  });

  it('is non-terminal for in-progress / empty statuses', () => {
    expect(isTerminalClaimStatusToken('offer_sent')).toBe(false);
    expect(isTerminalClaimStatusToken('pending')).toBe(false);
    expect(isTerminalClaimStatusToken('  ')).toBe(false);
    expect(isTerminalClaimStatusToken(null)).toBe(false);
    expect(isTerminalClaimStatusToken(undefined)).toBe(false);
  });
});

describe('isMyCoverHost', () => {
  it('matches the apex and subdomains only', () => {
    expect(isMyCoverHost('mycover.ai')).toBe(true);
    expect(isMyCoverHost('staging.mycover.ai')).toBe(true);
    expect(isMyCoverHost('evil-mycover.ai')).toBe(false);
    expect(isMyCoverHost('mycover.ai.evil.com')).toBe(false);
  });
});

describe('normalizeInsuranceFlowUrl', () => {
  it('accepts HTTPS MyCover links', () => {
    expect(
      normalizeInsuranceFlowUrl('https://mycover.ai/purchase?q=claim')
    ).toBe('https://mycover.ai/purchase?q=claim');
  });

  it('rejects non-HTTPS, foreign hosts, and malformed/empty input', () => {
    expect(normalizeInsuranceFlowUrl('http://mycover.ai/x')).toBeNull();
    expect(normalizeInsuranceFlowUrl('https://evil.com/x')).toBeNull();
    expect(normalizeInsuranceFlowUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeInsuranceFlowUrl('not-a-url')).toBeNull();
    expect(normalizeInsuranceFlowUrl(null)).toBeNull();
    expect(normalizeInsuranceFlowUrl('  ')).toBeNull();
  });
});

describe('normalizeInsuranceCertificateUrl', () => {
  it('accepts MyCover hosts and the S3 certificate bucket', () => {
    expect(
      normalizeInsuranceCertificateUrl('https://mycover.ai/cert.pdf')
    ).toBe('https://mycover.ai/cert.pdf');
    expect(
      normalizeInsuranceCertificateUrl(
        'https://s3.eu-west-2.amazonaws.com/mycover/cert.pdf'
      )
    ).toBe('https://s3.eu-west-2.amazonaws.com/mycover/cert.pdf');
    expect(
      normalizeInsuranceCertificateUrl(
        'https://s3.eu-west-2.amazonaws.com/staging.mycover/cert.pdf'
      )
    ).toBe('https://s3.eu-west-2.amazonaws.com/staging.mycover/cert.pdf');
  });

  it('rejects other S3 buckets and foreign hosts', () => {
    expect(
      normalizeInsuranceCertificateUrl(
        'https://s3.eu-west-2.amazonaws.com/evil/cert.pdf'
      )
    ).toBeNull();
    expect(
      normalizeInsuranceCertificateUrl('https://evil.com/cert.pdf')
    ).toBeNull();
  });
});
