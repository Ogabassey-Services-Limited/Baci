import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.GIGL_BASE_URL =
    'https://dev-thirdpartynode.theagilitysystems.com';
  process.env.GIGL_EMAIL = 'test@example.com';
  process.env.GIGL_PASSWORD = 'test-password';
});

import { GiglApiClient } from './gigl.auth';
import { bookGiglShipment } from './gigl.booking';
import { GiglStationsService } from './gigl.stations';
import {
  baseUrl,
  bookingRequest,
  jsonResponse,
  loginResponseWithoutCustomerType,
} from './gigl.test-helpers';

function buildHarness() {
  const log = vi.fn();
  const safeFetch = (
    url: string,
    options?: RequestInit & { timeout?: number }
  ) => fetch(url, options);
  const apiClient = new GiglApiClient({ safeFetch, log });
  const stationsService = new GiglStationsService(apiClient);

  return {
    bookShipment: (request: typeof bookingRequest) =>
      bookGiglShipment(apiClient, stationsService, { safeFetch, log }, request),
    log,
  };
}

describe('GiglProvider international booking errors', () => {
  beforeEach(() => {
    process.env.GIGL_BASE_URL = baseUrl;
    process.env.GIGL_EMAIL = 'test@example.com';
    process.env.GIGL_PASSWORD = 'test-password';
  });

  afterEach(() => {
    delete process.env.GIGL_BASE_URL;
    delete process.env.GIGL_EMAIL;
    delete process.env.GIGL_PASSWORD;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('rejects malformed international rate ids before provider calls', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const provider = buildHarness();

    await expect(
      provider.bookShipment({
        ...bookingRequest,
        providerRateId: 'GIGL_INTL_bad',
      })
    ).rejects.toMatchObject({
      code: 'GIGL_INTERNATIONAL_RATE_INVALID',
      status: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('validates package quantities before provider calls', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const provider = buildHarness();

    await expect(
      provider.bookShipment({
        ...bookingRequest,
        providerRateId: 'GIGL_INTL_2_0_0_1',
        items: [
          {
            ...bookingRequest.items[0],
            height: 6,
            length: 10,
            quantity: 0,
            width: 8,
          },
        ],
      })
    ).rejects.toMatchObject({
      code: 'GIGL_INTERNATIONAL_PACKAGE_QUANTITY_INVALID',
      status: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('distinguishes country lookup failures from unsupported destinations', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponseWithoutCustomerType))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: { message: 'Failed', status: 500, data: [] },
        })
      );
    const provider = buildHarness();

    await expect(
      provider.bookShipment({
        ...bookingRequest,
        providerRateId: 'GIGL_INTL_2_0_0_1',
        receiver: {
          ...bookingRequest.receiver,
          address: '123 Queen Street West',
          city: 'Toronto',
          country: 'Canada',
          countryCode: 'CA',
          state: 'Ontario',
        },
      })
    ).rejects.toMatchObject({
      code: 'GIGL_INTERNATIONAL_COUNTRY_LOOKUP_FAILED',
      status: 502,
    });
    expect(provider.log).toHaveBeenCalledWith(
      'warn',
      'GIGL international destination country lookup failed',
      expect.objectContaining({ envelopeStatus: 500, responseStatus: 200 })
    );
  });
});
