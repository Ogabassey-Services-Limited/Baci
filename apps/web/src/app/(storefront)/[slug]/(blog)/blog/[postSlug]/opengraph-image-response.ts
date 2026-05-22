import { ImageResponse } from 'next/og';
import type { ReactElement } from 'react';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' };
const EMERGENCY_PNG_BYTES = Uint8Array.from([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0,
  0, 0, 1, 8, 4, 0, 0, 0, 181, 28, 12, 2, 0, 0, 0, 11, 73, 68, 65, 84, 120, 218,
  99, 252, 255, 31, 0, 3, 3, 2, 0, 239, 191, 167, 219, 0, 0, 0, 0, 73, 69, 78,
  68, 174, 66, 96, 130,
]);

type BlogOgImageSize = {
  width: number;
  height: number;
};

type BlogOgFallback = {
  element: ReactElement;
  noStore: boolean;
};

type BlogOgResponseOptions = {
  size: BlogOgImageSize;
  noStore?: boolean;
  fallback?: BlogOgFallback;
};

function createEmergencyPngResponse() {
  return new Response(EMERGENCY_PNG_BYTES, {
    headers: {
      ...NO_STORE_HEADERS,
      'content-type': 'image/png',
    },
  });
}

async function renderImageResponse(
  element: ReactElement,
  size: BlogOgImageSize,
  noStore: boolean
) {
  const response = new ImageResponse(element, {
    ...size,
    ...(noStore ? { headers: NO_STORE_HEADERS } : {}),
  });
  const body = await response.arrayBuffer();
  return new Response(body, {
    status: response.status,
    headers: response.headers,
  });
}

export async function createBlogOgImageResponse(
  element: ReactElement,
  { size, noStore = false, fallback }: BlogOgResponseOptions
) {
  try {
    return await renderImageResponse(element, size, noStore);
  } catch (error) {
    console.error('Failed to render merchant blog OG image', { error });
  }

  if (!fallback) return createEmergencyPngResponse();

  try {
    return await renderImageResponse(fallback.element, size, fallback.noStore);
  } catch (error) {
    console.error('Failed to render merchant blog OG fallback image', {
      error,
    });
    return createEmergencyPngResponse();
  }
}
