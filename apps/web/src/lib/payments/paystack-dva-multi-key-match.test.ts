import { describe, expect, it } from 'vitest';
import {
  type DvaMatchCandidate,
  type DvaMatchContext,
  matchPaystackDvaCandidates,
} from '@/lib/payments/paystack-dva-multi-key-match';

// B0 tightens DVA reconciliation to require ALL of:
// - amount = verified Paystack amount (kobo precision; ₦0.01 tolerance)
// - customer_email matches the Paystack customer
// - paid_at IN [created_at, LEAST(expires_at, created_at + 90min)]
// Plus the upstream lookup already filters by:
// - merchant_id (inferred via the order's merchant)
// - account_number + provider (the lookup key)
// - transactions.status pending (caller responsibility)

const ctx = (overrides: Partial<DvaMatchContext> = {}): DvaMatchContext => ({
  verifiedAmountKobo: 83_500_000, // ₦835,000
  customerEmail: 'igbinoviaefosa56@gmail.com',
  paidAt: new Date('2026-05-09T11:03:00Z'),
  ...overrides,
});

const candidate = (
  overrides: Partial<DvaMatchCandidate> = {}
): DvaMatchCandidate => ({
  order_id: '211bcf0e-0795-488f-aeeb-52c5b7a8b9ae',
  merchant_id: 'merchant-1',
  customer_email: 'igbinoviaefosa56@gmail.com',
  total_kobo: 83_500_000,
  // initialize/route.ts stores +90min (1h countdown + 30min grace).
  account_created_at: new Date('2026-05-09T10:00:00Z'),
  account_expires_at: new Date('2026-05-09T11:30:00Z'),
  ...overrides,
});

describe('matchPaystackDvaCandidates — happy paths', () => {
  it('matches exactly one candidate when all 6 keys line up', () => {
    const result = matchPaystackDvaCandidates([candidate()], ctx());
    expect(result.kind).toBe('single');
    if (result.kind === 'single') {
      expect(result.candidate.order_id).toBe(
        '211bcf0e-0795-488f-aeeb-52c5b7a8b9ae'
      );
    }
  });

  it('matches the right candidate when two share an account number but only one fits the window', () => {
    // Stale DVA assignment from a month ago — paid_at falls way after
    // its +90min upper bound, so it's filtered out. Fresh assignment
    // matches.
    const stale = candidate({
      order_id: 'older-order',
      account_created_at: new Date('2026-04-01T00:00:00Z'),
      account_expires_at: new Date('2026-04-01T01:30:00Z'),
    });
    const fresh = candidate({ order_id: 'fresh-order' });

    const result = matchPaystackDvaCandidates([stale, fresh], ctx());
    expect(result.kind).toBe('single');
    if (result.kind === 'single') {
      expect(result.candidate.order_id).toBe('fresh-order');
    }
  });
});

describe('matchPaystackDvaCandidates — amount mismatch (kobo precision)', () => {
  it('drops candidates whose order_total differs by more than 1 kobo', () => {
    const result = matchPaystackDvaCandidates(
      [candidate({ total_kobo: 83_500_002 })],
      ctx()
    );
    expect(result.kind).toBe('none');
  });

  it('accepts ±1 kobo rounding', () => {
    const result = matchPaystackDvaCandidates(
      [candidate({ total_kobo: 83_499_999 })],
      ctx()
    );
    expect(result.kind).toBe('single');
  });
});

describe('matchPaystackDvaCandidates — customer_email', () => {
  it('drops candidates whose customer_email differs case-insensitively', () => {
    const result = matchPaystackDvaCandidates(
      [candidate({ customer_email: 'someone-else@example.com' })],
      ctx()
    );
    expect(result.kind).toBe('none');
  });

  it('matches with case-insensitive customer_email + trimmed whitespace', () => {
    const result = matchPaystackDvaCandidates(
      [candidate({ customer_email: '  Igbinoviaefosa56@GMAIL.COM  ' })],
      ctx()
    );
    expect(result.kind).toBe('single');
  });
});

describe('matchPaystackDvaCandidates — paid_at window', () => {
  it('rejects paid_at before account_created_at (defensive lower bound)', () => {
    const result = matchPaystackDvaCandidates(
      [candidate()],
      ctx({ paidAt: new Date('2026-05-09T09:59:00Z') })
    );
    expect(result.kind).toBe('none');
  });

  it('rejects paid_at after the +90min upper bound', () => {
    // account_created_at = 10:00; expires_at = 11:30; +90min = 11:30.
    // LEAST = 11:30. paid_at = 11:31 is outside window.
    const result = matchPaystackDvaCandidates(
      [candidate()],
      ctx({ paidAt: new Date('2026-05-09T11:31:00Z') })
    );
    expect(result.kind).toBe('none');
  });

  it('clamps to +90min when account_expires_at is later (defends against a malformed DVA assignment)', () => {
    // account_created_at = 10:00, expires_at = 13:00 (bogus). +90min = 11:30.
    // LEAST = 11:30. paid_at = 11:35 is outside the clamped window.
    const c = candidate({
      account_expires_at: new Date('2026-05-09T13:00:00Z'),
    });
    const result = matchPaystackDvaCandidates(
      [c],
      ctx({ paidAt: new Date('2026-05-09T11:35:00Z') })
    );
    expect(result.kind).toBe('none');
  });

  it('falls back to +90min when account_expires_at is null', () => {
    const c = candidate({ account_expires_at: null });
    const result = matchPaystackDvaCandidates(
      [c],
      ctx({ paidAt: new Date('2026-05-09T11:25:00Z') })
    );
    expect(result.kind).toBe('single');
  });
});

describe('matchPaystackDvaCandidates — ambiguity + zero candidates', () => {
  it('returns ambiguous when 2+ candidates all match', () => {
    const a = candidate({ order_id: 'order-a' });
    const b = candidate({ order_id: 'order-b' });
    const result = matchPaystackDvaCandidates([a, b], ctx());
    expect(result.kind).toBe('ambiguous');
    if (result.kind === 'ambiguous') {
      expect(result.candidates.map((c) => c.order_id).sort()).toEqual([
        'order-a',
        'order-b',
      ]);
    }
  });

  it('returns none when zero candidates pass the filter', () => {
    const result = matchPaystackDvaCandidates(
      [candidate({ customer_email: 'mismatch@example.com' })],
      ctx()
    );
    expect(result.kind).toBe('none');
  });

  it('returns none when the input list is empty', () => {
    const result = matchPaystackDvaCandidates([], ctx());
    expect(result.kind).toBe('none');
  });
});
