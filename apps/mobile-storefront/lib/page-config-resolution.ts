import type { PageConfig } from '@/types/blocks';

export interface PublishedPageConfigRow {
  published_config: unknown;
  updated_at?: string | null;
}

export interface ResolvedPageConfigResult {
  config: PageConfig;
  updatedAt: string | null;
}

interface LooseRecord {
  [key: string]: unknown;
}

function asRecord(value: unknown): LooseRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as LooseRecord;
}

function isValidPageConfig(value: unknown): value is PageConfig {
  const config = asRecord(value);
  if (!config) return false;

  const root = asRecord(config.root);
  const rootProps = root ? asRecord(root.props) : null;
  const title = rootProps?.title;
  const content = config.content;

  if (typeof title !== 'string') return false;
  if (!Array.isArray(content)) return false;

  return true;
}

export function toTimestamp(value: string | null | undefined): number {
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
    if (!isValidPageConfig(row?.published_config)) continue;

    return {
      config: row.published_config,
      updatedAt: row.updated_at ?? null,
    };
  }

  return null;
}
