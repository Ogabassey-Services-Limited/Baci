/**
 * Shipping Locations API
 * Get available Nigerian locations for shipping
 */

import { type NextRequest, NextResponse } from 'next/server';
import { shippingService } from '@/lib/shipping';

// Cache locations for 24 hours
let cachedLocations: Awaited<ReturnType<typeof shippingService.getNigerianLocations>> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// =============================================================================
// GET /api/shipping/locations - Get Nigerian locations
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state');
    const search = searchParams.get('search');

    // Check cache
    const now = Date.now();
    if (!cachedLocations || now - cacheTimestamp > CACHE_TTL) {
      cachedLocations = await shippingService.getNigerianLocations();
      cacheTimestamp = now;
    }

    let locations = cachedLocations;

    // Filter by state
    if (state) {
      const stateLower = state.toLowerCase();
      locations = locations.filter(l =>
        l.state.toLowerCase() === stateLower
      );
    }

    // Filter by search query
    if (search && search.length >= 2) {
      const searchLower = search.toLowerCase();
      locations = locations.filter(l =>
        l.city.toLowerCase().includes(searchLower) ||
        l.state.toLowerCase().includes(searchLower) ||
        l.displayName?.toLowerCase().includes(searchLower)
      );
    }

    // Get unique states for dropdown
    const states = [...new Set(cachedLocations.map(l => l.state))].sort();

    return NextResponse.json({
      locations: locations.slice(0, 100), // Limit results
      totalCount: locations.length,
      states,
    });

  } catch (error) {
    console.error('Error getting locations:', error);
    return NextResponse.json(
      { error: 'Failed to get locations' },
      { status: 500 }
    );
  }
}
