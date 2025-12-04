/**
 * Google Places Autocomplete API Route
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
    const input = searchParams.get('input') || '';
    const sessionToken = searchParams.get('sessionToken') || undefined;
    const country = searchParams.get('country') || undefined;

    if (!input || input.length < 2) {
      return NextResponse.json({ predictions: [] });
    }

    // Build request body
    const body: Record<string, unknown> = {
      input,
      sessionToken,
    };

    // Add country restriction if provided
    if (country) {
      body.includedRegionCodes = [country.toUpperCase()];
    }

    const response = await fetch(`${PLACES_API_BASE}/places:autocomplete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Places API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch predictions', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Transform the response to our format
    // Filter to only include place predictions (not query predictions)
    const predictions = (data.suggestions || [])
      .filter((item: any) => item.placePrediction)
      .map((item: any) => {
        const placePrediction = item.placePrediction;
        return {
          placeId: placePrediction.placeId,
          mainText: placePrediction.structuredFormat?.mainText?.text || placePrediction.text?.text || '',
          secondaryText: placePrediction.structuredFormat?.secondaryText?.text || '',
          fullText: placePrediction.text?.text || '',
        };
      });

    return NextResponse.json({ predictions });
  } catch (error) {
    console.error('Places autocomplete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
