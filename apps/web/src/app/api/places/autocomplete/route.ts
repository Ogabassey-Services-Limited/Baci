/**
 * Google Places Autocomplete API Route (New API - places.googleapis.com)
 * Server-side proxy to keep API key secure.
 * Uses retry logic to handle transient network errors like ECONNRESET.
 */

import { type NextRequest, NextResponse } from 'next/server';

const GOOGLE_API_KEY =
  process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
const NEW_PLACES_API_URL =
  'https://places.googleapis.com/v1/places:autocomplete';

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
    const input = searchParams.get('input') || '';
    const sessionToken = searchParams.get('sessionToken') || undefined;
    const country = searchParams.get('country') || undefined;

    if (!input || input.length < 2) {
      return NextResponse.json({ predictions: [] });
    }

    // Build request body for New Places API
    const body: Record<string, unknown> = {
      input,
    };

    if (sessionToken) {
      body.sessionToken = sessionToken;
    }

    // Add country restriction if provided (uses includedRegionCodes for New API)
    if (country) {
      body.includedRegionCodes = [country.toUpperCase()];
    }

    const response = await fetchWithRetry(NEW_PLACES_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Places API] Error response:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch predictions', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Transform the New API response to our internal format
    interface PlaceSuggestion {
      placePrediction?: {
        placeId: string;
        structuredFormat?: {
          mainText?: { text?: string };
          secondaryText?: { text?: string };
        };
        text?: { text?: string };
      };
    }

    const predictions = (data.suggestions || [])
      .filter((item: PlaceSuggestion) => item.placePrediction)
      .map((item: PlaceSuggestion) => {
        const placePrediction = item.placePrediction;
        return {
          placeId: placePrediction?.placeId,
          mainText:
            placePrediction?.structuredFormat?.mainText?.text ||
            placePrediction?.text?.text ||
            '',
          secondaryText:
            placePrediction?.structuredFormat?.secondaryText?.text || '',
          fullText: placePrediction?.text?.text || '',
          description: placePrediction?.text?.text || '',
        };
      });

    return NextResponse.json({ predictions });
  } catch (error) {
    console.error('[Places API] Autocomplete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
