/**
 * Google Place Details API Route
 * Server-side proxy to keep API key secure
 */

import { type NextRequest, NextResponse } from 'next/server';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const PLACES_API_BASE = 'https://places.googleapis.com/v1';

export async function GET(request: NextRequest) {
  try {
    if (!GOOGLE_MAPS_API_KEY) {
      console.error('GOOGLE_MAPS_API_KEY not configured');
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

    // Ensure placeId is in the format "places/ID"
    const resourceName = placeId.startsWith('places/') ? placeId : `places/${placeId}`;

    // Fields we need for address parsing
    const fields = [
      'addressComponents',
      'formattedAddress',
      'location',
    ].join(',');

    const response = await fetch(`${PLACES_API_BASE}/${resourceName}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': fields,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Place Details API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch place details', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Parse address components
    const components = data.addressComponents || [];

    const getComponent = (type: string) =>
      components.find((c: any) => c.types.includes(type))?.longText || '';

    const details = {
      placeId: data.name,
      formattedAddress: data.formattedAddress || '',
      streetNumber: getComponent('street_number'),
      route: getComponent('route'),
      city: getComponent('locality') || getComponent('administrative_area_level_2'),
      state: getComponent('administrative_area_level_1'),
      country: getComponent('country'),
      postalCode: getComponent('postal_code'),
      location: data.location || null,
    };

    return NextResponse.json({ details });
  } catch (error) {
    console.error('Place details error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
