import type { NextRequest } from 'next/server';
import { expect, it, type Mock } from 'vitest';

type ArchivePatch = (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => Promise<Response>;

type AuthorizationSuiteOptions = {
  PATCH: ArchivePatch;
  makeContext: (id?: string) => { params: Promise<{ id: string }> };
  makeRequest: (body?: { merchantId: string }) => NextRequest;
  mocks: {
    archiveError: { code?: string; message?: string } | null;
    authenticateApiRequest: Mock;
    checkCsrfProtection: Mock;
    hasPermission: Mock;
    revalidateProducts: Mock;
    scheduleStorefrontProductPurge: Mock;
    updatePayload: unknown;
  };
};

export function defineArchiveRouteAuthorizationSuite({
  PATCH,
  makeContext,
  makeRequest,
  mocks,
}: AuthorizationSuiteOptions) {
  it('returns 401 when the user is not authenticated', async () => {
    mocks.authenticateApiRequest.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });

    const response = await PATCH(makeRequest(), makeContext());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(mocks.updatePayload).toBeNull();
    expect(mocks.revalidateProducts).not.toHaveBeenCalled();
    expect(mocks.scheduleStorefrontProductPurge).not.toHaveBeenCalled();
  });

  it('rejects requests that fail CSRF validation', async () => {
    mocks.checkCsrfProtection.mockResolvedValue({ valid: false });

    const response = await PATCH(makeRequest(), makeContext());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'CSRF validation failed',
    });
    expect(mocks.updatePayload).toBeNull();
    expect(mocks.revalidateProducts).not.toHaveBeenCalled();
    expect(mocks.scheduleStorefrontProductPurge).not.toHaveBeenCalled();
  });

  it('rejects users without product edit permission', async () => {
    mocks.hasPermission.mockReturnValue(false);

    const response = await PATCH(makeRequest(), makeContext());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Permission denied',
    });
    expect(mocks.updatePayload).toBeNull();
  });

  it('rejects invalid product ids before updating', async () => {
    const response = await PATCH(makeRequest(), makeContext('not-a-uuid'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid product id',
    });
    expect(mocks.updatePayload).toBeNull();
  });

  it('returns 500 when the archive update fails', async () => {
    mocks.archiveError = { code: '23505', message: 'update failed' };

    const response = await PATCH(makeRequest(), makeContext());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to archive product',
    });
    expect(mocks.updatePayload).toMatchObject({ status: 'archived' });
    expect(mocks.revalidateProducts).not.toHaveBeenCalled();
    expect(mocks.scheduleStorefrontProductPurge).not.toHaveBeenCalled();
  });

  it('returns 404 when the product does not belong to the merchant', async () => {
    mocks.archiveError = { code: 'PGRST116', message: 'no rows' };

    const response = await PATCH(makeRequest(), makeContext());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'Product not found',
    });
    expect(mocks.updatePayload).toMatchObject({ status: 'archived' });
    expect(mocks.revalidateProducts).not.toHaveBeenCalled();
    expect(mocks.scheduleStorefrontProductPurge).not.toHaveBeenCalled();
  });
}
