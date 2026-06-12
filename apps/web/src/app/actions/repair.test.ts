import { revalidatePath } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RepairBookingInput } from '@/lib/validations/repair';
import { calculateRepairShipping, createRepair } from './repair';

const mocks = vi.hoisted(() => {
  const insert = vi.fn();
  const maybeSingle = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn((table: string) =>
    table === 'merchants' ? { select } : { insert }
  );

  return {
    cookies: vi.fn(),
    createClient: vi.fn(() => ({ from })),
    ensureActionRateLimit: vi.fn(),
    eq,
    from,
    getQuotes: vi.fn(),
    insert,
    maybeSingle,
    select,
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

vi.mock('@/lib/ensure-action-rate-limit', () => ({
  ensureActionRateLimit: mocks.ensureActionRateLimit,
}));

vi.mock('@/lib/shipping/providers/topship', () => ({
  topshipProvider: {
    getQuotes: mocks.getQuotes,
  },
}));

const preferredDate = '2026-06-03';
const merchantId = '123e4567-e89b-12d3-a456-426614174000';

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
    mocks.ensureActionRateLimit.mockResolvedValue(true);
    mocks.cookies.mockResolvedValue({ get: vi.fn() });
    mocks.maybeSingle.mockResolvedValue({
      data: { id: merchantId },
      error: null,
    });
    mocks.insert.mockResolvedValue({ error: null });
  });

  it('creates a repair with an app-generated id without requesting returned rows', async () => {
    const result = await createRepair(validRepairInput, merchantId);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected repair creation to succeed');

    expect(mocks.ensureActionRateLimit).toHaveBeenCalledWith('repair-create', {
      requests: 5,
      windowMs: 60_000,
    });
    expect(result.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(mocks.from).toHaveBeenCalledWith('merchants');
    expect(mocks.eq).toHaveBeenCalledWith('id', merchantId);
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

  it('returns a rate-limit error without touching the database when the budget is exhausted', async () => {
    mocks.ensureActionRateLimit.mockResolvedValueOnce(false);

    const result = await createRepair(validRepairInput, merchantId);

    expect(result).toEqual({
      success: false,
      error: 'Too many repair requests. Please try again in a minute.',
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects non-uuid merchant ids without inserting', async () => {
    const result = await createRepair(validRepairInput, 'not-a-uuid');

    expect(result).toEqual({
      success: false,
      error: 'Invalid store reference.',
    });
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a store-not-found error when the merchant does not exist', async () => {
    mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await createRepair(validRepairInput, merchantId);

    expect(result).toEqual({ success: false, error: 'Store not found.' });
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns validation errors without inserting invalid repair data', async () => {
    const result = await createRepair(
      {
        ...validRepairInput,
        issueDescription: 'short',
      },
      merchantId
    );

    expect(result.success).toBe(false);
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a friendly error when the repair insert fails', async () => {
    mocks.insert.mockResolvedValueOnce({
      error: { message: 'new row violates row-level security policy' },
    });

    const result = await createRepair(validRepairInput, merchantId);

    expect(result).toEqual({
      success: false,
      error: 'Failed to submit repair request. Please try again.',
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('calculateRepairShipping', () => {
  const validPlace = {
    streetNumber: '12',
    route: 'Aba Road',
    city: 'Port Harcourt',
    state: 'Rivers',
    zip: '500001',
    country: 'Nigeria',
    formattedAddress: '12 Aba Road, Port Harcourt, Rivers, Nigeria',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureActionRateLimit.mockResolvedValue(true);
  });

  it('returns a rate-limit error without requesting Topship quotes', async () => {
    mocks.ensureActionRateLimit.mockResolvedValueOnce(false);

    const result = await calculateRepairShipping(validPlace);

    expect(mocks.ensureActionRateLimit).toHaveBeenCalledWith(
      'repair-shipping',
      { requests: 10, windowMs: 60_000 }
    );
    expect(result).toEqual({
      isFree: false,
      price: 0,
      formattedPrice: 'Calculated at confirmation',
      error: 'Too many shipping estimates. Please try again shortly.',
    });
    expect(mocks.getQuotes).not.toHaveBeenCalled();
  });

  it('rejects invalid place details without requesting Topship quotes', async () => {
    const result = await calculateRepairShipping({
      ...validPlace,
      formattedAddress: 'a'.repeat(501),
    });

    expect(result).toEqual({
      isFree: false,
      price: 0,
      formattedPrice: 'Calculated at confirmation',
      error: 'Invalid address details',
    });
    expect(mocks.getQuotes).not.toHaveBeenCalled();
  });

  it('rejects incomplete place details without requesting Topship quotes', async () => {
    const result = await calculateRepairShipping({
      ...validPlace,
      city: '',
      state: '',
    });

    expect(result).toEqual({
      isFree: false,
      price: 0,
      formattedPrice: 'Calculated at confirmation',
      error: 'Invalid address details',
    });
    expect(mocks.getQuotes).not.toHaveBeenCalled();
  });

  it('offers free pickup for Lagos addresses without quoting', async () => {
    const result = await calculateRepairShipping({
      ...validPlace,
      city: 'Ikeja',
      state: 'Lagos',
      formattedAddress: '3 Olayeni Street, Ikeja, Lagos, Nigeria',
    });

    expect(result).toEqual({
      isFree: true,
      price: 0,
      formattedPrice: 'Free',
      message: 'Free pickup available in Lagos!',
    });
    expect(mocks.getQuotes).not.toHaveBeenCalled();
  });

  it('returns the cheapest valid Topship quote for non-Lagos addresses', async () => {
    mocks.getQuotes.mockResolvedValueOnce([
      { price: 5000 },
      { price: 3000 },
      { price: 0 },
    ]);

    const result = await calculateRepairShipping(validPlace);

    expect(result.isFree).toBe(false);
    expect(result.price).toBe(3000);
    expect(result.error).toBeUndefined();
  });

  it('falls back to a friendly error when quoting fails', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      // biome-ignore lint/suspicious/noEmptyBlockStatements: suppress expected test logging
      .mockImplementation(() => {});
    mocks.getQuotes.mockRejectedValueOnce(new Error('topship down'));

    try {
      const result = await calculateRepairShipping(validPlace);

      expect(result).toEqual({
        isFree: false,
        price: 0,
        formattedPrice: 'Calculated at confirmation',
        error: 'Failed to calculate shipping',
      });
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
