import type { StoreLaunchReadiness } from './build-store-launch-readiness';

function getFirstProductMissingItem(totalProductCount: number): string {
  return totalProductCount > 0
    ? `At least one active product (you have ${totalProductCount} product(s) but none are active - go to Products and activate them)`
    : 'At least one active product';
}

function getMissingItemCopy(
  item: StoreLaunchReadiness['items'][number],
  totalProductCount: number
): string {
  switch (item.id) {
    case 'verify_kyc':
      return 'Identity verification (NIN, BVN, or CAC)';
    case 'bank_account':
      return 'Bank account details';
    case 'payment_method':
      return 'Payment method';
    case 'store_url':
      return 'Store URL';
    case 'first_product':
      return getFirstProductMissingItem(totalProductCount);
    case 'country':
      return 'Country/region setting';
    case 'contact_info':
      return 'Contact information (email or phone)';
  }
}

/** Converts only incomplete canonical launch requirements into publish copy. */
export function getStorePublicationMissingItems(
  readiness: StoreLaunchReadiness
): string[] {
  return readiness.items
    .filter((item) => item.priority === 'required' && !item.completed)
    .map((item) => getMissingItemCopy(item, readiness.totalProductCount));
}
