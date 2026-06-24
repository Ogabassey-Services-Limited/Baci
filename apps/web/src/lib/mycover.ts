/**
 * MyCover.ai Insurance API Client (v2)
 *
 * Provides gadget insurance (device protection) for e-commerce orders.
 * Documentation: https://docs.mycover.ai
 */

const MYCOVER_BASE_URL = 'https://v2.api.mycover.ai/v2';

/** Known product configs — avoids API calls just to get provider name */
export const MYCOVER_PRODUCTS: Record<
  string,
  { name: string; providerName: string }
> = {
  'eec0711c-1e4a-453b-a26c-2726e0a1a7cc': {
    name: 'Gadget Cover V2',
    providerName: 'Sovereign Trust Insurance Plc',
  },
};

interface MyCoverConfig {
  secretKey: string;
  publicKey?: string;
}

export interface PurchaseGadgetParams {
  product_id: string;

  // Customer details
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string; // International format: 234...
  gender: 'Male' | 'Female';
  date_of_birth: string; // YYYY-MM-DD
  address: string;

  // Device details
  device_type: 'Phone' | 'Laptop' | 'Others';
  device_make: string;
  device_model: string;
  device_color: string;
  serial_number: string;
  device_purchase_date: string; // YYYY-MM-DD
  image_url: string;
  value: number;
}

export interface MyCoverPolicy {
  id: string;
  policy_number: string;
  is_active: boolean;
  customer_id: string;
  distributor_id?: string;
  start_date: string;
  expiration_date: string;
  amount: string; // Premium charged (source of truth)
  purchase_id: string;
  product_id: string;
  provider_id: string;
  certificate_url: string | null;
  meta?: { policy_number?: string };
}

interface MyCoverResponse<T> {
  responseCode: number;
  responseText: string;
  data: T;
}

interface WalletBalance {
  balance: string;
  commission_balance: string;
}

interface ListPoliciesParams {
  page?: number;
  limit?: number;
  is_active?: boolean;
  search?: string;
  product_id?: string;
  activated_at_start?: string;
  activated_at_end?: string;
  expired_at_start?: string;
  expired_at_end?: string;
}

interface ListClaimsParams {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
  start_date?: string;
  end_date?: string;
  customer_id?: string;
  search?: string;
}

interface MyCoverClaim {
  id: string;
  [key: string]: unknown;
}

interface MyCoverProduct {
  id: string;
  name: string;
  description: string;
  base_price: string;
  cover_period: string;
  is_percentage?: boolean;
  is_claimable?: boolean;
  is_inspectable?: boolean;
  is_certificateable?: boolean;
  provider: { id: string; organization_name: string };
  category: { id: string; name: string };
  [key: string]: unknown;
}

export class MyCoverClient {
  private secretKey: string;
  private publicKey?: string;

  constructor(config: MyCoverConfig) {
    this.secretKey = config.secretKey;
    this.publicKey = config.publicKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${MYCOVER_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const message = Array.isArray(error.responseText)
        ? error.responseText.join(', ')
        : error.responseText || `Request failed with status ${response.status}`;
      throw new MyCoverError(message, response.status, error);
    }

    return response.json();
  }

  /**
   * Get wallet balance
   */
  async getWalletBalance(): Promise<WalletBalance> {
    const response =
      await this.request<MyCoverResponse<WalletBalance>>('/wallet/balance');
    return response.data;
  }

  /**
   * Purchase gadget insurance via unified v2 endpoint
   */
  async purchaseGadgetInsurance(
    params: PurchaseGadgetParams
  ): Promise<MyCoverPolicy> {
    const response = await this.request<MyCoverResponse<MyCoverPolicy>>(
      '/products/buy',
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
    return response.data;
  }

  /**
   * Get a policy by ID
   */
  async getPolicy(policyId: string): Promise<MyCoverPolicy> {
    const response = await this.request<MyCoverResponse<MyCoverPolicy>>(
      `/policies/${policyId}`
    );
    return response.data;
  }

  /**
   * List policies with filters (v2)
   */
  async listPolicies(
    params: ListPoliciesParams = {}
  ): Promise<{ total_result: number; policies: MyCoverPolicy[] }> {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) searchParams.set(key, String(value));
    }
    const qs = searchParams.toString();
    const endpoint = qs ? `/policies?${qs}` : '/policies';

    const response =
      await this.request<
        MyCoverResponse<{ total_result: number; policies: MyCoverPolicy[] }>
      >(endpoint);
    return response.data;
  }

  /**
   * Get recent wallet transactions
   */
  async getRecentTransactions(): Promise<unknown[]> {
    const response = await this.request<MyCoverResponse<unknown[]>>(
      '/wallet/recent-transactions'
    );
    return response.data;
  }

  /**
   * List claims with filters (v2)
   */
  async getClaims(
    params: ListClaimsParams = {}
  ): Promise<{ total_result: number; claims: MyCoverClaim[] }> {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) searchParams.set(key, String(value));
    }
    const qs = searchParams.toString();
    const endpoint = qs ? `/claims?${qs}` : '/claims';

    const response =
      await this.request<
        MyCoverResponse<{ total_result: number; claims: MyCoverClaim[] }>
      >(endpoint);
    return response.data;
  }

  /**
   * Get a single claim by ID (v2)
   */
  async getClaimById(claimId: string): Promise<{ claim: MyCoverClaim }> {
    const response = await this.request<
      MyCoverResponse<{ claim: MyCoverClaim }>
    >(`/claims/${claimId}`);
    return response.data;
  }

  /**
   * Get a product by ID (v2)
   */
  async getProductById(productId: string): Promise<MyCoverProduct> {
    const response = await this.request<MyCoverResponse<MyCoverProduct>>(
      `/products/${productId}`
    );
    return response.data;
  }

  /**
   * List products with optional category filter (v2)
   */
  async listProducts(
    categoryId?: string
  ): Promise<{ total_count: number; products: MyCoverProduct[] }> {
    const params = new URLSearchParams();
    if (categoryId) params.set('category_id', categoryId);
    const qs = params.toString();
    const endpoint = qs ? `/products/all?${qs}` : '/products/all';

    const response =
      await this.request<
        MyCoverResponse<{ total_count: number; products: MyCoverProduct[] }>
      >(endpoint);
    return response.data;
  }

  /** Product categories (v2) — for dynamic product discovery. */
  async getProductCategories(): Promise<unknown> {
    const response = await this.request<MyCoverResponse<unknown>>(
      '/products/categories'
    );
    return response.data;
  }

  /** All customers on the integration (v2). */
  async listCustomers(
    params: Record<string, string | number> = {}
  ): Promise<unknown> {
    const endpoint = withQuery('/customers', params);
    const response = await this.request<MyCoverResponse<unknown>>(endpoint);
    return response.data;
  }

  /** A single customer's profile (v2). */
  async getCustomerById(customerId: string): Promise<unknown> {
    const response = await this.request<MyCoverResponse<unknown>>(
      `/customers/${encodeURIComponent(customerId)}`
    );
    return response.data;
  }

  /** A customer's purchase history (v2). */
  async getCustomerPurchases(customerId: string): Promise<unknown> {
    const response = await this.request<MyCoverResponse<unknown>>(
      `/customers/${encodeURIComponent(customerId)}/purchases`
    );
    return response.data;
  }

  /** A customer's policy history (v2). */
  async getCustomerPolicies(customerId: string): Promise<unknown> {
    const response = await this.request<MyCoverResponse<unknown>>(
      `/customers/${encodeURIComponent(customerId)}/policies`
    );
    return response.data;
  }

  /** All purchases & renewals (Sales, v2). */
  async listPurchases(
    params: Record<string, string | number> = {}
  ): Promise<unknown> {
    const endpoint = withQuery('/purchases', params);
    const response = await this.request<MyCoverResponse<unknown>>(endpoint);
    return response.data;
  }

  /** A single purchase/renewal record (v2). */
  async getPurchaseById(purchaseId: string): Promise<unknown> {
    const response = await this.request<MyCoverResponse<unknown>>(
      `/purchases/${encodeURIComponent(purchaseId)}`
    );
    return response.data;
  }

  /** Supported gender options (auxiliary, v2). */
  async getGenders(): Promise<unknown> {
    const response =
      await this.request<MyCoverResponse<unknown>>('/utilities/genders');
    return response.data;
  }

  /** Nigerian states & LGAs (auxiliary, v2). */
  async getStates(): Promise<unknown> {
    const response = await this.request<MyCoverResponse<unknown>>(
      `/products/utility/${MYCOVER_STATES_UTILITY_ID}`
    );
    return response.data;
  }

  /**
   * Upload a file (e.g. device photo / claim evidence) and get an `upload_id`
   * to attach to inspectable products (auxiliary, v2). Uses multipart, so it
   * bypasses the JSON `request()` helper.
   */
  async uploadFile(
    file: Blob,
    filename = 'upload'
  ): Promise<{ upload_id: string }> {
    const form = new FormData();
    form.append('file', file, filename);

    let response: Response;
    try {
      response = await fetch(`${MYCOVER_BASE_URL}/utilities/files/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.secretKey}` },
        body: form,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'File upload failed';
      throw new MyCoverError(message, 0, { cause: error });
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new MyCoverError(
        error.responseText || `File upload failed (${response.status})`,
        response.status,
        error
      );
    }

    const json = (await response.json()) as MyCoverResponse<{
      upload_id: string;
    }>;
    return json.data;
  }
}

const MYCOVER_STATES_UTILITY_ID = 'e55de863-7d98-4236-bd61-40328cd7f7fc';

function withQuery(
  path: string,
  params: Record<string, string | number>
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

export class MyCoverError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'MyCoverError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Estimate insurance premium for UI display.
 *
 * NOTE: This is a UX-only estimate. The actual premium is determined by
 * MyCover at purchase time and returned in the response `amount` field.
 * Always persist the response `amount`, never this estimate.
 */
export function estimateInsurancePremium(itemValue: number): {
  estimated: number;
  range: { min: number; max: number };
} {
  const rate = 0.05; // Gadget Cover V2 is 5%

  return {
    estimated: Math.round(itemValue * rate),
    range: {
      min: Math.round(itemValue * rate),
      max: Math.round(itemValue * rate),
    },
  };
}

/**
 * Create MyCover client instance from environment variables
 */
export function createMyCoverClient(): MyCoverClient | null {
  const secretKey = process.env.MYCOVER_SECRET_KEY;
  const publicKey = process.env.MYCOVER_PUBLIC_KEY;

  if (!secretKey) {
    console.warn('MyCover.ai: MYCOVER_SECRET_KEY not configured');
    return null;
  }

  return new MyCoverClient({ secretKey, publicKey });
}

// Type exports for use in other modules
export type {
  ListClaimsParams,
  ListPoliciesParams,
  MyCoverClaim,
  MyCoverConfig,
  MyCoverProduct,
  MyCoverResponse,
  WalletBalance,
};
