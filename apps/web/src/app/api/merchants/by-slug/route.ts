import { createClient as createStaticClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';
import { getMerchantSlugCacheTag } from '@/lib/merchant-slug-cache-tag';

// Cached merchant lookup by slug
function createCachedMerchantFetcher(slug: string) {
  return unstable_cache(
    async () => {
      const supabase = createStaticClient(
        getSupabaseUrl(),
        getSupabaseAnonKey()
      );

      const { data: merchant, error } = await supabase
        .from('merchants')
        .select(
          'id, business_name, slug, logo_url, brand_colors, country, is_published'
        )
        .eq('slug', slug)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return merchant;
    },
    ['merchant-by-slug', slug],
    {
      revalidate: 300, // Cache for 5 minutes
      tags: ['merchant', getMerchantSlugCacheTag(slug)],
    }
  );
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const slug = searchParams.get('slug');

  if (!slug) {
    return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
  }

  try {
    const getCachedMerchant = createCachedMerchantFetcher(slug);
    const merchant = await getCachedMerchant();

    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { merchant },
      {
        headers: {
          'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
          'Vercel-CDN-Cache-Control': 'no-store',
          'CDN-Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching merchant by slug:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
