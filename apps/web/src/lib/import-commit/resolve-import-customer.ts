import type { SupabaseClient } from '@supabase/supabase-js';
import type { NormalizedImportedOrder } from '@/lib/imports/bumpa/bumpa-types';
import { sanitizeEmail, sanitizePhone } from '@/lib/sanitize-core';

interface ExistingCustomerRecord {
  id: string;
  email: string | null;
  phone: string | null;
  user_id: string | null;
}

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

        // No safe match, but the phone is taken by a customer who has email/user_id.
        // There can be at most one such customer (DB enforces uniqueness).
        // Link to them rather than inserting a duplicate phone.
        const allPhoneMatches =
          customerMaps.customersByPhone.get(phoneKey) || [];
        if (allPhoneMatches.length > 0) {
          return { customerId: allPhoneMatches[0].id, createdCustomer: false };
        }
      }

      // For email-identified orders where the phone is already in use, omit phone
      // from the INSERT to avoid customers_merchant_phone_unique.
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
            // Omit phone when it is already taken by a different customer, to avoid
            // customers_merchant_phone_unique. The existing phone holder is unchanged.
            phone: phoneAlreadyTaken ? null : order.customer.phone,
            full_name: order.customer.fullName,
            first_name: order.customer.firstName,
            last_name: order.customer.lastName,
          })
          .select('id, email, phone, user_id')
          .single();

      if (insertError || !insertedCustomer) {
        // Safety net for concurrent collisions not covered by the in-memory cache.
        // On a phone constraint error, retry without phone rather than merging identities.
        if (
          insertError?.code === '23505' &&
          insertError.message.includes('customers_merchant_phone_unique') &&
          phoneKey
        ) {
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
              `Failed to create imported customer: ${retryError?.message}`
            );
          }

          const retriedCustomer = retried as ExistingCustomerRecord;
          if (emailKey) {
            customerMaps.customersByEmail.set(emailKey, retriedCustomer);
          }
          return { customerId: retriedCustomer.id, createdCustomer: true };
        }

        throw new Error(
          `Failed to create imported customer: ${insertError?.message}`
        );
      }

      const createdCustomer = insertedCustomer as ExistingCustomerRecord;
      if (emailKey) {
        customerMaps.customersByEmail.set(emailKey, createdCustomer);
      }

      if (phoneKey) {
        const phoneCustomers =
          customerMaps.customersByPhone.get(phoneKey) || [];
        phoneCustomers.push(createdCustomer);
        customerMaps.customersByPhone.set(phoneKey, phoneCustomers);
      }

      return { customerId: createdCustomer.id, createdCustomer: true };
    },
  };
}
