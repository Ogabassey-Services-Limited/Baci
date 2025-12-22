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

const GIGL_BASE_URL =
  process.env.GIGL_BASE_URL ||
  'https://dev-thirdpartynode.theagilitysystems.com';
const GIGL_EMAIL = process.env.GIGL_EMAIL;
const GIGL_PASSWORD = process.env.GIGL_PASSWORD;
const GIGL_TOKEN_EXPIRY_MS = 20 * 24 * 60 * 60 * 1000; // 20 days

// =============================================================================
// GIGL-SPECIFIC TYPES
// =============================================================================

interface GiglToken {
  token: string;
  userChannelCode: string;
  userChannelType: number;
  expiresAt: number;
}

interface GiglStation {
  StationId: number;
  StationName: string;
  StationCode: string;
  State: string;
  City: string;
  Address?: string;
  Latitude?: number;
  Longitude?: number;
}

interface GiglQuoteResponse {
  status: number;
  data: {
    GrandTotal: number;
    MainCharge: number;
    DeliverPrice: number;
    PickupCharge: number;
    InsuranceValue: number;
    VAT: number;
  };
}

interface GiglBookingResponse {
  status: number;
  data: {
    Waybill: string;
    [key: string]: unknown;
  };
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
    const token = result.data['access-token'];
    const userChannelCode = result.data.UserChannelCode;
    const userChannelType = result.data.UserChannelType;

    if (!token || !userChannelCode || userChannelType === undefined) {
      throw new Error('Invalid GIGL login response');
    }

    cachedToken = {
      token,
      userChannelCode,
      userChannelType,
      expiresAt: Date.now() + GIGL_TOKEN_EXPIRY_MS,
    };

    return cachedToken;
  }

  // ==========================================================================
  // LOCATIONS / STATIONS
  // ==========================================================================

  async getLocations(): Promise<UnifiedLocation[]> {
    const stations = await this.getStations();
    return stations.map((station) => ({
      state: station.State,
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
    this.stationsCache = result.data || [];
    this.stationsCacheExpiry = Date.now() + this.STATIONS_CACHE_TTL;

    return this.stationsCache || [];
  }

  private async findStationForCity(
    city: string,
    state: string
  ): Promise<GiglStation | null> {
    const stations = await this.getStations();

    // Try exact city match first
    let station = stations.find(
      (s) =>
        s.City?.toLowerCase() === city.toLowerCase() ||
        s.StationName?.toLowerCase() === city.toLowerCase()
    );

    // Try state match if no city match
    if (!station) {
      station = stations.find(
        (s) => s.State?.toLowerCase() === state.toLowerCase()
      );
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
        ShipmentType: ShipmentType.Ecommerce,
        PickUpOptions: pickupOption,
        DeliveryOptionIds:
          pickupOption === PickupOptions.HomeDelivery ? [2] : [11],
        IsFromAgility: false,
        CustomerCode: tokenData.userChannelCode,
        CustomerType: tokenData.userChannelType,
        Value: totalValue,
        ShipmentItems: request.items.map((item) => ({
          ItemName: item.name,
          Quantity: item.quantity,
          Weight: item.weight,
          Value: item.value,
          ItemType: 'NORMAL',
          ShipmentType: ShipmentType.Ecommerce,
        })),
      };

      const response = await this.safeFetch(
        `${GIGL_BASE_URL}/shipments/create`,
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
        this.log('warn', 'GIGL quote request failed', {
          status: response.status,
          error,
        });
        return null;
      }

      const result: GiglQuoteResponse = await response.json();

      if (result.status !== 200 || !result.data?.GrandTotal) {
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
        price: result.data.GrandTotal,
        currency: 'NGN',
        pickupIncluded: true,
        insuranceIncluded: true,
        expiresAt: this.getQuoteExpiry(1),
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
          Latitude: request.sender.latitude?.toString() || '6.5244',
          Longitude: request.sender.longitude?.toString() || '3.3792',
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
            request.receiver.latitude?.toString() ||
            receiverStation.Latitude?.toString() ||
            '6.5244',
          Longitude:
            request.receiver.longitude?.toString() ||
            receiverStation.Longitude?.toString() ||
            '3.3792',
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
        SpecialPackageId: 10,
        Quantity: item.quantity,
        Value: item.value,
        ShipmentType: ShipmentType.Ecommerce,
        Description: item.description || item.name,
        Weight: item.weight,
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

    const result: GiglBookingResponse = await response.json();

    if (result.status !== 200 || !result.data?.Waybill) {
      throw new Error('Invalid GIGL booking response');
    }

    return {
      provider: 'GIGL',
      providerShipmentId: result.data.Waybill,
      trackingNumber: result.data.Waybill,
      carrierName: 'GIG Logistics',
      status: 'booked',
      rawResponse: result.data,
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

    const result: GiglTrackingResponse = await response.json();

    if (!result.data || result.data.length === 0) {
      throw new Error('Shipment not found');
    }

    const shipment = result.data[0];
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
