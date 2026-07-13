export interface MobileImeiRemediationOffer {
  carrier: string;
  id: string;
  name: string;
  priceNgn: number;
  priceUsdt: number;
  refundPolicy: 'no_refund_denial' | 'refundable';
  successRate: number | null;
  turnaround: string | null;
}

export interface MobileImeiRemediationOrder {
  amountNgn: number | null;
  amountUsdt: number | null;
  carrier: string | null;
  createdAt: string;
  customerMessage: string | null;
  deviceModel: string | null;
  id: string;
  paymentCurrency: 'NGN' | 'USDT' | null;
  refundPolicy: 'no_refund_denial' | 'refundable' | null;
  status: string;
  successRate: number | null;
  turnaround: string | null;
  updatedAt: string;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function offer(value: unknown): MobileImeiRemediationOffer | null {
  const data = record(value);
  if (
    !data ||
    typeof data.carrier !== 'string' ||
    typeof data.id !== 'string' ||
    typeof data.name !== 'string' ||
    typeof data.priceNgn !== 'number' ||
    typeof data.priceUsdt !== 'number' ||
    (data.refundPolicy !== 'refundable' &&
      data.refundPolicy !== 'no_refund_denial')
  ) {
    return null;
  }
  return {
    carrier: data.carrier,
    id: data.id,
    name: data.name,
    priceNgn: data.priceNgn,
    priceUsdt: data.priceUsdt,
    refundPolicy: data.refundPolicy,
    successRate: typeof data.successRate === 'number' ? data.successRate : null,
    turnaround: typeof data.turnaround === 'string' ? data.turnaround : null,
  };
}

export function createImeiRemediationClient({
  accessToken,
  apiBaseUrl,
  fetchImpl = fetch,
}: {
  accessToken?: string;
  apiBaseUrl: string;
  fetchImpl?: typeof fetch;
}) {
  const baseUrl = apiBaseUrl.replace(/\/$/, '');
  const headers = (json = false) => ({
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  });

  return {
    async eligibility(input: { identifier: string; lookupId: string }) {
      try {
        const response = await fetchImpl(
          `${baseUrl}/api/storefront/imei-remediation/eligibility`,
          {
            body: JSON.stringify(input),
            headers: headers(true),
            method: 'POST',
          }
        );
        const data = record(await response.json());
        if (response.status === 404) return { kind: 'hidden' as const };
        if (response.status === 202 && data?.status === 'eligibility_pending') {
          return {
            kind: 'pending' as const,
            pollAfterMs:
              typeof data.pollAfterMs === 'number' ? data.pollAfterMs : 5_000,
          };
        }
        if (response.ok && data?.status === 'suppressed') {
          return { kind: 'suppressed' as const };
        }
        if (
          response.ok &&
          data?.status === 'eligible' &&
          typeof data.assessmentId === 'string' &&
          Array.isArray(data.offers)
        ) {
          const offers = data.offers
            .map((candidate) => offer(candidate))
            .filter((candidate): candidate is MobileImeiRemediationOffer =>
              Boolean(candidate)
            );
          return offers.length > 0
            ? {
                assessmentId: data.assessmentId,
                kind: 'eligible' as const,
                offers,
                usdtEnabled: data.usdtEnabled === true,
              }
            : { kind: 'suppressed' as const };
        }
        return { kind: 'error' as const };
      } catch {
        return { kind: 'error' as const };
      }
    },

    async list(): Promise<MobileImeiRemediationOrder[]> {
      try {
        const response = await fetchImpl(
          `${baseUrl}/api/storefront/imei-remediation/orders`,
          { headers: headers(), method: 'GET' }
        );
        const data = record(await response.json());
        return response.ok && Array.isArray(data?.orders)
          ? (data.orders as MobileImeiRemediationOrder[])
          : [];
      } catch {
        return [];
      }
    },

    async place(input: {
      identifier: string;
      orderId: string;
      paymentCurrency: 'NGN' | 'USDT';
      productId: string;
    }) {
      try {
        const response = await fetchImpl(
          `${baseUrl}/api/storefront/imei-remediation/orders`,
          {
            body: JSON.stringify(input),
            headers: headers(true),
            method: 'POST',
          }
        );
        const data = record(await response.json());
        if (response.ok && typeof data?.status === 'string') {
          return {
            kind:
              response.status === 202
                ? ('pending' as const)
                : ('terminal' as const),
            status: data.status,
          };
        }
        return {
          code: typeof data?.code === 'string' ? data.code : 'ORDER_FAILED',
          kind: 'error' as const,
          status: response.status,
        };
      } catch {
        return { code: 'NETWORK_ERROR', kind: 'error' as const, status: 0 };
      }
    },
  };
}
