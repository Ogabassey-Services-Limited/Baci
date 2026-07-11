import { afterEach, describe, expect, it, vi } from 'vitest';

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
  bookingRequest,
  bookingResponse,
  jsonResponse,
  loginResponseWithoutCustomerType,
  serviceCentresResponse,
  stationsResponse,
} from './gigl.test-helpers';

describe('GIGL service centre booking', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('books the exact service centre selected in the quote', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(loginResponseWithoutCustomerType))
      .mockResolvedValueOnce(jsonResponse(stationsResponse))
      .mockResolvedValueOnce(jsonResponse(serviceCentresResponse))
      .mockResolvedValueOnce(jsonResponse(bookingResponse));
    vi.stubGlobal('fetch', fetchMock);
    const safeFetch = (url: string, options?: RequestInit) =>
      fetch(url, options);
    const apiClient = new GiglApiClient({ safeFetch, log: vi.fn() });

    const result = await bookGiglShipment(
      apiClient,
      new GiglStationsService(apiClient),
      { safeFetch, log: vi.fn() },
      { ...bookingRequest, providerRateId: 'GIGL_30_1_1_575' }
    );

    const bookingPayload = JSON.parse(
      String(fetchMock.mock.calls[3]?.[1]?.body ?? '{}')
    );
    expect(bookingPayload.ReceiverDetails).toMatchObject({
      DestinationServiceCenterId: 575,
      ReceiverAddress: 'Eagle Cement Junction, Rumuolumeni, Port Harcourt',
      ReceiverLocation: { Latitude: 4.816, Longitude: 7.05 },
    });
    expect(result).toMatchObject({
      pickupStationName: 'PHC RUMUOLUMENI IWOFE',
      pickupStationAddress: 'Eagle Cement Junction, Rumuolumeni, Port Harcourt',
    });
  });

  it('rejects booking when the selected service centre no longer exists', async () => {
    const missingSelectedCentre = {
      ...serviceCentresResponse,
      data: {
        ...serviceCentresResponse.data,
        data: serviceCentresResponse.data.data.filter(
          (centre) => centre.ServiceCentreId !== 575
        ),
      },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(loginResponseWithoutCustomerType))
      .mockResolvedValueOnce(jsonResponse(stationsResponse))
      .mockResolvedValueOnce(jsonResponse(missingSelectedCentre));
    vi.stubGlobal('fetch', fetchMock);
    const safeFetch = (url: string, options?: RequestInit) =>
      fetch(url, options);
    const apiClient = new GiglApiClient({ safeFetch, log: vi.fn() });

    await expect(
      bookGiglShipment(
        apiClient,
        new GiglStationsService(apiClient),
        { safeFetch, log: vi.fn() },
        { ...bookingRequest, providerRateId: 'GIGL_30_1_1_575' }
      )
    ).rejects.toThrow('Selected GIGL service centre was not found');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
