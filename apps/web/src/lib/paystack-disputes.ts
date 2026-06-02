/**
 * Paystack Disputes Management Library
 * Programmatic handling of chargebacks and evidence submission
 */

import z from 'zod';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';

// =============================================================================
// Schemas
// =============================================================================

const DisputeSchema = z.object({
  id: z.number(),
  refund_amount: z.number(),
  currency: z.string(),
  status: z.string(),
  domain: z.string(),
  transaction: z.object({
    id: z.number(),
    domain: z.string(),
    status: z.string(),
    reference: z.string(),
    amount: z.number(),
    paid_at: z.string(),
  }),
  customer: z.object({
    id: z.number(),
    customer_code: z.string(),
    email: z.email(),
  }),
  bin: z.string().nullable(),
  last4: z.string().nullable(),
  due_at: z.string(),
  resolved_at: z.string().nullable(),
  created_at: z.string(),
});

export type Dispute = z.infer<typeof DisputeSchema>;

// =============================================================================
// API Requests
// =============================================================================

async function paystackRequest<T>(endpoint: string, options: RequestInit = {}) {
  const url = `${PAYSTACK_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      ...options.headers,
    },
  });

  const data = await response.json();
  if (!response.ok || !data.status) {
    throw new Error(data.message || 'Paystack API request failed');
  }
  return data.data as T;
}

/**
 * List disputes from Paystack
 */
export async function listDisputes(
  params: {
    from?: string;
    to?: string;
    perPage?: number;
    page?: number;
    status?: 'awaiting-reply' | 'awaiting-merchant-feedback' | 'resolved';
  } = {}
) {
  // Build query params safely, filtering out undefined values and converting numbers to strings
  const searchParams = new URLSearchParams();
  if (params.from !== undefined) searchParams.set('from', params.from);
  if (params.to !== undefined) searchParams.set('to', params.to);
  if (params.perPage !== undefined)
    searchParams.set('perPage', String(params.perPage));
  if (params.page !== undefined) searchParams.set('page', String(params.page));
  if (params.status !== undefined) searchParams.set('status', params.status);

  const query = searchParams.toString();
  return await paystackRequest<Dispute[]>(
    `/dispute${query ? `?${query}` : ''}`
  );
}

/**
 * Get a specific dispute by ID
 */
export async function getDispute(disputeId: string) {
  return await paystackRequest<Dispute>(`/dispute/${disputeId}`);
}

/**
 * Resolve a dispute
 */
export async function resolveDispute(
  disputeId: string,
  resolution: 'merchant-accepted' | 'declined'
) {
  return await paystackRequest(`/dispute/${disputeId}/resolve`, {
    method: 'PUT',
    body: JSON.stringify({ resolution }),
  });
}

/**
 * Submit evidence for a dispute
 */
export async function uploadEvidence(
  disputeId: string,
  data: {
    customer_email: string;
    customer_name: string;
    customer_phone: string;
    service_details: string;
    delivery_address?: string;
    delivery_date?: string;
  }
) {
  return await paystackRequest(`/dispute/${disputeId}/evidence`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
