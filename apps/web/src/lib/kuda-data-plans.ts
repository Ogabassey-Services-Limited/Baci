import { flattenKudaDataPlanBillItems } from '@baci/shared/lib';
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
  isAmountFixed: boolean;
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

function collectDataPlanCandidates(providers: Biller[]): DataPlanCandidate[] {
  return providers.flatMap((provider) =>
    flattenKudaDataPlanBillItems<BillItem>(provider.billItems).map((item) => ({
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
  resolvedFrom: ResolvedKudaDataPlan['resolvedFrom'],
  amountOverride?: number
): ResolvedKudaDataPlan {
  return {
    amount: amountOverride ?? candidate.item.amount,
    isAmountFixed: candidate.item.isAmountFixed,
    itemCode: candidate.item.itemCode,
    itemName: candidate.item.itemName,
    originalDataPlanCode,
    providerName: candidate.provider.billerName,
    resolvedFrom,
  };
}

function mapUnverifiedDataPlan({
  amount,
  originalDataPlanCode,
  providerName,
}: {
  amount: number;
  originalDataPlanCode: string;
  providerName: string;
}): ResolvedKudaDataPlan {
  return {
    amount,
    isAmountFixed: false,
    itemCode: originalDataPlanCode,
    itemName: originalDataPlanCode,
    originalDataPlanCode,
    providerName,
    resolvedFrom: 'exact_item_code',
  };
}

function hasLeafBillItems(provider: Biller) {
  return flattenKudaDataPlanBillItems<BillItem>(provider.billItems).length > 0;
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

  let providers: Biller[];
  try {
    providers = await loadDataProviders();
  } catch {
    return mapUnverifiedDataPlan({
      amount,
      originalDataPlanCode,
      providerName: networkProvider,
    });
  }

  const selectedProviderByCode =
    providers.find((provider) =>
      providerMatchesCode(provider, originalDataPlanCode)
    ) ?? null;
  const candidates = collectDataPlanCandidates(providers);

  if (
    candidates.length === 0 ||
    (selectedProviderByCode && !hasLeafBillItems(selectedProviderByCode))
  ) {
    return mapUnverifiedDataPlan({
      amount,
      originalDataPlanCode,
      providerName: selectedProviderByCode?.billerName ?? networkProvider,
    });
  }

  const normalizedCode = normalizeComparable(originalDataPlanCode);
  const exactMatch = candidates.find(
    ({ item }) => normalizeComparable(item.itemCode) === normalizedCode
  );
  if (exactMatch) {
    if (
      exactMatch.item.isAmountFixed &&
      exactMatch.item.amount > 0 &&
      !amountMatches(exactMatch.item.amount, amount)
    ) {
      throw new Error(
        `Data bundle amount changed for ${exactMatch.item.itemName}. Please refresh data bundles and select a package.`
      );
    }

    return mapResolvedCandidate(
      exactMatch,
      originalDataPlanCode,
      'exact_item_code',
      exactMatch.item.isAmountFixed ? undefined : amount
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
