/**
 * Base Shipping Provider Interface
 * All providers (GIGL, Topship) must implement this interface
 */

import type {
  BookingRequest,
  CancellationResult,
  QuoteRequest,
  ShipmentBookingResult,
  ShippingProviderCode,
  ShippingQuote,
  TrackingResult,
  UnifiedLocation,
} from '../types';

export interface ShippingProvider {
  /** Provider code identifier */
  readonly code: ShippingProviderCode;

  /** Provider name for internal logging */
  readonly name: string;

  /** Display name shown to customers (for GIGL: "GIG Logistics") */
  readonly displayName: string;

  /** Whether this provider supports international shipping */
  readonly supportsInternational: boolean;

  /** Whether this provider supports domestic shipping */
  readonly supportsDomestic: boolean;

  /**
   * Get shipping quotes for a route
   * @param request - Quote request with sender, receiver, items
   * @returns Array of available shipping quotes
   */
  getQuotes(request: QuoteRequest): Promise<ShippingQuote[]>;

  /**
   * Book a shipment with the provider
   * @param request - Booking request with order details and selected quote
   * @returns Booking result with tracking number
   */
  bookShipment(request: BookingRequest): Promise<ShipmentBookingResult>;

  /**
   * Track a shipment by tracking number
   * @param trackingNumber - The waybill/tracking number
   * @returns Tracking information with events
   */
  trackShipment(trackingNumber: string): Promise<TrackingResult>;

  /**
   * Cancel a shipment
   * @param shipmentId - Provider's shipment ID
   * @returns Cancellation result
   */
  cancelShipment(shipmentId: string): Promise<CancellationResult>;

  /**
   * Check if provider API is available
   * @returns true if provider is healthy and responding
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get supported locations for this provider
   * For GIGL: Returns stations/service centers
   * For Topship: Returns cities from their API
   * @param countryCode - ISO country code (e.g., 'NG')
   * @returns Array of supported locations
   */
  getLocations?(countryCode: string): Promise<UnifiedLocation[]>;
}

/**
 * Abstract base class with shared functionality
 */
export abstract class BaseShippingProvider implements ShippingProvider {
  abstract readonly code: ShippingProviderCode;
  abstract readonly name: string;
  abstract readonly displayName: string;
  abstract readonly supportsInternational: boolean;
  abstract readonly supportsDomestic: boolean;

  abstract getQuotes(request: QuoteRequest): Promise<ShippingQuote[]>;
  abstract bookShipment(
    request: BookingRequest
  ): Promise<ShipmentBookingResult>;
  abstract trackShipment(trackingNumber: string): Promise<TrackingResult>;
  abstract cancelShipment(shipmentId: string): Promise<CancellationResult>;

  /**
   * Default availability check - tries to authenticate
   */
  async isAvailable(): Promise<boolean> {
    await Promise.resolve(); // Ensure async behavior
    try {
      // Subclasses should override with provider-specific health check
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate a unique quote ID
   */
  protected generateQuoteId(): string {
    return crypto.randomUUID();
  }

  /**
   * Calculate quote expiry (default: 1 hour)
   */
  protected getQuoteExpiry(hours: number = 1): Date {
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  /**
   * Log provider API calls for debugging
   */
  protected log(
    level: 'info' | 'warn' | 'error',
    message: string,
    data?: Record<string, unknown>
  ): void {
    const logData = {
      provider: this.code,
      message,
      ...data,
      timestamp: new Date().toISOString(),
    };

    switch (level) {
      case 'error':
        console.error('[Shipping]', logData);
        break;
      case 'warn':
        console.warn('[Shipping]', logData);
        break;
      default:
        console.log('[Shipping]', logData);
    }
  }

  /**
   * Safe fetch wrapper with timeout and error handling
   */
  protected async safeFetch(
    url: string,
    options: RequestInit & { timeout?: number } = {}
  ): Promise<Response> {
    const { timeout = 30000, signal: requestSignal, ...fetchOptions } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const abortFromRequest = () => controller.abort(requestSignal?.reason);

    if (requestSignal?.aborted) {
      controller.abort(requestSignal.reason);
    } else {
      requestSignal?.addEventListener('abort', abortFromRequest, {
        once: true,
      });
    }

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
        cache: 'no-store',
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
      requestSignal?.removeEventListener('abort', abortFromRequest);
    }
  }
}

/**
 * Provider factory type for dependency injection
 */
export type ShippingProviderFactory = () => ShippingProvider;

/**
 * Provider registry for managing multiple providers
 */
export class ShippingProviderRegistry {
  private providers: Map<ShippingProviderCode, ShippingProvider> = new Map();

  register(provider: ShippingProvider): void {
    this.providers.set(provider.code, provider);
  }

  get(code: ShippingProviderCode): ShippingProvider | undefined {
    return this.providers.get(code);
  }

  getAll(): ShippingProvider[] {
    return Array.from(this.providers.values());
  }

  getEnabled(): ShippingProvider[] {
    // All registered providers are considered enabled
    return this.getAll();
  }

  getDomestic(): ShippingProvider[] {
    return this.getAll().filter((p) => p.supportsDomestic);
  }

  getInternational(): ShippingProvider[] {
    return this.getAll().filter((p) => p.supportsInternational);
  }
}
