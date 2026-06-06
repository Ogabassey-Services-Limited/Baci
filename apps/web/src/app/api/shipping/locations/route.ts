/**
 * Shipping Locations API
 * Get available Nigerian locations for shipping
 * Fetches from Topship API for accurate coverage, with static fallback.
 */

import { resolveLocationStateLabel } from '@baci/shared/lib';
import { type NextRequest, NextResponse } from 'next/server';
import { topshipProvider } from '@/lib/shipping/providers/topship';
import { locationsQuerySchema } from '@/schemas/shipping';
import {
  getFallbackCitiesForState,
  NIGERIAN_CITIES_FALLBACK,
  NIGERIAN_STATES_FALLBACK,
  shouldUseFallbackCitiesForState,
} from './fallback-locations';

// Cache for Topship data
let topshipStatesCache: {
  states: string[];
  stateCodeMap: Record<string, string>;
  expiry: number;
} | null = null;
const topshipCitiesCache: Map<string, { cities: string[]; expiry: number }> =
  new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// =============================================================================
// GET /api/shipping/locations - Get Nigerian locations
// =============================================================================

// react-doctor-disable-next-line react-doctor/nextjs-no-side-effect-in-get-handler -- Process-local Topship response cache only; no user, order, or database state is mutated by GET.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = locationsQuerySchema.safeParse({
      state: searchParams.get('state') ?? undefined,
      search: searchParams.get('search') ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { state, search } = parsed.data;

    // Try to get states from Topship, fall back to static list
    let states: string[] = NIGERIAN_STATES_FALLBACK;
    let stateCodeMap: Record<string, string> = {};

    // Check cache for Topship states
    if (topshipStatesCache && Date.now() < topshipStatesCache.expiry) {
      states = topshipStatesCache.states;
      stateCodeMap = topshipStatesCache.stateCodeMap;
    } else {
      // Try fetching from Topship
      try {
        const topshipStates = await topshipProvider.getStates('NG');
        if (topshipStates.length > 0) {
          states = topshipStates.map((s) => s.name);
          stateCodeMap = Object.fromEntries(
            topshipStates.map((s) => [s.name.toLowerCase(), s.code])
          );
          topshipStatesCache = {
            states,
            stateCodeMap,
            expiry: Date.now() + CACHE_TTL,
          };
        }
      } catch (error) {
        console.warn(
          '[Locations API] Failed to fetch Topship states, using fallback:',
          error
        );
      }
    }

    // Build locations response
    let locations: { state: string; city: string; stationName?: string }[] = [];

    // If filtering by state, return cities for that state
    if (state) {
      const matchedState = resolveLocationStateLabel(state, states);
      const hasMatchedState = states.includes(matchedState);

      if (hasMatchedState) {
        let cities: string[] = [];
        const stateCode = stateCodeMap[matchedState.toLowerCase()];
        const fallbackCities = getFallbackCitiesForState(matchedState);

        if (fallbackCities.length > 0) {
          // Topship's documented city endpoint is country-scoped, so use
          // curated state-specific suggestions and still allow typed cities.
          cities = fallbackCities;
        } else {
          // Check cache first for states not covered by fallback data.
          const cachedCities = topshipCitiesCache.get(
            matchedState.toLowerCase()
          );
          if (cachedCities && Date.now() < cachedCities.expiry) {
            cities = shouldUseFallbackCitiesForState(
              cachedCities.cities,
              matchedState
            )
              ? fallbackCities
              : cachedCities.cities;
          }
        }

        if (cities.length === 0 && stateCode) {
          try {
            const topshipCities = await topshipProvider.getCities(stateCode);
            if (topshipCities.length > 0) {
              const providerCities = topshipCities.map((c) => c.name);
              cities = shouldUseFallbackCitiesForState(
                providerCities,
                matchedState
              )
                ? fallbackCities
                : providerCities;
              if (cities.length > 0) {
                topshipCitiesCache.set(matchedState.toLowerCase(), {
                  cities,
                  expiry: Date.now() + CACHE_TTL,
                });
              }
            }
          } catch (error) {
            console.warn(
              '[Locations API] Failed to fetch Topship cities for',
              matchedState,
              error
            );
          }
        }

        // Fall back to static list if Topship fails
        if (cities.length === 0) {
          cities = fallbackCities.length > 0 ? fallbackCities : [matchedState];
        }

        locations = cities.map((city) => ({
          state: matchedState,
          city,
          stationName: city,
        }));
      }
    }

    // Filter by search query if provided
    if (search && search.length >= 2) {
      const searchLower = search.toLowerCase();

      if (locations.length > 0) {
        // Filter existing locations
        locations = locations.filter(
          (l) =>
            l.city.toLowerCase().includes(searchLower) ||
            l.state.toLowerCase().includes(searchLower)
        );
      } else {
        // Search across all states and cities (using fallback for search since it's expensive to fetch all)
        for (const [stateName, stateCities] of Object.entries(
          NIGERIAN_CITIES_FALLBACK
        )) {
          for (const city of stateCities) {
            if (
              city.toLowerCase().includes(searchLower) ||
              stateName.toLowerCase().includes(searchLower)
            ) {
              locations.push({ state: stateName, city, stationName: city });
            }
          }
        }
      }
    }

    return NextResponse.json({
      locations,
      totalCount: locations.length,
      states,
    });
  } catch (error) {
    console.error('Error getting locations:', error);
    return NextResponse.json(
      {
        locations: [],
        totalCount: 0,
        states: NIGERIAN_STATES_FALLBACK,
      },
      { status: 500 }
    );
  }
}
