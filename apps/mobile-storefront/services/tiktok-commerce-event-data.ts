export interface TikTokCommerceItemInput {
  id: string;
  name?: string;
  price?: number;
  quantity?: number;
  category?: string;
  brand?: string;
}

export interface TikTokCommerceEventInput {
  contentId?: string;
  contentName?: string;
  contentType?: string;
  currency?: string;
  description?: string;
  items?: TikTokCommerceItemInput[];
  quantity?: number;
  value?: number;
  extra?: Record<string, unknown>;
}

interface TikTokContentParams {
  content_id: string;
  content_name?: string;
  content_category?: string;
  price?: number;
  quantity: number;
  brand?: string;
}

function finiteNumber(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function positiveQuantity(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 1;
  }

  return Math.trunc(value);
}

function compactRecord(
  record: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => {
      if (value === null || value === undefined) {
        return false;
      }
      if (typeof value === 'number') {
        return Number.isFinite(value);
      }
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return true;
    })
  );
}

function toContentParams(
  item: TikTokCommerceItemInput
): TikTokContentParams | null {
  const id = item.id.trim();
  if (!id) {
    return null;
  }

  const params: TikTokContentParams = {
    content_id: id,
    quantity: positiveQuantity(item.quantity),
  };
  const price = finiteNumber(item.price);

  if (item.name) {
    params.content_name = item.name;
  }
  if (item.category) {
    params.content_category = item.category;
  }
  if (price !== undefined) {
    params.price = price;
  }
  if (item.brand) {
    params.brand = item.brand;
  }

  return params;
}

export function buildTikTokCommerceEventParams({
  contentId,
  contentName,
  contentType = 'product',
  currency = 'NGN',
  description,
  extra,
  items = [],
  quantity,
  value,
}: TikTokCommerceEventInput): Record<string, unknown> {
  const contents = items.flatMap((item) => {
    const params = toContentParams(item);
    return params ? [params] : [];
  });
  const firstContent = contents[0];
  const totalQuantity =
    finiteNumber(quantity) ??
    contents.reduce((total, item) => total + item.quantity, 0);

  return compactRecord({
    content_id: contentId?.trim() || firstContent?.content_id,
    content_name:
      contentName?.trim() ||
      (contents.length === 1 ? firstContent?.content_name : undefined),
    content_type: contentType,
    currency,
    description,
    value: finiteNumber(value),
    quantity: totalQuantity || undefined,
    contents,
    ...extra,
  });
}
