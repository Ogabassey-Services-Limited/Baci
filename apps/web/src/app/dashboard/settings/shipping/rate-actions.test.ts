import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEnsurePermission = vi.fn();
const mockCreateClient = vi.fn();
const mockGetUser = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/merchant-server', () => ({
  ensurePermission: (...args: unknown[]) => mockEnsurePermission(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

const { upsertRate, deleteRate, toggleRateActive } = await import(
  './rate-actions'
);

function createQueryMock(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'insert', 'update', 'delete']) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  builder.single = vi.fn().mockResolvedValue(result);
  // biome-ignore lint/suspicious/noThenProperty: mirrors supabase-js query builders, thenable at any point in the chain.
  builder.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return builder;
}

const authedUser = { data: { user: { id: 'user-1' } }, error: null };
// Indian merchant: proves the server-stamped currency wins over any
// client-submitted value, since the form schema has no currency field at all.
const merchant = {
  merchant: { id: 'merchant-1', country: 'IN', payout_currency: 'INR' },
};
const ZONE_ID = '11111111-1111-4111-8111-111111111111';
const RATE_ID = '22222222-2222-4222-8222-222222222222';

const baseRateInput = {
  zoneId: ZONE_ID,
  name: 'Standard',
  kind: 'ship' as const,
  baseAmount: 500,
  conditionType: 'always' as const,
};

describe('upsertRate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(authedUser);
    mockEnsurePermission.mockResolvedValue(merchant);
  });

  it('rejects unauthenticated callers before resolving permissions', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    mockCreateClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: vi.fn(),
    });

    await expect(upsertRate(baseRateInput)).rejects.toThrow('Unauthorized');
    expect(mockEnsurePermission).not.toHaveBeenCalled();
  });

  it('stamps the merchant-resolved currency, ignoring any client value', async () => {
    const zoneQuery = createQueryMock({ data: { id: ZONE_ID }, error: null });
    const insertQuery = createQueryMock({ data: { id: RATE_ID }, error: null });
    const fromMock = vi.fn((table: string) => {
      if (table === 'merchant_shipping_zones') return zoneQuery;
      return insertQuery;
    });
    mockCreateClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: fromMock,
    });

    // A tampered client payload smuggling a `currency` field — the schema
    // strips unknown keys, but this also proves the server never reads it.
    const result = await upsertRate({ ...baseRateInput, currency: 'USD' });

    expect(result).toEqual({ success: true, rateId: RATE_ID });
    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'INR', merchant_id: 'merchant-1' })
    );
  });

  it('rejects a rate for a zone that does not belong to the merchant', async () => {
    const zoneQuery = createQueryMock({ data: null, error: null });
    mockCreateClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: vi.fn(() => zoneQuery),
    });

    await expect(upsertRate(baseRateInput)).rejects.toThrow('Zone not found');
  });

  it('updates an existing rate scoped to the merchant', async () => {
    const zoneQuery = createQueryMock({ data: { id: ZONE_ID }, error: null });
    const updateQuery = createQueryMock({
      data: { id: RATE_ID },
      error: null,
    });
    const fromMock = vi.fn((table: string) => {
      if (table === 'merchant_shipping_zones') return zoneQuery;
      return updateQuery;
    });
    mockCreateClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: fromMock,
    });

    const result = await upsertRate({ ...baseRateInput, id: RATE_ID });

    expect(result).toEqual({ success: true, rateId: RATE_ID });
    expect(updateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'INR' })
    );
    expect(updateQuery.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
  });

  it('throws when updating a rate that matches no row (stale or cross-merchant id)', async () => {
    const zoneQuery = createQueryMock({ data: { id: ZONE_ID }, error: null });
    // The update filters out to zero rows, so the query returns no row.
    const updateQuery = createQueryMock({ data: null, error: null });
    const fromMock = vi.fn((table: string) => {
      if (table === 'merchant_shipping_zones') return zoneQuery;
      return updateQuery;
    });
    mockCreateClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: fromMock,
    });

    await expect(upsertRate({ ...baseRateInput, id: RATE_ID })).rejects.toThrow(
      'Rate not found'
    );
  });

  it('rejects a tier rate whose max is not greater than min', async () => {
    await expect(
      upsertRate({
        ...baseRateInput,
        conditionType: 'price_tier',
        minSubtotal: 100,
        maxSubtotal: 100,
      })
    ).rejects.toThrow();
    expect(mockEnsurePermission).not.toHaveBeenCalled();
  });

  it('rejects a pickup rate with no pickup address', async () => {
    await expect(
      upsertRate({ ...baseRateInput, kind: 'pickup' })
    ).rejects.toThrow();
    expect(mockEnsurePermission).not.toHaveBeenCalled();
  });
});

describe('deleteRate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(authedUser);
    mockEnsurePermission.mockResolvedValue(merchant);
  });

  it('deletes a rate scoped to the merchant', async () => {
    const deleteQuery = createQueryMock({
      data: { id: RATE_ID },
      error: null,
    });
    mockCreateClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: vi.fn(() => deleteQuery),
    });

    const result = await deleteRate(RATE_ID);

    expect(result).toEqual({ success: true });
    expect(deleteQuery.delete).toHaveBeenCalled();
    expect(deleteQuery.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
  });

  it('throws when deleting a rate that matches no row (stale or cross-merchant id)', async () => {
    // The delete filters out to zero rows, so the query returns no row.
    const deleteQuery = createQueryMock({ data: null, error: null });
    mockCreateClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: vi.fn(() => deleteQuery),
    });

    await expect(deleteRate(RATE_ID)).rejects.toThrow('Rate not found');
  });

  it('propagates a database error', async () => {
    const deleteQuery = createQueryMock({
      data: null,
      error: { message: 'db exploded' },
    });
    mockCreateClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: vi.fn(() => deleteQuery),
    });

    await expect(deleteRate(RATE_ID)).rejects.toThrow('db exploded');
  });
});

describe('toggleRateActive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(authedUser);
    mockEnsurePermission.mockResolvedValue(merchant);
  });

  it('updates the active flag scoped to the merchant', async () => {
    const updateQuery = createQueryMock({
      data: { id: RATE_ID },
      error: null,
    });
    mockCreateClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: vi.fn(() => updateQuery),
    });

    const result = await toggleRateActive(RATE_ID, false);

    expect(result).toEqual({ success: true });
    expect(updateQuery.update).toHaveBeenCalledWith({ active: false });
    expect(updateQuery.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
  });

  it('throws when toggling a rate that matches no row (stale or cross-merchant id)', async () => {
    // The update filters out to zero rows, so the query returns no row.
    const updateQuery = createQueryMock({ data: null, error: null });
    mockCreateClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: vi.fn(() => updateQuery),
    });

    await expect(toggleRateActive(RATE_ID, false)).rejects.toThrow(
      'Rate not found'
    );
  });
});
