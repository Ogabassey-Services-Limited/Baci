export const FAVICON_STORAGE_BUCKET = 'favicons';

export interface FaviconStoragePaths {
  svgPath: string;
  png32Path: string;
  png192Path: string;
  appleTouchPath: string;
}

export function getFaviconStoragePaths(
  merchantId: string
): FaviconStoragePaths {
  return {
    svgPath: `${merchantId}/icon.svg`,
    png32Path: `${merchantId}/icon-32.png`,
    png192Path: `${merchantId}/icon-192.png`,
    appleTouchPath: `${merchantId}/apple-touch-icon.png`,
  };
}

export function buildPublicFaviconUrl(
  supabaseUrl: string,
  storagePath: string
): string {
  const normalizedSupabaseUrl = supabaseUrl.replace(/\/+$/, '');

  return `${normalizedSupabaseUrl}/storage/v1/object/public/${FAVICON_STORAGE_BUCKET}/${storagePath}`;
}
