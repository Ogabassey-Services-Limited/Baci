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

  return new URL('/opengraph-image', baseUrl).toString();
}

export function getStorefrontOpenGraphImages(
  baseUrl: string,
  alt: string,
  ...candidates: Array<string | null | undefined>
) {
  return [
    {
      url: getStorefrontSocialImageUrl(baseUrl, ...candidates),
      alt,
    },
  ];
}

export function getStorefrontTwitterImages(
  baseUrl: string,
  ...candidates: Array<string | null | undefined>
) {
  return [getStorefrontSocialImageUrl(baseUrl, ...candidates)];
}
