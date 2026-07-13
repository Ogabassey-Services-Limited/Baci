interface UsdtInitializeInput {
  amount: number;
  billingAddress: {
    city: string;
    country: string;
    line1: string;
    state?: string;
    zipCode: string;
  };
  chain: 'AVAXC' | 'ETH' | 'MATIC' | 'TRX';
  customerName?: string;
  customerPhone?: string;
  merchantSlug: string;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function createUsdtWalletFundingClient({
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
    async balance(merchant: string) {
      try {
        const response = await fetchImpl(
          `${baseUrl}/api/storefront/customer/wallet?merchant=${encodeURIComponent(merchant)}`,
          { headers: headers(), method: 'GET' }
        );
        const data = record(await response.json());
        const balances = record(data?.balances);
        const balance = Number(balances?.USDT);
        return response.ok && Number.isFinite(balance) ? balance : 0;
      } catch {
        return 0;
      }
    },

    async initialize(input: UsdtInitializeInput) {
      try {
        const response = await fetchImpl(
          `${baseUrl}/api/storefront/customer/wallet/top-up/usdt/initialize`,
          {
            body: JSON.stringify(input),
            headers: headers(true),
            method: 'POST',
          }
        );
        const data = record(await response.json());
        if (response.ok && data?.success === true) {
          const capturedAmount = Number(data.amount);
          return {
            address:
              typeof data.depositAddress === 'string'
                ? data.depositAddress
                : null,
            amount:
              Number.isFinite(capturedAmount) && capturedAmount > 0
                ? capturedAmount
                : input.amount,
            kind: 'ready' as const,
            reference: typeof data.reference === 'string' ? data.reference : '',
          };
        }
        return {
          error:
            typeof data?.error === 'string'
              ? data.error
              : 'Unable to create a USDT deposit address.',
          kind: 'error' as const,
        };
      } catch {
        return {
          error: 'Unable to create a USDT deposit address.',
          kind: 'error' as const,
        };
      }
    },

    async status(reference: string, merchantSlug: string) {
      try {
        const response = await fetchImpl(
          `${baseUrl}/api/storefront/customer/wallet/top-up/usdt/${encodeURIComponent(reference)}?merchantSlug=${encodeURIComponent(merchantSlug)}`,
          { headers: headers(), method: 'GET' }
        );
        const data = record(await response.json());
        return response.ok && data?.success === true
          ? {
              address:
                typeof data.depositAddress === 'string'
                  ? data.depositAddress
                  : null,
              fundingStatus:
                typeof data.fundingStatus === 'string'
                  ? data.fundingStatus
                  : 'pending',
              kind: 'ready' as const,
            }
          : { kind: 'error' as const };
      } catch {
        return { kind: 'error' as const };
      }
    },
  };
}
