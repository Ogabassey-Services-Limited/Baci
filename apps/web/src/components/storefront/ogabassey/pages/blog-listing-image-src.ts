const BLOG_IMAGE_FALLBACK_SRC = '/placeholder.png';

export function getBlogListingImageSrc(
  imageUrl: string | null | undefined
): string {
  const candidate = imageUrl?.trim();

  if (!candidate) {
    return BLOG_IMAGE_FALLBACK_SRC;
  }

  if (candidate.startsWith('/') && !candidate.startsWith('//')) {
    return candidate;
  }

  try {
    const parsedUrl = new URL(candidate);
    if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
      return candidate;
    }
  } catch {
    return BLOG_IMAGE_FALLBACK_SRC;
  }

  return BLOG_IMAGE_FALLBACK_SRC;
}
