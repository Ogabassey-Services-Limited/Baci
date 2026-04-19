import { ImageResponse } from 'next/og';
import {
  getCurrencyForCountry,
  getLocaleForCountry,
} from '@/lib/currency-utils';
import { createAdminClient } from '@/lib/supabase/admin';

export const alt = 'Product Preview';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

interface ImageProps {
  params: Promise<{ slug: string; category: string; productSlug: string }>;
}

export default async function Image({ params }: ImageProps) {
  const { slug, productSlug } = await params;

  // Fetch merchant and product data
  const supabase = createAdminClient();

  // Get merchant
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id, business_name, logo_url, brand_colors, country')
    .eq('slug', slug)
    .single();

  if (!merchant) {
    return new ImageResponse(
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a1a2e',
          color: 'white',
        }}
      >
        <div style={{ fontSize: 60, fontWeight: 'bold' }}>
          Product Not Found
        </div>
      </div>,
      { ...size }
    );
  }

  // Get product - try by slug first, then by ID
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      productSlug
    );

  let productQuery = supabase
    .from('products')
    .select('id, name, price, images, description')
    .eq('merchant_id', merchant.id);

  if (isUuid) {
    productQuery = productQuery.or(
      `slug.eq.${productSlug},id.eq.${productSlug}`
    );
  } else {
    productQuery = productQuery.eq('slug', productSlug);
  }

  const { data: product } = await productQuery.single();

  if (!product) {
    return new ImageResponse(
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a1a2e',
          color: 'white',
        }}
      >
        <div style={{ fontSize: 60, fontWeight: 'bold' }}>
          Product Not Found
        </div>
      </div>,
      { ...size }
    );
  }

  // Get brand colors with fallbacks
  const primaryColor = merchant.brand_colors?.primary || '#3B82F6';
  const bgColor = merchant.brand_colors?.background || '#1a1a2e';
  const accentColor = merchant.brand_colors?.accent || '#F59E0B';

  // Get product image
  const productImage =
    Array.isArray(product.images) && product.images.length > 0
      ? product.images[0]
      : null;

  // Format price using merchant's country for currency and locale
  const currency = getCurrencyForCountry(merchant.country);
  const locale = getLocaleForCountry(merchant.country);
  let formattedPrice: string;
  try {
    formattedPrice = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'symbol',
    }).format(product.price || 0);
  } catch {
    // Fallback to basic USD formatting if locale/currency is invalid
    formattedPrice = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(product.price || 0);
  }

  return new ImageResponse(
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        backgroundColor: bgColor,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background gradient */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `linear-gradient(135deg, ${bgColor} 0%, ${primaryColor}15 50%, ${accentColor}15 100%)`,
        }}
      />

      {/* Decorative circle */}
      <div
        style={{
          position: 'absolute',
          top: -150,
          right: -150,
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: `${primaryColor}20`,
        }}
      />

      {/* Content container */}
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          padding: '50px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Left: Product Image */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '50%',
            padding: '20px',
          }}
        >
          {productImage ? (
            // biome-ignore lint/performance/noImgElement: Satori (OpenGraph image generation) requires img tags
            <img
              src={productImage}
              alt=""
              width={450}
              height={450}
              style={{
                objectFit: 'contain',
                borderRadius: 20,
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              }}
            />
          ) : (
            <div
              style={{
                width: 450,
                height: 450,
                borderRadius: 20,
                background: `${primaryColor}30`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 100,
              }}
            >
              📦
            </div>
          )}
        </div>

        {/* Right: Product Info */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            width: '50%',
            padding: '20px 40px',
          }}
        >
          {/* Store Logo/Name */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: 30,
              gap: 12,
            }}
          >
            {merchant.logo_url && (
              // biome-ignore lint/performance/noImgElement: Satori (OpenGraph image generation) requires img tags
              <img
                src={merchant.logo_url}
                alt=""
                width={40}
                height={40}
                style={{
                  objectFit: 'contain',
                  borderRadius: 8,
                }}
              />
            )}
            <span
              style={{
                fontSize: 24,
                color: 'rgba(255,255,255,0.7)',
                fontWeight: 500,
              }}
            >
              {merchant.business_name}
            </span>
          </div>

          {/* Product Name */}
          <div
            style={{
              fontSize: 52,
              fontWeight: 'bold',
              color: 'white',
              lineHeight: 1.2,
              marginBottom: 20,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {product.name}
          </div>

          {/* Price */}
          <div
            style={{
              fontSize: 48,
              fontWeight: 'bold',
              color: accentColor,
              marginBottom: 30,
            }}
          >
            {formattedPrice}
          </div>

          {/* CTA */}
          <div
            style={{
              display: 'flex',
              padding: '16px 36px',
              backgroundColor: primaryColor,
              borderRadius: 12,
              fontSize: 24,
              fontWeight: 600,
              color: 'white',
              width: 'fit-content',
            }}
          >
            Shop Now
          </div>
        </div>
      </div>

      {/* Bottom badge */}
      <div
        style={{
          position: 'absolute',
          bottom: 30,
          right: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 16,
          color: 'rgba(255,255,255,0.4)',
        }}
      >
        Powered by Baci
      </div>
    </div>,
    {
      ...size,
    }
  );
}
