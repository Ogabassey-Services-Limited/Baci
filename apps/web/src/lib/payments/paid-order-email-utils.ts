import { formatOrderItemDisplayName } from '@baci/shared/lib';
import type {
  MerchantDetails,
  RichPaidOrder,
} from '@/lib/payments/paid-order-side-effect-types';
import { toNumber } from '@/lib/payments/paid-order-side-effect-utils';

const MAX_URL_LENGTH = 2048;
const BASIC_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PAID_ORDER_EMAIL_FALLBACK_ROOT_DOMAIN = 'usebaci.com';
export const SUPABASE_ROW_NOT_FOUND_CODE = 'PGRST116';

export function normalizeHttpsUrl(
  value: string | null | undefined
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed) && !/^(https?):\/\//i.test(trimmed)) {
    return null;
  }
  const candidate = /^(https?):\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    url.protocol = 'https:';
    url.hostname = url.hostname.toLowerCase();
    url.username = '';
    url.password = '';
    const normalizedUrl = url.toString();
    return normalizedUrl.length <= MAX_URL_LENGTH ? normalizedUrl : null;
  } catch {
    return null;
  }
}

function normalizeRootDomain(rootDomain: string): string {
  const normalizedUrl = normalizeHttpsUrl(rootDomain);
  if (!normalizedUrl) return PAID_ORDER_EMAIL_FALLBACK_ROOT_DOMAIN;

  try {
    const hostname = new URL(normalizedUrl).hostname;
    if (!hostname || !/^[a-z0-9.-]+$/.test(hostname)) {
      return PAID_ORDER_EMAIL_FALLBACK_ROOT_DOMAIN;
    }
    return hostname;
  } catch {
    return PAID_ORDER_EMAIL_FALLBACK_ROOT_DOMAIN;
  }
}

function normalizeMerchantSlug(slug: string | null | undefined): string | null {
  const trimmed = slug?.trim().toLowerCase();
  if (!trimmed) return null;
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function normalizeEmailAddress(
  value: string | null | undefined
): string | null {
  const trimmed = value?.trim();
  if (!trimmed || !BASIC_EMAIL_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function resolveMerchantReplyTo({
  merchantDetails,
  rootDomain,
}: {
  merchantDetails: MerchantDetails;
  rootDomain: string;
}) {
  const explicitReplyTo =
    normalizeEmailAddress(merchantDetails.support_email) ??
    normalizeEmailAddress(merchantDetails.email);
  if (explicitReplyTo) return explicitReplyTo;

  const rootHost = normalizeRootDomain(rootDomain);
  const merchantSlug = normalizeMerchantSlug(merchantDetails.slug);
  return merchantSlug
    ? `support@${merchantSlug}.${rootHost}`
    : `support@${rootHost}`;
}

export function resolveMerchantUrl({
  merchantDetails,
  rootDomain,
}: {
  merchantDetails: MerchantDetails;
  rootDomain: string;
}): string {
  const websiteUrl = normalizeHttpsUrl(merchantDetails.website_url);
  if (websiteUrl) return websiteUrl;

  const rootHost = normalizeRootDomain(rootDomain);
  const merchantSlug = normalizeMerchantSlug(merchantDetails.slug);
  const fallbackUrl = merchantSlug
    ? `https://${merchantSlug}.${rootHost}`
    : `https://${rootHost}`;
  const normalizedFallbackUrl =
    normalizeHttpsUrl(fallbackUrl) ??
    `https://${PAID_ORDER_EMAIL_FALLBACK_ROOT_DOMAIN}`;
  return normalizedFallbackUrl.endsWith('/')
    ? normalizedFallbackUrl.slice(0, -1)
    : normalizedFallbackUrl;
}

export function mapOrderItemToEmailItem(
  item: NonNullable<RichPaidOrder['order_items']>[number]
) {
  const itemName = item.name?.trim();
  const variantName = item.variant_name?.trim();
  const displayName = itemName && itemName.length > 0 ? itemName : 'Product';

  return {
    name: formatOrderItemDisplayName({
      baseName: displayName,
      condition: item.condition,
      variantName,
    }),
    price: toNumber(item.price ?? 0, 'order item price'),
    quantity: item.quantity ?? 1,
  };
}

export function getFromName(
  merchantDetails: MerchantDetails
): string | undefined {
  if (merchantDetails.email_sender_name) {
    return `${merchantDetails.email_sender_name} Orders`;
  }
  if (merchantDetails.business_name) {
    return `${merchantDetails.business_name} Orders`;
  }
  return undefined;
}
