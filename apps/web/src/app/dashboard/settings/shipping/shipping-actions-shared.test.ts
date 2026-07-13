import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ShippingZoneLocationOverlapError,
  ZoneLocationReplaceError,
} from './shipping-errors';

const mockCreateClient = vi.fn();
const mockGetUser = vi.fn();
const mockLoggerError = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

const {
  assertNoCrossZoneLocationOverlap,
  requireAuthenticatedSupabase,
  replaceZoneLocations,
  SHIPPING_SETTINGS_PATH,
  ZONE_ROW_COLUMNS,
  LOCATION_ROW_COLUMNS,
  RATE_ROW_COLUMNS,
} = await import('./shipping-actions-shared');

/** A chainable query-builder mock matching the supabase-js shape used here. */
function createQueryMock(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'delete', 'eq', 'neq', 'insert', 'returns']) {
    builder[method] = vi.fn(() => builder);
  }
  // biome-ignore lint/suspicious/noThenProperty: mirrors supabase-js query builders, thenable at any point in the chain.
  builder.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return builder;
}

describe('requireAuthenticatedSupabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the supabase client for an authenticated user', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    const supabase = { auth: { getUser: mockGetUser } };
    mockCreateClient.mockReturnValue(supabase);

    const result = await requireAuthenticatedSupabase();

    expect(result).toBe(supabase);
  });

  it('throws Unauthorized when there is no authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockCreateClient.mockReturnValue({ auth: { getUser: mockGetUser } });

    await expect(requireAuthenticatedSupabase()).rejects.toThrow(
      'Unauthorized'
    );
  });

  it('throws Unauthorized when the auth lookup itself errors', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'session expired' },
    });
    mockCreateClient.mockReturnValue({ auth: { getUser: mockGetUser } });

    await expect(requireAuthenticatedSupabase()).rejects.toThrow(
      'Unauthorized'
    );
  });
});

describe('replaceZoneLocations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('snapshots, deletes the existing set, then inserts the new locations', async () => {
    const snapshotQuery = createQueryMock({ data: [], error: null });
    const deleteQuery = createQueryMock({ data: null, error: null });
    const insertQuery = createQueryMock({ data: null, error: null });
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(snapshotQuery)
      .mockReturnValueOnce(deleteQuery)
      .mockReturnValueOnce(insertQuery);
    const supabase = { from: fromMock };

    await replaceZoneLocations(supabase as never, 'zone-1', [
      { countryCode: 'NG', subdivisionCode: 'NG-LA' },
    ]);

    expect(snapshotQuery.select).toHaveBeenCalled();
    expect(snapshotQuery.eq).toHaveBeenCalledWith('zone_id', 'zone-1');
    expect(deleteQuery.delete).toHaveBeenCalled();
    expect(deleteQuery.eq).toHaveBeenCalledWith('zone_id', 'zone-1');
    expect(insertQuery.insert).toHaveBeenCalledWith([
      { zone_id: 'zone-1', country_code: 'NG', subdivision_code: 'NG-LA' },
    ]);
  });

  it('skips the insert call entirely when there are no locations', async () => {
    const snapshotQuery = createQueryMock({ data: [], error: null });
    const deleteQuery = createQueryMock({ data: null, error: null });
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(snapshotQuery)
      .mockReturnValueOnce(deleteQuery);
    const supabase = { from: fromMock };

    await replaceZoneLocations(supabase as never, 'zone-1', []);

    expect(deleteQuery.delete).toHaveBeenCalled();
    // Only the snapshot read and the delete — no insert.
    expect(fromMock).toHaveBeenCalledTimes(2);
  });

  it('throws when the snapshot read fails', async () => {
    const snapshotQuery = createQueryMock({
      data: null,
      error: { message: 'snapshot failed' },
    });
    const supabase = { from: vi.fn().mockReturnValue(snapshotQuery) };

    await expect(
      replaceZoneLocations(supabase as never, 'zone-1', [])
    ).rejects.toThrow('snapshot failed');
  });

  it('throws when the delete fails', async () => {
    const snapshotQuery = createQueryMock({ data: [], error: null });
    const deleteQuery = createQueryMock({
      data: null,
      error: { message: 'delete failed' },
    });
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(snapshotQuery)
      .mockReturnValueOnce(deleteQuery);
    const supabase = { from: fromMock };

    await expect(
      replaceZoneLocations(supabase as never, 'zone-1', [])
    ).rejects.toThrow('delete failed');
  });

  it('restores the prior rows and throws a retained-data error when the insert fails', async () => {
    const priorRows = [
      { zone_id: 'zone-1', country_code: 'NG', subdivision_code: 'NG-LA' },
    ];
    const snapshotQuery = createQueryMock({ data: priorRows, error: null });
    const deleteQuery = createQueryMock({ data: null, error: null });
    const insertQuery = createQueryMock({
      data: null,
      error: { message: 'insert failed' },
    });
    const restoreQuery = createQueryMock({ data: null, error: null });
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(snapshotQuery)
      .mockReturnValueOnce(deleteQuery)
      .mockReturnValueOnce(insertQuery)
      .mockReturnValueOnce(restoreQuery);
    const supabase = { from: fromMock };

    const error = await replaceZoneLocations(supabase as never, 'zone-1', [
      { countryCode: 'NG', subdivisionCode: null },
    ]).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ZoneLocationReplaceError);
    expect((error as ZoneLocationReplaceError).dataRetained).toBe(true);
    // The snapshot rows are re-inserted so the zone is not left empty.
    expect(restoreQuery.insert).toHaveBeenCalledWith(priorRows);
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it('logs and throws a data-loss error when even the restore fails', async () => {
    const priorRows = [
      { zone_id: 'zone-1', country_code: 'NG', subdivision_code: 'NG-LA' },
    ];
    const snapshotQuery = createQueryMock({ data: priorRows, error: null });
    const deleteQuery = createQueryMock({ data: null, error: null });
    const insertQuery = createQueryMock({
      data: null,
      error: { message: 'insert failed' },
    });
    const restoreQuery = createQueryMock({
      data: null,
      error: { message: 'restore failed' },
    });
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(snapshotQuery)
      .mockReturnValueOnce(deleteQuery)
      .mockReturnValueOnce(insertQuery)
      .mockReturnValueOnce(restoreQuery);
    const supabase = { from: fromMock };

    const error = await replaceZoneLocations(supabase as never, 'zone-1', [
      { countryCode: 'NG', subdivisionCode: null },
    ]).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ZoneLocationReplaceError);
    expect((error as ZoneLocationReplaceError).dataRetained).toBe(false);
    expect(mockLoggerError).toHaveBeenCalledTimes(1);
  });

  it('throws the raw insert error when there were no prior rows to restore', async () => {
    const snapshotQuery = createQueryMock({ data: [], error: null });
    const deleteQuery = createQueryMock({ data: null, error: null });
    const insertQuery = createQueryMock({
      data: null,
      error: { message: 'insert failed' },
    });
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(snapshotQuery)
      .mockReturnValueOnce(deleteQuery)
      .mockReturnValueOnce(insertQuery);
    const supabase = { from: fromMock };

    await expect(
      replaceZoneLocations(supabase as never, 'zone-1', [
        { countryCode: 'NG', subdivisionCode: null },
      ])
    ).rejects.toThrow('insert failed');
    // No restore attempt — the zone started empty, so nothing was lost.
    expect(fromMock).toHaveBeenCalledTimes(3);
  });
});

describe('assertNoCrossZoneLocationOverlap', () => {
  it('does not query when there are no submitted locations', async () => {
    const fromMock = vi.fn();
    const supabase = { from: fromMock };

    await assertNoCrossZoneLocationOverlap({
      supabase: supabase as never,
      merchantId: 'merchant-1',
      excludeZoneId: null,
      locations: [],
    });

    expect(fromMock).not.toHaveBeenCalled();
  });

  it('allows a subdivision that layers under another zone country-wide row', async () => {
    const query = createQueryMock({
      data: [
        {
          country_code: 'NG',
          subdivision_code: null,
          merchant_shipping_zones: { id: 'z-nationwide', name: 'Nationwide' },
        },
      ],
      error: null,
    });
    const supabase = { from: vi.fn().mockReturnValue(query) };

    // NG (country-wide) vs. NG-LA (subdivision) is intended layering, not a clash.
    await expect(
      assertNoCrossZoneLocationOverlap({
        supabase: supabase as never,
        merchantId: 'merchant-1',
        excludeZoneId: null,
        locations: [{ countryCode: 'NG', subdivisionCode: 'NG-LA' }],
      })
    ).resolves.toBeUndefined();
  });

  it('rejects duplicate country-wide coverage across zones and names the conflict', async () => {
    const query = createQueryMock({
      data: [
        {
          country_code: 'NG',
          subdivision_code: null,
          merchant_shipping_zones: { id: 'z-nationwide', name: 'Nationwide' },
        },
      ],
      error: null,
    });
    const supabase = { from: vi.fn().mockReturnValue(query) };

    const error = await assertNoCrossZoneLocationOverlap({
      supabase: supabase as never,
      merchantId: 'merchant-1',
      excludeZoneId: null,
      locations: [{ countryCode: 'NG', subdivisionCode: null }],
    }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ShippingZoneLocationOverlapError);
    expect(
      (error as ShippingZoneLocationOverlapError).conflictingZoneName
    ).toBe('Nationwide');
  });

  it('rejects a duplicate subdivision across zones', async () => {
    const query = createQueryMock({
      data: [
        {
          country_code: 'NG',
          subdivision_code: 'NG-LA',
          merchant_shipping_zones: { id: 'z-lagos', name: 'Lagos' },
        },
      ],
      error: null,
    });
    const supabase = { from: vi.fn().mockReturnValue(query) };

    const error = await assertNoCrossZoneLocationOverlap({
      supabase: supabase as never,
      merchantId: 'merchant-1',
      excludeZoneId: null,
      locations: [{ countryCode: 'NG', subdivisionCode: 'NG-LA' }],
    }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ShippingZoneLocationOverlapError);
    expect(
      (error as ShippingZoneLocationOverlapError).conflictingZoneName
    ).toBe('Lagos');
  });

  it('excludes the edited zone from the comparison', async () => {
    const query = createQueryMock({ data: [], error: null });
    const supabase = { from: vi.fn().mockReturnValue(query) };

    await assertNoCrossZoneLocationOverlap({
      supabase: supabase as never,
      merchantId: 'merchant-1',
      excludeZoneId: 'z-self',
      locations: [{ countryCode: 'NG', subdivisionCode: 'NG-LA' }],
    });

    expect(query.neq).toHaveBeenCalledWith('zone_id', 'z-self');
  });
});

describe('shipping-actions-shared constants', () => {
  it('exposes the settings path and the expected row column lists', () => {
    expect(SHIPPING_SETTINGS_PATH).toBe('/dashboard/settings/shipping');
    expect(ZONE_ROW_COLUMNS).toContain('is_rest_of_world');
    expect(LOCATION_ROW_COLUMNS).toContain('subdivision_code');
    expect(RATE_ROW_COLUMNS).toContain('base_amount');
  });
});
