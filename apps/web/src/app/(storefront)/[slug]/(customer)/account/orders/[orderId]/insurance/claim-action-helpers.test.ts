import { describe, expect, it } from 'vitest';
import {
  resolveClaimUrl,
  resolveInspectionUrl,
  resolveInsuranceCta,
} from './claim-action-helpers';

describe('resolveClaimUrl', () => {
  it('returns the hosted claim link when present', () => {
    expect(
      resolveClaimUrl({ claimLink: 'https://mycover.ai/purchase?q=claim' })
    ).toBe('https://mycover.ai/purchase?q=claim');
  });

  it('trims surrounding whitespace', () => {
    expect(
      resolveClaimUrl({ claimLink: '  https://mycover.ai/purchase?q=c  ' })
    ).toBe('https://mycover.ai/purchase?q=c');
  });

  it('returns null when the link is missing, null, or blank', () => {
    expect(resolveClaimUrl({})).toBeNull();
    expect(resolveClaimUrl({ claimLink: null })).toBeNull();
    expect(resolveClaimUrl({ claimLink: '   ' })).toBeNull();
  });

  it('returns null for unsafe schemes or malformed URLs', () => {
    expect(resolveClaimUrl({ claimLink: 'javascript:alert(1)' })).toBeNull();
    expect(
      resolveClaimUrl({ claimLink: 'data:text/html,<script/>' })
    ).toBeNull();
    expect(resolveClaimUrl({ claimLink: 'not-a-url' })).toBeNull();
  });
});

describe('resolveInspectionUrl', () => {
  it('returns the hosted inspection link when present', () => {
    expect(
      resolveInspectionUrl({
        inspectionLink: 'https://mycover.ai/purchase?q=inspect',
      })
    ).toBe('https://mycover.ai/purchase?q=inspect');
  });

  it('returns null when the link is missing or blank', () => {
    expect(resolveInspectionUrl({})).toBeNull();
    expect(resolveInspectionUrl({ inspectionLink: '' })).toBeNull();
  });
});

describe('resolveInsuranceCta', () => {
  it('waits for delivery before offering inspection', () => {
    expect(
      resolveInsuranceCta({
        inspectionLink: 'https://mycover.ai/purchase?q=inspect',
        inspectionStatus: 'pending',
        claimLink: 'https://mycover.ai/purchase?q=claim',
        orderDelivered: false,
      })
    ).toEqual({ kind: 'awaiting_delivery' });
  });

  it('offers inspection once delivered and inspection is pending', () => {
    expect(
      resolveInsuranceCta({
        inspectionLink: 'https://mycover.ai/purchase?q=inspect',
        inspectionStatus: 'pending',
        claimLink: 'https://mycover.ai/purchase?q=claim',
        orderDelivered: true,
      })
    ).toEqual({
      kind: 'inspect',
      url: 'https://mycover.ai/purchase?q=inspect',
    });
  });

  it('switches to claim once inspection is completed', () => {
    expect(
      resolveInsuranceCta({
        inspectionLink: 'https://mycover.ai/purchase?q=inspect',
        inspectionStatus: 'completed',
        claimLink: 'https://mycover.ai/purchase?q=claim',
        orderDelivered: true,
      })
    ).toEqual({ kind: 'claim', url: 'https://mycover.ai/purchase?q=claim' });
  });

  it('goes straight to claim when there is no inspection link', () => {
    expect(
      resolveInsuranceCta({
        claimLink: 'https://mycover.ai/purchase?q=claim',
      })
    ).toEqual({ kind: 'claim', url: 'https://mycover.ai/purchase?q=claim' });
  });

  it('returns claim with null url (SDK fallback) when no claim link captured', () => {
    expect(resolveInsuranceCta({ inspectionStatus: 'completed' })).toEqual({
      kind: 'claim',
      url: null,
    });
  });
});
