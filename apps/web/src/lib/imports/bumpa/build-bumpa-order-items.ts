import { buildBumpaItemImportMetadata } from '@/lib/imports/bumpa/bumpa-order-enrichment';
import {
  buildBumpaOrderItemSnapshot,
  normalizeBumpaConditionForCatalog,
} from '@/lib/imports/bumpa/bumpa-order-item-snapshot';
import { createBumpaProductNameMatcher } from '@/lib/imports/bumpa/bumpa-product-name-matcher';
import type { ExistingImportedProduct } from '@/lib/imports/bumpa/bumpa-types';
import {
  inferBumpaOrderItemPrices,
  type ProvisionalBumpaOrderItem,
} from '@/lib/imports/bumpa/infer-bumpa-order-item-prices';
import { parseBumpaRichItems } from '@/lib/imports/bumpa/parse-bumpa-rich-items';
import { sanitizePrice, sanitizeText } from '@/lib/sanitize-core';
import type { BumpaOrderRow } from '@/schemas/bumpa-orders';

function parseMoneyValue(value: string) {
  return sanitizePrice(value || '0');
}

function normalizeNameKey(value: string) {
  return sanitizeText(value).toLowerCase().replace(/\s+/g, ' ').trim();
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

function stripCustomerDoublePipePrefix(
  parts: string[],
  customerNameKey: string
) {
  if (!customerNameKey) return parts;

  const separatorIndex = parts.indexOf('||');
  if (separatorIndex > 0) {
    const prefix = parts.slice(0, separatorIndex).filter(Boolean).join(' | ');
    if (normalizeNameKey(prefix) === customerNameKey) {
      return trimEmptyEdges(parts.slice(separatorIndex + 1));
    }
  }

  const mergedName = parts.filter(Boolean).join(' | ');
  const doublePipePrefixMatch = mergedName.match(/^(.+?)\s*\|\|\s*(.+)$/);

  if (
    doublePipePrefixMatch &&
    normalizeNameKey(doublePipePrefixMatch[1] || '') === customerNameKey
  ) {
    return trimEmptyEdges(splitPipeField(doublePipePrefixMatch[2] || ''));
  }

  return parts;
}

function buildProductNames(
  value: string,
  expectedCount: number,
  customerName: string
) {
  const customerNameKey = normalizeNameKey(customerName);
  const rawParts = stripCustomerDoublePipePrefix(
    trimEmptyEdges(splitPipeField(value)),
    customerNameKey
  );

  if (rawParts.length === 0) {
    return [];
  }

  if (expectedCount <= 1) {
    const compactParts = rawParts.filter(Boolean);

    if (
      compactParts.length === 2 &&
      normalizeNameKey(compactParts[0] || '') === customerNameKey
    ) {
      return [compactParts[1] || ''];
    }

    return [compactParts.join(' | ')];
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

export function buildItems(
  row: BumpaOrderRow,
  existingProducts: ExistingImportedProduct[]
) {
  const productsBySku = new Map<string, ExistingImportedProduct>();
  const matchProductByName = createBumpaProductNameMatcher(existingProducts);

  existingProducts.forEach((product) => {
    if (product.sku) {
      productsBySku.set(product.sku.trim().toUpperCase(), product);
    }
  });

  const richItems = parseBumpaRichItems(row.items_json).filter(
    (item) => item.productName || item.quantity || item.unitPrice
  );
  const hasRichItems = richItems.length > 0;
  const rowQuantities = splitPipeField(row['Product Quantity']);
  const quantities = hasRichItems
    ? richItems.map((item, index) =>
        item.quantity === null
          ? rowQuantities[index] || ''
          : String(item.quantity)
      )
    : rowQuantities;
  const skus = hasRichItems
    ? richItems.map((item) => item.sku || '')
    : splitPipeField(row['Product SKU']);
  const expectedNameCount = Math.max(
    1,
    quantities.filter(Boolean).length,
    skus.length > 1 ? skus.length : 0
  );
  const names = hasRichItems
    ? richItems.map((item) => item.productName)
    : buildProductNames(row.Products, expectedNameCount, row['Customer Name']);
  const itemCount = Math.max(names.length, skus.length, quantities.length);

  const provisionalItems = Array.from({ length: itemCount }, (_, index) => {
    const richItem = richItems[index] || null;
    const productName = sanitizeText(
      richItem?.productName || names[index] || ''
    );
    const quantity = Math.max(
      1,
      richItem?.quantity ||
        Number.parseInt((quantities[index] || '1').replace(/\.0+$/, ''), 10) ||
        1
    );
    const rawSku = sanitizeText(richItem?.sku || skus[index] || '');
    const sku = rawSku || null;
    const matchedBySku = sku ? productsBySku.get(sku.toUpperCase()) : null;
    const metadataSource = [productName, richItem?.fulfillmentText || '']
      .filter(Boolean)
      .join(' ');
    const bumpaMetadata = buildBumpaItemImportMetadata(
      metadataSource || productName
    );
    const importMetadata = {
      bumpa: bumpaMetadata,
    };
    const matchedByName = matchProductByName(
      productName,
      normalizeBumpaConditionForCatalog(bumpaMetadata.condition)
    );
    const matchedProduct = matchedBySku || matchedByName || null;
    const itemSnapshot = buildBumpaOrderItemSnapshot({
      importedProductName: productName,
      importMetadata,
      matchedProduct,
    });
    const shouldUseCatalogPrice = !richItem || richItem.lineTotal === null;

    return {
      productId: matchedProduct?.id || null,
      productName: itemSnapshot.productName,
      sku,
      quantity,
      condition: itemSnapshot.condition,
      variantName: itemSnapshot.variantName,
      imageUrl: itemSnapshot.imageUrl,
      matched: Boolean(matchedProduct),
      matchSource: matchedBySku ? 'sku' : matchedByName ? 'name' : 'unmatched',
      provisionalUnitPrice:
        richItem?.unitPrice ??
        (shouldUseCatalogPrice ? (matchedProduct?.price ?? null) : null),
      provisionalLineTotal: richItem?.lineTotal ?? null,
      importMetadata,
    } satisfies ProvisionalBumpaOrderItem;
  });

  return inferBumpaOrderItemPrices(
    parseMoneyValue(row['Sub Total']),
    provisionalItems
  );
}
