import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks ----

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const mockServerSupabase = {
  from: vi.fn(),
  auth: { getUser: vi.fn() },
};
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockServerSupabase),
}));

const mockGetClaims = vi.fn();
const mockCreateMyCoverClient = vi.fn();
vi.mock('@/lib/mycover', () => ({
  createMyCoverClient: () => mockCreateMyCoverClient(),
  MYCOVER_PRODUCTS: {},
}));

// Import after mocks
import { syncClaimsStatus } from './insurance-claim-sync';

// ---- syncClaimsStatus (v2 claim status mapping) ----

describe('syncClaimsStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateMyCoverClient.mockReturnValue({
      getClaims: mockGetClaims,
    });
  });

  it('returns failure when MyCover client is not configured', async () => {
    mockCreateMyCoverClient.mockReturnValue(null);

    const result = await syncClaimsStatus();

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining('config missing'),
      })
    );
  });

  describe('v2 claim status mapping', () => {
    // Current MyCover docs list these claim statuses for the v2 claims API.
    const v2ClaimStatuses = [
      'Pending',
      'Documented',
      'Inspection submitted',
      'Approved',
      'Declined',
      'Repair estimate requested',
      'Repair estimate provided',
      'Repair estimate submitted',
      'Offer sent',
      'Offer accepted',
      'Offer rejected',
      'Paid',
    ];

    it('recognizes all documented v2 claim status values without errors', async () => {
      const claims = v2ClaimStatuses.map((status, i) => ({
        id: `claim-${i}`,
        policy_id: `policy-${i}`,
        claim_status: status,
      }));

      mockGetClaims.mockResolvedValue({ claims });

      // Setup the server supabase to return matching local policies
      mockServerSupabase.from.mockImplementation((table: string) => {
        if (table === 'order_insurance_policies') {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: 'local-1',
                      status: 'active',
                      claim_status: null,
                    },
                    error: null,
                  }),
              }),
            }),
            update: () => ({
              eq: () => Promise.resolve({ data: {}, error: null }),
            }),
          };
        }
        return {};
      });

      const result = await syncClaimsStatus();

      expect(result.success).toBe(true);
    });

    it('maps "Documented" to "documented" status', async () => {
      const claims = [
        { id: 'claim-1', policy_id: 'policy-1', claim_status: 'Documented' },
      ];
      mockGetClaims.mockResolvedValue({ claims });

      const updateSpy = vi.fn().mockReturnValue({
        eq: () => Promise.resolve({ data: {}, error: null }),
      });

      mockServerSupabase.from.mockImplementation((table: string) => {
        if (table === 'order_insurance_policies') {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: 'local-1',
                      status: 'active',
                      claim_status: null,
                    },
                    error: null,
                  }),
              }),
            }),
            update: updateSpy,
          };
        }
        return {};
      });

      await syncClaimsStatus();

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          claim_status: 'documented',
        })
      );
    });

    it('maps "Inspection submitted" to "inspection" status', async () => {
      const claims = [
        {
          id: 'claim-1',
          policy_id: 'policy-1',
          claim_status: 'Inspection submitted',
        },
      ];
      mockGetClaims.mockResolvedValue({ claims });

      const updateSpy = vi.fn().mockReturnValue({
        eq: () => Promise.resolve({ data: {}, error: null }),
      });

      mockServerSupabase.from.mockImplementation((table: string) => {
        if (table === 'order_insurance_policies') {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: 'local-1',
                      status: 'active',
                      claim_status: null,
                    },
                    error: null,
                  }),
              }),
            }),
            update: updateSpy,
          };
        }
        return {};
      });

      await syncClaimsStatus();

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          claim_status: 'inspection',
        })
      );
    });

    it('maps "Offer sent" to "offer_sent" status', async () => {
      const claims = [
        { id: 'claim-1', policy_id: 'policy-1', claim_status: 'Offer sent' },
      ];
      mockGetClaims.mockResolvedValue({ claims });

      const updateSpy = vi.fn().mockReturnValue({
        eq: () => Promise.resolve({ data: {}, error: null }),
      });

      mockServerSupabase.from.mockImplementation((table: string) => {
        if (table === 'order_insurance_policies') {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: 'local-1',
                      status: 'active',
                      claim_status: null,
                    },
                    error: null,
                  }),
              }),
            }),
            update: updateSpy,
          };
        }
        return {};
      });

      await syncClaimsStatus();

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          claim_status: 'offer_sent',
        })
      );
    });

    it('maps "Offer accepted" to "offer_accepted" status', async () => {
      const claims = [
        {
          id: 'claim-1',
          policy_id: 'policy-1',
          claim_status: 'Offer accepted',
        },
      ];
      mockGetClaims.mockResolvedValue({ claims });

      const updateSpy = vi.fn().mockReturnValue({
        eq: () => Promise.resolve({ data: {}, error: null }),
      });

      mockServerSupabase.from.mockImplementation((table: string) => {
        if (table === 'order_insurance_policies') {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: 'local-1',
                      status: 'active',
                      claim_status: null,
                    },
                    error: null,
                  }),
              }),
            }),
            update: updateSpy,
          };
        }
        return {};
      });

      await syncClaimsStatus();

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          claim_status: 'offer_accepted',
        })
      );
    });

    it('maps a "Payment initiated" claim status to non-terminal approved (payout not settled)', async () => {
      const claims = [
        {
          id: 'claim-1',
          policy_id: 'policy-1',
          claim_status: 'Payment initiated',
        },
      ];
      mockGetClaims.mockResolvedValue({ claims });

      const updateSpy = vi.fn().mockReturnValue({
        eq: () => Promise.resolve({ data: {}, error: null }),
      });

      mockServerSupabase.from.mockImplementation((table: string) => {
        if (table === 'order_insurance_policies') {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: 'local-1',
                      status: 'active',
                      claim_status: null,
                    },
                    error: null,
                  }),
              }),
            }),
            update: updateSpy,
          };
        }
        return {};
      });

      await syncClaimsStatus();

      // "Payment initiated" (payout in flight, not settled) must NOT close the
      // claim — it maps to the non-terminal `approved` token.
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          claim_status: 'approved',
        })
      );
    });

    it('preserves legacy "Settled" as a successful paid status', async () => {
      const claims = [
        { id: 'claim-1', policy_id: 'policy-1', claim_status: 'Settled' },
      ];
      mockGetClaims.mockResolvedValue({ claims });

      const updateSpy = vi.fn().mockReturnValue({
        eq: () => Promise.resolve({ data: {}, error: null }),
      });

      mockServerSupabase.from.mockImplementation((table: string) => {
        if (table === 'order_insurance_policies') {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: 'local-1',
                      status: 'active',
                      claim_status: null,
                    },
                    error: null,
                  }),
              }),
            }),
            update: updateSpy,
          };
        }
        return {};
      });

      await syncClaimsStatus();

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          claim_status: 'paid',
        })
      );
    });

    it('keeps payment_status "payment initiated" non-terminal while claim_status is pending', async () => {
      const claims = [
        {
          id: 'claim-1',
          policy_id: 'policy-1',
          claim_status: 'Pending',
          payment_status: 'payment initiated',
        },
      ];
      mockGetClaims.mockResolvedValue({ claims });

      const updateSpy = vi.fn().mockReturnValue({
        eq: () => Promise.resolve({ data: {}, error: null }),
      });

      mockServerSupabase.from.mockImplementation((table: string) => {
        if (table === 'order_insurance_policies') {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: 'local-1',
                      status: 'active',
                      claim_status: null,
                    },
                    error: null,
                  }),
              }),
            }),
            update: updateSpy,
          };
        }
        return {};
      });

      await syncClaimsStatus();

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          claim_status: 'pending',
          claim_stage: 'Pending',
        })
      );
    });

    it('maps "Declined" to "declined" status', async () => {
      const claims = [
        { id: 'claim-1', policy_id: 'policy-1', claim_status: 'Declined' },
      ];
      mockGetClaims.mockResolvedValue({ claims });

      const updateSpy = vi.fn().mockReturnValue({
        eq: () => Promise.resolve({ data: {}, error: null }),
      });

      mockServerSupabase.from.mockImplementation((table: string) => {
        if (table === 'order_insurance_policies') {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: 'local-1',
                      status: 'active',
                      claim_status: null,
                    },
                    error: null,
                  }),
              }),
            }),
            update: updateSpy,
          };
        }
        return {};
      });

      await syncClaimsStatus();

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          claim_status: 'declined',
        })
      );
    });

    it('maps "Repair estimate submitted" to "repair_estimate" status', async () => {
      const claims = [
        {
          id: 'claim-1',
          policy_id: 'policy-1',
          claim_status: 'Repair estimate submitted',
        },
      ];
      mockGetClaims.mockResolvedValue({ claims });

      const updateSpy = vi.fn().mockReturnValue({
        eq: () => Promise.resolve({ data: {}, error: null }),
      });

      mockServerSupabase.from.mockImplementation((table: string) => {
        if (table === 'order_insurance_policies') {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: 'local-1',
                      status: 'active',
                      claim_status: null,
                    },
                    error: null,
                  }),
              }),
            }),
            update: updateSpy,
          };
        }
        return {};
      });

      await syncClaimsStatus();

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          claim_status: 'repair_estimate',
        })
      );
    });

    it('preserves webhook-only claim details when Claims API omits progress and comment', async () => {
      const claims = [
        {
          id: 'claim-1',
          policy_id: 'policy-1',
          claim_status: 'Approved',
        },
      ];
      mockGetClaims.mockResolvedValue({ claims });

      const updateSpy = vi.fn().mockReturnValue({
        eq: () => Promise.resolve({ data: {}, error: null }),
      });

      mockServerSupabase.from.mockImplementation((table: string) => {
        if (table === 'order_insurance_policies') {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: 'local-1',
                      status: 'active',
                      claim_status: 'pending',
                      claim_stage: 'Pending',
                      claim_progress: 'webhook-progress',
                      claim_comment: 'Webhook decline/offer detail',
                      claim_id: 'claim-1',
                    },
                    error: null,
                  }),
              }),
            }),
            update: updateSpy,
          };
        }
        return {};
      });

      await syncClaimsStatus();

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          claim_status: 'approved',
          claim_progress: 'webhook-progress',
          claim_comment: 'Webhook decline/offer detail',
        })
      );
    });

    it('persists a newly discovered MyCover claim id even when visible status fields are unchanged', async () => {
      const claims = [
        {
          id: 'claim-new',
          policy_id: 'policy-1',
          claim_status: 'Offer sent',
          progress: 'offer',
          comment: 'Review the offer',
        },
      ];
      mockGetClaims.mockResolvedValue({ claims });

      const updateSpy = vi.fn().mockReturnValue({
        eq: () => Promise.resolve({ data: {}, error: null }),
      });

      mockServerSupabase.from.mockImplementation((table: string) => {
        if (table === 'order_insurance_policies') {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: 'local-1',
                      status: 'active',
                      claim_status: 'offer_sent',
                      claim_stage: 'Offer sent',
                      claim_progress: 'offer',
                      claim_comment: 'Review the offer',
                      claim_id: null,
                    },
                    error: null,
                  }),
              }),
            }),
            update: updateSpy,
          };
        }
        return {};
      });

      await syncClaimsStatus();

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          claim_id: 'claim-new',
        })
      );
    });
  });
});
