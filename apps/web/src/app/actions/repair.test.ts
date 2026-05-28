import { revalidatePath } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RepairBookingInput } from '@/lib/validations/repair';
import { createRepair } from './repair';

const mocks = vi.hoisted(() => {
  const insert = vi.fn();
  const from = vi.fn(() => ({ insert }));

  return {
    cookies: vi.fn(),
    createClient: vi.fn(() => ({ from })),
    from,
    insert,
  };
});

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

vi.mock('@/lib/shipping/providers/topship', () => ({
  topshipProvider: {
    getQuotes: vi.fn(),
  },
}));

const preferredDate = '2026-06-03';

const validRepairInput: RepairBookingInput = {
  customerName: 'Ada Lovelace',
  customerEmail: 'ada@example.com',
  customerPhone: '08012345678',
  deviceType: 'Smartphone',
  deviceModel: 'iPhone 15',
  issueDescription: 'The screen is cracked and the battery drains quickly.',
  preferredDate,
  serviceType: 'dropoff',
};

describe('createRepair', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({ get: vi.fn() });
    mocks.insert.mockResolvedValue({ error: null });
  });

  it('creates a repair with an app-generated id without requesting returned rows', async () => {
    const merchantId = '123e4567-e89b-12d3-a456-426614174000';

    const result = await createRepair(validRepairInput, merchantId);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected repair creation to succeed');

    expect(result.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(mocks.from).toHaveBeenCalledWith('repairs');
    expect(mocks.insert).toHaveBeenCalledWith({
      id: result.id,
      merchant_id: merchantId,
      customer_name: validRepairInput.customerName,
      customer_email: validRepairInput.customerEmail,
      customer_phone: validRepairInput.customerPhone,
      device_type: validRepairInput.deviceType,
      device_model: validRepairInput.deviceModel,
      issue_description: validRepairInput.issueDescription,
      preferred_date: new Date(preferredDate).toISOString(),
      service_type: validRepairInput.serviceType,
      pickup_address: null,
      status: 'pending',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/repairs');
  });

  it('returns validation errors without inserting invalid repair data', async () => {
    const result = await createRepair(
      {
        ...validRepairInput,
        issueDescription: 'short',
      },
      '123e4567-e89b-12d3-a456-426614174000'
    );

    expect(result.success).toBe(false);
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a friendly error when the repair insert fails', async () => {
    mocks.insert.mockResolvedValueOnce({
      error: { message: 'new row violates row-level security policy' },
    });

    const result = await createRepair(
      validRepairInput,
      '123e4567-e89b-12d3-a456-426614174000'
    );

    expect(result).toEqual({
      success: false,
      error: 'Failed to submit repair request. Please try again.',
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
