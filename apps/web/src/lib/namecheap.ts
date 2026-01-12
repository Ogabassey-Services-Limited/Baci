/**
 * Namecheap API Integration (Fallback for domain availability)
 * Documentation: https://www.namecheap.com/support/api/
 *
 * Note: This is a fallback when Go54 is unavailable.
 * Requires NAMECHEAP_API_USER and NAMECHEAP_API_KEY in .env.local
 */

const NAMECHEAP_API_URL = 'https://api.namecheap.com/xml.response';
const NAMECHEAP_API_USER = process.env.NAMECHEAP_API_USER || '';
const NAMECHEAP_API_KEY = process.env.NAMECHEAP_API_KEY || '';
const NAMECHEAP_CLIENT_IP = process.env.NAMECHEAP_CLIENT_IP || '127.0.0.1';

export interface NamecheapDomainResult {
  domain: string;
  available: boolean;
  isPremium: boolean;
  premiumPrice?: number;
}

/**
 * Check if Namecheap API is configured
 */
export function isNamecheapConfigured(): boolean {
  return Boolean(NAMECHEAP_API_USER && NAMECHEAP_API_KEY);
}

/**
 * Check domain availability via Namecheap API
 *
 * @param domains - Array of full domain names to check (e.g., ["example.com", "example.net"])
 * @returns Array of domain availability results
 */
export async function checkNamecheapAvailability(
  domains: string[]
): Promise<NamecheapDomainResult[]> {
  if (!isNamecheapConfigured()) {
    console.warn('Namecheap API not configured - skipping fallback');
    if (!NAMECHEAP_API_USER) console.warn('Missing NAMECHEAP_API_USER');
    if (!NAMECHEAP_API_KEY) console.warn('Missing NAMECHEAP_API_KEY');
    return [];
  }

  try {
    const domainList = domains.join(',');

    const params = new URLSearchParams({
      ApiUser: NAMECHEAP_API_USER,
      ApiKey: NAMECHEAP_API_KEY,
      UserName: NAMECHEAP_API_USER,
      ClientIp: NAMECHEAP_CLIENT_IP,
      Command: 'namecheap.domains.check',
      DomainList: domainList,
    });

    const response = await fetch(`${NAMECHEAP_API_URL}?${params}`, {
      method: 'GET',
    });

    if (!response.ok) {
      console.error(
        'Namecheap API error:',
        response.status,
        response.statusText
      );
      return [];
    }

    const xmlText = await response.text();

    // Parse XML response (simple regex-based parsing for Namecheap's format)
    const results: NamecheapDomainResult[] = [];

    // Match DomainCheckResult elements
    const domainMatches = xmlText.matchAll(
      /<DomainCheckResult\s+Domain="([^"]+)"\s+Available="([^"]+)"(?:\s+IsPremiumName="([^"]+)")?(?:\s+PremiumRegistrationPrice="([^"]+)")?/g
    );

    for (const match of domainMatches) {
      results.push({
        domain: match[1],
        available: match[2].toLowerCase() === 'true',
        isPremium: match[3]?.toLowerCase() === 'true' || false,
        premiumPrice: match[4] ? Number.parseFloat(match[4]) : undefined,
      });
    }

    return results;
  } catch (error) {
    console.error('Namecheap API error:', error);
    return [];
  }
}

/**
 * Get domain suggestions from Namecheap
 * Note: Requires a different API command
 */
export function getNamecheapSuggestions(_keyword: string): string[] {
  // Namecheap doesn't have a public suggestions API
  // Return empty - we rely on Go54 for suggestions
  return [];
}
