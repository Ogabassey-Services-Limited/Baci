import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { buildVtuPurchaseUrl } from '@/lib/vtu-purchase-url';

let mockExpoPublicApiUrl = 'https://usebaci.com/';

jest.mock('@/env', () => ({
  get EXPO_PUBLIC_API_URL() {
    return mockExpoPublicApiUrl;
  },
}));

describe('buildVtuPurchaseUrl', () => {
  afterEach(() => {
    mockExpoPublicApiUrl = 'https://usebaci.com/';
  });

  it('builds a purchase URL from a configured API base URL', () => {
    expect(buildVtuPurchaseUrl()).toBe(
      'https://usebaci.com/api/vtu/purchase'
    );
  });

  it('fails fast when the API base URL is empty', () => {
    mockExpoPublicApiUrl = '   ';

    expect(() => buildVtuPurchaseUrl()).toThrow(
      'EXPO_PUBLIC_API_URL is required for VTU purchases.'
    );
  });

  it('fails fast when the API base URL is malformed', () => {
    mockExpoPublicApiUrl = 'not-a-url';

    expect(() => buildVtuPurchaseUrl()).toThrow(
      'EXPO_PUBLIC_API_URL must be a valid URL.'
    );
  });
});
