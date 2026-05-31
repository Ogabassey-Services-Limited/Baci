import { createStorefrontCustomerApiClient } from '@/lib/storefront-customer-api-client';

let customerSavingsApiClient: ReturnType<
  typeof createStorefrontCustomerApiClient
> | null = null;

export function getCustomerSavingsApiClient() {
  customerSavingsApiClient ??= createStorefrontCustomerApiClient();
  return customerSavingsApiClient;
}
