import type { Customer } from './useCustomers';

export interface RankedCustomerSearchRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  total_orders: number | null;
  total_spent: number | string | null;
  store_credit: number | string | null;
  created_at: string | null;
  relevance: number | null;
  total_count: number | null;
}

export function mapRankedCustomerSearchRow(row: RankedCustomerSearchRow): Customer {
  const fullName = row.full_name?.trim() || '';
  const [firstName, ...rest] = fullName.split(/\s+/).filter(Boolean);

  return {
    id: row.id,
    email: row.email ?? '',
    first_name: firstName ?? null,
    last_name: rest.length > 0 ? rest.join(' ') : null,
    phone: row.phone ?? null,
    address: row.address ?? null,
    total_orders: Number(row.total_orders ?? 0),
    total_spent: Number(row.total_spent ?? 0),
    store_credit: Number(row.store_credit ?? 0),
    loyalty_points: 0,
    created_at: row.created_at ?? new Date(0).toISOString(),
    last_login_at: null,
    deleted_at: null,
  };
}

export function getRankedCustomerSearchTotalCount(
  rows: RankedCustomerSearchRow[]
) {
  return Number(rows[0]?.total_count ?? 0);
}
