/**
 * Shared mock setup and fixtures for sitemap route handler tests.
 *
 * Extracted from route.test.ts to keep the test file under 300 lines.
 * vi.mock() calls MUST remain in route.test.ts (Vitest hoists them to the
 * file scope), but all mutable state and helpers live here.
 */
import { vi } from 'vitest';

// ── Table-aware Supabase mock state ──

/** Tracks which Supabase table is being queried by mockFrom. */
export let currentTable = '';

/** Per-table query results. Set `error` to simulate Supabase failures. */
export const tableData: Record<
  string,
  { data: unknown[] | null; error: { message: string } | null }
> = {
  products: { data: [], error: null },
  categories: { data: [], error: null },
  blog_posts: { data: [], error: null },
};

// ── Mock functions (shared between test file and vi.mock factories) ──

export const mockEq: ReturnType<typeof vi.fn> = vi.fn();
export const mockSelect = vi.fn();
export const mockFrom = vi.fn();

mockEq.mockImplementation((_key: string, _value: string) => {
  if (_key === 'status' || _key === 'merchant_id') {
    const result = tableData[currentTable] ?? { data: [], error: null };
    return { eq: mockEq, ...result };
  }
  return { eq: mockEq, data: [], error: null };
});

mockSelect.mockImplementation(() => ({ eq: mockEq }));
mockFrom.mockImplementation((table: string) => {
  currentTable = table;
  return { select: mockSelect };
});

export const mockGetMerchant = vi.fn();

// ── Mock headers state ──

export let mockHeaders = new Map<string, string>();

export function setHeaders(h: Record<string, string>) {
  mockHeaders = new Map(Object.entries(h));
}

// ── Merchant fixture ──

export const baseMerchant = {
  id: 'merchant-1',
  slug: 'ogabassey',
  business_name: 'Ogabassey',
  custom_domain: 'ogabassey.com',
  site_title: '',
  site_tagline: '',
  site_description: '',
  business_type: 'electronics',
  logo_url: '',
  phone: '',
  email: '',
  brand_colors: { primary: '#000', accent: '#fff', background: '#fff' },
  business_address: '',
  payout_currency: 'NGN',
  is_published: true,
  template_id: 'ogabassey',
  plan_tier: 'pro',
  premium_features: null,
  updated_at: '2026-01-20T12:00:00Z',
};

// ── Table data helpers ──

export function setTableData(table: string, data: unknown[]) {
  tableData[table] = { data, error: null };
}

export function setTableError(table: string, message: string) {
  tableData[table] = { data: null, error: { message } };
}

export function resetTableData() {
  tableData.products = { data: [], error: null };
  tableData.categories = { data: [], error: null };
  tableData.blog_posts = { data: [], error: null };
}
