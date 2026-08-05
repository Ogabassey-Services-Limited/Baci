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
  customerEmail: 'customer@example.com',
  paidAt: new Date('2026-05-09T11:03:00Z'),
  ...overrides,
});

const candidate = (
  overrides: Partial<DvaMatchCandidate> = {}
): DvaMatchCandidate => ({
  order_id: '211bcf0e-0795-488f-aeeb-52c5b7a8b9ae',
  merchant_id: 'merchant-1',
  customer_email: 'customer@example.com',
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
      expect(result.timing).toBe('in_window');
      expect(result.candidate.order_id).toBe(
        '211bcf0e-0795-488f-aeeb-52c5b7a8b9ae'
      );
    }
  });

  it('uses payable_amount_kobo when wallet or savings credits reduce the DVA charge', () => {
    const result = matchPaystackDvaCandidates(
      [
        candidate({
          total_kobo: 83_500_000,
          payable_amount_kobo: 35_000_000,
        }),
      ],
      ctx({ verifiedAmountKobo: 35_000_000 })
    );

    expect(result.kind).toBe('single');
    if (result.kind === 'single') {
      expect(result.timing).toBe('in_window');
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
      expect(result.timing).toBe('in_window');
      expect(result.candidate.order_id).toBe('fresh-order');
    }
  });

  it('matches a unique underpayment only for a merchant-created invoice', () => {
    const result = matchPaystackDvaCandidates(
      [
        candidate({
          merchant_created: true,
          outstanding_amount_kobo: 83_500_000,
        }),
      ],
      ctx({ verifiedAmountKobo: 30_000_000 })
    );

    expect(result.kind).toBe('single');
    if (result.kind === 'single') {
      expect(result.allocation).toBe('partial');
      expect(result.candidate.order_id).toBe(
        '211bcf0e-0795-488f-aeeb-52c5b7a8b9ae'
      );
    }
  });

  it('uses the remaining balance for the final transfer after a partial payment', () => {
    const result = matchPaystackDvaCandidates(
      [
        candidate({
          merchant_created: true,
          outstanding_amount_kobo: 53_500_000,
          payable_amount_kobo: 83_500_000,
        }),
      ],
      ctx({ verifiedAmountKobo: 53_500_000 })
    );

    expect(result.kind).toBe('single');
    if (result.kind === 'single') {
      expect(result.allocation).toBe('exact');
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

  it('falls back to total_kobo when no residual payable amount was persisted', () => {
    const result = matchPaystackDvaCandidates([candidate()], ctx());

    expect(result.kind).toBe('single');
  });

  it('does not treat a storefront-created order underpayment as an invoice partial payment', () => {
    const result = matchPaystackDvaCandidates(
      [
        candidate({
          merchant_created: false,
          outstanding_amount_kobo: 83_500_000,
        }),
      ],
      ctx({ verifiedAmountKobo: 30_000_000 })
    );

    expect(result.kind).toBe('none');
  });

  it('does not auto-allocate an overpayment to a merchant-created invoice', () => {
    const result = matchPaystackDvaCandidates(
      [
        candidate({
          merchant_created: true,
          outstanding_amount_kobo: 53_500_000,
        }),
      ],
      ctx({ verifiedAmountKobo: 60_000_000 })
    );

    expect(result.kind).toBe('none');
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
      [candidate({ customer_email: '  Customer@EXAMPLE.COM  ' })],
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

  it('accepts one uniquely matching late invoice payment after the +90min window', () => {
    // Tony's production incident shape: the reusable DVA received the exact
    // invoice amount after the short checkout window had elapsed. Account,
    // customer email, amount, and assignment lower-bound still identify one
    // active invoice, so the payment must not be stranded in review.
    const result = matchPaystackDvaCandidates(
      [candidate()],
      ctx({ paidAt: new Date('2026-05-09T12:53:00Z') })
    );
    expect(result.kind).toBe('single');
    if (result.kind === 'single') {
      expect(result.timing).toBe('late');
    }
  });

  it('uses the unique late-match fallback when account_expires_at is beyond the grace window', () => {
    const c = candidate({
      account_expires_at: new Date('2026-05-09T13:00:00Z'),
    });
    const result = matchPaystackDvaCandidates(
      [c],
      ctx({ paidAt: new Date('2026-05-09T11:35:00Z') })
    );
    expect(result.kind).toBe('single');
  });

  it('falls back to +90min when account_expires_at is null', () => {
    const c = candidate({ account_expires_at: null });
    const result = matchPaystackDvaCandidates(
      [c],
      ctx({ paidAt: new Date('2026-05-09T11:25:00Z') })
    );
    expect(result.kind).toBe('single');
  });

  it('uses account_assigned_at as the retry window anchor when present', () => {
    const c = candidate({
      account_created_at: new Date('2026-05-09T08:00:00Z'),
      account_assigned_at: new Date('2026-05-09T10:00:00Z'),
      account_expires_at: new Date('2026-05-09T11:30:00Z'),
    });
    const result = matchPaystackDvaCandidates(
      [c],
      ctx({ paidAt: new Date('2026-05-09T10:30:00Z') })
    );

    expect(result.kind).toBe('single');
  });

  it('rejects paid_at before account_assigned_at when present', () => {
    const c = candidate({
      account_assigned_at: new Date('2026-05-09T10:30:00Z'),
    });
    const result = matchPaystackDvaCandidates(
      [c],
      ctx({ paidAt: new Date('2026-05-09T10:29:00Z') })
    );

    expect(result.kind).toBe('none');
  });
});

describe('matchPaystackDvaCandidates — ambiguity + zero candidates', () => {
  it('returns ambiguous when 2+ candidates all match', () => {
    const a = candidate({ order_id: 'order-a' });
    const b = candidate({ order_id: 'order-b' });
    const result = matchPaystackDvaCandidates([a, b], ctx());
    expect(result.kind).toBe('ambiguous');
    if (result.kind === 'ambiguous') {
      expect(result.timing).toBe('in_window');
      expect(result.candidates.map((c) => c.order_id).sort()).toEqual([
        'order-a',
        'order-b',
      ]);
    }
  });

  it('returns ambiguous instead of guessing between merchant invoice partials', () => {
    const result = matchPaystackDvaCandidates(
      [
        candidate({
          merchant_created: true,
          order_id: 'partial-a',
          outstanding_amount_kobo: 83_500_000,
        }),
        candidate({
          merchant_created: true,
          order_id: 'partial-b',
          outstanding_amount_kobo: 90_000_000,
        }),
      ],
      ctx({ verifiedAmountKobo: 30_000_000 })
    );

    expect(result.kind).toBe('ambiguous');
    if (result.kind === 'ambiguous') {
      expect(result.allocation).toBe('partial');
    }
  });

  it('returns ambiguous instead of guessing when 2+ late candidates match', () => {
    const lateContext = ctx({ paidAt: new Date('2026-05-09T12:53:00Z') });
    const result = matchPaystackDvaCandidates(
      [candidate({ order_id: 'late-a' }), candidate({ order_id: 'late-b' })],
      lateContext
    );

    expect(result.kind).toBe('ambiguous');
    if (result.kind === 'ambiguous') {
      expect(result.timing).toBe('late');
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
