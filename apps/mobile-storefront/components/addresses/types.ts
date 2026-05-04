/** Storefront customer shipping address used by the address list UI. */
export interface Address {
  /** Stable address identifier. */
  id: string;
  /** User-facing label such as Home or Work. */
  label: string;
  /** Recipient full name returned by the backend. */
  full_name: string;
  /** Primary contact phone number for this address. */
  phone: string;
  /** First-line street address. */
  address: string;
  /** City or locality. */
  city: string;
  /** State, province, or region. */
  state: string;
  /** Country name for display. */
  country: string;
  /** Optional postal or ZIP code. */
  postal_code?: string;
  /** Marks the default address when present and true. */
  is_default?: boolean;
}
