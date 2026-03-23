import { ORDER_SOURCE_CONFIG } from '@baci/shared';

function formatFallbackLabel(source: string) {
  return source
    .split(/[_-]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function normalizeOrderSource(source: string | null | undefined) {
  return source?.trim().toLowerCase() || '';
}

export function getOrderSourceLabel(source: string) {
  const normalizedSource = normalizeOrderSource(source);

  if (!normalizedSource) {
    return 'Order';
  }

  if (
    normalizedSource === 'online_store' ||
    normalizedSource === 'storefront' ||
    normalizedSource === 'web'
  ) {
    return 'Website';
  }

  return (
    ORDER_SOURCE_CONFIG[normalizedSource]?.label ||
    formatFallbackLabel(normalizedSource)
  );
}
