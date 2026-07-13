import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShippingZoneLocationOverlapError } from './shipping-errors';

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

const { listShippingConfig, upsertZone, deleteZone } = await import(
  './actions'
);

/** A chainable query-builder mock: every method returns itself except the
 * terminal ones, which resolve to `result`. Matches how supabase-js query
 * builders are thenable at any point in the chain. */
function createQueryMock(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of [
    'select',
    'eq',
    'neq',
    'order',
    'in',
    'insert',
    'update',
    'delete',
    'returns',
  ]) {
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
const merchant = {
  merchant: { id: 'merchant-1', country: 'NG', payout_currency: 'NGN' },
};
const ROW_ZONE_ID = '11111111-1111-4111-8111-111111111111';
const FOREIGN_ZONE_ID = '22222222-2222-4222-8222-222222222222';

describe('listShippingConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(authedUser);
  });

  it('rejects unauthenticated callers before resolving permissions', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    mockCreateClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: vi.fn(),
    });

    await expect(listShippingConfig()).rejects.toThrow('Unauthorized');
    expect(mockEnsurePermission).not.toHaveBeenCalled();
  });

  it('loads zones, locations, and rates scoped to the merchant', async () => {
    mockEnsurePermission.mockResolvedValue(merchant);

    const zonesQuery = createQueryMock({
      data: [
        { id: 'z-1', name: 'Lagos', is_rest_of_world: false, active: true },
      ],
      error: null,
    });
    const locationsQuery = createQueryMock({
      data: [{ zone_id: 'z-1', country_code: 'NG', subdivision_code: 'NG-LA' }],
      error: null,
    });
    const ratesQuery = createQueryMock({
      data: [
        {
          id: 'r-1',
          zone_id: 'z-1',
          name: 'Standard',
          kind: 'ship',
          currency: 'NGN',
          base_amount: 1500,
          condition_type: 'always',
          min_subtotal: null,
          max_subtotal: null,
          free_over_amount: null,
          delivery_min_days: null,
          delivery_max_days: null,
          pickup_address: null,
          sort_order: 0,
          active: true,
        },
      ],
      error: null,
    });

    const fromMock = vi.fn((table: string) => {
      if (table === 'merchant_shipping_zones') return zonesQuery;
      if (table === 'merchant_shipping_zone_locations') return locationsQuery;
      return ratesQuery;
    });
    mockCreateClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: fromMock,
    });

    const result = await listShippingConfig();

    expect(zonesQuery.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(ratesQuery.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(result.currencyCode).toBe('NGN');
    expect(result.zones).toHaveLength(1);
    expect(result.zones[0].locations).toEqual([
      { countryCode: 'NG', subdivisionCode: 'NG-LA' },
    ]);
    expect(result.rates).toHaveLength(1);
  });

  it('skips the locations query when the merchant has no zones', async () => {
    mockEnsurePermission.mockResolvedValue(merchant);
    const zonesQuery = createQueryMock({ data: [], error: null });
    const ratesQuery = createQueryMock({ data: [], error: null });
    const fromMock = vi.fn((table: string) => {
      if (table === 'merchant_shipping_zones') return zonesQuery;
      if (table === 'merchant_shipping_rates') return ratesQuery;
      throw new Error(`unexpected table ${table}`);
    });
    mockCreateClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: fromMock,
    });

    const result = await listShippingConfig();

    expect(result.zones).toEqual([]);
    expect(result.rates).toEqual([]);
  });
});

describe('upsertZone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(authedUser);
    mockEnsurePermission.mockResolvedValue(merchant);
  });

  it('creates a new zone with locations, scoped to the merchant', async () => {
    const insertQuery = createQueryMock({ data: { id: 'z-new' }, error: null });
    const locationsQuery = createQueryMock({ data: null, error: null });
    const fromMock = vi.fn((table: string) => {
      if (table === 'merchant_shipping_zones') return insertQuery;
      return locationsQuery;
    });
    mockCreateClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: fromMock,
    });

    const result = await upsertZone({
      name: 'Lagos',
      locations: [{ countryCode: 'NG', subdivisionCode: 'NG-LA' }],
    });

    expect(result).toEqual({ success: true, zoneId: 'z-new' });
    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({ merchant_id: 'merchant-1', name: 'Lagos' })
    );
    expect(locationsQuery.delete).toHaveBeenCalled();
    expect(locationsQuery.insert).toHaveBeenCalledWith([
      { zone_id: 'z-new', country_code: 'NG', subdivision_code: 'NG-LA' },
    ]);
  });

  it('rolls back the newly-created zone when the location insert fails', async () => {
    // The create path has no transaction spanning the zone insert + location
    // replace, and a new zone has no prior rows for replaceZoneLocations to
    // snapshot-restore. If the location insert fails (e.g. the DB no-overlap
    // unique index catches a concurrent save that slipped past the pre-check),
    // the just-created zone must be deleted so no orphan zone remains.
    const zoneInsertQuery = createQueryMock({
      data: { id: 'z-new' },
      error: null,
    });
    const zoneDeleteQuery = createQueryMock({ data: null, error: null });
    const zoneQueue = [zoneInsertQuery, zoneDeleteQuery];

    const overlapQuery = createQueryMock({ data: [], error: null });
    const snapshotQuery = createQueryMock({ data: [], error: null });
    const deleteLocationsQuery = createQueryMock({ data: null, error: null });
    const insertLocationsQuery = createQueryMock({
      data: null,
      error: {
        message:
          'duplicate key value violates unique constraint "uq_merchant_shipping_zone_locations_no_overlap"',
      },
    });
    const locationQueue = [
      overlapQuery,
      snapshotQuery,
      deleteLocationsQuery,
      insertLocationsQuery,
    ];

    const fromMock = vi.fn((table: string) => {
      if (table === 'merchant_shipping_zones') {
        return zoneQueue.shift() ?? zoneDeleteQuery;
      }
      return locationQueue.shift() ?? insertLocationsQuery;
    });
    mockCreateClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: fromMock,
    });

    await expect(
      upsertZone({
        name: 'Lagos',
        locations: [{ countryCode: 'NG', subdivisionCode: 'NG-LA' }],
      })
    ).rejects.toThrow(/uq_merchant_shipping_zone_locations_no_overlap/);

    // Compensating delete of the orphan zone, scoped to its id.
    expect(zoneDeleteQuery.delete).toHaveBeenCalled();
    expect(zoneDeleteQuery.eq).toHaveBeenCalledWith('id', 'z-new');
    // The insert row (not the rollback row) is never deleted.
    expect(zoneInsertQuery.delete).not.toHaveBeenCalled();
  });

  it('rejects attaching locations to the rest-of-world zone', async () => {
    const zoneQuery = createQueryMock({
      data: { id: ROW_ZONE_ID, is_rest_of_world: true },
      error: null,
    });
    mockCreateClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: vi.fn(() => zoneQuery),
    });

    await expect(
      upsertZone({
        id: ROW_ZONE_ID,
        name: 'Everywhere else',
        locations: [{ countryCode: 'NG', subdivisionCode: null }],
      })
    ).rejects.toThrow(/cannot have specific locations/);

    expect(zoneQuery.update).not.toHaveBeenCalled();
  });

  it('allows renaming the rest-of-world zone when locations stay empty', async () => {
    const zoneQuery = createQueryMock({
      data: { id: ROW_ZONE_ID, is_rest_of_world: true },
      error: null,
    });
    mockCreateClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: vi.fn(() => zoneQuery),
    });

    const result = await upsertZone({
      id: ROW_ZONE_ID,
      name: 'Everywhere else, renamed',
      locations: [],
    });

    expect(result).toEqual({ success: true, zoneId: ROW_ZONE_ID });
    expect(zoneQuery.update).toHaveBeenCalledWith({
      name: 'Everywhere else, renamed',
    });
  });

  it('throws when the zone does not belong to the merchant', async () => {
    const zoneQuery = createQueryMock({ data: null, error: null });
    mockCreateClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: vi.fn(() => zoneQuery),
    });

    await expect(
      upsertZone({ id: FOREIGN_ZONE_ID, name: 'Nope', locations: [] })
    ).rejects.toThrow('Zone not found');
  });

  it('rejects a save that duplicates another zone location and skips the update', async () => {
    const zoneQuery = createQueryMock({
      data: { id: ROW_ZONE_ID, is_rest_of_world: false },
      error: null,
    });
    const overlapQuery = createQueryMock({
      data: [
        {
          country_code: 'NG',
          subdivision_code: 'NG-LA',
          merchant_shipping_zones: { id: FOREIGN_ZONE_ID, name: 'Lagos' },
        },
      ],
      error: null,
    });
    mockCreateClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: vi.fn((table: string) =>
        table === 'merchant_shipping_zones' ? zoneQuery : overlapQuery
      ),
    });

    await expect(
      upsertZone({
        id: ROW_ZONE_ID,
        name: 'Lagos copy',
        locations: [{ countryCode: 'NG', subdivisionCode: 'NG-LA' }],
      })
    ).rejects.toBeInstanceOf(ShippingZoneLocationOverlapError);

    expect(zoneQuery.update).not.toHaveBeenCalled();
  });

  it('allows layering a subdivision under another zone country-wide row', async () => {
    const zoneQuery = createQueryMock({
      data: { id: ROW_ZONE_ID, is_rest_of_world: false },
      error: null,
    });
    // Another zone only covers NG country-wide, so an NG-LA subdivision here is
    // legitimate most-specific-wins layering, not a conflict.
    const locationsQuery = createQueryMock({
      data: [
        {
          country_code: 'NG',
          subdivision_code: null,
          merchant_shipping_zones: { id: FOREIGN_ZONE_ID, name: 'Nationwide' },
        },
      ],
      error: null,
    });
    mockCreateClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: vi.fn((table: string) =>
        table === 'merchant_shipping_zones' ? zoneQuery : locationsQuery
      ),
    });

    const result = await upsertZone({
      id: ROW_ZONE_ID,
      name: 'Lagos',
      locations: [{ countryCode: 'NG', subdivisionCode: 'NG-LA' }],
    });

    expect(result).toEqual({ success: true, zoneId: ROW_ZONE_ID });
    expect(zoneQuery.update).toHaveBeenCalledWith({ name: 'Lagos' });
    expect(locationsQuery.insert).toHaveBeenCalledWith([
      { zone_id: ROW_ZONE_ID, country_code: 'NG', subdivision_code: 'NG-LA' },
    ]);
  });
});

describe('deleteZone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(authedUser);
    mockEnsurePermission.mockResolvedValue(merchant);
  });

  it('refuses to delete the rest-of-world zone', async () => {
    const zoneId = '11111111-1111-4111-8111-111111111111';
    const zoneQuery = createQueryMock({
      data: { id: zoneId, is_rest_of_world: true },
      error: null,
    });
    mockCreateClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: vi.fn(() => zoneQuery),
    });

    await expect(deleteZone(zoneId)).rejects.toThrow(/cannot be deleted/);
    expect(zoneQuery.delete).not.toHaveBeenCalled();
  });

  it('deletes a non-rest-of-world zone scoped to the merchant', async () => {
    const zoneId = '11111111-1111-4111-8111-111111111111';
    const zoneQuery = createQueryMock({
      data: { id: zoneId, is_rest_of_world: false },
      error: null,
    });
    mockCreateClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: vi.fn(() => zoneQuery),
    });

    const result = await deleteZone(zoneId);

    expect(result).toEqual({ success: true });
    expect(zoneQuery.delete).toHaveBeenCalled();
    expect(zoneQuery.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
  });
});
