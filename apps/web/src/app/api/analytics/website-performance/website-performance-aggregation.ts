import type { WebsiteAnalyticsSummary } from '@baci/shared';

type AnalyticsEvent = {
  event_data: unknown;
  event_type: string;
};

type ProductActivity = {
  actions: number;
  id: string;
  name: string;
  views: number;
};

const MIN_VIEWS_FOR_CONVERSION = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAnalyticsEvent(value: unknown): value is AnalyticsEvent {
  return isRecord(value) && typeof value.event_type === 'string';
}

function getNumber(record: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return 0;
}

function getString(
  record: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function normalizeBestSeller(
  topProducts: unknown
): WebsiteAnalyticsSummary['bestSeller'] {
  if (!Array.isArray(topProducts) || !isRecord(topProducts[0])) return null;

  const product = topProducts[0];
  const id = getString(product, ['id']);
  const name = getString(product, ['name']);
  if (!id || !name) return null;

  return {
    id,
    name,
    revenue: getNumber(product, ['revenue', 'total_revenue']),
    units_sold: getNumber(product, ['units_sold', 'total_sold', 'units']),
  };
}

function normalizeMostSearched(
  eventSummary: Record<string, unknown>
): WebsiteAnalyticsSummary['mostSearched'] {
  const value = eventSummary.mostSearched;
  if (!isRecord(value)) return null;
  const query = getString(value, ['query']);
  const count = getNumber(value, ['count']);
  return query && count > 0 ? { query, count } : null;
}

function normalizeTopConverting(
  eventSummary: Record<string, unknown>
): WebsiteAnalyticsSummary['topConverting'] {
  const value = eventSummary.topConverting;
  if (!isRecord(value)) return null;
  const id = getString(value, ['id']);
  const name = getString(value, ['name']);
  const conversionRate = getNumber(value, ['conversionRate']);
  const views = getNumber(value, ['views']);
  const actions = getNumber(value, ['actions']);
  return id &&
    name &&
    views >= MIN_VIEWS_FOR_CONVERSION &&
    actions > 0 &&
    actions <= views &&
    conversionRate > 0 &&
    conversionRate <= 100
    ? { id, name, conversionRate }
    : null;
}

function getEventProducts(eventData: Record<string, unknown>) {
  const products = new Map<string, { id: string; name: string }>();
  const topLevelId = getString(eventData, ['product_id', 'id']);
  if (topLevelId) {
    products.set(topLevelId, {
      id: topLevelId,
      name: getString(eventData, ['product_name', 'name']) ?? 'Unknown Product',
    });
  }

  if (Array.isArray(eventData.items)) {
    for (const item of eventData.items) {
      if (!isRecord(item)) continue;
      const id = getString(item, ['product_id', 'id']);
      if (!id) continue;
      const existing = products.get(id);
      products.set(id, {
        id,
        name:
          getString(item, ['product_name', 'name']) ??
          existing?.name ??
          'Unknown Product',
      });
    }
  }

  return [...products.values()];
}

function aggregateEventRows(
  events: AnalyticsEvent[]
): Pick<WebsiteAnalyticsSummary, 'mostSearched' | 'topConverting'> {
  const searchCounts = new Map<string, number>();
  const productActivity = new Map<string, ProductActivity>();

  for (const event of events) {
    if (!isRecord(event.event_data)) continue;
    if (event.event_type === 'search') {
      const query = getString(event.event_data, ['search_term', 'query'])
        ?.toLowerCase()
        .trim();
      if (query) searchCounts.set(query, (searchCounts.get(query) ?? 0) + 1);
      continue;
    }

    if (
      event.event_type !== 'product_view' &&
      event.event_type !== 'purchase' &&
      event.event_type !== 'add_to_cart'
    ) {
      continue;
    }

    for (const product of getEventProducts(event.event_data)) {
      const activity = productActivity.get(product.id) ?? {
        ...product,
        actions: 0,
        views: 0,
      };
      if (
        activity.name === 'Unknown Product' &&
        product.name !== activity.name
      ) {
        activity.name = product.name;
      }
      if (event.event_type === 'product_view') activity.views += 1;
      if (
        event.event_type === 'purchase' ||
        event.event_type === 'add_to_cart'
      ) {
        activity.actions += 1;
      }
      productActivity.set(product.id, activity);
    }
  }

  const mostSearchedEntry = [...searchCounts.entries()].sort(
    ([leftQuery, leftCount], [rightQuery, rightCount]) =>
      rightCount - leftCount || leftQuery.localeCompare(rightQuery)
  )[0];
  const topConvertingProduct = [...productActivity.values()]
    .filter(
      (product) =>
        product.views >= MIN_VIEWS_FOR_CONVERSION &&
        product.actions > 0 &&
        product.actions <= product.views
    )
    .map((product) => ({
      ...product,
      conversionRate: (product.actions / product.views) * 100,
    }))
    .sort(
      (left, right) =>
        right.conversionRate - left.conversionRate ||
        right.actions - left.actions ||
        left.name.localeCompare(right.name)
    )[0];

  return {
    mostSearched: mostSearchedEntry
      ? { query: mostSearchedEntry[0], count: mostSearchedEntry[1] }
      : null,
    topConverting: topConvertingProduct
      ? {
          id: topConvertingProduct.id,
          name: topConvertingProduct.name,
          conversionRate: topConvertingProduct.conversionRate,
        }
      : null,
  };
}

export function aggregateWebsitePerformance(
  topProducts: unknown,
  eventSummary: unknown
): WebsiteAnalyticsSummary {
  if (Array.isArray(eventSummary)) {
    const validEvents = eventSummary.filter(isAnalyticsEvent);
    return {
      bestSeller: normalizeBestSeller(topProducts),
      ...aggregateEventRows(validEvents),
    };
  }

  const normalizedEventSummary = isRecord(eventSummary) ? eventSummary : {};
  return {
    bestSeller: normalizeBestSeller(topProducts),
    mostSearched: normalizeMostSearched(normalizedEventSummary),
    topConverting: normalizeTopConverting(normalizedEventSummary),
  };
}
