import { apiGet, fetchWithCsrf } from '@/lib/api-client';
/**
 * Google Places API Client
 * Calls server-side API routes to keep API key secure
 * Uses GET requests since these are read-only operations (no CSRF needed)
 */

export interface PlacePrediction {
    placeId: string;
    mainText: string;
    secondaryText: string;
    fullText: string;
}

export interface GooglePlaceDetails {
    placeId: string;
    formattedAddress: string;
    streetNumber?: string;
    route?: string; // Street name
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
}

/**
 * Generate a random session token
 * Recommended for billing optimization
 */
export function generateSessionToken(): string {
    return crypto.randomUUID();
}

/**
 * Get place predictions via server-side API route
 */
export async function getPlacePredictions(
    input: string,
    sessionToken?: string,
    country?: string
): Promise<PlacePrediction[]> {
    if (!input || input.length < 2) return [];

    try {
        const params = new URLSearchParams({ input });
        if (sessionToken) params.append('sessionToken', sessionToken);
        if (country) params.append('country', country);

        const data = await apiGet<{ predictions: PlacePrediction[] }>(
            `/api/places/autocomplete?${params.toString()}`
        );

        return data.predictions || [];

    } catch (error) {
        console.error('Failed to fetch place predictions:', error);
        return [];
    }
}

/**
 * Get place details via server-side API route
 */
export async function getPlaceDetails(
    placeId: string,
    sessionToken?: string
): Promise<GooglePlaceDetails | null> {
    if (!placeId) return null;

    try {
        const data = await apiGet<{ details: GooglePlaceDetails }>(
            `/api/places/details?placeId=${encodeURIComponent(placeId)}`
        );

        return data.details || null;

    } catch (error) {
        console.error('Failed to fetch place details:', error);
        return null;
    }
}
