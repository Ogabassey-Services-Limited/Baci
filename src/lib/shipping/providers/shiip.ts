/**
 * Shiip (GoShiip) Shipping Provider
 * Multi-carrier aggregator with 30+ delivery partners
 */

import { BaseShippingProvider } from './base';
import type {
  ShippingQuote,
  QuoteRequest,
  BookingRequest,
  ShipmentBookingResult,
  TrackingResult,
  TrackingEvent,
  CancellationResult,
} from '../types';
import { mapShiipStatus } from '../status-mapper';

// =============================================================================
// CONFIGURATION
// =============================================================================

const SHIIP_API_KEY = process.env.SHIIP_API_KEY;
const SHIIP_USER_ID = process.env.SHIIP_USER_ID;
const SHIIP_BASE_URL = process.env.SHIIP_USE_SANDBOX === 'true'
  ? (process.env.SHIIP_SANDBOX_URL || 'https://delivery-staging.apiideraos.com/api/v2/token')
  : (process.env.SHIIP_BASE_URL || 'https://delivery.apiideraos.com/api/v2/token');

// =============================================================================
// SHIIP-SPECIFIC TYPES
// =============================================================================

interface ShiipQuoteRequest {
  type: 'interstate' | 'intrastate' | 'international' | 'international_us' | 'frozen-international';
  toAddress: {
    city: string;
    state: string;
    country: string;
    street?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  fromAddress: {
    city: string;
    state: string;
    country: string;
    street?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  parcels: Array<{
    width: number;
    length: number;
    height: number;
    weight: number;
  }>;
}

interface ShiipRate {
  name: string;              // Carrier name (e.g., "Dellyman", "GIG", "Uber")
  logo?: string;
  price: number;
  currency: string;
  delivery_eta?: string;
  redis_key: string;         // Required for booking
  rate_id: string;           // Required for booking
  user_id: string;           // Required for booking
}

interface ShiipQuoteResponse {
  status: boolean;
  message: string;
  data: ShiipRate[];
}

interface ShiipBookingRequest {
  redis_key: string;
  rate_id: string;
  user_id: string;
  toAddress: {
    street: string;
    city: string;
    state: string;
    country: string;
    name: string;
    email?: string;
    phone: string;
    postalCode?: string;
  };
  fromAddress: {
    street: string;
    city: string;
    state: string;
    country: string;
    name: string;
    email?: string;
    phone: string;
    postalCode?: string;
  };
  parcels: Array<{
    width: number;
    length: number;
    height: number;
    weight: number;
    description?: string;
    value?: number;
  }>;
  metadata?: Record<string, unknown>;
}

interface ShiipBookingResponse {
  status: boolean;
  message: string;
  data: {
    reference: string;
    tracking_number?: string;
    status: string;
    carrier: string;
    [key: string]: unknown;
  };
}

interface ShiipTrackingResponse {
  status: boolean;
  message: string;
  data: {
    reference: string;
    tracking_number?: string;
    status: string;
    carrier: string;
    events: Array<{
      status: string;
      description: string;
      timestamp: string;
      location?: string;
    }>;
    estimated_delivery?: string;
    delivered_at?: string;
  };
}

// Known Shiip carrier names and their display names
const SHIIP_CARRIER_DISPLAY_NAMES: Record<string, string> = {
  'dellyman': 'Dellyman',
  'gig': 'GIG Logistics',
  'gig logistics': 'GIG Logistics',
  'uber': 'Uber Direct',
  'kwik': 'Kwik',
  'sendbox': 'Sendbox',
  'redstar': 'Red Star Express',
  'abc': 'ABC Transport',
  'dhl': 'DHL',
  'fedex': 'FedEx',
  'ups': 'UPS',
  'aramex': 'Aramex',
};

// =============================================================================
// SHIIP PROVIDER IMPLEMENTATION
// =============================================================================

export class ShiipProvider extends BaseShippingProvider {
  readonly code = 'SHIIP' as const;
  readonly name = 'Shiip';
  readonly displayName = 'Shiip';  // Hidden from customers
  readonly supportsInternational = true;
  readonly supportsDomestic = true;

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private getHeaders(): Record<string, string> {
    if (!SHIIP_API_KEY) {
      throw new Error('Shiip API key not configured');
    }

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SHIIP_API_KEY}`,
    };
  }

  private getCarrierDisplayName(carrierName: string): string {
    const lower = carrierName.toLowerCase();
    return SHIIP_CARRIER_DISPLAY_NAMES[lower] || carrierName;
  }

  private determineShipmentType(
    senderCountry: string,
    receiverCountry: string,
    senderState?: string,
    receiverState?: string
  ): ShiipQuoteRequest['type'] {
    // International shipments
    if (senderCountry !== receiverCountry) {
      if (receiverCountry === 'US' || receiverCountry === 'United States') {
        return 'international_us';
      }
      return 'international';
    }

    // Nigeria domestic
    if (senderCountry === 'NG' || senderCountry === 'Nigeria') {
      // Same state = intrastate, different state = interstate
      if (senderState && receiverState && senderState.toLowerCase() === receiverState.toLowerCase()) {
        return 'intrastate';
      }
      return 'interstate';
    }

    return 'interstate';
  }

  private parseDeliveryEta(eta?: string): { estimatedDays: number; minDays?: number; maxDays?: number } {
    if (!eta) {
      return { estimatedDays: 3 };
    }

    // Parse formats like "24-48 hours", "2-3 days", "Same day"
    const lower = eta.toLowerCase();

    if (lower.includes('same day') || lower.includes('instant')) {
      return { estimatedDays: 1, minDays: 1, maxDays: 1 };
    }

    // Hours format
    const hoursMatch = eta.match(/(\d+)\s*-\s*(\d+)\s*hours?/i);
    if (hoursMatch) {
      const minHours = parseInt(hoursMatch[1], 10);
      const maxHours = parseInt(hoursMatch[2], 10);
      return {
        estimatedDays: Math.ceil(maxHours / 24),
        minDays: Math.ceil(minHours / 24),
        maxDays: Math.ceil(maxHours / 24),
      };
    }

    // Days format
    const daysMatch = eta.match(/(\d+)\s*-\s*(\d+)\s*days?/i);
    if (daysMatch) {
      const min = parseInt(daysMatch[1], 10);
      const max = parseInt(daysMatch[2], 10);
      return {
        estimatedDays: Math.round((min + max) / 2),
        minDays: min,
        maxDays: max,
      };
    }

    // Single number
    const singleMatch = eta.match(/(\d+)/);
    if (singleMatch) {
      const days = parseInt(singleMatch[1], 10);
      // If small number, might be hours
      if (days <= 48 && lower.includes('hour')) {
        return { estimatedDays: Math.ceil(days / 24) };
      }
      return { estimatedDays: days };
    }

    return { estimatedDays: 3 };
  }

  private calculateDefaultDimensions(weight: number): { width: number; length: number; height: number } {
    // Estimate dimensions based on weight (rough approximation)
    if (weight <= 1) {
      return { width: 20, length: 20, height: 10 };
    } else if (weight <= 5) {
      return { width: 30, length: 30, height: 20 };
    } else if (weight <= 10) {
      return { width: 40, length: 40, height: 30 };
    } else {
      return { width: 50, length: 50, height: 40 };
    }
  }

  // ==========================================================================
  // GET QUOTES
  // ==========================================================================

  async getQuotes(request: QuoteRequest): Promise<ShippingQuote[]> {
    try {
      const senderCountry = request.sender?.countryCode || 'NG';
      const receiverCountry = request.receiver.countryCode;

      const shipmentType = this.determineShipmentType(
        senderCountry,
        receiverCountry,
        request.sender?.state,
        request.receiver.state
      );

      // Calculate total weight and dimensions
      const totalWeight = request.items.reduce((sum, item) => sum + item.weight * item.quantity, 0);
      const dimensions = this.calculateDefaultDimensions(totalWeight);

      const payload: ShiipQuoteRequest = {
        type: shipmentType,
        fromAddress: {
          city: request.sender?.city || 'Lagos',
          state: request.sender?.state || 'Lagos',
          country: request.sender?.country || 'Nigeria',
          street: request.sender?.address,
          name: request.sender?.name,
          email: request.sender?.email,
          phone: request.sender?.phone,
        },
        toAddress: {
          city: request.receiver.city,
          state: request.receiver.state,
          country: request.receiver.country,
          street: request.receiver.address,
          name: request.receiver.name,
          email: request.receiver.email,
          phone: request.receiver.phone,
        },
        parcels: [{
          width: dimensions.width,
          length: dimensions.length,
          height: dimensions.height,
          weight: totalWeight,
        }],
      };

      const response = await this.safeFetch(`${SHIIP_BASE_URL}/tariffs/allprice`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        this.log('error', 'Shiip quote request failed', { status: response.status, error });
        return [];
      }

      const result: ShiipQuoteResponse = await response.json();

      if (!result.status || !result.data || result.data.length === 0) {
        this.log('warn', 'No Shiip quotes returned', { message: result.message });
        return [];
      }

      return result.data.map(rate => {
        const carrierName = this.getCarrierDisplayName(rate.name);
        const deliveryEta = this.parseDeliveryEta(rate.delivery_eta);

        return {
          id: this.generateQuoteId(),
          provider: 'SHIIP' as const,
          serviceTier: rate.name,
          carrierName,
          displayName: carrierName,
          estimatedDays: deliveryEta.estimatedDays,
          minDays: deliveryEta.minDays,
          maxDays: deliveryEta.maxDays,
          price: rate.price,
          currency: 'NGN',
          pickupIncluded: true,
          insuranceIncluded: true,
          providerRateId: JSON.stringify({
            redis_key: rate.redis_key,
            rate_id: rate.rate_id,
            user_id: rate.user_id || SHIIP_USER_ID,
          }),
          expiresAt: this.getQuoteExpiry(1),
        };
      });
    } catch (error) {
      this.log('error', 'Failed to get Shiip quotes', { error: String(error) });
      return [];
    }
  }

  // ==========================================================================
  // BOOK SHIPMENT
  // ==========================================================================

  async bookShipment(request: BookingRequest): Promise<ShipmentBookingResult> {
    // Parse the provider rate ID to get booking keys
    // The providerRateId contains JSON with redis_key, rate_id, user_id
    if (!request.providerRateId) {
      throw new Error('Missing rate data for Shiip booking. Please select a quote first.');
    }

    let rateData: { redis_key: string; rate_id: string; user_id: string };
    try {
      rateData = JSON.parse(request.providerRateId);
      if (!rateData.redis_key || !rateData.rate_id) {
        throw new Error('Incomplete rate data');
      }
      // Use stored user_id or fallback to env
      rateData.user_id = rateData.user_id || SHIIP_USER_ID || '';
    } catch (error) {
      this.log('error', 'Failed to parse Shiip rate data', {
        providerRateId: request.providerRateId,
        error: String(error)
      });
      throw new Error('Invalid rate data for Shiip booking');
    }

    const totalWeight = request.items.reduce((sum, item) => sum + item.weight * item.quantity, 0);
    const dimensions = this.calculateDefaultDimensions(totalWeight);

    const payload: ShiipBookingRequest = {
      redis_key: rateData.redis_key,
      rate_id: rateData.rate_id,
      user_id: rateData.user_id,
      fromAddress: {
        street: request.sender.address,
        city: request.sender.city,
        state: request.sender.state,
        country: request.sender.country,
        name: request.sender.name,
        email: request.sender.email,
        phone: request.sender.phone,
        postalCode: request.sender.postalCode,
      },
      toAddress: {
        street: request.receiver.address,
        city: request.receiver.city,
        state: request.receiver.state,
        country: request.receiver.country,
        name: request.receiver.name,
        email: request.receiver.email,
        phone: request.receiver.phone,
        postalCode: request.receiver.postalCode,
      },
      parcels: [{
        width: dimensions.width,
        length: dimensions.length,
        height: dimensions.height,
        weight: totalWeight,
        description: request.items.map(i => i.name).join(', '),
        value: request.items.reduce((sum, i) => sum + i.value * i.quantity, 0),
      }],
      metadata: {
        orderId: request.orderId,
      },
    };

    const response = await this.safeFetch(`${SHIIP_BASE_URL}/bookshipment`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      this.log('error', 'Shiip booking failed', { status: response.status, error });
      throw new Error('Failed to book Shiip shipment');
    }

    const result: ShiipBookingResponse = await response.json();

    if (!result.status || !result.data?.reference) {
      throw new Error(result.message || 'Failed to book Shiip shipment');
    }

    // Request pickup
    try {
      await this.safeFetch(`${SHIIP_BASE_URL}/shipment/assign`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ reference: result.data.reference }),
      });
    } catch (error) {
      this.log('warn', 'Failed to request Shiip pickup', { error: String(error) });
      // Don't fail the booking, pickup can be requested later
    }

    return {
      provider: 'SHIIP',
      providerShipmentId: result.data.reference,
      trackingNumber: result.data.tracking_number || result.data.reference,
      carrierName: this.getCarrierDisplayName(result.data.carrier),
      status: 'booked',
      rawResponse: result.data,
    };
  }

  // ==========================================================================
  // TRACK SHIPMENT
  // ==========================================================================

  async trackShipment(trackingNumber: string): Promise<TrackingResult> {
    const response = await this.safeFetch(
      `${SHIIP_BASE_URL}/shipment/track/${encodeURIComponent(trackingNumber)}`,
      {
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      this.log('error', 'Shiip tracking failed', { status: response.status });
      throw new Error('Failed to track Shiip shipment');
    }

    const result: ShiipTrackingResponse = await response.json();

    if (!result.status || !result.data) {
      throw new Error('Shipment not found');
    }

    const events: TrackingEvent[] = (result.data.events || []).map(event => ({
      status: event.status,
      description: event.description,
      location: event.location,
      timestamp: new Date(event.timestamp),
      rawStatus: event.status,
    }));

    const status = mapShiipStatus(result.data.status);
    const carrierName = this.getCarrierDisplayName(result.data.carrier);

    return {
      provider: 'SHIIP',
      trackingNumber,
      status,
      carrierName,
      estimatedDelivery: result.data.estimated_delivery
        ? new Date(result.data.estimated_delivery)
        : undefined,
      actualDelivery: result.data.delivered_at
        ? new Date(result.data.delivered_at)
        : undefined,
      events: events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
    };
  }

  // ==========================================================================
  // CANCEL SHIPMENT
  // ==========================================================================

  async cancelShipment(shipmentId: string): Promise<CancellationResult> {
    const response = await this.safeFetch(
      `${SHIIP_BASE_URL}/shipment/cancel/${encodeURIComponent(shipmentId)}`,
      {
        method: 'GET', // Shiip uses GET for cancellation
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      this.log('error', 'Shiip cancellation failed', { status: response.status, error });
      return {
        success: false,
        message: 'Failed to cancel shipment',
      };
    }

    const result = await response.json();

    return {
      success: result.status === true,
      message: result.message || (result.status ? 'Shipment cancelled' : 'Cancellation failed'),
    };
  }

  // ==========================================================================
  // HEALTH CHECK
  // ==========================================================================

  async isAvailable(): Promise<boolean> {
    try {
      // Quick health check by getting a quote for Lagos to Lagos
      const testRequest: ShiipQuoteRequest = {
        type: 'intrastate',
        fromAddress: { city: 'Lagos', state: 'Lagos', country: 'Nigeria' },
        toAddress: { city: 'Lagos', state: 'Lagos', country: 'Nigeria' },
        parcels: [{ width: 10, length: 10, height: 10, weight: 1 }],
      };

      const response = await this.safeFetch(`${SHIIP_BASE_URL}/tariffs/allprice`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(testRequest),
        timeout: 10000, // 10 second timeout for health check
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const shiipProvider = new ShiipProvider();
