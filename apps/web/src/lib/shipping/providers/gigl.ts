/**
 * GIGL Shipping Provider
 * Refactored from /src/lib/gigl.ts to implement ShippingProvider interface
 */

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

// =============================================================================
// CONFIGURATION
// =============================================================================

function trimmedEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
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

// =============================================================================
// GIGL-SPECIFIC TYPES
// =============================================================================

interface GiglToken {
  token: string;
  userChannelCode: string;
  customerType: number;
  expiresAt: number;
}

interface GiglStation {
  StationId: number;
  StationName: string;
  StationCode: string;
  State?: string;
  StateName?: string;
  City?: string;
  Address?: string;
  Latitude?: number;
  Longitude?: number;
}

interface GiglPriceData {
  GrandTotal: number;
  MainCharge?: number;
  DeliverPrice?: number;
  PickupCharge?: number;
  InsuranceValue?: number;
  DeclaredValue?: number;
  Discount?: number;
  ShipmentItems?: unknown[];
}

interface GiglLoginData {
  'access-token'?: string;
  UserChannelCode?: string;
  UserChannelType?: number;
  CustomerType?: number;
}

interface GiglApiEnvelope {
  status: number;
  message?: string;
  data?: unknown;
}

interface GiglBookingData {
  Waybill: string;
  [key: string]: unknown;
}

interface GiglTrackingResponse {
  status: number;
  data: Array<{
    Waybill: string;
    Origin: string;
    Destination: string;
    PickupOptions: number;
    DeliveryType: number;
    MobileShipmentTrackings: Array<{
      Status: string;
      ScanStatusReason: string;
      DateTime: string;
      DepartureServiceCentre?: {
        Name: string;
        Address?: string;
      };
    }>;
  }>;
}

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
// TOKEN CACHE
// =============================================================================

let cachedToken: GiglToken | null = null;

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
  private stationsCacheExpiry = 0;
  private readonly STATIONS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  // ==========================================================================
  // AUTHENTICATION
  // ==========================================================================

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object';
  }

  private readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private readNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value)
      ? value
      : undefined;
  }

  private unwrapApiEnvelope(payload: unknown): GiglApiEnvelope {
    if (!this.isRecord(payload)) {
      return {
        status: 500,
        data: payload,
      };
    }

    const nested = payload.data;
    if (
      this.isRecord(nested) &&
      ('data' in nested || 'status' in nested || 'message' in nested)
    ) {
      return {
        status:
          this.readNumber(nested.status) ??
          this.readNumber(payload.status) ??
          200,
        message:
          this.readString(nested.message) || this.readString(payload.message),
        data: nested.data,
      };
    }

    return {
      status: this.readNumber(payload.status) ?? 200,
      message: this.readString(payload.message),
      data: payload.data,
    };
  }

  private normalizeCustomerType(value: unknown): number {
    const customerType = this.readNumber(value);
    return customerType === 1 ? 1 : 0;
  }

  private async getApiToken(): Promise<GiglToken> {
    if (cachedToken && Date.now() < cachedToken.expiresAt) {
      return cachedToken;
    }

    this.log('info', 'Fetching new GIGL API token');

    if (!GIGL_EMAIL || !GIGL_PASSWORD) {
      throw new Error('GIGL credentials not configured');
    }

    const response = await this.safeFetch(`${GIGL_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: GIGL_EMAIL, password: GIGL_PASSWORD }),
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
    const loginData = envelope.data as GiglLoginData | undefined;
    const token = this.isRecord(loginData)
      ? this.readString(loginData['access-token'])
      : undefined;
    const userChannelCode = this.isRecord(loginData)
      ? this.readString(loginData.UserChannelCode)
      : undefined;

    if (!token || !userChannelCode) {
      throw new Error('Invalid GIGL login response');
    }

    cachedToken = {
      token,
      userChannelCode,
      customerType: this.normalizeCustomerType(loginData?.CustomerType),
      expiresAt: Date.now() + GIGL_TOKEN_EXPIRY_MS,
    };

    return cachedToken;
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

  async getStations(): Promise<GiglStation[]> {
    // Check cache
    if (this.stationsCache && Date.now() < this.stationsCacheExpiry) {
      return this.stationsCache;
    }

    const tokenData = await this.getApiToken();

    const response = await this.safeFetch(
      `${GIGL_BASE_URL}/localstations/get`,
      {
        method: 'GET',
        headers: { 'access-token': tokenData.token },
      }
    );

    if (!response.ok) {
      this.log('error', 'Failed to fetch GIGL stations', {
        status: response.status,
      });
      throw new Error('Failed to fetch GIGL stations');
    }

    const result = await response.json();
    const envelope = this.unwrapApiEnvelope(result);
    this.stationsCache = Array.isArray(envelope.data)
      ? (envelope.data as GiglStation[])
      : [];
    this.stationsCacheExpiry = Date.now() + this.STATIONS_CACHE_TTL;

    return this.stationsCache || [];
  }

  private normalizeLocation(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private async findStationForCity(
    city: string,
    state: string
  ): Promise<GiglStation | null> {
    const stations = await this.getStations();

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

  async getQuotes(request: QuoteRequest): Promise<ShippingQuote[]> {
    try {
      const tokenData = await this.getApiToken();

      // Find stations for sender and receiver
      const senderStation = request.sender
        ? await this.findStationForCity(
            request.sender.city,
            request.sender.state
          )
        : null;

      const receiverStation = await this.findStationForCity(
        request.receiver.city,
        request.receiver.state
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
        totalValue
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
          totalValue
        );

        if (stationPickupQuote) {
          return [stationPickupQuote];
        }

        return [];
      }

      return [homeDeliveryQuote];
    } catch (error) {
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
    totalValue: number
  ): Promise<ShippingQuote | null> {
    try {
      const payload = {
        SenderStationId: senderStation?.StationId || 4, // Default to Lagos
        ReceiverStationId: receiverStation.StationId,
        SenderLocation: senderStation
          ? {
              Latitude: senderStation.Latitude || 6.5244,
              Longitude: senderStation.Longitude || 3.3792,
            }
          : { Latitude: 6.5244, Longitude: 3.3792 },
        ReceiverLocation: {
          Latitude:
            request.receiver.latitude || receiverStation.Latitude || 6.5244,
          Longitude:
            request.receiver.longitude || receiverStation.Longitude || 3.3792,
        },
        VehicleType: totalWeight > 30 ? VehicleType.Van : VehicleType.Bike,
        PickUpOptions: pickupOption,
        DeliveryOptionIds:
          pickupOption === PickupOptions.HomeDelivery ? [2] : [11],
        IsFromAgility: false,
        CustomerCode: tokenData.userChannelCode,
        CustomerType: tokenData.customerType,
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
      };

      const response = await this.safeFetch(`${GIGL_BASE_URL}/price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access-token': tokenData.token,
        },
        body: JSON.stringify(payload),
      });

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
      const priceData = envelope.data as GiglPriceData | undefined;
      const grandTotal = this.isRecord(priceData)
        ? this.readNumber(priceData.GrandTotal)
        : undefined;

      if (envelope.status !== 200 || !grandTotal) {
        return null;
      }

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
      this.log('error', 'Error fetching GIGL quote', { error: String(error) });
      return null;
    }
  }

  // ==========================================================================
  // BOOK SHIPMENT
  // ==========================================================================

  async bookShipment(request: BookingRequest): Promise<ShipmentBookingResult> {
    const tokenData = await this.getApiToken();

    const senderStation = await this.findStationForCity(
      request.sender.city,
      request.sender.state
    );

    const receiverStation = await this.findStationForCity(
      request.receiver.city,
      request.receiver.state
    );

    if (!receiverStation) {
      throw new Error('No GIGL station found for delivery location');
    }

    const payload = {
      SenderDetails: {
        SenderLocation: {
          Latitude: request.sender.latitude || 6.5244,
          Longitude: request.sender.longitude || 3.3792,
        },
        SenderName: request.sender.name,
        SenderPhoneNumber: request.sender.phone,
        SenderStationId: senderStation?.StationId || 4,
        SenderAddress: request.sender.address,
        InputtedSenderAddress: request.sender.address,
        SenderLocality: request.sender.state,
      },
      ReceiverDetails: {
        ReceiverLocation: {
          Latitude:
            request.receiver.latitude || receiverStation.Latitude || 6.5244,
          Longitude:
            request.receiver.longitude || receiverStation.Longitude || 3.3792,
        },
        ReceiverStationId: receiverStation.StationId,
        ReceiverName: request.receiver.name,
        ReceiverPhoneNumber: request.receiver.phone,
        ReceiverAddress: request.receiver.address,
        InputtedReceiverAddress: request.receiver.address,
      },
      ShipmentDetails: {
        VehicleType: VehicleType.Bike,
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

    const response = await this.safeFetch(
      `${GIGL_BASE_URL}/capture/preshipment`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access-token': tokenData.token,
        },
        body: JSON.stringify(payload),
      }
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
    const bookingData = envelope.data as GiglBookingData | undefined;
    const waybill = this.isRecord(bookingData)
      ? this.readString(bookingData.Waybill)
      : undefined;

    if (envelope.status !== 200 || !waybill) {
      throw new Error('Invalid GIGL booking response');
    }

    return {
      provider: 'GIGL',
      providerShipmentId: waybill,
      trackingNumber: waybill,
      carrierName: 'GIG Logistics',
      status: 'booked',
      rawResponse: bookingData,
    };
  }

  // ==========================================================================
  // TRACK SHIPMENT
  // ==========================================================================

  async trackShipment(trackingNumber: string): Promise<TrackingResult> {
    const tokenData = await this.getApiToken();

    const response = await this.safeFetch(
      `${GIGL_BASE_URL}/track/mobileShipment?Waybill=${encodeURIComponent(trackingNumber)}`,
      {
        method: 'GET',
        headers: { 'access-token': tokenData.token },
      }
    );

    if (!response.ok) {
      this.log('error', 'GIGL tracking failed', { status: response.status });
      throw new Error('Failed to track GIGL shipment');
    }

    const result = await response.json();
    const envelope = this.unwrapApiEnvelope(result);
    const trackingData = envelope.data as GiglTrackingResponse['data'];

    if (!Array.isArray(trackingData) || trackingData.length === 0) {
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
