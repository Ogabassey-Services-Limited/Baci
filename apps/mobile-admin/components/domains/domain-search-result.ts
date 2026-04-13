/**
 * Domain availability result returned from the domain search API.
 */
export interface DomainSearchResult {
  /** Whether the domain is available for purchase. */
  available: boolean;
  /** ISO currency code used to display the domain price. */
  currency: string;
  /** Fully qualified domain name, for example `baci.com`. */
  domain: string;
  /** Optional merchandising flag used to highlight promoted results. */
  popular?: boolean;
  /** Domain price in major currency units expected by the checkout flow. */
  price: number;
}
