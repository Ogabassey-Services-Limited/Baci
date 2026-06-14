import { supabase } from '@/lib/supabase';
import type { Transaction } from './ReportsGenerator';

interface TaxLedgerOrderRow {
  id: string;
  created_at: string;
  total: number | null;
  tax_amount: number | null;
  customer:
    | { first_name: string | null; last_name: string | null }
    | Array<{ first_name: string | null; last_name: string | null }>
    | null;
}

type JoinedCustomer = Extract<
  TaxLedgerOrderRow['customer'],
  { first_name: string | null; last_name: string | null }
>;

function mapRowToTransaction(row: TaxLedgerOrderRow): Transaction {
  let joinedCustomer: JoinedCustomer | null;
  if (Array.isArray(row.customer)) {
    if (row.customer.length > 1) {
      console.warn(
        `[ReportSelectionModal] Order ${row.id} returned ${row.customer.length} joined customers; using the first`
      );
    }
    joinedCustomer = row.customer[0] ?? null;
  } else {
    joinedCustomer = row.customer;
  }
  return {
    id: row.id,
    created_at: row.created_at,
    total: Number(row.total ?? 0),
    tax_amount: Number(row.tax_amount ?? 0),
    customer: joinedCustomer
      ? {
          first_name: joinedCustomer.first_name ?? undefined,
          last_name: joinedCustomer.last_name ?? undefined,
        }
      : undefined,
  };
}

// Module scope so the `throw` lives outside the component body — throw inside
// a component-level try/catch blocks React Compiler memoization.
export async function fetchTaxLedgerTransactions(
  merchantId: string,
  startDate: Date,
  endDate: Date
): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(`
                        id,
                        created_at,
                        total,
                        tax_amount,
                        customer:customers(first_name, last_name)
                    `)
    .eq('merchant_id', merchantId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .eq('payment_status', 'paid')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapRowToTransaction);
}
