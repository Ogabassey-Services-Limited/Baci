/**
 * Google Place Details API Route (New API - places.googleapis.com)
 * Server-side proxy to keep API key secure.
 * Uses retry logic to handle transient network errors like ECONNRESET.
 */

import { type NextRequest, NextResponse } from 'next/server';

const GOOGLE_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
const NEW_PLACES_API_BASE = 'https://places.googleapis.com/v1';

// Simple retry wrapper for fetch
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 2,
  delay = 500
): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch (error: unknown) {
    const isRetryable =
      error instanceof Error &&
      (error.message.includes('ECONNRESET') ||
        error.message.includes('fetch failed') ||
        error.message.includes('socket'));

    if (isRetryable && retries > 0) {
      console.warn(`[Places API] Fetch failed, retrying... (${retries} left)`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!GOOGLE_API_KEY) {
      console.error(
        '[Places API] GOOGLE_MAPS_API_KEY or GOOGLE_PLACES_API_KEY not configured'
      );
      return NextResponse.json(
        { error: 'Google Places API not configured' },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const placeId = searchParams.get('placeId');

    if (!placeId) {
      return NextResponse.json(
        { error: 'placeId is required' },
        { status: 400 }
      );
    }

    // Validate placeId format to prevent SSRF attacks
    // Google Place IDs are alphanumeric with some special chars, max ~300 chars
    const placeIdPattern = /^[A-Za-z0-9_-]{1,300}$/;
    const cleanPlaceId = placeId.startsWith('places/')
      ? placeId.slice(7)
      : placeId;

    if (!placeIdPattern.test(cleanPlaceId)) {
      return NextResponse.json(
        { error: 'Invalid placeId format' },
        { status: 400 }
      );
    }

    // Construct resource name safely
    const resourceName = `places/${cleanPlaceId}`;

    // Fields we need for address parsing
    const fields = [
      'addressComponents',
      'formattedAddress',
      'location',
      'reviews',
      'rating',
      'userRatingCount',
    ].join(',');

    const response = await fetchWithRetry(
      `${NEW_PLACES_API_BASE}/${resourceName}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_API_KEY,
          'X-Goog-FieldMask': fields,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Places API] Details error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch place details', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Parse address components (New API format uses `longText`)
    interface AddressComponent {
      types?: string[];
      longText?: string;
    }
    const components: AddressComponent[] = Array.isArray(data.addressComponents)
      ? data.addressComponents
      : [];

    const getComponent = (type: string) =>
      components.find((component) => component.types?.includes(type))
        ?.longText || '';

    const details = {
      placeId: data.name,
      formattedAddress: data.formattedAddress || '',
      streetNumber: getComponent('street_number'),
      route: getComponent('route'),
      city:
        getComponent('locality') || getComponent('administrative_area_level_2'),
      state: getComponent('administrative_area_level_1'),
      country: getComponent('country'),
      postalCode: getComponent('postal_code'),
      location: data.location || null,
    };

    return NextResponse.json({ details });
  } catch (error) {
    console.error('[Places API] Details error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
