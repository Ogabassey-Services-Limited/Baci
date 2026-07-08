import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyRepairStatusChange } from './notify-repair-status-change';

const mocks = vi.hoisted(() => ({
  getCachedMerchantById: vi.fn(),
  notifyCustomer: vi.fn(),
  sendEmail: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedMerchantById: mocks.getCachedMerchantById,
}));

vi.mock('@/lib/expo-push', () => ({
  notifyCustomer: mocks.notifyCustomer,
}));

vi.mock('@/lib/zeptomail', () => ({
  sendEmail: mocks.sendEmail,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          ilike: () => ({
            not: () => ({
              limit: () => ({ maybeSingle: mocks.maybeSingle }),
            }),
          }),
        }),
      }),
    }),
  }),
}));

const params = {
  merchantId: 'm-1',
  repairId: 'r-1',
  ticketNumber: 1042,
  customerName: 'Ada Lovelace',
  customerEmail: 'ada@example.com',
  deviceLabel: 'Smartphone iPhone 15',
  status: 'completed' as const,
};

describe('notifyRepairStatusChange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCachedMerchantById.mockResolvedValue({
      business_name: 'Ogabassey',
    });
    mocks.sendEmail.mockResolvedValue({ success: true });
    mocks.notifyCustomer.mockResolvedValue({ sent: 1, failed: 0, errors: [] });
  });

  it('emails the customer and pushes when a customer account is found', async () => {
    mocks.maybeSingle.mockResolvedValueOnce({
      data: { user_id: 'user-1' },
      error: null,
    });

    await notifyRepairStatusChange(params);

    expect(mocks.notifyCustomer).toHaveBeenCalledWith(
      'user-1',
      'Repair Completed',
      'Smartphone iPhone 15 (Ticket #1042)',
      { type: 'repair', repair_id: 'r-1' },
      'orders'
    );
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'ada@example.com', emailType: 'orders' })
    );
  });

  it('still emails when there is no linked customer account', async () => {
    mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await notifyRepairStatusChange(params);

    expect(mocks.notifyCustomer).not.toHaveBeenCalled();
    expect(mocks.sendEmail).toHaveBeenCalled();
  });

  it('never throws when the email send fails', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      // biome-ignore lint/suspicious/noEmptyBlockStatements: suppress expected test logging
      .mockImplementation(() => {});
    mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mocks.sendEmail.mockRejectedValueOnce(new Error('smtp down'));

    try {
      await expect(notifyRepairStatusChange(params)).resolves.toBeUndefined();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('never throws when the push send fails', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      // biome-ignore lint/suspicious/noEmptyBlockStatements: suppress expected test logging
      .mockImplementation(() => {});
    mocks.maybeSingle.mockResolvedValueOnce({
      data: { user_id: 'user-1' },
      error: null,
    });
    mocks.notifyCustomer.mockRejectedValueOnce(new Error('expo down'));

    try {
      await expect(notifyRepairStatusChange(params)).resolves.toBeUndefined();
      expect(mocks.sendEmail).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
