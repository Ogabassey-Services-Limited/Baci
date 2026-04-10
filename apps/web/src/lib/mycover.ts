/**
 * MyCover.ai Insurance API Client
 *
 * Provides shipping insurance (Goods in Transit) for e-commerce orders.
 * Documentation: https://docs.mycover.ai
 */

const MYCOVER_BASE_URL = 'https://api.mycover.ai/v1';

interface MyCoverConfig {
  secretKey: string;
  publicKey?: string;
}

interface ItemDetail {
  description: string;
  value: number;
  quantity: number;
  image?: string;
}

interface PurchaseGadgetParams {
  // Customer details
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  address: string;
  gender: 'Male' | 'Female';
  date_of_birth: string; // YYYY-MM-DD
  occupation: string;
  title: string;

  // Device details
  model_number: string;
  device_type: 'Phone' | 'Laptop' | 'Others';
  device_make: string;
  device_model: string;
  device_color: string;
  imei_one: string;
  imei_two?: string;
  date_of_purchase: string; // YYYY-MM-DD
  device_value: number;
  device_serial_number: string;

  // Images
  id_image_url: string; // Required by API (can be placeholder via negotiation)
  device_about_image_url: string;

  // Product ID from MyCover
  product_id: string;
}

interface PurchaseGITParams {
  // Customer details
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;

  // Location
  address: string;
  pickup_location: string;
  drop_off_location: string;

  // Shipment details
  shipping_date: string; // ISO date string
  vehicle_type:
    | 'Truck'
    | 'Car'
    | 'Bus'
    | 'Motorcycle'
    | 'Tricycle'
    | 'Air Plane';
  vehicle_plate_number?: string;

  // Coverage
  item_value: number;
  item_details: ItemDetail[];

  // Product ID from MyCover
  product_id?: string;
}

interface MyCoverPolicy {
  id: string;
  policy_number: string;
  status: string;
  customer_id: string;
  distributor_id: string;
  start_date: string;
  expiration_date: string;
  genius_price: number;
  market_price: number;
  purchase_id: string;
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

interface PolicySearchParams {
  start_date?: string;
  end_date?: string;
  status?: string;
  customer_email?: string;
  customer_id?: string;
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
      throw new MyCoverError(
        error.responseText || `Request failed with status ${response.status}`,
        response.status,
        error
      );
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
   * Purchase Goods in Transit (shipping) insurance
   */
  async purchaseShippingInsurance(
    params: PurchaseGITParams
  ): Promise<MyCoverPolicy> {
    const response = await this.request<MyCoverResponse<MyCoverPolicy>>(
      '/products/sti/buy-git-ondemand',
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
    return response.data;
  }

  /**
   * Purchase Gadget Insurance (Device Protection)
   * Provider: Sovereign Trust Insurance (STI)
   */
  async purchaseGadgetInsurance(
    params: PurchaseGadgetParams
  ): Promise<MyCoverPolicy> {
    // API requires 'imei_number' but typed as 'imei_one' in our interface for consistency
    // We map it here to match the API expectation
    const payload = {
      ...params,
      imei_number: params.imei_one, // Map imei_one to imei_number
    };

    const response = await this.request<
      MyCoverResponse<{ policy: MyCoverPolicy }>
    >('/products/sti/buy-gadget-cover', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    // Note: Gadget API returns { policy: {...} } nested inside data
    return response.data.policy;
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
   * Search policies with filters
   */
  async searchPolicies(params: PolicySearchParams): Promise<MyCoverPolicy[]> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) searchParams.set(key, value);
    });

    const response = await this.request<MyCoverResponse<MyCoverPolicy[]>>(
      `/policies/search?${searchParams.toString()}`
    );
    return response.data;
  }

  /**
   * List all policies with pagination
   */
  async listPolicies(
    page = 1,
    limit = 20
  ): Promise<{ policies: MyCoverPolicy[]; total: number }> {
    const response = await this.request<
      MyCoverResponse<{ policies: MyCoverPolicy[]; total: number }>
    >(`/policies?page=${page}&limit=${limit}`);
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
   * Get claims for this distributor
   */
  async getClaims(): Promise<unknown[]> {
    const response = await this.request<MyCoverResponse<unknown[]>>('/claims');
    // API returns { data: { claims: [], total_count: 0 } } or sometimes just []
    // We normalize to array
    // biome-ignore lint/suspicious/noExplicitAny: MyCover API response structure varies
    const data = response.data as any;
    if (data && Array.isArray(data.claims)) {
      return data.claims;
    }
    return Array.isArray(data) ? data : [];
  }
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
 * Calculate estimated insurance premium
 * MyCover typically charges ~1-2% of item value
 */
export function estimateInsurancePremium(itemValue: number): {
  estimated: number;
  range: { min: number; max: number };
} {
  const minRate = 0.01; // 1%
  const maxRate = 0.02; // 2%

  return {
    estimated: Math.round(itemValue * 0.015), // 1.5% average
    range: {
      min: Math.round(itemValue * minRate),
      max: Math.round(itemValue * maxRate),
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
  ItemDetail,
  MyCoverConfig,
  MyCoverPolicy,
  MyCoverResponse,
  PolicySearchParams,
  PurchaseGadgetParams,
  PurchaseGITParams,
  WalletBalance,
};
