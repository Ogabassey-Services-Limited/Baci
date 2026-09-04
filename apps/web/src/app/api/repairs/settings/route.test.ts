import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, PATCH } from './route';

const mocks = vi.hoisted(() => ({
  authorizeRepairsRequest: vi.fn(),
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/repairs/catalog-admin-auth', () => ({
  authorizeRepairsRequest: mocks.authorizeRepairsRequest,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createClient: mocks.createClient,
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('@/lib/merchant-feature-settings-defaults', () => ({
  merchantFeatureSettingsDefaults: {
    buildFields: () => ({ loyalty_enabled: false }),
  },
}));

function authorized() {
  return { ok: true, access: { merchantId: 'm-1' }, supabase: {} };
}

function makeAdmin(config: {
  select?: { data: unknown; error: unknown };
  write?: { error: unknown };
}) {
  const update = vi.fn(() => ({
    eq: () => Promise.resolve(config.write ?? { error: null }),
  }));
  const insert = vi.fn(() => Promise.resolve(config.write ?? { error: null }));
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve(config.select ?? { data: null, error: null }),
        }),
      }),
      update,
      insert,
    }),
    update,
    insert,
  };
}

const validSettings = {
  pickup_enabled: true,
  pickup_address: '3 Olayeni Street',
  contact_name: 'Repair Center',
  contact_phone: '09070007000',
  contact_email: 'repairs@ogabassey.com',
  city: 'Ikeja',
  state: 'Lagos',
  country: 'Nigeria',
};

function req(body: unknown): NextRequest {
  return new Request('https://x/api/repairs/settings', {
    method: 'PATCH',
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

function getReq(): NextRequest {
  return new Request('https://x') as unknown as NextRequest;
}

function malformedReq(): NextRequest {
  return new Request('https://x/api/repairs/settings', {
    method: 'PATCH',
    body: '{ not valid json',
  }) as unknown as NextRequest;
}

describe('GET /api/repairs/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizeRepairsRequest.mockResolvedValue(authorized());
  });

  it('returns 401 when unauthorized', async () => {
    mocks.authorizeRepairsRequest.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const res = await GET(getReq());
    expect(res.status).toBe(401);
  });

  it('returns the stored settings', async () => {
    mocks.createClient.mockReturnValue(
      makeAdmin({
        select: {
          data: {
            repair_settings: validSettings,
            repairs_catalog_enabled: true,
          },
          error: null,
        },
      })
    );
    const res = await GET(getReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.repairSettings).toEqual(validSettings);
    expect(body.repairsCatalogEnabled).toBe(true);
  });

  it('returns 500 when the settings query fails', async () => {
    mocks.createClient.mockReturnValue(
      makeAdmin({ select: { data: null, error: { message: 'boom' } } })
    );
    const res = await GET(getReq());
    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/repairs/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizeRepairsRequest.mockResolvedValue(authorized());
  });

  it('returns 403 when the caller lacks repairs.edit', async () => {
    mocks.authorizeRepairsRequest.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      ),
    });
    const res = await PATCH(req(validSettings));
    expect(res.status).toBe(403);
  });

  it('rejects an invalid email', async () => {
    const res = await PATCH(req({ ...validSettings, contact_email: 'nope' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for a malformed request body', async () => {
    const res = await PATCH(malformedReq());
    expect(res.status).toBe(400);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('returns 500 when the settings lookup fails', async () => {
    mocks.createClient.mockReturnValue(
      makeAdmin({ select: { data: null, error: { message: 'boom' } } })
    );
    const res = await PATCH(req(validSettings));
    expect(res.status).toBe(500);
  });

  it('updates an existing settings row', async () => {
    const admin = makeAdmin({
      select: { data: { merchant_id: 'm-1' }, error: null },
    });
    mocks.createClient.mockReturnValue(admin);
    const res = await PATCH(req(validSettings));
    expect(res.status).toBe(200);
    expect(admin.update).toHaveBeenCalled();
    expect(admin.insert).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/dashboard/repairs');
  });

  it('merges partial settings into the existing private settings JSON', async () => {
    const admin = makeAdmin({
      select: {
        data: {
          merchant_id: 'm-1',
          repair_settings: {
            pickup_address: '3 Olayeni Street',
            city: 'Ikeja',
            state: 'Lagos',
            country: 'Nigeria',
            contact_name: 'Repair Center',
          },
        },
        error: null,
      },
    });
    mocks.createClient.mockReturnValue(admin);

    const res = await PATCH(
      req({ pickup_enabled: true, contact_phone: '09070007000' })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(admin.update).toHaveBeenCalledWith(
      expect.objectContaining({
        repair_settings: {
          pickup_address: '3 Olayeni Street',
          city: 'Ikeja',
          state: 'Lagos',
          country: 'Nigeria',
          contact_name: 'Repair Center',
          pickup_enabled: true,
          contact_phone: '09070007000',
        },
      })
    );
    expect(body.repairSettings).toMatchObject({
      pickup_address: '3 Olayeni Street',
      pickup_enabled: true,
      contact_phone: '09070007000',
    });
  });

  describe('bugfix: partial phone patch with enabled pickup', () => {
    it('rejects clearing contact_phone while persisted pickup stays enabled', async () => {
      const admin = makeAdmin({
        select: {
          data: {
            merchant_id: 'm-1',
            repair_settings: {
              pickup_enabled: true,
              contact_phone: '09070007000',
              contact_name: 'Repair Center',
            },
          },
          error: null,
        },
      });
      mocks.createClient.mockReturnValue(admin);

      const res = await PATCH(req({ contact_phone: '' }));

      expect(res.status).toBe(400);
      expect(admin.update).not.toHaveBeenCalled();
    });

    it('rejects an invalid contact_phone patch while persisted pickup stays enabled', async () => {
      const admin = makeAdmin({
        select: {
          data: {
            merchant_id: 'm-1',
            repair_settings: {
              pickup_enabled: true,
              contact_phone: '09070007000',
            },
          },
          error: null,
        },
      });
      mocks.createClient.mockReturnValue(admin);

      const res = await PATCH(req({ contact_phone: 'not-a-phone' }));

      expect(res.status).toBe(400);
      expect(admin.update).not.toHaveBeenCalled();
    });

    it('accepts a valid contact_phone patch while persisted pickup stays enabled', async () => {
      const admin = makeAdmin({
        select: {
          data: {
            merchant_id: 'm-1',
            repair_settings: {
              pickup_enabled: true,
              contact_phone: '09070007000',
              contact_name: 'Repair Center',
            },
          },
          error: null,
        },
      });
      mocks.createClient.mockReturnValue(admin);

      const res = await PATCH(req({ contact_phone: '08031234567' }));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.repairSettings).toMatchObject({
        pickup_enabled: true,
        contact_phone: '08031234567',
        contact_name: 'Repair Center',
      });
    });
  });

  it('clears a stored contact email when the merchant submits a blank value', async () => {
    const admin = makeAdmin({
      select: {
        data: {
          merchant_id: 'm-1',
          repair_settings: { contact_email: 'repairs@ogabassey.com' },
        },
        error: null,
      },
    });
    mocks.createClient.mockReturnValue(admin);

    const res = await PATCH(req({ contact_email: '' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(admin.update).toHaveBeenCalledWith(
      expect.objectContaining({
        repair_settings: { contact_email: null },
      })
    );
    expect(body.repairSettings).toEqual({ contact_email: null });
  });

  it('inserts defaults when no settings row exists yet', async () => {
    const admin = makeAdmin({ select: { data: null, error: null } });
    mocks.createClient.mockReturnValue(admin);
    const res = await PATCH(req(validSettings));
    expect(res.status).toBe(200);
    expect(admin.insert).toHaveBeenCalled();
  });

  it('returns 500 when the write fails', async () => {
    mocks.createClient.mockReturnValue(
      makeAdmin({
        select: { data: { merchant_id: 'm-1' }, error: null },
        write: { error: { message: 'boom' } },
      })
    );
    const res = await PATCH(req(validSettings));
    expect(res.status).toBe(500);
  });
});
