/**
 * Shipping Providers API
 * Get available shipping providers and their status
 */

import { NextResponse } from 'next/server';
import { shippingService } from '@/lib/shipping';

// =============================================================================
// GET /api/shipping/providers - Get provider status
// =============================================================================

export async function GET() {
  try {
    // Get status of all providers
    const status = await shippingService.getProviderStatus();

    // Get list of enabled providers
    const enabledProviders = shippingService.getEnabledProviders();

    // Provider metadata
    const providerInfo = {
      GIGL: {
        name: 'GIG Logistics',
        displayName: 'GIG Logistics',
        supportsDomestic: true,
        supportsInternational: true,
        hasStationPickup: true,
        description:
          'Nigerian logistics company with nationwide and international coverage',
      },
      TOPSHIP: {
        name: 'Topship',
        displayName: 'Multiple Carriers',
        supportsDomestic: true,
        supportsInternational: true,
        hasStationPickup: false,
        description: 'Aggregator with access to DHL, FedEx, UPS, and more',
      },
    };

    // Build response
    const providers = enabledProviders.map((code) => ({
      code,
      ...providerInfo[code as keyof typeof providerInfo],
      available: status[code] ?? false,
    }));

    return NextResponse.json({
      providers,
      status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting provider status:', error);
    return NextResponse.json(
      { error: 'Failed to get provider status' },
      { status: 500 }
    );
  }
}
