/**
 * Shipping Service
 * Main entry point for all shipping operations
 * Provides a unified API for quotes, booking, tracking, and cancellation
 */

import { QuoteAggregator } from './aggregator';
import { ShippingProviderRegistry } from './providers/base';
import { GiglProvider } from './providers/gigl';
import { isGiglRuntimeConfigured } from './providers/gigl.constants';
import { TopshipProvider } from './providers/topship';
import type {
  BookingRequest,
  CancellationResult,
  QuoteRequest,
  QuoteResponse,
  ShipmentBookingResult,
  ShippingProviderCode,
  ShippingQuote,
  TrackingResult,
  UnifiedLocation,
} from './types';

// =============================================================================
// PROVIDER REGISTRY SETUP
// =============================================================================

const registry = new ShippingProviderRegistry();

// Register providers
if (isGiglRuntimeConfigured()) {
  registry.register(new GiglProvider());
}
registry.register(new TopshipProvider());

// Create aggregator
const aggregator = new QuoteAggregator(registry);

// =============================================================================
// SHIPPING SERVICE CLASS
// =============================================================================

export class ShippingService {
  private registry: ShippingProviderRegistry;
  private aggregator: QuoteAggregator;

  constructor() {
    this.registry = registry;
    this.aggregator = aggregator;
  }

  // ==========================================================================
  // QUOTES
  // ==========================================================================

  /**
   * Get aggregated shipping quotes from all enabled providers
   */
  async getQuotes(request: QuoteRequest): Promise<QuoteResponse> {
    return await this.aggregator.getQuotes(request);
  }

  /**
   * Get quotes from a specific provider
   */
  async getProviderQuotes(
    provider: ShippingProviderCode,
    request: QuoteRequest
  ): Promise<ShippingQuote[]> {
    const providerInstance = this.registry.get(provider);
    if (!providerInstance) {
      throw new Error(`Provider ${provider} not found`);
    }
    return await providerInstance.getQuotes(request);
  }

  // ==========================================================================
  // BOOKING
  // ==========================================================================

  /**
   * Book a shipment with the specified provider
   */
  async bookShipment(
    provider: ShippingProviderCode,
    request: BookingRequest
  ): Promise<ShipmentBookingResult> {
    const providerInstance = this.registry.get(provider);
    if (!providerInstance) {
      throw new Error(`Provider ${provider} not found`);
    }

    console.log('[ShippingService] Booking shipment', {
      provider,
      orderId: request.orderId,
      quoteId: request.quoteId,
    });

    const result = await providerInstance.bookShipment(request);

    console.log('[ShippingService] Shipment booked successfully', {
      provider,
      trackingNumber: result.trackingNumber,
    });

    return result;
  }

  // ==========================================================================
  // TRACKING
  // ==========================================================================

  /**
   * Track a shipment by tracking number
   * Tries all providers if provider is not specified
   */
  async trackShipment(
    trackingNumber: string,
    provider?: ShippingProviderCode
  ): Promise<TrackingResult> {
    // If provider is specified, use it directly
    if (provider) {
      const providerInstance = this.registry.get(provider);
      if (!providerInstance) {
        throw new Error(`Provider ${provider} not found`);
      }
      return providerInstance.trackShipment(trackingNumber);
    }

    // Try all providers
    const providers = this.registry.getAll();
    const errors: string[] = [];

    for (const p of providers) {
      try {
        const result = await p.trackShipment(trackingNumber);
        return result;
      } catch (error) {
        errors.push(
          `${p.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    throw new Error(
      `Shipment not found. Tried providers: ${errors.join(', ')}`
    );
  }

  // ==========================================================================
  // CANCELLATION
  // ==========================================================================

  /**
   * Cancel a shipment
   */
  async cancelShipment(
    provider: ShippingProviderCode,
    shipmentId: string
  ): Promise<CancellationResult> {
    const providerInstance = this.registry.get(provider);
    if (!providerInstance) {
      throw new Error(`Provider ${provider} not found`);
    }

    console.log('[ShippingService] Cancelling shipment', {
      provider,
      shipmentId,
    });

    return await providerInstance.cancelShipment(shipmentId);
  }

  // ==========================================================================
  // LOCATIONS
  // ==========================================================================

  /**
   * Get Nigerian locations from all providers
   */
  async getNigerianLocations(): Promise<UnifiedLocation[]> {
    const allLocations: UnifiedLocation[] = [];
    const seenCities = new Set<string>();

    for (const provider of this.registry.getDomestic()) {
      if (provider.getLocations) {
        try {
          const locations = await provider.getLocations('NG');
          for (const loc of locations) {
            const key = `${loc.state}-${loc.city}`.toLowerCase();
            if (!seenCities.has(key)) {
              seenCities.add(key);
              allLocations.push(loc);
            }
          }
        } catch (error) {
          console.error(
            '[ShippingService] Failed to get locations from provider:',
            provider.name,
            error
          );
        }
      }
    }

    return allLocations;
  }

  // ==========================================================================
  // HEALTH CHECK
  // ==========================================================================

  /**
   * Check which providers are available
   */
  async getProviderStatus(): Promise<Record<ShippingProviderCode, boolean>> {
    const status: Record<string, boolean> = {};

    for (const provider of this.registry.getAll()) {
      try {
        status[provider.code] = await provider.isAvailable();
      } catch {
        status[provider.code] = false;
      }
    }

    return status as Record<ShippingProviderCode, boolean>;
  }

  /**
   * Get list of enabled providers
   */
  getEnabledProviders(): ShippingProviderCode[] {
    return this.registry.getAll().map((p) => p.code);
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const shippingService = new ShippingService();

// =============================================================================
// RE-EXPORTS
// =============================================================================

export * from './aggregator';
export {
  type ShippingProvider,
  ShippingProviderRegistry,
} from './providers/base';
export * from './status-mapper';
export * from './types';
