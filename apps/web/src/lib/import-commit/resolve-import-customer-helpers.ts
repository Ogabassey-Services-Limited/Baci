import type { SupabaseClient } from '@supabase/supabase-js';
import type { NormalizedImportedOrder } from '@/lib/imports/bumpa/bumpa-types';
import { sanitizeEmail, sanitizePhone } from '@/lib/sanitize-core';

const LIKE_PATTERN_ESCAPE_REGEX = /[%_\\]/g;

export interface ExistingCustomerRecord {
  id: string;
  email: string | null;
  phone: string | null;
  user_id: string | null;
  deleted_at?: string | null;
}

export function toEmailKey(value: string | null) {
  if (!value) return null;
  return sanitizeEmail(value);
}

export function toPhoneKey(value: string | null) {
  if (!value) return null;
  return sanitizePhone(value).replace(/[\s()-]+/g, '');
}

export function buildCustomerMaps(customers: ExistingCustomerRecord[]) {
  const customersByEmail = new Map<string, ExistingCustomerRecord>();
  const customersByPhone = new Map<string, ExistingCustomerRecord[]>();

  for (const customer of customers) {
    const emailKey = toEmailKey(customer.email);
    if (emailKey) customersByEmail.set(emailKey, customer);

    const phoneKey = toPhoneKey(customer.phone);
    if (!phoneKey) continue;

    const entries = customersByPhone.get(phoneKey) || [];
    entries.push(customer);
    customersByPhone.set(phoneKey, entries);
  }

  return { customersByEmail, customersByPhone };
}

export type CustomerMaps = ReturnType<typeof buildCustomerMaps>;

export function rememberCustomer(
  customerMaps: CustomerMaps,
  customer: ExistingCustomerRecord
) {
  const emailKey = toEmailKey(customer.email);
  if (emailKey) customerMaps.customersByEmail.set(emailKey, customer);

  const phoneKey = toPhoneKey(customer.phone);
  if (!phoneKey) return;

  const phoneCustomers = customerMaps.customersByPhone.get(phoneKey) || [];
  if (!phoneCustomers.some((entry) => entry.id === customer.id)) {
    phoneCustomers.push(customer);
  }
  customerMaps.customersByPhone.set(phoneKey, phoneCustomers);
}

export function isCustomerEmailConstraintError(
  error: { code?: string; message?: string } | null | undefined
) {
  return (
    error?.code === '23505' &&
    (error.message?.includes('customers_merchant_id_email_key') ||
      error.message?.includes('customers_merchant_email_unique') ||
      error.message?.includes('idx_customers_merchant_email'))
  );
}

async function findCustomerEmailCandidates(
  supabase: SupabaseClient,
  merchantId: string,
  emailKey: string,
  includeDeleted: boolean
) {
  let query = supabase
    .from('customers')
    .select('id, email, phone, user_id, deleted_at')
    .eq('merchant_id', merchantId)
    .ilike('email', emailKey.replace(LIKE_PATTERN_ESCAPE_REGEX, '\\$&'));

  if (!includeDeleted) query = query.is('deleted_at', null);

  const { data, error } = await query.limit(20);

  if (error) {
    throw new Error(
      `Failed to resolve conflicting customer by email: ${error.message}`
    );
  }

  return ((data || []) as ExistingCustomerRecord[]).filter(
    (customer) => toEmailKey(customer.email) === emailKey
  );
}

export async function findExistingCustomerByEmail(
  supabase: SupabaseClient,
  merchantId: string,
  emailKey: string
) {
  const [activeCustomer] = await findCustomerEmailCandidates(
    supabase,
    merchantId,
    emailKey,
    false
  );
  if (activeCustomer) return activeCustomer;

  const candidates = await findCustomerEmailCandidates(
    supabase,
    merchantId,
    emailKey,
    true
  );
  const deletedCustomer = candidates.find((customer) => customer.deleted_at);
  if (deletedCustomer) {
    throw new Error(
      'Email is already used by a deleted customer record. Restore or permanently remove that customer before importing orders for this email.'
    );
  }

  const [existingCustomer] = candidates;
  if (existingCustomer) return existingCustomer;

  throw new Error('Failed to resolve conflicting customer by email: not found');
}

export async function reuseEmailCustomer(
  supabase: SupabaseClient,
  merchantId: string,
  emailKey: string,
  customerMaps: CustomerMaps
) {
  const customer = await findExistingCustomerByEmail(
    supabase,
    merchantId,
    emailKey
  );
  rememberCustomer(customerMaps, customer);
  return { customerId: customer.id, createdCustomer: false };
}

export async function enrichPhoneCustomerEmail(
  supabase: SupabaseClient,
  merchantId: string,
  customer: ExistingCustomerRecord,
  order: NormalizedImportedOrder
) {
  if (toEmailKey(customer.email)) return customer;

  const { data, error } = await supabase
    .from('customers')
    .update({ email: order.customer.email })
    .eq('merchant_id', merchantId)
    .eq('id', customer.id)
    .select('id, email, phone, user_id')
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to enrich imported customer by phone: ${error?.message ?? 'no customer returned'}`
    );
  }

  return data as ExistingCustomerRecord;
}

export function buildCustomerInsert(
  merchantId: string,
  order: NormalizedImportedOrder,
  phone: string | null
) {
  return {
    merchant_id: merchantId,
    email: order.customer.email,
    phone,
    full_name: order.customer.fullName,
    first_name: order.customer.firstName,
    last_name: order.customer.lastName,
  };
}
