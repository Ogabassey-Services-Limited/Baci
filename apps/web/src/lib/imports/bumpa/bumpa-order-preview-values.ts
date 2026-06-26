import { buildBumpaProductNameCandidates } from '@/lib/imports/bumpa/bumpa-order-enrichment';
import type {
  ExistingImportedProduct,
  NormalizedImportedCustomer,
  NormalizedImportedOrderItem,
} from '@/lib/imports/bumpa/bumpa-types';
import {
  sanitizeEmail,
  sanitizePhone,
  sanitizePrice,
  sanitizeText,
} from '@/lib/sanitize-core';
import type { BumpaOrderRow } from '@/schemas/bumpa-orders';

function toMoneyCents(value: number) {
  return Math.round(value * 100);
}

function fromMoneyCents(value: number) {
  return Math.round(value) / 100;
}

export function parseMoney(value: string) {
  return sanitizePrice(value || '0');
}

export function parseIsoDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const date = trimmed.includes('T')
    ? new Date(trimmed)
    : new Date(trimmed.replace(' ', 'T'));

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export function mapPaymentStatus(value: string) {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, '_');

  if (normalized === 'PAID') return 'paid';
  if (normalized === 'PARTIALLY_PAID') return 'partially_paid';
  if (normalized === 'REFUNDED') return 'refunded';
  if (normalized === 'PENDING') return 'pending';
  if (normalized === 'FAILED') return 'failed';

  return 'unpaid';
}

export function mapShippingStatus(status: string, shippingStatus: string) {
  const normalizedStatus = status.trim().toUpperCase().replace(/\s+/g, '_');
  const normalizedShipping = shippingStatus
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

  if (normalizedStatus === 'CANCELLED') return 'cancelled';
  if (normalizedShipping === 'RETURNED') return 'returned';
  if (normalizedShipping === 'DELIVERED') return 'delivered';
  if (normalizedShipping === 'SHIPPED') return 'shipped';
  if (normalizedStatus === 'COMPLETED') return 'delivered';
  if (normalizedStatus === 'PROCESSING') return 'processing';
  if (normalizedStatus === 'OPEN') return 'pending';

  return 'pending';
}

export function splitCustomerName(fullName: string) {
  const cleanName = sanitizeText(fullName);
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: null, lastName: null };
  }

  return {
    firstName: parts[0] || null,
    lastName: parts.slice(1).join(' ') || null,
  };
}

function normalizeNameKey(value: string) {
  return sanitizeText(value).toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizePhoneKey(value: string) {
  return sanitizePhone(value).replace(/[\s()-]+/g, '');
}

function findProductByName(
  productsByName: Map<string, ExistingImportedProduct>,
  productName: string
) {
  for (const candidate of buildBumpaProductNameCandidates(productName)) {
    const matchedProduct = productsByName.get(normalizeNameKey(candidate));
    if (matchedProduct) return matchedProduct;
  }

  return null;
}

function splitPipeField(value: string) {
  return value.split(/(?<!\|)\|(?!\|)/).map((part) =>
    part.trim() === '||'
      ? '||'
      : part
          .trim()
          .replace(/^\|+|\|+$/g, '')
          .trim()
  );
}

function trimEmptyEdges(parts: string[]) {
  let start = 0;
  let end = parts.length;

  while (start < end && !parts[start]?.trim()) {
    start += 1;
  }

  while (end > start && !parts[end - 1]?.trim()) {
    end -= 1;
  }

  return parts.slice(start, end);
}

function buildProductNames(
  value: string,
  expectedCount: number,
  customerName: string
) {
  const rawParts = trimEmptyEdges(splitPipeField(value));
  const customerNameKey = normalizeNameKey(customerName);

  if (rawParts.length === 0) {
    return [];
  }

  if (expectedCount <= 1) {
    const compactParts = rawParts.filter(Boolean);
    const doublePipeSeparatorIndex = compactParts.indexOf('||');

    if (doublePipeSeparatorIndex > 0) {
      const prefix = compactParts
        .slice(0, doublePipeSeparatorIndex)
        .join(' | ');
      if (normalizeNameKey(prefix) === customerNameKey) {
        return [compactParts.slice(doublePipeSeparatorIndex + 1).join(' | ')];
      }
    }

    const mergedName = compactParts.join(' | ');
    const doublePipePrefixMatch = mergedName.match(/^(.+?)\s*\|\|\s*(.+)$/);

    if (
      doublePipePrefixMatch &&
      normalizeNameKey(doublePipePrefixMatch[1] || '') === customerNameKey
    ) {
      return [doublePipePrefixMatch[2] || ''];
    }

    if (
      compactParts.length === 2 &&
      normalizeNameKey(compactParts[0] || '') === customerNameKey
    ) {
      return [compactParts[1] || ''];
    }

    return [mergedName];
  }

  const groupedParts = rawParts.reduce<string[][]>((groups, part) => {
    if (!part) {
      if (groups.length > 0 && (groups[groups.length - 1]?.length ?? 0) > 0) {
        groups.push([]);
      }

      return groups;
    }

    if (groups.length === 0) {
      groups.push([]);
    }

    groups[groups.length - 1]?.push(part);
    return groups;
  }, []);

  const nonEmptyGroups = groupedParts.filter((group) => group.length > 0);

  if (nonEmptyGroups.length === expectedCount) {
    return nonEmptyGroups.map((group) => group.join(' | '));
  }

  // When nonEmptyGroups still undershoots expectedCount, peel fragments from the
  // end by finding splitIndex (the last group with length > 1), mapping it back
  // to groupIndex, popping tail from that targetGroup, and inserting tail as its
  // own single-item group immediately after the source group. Repeat until
  // nonEmptyGroups reaches expectedCount or no splittable group remains.
  while (nonEmptyGroups.length < expectedCount) {
    const splitIndex = [...nonEmptyGroups]
      .reverse()
      .findIndex((group) => group.length > 1);

    if (splitIndex === -1) {
      break;
    }

    const groupIndex = nonEmptyGroups.length - 1 - splitIndex;
    const targetGroup = nonEmptyGroups[groupIndex];
    if (!targetGroup) {
      break;
    }

    const tail = targetGroup.pop();
    if (!tail) {
      break;
    }

    nonEmptyGroups.splice(groupIndex + 1, 0, [tail]);
  }

  return nonEmptyGroups.map((group) => group.join(' | '));
}

export function buildCustomer(row: BumpaOrderRow): NormalizedImportedCustomer {
  const fullName = sanitizeText(row['Customer Name']) || 'Customer';
  const { firstName, lastName } = splitCustomerName(fullName);
  const email = row['Customer Email']
    ? sanitizeEmail(row['Customer Email'])
    : null;
  const phone = row['Customer Phone']
    ? normalizePhoneKey(row['Customer Phone'])
    : null;

  if (email) {
    return { fullName, firstName, lastName, email, phone, claimable: true };
  }

  if (phone) {
    return {
      fullName,
      firstName,
      lastName,
      email: null,
      phone,
      claimable: false,
    };
  }

  return {
    fullName,
    firstName,
    lastName,
    email: null,
    phone: null,
    claimable: false,
  };
}

function inferItemPrices(
  subtotal: number,
  items: Array<
    Omit<NormalizedImportedOrderItem, 'unitPrice' | 'lineTotal'> & {
      provisionalUnitPrice: number | null;
    }
  >
) {
  const subtotalCents = toMoneyCents(subtotal);
  const knownCents = items.reduce((sum, item) => {
    if (item.provisionalUnitPrice === null) return sum;
    return sum + toMoneyCents(item.provisionalUnitPrice * item.quantity);
  }, 0);

  const unknownItems = items.filter(
    (item) => item.provisionalUnitPrice === null
  );
  let remainingCents = subtotalCents - knownCents;

  const normalizedItems = items.map((item) => {
    if (item.provisionalUnitPrice !== null) {
      const lineTotal = toMoneyCents(item.provisionalUnitPrice * item.quantity);
      return {
        ...item,
        unitPrice: item.provisionalUnitPrice,
        lineTotal: fromMoneyCents(lineTotal),
      };
    }

    const itemsLeft = unknownItems.length - unknownItems.indexOf(item);
    const divisor = Math.max(1, item.quantity * itemsLeft);
    const centsPerUnit = Math.max(0, Math.floor(remainingCents / divisor));
    const lineTotalCents = centsPerUnit * item.quantity;
    remainingCents -= lineTotalCents;

    return {
      ...item,
      unitPrice: fromMoneyCents(centsPerUnit),
      lineTotal: fromMoneyCents(lineTotalCents),
    };
  });

  const finalLineTotal = normalizedItems.reduce(
    (sum, item) => sum + toMoneyCents(item.lineTotal),
    0
  );
  const delta = subtotalCents - finalLineTotal;

  if (normalizedItems.length > 0 && delta !== 0) {
    const targetIndex = normalizedItems.reduce(
      (bestIndex, item, index, array) =>
        array[bestIndex].lineTotal >= item.lineTotal ? bestIndex : index,
      0
    );
    const target = normalizedItems[targetIndex];
    const adjustedLineTotal = toMoneyCents(target.lineTotal) + delta;

    normalizedItems[targetIndex] = {
      ...target,
      unitPrice: fromMoneyCents(
        adjustedLineTotal / Math.max(1, target.quantity)
      ),
      lineTotal: fromMoneyCents(adjustedLineTotal),
    };
  }

  return normalizedItems.map(
    ({ provisionalUnitPrice: _ignored, ...item }) => item
  );
}

export function buildItems(
  row: BumpaOrderRow,
  existingProducts: ExistingImportedProduct[]
) {
  const productsBySku = new Map<string, ExistingImportedProduct>();
  const productsByName = new Map<string, ExistingImportedProduct>();

  existingProducts.forEach((product) => {
    if (product.sku) {
      productsBySku.set(product.sku.trim().toUpperCase(), product);
    }

    productsByName.set(normalizeNameKey(product.name), product);
  });

  const quantities = splitPipeField(row['Product Quantity']);
  const skus = splitPipeField(row['Product SKU']);
  const expectedNameCount = Math.max(
    1,
    quantities.filter(Boolean).length,
    skus.length > 1 ? skus.length : 0
  );
  const names = buildProductNames(
    row.Products,
    expectedNameCount,
    row['Customer Name']
  );
  const itemCount = Math.max(names.length, skus.length, quantities.length);

  const provisionalItems = Array.from({ length: itemCount }, (_, index) => {
    const productName = sanitizeText(names[index] || '');
    const quantity = Math.max(
      1,
      Number.parseInt((quantities[index] || '1').replace(/\.0+$/, ''), 10) || 1
    );
    const rawSku = sanitizeText(skus[index] || '');
    const sku = rawSku || null;
    const matchedBySku = sku ? productsBySku.get(sku.toUpperCase()) : null;
    const matchedByName = findProductByName(productsByName, productName);
    const matchedProduct = matchedBySku || matchedByName || null;

    return {
      productId: matchedProduct?.id || null,
      productName,
      sku,
      quantity,
      matched: Boolean(matchedProduct),
      matchSource: matchedBySku ? 'sku' : matchedByName ? 'name' : 'unmatched',
      provisionalUnitPrice: matchedProduct?.price ?? null,
    } satisfies Omit<NormalizedImportedOrderItem, 'unitPrice' | 'lineTotal'> & {
      provisionalUnitPrice: number | null;
    };
  });

  return inferItemPrices(parseMoney(row['Sub Total']), provisionalItems);
}
