import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_MERCHANT_ID,
  getSubaccountRouteMocks,
  makeRequest,
  resetSubaccountRouteMocks,
} from './subaccount-route.test-utils';

describe('subaccount route test utilities', () => {
  beforeEach(resetSubaccountRouteMocks);

  it('adds the default merchant selector to object request bodies', async () => {
    const request = makeRequest({
      accountNumber: '1234567890',
      bankCode: '044',
    });

    await expect(request.json()).resolves.toEqual({
      accountNumber: '1234567890',
      bankCode: '044',
      merchantId: DEFAULT_MERCHANT_ID,
    });
  });

  it('restores the authenticated owner defaults between route tests', async () => {
    const mocks = getSubaccountRouteMocks();
    mocks.hasPermission.mockReturnValue(false);

    resetSubaccountRouteMocks();

    expect(mocks.hasPermission()).toBe(true);
    await expect(mocks.authenticateApiRequest()).resolves.toMatchObject({
      error: null,
      user: { id: 'user-123' },
    });
  });
});
