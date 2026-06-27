import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  baseUrl,
  bookingRequest,
  bookingResponse,
  jsonResponse,
  loginResponseWithoutCustomerType,
  stationsResponse,
} from './gigl.test-helpers';

describe('GiglProvider booking requests', () => {
  beforeEach(() => {
    process.env.GIGL_BASE_URL = baseUrl;
    process.env.GIGL_EMAIL = 'test@example.com';
    process.env.GIGL_PASSWORD = 'test-password';
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.GIGL_BASE_URL;
    delete process.env.GIGL_EMAIL;
    delete process.env.GIGL_PASSWORD;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('books the selected station-pickup quote semantics', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponseWithoutCustomerType))
      .mockResolvedValueOnce(jsonResponse(stationsResponse))
      .mockResolvedValueOnce(jsonResponse(bookingResponse));

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

    const result = await provider.bookShipment(bookingRequest);

    const bookingPayload = JSON.parse(
      String(fetchMock.mock.calls[2]?.[1]?.body ?? '{}')
    );
    expect(bookingPayload).toMatchObject({
      SenderDetails: {
        SenderLocation: { Latitude: 0, Longitude: 0 },
      },
      ReceiverDetails: {
        ReceiverStationId: 30,
        ReceiverLocation: { Latitude: 0, Longitude: 0 },
      },
      ShipmentDetails: {
        PickUpOptions: 1,
        DeliveryOptionIds: [11],
        VehicleType: 1,
      },
    });
    expect(result).toMatchObject({
      provider: 'GIGL',
      trackingNumber: 'GIGL-WB-1',
      isStationPickup: true,
      pickupStationName: 'PORT HARCOURT',
      pickupStationAddress: 'Port Harcourt station',
    });
  });

  it('preserves the quoted vehicle type during booking', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponseWithoutCustomerType))
      .mockResolvedValueOnce(jsonResponse(stationsResponse))
      .mockResolvedValueOnce(jsonResponse(bookingResponse));

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

    await provider.bookShipment({
      ...bookingRequest,
      providerRateId: 'GIGL_30_1_2',
    });

    const bookingPayload = JSON.parse(
      String(fetchMock.mock.calls[2]?.[1]?.body ?? '{}')
    );
    expect(bookingPayload.ShipmentDetails.VehicleType).toBe(2);
  });

  it('recomputes heavy legacy bookings with the van vehicle type', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponseWithoutCustomerType))
      .mockResolvedValueOnce(jsonResponse(stationsResponse))
      .mockResolvedValueOnce(jsonResponse(bookingResponse));

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

    await provider.bookShipment({
      ...bookingRequest,
      providerRateId: 'GIGL_30_1',
      items: [{ ...bookingRequest.items[0], weight: 31 }],
    });

    const bookingPayload = JSON.parse(
      String(fetchMock.mock.calls[2]?.[1]?.body ?? '{}')
    );
    expect(bookingPayload.ShipmentDetails.VehicleType).toBe(2);
  });

  it('rejects station-pickup bookings when the selected station cannot be resolved', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(loginResponseWithoutCustomerType))
      .mockResolvedValueOnce(jsonResponse(stationsResponse));

    const { GiglProvider } = await import('./gigl');
    const provider = new GiglProvider();

    await expect(
      provider.bookShipment({
        ...bookingRequest,
        providerRateId: 'GIGL_999_1',
      })
    ).rejects.toThrow('Selected GIGL station was not found');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
