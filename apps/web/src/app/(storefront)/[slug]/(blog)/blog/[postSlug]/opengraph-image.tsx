import { ImageResponse } from 'next/og';
import type { ReactElement } from 'react';
import {
  getBlogOgBrandColors,
  getTransparentBlogOgBrandColors,
} from '@/app/(storefront)/[slug]/(blog)/blog/[postSlug]/opengraph-image-colors';
import {
  getMerchantBlogOgImageData,
  getMerchantBlogOgMetadataData,
  type MerchantBlogOgImageData,
  type RemoteImageLoadStatus,
} from '@/app/(storefront)/[slug]/(blog)/blog/[postSlug]/opengraph-image-data';

export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';
// Keep the route response dynamic so transient image-load fallbacks can retry on the next crawler request.
export const revalidate = 0;
export const runtime = 'nodejs';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' };

type ImageProps = { params: Promise<{ slug: string; postSlug: string }> };

function truncate(value: string | null | undefined, maxLength: number): string {
  if (!value) return '';
  if (maxLength <= 0) return '';
  if (maxLength <= 3 && value.length > maxLength) {
    return '.'.repeat(maxLength);
  }
  return value.length > maxLength
    ? `${value.slice(0, maxLength - 3)}...`
    : value;
}

function isTransientImageStatus(status: RemoteImageLoadStatus): boolean {
  return !['source_missing', 'source_disallowed', 'loaded'].includes(status);
}

function createImageResponse(element: ReactElement, noStore = false) {
  return new ImageResponse(element, {
    ...size,
    ...(noStore ? { headers: NO_STORE_HEADERS } : {}),
  });
}

function renderGenericFallback(title: string) {
  return (
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
      <div style={{ fontSize: 60, fontWeight: 400 }}>{title}</div>
    </div>
  );
}

function renderMerchantFallback(data: MerchantBlogOgImageData, title: string) {
  const colors = getBlogOgBrandColors(data);
  const transparentColors = getTransparentBlogOgBrandColors(colors);

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: colors.background,
        color: 'white',
        padding: '60px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(135deg, ${colors.background} 0%, ${transparentColors.primary20} 55%, ${transparentColors.accent15} 100%)`,
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {data.logoDataUri ? (
          // biome-ignore lint/performance/noImgElement: Satori requires img tags for ImageResponse rendering
          <img
            src={data.logoDataUri}
            alt=""
            width={64}
            height={64}
            style={{ borderRadius: 14, objectFit: 'contain' }}
          />
        ) : null}
        <div style={{ fontSize: 30, fontWeight: 400 }}>
          {data.merchantBusinessName}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          maxWidth: 880,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            color: `${colors.accent}`,
            fontSize: 24,
            fontWeight: 400,
            textTransform: 'uppercase',
          }}
        >
          Blog
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 400,
            lineHeight: 1.05,
          }}
        >
          {truncate(title, 96)}
        </div>
      </div>
    </div>
  );
}

function renderPrimaryCard(data: MerchantBlogOgImageData) {
  const colors = getBlogOgBrandColors(data);
  const transparentColors = getTransparentBlogOgBrandColors(colors);
  const post = data.post;
  const title = post?.title || 'Blog post';

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        backgroundColor: colors.background,
        color: 'white',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: 650,
          height: '100%',
          display: 'flex',
          backgroundColor: transparentColors.primary13,
        }}
      >
        {data.featuredDataUri ? (
          // biome-ignore lint/performance/noImgElement: Satori requires img tags for ImageResponse rendering
          <img
            src={data.featuredDataUri}
            alt=""
            width={650}
            height={630}
            style={{ objectFit: 'cover' }}
          />
        ) : null}
      </div>
      <div
        style={{
          width: 550,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px',
          background: `linear-gradient(135deg, ${colors.background} 0%, ${transparentColors.primary15} 100%)`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          {data.logoDataUri ? (
            // biome-ignore lint/performance/noImgElement: Satori requires img tags for ImageResponse rendering
            <img
              src={data.logoDataUri}
              alt=""
              width={54}
              height={54}
              style={{ borderRadius: 12, objectFit: 'contain' }}
            />
          ) : null}
          <div style={{ fontSize: 26, fontWeight: 400 }}>
            {data.merchantBusinessName}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {post?.category ? (
            <div
              style={{
                color: colors.accent,
                fontSize: 22,
                fontWeight: 400,
                textTransform: 'uppercase',
              }}
            >
              {post.category}
            </div>
          ) : null}
          <div
            style={{
              fontSize: 56,
              fontWeight: 400,
              lineHeight: 1.08,
            }}
          >
            {truncate(title, 82)}
          </div>
          {post?.author_name ? (
            <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 22 }}>
              By {post.author_name}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export async function generateImageMetadata({ params }: ImageProps) {
  const { slug, postSlug } = await params;
  const data = await getMerchantBlogOgMetadataData(slug, postSlug);
  const alt = data?.post?.title
    ? `${data.post.title} — ${data.merchantBusinessName}`
    : 'Blog post';

  return [
    {
      id: 'merchant-blog-og',
      alt,
      size,
      contentType,
    },
  ];
}

export default async function Image({ params }: ImageProps) {
  const { slug, postSlug } = await params;
  const data = await getMerchantBlogOgImageData(slug, postSlug);

  if (!data) {
    return createImageResponse(renderGenericFallback('Post Not Found'), true);
  }

  if (!data.post) {
    return createImageResponse(renderMerchantFallback(data, 'Post Not Found'));
  }

  if (!data.featuredDataUri) {
    return createImageResponse(
      renderMerchantFallback(data, data.post.title || 'Blog post'),
      isTransientImageStatus(data.featuredImageStatus)
    );
  }

  return createImageResponse(renderPrimaryCard(data));
}
