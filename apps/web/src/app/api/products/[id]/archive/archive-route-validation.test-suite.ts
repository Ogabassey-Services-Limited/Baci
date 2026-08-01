import type { NextRequest } from 'next/server';
import { expect, it, type Mock } from 'vitest';

type ArchivePatch = (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => Promise<Response>;

type ValidationSuiteOptions = {
  PATCH: ArchivePatch;
  makeContext: (id?: string) => { params: Promise<{ id: string }> };
  makeMalformedRequest: () => NextRequest;
  makeRequest: (body?: unknown) => NextRequest;
  mocks: {
    getMerchantForApiRequest: Mock;
    updatePayload: unknown;
  };
};

export function defineArchiveRouteValidationSuite({
  PATCH,
  makeContext,
  makeMalformedRequest,
  makeRequest,
  mocks,
}: ValidationSuiteOptions) {
  it('rejects an invalid product id before reading the body or resolving a merchant', async () => {
    const request = makeRequest();
    const json = request.json.bind(request);
    request.json = () => {
      throw new Error('The archive body should not be read');
    };

    const response = await PATCH(request, makeContext('not-a-uuid'));

    request.json = json;
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid product id',
    });
    expect(mocks.getMerchantForApiRequest).not.toHaveBeenCalled();
    expect(mocks.updatePayload).toBeNull();
  });

  it('returns a generic body error for malformed JSON without resolving a merchant', async () => {
    const response = await PATCH(makeMalformedRequest(), makeContext());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid request body',
    });
    expect(mocks.getMerchantForApiRequest).not.toHaveBeenCalled();
  });

  it('returns a generic body error when merchantId is missing', async () => {
    const response = await PATCH(makeRequest({}), makeContext());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid request body',
    });
    expect(mocks.getMerchantForApiRequest).not.toHaveBeenCalled();
  });

  it('returns a generic body error when merchantId is invalid', async () => {
    const response = await PATCH(
      makeRequest({ merchantId: 'not-a-merchant-id' }),
      makeContext()
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid request body',
    });
    expect(mocks.getMerchantForApiRequest).not.toHaveBeenCalled();
  });

  it('rejects a whitespace-padded merchantId before merchant or product access', async () => {
    const response = await PATCH(
      makeRequest({ merchantId: ' 11111111-1111-4111-8111-111111111111 ' }),
      makeContext()
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid request body',
    });
    expect(mocks.getMerchantForApiRequest).not.toHaveBeenCalled();
    expect(mocks.updatePayload).toBeNull();
  });
}
