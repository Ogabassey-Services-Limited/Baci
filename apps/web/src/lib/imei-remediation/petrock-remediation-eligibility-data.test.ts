import { describe, expect, it, vi } from 'vitest';
import { loadPetrockRemediationEligibility } from './petrock-remediation-eligibility-data';

describe('loadPetrockRemediationEligibility', () => {
  it('loads only customer-owned evidence and approved active products', async () => {
    const lookup = {
      cached_response: {
        data: {
          blacklistStatus: 'Clean',
          carrier: 'US AT&T',
          device: 'iPhone 17 Pro Max',
          financeStatus: 'Clean',
          simLock: 'Locked',
        },
        success: true,
      },
      id: 'lookup-1',
    };
    const product = {
      carrier: 'AT&T',
      excluded_reason: null,
      id: 'product-1',
      launch_carrier: true,
      manual_disabled: false,
      model_scope: { kind: 'range', max: 17, min: 17 },
      price_ngn: 100_000,
      price_usdt: 65,
      provider_product_id: 'provider-1',
      raw_name: 'AT&T Clean Unlock',
      refund_policy: 'refundable',
      status_segment: 'clean',
      success_rate: 82,
      turnaround: '1-7 Days',
    };
    const lookupBuilder = {
      match: vi.fn(() => lookupBuilder),
      maybeSingle: vi.fn().mockResolvedValue({ data: lookup, error: null }),
      select: vi.fn(() => lookupBuilder),
    };
    const productBuilder = {
      match: vi.fn().mockResolvedValue({ data: [product], error: null }),
      select: vi.fn(() => productBuilder),
    };
    const catalogBuilder = {
      match: vi.fn().mockResolvedValue({
        data: [{ product_id: 'provider-1' }],
        error: null,
      }),
      select: vi.fn(() => catalogBuilder),
    };
    const assessmentBuilder = {
      match: vi.fn(() => assessmentBuilder),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      select: vi.fn(() => assessmentBuilder),
    };
    const supabaseAdmin = {
      from: vi.fn((table: string) => {
        if (table === 'imei_lookups') return lookupBuilder;
        if (table === 'petrock_orders') return assessmentBuilder;
        if (table === 'imei_provider_products') return catalogBuilder;
        return productBuilder;
      }),
    };

    await expect(
      loadPetrockRemediationEligibility({
        customerId: 'customer-1',
        identifierHash: 'a'.repeat(64),
        lookupId: 'lookup-1',
        merchantId: 'merchant-1',
        supabaseAdmin: supabaseAdmin as never,
      })
    ).resolves.toMatchObject({
      evidence: expect.objectContaining({ carrier: 'US AT&T' }),
      kind: 'eligible',
      needsAssessment: true,
      offers: [{ id: 'product-1', priceUsdt: 65 }],
    });
    expect(productBuilder.match).toHaveBeenCalledWith({
      excluded_reason: null,
      fixture_verified: true,
      is_active: true,
      launch_carrier: true,
      manual_disabled: false,
      review_status: 'approved',
    });
    expect(catalogBuilder.match).toHaveBeenCalledWith({
      active: true,
      currency: 'USD',
      provider: 'petrock',
      type: 'imei',
    });
  });

  it('returns a durable pending assessment without re-evaluating stale source evidence', async () => {
    const lookupBuilder = {
      match: vi.fn(() => lookupBuilder),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { cached_response: null, id: 'lookup-1' },
        error: null,
      }),
      select: vi.fn(() => lookupBuilder),
    };
    const assessmentBuilder = {
      match: vi.fn(() => assessmentBuilder),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'order-1', status: 'eligibility_pending' },
        error: null,
      }),
      select: vi.fn(() => assessmentBuilder),
    };
    const supabaseAdmin = {
      from: vi.fn((table: string) =>
        table === 'imei_lookups' ? lookupBuilder : assessmentBuilder
      ),
    };

    await expect(
      loadPetrockRemediationEligibility({
        customerId: 'customer-1',
        identifierHash: 'a'.repeat(64),
        lookupId: 'lookup-1',
        merchantId: 'merchant-1',
        supabaseAdmin: supabaseAdmin as never,
      })
    ).resolves.toEqual({ assessmentId: 'order-1', kind: 'pending' });
  });

  it('returns the existing eligible assessment id for payment continuity', async () => {
    const lookupBuilder = {
      match: vi.fn(() => lookupBuilder),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          cached_response: {
            data: {
              blacklistStatus: 'Clean',
              carrier: 'US AT&T',
              device: 'iPhone 17 Pro Max',
              financeStatus: 'Clean',
              simLock: 'Locked',
            },
            success: true,
          },
          id: 'lookup-1',
        },
        error: null,
      }),
      select: vi.fn(() => lookupBuilder),
    };
    const assessmentBuilder = {
      match: vi.fn(() => assessmentBuilder),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          eligibility_evidence: {
            blacklistStatus: 'Clean',
            carrier: 'US AT&T',
            device: 'iPhone 17 Pro Max',
            financeStatus: 'Clean',
            simLock: 'Locked',
          },
          id: 'order-1',
          status: 'eligible',
        },
        error: null,
      }),
      select: vi.fn(() => assessmentBuilder),
    };
    const productBuilder = {
      match: vi.fn().mockResolvedValue({
        data: [
          {
            carrier: 'AT&T',
            excluded_reason: null,
            id: 'product-1',
            launch_carrier: true,
            manual_disabled: false,
            model_scope: { kind: 'range', max: 17, min: 17 },
            price_ngn: 100_000,
            price_usdt: 65,
            provider_product_id: 'provider-1',
            raw_name: 'AT&T Clean Unlock',
            refund_policy: 'refundable',
            status_segment: 'clean',
            success_rate: 82,
            turnaround: '1-7 Days',
          },
        ],
        error: null,
      }),
      select: vi.fn(() => productBuilder),
    };
    const catalogBuilder = {
      match: vi.fn().mockResolvedValue({
        data: [{ product_id: 'provider-1' }],
        error: null,
      }),
      select: vi.fn(() => catalogBuilder),
    };

    await expect(
      loadPetrockRemediationEligibility({
        customerId: 'customer-1',
        identifierHash: 'a'.repeat(64),
        lookupId: 'lookup-1',
        merchantId: 'merchant-1',
        supabaseAdmin: {
          from: vi.fn((table: string) => {
            if (table === 'imei_lookups') return lookupBuilder;
            if (table === 'petrock_orders') return assessmentBuilder;
            if (table === 'imei_provider_products') return catalogBuilder;
            return productBuilder;
          }),
        } as never,
      })
    ).resolves.toMatchObject({
      assessmentId: 'order-1',
      kind: 'eligible',
      needsAssessment: false,
    });
  });

  it('keeps a payment-pending assessment resumable after wallet funding', async () => {
    const lookupBuilder = {
      match: vi.fn(() => lookupBuilder),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { cached_response: { data: {}, success: true }, id: 'lookup-1' },
        error: null,
      }),
      select: vi.fn(() => lookupBuilder),
    };
    const assessmentBuilder = {
      match: vi.fn(() => assessmentBuilder),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          eligibility_evidence: {
            blacklistStatus: 'Clean',
            carrier: 'US AT&T',
            device: 'iPhone 17 Pro Max',
            financeStatus: 'Clean',
            simLock: 'Locked',
          },
          id: 'order-1',
          remediation_product_id: 'product-1',
          status: 'payment_pending',
        },
        error: null,
      }),
      select: vi.fn(() => assessmentBuilder),
    };
    const productBuilder = {
      match: vi.fn().mockResolvedValue({
        data: [
          {
            carrier: 'AT&T',
            excluded_reason: null,
            id: 'product-1',
            launch_carrier: true,
            manual_disabled: false,
            model_scope: { kind: 'range', max: 17, min: 17 },
            price_ngn: 100_000,
            price_usdt: 65,
            provider_product_id: 'provider-1',
            raw_name: 'AT&T Clean Unlock',
            refund_policy: 'refundable',
            status_segment: 'clean',
            success_rate: 82,
            turnaround: '1-7 Days',
          },
          {
            carrier: 'AT&T',
            excluded_reason: null,
            id: 'product-2',
            launch_carrier: true,
            manual_disabled: false,
            model_scope: { kind: 'range', max: 17, min: 17 },
            price_ngn: 80_000,
            price_usdt: 50,
            provider_product_id: 'provider-2',
            raw_name: 'AT&T Alternate Unlock',
            refund_policy: 'refundable',
            status_segment: 'clean',
            success_rate: 75,
            turnaround: '1-10 Days',
          },
        ],
        error: null,
      }),
      select: vi.fn(() => productBuilder),
    };
    const catalogBuilder = {
      match: vi.fn().mockResolvedValue({
        data: [{ product_id: 'provider-1' }, { product_id: 'provider-2' }],
        error: null,
      }),
      select: vi.fn(() => catalogBuilder),
    };

    await expect(
      loadPetrockRemediationEligibility({
        customerId: 'customer-1',
        identifierHash: 'a'.repeat(64),
        lookupId: 'lookup-1',
        merchantId: 'merchant-1',
        supabaseAdmin: {
          from: vi.fn((table: string) => {
            if (table === 'imei_lookups') return lookupBuilder;
            if (table === 'petrock_orders') return assessmentBuilder;
            if (table === 'imei_provider_products') return catalogBuilder;
            return productBuilder;
          }),
        } as never,
      })
    ).resolves.toMatchObject({
      assessmentId: 'order-1',
      kind: 'eligible',
      needsAssessment: false,
      offers: [{ id: 'product-1' }],
    });
  });

  it('drops non-string cached evidence instead of throwing at normalization', async () => {
    const lookupBuilder = {
      match: vi.fn(() => lookupBuilder),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          cached_response: {
            data: {
              blacklistStatus: 'Clean',
              carrier: 123,
              device: 'iPhone 17 Pro Max',
              financeStatus: 'Clean',
              simLock: 'Locked',
            },
            success: true,
          },
          id: 'lookup-1',
        },
        error: null,
      }),
      select: vi.fn(() => lookupBuilder),
    };
    const assessmentBuilder = {
      match: vi.fn(() => assessmentBuilder),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      select: vi.fn(() => assessmentBuilder),
    };
    const productBuilder = {
      match: vi.fn().mockResolvedValue({ data: [], error: null }),
      select: vi.fn(() => productBuilder),
    };

    await expect(
      loadPetrockRemediationEligibility({
        customerId: 'customer-1',
        identifierHash: 'a'.repeat(64),
        lookupId: 'lookup-1',
        merchantId: 'merchant-1',
        supabaseAdmin: {
          from: vi.fn((table: string) => {
            if (table === 'imei_lookups') return lookupBuilder;
            if (table === 'petrock_orders') return assessmentBuilder;
            return productBuilder;
          }),
        } as never,
      })
    ).resolves.toMatchObject({
      checks: expect.arrayContaining(['carrier_detection']),
      evidence: expect.not.objectContaining({ carrier: expect.anything() }),
      kind: 'checks_required',
    });
  });

  it('does not offer excluded or non-launch remediation products', async () => {
    const lookupBuilder = {
      match: vi.fn(() => lookupBuilder),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          cached_response: {
            data: {
              blacklistStatus: 'Clean',
              carrier: 'US AT&T',
              device: 'iPhone 17 Pro Max',
              financeStatus: 'Clean',
              simLock: 'Locked',
            },
            success: true,
          },
          id: 'lookup-1',
        },
        error: null,
      }),
      select: vi.fn(() => lookupBuilder),
    };
    const assessmentBuilder = {
      match: vi.fn(() => assessmentBuilder),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      select: vi.fn(() => assessmentBuilder),
    };
    const productBuilder = {
      match: vi.fn().mockResolvedValue({
        data: [
          {
            carrier: 'AT&T',
            excluded_reason: 'parser_low_confidence',
            id: 'product-1',
            launch_carrier: false,
            manual_disabled: false,
            model_scope: { kind: 'range', max: 17, min: 17 },
            price_ngn: 100_000,
            price_usdt: 65,
            provider_product_id: 'provider-1',
            raw_name: 'AT&T Clean Unlock',
            refund_policy: 'refundable',
            status_segment: 'clean',
            success_rate: 82,
            turnaround: '1-7 Days',
          },
        ],
        error: null,
      }),
      select: vi.fn(() => productBuilder),
    };

    await expect(
      loadPetrockRemediationEligibility({
        customerId: 'customer-1',
        identifierHash: 'a'.repeat(64),
        lookupId: 'lookup-1',
        merchantId: 'merchant-1',
        supabaseAdmin: {
          from: vi.fn((table: string) => {
            if (table === 'imei_lookups') return lookupBuilder;
            if (table === 'petrock_orders') return assessmentBuilder;
            return productBuilder;
          }),
        } as never,
      })
    ).resolves.toMatchObject({
      kind: 'suppressed',
      reason: 'no_matching_product',
    });
  });
});
