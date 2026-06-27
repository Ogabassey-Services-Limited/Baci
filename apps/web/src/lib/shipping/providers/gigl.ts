/**
 * GIGL Shipping Provider
 * Refactored from /src/lib/gigl.ts to implement ShippingProvider interface
 */

import type { z } from 'zod';
import { mapGiglStatus } from '../status-mapper';
import type {
  BookingRequest,
  CancellationResult,
  QuoteRequest,
  ShipmentBookingResult,
  ShippingQuote,
  TrackingEvent,
  TrackingResult,
  UnifiedLocation,
} from '../types';
import { BaseShippingProvider } from './base';
import { type GiglStation, giglSchemas } from './gigl.schemas';

// =============================================================================
// CONFIGURATION
// =============================================================================

function trimmedEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function positiveIntegerEnv(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

const GIGL_DEFAULT_BASE_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://thirdpartynode.theagilitysystems.com'
    : 'https://dev-thirdpartynode.theagilitysystems.com';
const GIGL_BASE_URL =
  trimmedEnv(process.env.GIGL_BASE_URL) || GIGL_DEFAULT_BASE_URL;
const GIGL_EMAIL = trimmedEnv(process.env.GIGL_EMAIL);
const GIGL_PASSWORD = trimmedEnv(process.env.GIGL_PASSWORD);
const GIGL_TOKEN_EXPIRY_MS = 20 * 24 * 60 * 60 * 1000; // 20 days
const GIGL_QUOTE_TIMEOUT_MS =
  positiveIntegerEnv(process.env.GIGL_QUOTE_TIMEOUT_MS) || 5000;

// =============================================================================
// GIGL-SPECIFIC TYPES
// =============================================================================

interface GiglToken {
  token: string;
  userChannelCode: string;
  customerType: number;
  expiresAt: number;
}

type GiglApiEnvelope = {
  status: number;
  message?: string;
  data?: unknown;
};

// GIGL Enums
enum VehicleType {
  Car = 0,
  Bike = 1,
  Van = 2,
  Truck = 3,
}

enum ShipmentType {
  Special = 0,
  Regular = 1,
  Ecommerce = 2,
}

enum PickupOptions {
  HomeDelivery = 0,
  ServiceCentre = 1,
}

// =============================================================================
// GIGL PROVIDER IMPLEMENTATION
// =============================================================================

export class GiglProvider extends BaseShippingProvider {
  readonly code = 'GIGL' as const;
  readonly name = 'GIGL';
  readonly displayName = 'GIG Logistics';
  readonly supportsInternational = false;
  readonly supportsDomestic = true;

  // Station cache
  private stationsCache: GiglStation[] | null = null;
  private cachedToken: GiglToken | null = null;
  private tokenRequest: Promise<GiglToken> | null = null;
  private stationsCacheExpiry = 0;
  private readonly STATIONS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  // ==========================================================================
  // AUTHENTICATION
  // ==========================================================================

  private readNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value)
      ? value
      : undefined;
  }

  private isAbortError(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.name === 'AbortError' || error.name === 'TimeoutError')
    );
  }

  private unwrapApiEnvelope(payload: unknown): GiglApiEnvelope {
    const parsed = giglSchemas.envelopeObject.safeParse(payload);

    if (!parsed.success) {
      return {
        status: 500,
        data: payload,
      };
    }

    const outer = parsed.data;
    const nestedEnvelope = giglSchemas.envelopeObject.safeParse(outer.data);
    if (
      nestedEnvelope.success &&
      (nestedEnvelope.data.data !== undefined ||
        nestedEnvelope.data.status !== undefined ||
        nestedEnvelope.data.message !== undefined)
    ) {
      return {
        status: nestedEnvelope.data.status ?? outer.status ?? 200,
        message: nestedEnvelope.data.message || outer.message,
        data: nestedEnvelope.data.data,
      };
    }

    return {
      status: outer.status ?? 200,
      message: outer.message,
      data: outer.data,
    };
  }

  private parseEnvelopeData<T>(
    envelope: GiglApiEnvelope,
    schema: z.ZodType<T>,
    description: string
  ): T {
    const parsed = schema.safeParse(envelope.data);
    if (!parsed.success) {
      this.log('warn', `Invalid GIGL ${description} response`, {
        status: envelope.status,
        apiMessage: envelope.message,
        issues: parsed.error.issues,
      });
      throw new Error(`Invalid GIGL ${description} response`);
    }

    return parsed.data;
  }

  private normalizeCustomerType(...values: unknown[]): number {
    for (const value of values) {
      const customerType = this.readNumber(value);
      if (customerType !== undefined) {
        return customerType;
      }
    }

    return 0;
  }

  private getApiToken(timeout?: number): Promise<GiglToken> {
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt) {
      return Promise.resolve(this.cachedToken);
    }

    if (this.tokenRequest) {
      return this.tokenRequest;
    }

    this.tokenRequest = this.fetchApiToken(timeout).finally(() => {
      this.tokenRequest = null;
    });

    return this.tokenRequest;
  }

  private async fetchApiToken(
    timeout?: number,
    signal?: AbortSignal
  ): Promise<GiglToken> {
    this.log('info', 'Fetching new GIGL API token');

    if (!GIGL_EMAIL || !GIGL_PASSWORD) {
      throw new Error('GIGL credentials not configured');
    }

    const response = await this.safeFetch(`${GIGL_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: GIGL_EMAIL, password: GIGL_PASSWORD }),
      timeout,
      signal,
    });

    if (!response.ok) {
      const error = await response.text();
      this.log('error', 'GIGL login failed', {
        status: response.status,
        error,
      });
      throw new Error('GIGL API authentication failed');
    }

    const result = await response.json();
    const envelope = this.unwrapApiEnvelope(result);

    if (envelope.status !== 200) {
      this.log('warn', 'Invalid GIGL login response', {
        status: envelope.status,
        apiMessage: envelope.message,
      });
      throw new Error('Invalid GIGL login response');
    }

    const loginData = this.parseEnvelopeData(
      envelope,
      giglSchemas.loginData,
      'login'
    );
    const token = loginData['access-token'];
    const userChannelCode = loginData.UserChannelCode;

    this.cachedToken = {
      token,
      userChannelCode,
      customerType: this.normalizeCustomerType(
        loginData?.CustomerType,
        loginData?.UserChannelType
      ),
      expiresAt: Date.now() + GIGL_TOKEN_EXPIRY_MS,
    };

    return this.cachedToken;
  }

  private invalidateCachedToken(token?: string): void {
    if (!token || this.cachedToken?.token === token) {
      this.cachedToken = null;
    }
  }

  private async safeFetchWithAccessToken(
    url: string,
    tokenData: GiglToken,
    buildRequest: (tokenData: GiglToken) => RequestInit & { timeout?: number }
  ): Promise<{ response: Response; tokenData: GiglToken }> {
    const withAccessToken = (
      options: RequestInit & { timeout?: number },
      token: string
    ) => {
      const headers = new Headers(options.headers);
      headers.set('access-token', token);

      return {
        ...options,
        headers,
      };
    };

    const initialOptions = buildRequest(tokenData);
    let response = await this.safeFetch(
      url,
      withAccessToken(initialOptions, tokenData.token)
    );

    if (response.status !== 401) {
      return { response, tokenData };
    }

    this.log('warn', 'GIGL token rejected; refreshing token');
    this.invalidateCachedToken(tokenData.token);

    const refreshedToken = await this.getApiToken(initialOptions.timeout);
    response = await this.safeFetch(
      url,
      withAccessToken(buildRequest(refreshedToken), refreshedToken.token)
    );

    return { response, tokenData: refreshedToken };
  }

  // ==========================================================================
  // LOCATIONS / STATIONS
  // ==========================================================================

  async getLocations(_countryCode = 'NG'): Promise<UnifiedLocation[]> {
    const stations = await this.getStations();
    return stations.map((station) => ({
      state: station.StateName || station.State || station.StationName,
      city: station.City || station.StationName,
      stationId: station.StationId,
      stationName: station.StationName,
      latitude: station.Latitude,
      longitude: station.Longitude,
    }));
  }

  async getStations(
    timeout?: number,
    signal?: AbortSignal
  ): Promise<GiglStation[]> {
    // Check cache
    if (this.stationsCache && Date.now() < this.stationsCacheExpiry) {
      return this.stationsCache;
    }

    const tokenData = await this.getApiToken(timeout);

    const { response } = await this.safeFetchWithAccessToken(
      `${GIGL_BASE_URL}/localstations/get`,
      tokenData,
      () => ({
        method: 'GET',
        timeout,
        signal,
      })
    );

    if (!response.ok) {
      this.log('error', 'Failed to fetch GIGL stations', {
        status: response.status,
      });
      throw new Error('Failed to fetch GIGL stations');
    }

    const result = await response.json();
    const envelope = this.unwrapApiEnvelope(result);

    if (envelope.status !== 200) {
      this.log('warn', 'Invalid GIGL stations response', {
        status: envelope.status,
        apiMessage: envelope.message,
      });
      throw new Error('Invalid GIGL stations response');
    }

    this.stationsCache = this.parseEnvelopeData(
      envelope,
      giglSchemas.stationsData,
      'stations'
    );
    this.stationsCacheExpiry = Date.now() + this.STATIONS_CACHE_TTL;

    return this.stationsCache || [];
  }

  private normalizeLocation(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private async findStationById(
    stationId: number,
    timeout?: number,
    signal?: AbortSignal
  ): Promise<GiglStation | null> {
    const stations = await this.getStations(timeout, signal);
    return stations.find((station) => station.StationId === stationId) || null;
  }

  private async findStationForCity(
    city: string,
    state: string,
    timeout?: number,
    signal?: AbortSignal
  ): Promise<GiglStation | null> {
    const stations = await this.getStations(timeout, signal);

    // Try exact city match first
    const normalizedCity = this.normalizeLocation(city);
    const normalizedState = this.normalizeLocation(state);

    let station = stations.find((s) => {
      const cityName = this.normalizeLocation(s.City || '');
      const stationName = this.normalizeLocation(s.StationName || '');
      return cityName === normalizedCity || stationName === normalizedCity;
    });

    // Try state match if no city match
    if (!station) {
      station = stations.find((s) => {
        const stateName = this.normalizeLocation(s.StateName || s.State || '');
        return stateName === normalizedState;
      });
    }

    return station || null;
  }

  // ==========================================================================
  // GET QUOTES
  // ==========================================================================

  getQuotes(request: QuoteRequest): Promise<ShippingQuote[]> {
    const signal = AbortSignal.timeout(GIGL_QUOTE_TIMEOUT_MS);
    return this.getQuotesWithinTimeout(request, signal);
  }

  private async getQuotesWithinTimeout(
    request: QuoteRequest,
    signal: AbortSignal
  ): Promise<ShippingQuote[]> {
    try {
      const tokenData = await this.getApiToken(GIGL_QUOTE_TIMEOUT_MS);

      // Find stations for sender and receiver
      const senderStation = request.sender
        ? await this.findStationForCity(
            request.sender.city,
            request.sender.state,
            GIGL_QUOTE_TIMEOUT_MS,
            signal
          )
        : null;

      const receiverStation = await this.findStationForCity(
        request.receiver.city,
        request.receiver.state,
        GIGL_QUOTE_TIMEOUT_MS,
        signal
      );

      if (!receiverStation) {
        this.log('warn', 'No GIGL station found for receiver location', {
          city: request.receiver.city,
          state: request.receiver.state,
        });
        return [];
      }

      // Calculate total weight and value
      const totalWeight = request.items.reduce(
        (sum, item) => sum + item.weight * item.quantity,
        0
      );
      const totalValue = request.items.reduce(
        (sum, item) => sum + item.value * item.quantity,
        0
      );

      // Try home delivery first
      const homeDeliveryQuote = await this.fetchQuote(
        tokenData,
        request,
        senderStation,
        receiverStation,
        PickupOptions.HomeDelivery,
        totalWeight,
        totalValue,
        GIGL_QUOTE_TIMEOUT_MS,
        signal
      );

      // If home delivery fails, try station pickup
      if (!homeDeliveryQuote) {
        const stationPickupQuote = await this.fetchQuote(
          tokenData,
          request,
          senderStation,
          receiverStation,
          PickupOptions.ServiceCentre,
          totalWeight,
          totalValue,
          GIGL_QUOTE_TIMEOUT_MS,
          signal
        );

        if (stationPickupQuote) {
          return [stationPickupQuote];
        }

        return [];
      }

      return [homeDeliveryQuote];
    } catch (error) {
      if (signal.aborted || this.isAbortError(error)) {
        this.log('warn', 'GIGL quote timed out', {
          timeoutMs: GIGL_QUOTE_TIMEOUT_MS,
        });
        return [];
      }

      this.log('error', 'Failed to get GIGL quotes', { error: String(error) });
      return [];
    }
  }

  private async fetchQuote(
    tokenData: GiglToken,
    request: QuoteRequest,
    senderStation: GiglStation | null,
    receiverStation: GiglStation,
    pickupOption: PickupOptions,
    totalWeight: number,
    totalValue: number,
    timeout?: number,
    signal?: AbortSignal
  ): Promise<ShippingQuote | null> {
    try {
      const activeTokenData = this.cachedToken ?? tokenData;
      const buildPayload = (currentTokenData: GiglToken) => ({
        SenderStationId: senderStation?.StationId ?? 4, // Default to Lagos
        ReceiverStationId: receiverStation.StationId,
        SenderLocation: senderStation
          ? {
              Latitude: senderStation.Latitude ?? 6.5244,
              Longitude: senderStation.Longitude ?? 3.3792,
            }
          : { Latitude: 6.5244, Longitude: 3.3792 },
        ReceiverLocation: {
          Latitude:
            request.receiver.latitude ?? receiverStation.Latitude ?? 6.5244,
          Longitude:
            request.receiver.longitude ?? receiverStation.Longitude ?? 3.3792,
        },
        VehicleType: totalWeight > 30 ? VehicleType.Van : VehicleType.Bike,
        PickUpOptions: pickupOption,
        DeliveryOptionIds:
          pickupOption === PickupOptions.HomeDelivery ? [2] : [11],
        IsFromAgility: false,
        CustomerCode: currentTokenData.userChannelCode,
        CustomerType: currentTokenData.customerType,
        Value: totalValue,
        ShipmentItems: request.items.map((item) => ({
          ItemName: item.name,
          Description: item.description || item.name,
          Quantity: item.quantity,
          Weight: item.weight,
          Value: item.value,
          IsVolumetric: false,
          ShipmentType: ShipmentType.Regular,
        })),
      });

      const { response } = await this.safeFetchWithAccessToken(
        `${GIGL_BASE_URL}/price`,
        activeTokenData,
        (currentTokenData) => ({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(buildPayload(currentTokenData)),
          timeout,
          signal,
        })
      );

      if (!response.ok) {
        const error = await response.text();
        this.log('warn', 'GIGL quote request failed', {
          status: response.status,
          error,
        });
        return null;
      }

      const result = await response.json();
      const envelope = this.unwrapApiEnvelope(result);

      if (envelope.status !== 200) {
        return null;
      }

      const priceData = this.parseEnvelopeData(
        envelope,
        giglSchemas.priceData,
        'price'
      );
      const grandTotal = priceData.GrandTotal;

      const isStationPickup = pickupOption === PickupOptions.ServiceCentre;

      return {
        id: this.generateQuoteId(),
        provider: 'GIGL',
        serviceTier: isStationPickup ? 'Station Pickup' : 'Standard',
        carrierName: 'GIG Logistics',
        displayName: isStationPickup
          ? 'GIG Logistics - Station Pickup'
          : 'GIG Logistics - Home Delivery',
        estimatedDays: 3,
        minDays: 2,
        maxDays: 5,
        price: Math.round(grandTotal),
        currency: 'NGN',
        pickupIncluded: true,
        insuranceIncluded: true,
        providerRateId: `GIGL_${receiverStation.StationId}_${pickupOption}`,
        expiresAt: this.getQuoteExpiry(1),
        stationId: isStationPickup ? receiverStation.StationId : undefined,
        stationName: isStationPickup ? receiverStation.StationName : undefined,
        stationAddress: isStationPickup ? receiverStation.Address : undefined,
        isStationPickup,
        pickupStationId: isStationPickup
          ? receiverStation.StationId
          : undefined,
        pickupStationName: isStationPickup
          ? receiverStation.StationName
          : undefined,
        pickupStationAddress: isStationPickup
          ? receiverStation.Address
          : undefined,
        rawResponse: priceData,
      };
    } catch (error) {
      if (signal?.aborted || this.isAbortError(error)) {
        throw error;
      }

      this.log('error', 'Error fetching GIGL quote', { error: String(error) });
      return null;
    }
  }

  // ==========================================================================
  // BOOK SHIPMENT
  // ==========================================================================

  private parseProviderRateId(providerRateId?: string): {
    receiverStationId?: number;
    pickupOption: PickupOptions;
  } {
    if (!providerRateId) {
      return { pickupOption: PickupOptions.HomeDelivery };
    }

    const [providerCode, stationIdValue, pickupOptionValue] =
      providerRateId.split('_');
    if (providerCode !== 'GIGL') {
      return { pickupOption: PickupOptions.HomeDelivery };
    }

    const receiverStationId = Number(stationIdValue);
    const pickupOption = Number(pickupOptionValue);

    return {
      receiverStationId: Number.isFinite(receiverStationId)
        ? receiverStationId
        : undefined,
      pickupOption:
        pickupOption === PickupOptions.ServiceCentre
          ? PickupOptions.ServiceCentre
          : PickupOptions.HomeDelivery,
    };
  }

  async bookShipment(request: BookingRequest): Promise<ShipmentBookingResult> {
    const tokenData = await this.getApiToken();
    const selectedRate = this.parseProviderRateId(request.providerRateId);
    const isStationPickup =
      selectedRate.pickupOption === PickupOptions.ServiceCentre;

    const senderStation = await this.findStationForCity(
      request.sender.city,
      request.sender.state
    );

    if (isStationPickup && selectedRate.receiverStationId === undefined) {
      throw new Error('Invalid GIGL station pickup rate');
    }

    const selectedReceiverStation =
      selectedRate.receiverStationId !== undefined
        ? await this.findStationById(selectedRate.receiverStationId)
        : null;

    if (
      selectedRate.receiverStationId !== undefined &&
      !selectedReceiverStation
    ) {
      throw new Error('Selected GIGL station was not found');
    }

    const receiverStation =
      selectedReceiverStation ||
      (await this.findStationForCity(
        request.receiver.city,
        request.receiver.state
      ));

    if (!receiverStation) {
      throw new Error('No GIGL station found for delivery location');
    }

    const payload = {
      SenderDetails: {
        SenderLocation: {
          Latitude: request.sender.latitude ?? 6.5244,
          Longitude: request.sender.longitude ?? 3.3792,
        },
        SenderName: request.sender.name,
        SenderPhoneNumber: request.sender.phone,
        SenderStationId: senderStation?.StationId ?? 4,
        SenderAddress: request.sender.address,
        InputtedSenderAddress: request.sender.address,
        SenderLocality: request.sender.state,
      },
      ReceiverDetails: {
        ReceiverLocation: {
          Latitude:
            request.receiver.latitude ?? receiverStation.Latitude ?? 6.5244,
          Longitude:
            request.receiver.longitude ?? receiverStation.Longitude ?? 3.3792,
        },
        ReceiverStationId: receiverStation.StationId,
        ReceiverName: request.receiver.name,
        ReceiverPhoneNumber: request.receiver.phone,
        ReceiverAddress: request.receiver.address,
        InputtedReceiverAddress: request.receiver.address,
      },
      ShipmentDetails: {
        VehicleType: VehicleType.Bike,
        PickUpOptions: selectedRate.pickupOption,
        DeliveryOptionIds: isStationPickup ? [11] : [2],
        IsFromAgility: 0,
        IsBatchPickUp: 0,
      },
      ShipmentItems: request.items.map((item) => ({
        ItemName: item.name,
        Description: item.description || item.name,
        Quantity: item.quantity,
        Value: item.value,
        ShipmentType: ShipmentType.Regular,
        Weight: item.weight,
        IsVolumetric: false,
      })),
    };

    const bookingTokenData = this.cachedToken ?? tokenData;
    const { response } = await this.safeFetchWithAccessToken(
      `${GIGL_BASE_URL}/capture/preshipment`,
      bookingTokenData,
      () => ({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
    );

    if (!response.ok) {
      const error = await response.text();
      this.log('error', 'GIGL booking failed', {
        status: response.status,
        error,
      });
      throw new Error('Failed to book GIGL shipment');
    }

    const result = await response.json();
    const envelope = this.unwrapApiEnvelope(result);

    if (envelope.status !== 200) {
      throw new Error('Invalid GIGL booking response');
    }

    const bookingData = this.parseEnvelopeData(
      envelope,
      giglSchemas.bookingData,
      'booking'
    );
    const waybill = bookingData.Waybill;

    return {
      provider: 'GIGL',
      providerShipmentId: waybill,
      trackingNumber: waybill,
      carrierName: 'GIG Logistics',
      status: 'booked',
      isStationPickup,
      pickupStationName: isStationPickup
        ? receiverStation.StationName
        : undefined,
      pickupStationAddress: isStationPickup
        ? receiverStation.Address
        : undefined,
      rawResponse: bookingData,
    };
  }

  // ==========================================================================
  // TRACK SHIPMENT
  // ==========================================================================

  async trackShipment(trackingNumber: string): Promise<TrackingResult> {
    const tokenData = await this.getApiToken();

    const { response } = await this.safeFetchWithAccessToken(
      `${GIGL_BASE_URL}/track/mobileShipment?Waybill=${encodeURIComponent(trackingNumber)}`,
      tokenData,
      () => ({
        method: 'GET',
      })
    );

    if (!response.ok) {
      this.log('error', 'GIGL tracking failed', { status: response.status });
      throw new Error('Failed to track GIGL shipment');
    }

    const result = await response.json();
    const envelope = this.unwrapApiEnvelope(result);

    if (envelope.status !== 200) {
      throw new Error('Invalid GIGL tracking response');
    }

    const trackingData = this.parseEnvelopeData(
      envelope,
      giglSchemas.trackingData,
      'tracking'
    );

    if (trackingData.length === 0) {
      throw new Error('Shipment not found');
    }

    const shipment = trackingData[0];
    const events: TrackingEvent[] = (
      shipment.MobileShipmentTrackings || []
    ).map((tracking) => ({
      status: tracking.Status,
      description: tracking.ScanStatusReason || tracking.Status,
      location: tracking.DepartureServiceCentre?.Name,
      timestamp: new Date(tracking.DateTime),
      rawStatus: tracking.Status,
    }));

    // Get latest status
    const latestEvent = events[0];
    const status = latestEvent
      ? mapGiglStatus(latestEvent.rawStatus || '')
      : 'pending';

    // Check if station pickup
    const isStationPickup =
      shipment.PickupOptions === PickupOptions.ServiceCentre;

    return {
      provider: 'GIGL',
      trackingNumber,
      status,
      carrierName: 'GIG Logistics',
      events: events.sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      ),
      isStationPickup,
    };
  }

  // ==========================================================================
  // CANCEL SHIPMENT
  // ==========================================================================

  cancelShipment(shipmentId: string): Promise<CancellationResult> {
    // GIGL doesn't have a documented cancel endpoint
    // This would need to be handled manually or through their dashboard
    this.log('warn', 'GIGL cancellation not implemented', { shipmentId });

    return Promise.resolve({
      success: false,
      message:
        'GIGL shipment cancellation must be done through their customer service',
    });
  }

  // ==========================================================================
  // HEALTH CHECK
  // ==========================================================================

  async isAvailable(): Promise<boolean> {
    try {
      await this.getApiToken();
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const giglProvider = new GiglProvider();
