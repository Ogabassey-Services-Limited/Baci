import type { SupabaseClient } from '@supabase/supabase-js';
import type { NormalizedImportedOrder } from '@/lib/imports/bumpa/bumpa-types';
import {
  buildCustomerInsert,
  buildCustomerMaps,
  type ExistingCustomerRecord,
  enrichPhoneCustomerEmail,
  isCustomerEmailConstraintError,
  rememberCustomer,
  reuseEmailCustomer,
  reusePhoneCustomer,
  toEmailKey,
  toPhoneKey,
} from './resolve-import-customer-helpers';

export interface ImportCustomerResolver {
  resolveCustomerId: (
    supabase: SupabaseClient,
    order: NormalizedImportedOrder
  ) => Promise<{ customerId: string; createdCustomer: boolean }>;
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
      const phoneCustomers = phoneKey
        ? customerMaps.customersByPhone.get(phoneKey) || []
        : [];

      if (emailKey && phoneCustomers.length === 1) {
        const [phoneCustomer] = phoneCustomers;
        if (phoneCustomer && !phoneCustomer.user_id) {
          const phoneCustomerEmailKey = toEmailKey(phoneCustomer.email);
          if (!phoneCustomerEmailKey) {
            const enrichedCustomer = await enrichPhoneCustomerEmail(
              resolverSupabase,
              merchantId,
              phoneCustomer,
              order
            );
            if (enrichedCustomer) {
              rememberCustomer(customerMaps, enrichedCustomer);
              return {
                customerId: enrichedCustomer.id,
                createdCustomer: false,
              };
            }
          }
        }
      }

      if (!emailKey && phoneCustomers.length === 1) {
        return { customerId: phoneCustomers[0].id, createdCustomer: false };
      }

      const phoneAlreadyTaken =
        emailKey != null && phoneKey != null && phoneCustomers.length > 0;

      const { data: insertedCustomer, error: insertError } =
        await resolverSupabase
          .from('customers')
          .insert(
            buildCustomerInsert(
              merchantId,
              order,
              phoneAlreadyTaken ? null : order.customer.phone
            )
          )
          .select('id, email, phone, user_id')
          .single();

      if (insertError || !insertedCustomer) {
        if (emailKey && isCustomerEmailConstraintError(insertError)) {
          return reuseEmailCustomer(
            resolverSupabase,
            merchantId,
            emailKey,
            customerMaps
          );
        }

        if (
          insertError?.code === '23505' &&
          insertError.message.includes('customers_merchant_phone_unique') &&
          phoneKey
        ) {
          if (!emailKey) {
            return reusePhoneCustomer(
              resolverSupabase,
              merchantId,
              order.customer.phone ?? phoneKey,
              insertError.message,
              customerMaps
            );
          }

          const { data: retried, error: retryError } = await resolverSupabase
            .from('customers')
            .insert(buildCustomerInsert(merchantId, order, null))
            .select('id, email, phone, user_id')
            .single();

          if (retryError || !retried) {
            if (emailKey && isCustomerEmailConstraintError(retryError)) {
              return reuseEmailCustomer(
                resolverSupabase,
                merchantId,
                emailKey,
                customerMaps
              );
            }

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
