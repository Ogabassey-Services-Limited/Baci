import {
  type Biller,
  type BillItem,
  getDataProviders,
  type NetworkProvider,
} from '@/lib/kuda';

const DATA_PLAN_CACHE_TTL_MS = 60_000;

interface DataPlanCandidate {
  item: BillItem;
  provider: Biller;
}

export interface ResolvedKudaDataPlan {
  amount: number;
  itemCode: string;
  itemName: string;
  originalDataPlanCode: string;
  providerName: string;
  resolvedFrom: 'exact_item_code' | 'provider_amount';
}

let dataProvidersCache:
  | {
      expiresAt: number;
      providers: Biller[];
    }
  | undefined;

export function clearKudaDataPlanCacheForTests() {
  dataProvidersCache = undefined;
}

function normalizeComparable(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function amountMatches(a: number, b: number) {
  return Math.round(a * 100) === Math.round(b * 100);
}

function formatNaira(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    currency: 'NGN',
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    style: 'currency',
  }).format(amount);
}

function collectLeafBillItems(items: BillItem[] | undefined): BillItem[] {
  if (!items?.length) {
    return [];
  }

  return items.flatMap((item) => {
    const nested = collectLeafBillItems(item.billItems);
    return nested.length > 0 ? nested : [item];
  });
}

function collectDataPlanCandidates(providers: Biller[]): DataPlanCandidate[] {
  return providers.flatMap((provider) =>
    collectLeafBillItems(provider.billItems).map((item) => ({
      item,
      provider,
    }))
  );
}

function providerMatchesCode(provider: Biller, dataPlanCode: string) {
  const normalizedCode = normalizeComparable(dataPlanCode);
  return (
    normalizeComparable(provider.billerId) === normalizedCode ||
    normalizeComparable(provider.billerName) === normalizedCode
  );
}

function providerMatchesNetwork(
  provider: Biller,
  networkProvider: NetworkProvider
) {
  const normalizedProviderName = normalizeComparable(provider.billerName);
  const normalizedNetwork = normalizeComparable(networkProvider);
  if (normalizedNetwork === '9mobile') {
    return (
      normalizedProviderName.includes('9mobile') ||
      normalizedProviderName.includes('9') ||
      normalizedProviderName.includes('t2') ||
      normalizedProviderName.includes('etisalat')
    );
  }

  return normalizedProviderName.includes(normalizedNetwork);
}

async function loadDataProviders() {
  const now = Date.now();
  if (dataProvidersCache && dataProvidersCache.expiresAt > now) {
    return dataProvidersCache.providers;
  }

  const providers = await getDataProviders();
  dataProvidersCache = {
    expiresAt: now + DATA_PLAN_CACHE_TTL_MS,
    providers,
  };
  return providers;
}

function mapResolvedCandidate(
  candidate: DataPlanCandidate,
  originalDataPlanCode: string,
  resolvedFrom: ResolvedKudaDataPlan['resolvedFrom']
): ResolvedKudaDataPlan {
  return {
    amount: candidate.item.amount,
    itemCode: candidate.item.itemCode,
    itemName: candidate.item.itemName,
    originalDataPlanCode,
    providerName: candidate.provider.billerName,
    resolvedFrom,
  };
}

export async function resolveKudaDataPlanForPurchase({
  amount,
  dataPlanCode,
  networkProvider,
}: {
  amount: number;
  dataPlanCode: string | undefined;
  networkProvider: NetworkProvider;
}): Promise<ResolvedKudaDataPlan> {
  const originalDataPlanCode = dataPlanCode?.trim();
  if (!originalDataPlanCode) {
    throw new Error('Data plan code is required for data purchases');
  }

  const providers = await loadDataProviders();
  const candidates = collectDataPlanCandidates(providers);

  if (candidates.length === 0) {
    return {
      amount,
      itemCode: originalDataPlanCode,
      itemName: originalDataPlanCode,
      originalDataPlanCode,
      providerName: networkProvider,
      resolvedFrom: 'exact_item_code',
    };
  }

  const normalizedCode = normalizeComparable(originalDataPlanCode);
  const exactMatch = candidates.find(
    ({ item }) => normalizeComparable(item.itemCode) === normalizedCode
  );
  if (exactMatch) {
    return mapResolvedCandidate(
      exactMatch,
      originalDataPlanCode,
      'exact_item_code'
    );
  }

  const providerScopedCandidates = candidates.filter(
    ({ provider }) =>
      providerMatchesCode(provider, originalDataPlanCode) ||
      providerMatchesNetwork(provider, networkProvider)
  );
  const amountMatchesForProvider = providerScopedCandidates.filter(({ item }) =>
    amountMatches(item.amount, amount)
  );

  if (amountMatchesForProvider.length === 1) {
    return mapResolvedCandidate(
      amountMatchesForProvider[0],
      originalDataPlanCode,
      'provider_amount'
    );
  }

  if (amountMatchesForProvider.length > 1) {
    throw new Error(
      `Multiple data bundles match ${networkProvider} at ${formatNaira(amount)}. Please refresh data bundles and select a package.`
    );
  }

  throw new Error(
    `Data bundle not found for ${networkProvider} at ${formatNaira(amount)}. Please refresh data bundles and select a package.`
  );
}
