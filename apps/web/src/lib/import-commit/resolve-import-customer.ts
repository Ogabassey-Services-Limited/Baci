import type { SupabaseClient } from '@supabase/supabase-js';
import type { NormalizedImportedOrder } from '@/lib/imports/bumpa/bumpa-types';
import { sanitizeEmail, sanitizePhone } from '@/lib/sanitize-core';

const LIKE_PATTERN_ESCAPE_REGEX = /[%_\\]/g;

interface ExistingCustomerRecord {
  id: string;
  email: string | null;
  phone: string | null;
  user_id: string | null;
  deleted_at?: string | null;
}

type CustomerMaps = ReturnType<typeof buildCustomerMaps>;

export interface ImportCustomerResolver {
  resolveCustomerId: (
    supabase: SupabaseClient,
    order: NormalizedImportedOrder
  ) => Promise<{ customerId: string; createdCustomer: boolean }>;
}

function toEmailKey(value: string | null) {
  if (!value) return null;
  return sanitizeEmail(value);
}

function toPhoneKey(value: string | null) {
  if (!value) return null;
  return sanitizePhone(value).replace(/[\s()-]+/g, '');
}

function escapeLikePattern(value: string) {
  return value.replace(LIKE_PATTERN_ESCAPE_REGEX, '\\$&');
}

function buildCustomerMaps(customers: ExistingCustomerRecord[]) {
  const customersByEmail = new Map<string, ExistingCustomerRecord>();
  const customersByPhone = new Map<string, ExistingCustomerRecord[]>();

  for (const customer of customers) {
    const emailKey = toEmailKey(customer.email);
    if (emailKey) {
      customersByEmail.set(emailKey, customer);
    }

    const phoneKey = toPhoneKey(customer.phone);
    if (!phoneKey) {
      continue;
    }

    const entries = customersByPhone.get(phoneKey) || [];
    entries.push(customer);
    customersByPhone.set(phoneKey, entries);
  }

  return { customersByEmail, customersByPhone };
}

function rememberCustomer(
  customerMaps: CustomerMaps,
  customer: ExistingCustomerRecord
) {
  const emailKey = toEmailKey(customer.email);
  if (emailKey) {
    customerMaps.customersByEmail.set(emailKey, customer);
  }

  const phoneKey = toPhoneKey(customer.phone);
  if (!phoneKey) {
    return;
  }

  const phoneCustomers = customerMaps.customersByPhone.get(phoneKey) || [];
  if (!phoneCustomers.some((entry) => entry.id === customer.id)) {
    phoneCustomers.push(customer);
  }
  customerMaps.customersByPhone.set(phoneKey, phoneCustomers);
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
    .ilike('email', escapeLikePattern(emailKey));

  if (!includeDeleted) {
    query = query.is('deleted_at', null);
  }

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

async function findExistingCustomerByEmail(
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
  if (activeCustomer) {
    return activeCustomer;
  }

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
  if (existingCustomer) {
    return existingCustomer;
  }

  throw new Error('Failed to resolve conflicting customer by email: not found');
}

function isCustomerEmailConstraintError(
  error: { code?: string; message?: string } | null | undefined
) {
  return (
    error?.code === '23505' &&
    (error.message?.includes('customers_merchant_id_email_key') ||
      error.message?.includes('customers_merchant_email_unique') ||
      error.message?.includes('idx_customers_merchant_email'))
  );
}

export async function createImportCustomerResolver(
  supabase: SupabaseClient,
  merchantId: string
): Promise<ImportCustomerResolver> {
  const { data, error } = await supabase
    .from('customers')
    .select('id, email, phone, user_id')
    .eq('merchant_id', merchantId)
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Failed to load customers for import: ${error.message}`);
  }

  const customerMaps = buildCustomerMaps(
    (data || []) as ExistingCustomerRecord[]
  );

  return {
    async resolveCustomerId(
      resolverSupabase: SupabaseClient,
      order: NormalizedImportedOrder
    ) {
      const emailKey = toEmailKey(order.customer.email);
      if (emailKey) {
        const existingCustomer = customerMaps.customersByEmail.get(emailKey);
        if (existingCustomer) {
          return { customerId: existingCustomer.id, createdCustomer: false };
        }
      }

      const phoneKey = toPhoneKey(order.customer.phone);
      if (!emailKey && phoneKey) {
        const safePhoneMatches =
          customerMaps.customersByPhone
            .get(phoneKey)
            ?.filter((candidate) => !candidate.email && !candidate.user_id) ||
          [];

        if (safePhoneMatches.length === 1) {
          return { customerId: safePhoneMatches[0].id, createdCustomer: false };
        }

        const allPhoneMatches =
          customerMaps.customersByPhone.get(phoneKey) || [];
        if (allPhoneMatches.length === 1) {
          return { customerId: allPhoneMatches[0].id, createdCustomer: false };
        }
      }

      const phoneAlreadyTaken =
        emailKey != null &&
        phoneKey != null &&
        (customerMaps.customersByPhone.get(phoneKey)?.length ?? 0) > 0;

      const { data: insertedCustomer, error: insertError } =
        await resolverSupabase
          .from('customers')
          .insert({
            merchant_id: merchantId,
            email: order.customer.email,
            phone: phoneAlreadyTaken ? null : order.customer.phone,
            full_name: order.customer.fullName,
            first_name: order.customer.firstName,
            last_name: order.customer.lastName,
          })
          .select('id, email, phone, user_id')
          .single();

      if (insertError || !insertedCustomer) {
        if (emailKey && isCustomerEmailConstraintError(insertError)) {
          const existingCustomer = await findExistingCustomerByEmail(
            resolverSupabase,
            merchantId,
            emailKey
          );
          rememberCustomer(customerMaps, existingCustomer);
          return { customerId: existingCustomer.id, createdCustomer: false };
        }

        if (
          insertError?.code === '23505' &&
          insertError.message.includes('customers_merchant_phone_unique') &&
          phoneKey
        ) {
          if (!emailKey) {
            const { data: existing, error: lookupError } =
              await resolverSupabase
                .from('customers')
                .select('id, email, phone, user_id')
                .eq('merchant_id', merchantId)
                .eq('phone', order.customer.phone)
                .single();

            if (lookupError || !existing) {
              throw new Error(
                `Failed to resolve conflicting customer by phone: ${lookupError?.message ?? insertError.message}`
              );
            }

            const existingCustomer = existing as ExistingCustomerRecord;
            rememberCustomer(customerMaps, existingCustomer);
            return { customerId: existingCustomer.id, createdCustomer: false };
          }

          const { data: retried, error: retryError } = await resolverSupabase
            .from('customers')
            .insert({
              merchant_id: merchantId,
              email: order.customer.email,
              phone: null,
              full_name: order.customer.fullName,
              first_name: order.customer.firstName,
              last_name: order.customer.lastName,
            })
            .select('id, email, phone, user_id')
            .single();

          if (retryError || !retried) {
            throw new Error(
              `Failed to create imported customer: ${retryError?.message ?? insertError.message}`
            );
          }

          const retriedCustomer = retried as ExistingCustomerRecord;
          rememberCustomer(customerMaps, retriedCustomer);
          return { customerId: retriedCustomer.id, createdCustomer: true };
        }

        throw new Error(
          `Failed to create imported customer: ${insertError?.message}`
        );
      }

      const createdCustomer = insertedCustomer as ExistingCustomerRecord;
      rememberCustomer(customerMaps, createdCustomer);

      return { customerId: createdCustomer.id, createdCustomer: true };
    },
  };
}
