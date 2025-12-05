import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ merchantSlug: string }>;
}): Promise<Metadata> {
  const { merchantSlug } = await params;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: merchant, error } = await supabase
    .from('merchants')
    .select(
      'favicon_svg_url, favicon_png_32_url, favicon_png_192_url, favicon_apple_touch_url, business_name, favicon_uploaded_at'
    )
    .eq('slug', merchantSlug)
    .single();

  if (error) {
    console.error('[favicon-layout] Supabase query error:', error.message);
  }

  if (!merchant) {
    return {}; // Fallback to default
  }

  const icons: Metadata['icons'] = {
    icon: [] as Array<{ url: string; type?: string; sizes?: string }>,
    apple: [] as Array<{ url: string; type?: string; sizes?: string }>,
  };

  // Add cache-busting timestamp to URLs
  const addTimestamp = (url: string | null) => {
    if (!url) return null;
    const timestamp = merchant.favicon_uploaded_at
      ? `?v=${new Date(merchant.favicon_uploaded_at).getTime()}`
      : '';
    return `${url}${timestamp}`;
  };

  // Prefer SVG for modern browsers
  if (merchant.favicon_svg_url) {
    const timestampedUrl = addTimestamp(merchant.favicon_svg_url);
    if (timestampedUrl) {
      (
        icons.icon as Array<{ url: string; type?: string; sizes?: string }>
      ).push({
        url: timestampedUrl,
        type: 'image/svg+xml',
      });
    }
  }

  // PNG fallbacks
  if (merchant.favicon_png_32_url) {
    const timestampedUrl = addTimestamp(merchant.favicon_png_32_url);
    if (timestampedUrl) {
      (
        icons.icon as Array<{ url: string; type?: string; sizes?: string }>
      ).push({
        url: timestampedUrl,
        sizes: '32x32',
        type: 'image/png',
      });
    }
  }

  if (merchant.favicon_png_192_url) {
    const timestampedUrl = addTimestamp(merchant.favicon_png_192_url);
    if (timestampedUrl) {
      (
        icons.icon as Array<{ url: string; type?: string; sizes?: string }>
      ).push({
        url: timestampedUrl,
        sizes: '192x192',
        type: 'image/png',
      });
    }
  }

  // Apple Touch Icon
  if (merchant.favicon_apple_touch_url) {
    const timestampedUrl = addTimestamp(merchant.favicon_apple_touch_url);
    if (timestampedUrl) {
      (
        icons.apple as Array<{ url: string; type?: string; sizes?: string }>
      ).push({
        url: timestampedUrl,
        sizes: '180x180',
        type: 'image/png',
      });
    }
  }

  return {
    title: merchant.business_name,
    icons,
  };
}

export default function MerchantMetadataLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
