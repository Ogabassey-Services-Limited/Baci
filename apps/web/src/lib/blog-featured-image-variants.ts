import sharp from 'sharp';
import type { BlogFeaturedVariantKey } from './blog-managed-storage-paths';

export type { BlogFeaturedVariantKey } from './blog-managed-storage-paths';
export {
  BLOG_FEATURED_VARIANT_KEYS,
  extractManagedBlogStoragePath,
  isManagedBlogStoragePath,
} from './blog-managed-storage-paths';

const MIN_FEATURED_WIDTH = 1200;
const MIN_FEATURED_HEIGHT = 675;
const MIN_DISCOVER_TOTAL_PIXELS = 300_000;
const DEFAULT_OPTIONAL_VARIANT_MIN_PIXELS = 50_000;
const DEFAULT_MAX_DECODED_PIXELS = 40_000_000;
const DEFAULT_PROCESSING_TIMEOUT_MS = 4_000;

export type BlogFeaturedImageErrorCode =
  | 'FEATURED_IMAGE_GIF_NOT_ALLOWED'
  | 'FEATURED_IMAGE_DIMENSIONS_TOO_SMALL'
  | 'FEATURED_IMAGE_TOTAL_PIXELS_TOO_LOW'
  | 'FEATURED_IMAGE_PIXELS_TOO_LARGE'
  | 'FEATURED_IMAGE_METADATA_UNREADABLE'
  | 'FEATURED_IMAGE_PROCESSING_TIMEOUT'
  | 'FEATURED_IMAGE_PROCESSING_FAILED';

export class BlogFeaturedImageError extends Error {
  readonly code: BlogFeaturedImageErrorCode;

  constructor(code: BlogFeaturedImageErrorCode, message: string) {
    super(message);
    Object.setPrototypeOf(this, BlogFeaturedImageError.prototype);
    this.name = 'BlogFeaturedImageError';
    this.code = code;
  }
}

export interface BlogFeaturedImageVariant {
  key: BlogFeaturedVariantKey;
  width: number;
  height: number;
  contentType: 'image/webp';
  buffer: Buffer;
}

export interface BlogFeaturedImageVariantsResult {
  source: {
    width: number;
    height: number;
    totalPixels: number;
  };
  variants: {
    landscape_16x9: BlogFeaturedImageVariant;
    standard_4x3?: BlogFeaturedImageVariant;
    square_1x1?: BlogFeaturedImageVariant;
  };
}

export interface GenerateFeaturedImageVariantsOptions {
  mimeType: string;
  processingTimeoutMs?: number;
  maxDecodedPixelArea?: number;
  minimumOptionalPixelArea?: number;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  // NOTE: This does not cancel underlying work (e.g., Sharp still completes in the background).
  // We fail fast at the request layer and keep the route synchronous-budget safe.
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new BlogFeaturedImageError('FEATURED_IMAGE_PROCESSING_TIMEOUT', message)
      );
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function getLargestNoUpscaleCrop(
  sourceWidth: number,
  sourceHeight: number,
  ratioWidth: number,
  ratioHeight: number
): { width: number; height: number } {
  const ratio = ratioWidth / ratioHeight;
  const sourceRatio = sourceWidth / sourceHeight;

  if (sourceRatio >= ratio) {
    const width = Math.floor(sourceHeight * ratio);
    return { width, height: sourceHeight };
  }

  const height = Math.floor(sourceWidth / ratio);
  return { width: sourceWidth, height };
}

function normalizeImageProcessingError(error: unknown): never {
  if (error instanceof BlogFeaturedImageError) {
    throw error;
  }

  const errorMessage = error instanceof Error ? error.message : '';
  const metadataFailurePatterns = [
    'unsupported image format',
    'input buffer has corrupt header',
    'input file is missing',
    'vips',
  ];

  if (
    errorMessage &&
    metadataFailurePatterns.some((pattern) =>
      errorMessage.toLowerCase().includes(pattern)
    )
  ) {
    throw new BlogFeaturedImageError(
      'FEATURED_IMAGE_METADATA_UNREADABLE',
      'Unable to read featured image metadata.'
    );
  }

  throw new BlogFeaturedImageError(
    'FEATURED_IMAGE_PROCESSING_FAILED',
    errorMessage || 'Failed to process featured image'
  );
}

export async function generateFeaturedImageVariants(
  sourceBuffer: Buffer,
  options: GenerateFeaturedImageVariantsOptions
): Promise<BlogFeaturedImageVariantsResult> {
  const {
    mimeType,
    processingTimeoutMs = DEFAULT_PROCESSING_TIMEOUT_MS,
    maxDecodedPixelArea = DEFAULT_MAX_DECODED_PIXELS,
    minimumOptionalPixelArea = DEFAULT_OPTIONAL_VARIANT_MIN_PIXELS,
  } = options;

  if (mimeType === 'image/gif') {
    throw new BlogFeaturedImageError(
      'FEATURED_IMAGE_GIF_NOT_ALLOWED',
      'GIF images are not allowed for featured blog images.'
    );
  }

  try {
    const metadata = await withTimeout(
      sharp(sourceBuffer).metadata(),
      processingTimeoutMs,
      'Featured image metadata read timed out.'
    );

    if (!metadata.width || !metadata.height) {
      throw new BlogFeaturedImageError(
        'FEATURED_IMAGE_METADATA_UNREADABLE',
        'Unable to read featured image dimensions.'
      );
    }

    const sourceWidth = metadata.width;
    const sourceHeight = metadata.height;
    const totalPixels = sourceWidth * sourceHeight;

    if (totalPixels > maxDecodedPixelArea) {
      throw new BlogFeaturedImageError(
        'FEATURED_IMAGE_PIXELS_TOO_LARGE',
        `Featured image is too large to process safely (${totalPixels.toLocaleString()} pixels).`
      );
    }

    if (totalPixels < MIN_DISCOVER_TOTAL_PIXELS) {
      throw new BlogFeaturedImageError(
        'FEATURED_IMAGE_TOTAL_PIXELS_TOO_LOW',
        `Featured image must have at least ${MIN_DISCOVER_TOTAL_PIXELS.toLocaleString()} pixels.`
      );
    }

    if (
      sourceWidth < MIN_FEATURED_WIDTH ||
      sourceHeight < MIN_FEATURED_HEIGHT
    ) {
      throw new BlogFeaturedImageError(
        'FEATURED_IMAGE_DIMENSIONS_TOO_SMALL',
        `Featured image must be at least ${MIN_FEATURED_WIDTH}x${MIN_FEATURED_HEIGHT}.`
      );
    }

    const landscapeBuffer = await withTimeout(
      sharp(sourceBuffer)
        .rotate()
        .resize(MIN_FEATURED_WIDTH, MIN_FEATURED_HEIGHT, {
          fit: 'cover',
          position: 'attention',
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toBuffer(),
      processingTimeoutMs,
      'Featured image variant processing timed out.'
    );

    const variants: BlogFeaturedImageVariantsResult['variants'] = {
      landscape_16x9: {
        key: 'landscape_16x9',
        width: MIN_FEATURED_WIDTH,
        height: MIN_FEATURED_HEIGHT,
        contentType: 'image/webp',
        buffer: landscapeBuffer,
      },
    };

    const optionalVariants = [
      {
        key: 'standard_4x3' as const,
        ratioWidth: 4,
        ratioHeight: 3,
      },
      {
        key: 'square_1x1' as const,
        ratioWidth: 1,
        ratioHeight: 1,
      },
    ];

    for (const optionalVariant of optionalVariants) {
      const crop = getLargestNoUpscaleCrop(
        sourceWidth,
        sourceHeight,
        optionalVariant.ratioWidth,
        optionalVariant.ratioHeight
      );

      if (crop.width * crop.height < minimumOptionalPixelArea) {
        continue;
      }

      const variantBuffer = await withTimeout(
        sharp(sourceBuffer)
          .rotate()
          .resize(crop.width, crop.height, {
            fit: 'cover',
            position: 'attention',
            withoutEnlargement: true,
          })
          .webp({ quality: 85 })
          .toBuffer(),
        processingTimeoutMs,
        'Featured image variant processing timed out.'
      );

      variants[optionalVariant.key] = {
        key: optionalVariant.key,
        width: crop.width,
        height: crop.height,
        contentType: 'image/webp',
        buffer: variantBuffer,
      };
    }

    return {
      source: {
        width: sourceWidth,
        height: sourceHeight,
        totalPixels,
      },
      variants,
    };
  } catch (error) {
    normalizeImageProcessingError(error);
  }
}
