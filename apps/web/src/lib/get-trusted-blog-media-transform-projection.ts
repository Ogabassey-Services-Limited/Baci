import { DEFAULT_BLOG_MEDIA_CDN_ORIGIN } from '@/config/cdn';

const MIN_TRANSFORM_DIMENSION = 16;
const MAX_TRANSFORM_DIMENSION = 3840;

function getTransformDimension(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(
    MIN_TRANSFORM_DIMENSION,
    Math.min(MAX_TRANSFORM_DIMENSION, parsed)
  );
}

/** Parses fixed output metadata only from configured blog transformers. */
export function getTrustedBlogMediaTransformProjection(url: string):
  | {
      fit: 'cover' | 'inside';
      height?: number;
      type?: `image/${string}`;
      width?: number;
    }
  | undefined {
  try {
    const parsedUrl = new URL(url);
    const trustedOrigins = [
      process.env.NEXT_PUBLIC_BLOG_MEDIA_CDN_ORIGIN,
      DEFAULT_BLOG_MEDIA_CDN_ORIGIN,
    ].flatMap((value) => {
      if (!value) return [];
      try {
        return [new URL(value).origin];
      } catch {
        return [];
      }
    });
    const options = parsedUrl.pathname.match(/^\/image\/([^/]+)\//)?.[1];
    if (
      parsedUrl.protocol !== 'https:' ||
      !trustedOrigins.includes(parsedUrl.origin) ||
      !options
    ) {
      return undefined;
    }

    const entries = new Map(
      options.split(',').flatMap((token) => {
        const [rawName, rawValue] = token.split('=', 2);
        return rawName && rawValue !== undefined
          ? [[rawName.trim().toLowerCase(), rawValue.trim().toLowerCase()]]
          : [];
      })
    );
    const format = entries.get('format') ?? entries.get('f') ?? 'auto';
    const type =
      format === 'jpg' || format === 'jpeg'
        ? 'image/jpeg'
        : format === 'png'
          ? 'image/png'
          : format === 'webp'
            ? 'image/webp'
            : format === 'avif'
              ? 'image/avif'
              : undefined;
    const width = getTransformDimension(
      entries.get('width') ?? entries.get('w')
    );
    const height = getTransformDimension(
      entries.get('height') ?? entries.get('h')
    );

    return {
      fit:
        entries.get('fit') === 'cover'
          ? ('cover' as const)
          : ('inside' as const),
      ...(type ? { type } : {}),
      ...(width ? { width } : {}),
      ...(height ? { height } : {}),
    };
  } catch {
    return undefined;
  }
}
