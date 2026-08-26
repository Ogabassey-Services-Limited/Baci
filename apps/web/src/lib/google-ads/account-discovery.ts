import 'server-only';

export const GOOGLE_ADS_MANAGER_DISCOVERY_LIMIT =
  'GOOGLE_ADS_MANAGER_DISCOVERY_LIMIT' as const;
export const GOOGLE_ADS_MANAGER_DEPTH_LIMIT =
  'GOOGLE_ADS_MANAGER_DEPTH_LIMIT' as const;
export const GOOGLE_ADS_ACCOUNT_DISCOVERY_LIMIT =
  'GOOGLE_ADS_ACCOUNT_DISCOVERY_LIMIT' as const;
export const GOOGLE_ADS_DISCOVERY_LIMIT_CODES = [
  GOOGLE_ADS_MANAGER_DISCOVERY_LIMIT,
  GOOGLE_ADS_MANAGER_DEPTH_LIMIT,
  GOOGLE_ADS_ACCOUNT_DISCOVERY_LIMIT,
] as const;

const GOOGLE_ADS_MANAGER_DISCOVERY_QUERY = [
  'SELECT customer_client.client_customer, customer_client.level,',
  'customer_client.manager',
  'FROM customer_client',
  'WHERE customer_client.level <= 1',
].join(' ');

const GOOGLE_ADS_MAX_MANAGER_DEPTH = 5;
const GOOGLE_ADS_MAX_DISCOVERED_CUSTOMERS = 1_000;
const GOOGLE_ADS_MAX_MANAGER_PROBES = 20;
const GOOGLE_ADS_MANAGER_DISCOVERY_CONCURRENCY = 4;

type GoogleAdsManagerClient = {
  customerId: string;
  manager: boolean;
};

type DiscoveryQueueEntry = {
  depth: number;
  id: string;
};

type DiscoveryErrorFactory = (code: string, status?: number) => Error;

type AccountDiscoveryInput = {
  apiRoot: string;
  createError: DiscoveryErrorFactory;
  directCustomerIds: string[];
  fetchImpl: typeof fetch;
  headers: Record<string, string>;
};

function parseGoogleAdsCustomerId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const customerId = value.replace(/^customers\//, '');
  return /^\d{10}$/.test(customerId) ? customerId : null;
}

async function listGoogleAdsManagerClients(
  customerId: string,
  input: AccountDiscoveryInput
): Promise<GoogleAdsManagerClient[]> {
  const response = await input.fetchImpl(
    `${input.apiRoot}/customers/${customerId}/googleAds:searchStream`,
    {
      body: JSON.stringify({ query: GOOGLE_ADS_MANAGER_DISCOVERY_QUERY }),
      headers: {
        ...input.headers,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    }
  );
  // A normal, non-manager customer rejects the customer_client query. It is
  // still a valid directly accessible account, so there are no descendants.
  if (response.status === 400 || response.status === 404) return [];
  if (!response.ok) {
    throw input.createError(
      'GOOGLE_ADS_MANAGER_ACCOUNT_DISCOVERY_FAILED',
      response.status
    );
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw input.createError(
      'GOOGLE_ADS_MANAGER_ACCOUNT_DISCOVERY_RESPONSE_INVALID'
    );
  }
  const clients: GoogleAdsManagerClient[] = [];
  for (const batch of payload) {
    if (
      batch === null ||
      typeof batch !== 'object' ||
      !Array.isArray((batch as { results?: unknown }).results)
    ) {
      continue;
    }
    for (const result of (batch as { results: unknown[] }).results) {
      if (result === null || typeof result !== 'object') continue;
      const customerClient = (result as { customerClient?: unknown })
        .customerClient;
      if (customerClient === null || typeof customerClient !== 'object') {
        continue;
      }
      const parsedCustomerId = parseGoogleAdsCustomerId(
        (customerClient as { clientCustomer?: unknown }).clientCustomer
      );
      if (!parsedCustomerId) continue;
      clients.push({
        customerId: parsedCustomerId,
        manager: (customerClient as { manager?: unknown }).manager === true,
      });
    }
  }
  return clients;
}

export async function discoverGoogleAdsCustomerIds(
  input: AccountDiscoveryInput
): Promise<string[]> {
  const discoveredCustomerIds = new Set(input.directCustomerIds);
  const queue: DiscoveryQueueEntry[] = [
    ...new Set(input.directCustomerIds),
  ].map((id) => ({ depth: 0, id }));
  const queuedManagerIds = new Set(queue.map(({ id }) => id));
  const visitedManagers = new Set<string>();
  let probes = 0;

  while (queue.length > 0) {
    if (discoveredCustomerIds.size >= GOOGLE_ADS_MAX_DISCOVERED_CUSTOMERS) {
      throw input.createError(GOOGLE_ADS_ACCOUNT_DISCOVERY_LIMIT);
    }
    if (probes >= GOOGLE_ADS_MAX_MANAGER_PROBES) {
      throw input.createError(GOOGLE_ADS_MANAGER_DISCOVERY_LIMIT);
    }

    const batch: DiscoveryQueueEntry[] = [];
    while (
      batch.length < GOOGLE_ADS_MANAGER_DISCOVERY_CONCURRENCY &&
      queue.length > 0 &&
      probes + batch.length < GOOGLE_ADS_MAX_MANAGER_PROBES
    ) {
      const next = queue[0];
      if (!next || next.depth >= GOOGLE_ADS_MAX_MANAGER_DEPTH) break;
      queue.shift();
      queuedManagerIds.delete(next.id);
      if (visitedManagers.has(next.id)) continue;
      visitedManagers.add(next.id);
      batch.push(next);
    }
    if (batch.length === 0) {
      throw input.createError(GOOGLE_ADS_MANAGER_DEPTH_LIMIT);
    }

    probes += batch.length;
    const results = await Promise.all(
      batch.map(async (next) => ({
        clients: await listGoogleAdsManagerClients(next.id, input),
        depth: next.depth,
      }))
    );
    for (const result of results) {
      for (const client of result.clients) {
        discoveredCustomerIds.add(client.customerId);
        if (
          client.manager &&
          !visitedManagers.has(client.customerId) &&
          !queuedManagerIds.has(client.customerId)
        ) {
          queue.push({ depth: result.depth + 1, id: client.customerId });
          queuedManagerIds.add(client.customerId);
        }
      }
    }
  }

  return [...discoveredCustomerIds];
}
