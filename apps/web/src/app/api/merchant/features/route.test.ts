import { describe, expect, it } from 'vitest';
import { MERCHANT_ID, makeRequest } from './route.test-support';

describe('merchant feature route request fixtures', () => {
  it('selects the merchant explicitly for every supported HTTP verb', async () => {
    const getRequest = makeRequest('GET');
    const patchRequest = makeRequest('PATCH', { loyalty_enabled: true });
    const putRequest = makeRequest('PUT', { loyalty_enabled: false });
    expect(getRequest.nextUrl.searchParams.get('merchantId')).toBe(MERCHANT_ID);
    await expect(patchRequest.json()).resolves.toMatchObject({
      merchantId: MERCHANT_ID,
    });
    await expect(putRequest.json()).resolves.toMatchObject({
      merchantId: MERCHANT_ID,
    });
  });
});
