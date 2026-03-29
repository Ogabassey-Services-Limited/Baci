function toAbsoluteImageUrl(baseUrl: string, imageUrl?: string | null) {
  if (!imageUrl?.trim()) {
    return null;
  }

  try {
    return new URL(imageUrl, baseUrl).toString();
  } catch {
    return null;
  }
}

function getDefaultStorefrontSocialImageUrl(baseUrl: string) {
  try {
    return new URL('/opengraph-image', baseUrl).toString();
  } catch {
    return null;
  }
}

export function getStorefrontSocialImageUrl(
  baseUrl: string,
  ...candidates: Array<string | null | undefined>
) {
  for (const candidate of candidates) {
    const absoluteUrl = toAbsoluteImageUrl(baseUrl, candidate);
    if (absoluteUrl) {
      return absoluteUrl;
    }
  }

  return getDefaultStorefrontSocialImageUrl(baseUrl);
}

export function getStorefrontOpenGraphImages(
  baseUrl: string,
  alt: string,
  ...candidates: Array<string | null | undefined>
) {
  const imageUrl = getStorefrontSocialImageUrl(baseUrl, ...candidates);

  return imageUrl
    ? [
        {
          url: imageUrl,
          alt,
        },
      ]
    : [];
}

export function getStorefrontTwitterImages(
  baseUrl: string,
  ...candidates: Array<string | null | undefined>
) {
  const imageUrl = getStorefrontSocialImageUrl(baseUrl, ...candidates);

  return imageUrl ? [imageUrl] : [];
}
