import type { PageConfig } from '@/types/blocks';

interface PublishedPageConfigRow {
  published_config: unknown;
  updated_at?: string | null;
}

export interface ResolvedPageConfigResult {
  config: PageConfig;
  updatedAt: string | null;
}

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

export function resolveLatestPublishedPageConfig(
  rows: PublishedPageConfigRow[] | null | undefined
): PageConfig | null {
  const resolved = resolveLatestPublishedPageConfigWithMeta(rows);
  return resolved?.config ?? null;
}

export function resolveLatestPublishedPageConfigWithMeta(
  rows: PublishedPageConfigRow[] | null | undefined
): ResolvedPageConfigResult | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const sortedRows = [...rows].sort(
    (a, b) => toTimestamp(b.updated_at) - toTimestamp(a.updated_at)
  );

  for (const row of sortedRows) {
    if (row?.published_config && typeof row.published_config === 'object') {
      return {
        config: row.published_config as PageConfig,
        updatedAt: row.updated_at ?? null,
      };
    }
  }

  return null;
}
