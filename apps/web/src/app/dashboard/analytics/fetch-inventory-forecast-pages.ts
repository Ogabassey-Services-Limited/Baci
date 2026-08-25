interface JsonRecord {
  [key: string]: unknown;
}

const INVENTORY_FORECAST_PAGE_CONCURRENCY = 4;

function asRecord(value: unknown): JsonRecord | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export async function fetchInventoryForecastPages(
  fetchPage: (page: number) => Promise<JsonRecord>
): Promise<JsonRecord[]> {
  const firstPage = await fetchPage(1);
  const pagination = asRecord(firstPage.pagination);
  const totalPages = Math.max(1, Math.floor(asNumber(pagination?.totalPages)));
  if (totalPages === 1) return [firstPage];
  if (totalPages > 1000) {
    throw new Error('Inventory forecast pagination is invalid');
  }

  const remainingPages: JsonRecord[] = [];
  const pageNumbers = Array.from(
    { length: totalPages - 1 },
    (_, index) => index + 2
  );
  for (
    let start = 0;
    start < pageNumbers.length;
    start += INVENTORY_FORECAST_PAGE_CONCURRENCY
  ) {
    const pageBatch = pageNumbers.slice(
      start,
      start + INVENTORY_FORECAST_PAGE_CONCURRENCY
    );
    remainingPages.push(...(await Promise.all(pageBatch.map(fetchPage))));
  }
  return [firstPage, ...remainingPages];
}
