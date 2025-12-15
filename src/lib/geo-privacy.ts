/**
 * Geo-based Privacy Detection
 *
 * Detects user location for privacy compliance:
 * - CCPA (California Consumer Privacy Act) - California, USA
 * - GDPR (General Data Protection Regulation) - European Union
 *
 * Uses Vercel's geo headers when available, falls back to IP lookup.
 */

import { headers } from 'next/headers';

// US states with strong privacy laws requiring LDU
const PRIVACY_STATES = new Set([
  'CA', // California - CCPA
  'VA', // Virginia - VCDPA
  'CO', // Colorado - CPA
  'CT', // Connecticut - CTDPA
  'UT', // Utah - UCPA
]);

// EU countries (GDPR)
const EU_COUNTRIES = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
]);

export interface GeoPrivacyInfo {
  country?: string;
  region?: string; // State/Province
  city?: string;
  isCaliforniaUser: boolean;
  isUSPrivacyState: boolean;
  isEUUser: boolean;
  shouldApplyLDU: boolean; // True if any privacy law applies
}

/**
 * Detect user's geo location from Vercel headers
 * Vercel automatically adds these headers based on the request IP
 */
export async function getGeoFromHeaders(): Promise<GeoPrivacyInfo> {
  const headersList = await headers();

  // Vercel geo headers (available on Vercel deployments)
  const country = headersList.get('x-vercel-ip-country') || undefined;
  const region = headersList.get('x-vercel-ip-country-region') || undefined;
  const city = headersList.get('x-vercel-ip-city') || undefined;

  return analyzeGeoForPrivacy(country, region, city);
}

/**
 * Detect user's geo location from IP address using free API
 * Use this as fallback when Vercel headers aren't available
 * Includes timeout to prevent order processing delays
 */
export async function getGeoFromIP(ip: string): Promise<GeoPrivacyInfo> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

  try {
    // Use ip-api.com (free, no API key required, 45 requests/minute)
    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,regionName,city`,
      {
        next: { revalidate: 86400 }, // Cache for 24 hours
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      return getDefaultGeoInfo();
    }

    const data = await response.json();

    if (data.status !== 'success') {
      return getDefaultGeoInfo();
    }

    return analyzeGeoForPrivacy(data.countryCode, data.region, data.city);
  } catch (error) {
    clearTimeout(timeoutId);
    // Don't log abort errors as they're expected on timeout
    if (error instanceof Error && error.name !== 'AbortError') {
      console.error('[Geo Privacy] IP lookup failed:', error);
    }
    return getDefaultGeoInfo();
  }
}

/**
 * Analyze geo data for privacy compliance requirements
 */
function analyzeGeoForPrivacy(
  country?: string,
  region?: string,
  city?: string
): GeoPrivacyInfo {
  const isCaliforniaUser = country === 'US' && region === 'CA';
  const isUSPrivacyState =
    country === 'US' && region ? PRIVACY_STATES.has(region) : false;
  const isEUUser = country ? EU_COUNTRIES.has(country) : false;

  return {
    country,
    region,
    city,
    isCaliforniaUser,
    isUSPrivacyState,
    isEUUser,
    // Apply LDU if user is in any jurisdiction with strong privacy laws
    shouldApplyLDU: isCaliforniaUser || isUSPrivacyState || isEUUser,
  };
}

/**
 * Get default geo info when detection fails
 * Defaults to NOT applying LDU (false negatives are better than false positives for UX)
 */
function getDefaultGeoInfo(): GeoPrivacyInfo {
  return {
    isCaliforniaUser: false,
    isUSPrivacyState: false,
    isEUUser: false,
    shouldApplyLDU: false,
  };
}

/**
 * Server action to get geo privacy info for the current request
 * Can be used in Server Components or API routes
 */
export async function detectPrivacyRegion(
  ip?: string
): Promise<GeoPrivacyInfo> {
  // First try Vercel headers (fastest, most reliable on Vercel)
  const geoFromHeaders = await getGeoFromHeaders();

  if (geoFromHeaders.country) {
    return geoFromHeaders;
  }

  // Fallback to IP lookup if we have an IP
  if (ip) {
    return getGeoFromIP(ip);
  }

  return getDefaultGeoInfo();
}

/**
 * Quick check if LDU should be applied
 * Use this in API routes for quick decisions
 */
export async function shouldApplyLimitedDataUse(ip?: string): Promise<boolean> {
  const geoInfo = await detectPrivacyRegion(ip);
  return geoInfo.shouldApplyLDU;
}
