import 'server-only';

import type { Customer } from '@/contexts/customer-auth-context';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import { createClient } from '@/lib/supabase/server';
import { isDomainIdentifier } from '@/lib/validation';

const CUSTOMER_ACCOUNT_SELECT = `
  id,
  first_name,
  last_name,
  email,
  phone,
  address,
  saved_addresses,
  store_credit,
  total_orders,
  total_spent,
  created_at
`;

interface CustomerAccountRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  address?: string;
  saved_addresses?: Customer['saved_addresses'];
  store_credit?: number;
  total_orders?: number;
  total_spent?: number;
  created_at?: string;
}

function mapCustomerAccountRow(row: CustomerAccountRow): Customer {
  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    saved_addresses: row.saved_addresses,
    store_credit: row.store_credit,
    total_orders: row.total_orders,
    total_spent: row.total_spent,
    created_at: row.created_at,
  };
}

export async function getStorefrontAccountInitialCustomer(
  identifier: string
): Promise<Customer | null> {
  const normalizedIdentifier = identifier.trim().toLowerCase();
  const merchant = isDomainIdentifier(normalizedIdentifier)
    ? await getCachedMerchantByDomain(normalizedIdentifier)
    : await getCachedMerchant(normalizedIdentifier);

  if (!merchant) {
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user || user.user_metadata?.role === 'merchant') {
    return null;
  }

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select(CUSTOMER_ACCOUNT_SELECT)
    .eq('merchant_id', merchant.id)
    .eq('user_id', user.id)
    .maybeSingle<CustomerAccountRow>();

  if (customerError) {
    console.error('Initial storefront account customer fetch error:', {
      error: customerError,
      merchantId: merchant.id,
      userId: user.id,
    });
    return null;
  }

  return customer ? mapCustomerAccountRow(customer) : null;
}
