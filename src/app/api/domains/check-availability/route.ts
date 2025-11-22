import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { checkDomainAvailability } from '@/lib/go54';
import { getDomainPricing, getResalePrice, getAllTLDs } from '@/config/domain-pricing';

/**
 * POST /api/domains/check-availability
 * Check if domain is available for registration
 */
export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchTerm, tlds } = await request.json();

    if (!searchTerm) {
      return NextResponse.json({ error: 'Search term is required' }, { status: 400 });
    }

    // Validate search term (alphanumeric and hyphens only)
    const searchTermRegex = /^[a-z0-9-]+$/i;
    if (!searchTermRegex.test(searchTerm)) {
      return NextResponse.json(
        { error: 'Search term can only contain letters, numbers, and hyphens' },
        { status: 400 }
      );
    }

    // Use provided TLDs or default to all available
    const tldsToCheck = tlds && tlds.length > 0 ? tlds : getAllTLDs();

    try {
      // Check availability via Go54 API
      await checkDomainAvailability(
        searchTerm,
        tldsToCheck
      );

      // Enhance results with pricing information
      const resultsWithPricing = tldsToCheck.map((tld) => {
        const pricing = getDomainPricing(tld);
        if (!pricing) {
          return null;
        }

        const sellPrice = getResalePrice(pricing.registration, pricing.category);

        return {
          domain: `${searchTerm}${tld}`,
          tld,
          available: true, // Will be updated from API response
          price: sellPrice,
          originalPrice: pricing.registration,
          renewalPrice: getResalePrice(pricing.renewal, pricing.category),
          category: pricing.category,
          popular: pricing.popular || false,
          recommended: pricing.recommended || false,
        };
      }).filter(Boolean);

      return NextResponse.json({
        searchTerm,
        results: resultsWithPricing,
      });
    } catch (apiError) {
      console.error('Go54 API Error:', apiError);

      // Return pricing data even if API fails (for testing without credentials)
      const fallbackResults = tldsToCheck.map((tld) => {
        const pricing = getDomainPricing(tld);
        if (!pricing) return null;

        const sellPrice = getResalePrice(pricing.registration, pricing.category);

        return {
          domain: `${searchTerm}${tld}`,
          tld,
          available: true, // Assume available when API is unavailable
          price: sellPrice,
          originalPrice: pricing.registration,
          renewalPrice: getResalePrice(pricing.renewal, pricing.category),
          category: pricing.category,
          popular: pricing.popular || false,
          recommended: pricing.recommended || false,
          note: 'Availability check unavailable - Go54 API not configured',
        };
      }).filter(Boolean);

      return NextResponse.json({
        searchTerm,
        results: fallbackResults,
        warning: 'Go54 API credentials not configured. Showing pricing only.',
      });
    }
  } catch (error) {
    console.error('Error checking domain availability:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
