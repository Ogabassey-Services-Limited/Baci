import { createHash, randomBytes } from 'node:crypto';
import { getRootDomain } from '@/env';

export interface ReceiptClaimMerchantUrlContext {
  slug: string;
  custom_domain: string | null;
}

export interface ReceiptClaimToken {
  token: string;
  tokenHash: string;
}

interface CreateReceiptClaimTokenOptions {
  bytes?: Uint8Array;
}

interface ReceiptClaimOrderItemForDeviceList {
  name: string | null;
  quantity: number | null;
}

export interface ReceiptClaimOrderForDeviceList {
  order_number: string;
  order_items?: ReceiptClaimOrderItemForDeviceList[] | null;
}

const DEFAULT_RECEIPT_CLAIM_PATH = '/receipts/claim';
const DEFAULT_DEVICE_LIST_LIMIT = 10;

function toBase64Url(bytes: Uint8Array) {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function hashReceiptClaimToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createReceiptClaimToken(
  options: CreateReceiptClaimTokenOptions = {}
): ReceiptClaimToken {
  const bytes = options.bytes ?? randomBytes(32);
  const token = toBase64Url(bytes);

  return {
    token,
    tokenHash: hashReceiptClaimToken(token),
  };
}

export function normalizeClaimEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase();
  return normalized || null;
}

export function buildReceiptClaimUrl({
  merchant,
  token,
}: {
  merchant: ReceiptClaimMerchantUrlContext;
  token: string;
}) {
  const origin = merchant.custom_domain
    ? `https://${merchant.custom_domain.replace(/\/+$/g, '')}`
    : `https://${merchant.slug}.${getRootDomain() || 'usebaci.com'}`;

  return `${origin}${DEFAULT_RECEIPT_CLAIM_PATH}/${encodeURIComponent(token)}`;
}

export function buildReceiptDeviceList(
  orders: ReceiptClaimOrderForDeviceList[],
  limit = DEFAULT_DEVICE_LIST_LIMIT
) {
  const devices = orders.flatMap((order) => {
    const items = order.order_items ?? [];
    if (items.length === 0) {
      return [`Receipt ${order.order_number}`];
    }

    return items.map((item) => {
      const name = item.name?.trim() || `Receipt ${order.order_number}`;
      const quantity = item.quantity ?? 1;

      return quantity > 1 ? `${quantity} x ${name}` : name;
    });
  });

  if (devices.length <= limit) {
    return devices;
  }

  return [
    ...devices.slice(0, limit),
    `and ${devices.length - limit} more receipts`,
  ];
}
